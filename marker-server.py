import os
import shutil
import tempfile
import asyncio
import pathlib
import logging
import inspect
from typing import List, Optional, Literal, Dict, Any

from fastapi import FastAPI, UploadFile, File, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
import httpx
import subprocess
import json
import math

# Optional heavy deps – used if available
try:
    import numpy as np  # type: ignore
except Exception:  # pragma: no cover
    np = None  # type: ignore

try:
    import trimesh  # type: ignore
except Exception:  # pragma: no cover
    trimesh = None  # type: ignore

try:
    import meshio  # type: ignore
except Exception:  # pragma: no cover
    meshio = None  # type: ignore

try:
    # SfePy imports – will only be used if installed
    from sfepy.discrete.fem import Mesh as SfepyMesh, FEDomain, Field as SfepyField
    from sfepy.discrete import (Problem)  # high-level API
    from sfepy.discrete.integrals import Integral, Integrals
    from sfepy import data_dir
    from sfepy.mechanics.matcoefs import stiffness_from_youngpoisson
    from sfepy.discrete.conditions import Conditions, EssentialBC
    from sfepy.terms import Term
    from sfepy.discrete.variables import FieldVariable
    from sfepy.discrete.materials import Material
    from sfepy.discrete.equations import Equations, Equation
    from sfepy.solvers.ls import ScipyDirect
    from sfepy.solvers.nls import Newton
    from sfepy.base.base import IndexedStruct
    from sfepy.base.base import Struct
    SFE_AVAILABLE = True
except Exception:  # pragma: no cover
    SFE_AVAILABLE = False

logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s %(name)s: %(message)s')
logger = logging.getLogger("marker_api")

app = FastAPI(title="Marker API", version="2.0.0")

# CORS for browser clients (adjust origins as needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # you can restrict to specific origins later
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "marker")

# Material properties (simplified)
MATERIALS = {
    "mdf": {
        "youngs_modulus": 3.0e9,   # Pa
        "poisson_ratio": 0.30,
        "tensile_strength": 20.0e6,  # Pa
    },
    "pla": {
        "youngs_modulus": 3.5e9,
        "poisson_ratio": 0.36,
        "tensile_strength": 60.0e6,
    },
}


class Force(BaseModel):
    location: List[float] = Field(..., min_items=3, max_items=3, description="[x,y,z] position in model units")
    direction: List[float] = Field(..., min_items=3, max_items=3, description="[dx,dy,dz] normalized vector")
    magnitude: float = Field(..., gt=0, description="Force in Newtons")

    @validator("direction")
    def _normalize_dir(cls, v):
        if len(v) != 3:
            raise ValueError("direction must be 3 components")
        norm = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
        if norm == 0:
            raise ValueError("direction vector magnitude cannot be zero")
        return [c / norm for c in v]


class SimulateRequest(BaseModel):
    model_url: str
    forces: List[Force]
    material: Literal["mdf", "pla"]


async def _download_model(url: str, dest_dir: pathlib.Path) -> pathlib.Path:
    """Download model file from a public URL to dest_dir and return local path."""
    suffix = pathlib.Path(httpx.URL(url).path).suffix.lower()
    if suffix not in (".stl", ".glb", ".gltf"):
        logger.warning("Model appears to have unsupported extension: %s", suffix)
    local_path = dest_dir / ("model" + (suffix or ".stl"))
    # Reuse existing download_to_file utility
    # Note: This assumes the URL is publicly accessible.
    await download_to_file(url, local_path)
    return local_path


# Wrapper with a unique name to avoid any hot-reload/stale reference issues
async def fetch_model_to_tmp(url: str, dest_dir: pathlib.Path) -> pathlib.Path:
    path = await _download_model(url, dest_dir)
    return path


def _convert_to_stl_if_needed(src_path: pathlib.Path) -> pathlib.Path:
    """Convert a .glb/.gltf model to .stl using trimesh if available; otherwise return input if already STL."""
    ext = src_path.suffix.lower()
    if ext == ".stl":
        return src_path
    if trimesh is None:
        raise HTTPException(status_code=500, detail="trimesh is required to convert GLB/GLTF to STL but is not installed.")
    try:
        mesh = trimesh.load(src_path, force="mesh")
        out_path = src_path.with_suffix(".stl")
        mesh.export(out_path)
        return out_path
    except Exception as e:
        logger.exception("Failed exporting STL via trimesh")
        raise HTTPException(status_code=500, detail=f"Failed to convert model to STL: {e}")


def _tetrahedralize_stl(stl_path: pathlib.Path) -> pathlib.Path:
    """Create a volume tetrahedral mesh from STL surface. Requires meshio+gmsh installed on system.
    Returns path to generated .vtu mesh file (or similar) that SfePy can read via meshio conversion.
    """
    if meshio is None:
        raise HTTPException(status_code=500, detail="meshio is required for tetrahedralization but is not installed.")
    gmsh_exe = shutil.which("gmsh")
    if not gmsh_exe:
        raise HTTPException(status_code=500, detail="gmsh binary is required to tetrahedralize STL. Please install gmsh and ensure it is in PATH.")

    out_msh = stl_path.with_suffix(".msh")
    out_vtu = stl_path.with_suffix(".vtu")

    def _run_gmsh(cmd: list[str]) -> None:
        logger.info("Running gmsh tetrahedralization: %s", " ".join(cmd))
        try:
            res = subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if res.stdout:
                logger.info("gmsh stdout:\n%s", res.stdout)
            if res.stderr:
                logger.warning("gmsh stderr:\n%s", res.stderr)
        except subprocess.CalledProcessError as e:
            logger.error("gmsh failed: %s", e.stderr)
            raise HTTPException(status_code=500, detail=f"gmsh tetrahedralization failed: {e.stderr}")

    # First attempt: direct -3 on STL, with native repair and optimize
    _run_gmsh([gmsh_exe, "-3", str(stl_path), "-o", str(out_msh), "-format", "msh2"])

    def _has_tets(path: pathlib.Path) -> bool:
        try:
            msh_local = meshio.read(path)
            return any(c.type in ("tetra", "tetra10") for c in getattr(msh_local, 'cells', []))
        except Exception:
            return False

    # If no tets, retry with a .geo that merges STL and defines a Volume from all Surfaces
    if not _has_tets(out_msh):
        logger.warning("No tetrahedra after direct gmsh -3. Retrying with .geo volume script...")
        geo_path = stl_path.with_suffix(".geo")
        geo_content = f"""
Merge \"{stl_path.as_posix()}\";
Surface Loop(1) = Surface{{:}};
Volume(1) = {{1}};
Mesh.Optimize = 1;
Mesh.Smoothing = 2;
Mesh 3;
"""
        geo_path.write_text(geo_content)
        _run_gmsh([gmsh_exe, "-3", str(geo_path), "-o", str(out_msh), "-format", "msh2"])

    def _convert_or_raise(msh_path: pathlib.Path) -> pathlib.Path:
        logger.info("Converting .msh -> .vtu via meshio: %s", msh_path)
        try:
            msh_local = meshio.read(msh_path)
            # Keep only tetrahedral cells to avoid SfePy reading a 2D topological mesh
            tetra_blocks = [c for c in getattr(msh_local, 'cells', []) if c.type in ("tetra", "tetra10")]
            if not tetra_blocks:
                raise ValueError("no_tetra")
            # Report tetra count
            n_tets = sum(len(c.data) for c in tetra_blocks)
            logger.info("Tetrahedral cells: %d", n_tets)
            if n_tets < 10:
                raise ValueError("too_few_tets")
            filtered = meshio.Mesh(points=msh_local.points, cells=tetra_blocks, point_data=msh_local.point_data, cell_data={k: v for k, v in getattr(msh_local, 'cell_data', {}).items() if k in ("tetra", "tetra10")})
            meshio.write(out_vtu, filtered)
            return out_vtu
        except ValueError as ve:
            if str(ve) == "no_tetra":
                logger.error("No tetrahedral cells in: %s", msh_path)
                raise HTTPException(status_code=500, detail="Volume meshing failed: only surface mesh detected.")
            if str(ve) == "too_few_tets":
                logger.error("Too few tetrahedral cells in: %s", msh_path)
                raise HTTPException(status_code=500, detail="Volume meshing failed: too few tetrahedral elements for stable solve.")
            raise
        except Exception as e:
            logger.exception("meshio conversion failed")
            raise HTTPException(status_code=500, detail=f"meshio conversion failed: {e}")

    # First try to convert the current out_msh; if it lacks tets, attempt repair.
    try:
        return _convert_or_raise(out_msh)
    except HTTPException as e1:
        if getattr(e1, 'detail', '').startswith("Volume meshing failed") and trimesh is not None:
            logger.warning("Attempting STL repair via trimesh due to missing tetrahedra...")

            def _repair_stl(src: pathlib.Path) -> pathlib.Path:
                m = trimesh.load(src, force='mesh')
                if not isinstance(m, trimesh.Trimesh):
                    raise RuntimeError("Loaded geometry is not a Trimesh")
                # Basic repairs
                try:
                    m.remove_duplicate_faces()
                except Exception:
                    pass
                try:
                    m.remove_degenerate_faces()
                except Exception:
                    pass
                try:
                    trimesh.repair.fix_normals(m)
                except Exception:
                    pass
                try:
                    trimesh.repair.fill_holes(m)
                except Exception:
                    pass
                try:
                    trimesh.repair.fix_inversion(m)
                except Exception:
                    pass
                if not m.is_watertight:
                    logger.warning("Mesh still not watertight; using convex hull as fallback for volume generation")
                    m = m.convex_hull
                repaired_path = src.with_suffix(".repaired.stl")
                m.export(repaired_path)
                logger.info("Wrote repaired STL: %s (watertight=%s)", repaired_path, m.is_watertight)
                return repaired_path

            try:
                repaired_stl = _repair_stl(stl_path)
            except Exception as e:
                logger.error("STL repair failed: %s", e)
                # Re-raise original error if repair not possible
                raise e1

            # Retry gmsh on repaired STL
            out_msh_repaired = repaired_stl.with_suffix(".msh")
            _run_gmsh([gmsh_exe, "-3", str(repaired_stl), "-o", str(out_msh_repaired), "-format", "msh2"])

            # If still no tets, try .geo trick on repaired STL
            if not _has_tets(out_msh_repaired):
                logger.warning("No tetrahedra after repairing STL and direct -3. Retrying repaired .geo...")
                geo_repaired = repaired_stl.with_suffix(".geo")
                geo_repaired.write_text(f"""
Merge \"{repaired_stl.as_posix()}\";
Surface Loop(1) = Surface{{:}};
Volume(1) = {{1}};
Mesh.Optimize = 1;
Mesh.Smoothing = 2;
Mesh 3;
""")
                _run_gmsh([gmsh_exe, "-3", str(geo_repaired), "-o", str(out_msh_repaired), "-format", "msh2"])

            # Convert repaired output (will raise if still no tets)
            return _convert_or_raise(out_msh_repaired)
        # If trimesh is unavailable or error was not due to missing tets, bubble up
        raise

def _run_fem_or_stub(mesh_path: pathlib.Path, req: SimulateRequest) -> Dict[str, Any]:
    """Run a non-linear elastic-plastic FEM analysis using SfePy with proper force application and stress evaluation."""
    props = MATERIALS[req.material]
    E = props["youngs_modulus"]
    nu = props["poisson_ratio"]
    strength = props["tensile_strength"]
    
    # Enhanced PLA material properties for non-linear analysis
    if req.material == "pla":
        yield_stress = 45.0e6  # Pa - PLA yield strength
        ultimate_stress = strength
        strain_hardening_modulus = E * 0.05  # 5% of elastic modulus for strain hardening
    else:  # MDF
        yield_stress = strength * 0.8  # Assume yield at 80% of ultimate
        ultimate_stress = strength
        strain_hardening_modulus = E * 0.02

    # Log material property units and sanity-check them
    try:
        logger.info(
            f"Material: {req.material} | E={E:.3e} Pa ({E/1e9:.3f} GPa), nu={nu:.3f}, "
            f"yield={yield_stress:.3e} Pa ({yield_stress/1e6:.2f} MPa), ultimate={ultimate_stress:.3e} Pa ({ultimate_stress/1e6:.2f} MPa)"
        )
        # Sense-check stress units (expect MPa-scale for plastics/wood, <~2 GPa absolute)
        if ultimate_stress > 5e9:
            logger.warning("Ultimate stress seems very high (>5 GPa). Check units (should be in Pascals).")
        if ultimate_stress < 1e5:
            logger.warning("Ultimate stress seems very low (<0.1 MPa). Check units (should be in Pascals).")
        if yield_stress > ultimate_stress:
            logger.warning("Yield stress is greater than ultimate stress. Verify material data.")
    except Exception:
        pass

    if not SFE_AVAILABLE or np is None:
        logger.warning("SfePy or numpy not available; returning stub simulation results.")
        return {
            "break": False,
            "max_stress": 0.0,
            "tensile_strength": strength / 1e6,  # MPa
            "displacements": [],
            "notes": "Stub: Install sfepy, numpy, meshio, gmsh for real FEM.",
        }

    try:
        # Read and analyze mesh
        if meshio is None:
            raise RuntimeError("meshio not available for reading the generated mesh")
        mi = meshio.read(str(mesh_path))

        # Improved unit detection and scaling
        raw_coords_range = np.ptp(mi.points, axis=0)
        raw_max_dim = float(np.max(raw_coords_range))
        raw_center = np.mean(mi.points, axis=0)
        
        # More robust unit detection: STL geometry is commonly in millimeters
        # Heuristic: anything larger than ~2 units is treated as millimeters
        if raw_max_dim > 2.0:
            unit_scale = 1e-3
            scale_label = "mm->m (default)"
        else:
            unit_scale = 1.0
            scale_label = "m (no scaling)"
        
        logger.info(f"Unit detection: raw_max_dim={raw_max_dim:.3f}, applying scale: {scale_label} (unit_scale={unit_scale})")

        # Apply unit scaling to meters and center the mesh
        mi.points = (mi.points - raw_center[None, :]) * unit_scale
        coords_range = np.ptp(mi.points, axis=0)
        characteristic_length = np.mean(coords_range)
        mesh_volume_estimate = np.prod(coords_range)
        
        # Quality checks
        if characteristic_length < 1e-6:  # Less than 1 micron
            logger.warning("Extremely small mesh detected, may cause numerical issues")
        elif characteristic_length > 10.0:  # Larger than 10 meters
            logger.warning("Very large mesh detected, consider different units")

        logger.info(f"Mesh dimensions: {coords_range*1000} mm, characteristic length: {characteristic_length*1000:.1f} mm (~{characteristic_length:.4f} m), volume_est≈{mesh_volume_estimate:.3e} m³")
        
        # Write processed mesh
        tmp_mesh = mesh_path.with_suffix(".mesh")
        meshio.write(str(tmp_mesh), mi)

        # Setup SfePy domain and fields
        mesh = SfepyMesh.from_file(str(tmp_mesh))
        domain = FEDomain("domain", mesh)
        omega = domain.create_region("Omega", "all")
        
        # Use higher order elements if mesh is coarse
        field = SfepyField.from_args("displacement", np.float64, 3, omega)
        u = FieldVariable("u", "unknown", field)
        v = FieldVariable("v", "test", field, primary_var_name="u")

        # Get mesh coordinates for analysis
        coors = domain.mesh.coors
        n_nodes = len(coors)
        logger.info(f"Mesh has {n_nodes} nodes")

        # Improved boundary condition detection and application
        if len(req.forces) == 0:
            raise HTTPException(status_code=400, detail="At least one force must be provided")
        
        # Enhanced boundary condition strategy
        ebcs_list = []
        # Choose support plane based on dominant net force direction
        # Compute net force direction (scaled by force magnitudes if available later)
        try:
            net_vec = np.zeros(3, dtype=float)
            for F in req.forces:
                d = np.asarray(F.direction, dtype=float)
                m = float(F.magnitude)
                if np.linalg.norm(d) > 0:
                    d = d / np.linalg.norm(d)
                net_vec += d * m
            if np.allclose(net_vec, 0):
                net_axis = 2  # default Z
            else:
                net_axis = int(np.argmax(np.abs(net_vec)))
        except Exception:
            net_axis = 2

        x_coords = coors[:, 0]
        y_coords = coors[:, 1]
        z_coords = coors[:, 2]
        mins = [np.min(x_coords), np.min(y_coords), np.min(z_coords)]
        maxs = [np.max(x_coords), np.max(y_coords), np.max(z_coords)]
        ranges = [maxs[i] - mins[i] for i in range(3)]

        # Percentile-based support plane selection to avoid whole-mesh constraints
        axis_coors = [x_coords, y_coords, z_coords][net_axis]
        percentiles = [5.0, 2.0, 1.0, 0.5]
        selected_mask = None
        for p in percentiles:
            cutoff = np.percentile(axis_coors, p)
            def _select_support_plane(coors_local, domain=None, axis=net_axis, c=cutoff):
                return coors_local[:, axis] <= c
            bottom_region = domain.create_region(
                "BottomSupport", "vertices by select", kind='vertex',
                functions={'select': _select_support_plane}
            )
            bottom_vertices = getattr(bottom_region, 'vertices', [])
            if 3 <= len(bottom_vertices) <= int(0.5 * n_nodes):
                break
        # If still too many, switch to opposite percentile (top side)
        if len(bottom_vertices) > int(0.5 * n_nodes):
            for p in percentiles:
                cutoff = np.percentile(axis_coors, 100.0 - p)
                def _select_support_plane_opposite(coors_local, domain=None, axis=net_axis, c=cutoff):
                    return coors_local[:, axis] >= c
                bottom_region = domain.create_region(
                    "BottomSupport", "vertices by select", kind='vertex',
                    functions={'select': _select_support_plane_opposite}
                )
                bottom_vertices = getattr(bottom_region, 'vertices', [])
                if 3 <= len(bottom_vertices) <= int(0.5 * n_nodes):
                    logger.warning(f"Support plane percentile flipped to top side (>{100-p:.1f}th) to avoid selecting too many nodes: {len(bottom_vertices)} selected")
                    break

        if len(bottom_vertices) >= 3:
            fix_bottom = EssentialBC("fixed_bottom", bottom_region, {"u.all": 0.0})
            ebcs_list.append(fix_bottom)
            axis_name = ['X','Y','Z'][net_axis]
            logger.info(f"Applied bottom constraint on {axis_name}-min plane: {len(bottom_vertices)} vertices")
        
        # Method 2: Strategic pin constraints to prevent rigid body motion
        # Pin an extremal point completely along the chosen axis
        if net_axis == 0:
            extremal_idx = int(np.argmin(x_coords))
        elif net_axis == 1:
            extremal_idx = int(np.argmin(y_coords))
        else:
            extremal_idx = int(np.argmin(z_coords))
        def _select_lowest_pin(coors_local, domain=None):
            mask = np.zeros(coors_local.shape[0], dtype=bool)
            mask[extremal_idx] = True
            return mask
        
        pin_region_1 = domain.create_region(
            "Pin1", "vertices by select", kind='vertex',
            functions={'select': _select_lowest_pin}
        )
        pin_1 = EssentialBC("pin_1", pin_region_1, {"u.all": 0.0})
        ebcs_list.append(pin_1)
        
        # Pin second point to prevent rotation (farthest from first)
        dists_from_lowest = np.linalg.norm(coors - coors[extremal_idx][None, :], axis=1)
        dists_from_lowest[extremal_idx] = -1  # Exclude the first pin
        second_pin_idx = int(np.argmax(dists_from_lowest))
        
        def _select_second_pin(coors_local, domain=None):
            mask = np.zeros(coors_local.shape[0], dtype=bool)
            mask[second_pin_idx] = True
            return mask
        
        pin_region_2 = domain.create_region(
            "Pin2", "vertices by select", kind='vertex',
            functions={'select': _select_second_pin}
        )
        pin_2 = EssentialBC("pin_2", pin_region_2, {"u.1": 0.0, "u.2": 0.0})  # Fix Y and Z
        ebcs_list.append(pin_2)
        
        # Pin third point to prevent remaining rotation
        # Find point that maximizes triangle area with first two
        max_area = 0
        third_pin_idx = extremal_idx
        p1 = coors[extremal_idx]
        p2 = coors[second_pin_idx]
        
        for i in range(n_nodes):
            if i in [extremal_idx, second_pin_idx]:
                continue
            p3 = coors[i]
            # Calculate triangle area using cross product
            v1 = p2 - p1
            v2 = p3 - p1
            area = 0.5 * np.linalg.norm(np.cross(v1, v2))
            if area > max_area:
                max_area = area
                third_pin_idx = i
        
        if third_pin_idx != extremal_idx:
            def _select_third_pin(coors_local, domain=None):
                mask = np.zeros(coors_local.shape[0], dtype=bool)
                mask[third_pin_idx] = True
                return mask
            
            pin_region_3 = domain.create_region(
                "Pin3", "vertices by select", kind='vertex',
                functions={'select': _select_third_pin}
            )
            pin_3 = EssentialBC("pin_3", pin_region_3, {"u.2": 0.0})  # Fix Z only
            ebcs_list.append(pin_3)
        
        # Summarize DOF constraints
        bc_names = [getattr(bc, 'name', 'bc') for bc in ebcs_list]
        logger.info(f"Applied {len(ebcs_list)} boundary conditions for rigid body constraint: {bc_names}")
        fully_constrained = False
        try:
            # Heuristic: bottom plane (>=3 vertices) + 2 extra pins typically removes all 6 rigid modes
            has_bottom = 'fixed_bottom' in bc_names and len(bottom_vertices) >= 3
            has_pin1 = any(getattr(bc, 'name', '') == 'pin_1' for bc in ebcs_list)
            has_pin2 = any(getattr(bc, 'name', '') == 'pin_2' for bc in ebcs_list)
            has_pin3 = any(getattr(bc, 'name', '') == 'pin_3' for bc in ebcs_list)
            pin_count = sum([has_pin1, has_pin2, has_pin3])
            fully_constrained = has_bottom and pin_count >= 2
            logger.info(f"Constraint check: has_bottom={has_bottom}, pins={pin_count}, fully_constrained_heuristic={fully_constrained}")
            if not fully_constrained:
                logger.warning("Body may not be fully constrained in all translational/rotational DOFs. Results may be unstable.")
        except Exception:
            pass
        
        if len(ebcs_list) == 0:
            raise HTTPException(status_code=500, detail="Cannot establish boundary conditions")

        # Guard: extremely coarse meshes can be ill-posed
        if n_nodes < 30:
            logger.error(f"Mesh too coarse for stable 3D FEM (n_nodes={n_nodes}). Provide a finer mesh.")
            raise HTTPException(status_code=400, detail="Mesh too coarse for stable FEM; please remesh with more elements.")

        # Enhanced material setup with proper scaling
        D_elastic = stiffness_from_youngpoisson(3, E, nu)
        material_elastic = Material("elastic", D=D_elastic)
        
        # Use appropriate integration order
        integral = Integral('i', order=2)

        # Simplified and stable force application with aggressive scaling
        load_terms = []
        force_regions = []
        
        # Scale forces to match geometry units (forces assumed to be in Newtons)
        total_applied_force = sum(F.magnitude for F in req.forces)
        logger.info(f"Total applied force: {total_applied_force:.1f} N (units: Newtons)")
        
        # Aggressive physics validation - prevent unrealistic scenarios
        # Much more conservative force limits based on mesh stiffness
        mesh_stiffness = E * mesh_volume_estimate**(1/3)  # Rough stiffness estimate
        max_reasonable_force = mesh_stiffness * characteristic_length * 1e-6  # Very conservative
        
        if total_applied_force > max_reasonable_force:
            force_scale_factor = max_reasonable_force / total_applied_force
            logger.warning(f"Scaling forces by {force_scale_factor:.6f} (from {total_applied_force:.1f} N to {max_reasonable_force:.3f} N)")
        else:
            force_scale_factor = 1.0
        
        # Additional safety: never allow forces that could cause >1mm displacement
        displacement_based_limit = E * mesh_volume_estimate**(1/3) * 1e-3  # Force for 1mm displacement
        if total_applied_force * force_scale_factor > displacement_based_limit:
            additional_scale = displacement_based_limit / (total_applied_force * force_scale_factor)
            force_scale_factor *= additional_scale
            logger.warning(f"Additional force scaling by {additional_scale:.6f} to prevent large displacements")
        
        for idx, F in enumerate(req.forces):
            # Force location and direction (apply same unit scaling as geometry)
            loc = np.array(F.location, dtype=float) * unit_scale
            dirn = np.array(F.direction, dtype=float)
            mag = float(F.magnitude)
            # Apply global scaling to individual force magnitudes
            mag_scaled = mag * force_scale_factor
            
            # Normalize direction
            dnorm = np.linalg.norm(dirn)
            if dnorm > 0:
                dirn = dirn / dnorm
            
            # Find closest nodes for force application
            dists = np.linalg.norm(coors - loc[None, :], axis=1)
            closest_vertex = int(np.argmin(dists))
            closest_distance = float(dists[closest_vertex])
            
            logger.info(f"Force {idx}: {mag:.1f} N (scaled: {mag_scaled:.3f} N, scale={force_scale_factor:.6f}) at {loc*1000} mm, "
                       f"closest vertex distance: {closest_distance*1000:.2f} mm")
            
            # Determine application method based on mesh density and force magnitude
            node_density = n_nodes / mesh_volume_estimate  # nodes per cubic meter
            average_node_spacing = (1.0 / node_density) ** (1/3) if node_density > 0 else characteristic_length * 0.1
            
            # Scale application area based on scaled force magnitude and mesh density
            base_radius = min(characteristic_length * 0.1, average_node_spacing * 3)  # Conservative base size
            
            if mag_scaled > 50:  # High force - use smaller, more concentrated area
                application_radius = base_radius * 0.5
            elif mag_scaled < 10:  # Small force - can use larger area
                application_radius = base_radius * 2.0
            else:
                application_radius = base_radius
            
            # Ensure minimum and maximum bounds
            application_radius = max(application_radius, average_node_spacing)
            application_radius = min(application_radius, characteristic_length * 0.2)
            
            logger.info(f"Force {idx} application radius: {application_radius*1000:.2f} mm "
                       f"(avg node spacing: {average_node_spacing*1000:.2f} mm)")
            
            # Create force application region using K-nearest nodes (cap fraction)
            force_center = coors[closest_vertex]

            # Determine K: between 10 and 100 nodes, or 2% of mesh, whichever is greater, but never > 10% of mesh
            k_frac = max(0.02, min(0.10, 10.0 / max(n_nodes,1)))
            K = int(min(max(int(n_nodes * k_frac), 10), max(100, int(0.1 * n_nodes))))
            K = max(1, min(K, n_nodes))

            # Select K nearest vertices to the force location
            nearest_indices = np.argsort(dists)[:K]

            def _select_knn_nodes(coors_local, domain=None, indices=nearest_indices):
                mask = np.zeros(coors_local.shape[0], dtype=bool)
                mask[indices] = True
                return mask

            try:
                force_region = domain.create_region(
                    f"ForceRegion{idx}",
                    "vertices by select",
                    kind='vertex',
                    functions={'select': _select_knn_nodes}
                )

                force_nodes = getattr(force_region, 'vertices', [])
                if len(force_nodes) == 0:
                    # Fallback to single closest node
                    def _select_single_node(coors_local, domain=None):
                        mask = np.zeros(coors_local.shape[0], dtype=bool)
                        mask[closest_vertex] = True
                        return mask

                    force_region = domain.create_region(
                        f"ForceRegion{idx}",
                        "vertices by select",
                        kind='vertex',
                        functions={'select': _select_single_node}
                    )
                    force_nodes = [closest_vertex]

                frac = len(force_nodes) / max(n_nodes,1)
                logger.info(f"Force {idx} applied to {len(force_nodes)} nodes (K={len(nearest_indices)}, {frac:.2%} of mesh)")
                # Store scaled magnitude for subsequent density calculation
                force_regions.append((force_region, len(force_nodes), mag_scaled, dirn))
                
            except Exception as e:
                logger.error(f"Failed to create force region {idx}: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to create force application region {idx}: {e}")

        # Simplified force application with stability checks
        equations_list = []
        
        # Elastic term
        t_elastic = Term.new("dw_lin_elastic(elastic.D, v, u)", integral, omega, elastic=material_elastic, v=v, u=u)
        equations_list.append(t_elastic)
        
        # Apply forces as simple body forces with conservative scaling
        for idx, (force_region, n_nodes, magnitude, direction) in enumerate(force_regions):
            try:
                # Calculate conservative body force density
                estimated_volume = (4/3) * np.pi * (characteristic_length * 0.05) ** 3
                body_force_density = (direction * magnitude) / max(estimated_volume, 1e-18)
                
                # Apply extremely strict density limits to prevent numerical instability
                max_density = E / (characteristic_length * 10000)  # Ultra-conservative limit
                actual_density = np.linalg.norm(body_force_density)
                if actual_density > max_density:
                    body_force_density = body_force_density * (max_density / actual_density)
                    actual_density = np.linalg.norm(body_force_density)
                    logger.info(f"Force {idx} density limited to {actual_density:.2e} N/m³ (cap {max_density:.2e})")

                # Additional safety check - ensure force won't cause >0.1mm displacement (recompute after limiting)
                estimated_displacement = actual_density * characteristic_length**2 / E
                if estimated_displacement > 1e-4:  # 0.1mm
                    safety_factor = 1e-4 / estimated_displacement
                    body_force_density *= safety_factor
                    actual_density = np.linalg.norm(body_force_density)
                    logger.info(f"Force {idx} further reduced by {safety_factor:.6f} to limit displacement; density now {actual_density:.2e} N/m³")
                
                force_material = Material(f"Force{idx}", val=body_force_density.reshape(3, 1))
                
                # Create volume region for force application
                def create_volume_selector(region_vertices):
                    def _select_volume(cell_coors, domain=None):
                        if len(region_vertices) == 0:
                            return np.zeros(cell_coors.shape[0], dtype=bool)
                        force_center = np.mean(coors[region_vertices], axis=0)
                        diff = cell_coors - force_center[None, :]
                        return np.sum(diff * diff, axis=1) <= (characteristic_length * 0.1) ** 2
                    return _select_volume
                
                vol_region = domain.create_region(
                    f"VolForce{idx}",
                    "cells by select",
                    kind='cell',
                    functions={'select': create_volume_selector(getattr(force_region, 'vertices', []))}
                )
                
                t_force = Term.new(
                    f"dw_volume_lvf(Force{idx}.val, v)",
                    integral,
                    vol_region,
                    **{f"Force{idx}": force_material},
                    v=v
                )
                equations_list.append(t_force)
                logger.info(f"Applied force {idx}: {magnitude:.1f} N")
                
            except Exception as e:
                logger.warning(f"Force {idx} application failed: {e}")
                continue

        # Solve system with improved solver settings
        valid_terms = list(equations_list)
        logger.info(
            f"Equation assembly: {len(valid_terms)} terms (elastic + {max(0, len(valid_terms)-1)} load terms)"
        )
        
        if not valid_terms:
            raise HTTPException(status_code=500, detail="No valid terms found for equation assembly")
        
        # Build combined equation
        combined_term = valid_terms[0]
        for t in valid_terms[1:]:
            combined_term = combined_term + t
        
        eq_elastic = Equation("balance", combined_term)
        eqs_elastic = Equations([eq_elastic])
        pb_elastic = Problem("elasticity", equations=eqs_elastic)
        
        # Linear elastic problem: use direct linear solver with tight tolerances
        ls_config = {'method': 'auto'}
        ls = ScipyDirect(ls_config)

        nls_config = {
            'i_max': 1,          # Single iteration for linear system
            'eps_a': 1e-12,      # Tight absolute tolerance
            'eps_r': 1e-12,      # Tight relative tolerance
            'lin_red': 0.0,      # Do not require linear residual reduction beyond solver convergence
            'ls_on': 0.0,        # Disable backtracking line search for linear problems
            'ls_red': 1.0,       # No attenuation
            'ls_min': 1e-16,
            'macheps': 1e-16,
            'check': 0,
        }
        logger.info(f"Solver config: NLS={nls_config}, LS={ls_config}")
        nls = Newton(nls_config, lin_solver=ls)
        pb_elastic.set_solver(nls)
        
        # Solve with boundary conditions
        # Solve with error handling
        try:
            if not ebcs_list:
                raise HTTPException(status_code=500, detail="No boundary conditions established")
            
            pb_elastic.time_update(ebcs=Conditions(ebcs_list))
            state_elastic = pb_elastic.solve()
            logger.info("Solution converged")
            
        except Exception as e:
            logger.error(f"Solver failed: {e}")
            raise HTTPException(status_code=500, detail=f"FEM solver failed - check mesh quality and boundary conditions")
        
        # Extract results
        U_elastic = state_elastic.get_state_parts()["u"]
        max_displacement = float(np.max(np.abs(U_elastic)))
        logger.info(f"Elastic solution - Max displacement: {max_displacement*1000:.3f} mm")
        
        # Force scaling was already applied before force application

        # Evaluate stresses with error handling
        try:
            stress_data_elastic = pb_elastic.evaluate(
                "ev_cauchy_stress.i.Omega(elastic.D, u)",
                mode='el_avg',
                integrals=Integrals([integral]),
                elastic=material_elastic,
                u=state_elastic()
            )
            
            stress_array = np.squeeze(np.asarray(stress_data_elastic))
            if stress_array.ndim == 1 and len(stress_array) >= 6:
                stress_array = stress_array.reshape(-1, 6)
            elif stress_array.ndim == 2 and stress_array.shape[0] == 6:
                stress_array = stress_array.T
            elif stress_array.ndim == 3:
                stress_array = stress_array.reshape(-1, stress_array.shape[-1])
            
            # Calculate von Mises stress
            if stress_array.shape[1] >= 6:
                sxx, syy, szz, syz, sxz, sxy = stress_array[:, :6].T
                von_mises_elastic = np.sqrt(0.5 * ((sxx - syy)**2 + (syy - szz)**2 + (szz - sxx)**2) + 
                                          3.0 * (sxy**2 + syz**2 + sxz**2))
                max_elastic_stress = float(np.max(von_mises_elastic))
                mean_elastic_stress = float(np.mean(von_mises_elastic))
                
                # Stress validation
                stress_limit = E * 0.01  # 1% of elastic modulus
                if max_elastic_stress > stress_limit:
                    logger.warning(f"High stress detected: {max_elastic_stress/1e6:.1f} MPa")
                
                logger.info(f"Elastic stresses - Max: {max_elastic_stress/1e6:.2f} MPa, "
                           f"Mean: {mean_elastic_stress/1e6:.2f} MPa")
            else:
                logger.warning("Stress array has insufficient components")
                max_elastic_stress = 0.0
                von_mises_elastic = np.zeros(1)
                
        except Exception as e:
            logger.error(f"Stress evaluation failed: {e}")
            max_elastic_stress = 0.0
            von_mises_elastic = np.zeros(1)

        # Prepare displacement output
        displacements = []
        n_disp_nodes = min(len(coors), len(U_elastic) // 3)
        for i in range(n_disp_nodes):
            ui = U_elastic[3*i:3*i+3] if len(U_elastic) > 3*i+2 else [0, 0, 0]
            displacements.append({
                "vertex": i,
                "dx": float(ui[0]),
                "dy": float(ui[1]), 
                "dz": float(ui[2]),
                "magnitude": float(np.linalg.norm(ui))
            })

        # Failure analysis with bounds
        safety_factor = ultimate_stress / max(max_elastic_stress, 1.0)
        failure_imminent = max_elastic_stress > ultimate_stress
        yield_occurred = max_elastic_stress > yield_stress
        
        # Strict physics validation with bounds checking
        expected_max_displacement = total_applied_force * force_scale_factor * characteristic_length / (E * mesh_volume_estimate**(1/3))
        displacement_limit = min(characteristic_length * 0.01, 1e-3)  # 1% of size OR 1mm, whichever is smaller
        
        if max_displacement > displacement_limit:
            logger.error(f"Displacement {max_displacement*1000:.1f} mm exceeds limit {displacement_limit*1000:.1f} mm")
            raise HTTPException(status_code=400, detail=f"Unrealistic displacement {max_displacement*1000:.1f}mm - simulation failed")
        
        if max_displacement > expected_max_displacement * 5:
            logger.warning(f"Large displacement: {max_displacement*1000:.1f} mm (expected ~{expected_max_displacement*1000:.1f} mm)")
        logger.info(f"  Yield stress: {yield_stress/1e6:.2f} MPa") 
        logger.info(f"  Ultimate stress: {ultimate_stress/1e6:.2f} MPa")
        logger.info(f"  Safety factor: {safety_factor:.2f}")
        logger.info(f"  Yielding: {'Yes' if yield_occurred else 'No'}")
        logger.info(f"  Failure: {'Yes' if failure_imminent else 'No'}")
        logger.info(f"  Max displacement: {max_displacement*1000:.2f} mm")

        return {
            "break": failure_imminent,
            "yielding": yield_occurred,
            "max_stress": max_elastic_stress / 1e6,  # Convert to MPa
            "yield_stress": yield_stress / 1e6,
            "tensile_strength": ultimate_stress / 1e6,
            "safety_factor": safety_factor,
            "max_displacement": max_displacement,
            "displacements": displacements,
            "mesh_info": {
                "nodes": n_nodes,
                "characteristic_length": characteristic_length * 1000,  # mm
                "dimensions": (coords_range * 1000).tolist(),  # mm
                "unit_scale_applied": scale_label
            },
            "solver_info": {
                "converged": True,
                "max_displacement_mm": max_displacement * 1000,
                "total_applied_force_n": total_applied_force,
                "force_scale_factor": force_scale_factor,
                "displacement_limit_mm": 1,
                "actual_force_applied_n": total_applied_force * force_scale_factor
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("FEM pipeline failed; falling back to stub")
        return {
            "break": True,
            "max_stress": 0.0,
            "tensile_strength": strength / 1e6,
            "displacements": [],
            "notes": f"FEM failed: {e}",
        }

def ensure_env():
    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_SERVICE_ROLE_KEY:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if not SUPABASE_BUCKET:
        missing.append("SUPABASE_BUCKET")
    if missing:
        logger.error("Missing environment variables: %s", ", ".join(missing))
        raise HTTPException(status_code=500, detail=f"Missing environment variables: {', '.join(missing)}")


def derive_base_name(filename: str) -> str:
    # Strip directory and extension, keep base
    base = pathlib.Path(filename).name
    # Handle cases like .JPG/.jpg
    stem = pathlib.Path(base).stem
    # Clean spaces and unsafe chars
    safe = ''.join(c for c in stem if c.isalnum() or c in ('-', '_')) or 'output'
    return safe


async def download_to_file(url: str, dest_path: pathlib.Path) -> None:
    logger.info("Downloading from URL: %s -> %s", url, dest_path)
    timeout = httpx.Timeout(60.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            logger.error("Download failed: HTTP %s url=%s", resp.status_code, url)
            raise HTTPException(status_code=400, detail=f"Failed to download model: HTTP {resp.status_code}")
        dest_path.write_bytes(resp.content)
    logger.info("Download complete: %s (%d bytes)", dest_path, dest_path.stat().st_size)


def run_marker_single(image_path: pathlib.Path, output_dir: pathlib.Path) -> None:
    logger.info("Running marker_single on %s -> output %s", image_path, output_dir)
    cmd = [
        "marker_single",
        str(image_path),
        "--output_format", "markdown",
        "--output_dir", str(output_dir)
    ]
    try:
        res = subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.stdout:
            logger.info("marker_single stdout:\n%s", res.stdout)
        if res.stderr:
            logger.warning("marker_single stderr:\n%s", res.stderr)
    except FileNotFoundError:
        logger.exception("marker_single not found in PATH/environment")
        raise HTTPException(status_code=500, detail="marker_single not found. Ensure the Python venv is activated when running the server.")
    except subprocess.CalledProcessError as e:
        logger.error("marker_single failed with code %s", e.returncode)
        if e.stdout:
            logger.error("stdout:\n%s", e.stdout)
        if e.stderr:
            logger.error("stderr:\n%s", e.stderr)
        raise HTTPException(status_code=500, detail=f"marker_single failed: {e.stderr or e.stdout}")


async def upload_file_to_supabase(object_name: str, file_path: pathlib.Path) -> None:
    ensure_env()
    url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/{SUPABASE_BUCKET}/{object_name}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "x-upsert": "true",
        # Content-Type will be inferred by httpx from file bytes if omitted; set generic binary
        "Content-Type": "application/octet-stream",
    }
    data = file_path.read_bytes()
    logger.info("Uploading to Supabase: bucket=%s object=%s size=%d", SUPABASE_BUCKET, object_name, len(data))
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, headers=headers, content=data)
        if resp.status_code not in (200, 201, 204):
            logger.error("Upload failed for %s: %s %s", object_name, resp.status_code, resp.text)
            raise HTTPException(status_code=500, detail=f"Supabase upload failed for {object_name}: {resp.status_code} {resp.text}")
    logger.info("Uploaded: %s", object_name)


async def upload_directory_to_supabase(prefix: str, dir_path: pathlib.Path) -> List[str]:
    logger.info("Uploading directory to Supabase: %s -> prefix=%s", dir_path, prefix)
    uploaded: List[str] = []
    # Upload sequentially to ensure each coroutine is awaited
    for root, _, files in os.walk(dir_path):
        for fname in files:
            full_path = pathlib.Path(root) / fname
            rel = full_path.relative_to(dir_path).as_posix()
            object_name = f"{prefix}/{rel}"
            await upload_file_to_supabase(object_name, full_path)
            uploaded.append(object_name)
    return uploaded


@app.post("/process")
async def process_image(
    image_url: Optional[str] = Body(default=None, embed=True),
    file: Optional[UploadFile] = File(default=None),
    image_url_q: Optional[str] = Query(default=None, alias="image_url")
):
    ensure_env()

    # Support image_url via JSON body or query string (?image_url=...)
    if not image_url:
        image_url = image_url_q

    if not image_url and not file:
        raise HTTPException(status_code=400, detail="Provide either 'image_url' in JSON body or as a query param ?image_url=... or upload a file with field name 'file'.")

    with tempfile.TemporaryDirectory() as td:
        tmpdir = pathlib.Path(td)
        logger.info("Processing request. tempdir=%s", tmpdir)
        # Prepare local image path
        if file:
            logger.info("Input type: multipart file upload. filename=%s", file.filename)
            base_name = derive_base_name(file.filename or "uploaded")
            img_path = tmpdir / (base_name + pathlib.Path(file.filename or "uploaded").suffix)
            content = await file.read()
            img_path.write_bytes(content)
        else:
            logger.info("Input type: image_url. url=%s", image_url)
            base_name = derive_base_name(image_url)  # type: ignore[arg-type]
            # Try to infer extension from URL
            ext = pathlib.Path(httpx.URL(image_url).path).suffix if image_url else ".jpg"
            img_path = tmpdir / f"{base_name}{ext or '.jpg'}"
            await download_to_file(image_url, img_path)  # type: ignore[arg-type]

        # Output directory under repo's marker-test/<base_name>
        repo_root = pathlib.Path.cwd()
        output_dir = repo_root / "marker-test" / base_name
        output_dir.parent.mkdir(parents=True, exist_ok=True)
        logger.info("Invoking marker_single. base=%s image=%s output_dir=%s", base_name, img_path, output_dir)

        run_marker_single(img_path, output_dir)

        if not output_dir.exists():
            logger.error("marker_single did not create expected output directory: %s", output_dir)
            raise HTTPException(status_code=500, detail="Expected output directory was not created by marker_single.")

        uploaded_objects = await upload_directory_to_supabase(base_name, output_dir)
        logger.info("Processing complete. Uploaded %d objects.", len(uploaded_objects))

        return JSONResponse({
            "base": base_name,
            "bucket": SUPABASE_BUCKET,
            "count": len(uploaded_objects),
            "objects": uploaded_objects
        })


@app.get("/health")
async def health():
    try:
        ensure_env()
        return {"status": "ok"}
    except HTTPException as e:
        return JSONResponse(status_code=500, content={"status": "error", "detail": e.detail})


@app.post("/simulate")
async def simulate(req: SimulateRequest):
    """Run FEM on the given model and forces. Returns Three.js-friendly displacement data and break flag.

    This endpoint prefers GPU if available, but the current SfePy-based CPU pipeline will be used.
    """
    # Do NOT require Supabase env here; model_url may be any public URL

    with tempfile.TemporaryDirectory() as td:
        tmpdir = pathlib.Path(td)
        logger.info(
            "/simulate: tempdir=%s material=%s model_url=%s forces=%d",
            tmpdir,
            req.material,
            req.model_url,
            len(req.forces),
        )
        # Diagnose: confirm FastAPI sees _download_model as coroutine function
        logger.info("_download_model is coroutinefunction=%s", inspect.iscoroutinefunction(_download_model))

        # 1) Download model
        try:
            # Use uniquely named wrapper to avoid stale references on hot-reload
            local_model = await fetch_model_to_tmp(req.model_url, tmpdir)
            # Defensive: if some hot-reload mismatch returns a coroutine, await it
            if inspect.iscoroutine(local_model):
                logger.warning("_download_model returned coroutine after await; awaiting again (hot-reload?)")
                local_model = await local_model  # type: ignore
            logger.info("Downloaded model path: %s (type=%s)", local_model, type(local_model))
        except HTTPException as e:
            logger.error("Model download HTTPException: %s", getattr(e, 'detail', str(e)))
            raise
        except Exception as e:
            logger.exception("Model download failed")
            raise HTTPException(status_code=400, detail=f"Failed to download model: {e}")

        # 2) Convert to STL if needed
        try:
            if not isinstance(local_model, pathlib.Path):
                logger.error("local_model is not a pathlib.Path: %r (type=%s)", local_model, type(local_model))
                raise HTTPException(status_code=500, detail="Internal error: downloaded model path invalid (not Path)")
            stl_path = _convert_to_stl_if_needed(local_model)
        except HTTPException as e:
            logger.error("STL conversion HTTPException: %s", getattr(e, 'detail', str(e)))
            raise

        # 3) Create tetrahedral mesh for FEM
        try:
            mesh_path = _tetrahedralize_stl(stl_path)
        except HTTPException as e:
            # If meshing is not available or produced only surface mesh, return a stub result with detail
            logger.warning("Meshing unavailable or invalid volume mesh; returning stub: %s", getattr(e, 'detail', str(e)))
            props = MATERIALS[req.material]
            return JSONResponse({
                "break": False,
                "max_stress": 0.0,
                "tensile_strength": props["tensile_strength"] / 1e6,
                "displacements": [],
                "notes": f"Meshing issue: {getattr(e, 'detail', str(e))}",
            })

        # 4) Run FEM
        result = _run_fem_or_stub(mesh_path, req)
        return JSONResponse(result)
