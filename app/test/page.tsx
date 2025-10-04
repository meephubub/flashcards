"use client"

import React, { useMemo } from "react"
import { Canvas, useLoader } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import { SVGLoader } from "three-stdlib"

function SvgExtrude({ url = "/logo.svg", depth = 2 }: { url?: string; depth?: number }) {
  const data = useLoader(SVGLoader as any, url) as any

  // Convert SVG paths to extruded meshes
  const meshes = useMemo(() => {
    const group: React.ReactElement[] = []
    const material = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.2, roughness: 0.6 })

    ;(data?.paths || []).forEach((path: any, i: number) => {
      const shapes = SVGLoader.createShapes(path)
      shapes.forEach((shape: any, j: number) => {
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth,
          bevelEnabled: true,
          bevelThickness: depth * 0.15,
          bevelSize: depth * 0.15,
          bevelSegments: 2,
        })
        // Center each piece
        geo.center()
        const color = new THREE.Color(path.color || "#1f2937") // fallback slate-800
        const mat = material.clone()
        mat.color = color
        group.push(
          <mesh key={`${i}-${j}`} geometry={geo} material={mat} castShadow receiveShadow />
        )
      })
    })
    return group
  }, [data, depth])

  // Slight tilt for better look
  return <group rotation={[-Math.PI / 2.5, 0, 0]}>{meshes}</group>
}

export default function TestPage() {
  return (
    <div className="h-[calc(100vh-0px)] w-full">
      <Canvas
        shadows
        camera={{ position: [8, 6, 8], fov: 45 }}
        gl={{ antialias: true }}
      >
        {/* Lights */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />

        {/* Ground */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color="#f5f5f4" />
        </mesh>

        {/* SVG model */}
        <SvgExtrude url="/placeholder.svg" depth={1.2} />

        {/* Controls */}
        <OrbitControls enableDamping dampingFactor={0.08} />
      </Canvas>
    </div>
  )
}
