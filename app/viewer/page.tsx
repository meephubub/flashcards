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
type ClickPoint = { id: string; position: [number, number, number]; label: string }
type LabelsPayload = {
  single?: { id: string; position: [number, number, number]; label: string; scale?: number }
  rights?: Array<{ id: string; position: [number, number, number]; label: string; scale?: number }>
}

function GLTFModel({ url, onBounds, onClickPoint, onRightClickPoint }: { url: string; onBounds?: (info: BoundsInfo) => void; onClickPoint?: (p: [number, number, number]) => void; onRightClickPoint?: (p: [number, number, number]) => void }) {
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

function STLModel({ url, onBounds, onClickPoint, onRightClickPoint }: { url: string; onBounds?: (info: BoundsInfo) => void; onClickPoint?: (p: [number, number, number]) => void; onRightClickPoint?: (p: [number, number, number]) => void }) {
  const [geom, setGeom] = React.useState<THREE.BufferGeometry | null>(null)
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
      <meshStandardMaterial color="#9ca3af" metalness={0.2} roughness={0.6} />
    </mesh>
  )
}

type ModelViewerHandle = { reset: () => void; clear: () => void }
function ModelViewerImpl(
  { url, autoRotate = true, showEnv = true, showGrid = false, envPreset = 'city', clearSignal, modelName, createdAt, initialLabels, onLabelsChange }: { url: string; autoRotate?: boolean; showEnv?: boolean; showGrid?: boolean; envPreset?: EnvPreset; clearSignal?: number; modelName?: string; createdAt?: string; initialLabels?: LabelsPayload | null; onLabelsChange?: (payload: LabelsPayload) => void },
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
            {isGL && <GLTFModel url={url} onBounds={onBounds} onClickPoint={addNoteAt} onRightClickPoint={addRightNoteAt} />}
            {isSTL && <STLModel url={url} onBounds={onBounds} onClickPoint={addNoteAt} onRightClickPoint={addRightNoteAt} />}
            {showGrid && (
              <gridHelper
                args={[gridSize, Math.max(10, Math.min(100, Math.round(gridSize)) ), '#9ca3af', '#e5e7eb']}
                position={gridCenter ? [gridCenter.x, gridMinY, gridCenter.z] : [0, 0, 0]}
              />
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
const ModelViewer = forwardRef<ModelViewerHandle, { url: string; autoRotate?: boolean; showEnv?: boolean; showGrid?: boolean; envPreset?: EnvPreset; clearSignal?: number; modelName?: string; createdAt?: string; initialLabels?: LabelsPayload | null; onLabelsChange?: (payload: LabelsPayload) => void }>(ModelViewerImpl)

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
  const [showEnv, setShowEnv] = useState(true)
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
