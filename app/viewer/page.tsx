"use client"

import { AppSidebar } from "@/components/notes/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import React, { useEffect, useMemo, useState, Suspense, useRef, useImperativeHandle, forwardRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useSearchParams, useRouter } from "next/navigation"
import { RotateCw, RefreshCw, Globe2, Grid3X3, X } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// three.js viewer (same libs as notes page)
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Bounds, useGLTF, Html } from '@react-three/drei'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import * as THREE from 'three'

type EnvPreset = 'apartment' | 'city' | 'dawn' | 'forest' | 'lobby' | 'night' | 'park' | 'studio' | 'sunset' | 'warehouse'
type BoundsInfo = { size: number; center: THREE.Vector3; minY: number; dims: { x: number; y: number; z: number }; verts?: number; tris?: number }

// Extract simulation points with positions and normalized magnitude
function extractSimPosMag(data?: any[]): { p: THREE.Vector3; m: number }[] {
  const out: { p: THREE.Vector3; m: number }[] = []
  if (!Array.isArray(data)) return out
  for (let i = 0; i < data.length; i++) {
    const item = data[i]
    if (!item) continue
    if (Array.isArray(item)) {
      if (item.length >= 6) {
        const [x, y, z, dx, dy, dz] = item
        const m = Math.sqrt((+dx||0)**2 + (+dy||0)**2 + (+dz||0)**2)
        out.push({ p: new THREE.Vector3(+x||0, +y||0, +z||0), m })
      } else if (item.length === 4) {
        const [x, y, z, mm] = item
        out.push({ p: new THREE.Vector3(+x||0, +y||0, +z||0), m: Math.abs(+mm||0) })
      }
    } else if (typeof item === 'object') {
      const pos = (item as any).position ?? (item as any).pos ?? (item as any).p
      const disp = (item as any).displacement ?? (item as any).magnitude ?? (item as any).m
      if (Array.isArray(pos) && pos.length === 3) {
        let m = 0
        if (Array.isArray(disp) && disp.length === 3) {
          m = Math.sqrt((+disp[0]||0)**2 + (+disp[1]||0)**2 + (+disp[2]||0)**2)
        } else if (typeof disp === 'number') {
          m = Math.abs(disp)
        }
        out.push({ p: new THREE.Vector3(+pos[0]||0, +pos[1]||0, +pos[2]||0), m })
      }
    }
    if (out.length > 500000) break
  }
  const max = out.reduce((a, b) => Math.max(a, b.m), 0) || 1
  out.forEach(o => { o.m = o.m / max })
  return out
}

// Map simulation magnitudes to vertices via nearest-neighbor (guarded by complexity)
function mapSimToVertices(posAttr: THREE.BufferAttribute, sim: any[]): Float32Array | null {
  const N = posAttr.count
  const direct = parseSimPoints(sim)
  if (direct.length === N) {
    const arr = new Float32Array(N)
    for (let i = 0; i < N; i++) arr[i] = direct[i].m
    return arr
  }
  const pts = extractSimPosMag(sim)
  if (pts.length === 0) return null
  // Guard: avoid O(N*M) if too large
  const M = pts.length
  const complexity = N * M
  if (complexity > 2e7) return null
  const arr = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i)
    let best = 1e30, mv = 0
    for (let j = 0; j < M; j++) {
      const dx = x - pts[j].p.x, dy = y - pts[j].p.y, dz = z - pts[j].p.z
      const d2 = dx*dx + dy*dy + dz*dz
      if (d2 < best) { best = d2; mv = pts[j].m }
    }
    arr[i] = mv
  }
  return arr
}
type ClickPoint = { id: string; position: [number, number, number]; label: string }
type ForcePoint = { id: string; position: [number, number, number]; magnitude: number; direction: [number, number, number] }
type LabelsPayload = {
  single?: { id: string; position: [number, number, number]; label: string; scale?: number }
  rights?: Array<{ id: string; position: [number, number, number]; label: string; scale?: number }>
}

// Parse simulation array into a normalized list of magnitudes [0..1], maintaining order
function parseSimPoints(data?: any[]): { m: number }[] {
  const out: { m: number }[] = []
  if (!Array.isArray(data)) return out
  for (let i = 0; i < data.length; i++) {
    const item = data[i]
    if (item == null) { out.push({ m: 0 }); continue }
    if (typeof item === 'number') {
      out.push({ m: Math.abs(item) })
    } else if (Array.isArray(item)) {
      if (item.length >= 6) {
        const dx = Number(item[3]) || 0, dy = Number(item[4]) || 0, dz = Number(item[5]) || 0
        out.push({ m: Math.sqrt(dx*dx + dy*dy + dz*dz) })
      } else if (item.length === 4) {
        out.push({ m: Math.abs(Number(item[3]) || 0) })
      } else if (item.length === 1) {
        out.push({ m: Math.abs(Number(item[0]) || 0) })
      } else {
        out.push({ m: 0 })
      }
    } else if (typeof item === 'object') {
      const disp = (item as any).displacement ?? (item as any).magnitude ?? (item as any).m
      if (Array.isArray(disp) && disp.length === 3) {
        const dx = Number(disp[0]) || 0, dy = Number(disp[1]) || 0, dz = Number(disp[2]) || 0
        out.push({ m: Math.sqrt(dx*dx + dy*dy + dz*dz) })
      } else if (typeof disp === 'number') {
        out.push({ m: Math.abs(disp) })
      } else {
        out.push({ m: 0 })
      }
    } else {
      out.push({ m: 0 })
    }
    if (out.length > 500000) break
  }
  const maxM = out.reduce((a, b) => Math.max(a, b.m), 0) || 1
  out.forEach(o => { o.m = o.m / maxM })
  return out
}

// Green -> Yellow -> Red gradient for t in [0..1]
function gradientColor(t: number): { r: number; g: number; b: number } {
  const clamped = Math.max(0, Math.min(1, t))
  // Blue -> Green -> Yellow -> Red, with a minimum brightness so t=0 is still visible
  let r = 0, g = 0, b = 0
  if (clamped < 0.25) { // 0..0.25: blue -> cyan
    const k = clamped / 0.25
    r = 0
    g = 0.2 + 0.6 * k
    b = 0.8 + 0.2 * (1 - k)
  } else if (clamped < 0.5) { // 0.25..0.5: cyan -> green
    const k = (clamped - 0.25) / 0.25
    r = 0
    g = 0.8 + 0.2 * k
    b = 0.6 * (1 - k)
  } else if (clamped < 0.75) { // 0.5..0.75: green -> yellow
    const k = (clamped - 0.5) / 0.25
    r = 0.6 * k
    g = 1.0
    b = 0
  } else { // 0.75..1.0: yellow -> red
    const k = (clamped - 0.75) / 0.25
    r = 0.6 + 0.4 * k
    g = 1.0 - 1.0 * k
    b = 0
  }
  return { r, g, b }
}

function GLTFModel({ url, onBounds, onClickPoint, onRightClickPoint, simData }: { url: string; onBounds?: (info: BoundsInfo) => void; onClickPoint?: (p: [number, number, number]) => void; onRightClickPoint?: (p: [number, number, number]) => void; simData?: any[] }) {
  const { scene } = useGLTF(url)
  useEffect(() => {
    if (!scene) return
    try {
      const box = new THREE.Box3().setFromObject(scene)
      const sizeV = new THREE.Vector3()
      const center = new THREE.Vector3()
      box.getSize(sizeV)
      box.getCenter(center)
      const size = Math.max(sizeV.x, sizeV.y, sizeV.z)
      const minY = box.min.y
      // compute verts/tris
      let verts = 0, tris = 0
      scene.traverse((o: any) => {
        if (o && o.isMesh && o.geometry) {
          const g = o.geometry as THREE.BufferGeometry
          const pos = g.getAttribute('position') as THREE.BufferAttribute | undefined
          if (pos) verts += pos.count
          const idx = g.getIndex()
          if (idx) tris += Math.floor(idx.count / 3)
          else if (pos) tris += Math.floor(pos.count / 3)
        }
      })
      onBounds?.({ size, center, minY, dims: { x: sizeV.x, y: sizeV.y, z: sizeV.z }, verts, tris })
    } catch {}
  }, [scene, onBounds])
  // Apply simulation coloring to meshes when data looks like per-vertex magnitudes
  useEffect(() => {
    if (!scene) return
    const points = parseSimPoints(simData)
    const hasData = points.length > 0
    scene.traverse((o: any) => {
      if (!o || !o.isMesh || !o.geometry) return
      const g = o.geometry as THREE.BufferGeometry
      const pos = g.getAttribute('position') as THREE.BufferAttribute | undefined
      if (!pos) return
      // If counts match, 1:1 mapping; else try nearest-neighbor if positions were provided
      let magnitudes: Float32Array | null = null
      if (hasData && points.length === pos.count) {
        magnitudes = new Float32Array(pos.count)
        for (let i = 0; i < pos.count; i++) magnitudes[i] = points[i].m
      } else {
        magnitudes = mapSimToVertices(pos, simData || [])
      }
      if (magnitudes) {
        // Skip if all zeros to avoid overriding material with black
        let maxVal = 0
        for (let i = 0; i < magnitudes.length; i++) if (magnitudes[i] > maxVal) maxVal = magnitudes[i]
        if (maxVal <= 0) return
        // clone geometry/material once before mutating cached GLTF
        let targetGeom: THREE.BufferGeometry = g
        if (!(g as any).__simCloned) {
          const ng = g.clone()
          ;(ng as any).__simCloned = true
          o.geometry = ng
          targetGeom = ng
        } else {
          targetGeom = g
        }
        if (Array.isArray(o.material)) o.material = o.material.map((m: any) => m?.clone?.() ?? m)
        else o.material = (o.material as any)?.clone?.() ?? o.material
        const colors = new Float32Array(pos.count * 3)
        for (let i = 0; i < pos.count; i++) {
          const t = magnitudes[i] // normalized 0..1
          const c = gradientColor(t)
          colors[i * 3 + 0] = c.r
          colors[i * 3 + 1] = c.g
          colors[i * 3 + 2] = c.b
        }
        targetGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        const setVertexColors = (mat: any) => { if (mat && 'vertexColors' in mat) mat.vertexColors = true }
        if (Array.isArray(o.material)) o.material.forEach((mat: any) => setVertexColors(mat))
        else setVertexColors(o.material)
        ;(targetGeom.attributes.color as any).needsUpdate = true
      } else {
        // No usable data: remove color attribute if present
        if ((g as any).getAttribute && g.getAttribute('color')) {
          g.deleteAttribute('color')
          if (Array.isArray(o.material)) o.material.forEach((m: any) => { if (m && 'vertexColors' in m) m.vertexColors = false })
          else if (o.material && 'vertexColors' in o.material) (o.material as any).vertexColors = false
        }
      }
    })
  }, [scene, simData])

  return (
    <primitive
      object={scene}
      onPointerDown={(e) => {
        e.stopPropagation()
        // Right-click adds multi, editable markers
        if (e.button === 2) {
          ;(e as any).nativeEvent?.preventDefault?.()
          const p = e.point
          onRightClickPoint?.([p.x, p.y, p.z])
          return
        }
        // Left click moves the single note
        if (e.button === 0) {
          const p = e.point
          onClickPoint?.([p.x, p.y, p.z])
        }
      }}
    />
  )
}

function STLModel({ url, onBounds, onClickPoint, onRightClickPoint, simData }: { url: string; onBounds?: (info: BoundsInfo) => void; onClickPoint?: (p: [number, number, number]) => void; onRightClickPoint?: (p: [number, number, number]) => void; simData?: any[] }) {
  const [geom, setGeom] = React.useState<THREE.BufferGeometry | null>(null)
  const [hasColors, setHasColors] = React.useState(false)
  React.useEffect(() => {
    const loader = new STLLoader()
    let cancelled = false
    loader.load(url, (geometry: THREE.BufferGeometry) => {
      if (!cancelled) {
        try {
          // Compute bounds from geometry positions
          const pos = geometry.getAttribute('position') as THREE.BufferAttribute
          if (pos) {
            const box = new THREE.Box3().setFromBufferAttribute(pos)
            const sizeV = new THREE.Vector3()
            const center = new THREE.Vector3()
            box.getSize(sizeV)
            box.getCenter(center)
            const size = Math.max(sizeV.x, sizeV.y, sizeV.z)
            const minY = box.min.y
            // verts/tris for STL
            const verts = pos.count
            const tris = Math.floor(pos.count / 3)
            onBounds?.({ size, center, minY, dims: { x: sizeV.x, y: sizeV.y, z: sizeV.z }, verts, tris })
          }
        } catch {}
        setGeom(geometry)
      }
    })
    return () => { cancelled = true }
  }, [url])
  // Colorize STL geometry when simulation data aligns per-vertex
  React.useEffect(() => {
    if (!geom) return
    const pos = geom.getAttribute('position') as THREE.BufferAttribute | undefined
    if (!pos) return
    const mags = mapSimToVertices(pos, simData || [])
    if (mags) {
      let maxVal = 0
      for (let i = 0; i < mags.length; i++) if (mags[i] > maxVal) maxVal = mags[i]
      if (maxVal <= 0) { setHasColors(false); return }
      const ng = (geom as any).__simCloned ? geom : geom.clone()
      ;(ng as any).__simCloned = true
      setGeom(ng)
      const colors = new Float32Array(pos.count * 3)
      for (let i = 0; i < pos.count; i++) {
        const c = gradientColor(mags[i])
        colors[i * 3 + 0] = c.r
        colors[i * 3 + 1] = c.g
        colors[i * 3 + 2] = c.b
      }
      ng.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      ;(ng.attributes.color as any).needsUpdate = true
      setHasColors(true)
    } else {
      if ((geom as any).getAttribute && geom.getAttribute('color')) {
        geom.deleteAttribute('color')
      }
      setHasColors(false)
    }
  }, [geom, simData])
  if (!geom) return null
  return (
    <mesh
      geometry={geom}
      castShadow
      receiveShadow
      onPointerDown={(e) => {
        e.stopPropagation()
        if (e.button === 2) {
          ;(e as any).nativeEvent?.preventDefault?.()
          const p = e.point
          onRightClickPoint?.([p.x, p.y, p.z])
          return
        }
        if (e.button === 0) {
          const p = e.point
          onClickPoint?.([p.x, p.y, p.z])
        }
      }}
    >
      <meshStandardMaterial color="#9ca3af" metalness={0.2} roughness={0.6} vertexColors={hasColors} />
    </mesh>
  )
}

type ModelViewerHandle = { reset: () => void; clear: () => void }
function ModelViewerImpl(
  { url, autoRotate = true, showEnv = true, showGrid = false, envPreset = 'city', clearSignal, modelName, createdAt, initialLabels, onLabelsChange, simulateMode = false, forces = [], onAddForce, onForceChange, onForceRemove, simBreak = false, simDisplacements }:
  { url: string; autoRotate?: boolean; showEnv?: boolean; showGrid?: boolean; envPreset?: EnvPreset; clearSignal?: number; modelName?: string; createdAt?: string; initialLabels?: LabelsPayload | null; onLabelsChange?: (payload: LabelsPayload) => void; simulateMode?: boolean; forces?: ForcePoint[]; onAddForce?: (p: [number, number, number]) => void; onForceChange?: (id: string, patch: Partial<ForcePoint>) => void; onForceRemove?: (id: string) => void; simBreak?: boolean; simDisplacements?: any[] },
  ref: React.Ref<ModelViewerHandle>
) {
  const ext = (url.split(".").pop() || "").toLowerCase()
  const isGL = ext === 'glb' || ext === 'gltf'
  const isSTL = ext === 'stl'
  const controlsRef = useRef<any>(null)
  const [gridSize, setGridSize] = useState<number>(10)
  const [gridCenter, setGridCenter] = useState<THREE.Vector3 | null>(null)
  const [gridMinY, setGridMinY] = useState<number>(0)
  const [dims, setDims] = useState<{ x: number; y: number; z: number } | null>(null)
  const [stats, setStats] = useState<{ verts?: number; tris?: number }>({})
  const [note, setNote] = useState<ClickPoint | null>(null)
  const [rightNotes, setRightNotes] = useState<ClickPoint[]>([])
  // UI state for single info label
  const [labelHovered, setLabelHovered] = useState(false)
  const [labelScale, setLabelScale] = useState(1)
  // UI state for right-note labels
  const [currentRightHoverId, setCurrentRightHoverId] = useState<string | null>(null)
  const [rightLabelScales, setRightLabelScales] = useState<Record<string, number>>({})
  const labelsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipNextEmit = useRef(false)
  const markerRadius = React.useMemo(() => {
    const m = dims ? Math.max(dims.x, dims.y, dims.z) : gridSize
    // Smaller sphere: ~8% of max dimension, with tighter clamps
    return Math.max(0.08, Math.min(1.0, m * 0.08))
  }, [dims, gridSize])
  const labelDistanceFactor = React.useMemo(() => {
    // Scale label the same factor as marker: 50x markerRadius
    return markerRadius * 50
  }, [markerRadius])
  const createdLabel = React.useMemo(() => createdAt ? new Date(createdAt).toLocaleString() : undefined, [createdAt])
  const fileName = React.useMemo(() => {
    try {
      const last = url.split('?')[0].split('#')[0].split('/')
      return last[last.length - 1]
    } catch { return undefined }
  }, [url])
  // Dragging state (Shift+Drag)
  const dragging = useRef<{ kind: 'single' | 'right' | null; id?: string; y: number; offset: THREE.Vector3 }>({ kind: null, y: 0, offset: new THREE.Vector3() })
  const updateDrag = React.useCallback((e: any) => {
    if (!dragging.current.kind) return
    if (!e || !('ray' in e) || !e.ray) return
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -dragging.current.y)
    const hit = new THREE.Vector3()
    e.ray.intersectPlane(plane, hit)
    const p = hit.add(dragging.current.offset)
    const pos: [number, number, number] = [p.x, p.y, p.z]
    if (dragging.current.kind === 'single') {
      setNote(prev => prev ? { ...prev, position: pos } : prev)
    } else if (dragging.current.kind === 'right' && dragging.current.id) {
      setRightNotes(prev => prev.map(n => n.id === dragging.current!.id ? { ...n, position: pos } : n))
    }
  }, [])

  // Load initial labels into state
  useEffect(() => {
    if (!initialLabels) return
    try {
      if (initialLabels.single) {
        const s = initialLabels.single
        setNote({ id: s.id, position: s.position, label: s.label })
        if (typeof s.scale === 'number') setLabelScale(s.scale)
      } else {
        setNote(null)
      }
      const rights = initialLabels.rights ?? []
      setRightNotes(rights.map(r => ({ id: r.id, position: r.position, label: r.label })))
      const scales: Record<string, number> = {}
      rights.forEach(r => { if (typeof r.scale === 'number') scales[r.id] = r.scale })
      setRightLabelScales(scales)
      // prevent the next emit caused by this hydration
      skipNextEmit.current = true
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLabels])

  // Debounced emit of labels for persistence
  useEffect(() => {
    if (!onLabelsChange) return
    // Skip exactly one emit after hydration
    if (skipNextEmit.current) {
      skipNextEmit.current = false
      return
    }
    if (labelsSaveTimer.current) clearTimeout(labelsSaveTimer.current)
    labelsSaveTimer.current = setTimeout(() => {
      const payload: LabelsPayload = {
        single: note ? { id: note.id, position: note.position, label: note.label, scale: labelScale } : undefined,
        rights: rightNotes.map(n => ({ id: n.id, position: n.position, label: n.label, scale: rightLabelScales[n.id] }))
      }
      onLabelsChange(payload)
    }, 600)
    return () => { if (labelsSaveTimer.current) clearTimeout(labelsSaveTimer.current) }
  }, [note, rightNotes, labelScale, rightLabelScales, onLabelsChange])

  // Keyboard scaling when any label is hovered: Shift+'+' to grow, Shift+'-' to shrink
  useEffect(() => {
    if (!labelHovered && !currentRightHoverId) return
    const onKey = (ev: KeyboardEvent) => {
      if (!ev.shiftKey) return
      const k = ev.key
      if (k === '+' || k === '=' ) { // '=' with Shift usually yields '+'
        ev.preventDefault()
        if (labelHovered) {
          setLabelScale((s) => Math.min(2.0, +(s + 0.05).toFixed(2)))
        } else if (currentRightHoverId) {
          setRightLabelScales((m) => {
            const prev = m[currentRightHoverId] ?? 1
            return { ...m, [currentRightHoverId]: Math.min(2.0, +(prev + 0.05).toFixed(2)) }
          })
        }
      } else if (k === '-' || k === '_') {
        ev.preventDefault()
        if (labelHovered) {
          setLabelScale((s) => Math.max(0.5, +(s - 0.05).toFixed(2)))
        } else if (currentRightHoverId) {
          setRightLabelScales((m) => {
            const prev = m[currentRightHoverId] ?? 1
            return { ...m, [currentRightHoverId]: Math.max(0.5, +(prev - 0.05).toFixed(2)) }
          })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [labelHovered, currentRightHoverId])

  // Pause auto-rotate when any label hovered (single or right-note), resume otherwise
  useEffect(() => {
    if (!controlsRef.current) return
    const anyHovered = labelHovered || !!currentRightHoverId
    controlsRef.current.autoRotate = !anyHovered && !!autoRotate
  }, [labelHovered, currentRightHoverId, autoRotate])

  const onBounds = React.useCallback((info: BoundsInfo) => {
    // Scale grid to ~1.5x the max dimension, rounded to a nice step
    const base = Math.max(5, info.size * 1.5)
    const nice = Math.min(500, Math.max(5, Math.ceil(base / 5) * 5))
    setGridSize(nice)
    setGridCenter(info.center.clone())
    setGridMinY(info.minY)
    setDims(info.dims)
    setStats({ verts: info.verts, tris: info.tris })
  }, [])

  const addNoteAt = (p: [number, number, number]) => {
    // Start empty; user can type with placeholder
    setNote((prev) => ({ id: prev?.id ?? Math.random().toString(36).slice(2, 9), position: p, label: '' }))
  }
  const addRightNoteAt = (p: [number, number, number]) => {
    const id = Math.random().toString(36).slice(2, 9)
    // Start empty; user can type with placeholder
    setRightNotes((prev) => [...prev, { id, position: p, label: '' }])
  }
  const updateRightNote = (id: string, label: string) => {
    setRightNotes((prev) => prev.map((n) => (n.id === id ? { ...n, label } : n)))
  }
  const removeRightNote = (id: string) => {
    setRightNotes((prev) => prev.filter((n) => n.id !== id))
  }

  useImperativeHandle(ref, () => ({
    reset: () => {
      try { controlsRef.current?.reset?.() } catch {}
    },
    clear: () => {
      setNote(null)
      setRightNotes([])
    }
  }), [])
  // Force clear only when clearSignal actually changes (avoid clearing on initial mount)
  const prevClearRef = useRef<number | null>(null)
  useEffect(() => {
    if (typeof clearSignal !== 'number') return
    if (prevClearRef.current === null) {
      prevClearRef.current = clearSignal
      return
    }
    if (clearSignal !== prevClearRef.current) {
      setNote(null)
      setRightNotes([])
      prevClearRef.current = clearSignal
    }
  }, [clearSignal])
  return (
    <div className="w-full h-full" onContextMenu={(e) => e.preventDefault()}>
      <Canvas
        shadows
        camera={{ position: [2.5, 1.5, 2.5], fov: 45 }}
        onPointerMove={(e) => { if (dragging.current.kind && (e as any).ray) { e.stopPropagation(); updateDrag(e) } }}
        onPointerUp={() => { dragging.current.kind = null; if (controlsRef.current) controlsRef.current.enabled = true }}
        onPointerMissed={() => { dragging.current.kind = null; if (controlsRef.current) controlsRef.current.enabled = true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
        <Suspense fallback={null}>
          <Bounds fit clip observe={false} margin={1.2}>
            {isGL && (
              <GLTFModel
                url={url}
                onBounds={onBounds}
                onClickPoint={(p) => {
                  if (simulateMode && onAddForce) onAddForce(p); else addNoteAt(p)
                }}
                onRightClickPoint={(p) => {
                  if (!simulateMode) addRightNoteAt(p)
                }}
                simData={simDisplacements as any}
              />
            )}
            {isSTL && (
              <STLModel
                url={url}
                onBounds={onBounds}
                onClickPoint={(p) => {
                  if (simulateMode && onAddForce) onAddForce(p); else addNoteAt(p)
                }}
                onRightClickPoint={(p) => {
                  if (!simulateMode) addRightNoteAt(p)
                }}
                simData={simDisplacements as any}
              />
            )}
            {showGrid && (
              <gridHelper
                args={[gridSize, Math.max(10, Math.min(100, Math.round(gridSize)) ), '#9ca3af', '#e5e7eb']}
                position={gridCenter ? [gridCenter.x, gridMinY, gridCenter.z] : [0, 0, 0]}
              />
            )}
            {/* Simulate mode: show force gizmos/cards at positions */}
            {simulateMode && forces.map((f) => (
              <group key={f.id} position={f.position}>
                <ForceArrow
                  dir={f.direction}
                  length={markerRadius * 8}
                  color={simBreak ? '#f59e0b' : '#ef4444'}
                />
                {/* Mini arrow next to the label for extra clarity */}
                <group position={[markerRadius * 1.0, markerRadius * 1.0, 0]}>
                  <ForceArrow
                    dir={f.direction}
                    length={markerRadius * 3}
                    color={simBreak ? '#f59e0b' : '#ef4444'}
                  />
                </group>
                <Html position={[markerRadius * 1.0, markerRadius * 1.0, 0]} transform distanceFactor={labelDistanceFactor}>
                  <div className="flex items-start gap-2 rounded-md bg-white/95 text-neutral-900 border border-neutral-200 shadow px-3 py-2 text-sm">
                    <div className="grid grid-cols-7 gap-1 items-center">
                      <span className="col-span-2 text-xs text-neutral-600">Magnitude</span>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        className="col-span-5 w-28 rounded border border-neutral-300 px-2 py-1 text-sm"
                        value={f.magnitude}
                        onChange={(e) => onForceChange?.(f.id, { magnitude: Number(e.target.value) })}
                      />
                      <span className="col-span-2 text-xs text-neutral-600 mt-1 flex items-center gap-2">Direction
                        {(() => {
                          const az = Math.atan2(f.direction[2], f.direction[0]) * 180 / Math.PI
                          const stroke = simBreak ? '#f59e0b' : '#ef4444'
                          return (
                            <svg width={28} height={14} viewBox="0 0 28 14" style={{ transform: `rotate(${az}deg)` }}>
                              <path d="M2 7 H24" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
                              <path d="M18 3 L24 7 L18 11" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )
                        })()}
                      </span>
                      <div className="col-span-5 flex gap-1 mt-1">
                        {(['x','y','z'] as const).map((axis, idx) => (
                          <input
                            key={axis}
                            type="number"
                            step="0.1"
                            className="w-16 rounded border border-neutral-300 px-2 py-1 text-sm"
                            value={f.direction[idx]}
                            onChange={(e) => {
                              const val = Number(e.target.value)
                              const dir: [number, number, number] = [...f.direction] as any
                              dir[idx] = val
                              // normalize
                              const n = Math.sqrt(dir[0]*dir[0] + dir[1]*dir[1] + dir[2]*dir[2]) || 1
                              onForceChange?.(f.id, { direction: [dir[0]/n, dir[1]/n, dir[2]/n] as any })
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onForceRemove?.(f.id) }}
                      className="inline-flex items-center justify-center rounded hover:bg-neutral-100 p-1"
                      aria-label="Remove force"
                      title="Remove force"
                    >
                      <X className="h-4 w-4 text-neutral-600" />
                    </button>
                  </div>
                </Html>
              </group>
            ))}
            {/* Simulation overlay for API displacements (kept as fallback/points) */}
            {simDisplacements && (
              <SimulationOverlay data={simDisplacements as any} scale={markerRadius} />
            )}
            {/* Single Info Label (Left-click) */}
            {note && (
              <group key={note.id} position={note.position}>
                {/* Invisible drag handle to capture 3D pointer events over the label area */}
                <mesh
                  onPointerDown={(e) => {
                    if ((e as any).shiftKey && (e as any).ray) {
                      e.stopPropagation()
                      const y = note.position[1]
                      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y)
                      const hit = new THREE.Vector3()
                      ;(e as any).ray.intersectPlane(plane, hit)
                      dragging.current = { kind: 'single', y, offset: new THREE.Vector3().fromArray(note.position).sub(hit) }
                      if (controlsRef.current) controlsRef.current.enabled = false
                    }
                  }}
                >
                  <sphereGeometry args={[markerRadius * 2.6, 16, 16]} />
                  <meshBasicMaterial transparent opacity={0} />
                </mesh>
                <Html position={[markerRadius * 1.8, markerRadius * 1.8, 0]} transform distanceFactor={labelDistanceFactor}>
                  <div
                    onMouseEnter={() => setLabelHovered(true)}
                    onMouseLeave={() => setLabelHovered(false)}
                    className={
                      `rounded-lg bg-white/95 text-neutral-900 ${labelHovered ? 'border-2 border-neutral-300 shadow-lg' : 'border border-neutral-200 shadow'} px-5 py-3.5 max-w-[34rem]`
                    }
                    style={{
                      transform: `scale(${labelScale})`,
                      transformOrigin: 'top left',
                      transition: 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 260ms ease, border-color 260ms ease, border-width 260ms ease',
                      willChange: 'transform, box-shadow, border-color, border-width'
                    }}
                    title={labelHovered ? 'Shift + / - to scale' : undefined}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xl font-semibold leading-tight">{modelName || 'Model'}</div>
                        <div className="mt-1 text-sm text-neutral-600">
                          {fileName && <span className="mr-2">File: <span className="text-neutral-900 font-medium">{fileName}</span></span>}
                          <span className="mr-2">Type: <span className="text-neutral-900 font-medium">{isGL ? 'GLTF/GLB' : (isSTL ? 'STL' : 'Unknown')}</span></span>
                          {dims && (
                            <span className="mr-2">Dims: <span className="text-neutral-900 font-medium">{dims.x.toFixed(2)} × {dims.y.toFixed(2)} × {dims.z.toFixed(2)}</span></span>
                          )}
                          {createdLabel && <span>Created: <span className="text-neutral-900 font-medium">{createdLabel}</span></span>}
                          {(typeof stats.verts !== 'undefined' || typeof stats.tris !== 'undefined') && (
                            <span className="ml-2">
                              {typeof stats.verts !== 'undefined' && <>Verts: <span className="text-neutral-900 font-medium">{stats.verts!.toLocaleString()}</span></>}
                              {typeof stats.verts !== 'undefined' && typeof stats.tris !== 'undefined' && <span className="mx-1">•</span>}
                              {typeof stats.tris !== 'undefined' && <>Tris: <span className="text-neutral-900 font-medium">{stats.tris!.toLocaleString()}</span></>}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setNote(null) }}
                        className="inline-flex items-center justify-center rounded hover:bg-neutral-100 p-1"
                        aria-label="Close label"
                        title="Close label"
                      >
                        <X className="h-4 w-4 text-neutral-600" />
                      </button>
                    </div>
                  </div>
                </Html>
              </group>
            )}
            {/* Multiple Editable Notes (Right-click) */}
            {rightNotes.map((n) => (
              <group
                key={n.id}
                position={n.position}
                onPointerDown={(e) => {
                  if ((e as any).shiftKey && (e as any).ray) {
                    e.stopPropagation()
                    const y = n.position[1]
                    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y)
                    const hit = new THREE.Vector3()
                    ;(e as any).ray.intersectPlane(plane, hit)
                    dragging.current = { kind: 'right', id: n.id, y, offset: new THREE.Vector3().fromArray(n.position).sub(hit) }
                    if (controlsRef.current) controlsRef.current.enabled = false
                  }
                }}
              >
                <mesh>
                  <sphereGeometry args={[markerRadius, 32, 32]} />
                  <meshStandardMaterial
                    color="#000000"
                    emissive="#000000"
                    emissiveIntensity={0.0}
                    transparent
                    opacity={0.25}
                    depthWrite={false}
                  />
                </mesh>
                <Html position={[markerRadius * 1.2, markerRadius * 1.2, 0]} transform distanceFactor={labelDistanceFactor}>
                  <div
                    onMouseEnter={() => setCurrentRightHoverId(n.id)}
                    onMouseLeave={() => setCurrentRightHoverId((id) => (id === n.id ? null : id))}
                    className={`flex items-start gap-2 rounded-md bg-white/95 text-neutral-900 ${currentRightHoverId === n.id ? 'border-2 border-neutral-300 shadow-lg' : 'border border-neutral-200 shadow'} px-4 py-2 text-lg max-w-[28rem]`}
                    style={{
                      transform: `scale(${(rightLabelScales[n.id] ?? 1)})`,
                      transformOrigin: 'top left',
                      transition: 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 260ms ease, border-color 260ms ease, border-width 260ms ease',
                      willChange: 'transform, box-shadow, border-color, border-width'
                    }}
                    title={currentRightHoverId === n.id ? 'Shift + / - to scale' : undefined}
                  >
                    <textarea
                      value={n.label}
                      placeholder="Click here"
                      onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }}
                      onChange={(e) => setRightNotes((prev) => prev.map((r) => r.id === n.id ? { ...r, label: e.target.value } : r))}
                      onClick={(e) => e.stopPropagation()}
                      rows={1}
                      className="bg-transparent outline-none border-none text-lg font-medium w-full leading-snug resize-none overflow-hidden"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); removeRightNote(n.id) }}
                      className="inline-flex items-center justify-center rounded hover:bg-neutral-100 p-0.5"
                      aria-label="Delete note"
                      title="Delete note"
                    >
                      <X className="h-4 w-4 text-neutral-600" />
                    </button>
                  </div>
                </Html>
              </group>
            ))}
          </Bounds>
          {showEnv && <Environment preset={envPreset} />}
        </Suspense>
        <OrbitControls ref={controlsRef} enableDamping makeDefault autoRotate={autoRotate} autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  )
}
const ModelViewer = forwardRef<ModelViewerHandle, { url: string; autoRotate?: boolean; showEnv?: boolean; showGrid?: boolean; envPreset?: EnvPreset; clearSignal?: number; modelName?: string; createdAt?: string; initialLabels?: LabelsPayload | null; onLabelsChange?: (payload: LabelsPayload) => void; simulateMode?: boolean; forces?: ForcePoint[]; onAddForce?: (p: [number, number, number]) => void; onForceChange?: (id: string, patch: Partial<ForcePoint>) => void; onForceRemove?: (id: string) => void; simBreak?: boolean; simDisplacements?: any[] }>(ModelViewerImpl)

// Simple arrow (shaft + head) that points TOWARD the origin point (force coming from this direction)
function ForceArrow({ dir, length = 1, color = '#ef4444' }: { dir: [number, number, number]; length?: number; color?: string }) {
  // Normalize and orient so the cone tip lands at (0,0,0) and the arrow points backward along -dir
  const d = new THREE.Vector3(dir[0], dir[1], dir[2])
  if (d.lengthSq() < 1e-6) d.set(0, 1, 0)
  d.normalize()
  const shaftLen = Math.max(0.0001, length * 0.78)
  const headLen = Math.max(0.0001, length * 0.22)

  // Local default models are built along +Y. Compute rotation from +Y to -dir
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().multiplyScalar(-1).normalize())

  return (
    <group>
      {/* Shaft: offset so its end touches the origin */}
      <group position={d.clone().multiplyScalar(shaftLen * 0.5)} quaternion={q as any}>
        <mesh>
          <cylinderGeometry args={[length * 0.06, length * 0.06, shaftLen, 16]} />
          <meshStandardMaterial color={color} metalness={0.05} roughness={0.6} />
        </mesh>
      </group>
      {/* Head: positioned so the tip is at origin */}
      <group position={d.clone().multiplyScalar(headLen * 0.5)} quaternion={q as any}>
        <mesh position={[0, shaftLen * 0.5 + headLen * 0.5, 0]}>
          <coneGeometry args={[length * 0.22, headLen, 24]} />
          <meshStandardMaterial color={color} metalness={0.05} roughness={0.6} />
        </mesh>
      </group>
    </group>
  )
}

// Visualize simulation displacements as instanced spheres (best-effort parsing)
function SimulationOverlay({ data, scale = 1 }: { data: any[]; scale?: number }) {
  // Parse to unified array of { p: THREE.Vector3, m: number }
  const points = React.useMemo(() => {
    const out: { p: THREE.Vector3; m: number }[] = []
    if (!Array.isArray(data)) return out
    for (let i = 0; i < data.length; i++) {
      const item = data[i]
      if (!item) continue
      // Supported shapes: { position:[x,y,z], displacement: number|[dx,dy,dz] }
      // or [x,y,z,dx,dy,dz] or [x,y,z,magnitude]
      if (Array.isArray(item)) {
        if (item.length >= 6) {
          const [x, y, z, dx, dy, dz] = item
          const m = Math.sqrt(dx * dx + dy * dy + dz * dz)
          out.push({ p: new THREE.Vector3(x, y, z), m })
        } else if (item.length === 4) {
          const [x, y, z, m] = item
          out.push({ p: new THREE.Vector3(x, y, z), m: Math.abs(Number(m) || 0) })
        }
      } else if (typeof item === 'object') {
        const pos = (item.position || item.pos || item.p) as [number, number, number] | undefined
        const disp = item.displacement ?? item.magnitude ?? item.m
        if (pos && Array.isArray(pos) && pos.length === 3) {
          let m = 0
          if (Array.isArray(disp) && disp.length === 3) {
            m = Math.sqrt(disp[0] * disp[0] + disp[1] * disp[1] + disp[2] * disp[2])
          } else if (typeof disp === 'number') {
            m = Math.abs(disp)
          }
          out.push({ p: new THREE.Vector3(pos[0], pos[1], pos[2]), m })
        }
      }
      if (out.length > 4000) break // cap for perf
    }
    // Normalize magnitudes for color mapping
    const maxM = out.reduce((a, b) => Math.max(a, b.m), 0) || 1
    out.forEach(o => (o.m = o.m / maxM))
    return out
  }, [data])

  const count = points.length
  const dummy = React.useMemo(() => new THREE.Object3D(), [])
  const colorArray = React.useMemo(() => new Float32Array(count * 3), [count])

  React.useEffect(() => {
    // Build color gradient: green -> yellow -> red
    for (let i = 0; i < count; i++) {
      const t = points[i].m
      const r = t > 0.5 ? 2 * (t - 0.5) : 0
      const g = t < 0.5 ? 2 * t : 2 * (1 - t)
      const b = 0
      colorArray[i * 3 + 0] = r
      colorArray[i * 3 + 1] = g
      colorArray[i * 3 + 2] = b
    }
  }, [points, colorArray, count])

  if (count === 0) return null

  return (
    <instancedMesh args={[undefined as any, undefined as any, count] as any} frustumCulled={false}>
      <sphereGeometry args={[0.01 * scale, 8, 8]} />
      <meshBasicMaterial vertexColors transparent opacity={0.9} depthWrite={false} />
      {(() => {
        for (let i = 0; i < count; i++) {
          const { p, m } = points[i]
          dummy.position.copy(p)
          const s = 0.12 * scale * (0.6 + 0.8 * m)
          dummy.scale.set(s, s, s)
          dummy.rotation.set(0, 0, 0)
          dummy.updateMatrix()
          ;(dummy as any).parent?.setMatrixAt?.(i, dummy.matrix)
          ;(dummy as any).parent?.setColorAt?.(i, new THREE.Color(colorArray[i * 3], colorArray[i * 3 + 1], colorArray[i * 3 + 2]))
        }
        return null
      })()}
    </instancedMesh>
  )
}

function ViewerPageInner() {
  const { user } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const params = useSearchParams()
  const router = useRouter()
  const modelId = params.get('m')

  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoRotate, setAutoRotate] = useState(true)
  const [showEnv, setShowEnv] = useState(false)
  const [envPreset, setEnvPreset] = useState<EnvPreset>('city')
  const [showGrid, setShowGrid] = useState(false)
  const viewerRef = useRef<ModelViewerHandle | null>(null)
  const [viewerKey, setViewerKey] = useState(0)
  const [clearSignal, setClearSignal] = useState(0)
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [labels, setLabels] = useState<LabelsPayload | null>(null)
  const labelsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saving, setSaving] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const savedHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipFirstEmitFromFetch = useRef(false)

  // Simulate mode state (for FEM)
  const [simulateMode, setSimulateMode] = useState(false)
  const [material, setMaterial] = useState<'mdf' | 'pla'>('pla')
  const [forces, setForces] = useState<ForcePoint[]>([])
  const [simLoading, setSimLoading] = useState(false)
  const [simError, setSimError] = useState<string | null>(null)
  const [simResult, setSimResult] = useState<{ break: boolean; max_stress: number; tensile_strength: number; displacements: any[]; notes?: string } | null>(null)

  const onAddForce = (p: [number, number, number]) => {
    setForces(prev => [
      ...prev,
      { id: Math.random().toString(36).slice(2, 9), position: p, magnitude: 10, direction: [0, 1, 0] }
    ])
  }
  const onForceChange = (id: string, patch: Partial<ForcePoint>) => {
    setForces(prev => prev.map(f => (f.id === id ? { ...f, ...patch } : f)))
  }
  const onForceRemove = (id: string) => {
    setForces(prev => prev.filter(f => f.id !== id))
  }

  const runSimulation = async () => {
    if (!url) return
    setSimError(null)
    setSimResult(null)
    setSimLoading(true)
    try {
      // Route via our Next.js API proxy to avoid browser preflight/ngrok issues
      const endpoint = '/api/simulate'
      const payload = {
        model_url: url,
        material,
        forces: forces.map(f => ({ location: f.position, direction: f.direction, magnitude: f.magnitude }))
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const txt = await res.text()
        try {
          const j = JSON.parse(txt)
          setSimError(
            j.error || j.detail || j.message || j.upstream?.statusText || `HTTP ${res.status} ${res.statusText}`
          )
        } catch {
          setSimError(`HTTP ${res.status} ${res.statusText}: ${txt.slice(0, 300)}`)
        }
        return
      }
      const data = await res.json()
      setSimResult(data)
    } catch (e: any) {
      setSimError(e?.message || 'Simulation failed')
    } finally {
      setSimLoading(false)
    }
  }

  const saveLabelsNow = React.useCallback(async () => {
    try {
      if (!modelId) return
      if (labelsSaveTimer.current) {
        clearTimeout(labelsSaveTimer.current)
        labelsSaveTimer.current = null
      }
      setSaving(true)
      await supabase.from('models').update({ labels }).eq('id', modelId)
      setSaving(false)
      setShowSaved(true)
      if (savedHideTimer.current) clearTimeout(savedHideTimer.current)
      savedHideTimer.current = setTimeout(() => setShowSaved(false), 1400)
    } catch {}
  }, [modelId, supabase, labels])

  useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!modelId || !user?.id) {
        setName("")
        setUrl("")
        setCreatedAt(null)
        setLabels(null)
        return
      }
      setLoading(true)
      setError(null)
      const { data: row, error: err } = await supabase
        .from('models')
        .select('name, model_url, created_at, labels')
        .eq('id', modelId)
        .single()
      if (!mounted) return
      if (err) {
        setError(err.message)
      } else {
        setName((row?.name as string) || 'Model')
        setUrl((row?.model_url as string) || '')
        setCreatedAt((row?.created_at as string) || null)
        try {
          const raw = (row as any)?.labels
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
          setLabels((parsed as any) ?? null)
          // prevent the first emitted save after hydrating labels from the DB
          skipFirstEmitFromFetch.current = true
        } catch {
          setLabels(null)
        }
      }
      setLoading(false)
    }
    run()
    return () => { mounted = false }
  }, [modelId, supabase, user?.id])

  // Ctrl/Cmd + S to save labels immediately
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveLabelsNow()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveLabelsNow])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">Models</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{name || 'Select a model'}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-2">
            {showEnv && (
              <Select value={envPreset} onValueChange={(v) => setEnvPreset(v as EnvPreset)}>
                <SelectTrigger className="h-8 w-[160px] bg-white/95 backdrop-blur border border-neutral-200 text-neutral-900">
                  <SelectValue placeholder="Environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="city">City</SelectItem>
                  <SelectItem value="sunset">Sunset</SelectItem>
                  <SelectItem value="dawn">Dawn</SelectItem>
                  <SelectItem value="night">Night</SelectItem>
                  <SelectItem value="forest">Forest</SelectItem>
                  <SelectItem value="park">Park</SelectItem>
                  <SelectItem value="studio">Studio</SelectItem>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="apartment">Apartment</SelectItem>
                  <SelectItem value="lobby">Lobby</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Separator orientation="vertical" className="hidden md:block h-4" />
            <button
              onClick={() => setSimulateMode(v => !v)}
              className={`h-8 px-3 rounded-full text-sm font-medium border ${simulateMode ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white/95 text-neutral-900 border-neutral-200'}`}
              title={simulateMode ? 'Exit simulate mode' : 'Enter simulate mode'}
            >
              {simulateMode ? 'Simulate: On' : 'Simulate: Off'}
            </button>
            {simulateMode && (
              <>
                <Select value={material} onValueChange={(v) => setMaterial(v as 'mdf' | 'pla')}>
                  <SelectTrigger className="h-8 w-[120px] bg-white/95 backdrop-blur border border-neutral-200 text-neutral-900">
                    <SelectValue placeholder="Material" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pla">PLA</SelectItem>
                    <SelectItem value="mdf">MDF</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={runSimulation}
                  disabled={simLoading || !url || forces.length === 0}
                  className={`h-8 px-3 rounded-full text-sm font-medium border ${simLoading ? 'opacity-70' : ''} bg-white/95 text-neutral-900 border-neutral-200`}
                  title={forces.length === 0 ? 'Add at least one force' : 'Run simulation'}
                >
                  {simLoading ? 'Running…' : 'Run Simulation'}
                </button>
              </>
            )}
          </div>
        </header>
        <div className="flex flex-1 flex-col p-0">
          <div className="bg-background flex-1 min-h-0 p-0">
            {!modelId && (
              <div className="h-[calc(100vh-64px)] w-full flex items-center justify-center">
                <div className="text-center text-muted-foreground">Select a model from the sidebar to preview it.</div>
              </div>
            )}
            {modelId && (
              <div className="h-[calc(100vh-64px)] w-full relative">
                {error && <p className="text-sm text-red-600 p-2">{error}</p>}
                {loading ? (
                  <Skeleton className="h-full w-full" />
                ) : url ? (
                  <>
                    {/* Simulation status/result banner */}
                    {(simError || simResult) && (
                      <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-10">
                        <div className={`px-3 py-1 rounded-full text-sm font-medium shadow border ${simError ? 'bg-red-50 text-red-700 border-red-200' : (simResult?.break ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200')}`}>
                          {simError ? simError : (simResult?.break ? 'Warning: Likely to break' : 'OK: Within tensile limits')}
                          {simResult ? ` · Max stress: ${simResult.max_stress.toFixed?.(2) ?? simResult.max_stress} · Tensile: ${simResult.tensile_strength}` : ''}
                        </div>
                      </div>
                    )}
                    <ModelViewer
                      key={`${modelId}:${viewerKey}`}
                      ref={viewerRef}
                      url={url}
                      autoRotate={autoRotate}
                      showEnv={showEnv}
                      showGrid={showGrid}
                      envPreset={envPreset}
                      clearSignal={clearSignal}
                      modelName={name}
                      createdAt={createdAt ?? undefined}
                      initialLabels={labels}
                      onLabelsChange={(payload) => {
                        // Ignore the first emit after we just fetched labels
                        if (skipFirstEmitFromFetch.current) {
                          skipFirstEmitFromFetch.current = false
                          return
                        }
                        // skip if no change vs current labels state
                        const same = JSON.stringify(labels ?? {}) === JSON.stringify(payload ?? {})
                        if (same) return
                        setLabels(payload)
                        if (labelsSaveTimer.current) clearTimeout(labelsSaveTimer.current)
                        labelsSaveTimer.current = setTimeout(async () => {
                          try {
                            if (!modelId) return
                            setSaving(true)
                            await supabase.from('models').update({ labels: payload }).eq('id', modelId)
                            setSaving(false)
                            setShowSaved(true)
                            if (savedHideTimer.current) clearTimeout(savedHideTimer.current)
                            savedHideTimer.current = setTimeout(() => setShowSaved(false), 1400)
                          } catch {}
                        }, 700)
                      }}
                      simulateMode={simulateMode}
                      forces={forces}
                      onAddForce={onAddForce}
                      onForceChange={onForceChange}
                      onForceRemove={onForceRemove}
                      simBreak={!!simResult?.break}
                      simDisplacements={simResult?.displacements as any}
                    />
                    {/* Floating controls */}
                    <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                      <div className="flex items-center gap-1 rounded-full bg-white text-neutral-900 border border-neutral-200 shadow-lg px-1.5 py-1">
                        <button
                          onClick={() => setAutoRotate(v => !v)}
                          className="p-1.5 rounded-full hover:bg-neutral-100"
                          aria-label={autoRotate ? 'Auto rotate: On' : 'Auto rotate: Off'}
                          title={autoRotate ? 'Auto rotate: On' : 'Auto rotate: Off'}
                        >
                          <RotateCw className={"h-4 w-4 " + (autoRotate ? "text-black-600" : "text-neutral-500")} />
                        </button>
                        <button
                          onClick={() => viewerRef.current?.reset()}
                          className="p-1.5 rounded-full hover:bg-neutral-100"
                          aria-label="Reset view"
                          title="Reset view"
                        >
                          <RefreshCw className="h-4 w-4 text-neutral-700" />
                        </button>
                        <button
                          onClick={() => setShowEnv(v => !v)}
                          className="p-1.5 rounded-full hover:bg-neutral-100"
                          aria-label={showEnv ? 'Environment: On' : 'Environment: Off'}
                          title={showEnv ? 'Environment: On' : 'Environment: Off'}
                        >
                          <Globe2 className={"h-4 w-4 " + (showEnv ? "text-black-600" : "text-neutral-500")} />
                        </button>
                        <button
                          onClick={() => setShowGrid(v => !v)}
                          className="p-1.5 rounded-full hover:bg-neutral-100"
                          aria-label={showGrid ? 'Grid: On' : 'Grid: Off'}
                          title={showGrid ? 'Grid: On' : 'Grid: Off'}
                        >
                          <Grid3X3 className={"h-4 w-4 " + (showGrid ? "text-black-600" : "text-neutral-500")} />
                        </button>
                        <Separator orientation="vertical" className="mx-1 h-4" />
                        <button
                          onClick={() => { setClearSignal((s) => s + 1) }}
                          className="px-2 py-1 rounded-full hover:bg-neutral-100 text-sm font-medium"
                          aria-label="Clear markers"
                          title="Clear markers"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    {/* Save indicator bottom-left */}
                    <div className="pointer-events-none absolute bottom-4 left-4 z-10">
                      <div className={`rounded-full px-3 py-1 text-xs font-medium shadow ${saving ? 'bg-blue-50 text-blue-700 border border-blue-200' : (showSaved ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-white/0 text-transparent border border-transparent')}`}
                           style={{ transition: 'all 200ms ease' }}>
                        {saving ? 'Saving…' : (showSaved ? 'Saved' : 'Saved')}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">No model URL found.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function ViewerPage() {
  return (
    <Suspense fallback={<div className="p-4 text-muted-foreground">Loading…</div>}>
      <ViewerPageInner />
    </Suspense>
  )
}

// Preload GLTF parser
useGLTF.preload?.("")
