"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RotateCw, CheckCircle, Info, Hammer, Ruler } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"


interface Racket3DViewerProps {
  productName: string
  brandName: string
  maxTensionLimit?: number
}

export function Racket3DViewer({ productName, brandName, maxTensionLimit = 28 }: Racket3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Customization States
  const [stringColor, setStringColor] = useState<string>("white")
  const [gripColor, setGripColor] = useState<string>("black")
  const [tension, setTension] = useState<number>(26) // default tension in lbs
  const [autoRotate, setAutoRotate] = useState<boolean>(true)
  const [customized, setCustomized] = useState<boolean>(false)
  const [showSpecs, setShowSpecs] = useState<boolean>(true)

  const widthLabelRef = useRef<HTMLDivElement>(null)
  const heightLabelRef = useRef<HTMLDivElement>(null)
  const totalLabelRef = useRef<HTMLDivElement>(null)
  const dimsGroupRef = useRef<THREE.Group | null>(null)

  // Sync showSpecs toggle with 3D dimensions group visibility
  useEffect(() => {
    if (dimsGroupRef.current) {
      dimsGroupRef.current.visible = showSpecs
    }
  }, [showSpecs])

  // Broken frame detection
  const isBroken = tension > maxTensionLimit
  const wasBrokenRef = useRef<boolean>(false)
  const shakeRef = useRef<number>(0)

  // Trigger effect when broken state transitions
  useEffect(() => {
    if (isBroken && !wasBrokenRef.current) {
      shakeRef.current = 0.12 // Trigger camera shake
      toast.error("⚠️ KHUNG VỢT BỊ GÃY!", {
        description: `Sức căng ${tension} lbs đã vượt quá giới hạn tối đa ${maxTensionLimit} lbs của khung vợt này!`,
      })
    }
    wasBrokenRef.current = isBroken
  }, [isBroken, tension, maxTensionLimit])

  // Color Mapping Options (Adjusted string Trắng/Bạc hex to #9ca3af for visibility on white bg)
  const stringColors = [
    { name: "Trắng/Bạc", value: "white", hex: "#9ca3af" },
    { name: "Neon", value: "neon", hex: "#22c55e" },
    { name: "Đỏ", value: "red", hex: "#ef4444" },
    { name: "Đen", value: "black", hex: "#111827" },
    { name: "Vàng", value: "yellow", hex: "#eab308" }
  ]

  const gripColors = [
    { name: "Đen", value: "black", hex: "#111827" },
    { name: "Trắng", value: "white", hex: "#e2e8f0" },
    { name: "Đỏ", value: "red", hex: "#dc2626" },
    { name: "Vàng", value: "yellow", hex: "#ca8a04" },
    { name: "Xanh", value: "blue", hex: "#2563eb" }
  ]

  // Racket brand palette mappings
  const getBrandPalette = (name: string) => {
    const lower = name.toLowerCase()
    if (lower.includes("astrox") || lower.includes("88d")) {
      return { frame1: "#b91c1c", frame2: "#d97706", shaft: "#374151" } // astrox red & amber
    }
    if (lower.includes("nanoflare")) {
      return { frame1: "#06b6d4", frame2: "#059669", shaft: "#4b5563" } // nanoflare cyan & emerald
    }
    if (lower.includes("axforce")) {
      return { frame1: "#111827", frame2: "#b45309", shaft: "#1f2937" } // axforce matte black & gold
    }
    if (lower.includes("thruster") || lower.includes("victor")) {
      return { frame1: "#ca8a04", frame2: "#1e293b", shaft: "#475569" } // victor gold & slate
    }
    return { frame1: "#1f2937", frame2: "#d1d5db", shaft: "#6b7280" } // default slate & grey
  };

  const palette = getBrandPalette(productName)

  // References to update ThreeJS materials on state change
  const stringMaterialRef = useRef<THREE.LineBasicMaterial | null>(null)
  const gripMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const racketGroupRef = useRef<THREE.Group | null>(null)

  // Update String Material Color
  useEffect(() => {
    if (stringMaterialRef.current) {
      const selected = stringColors.find(c => c.value === stringColor)
      if (selected) {
        stringMaterialRef.current.color.set(selected.hex)
      }
    }
  }, [stringColor])

  // Update Grip Material Color
  useEffect(() => {
    if (gripMaterialRef.current) {
      const selected = gripColors.find(c => c.value === gripColor)
      if (selected) {
        gripMaterialRef.current.color.set(selected.hex)
      }
    }
  }, [gripColor])

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()

    // Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 10)
    camera.position.set(0, 0, 2.5)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
    scene.add(ambientLight)

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85)
    dirLight1.position.set(3, 4, 3)
    scene.add(dirLight1)

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.35)
    dirLight2.position.set(-3, -2, -1)
    scene.add(dirLight2)

    // Main Racket Group
    const racketGroup = new THREE.Group()
    racketGroupRef.current = racketGroup
    scene.add(racketGroup)

    // A group specifically for procedural fallback rendering
    const proceduralRacketGroup = new THREE.Group()
    racketGroup.add(proceduralRacketGroup)

    // Dimensions
    const headRadius = 0.3
    const headTube = 0.012
    const headScaleX = 1.0
    const headScaleY = 1.3 // slightly oval
    const a = headRadius * headScaleX
    const b = headRadius * headScaleY

    const frameMat = new THREE.MeshStandardMaterial({
      color: palette.frame1,
      roughness: 0.3,
      metalness: 0.8,
    })

    // 1. Procedural Frame (Head) - Split into two halves when broken
    const leftFrameGroup = new THREE.Group()
    const rightFrameGroup = new THREE.Group()
    proceduralRacketGroup.add(leftFrameGroup)
    proceduralRacketGroup.add(rightFrameGroup)

    // Apply rotation and scale directly to the geometry before creating the mesh to prevent shearing/distortion
    const frameGeoLeft = new THREE.TorusGeometry(headRadius, headTube, 16, 50, Math.PI)
    frameGeoLeft.rotateZ(Math.PI / 2) // rotate to left half
    frameGeoLeft.scale(headScaleX, headScaleY, 1.0) // scale vertically
    const frameLeftMesh = new THREE.Mesh(frameGeoLeft, frameMat)
    leftFrameGroup.add(frameLeftMesh)

    const frameGeoRight = new THREE.TorusGeometry(headRadius, headTube, 16, 50, Math.PI)
    frameGeoRight.rotateZ(-Math.PI / 2) // rotate to right half
    frameGeoRight.scale(headScaleX, headScaleY, 1.0) // scale vertically
    const frameRightMesh = new THREE.Mesh(frameGeoRight, frameMat)
    rightFrameGroup.add(frameRightMesh)

    // Position groups based on broken state
    if (isBroken) {
      leftFrameGroup.position.set(-0.03, 0.34, 0)
      leftFrameGroup.rotation.z = 0.08

      rightFrameGroup.position.set(0.03, 0.34, 0)
      rightFrameGroup.rotation.z = -0.08
    } else {
      leftFrameGroup.position.set(0, 0.35, 0)
      leftFrameGroup.rotation.z = 0

      rightFrameGroup.position.set(0, 0.35, 0)
      rightFrameGroup.rotation.z = 0
    }

    // Secondary color decals on frame
    const decalMat = new THREE.MeshStandardMaterial({
      color: palette.frame2,
      roughness: 0.3,
      metalness: 0.6,
    })

    // Dimension Helper Lines Group
    const dimsGroup = new THREE.Group()
    dimsGroupRef.current = dimsGroup
    dimsGroup.visible = showSpecs
    racketGroup.add(dimsGroup)

    const dimLineMat = new THREE.LineBasicMaterial({
      color: 0x0ea5e9, // Sky blue blueprint line
      transparent: true,
      opacity: 0.6
    })

    // 1. Width Dimension Line (Horizontal across head)
    const widthLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-a, 0.35, 0.02),
      new THREE.Vector3(a, 0.35, 0.02)
    ])
    const widthLine = new THREE.Line(widthLineGeo, dimLineMat)
    dimsGroup.add(widthLine)

    // Tick marks for Width
    const tickW1Geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-a, 0.33, 0.02),
      new THREE.Vector3(-a, 0.37, 0.02)
    ])
    const tickW1 = new THREE.Line(tickW1Geo, dimLineMat)
    dimsGroup.add(tickW1)

    const tickW2Geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(a, 0.33, 0.02),
      new THREE.Vector3(a, 0.37, 0.02)
    ])
    const tickW2 = new THREE.Line(tickW2Geo, dimLineMat)
    dimsGroup.add(tickW2)

    // 2. Height Dimension Line (Vertical, offset left of head)
    const heightOffsetX = -a - 0.04
    const heightLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(heightOffsetX, 0.35 - b, 0.02),
      new THREE.Vector3(heightOffsetX, 0.35 + b, 0.02)
    ])
    const heightLine = new THREE.Line(heightLineGeo, dimLineMat)
    dimsGroup.add(heightLine)

    // Tick marks for Height
    const tickH1Geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(heightOffsetX - 0.02, 0.35 - b, 0.02),
      new THREE.Vector3(heightOffsetX + 0.02, 0.35 - b, 0.02)
    ])
    const tickH1 = new THREE.Line(tickH1Geo, dimLineMat)
    dimsGroup.add(tickH1)

    const tickH2Geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(heightOffsetX - 0.02, 0.35 + b, 0.02),
      new THREE.Vector3(heightOffsetX + 0.02, 0.35 + b, 0.02)
    ])
    const tickH2 = new THREE.Line(tickH2Geo, dimLineMat)
    dimsGroup.add(tickH2)

    // 3. Total Length Dimension Line (Vertical, offset right of racket)
    const totalOffsetX = a + 0.04
    const totalBottomY = -0.35 - (0.3 / 2) - 0.015 // equivalent to standard cap bottom
    const totalTopY = 0.35 + b
    const totalLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(totalOffsetX, totalBottomY, 0.02),
      new THREE.Vector3(totalOffsetX, totalTopY, 0.02)
    ])
    const totalLine = new THREE.Line(totalLineGeo, dimLineMat)
    dimsGroup.add(totalLine)

    // Tick marks for Total Length
    const tickT1Geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(totalOffsetX - 0.02, totalBottomY, 0.02),
      new THREE.Vector3(totalOffsetX + 0.02, totalBottomY, 0.02)
    ])
    const tickT1 = new THREE.Line(tickT1Geo, dimLineMat)
    dimsGroup.add(tickT1)

    const tickT2Geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(totalOffsetX - 0.02, totalTopY, 0.02),
      new THREE.Vector3(totalOffsetX + 0.02, totalTopY, 0.02)
    ])
    const tickT2 = new THREE.Line(tickT2Geo, dimLineMat)
    dimsGroup.add(tickT2)

    // 2. String Bed (Grid inside frame) - ALWAYS visible (procedural & customizable)
    const stringsGroup = new THREE.Group()
    racketGroup.add(stringsGroup)

    const selectedString = stringColors.find(c => c.value === stringColor)
    const stringMat = new THREE.LineBasicMaterial({
      color: selectedString ? selectedString.hex : 0x9ca3af,
      linewidth: 1,
    })
    stringMaterialRef.current = stringMat

    const step = 0.03

    // Vertical strings
    for (let x = -a + step; x < a; x += step) {
      const yBoundary = b * Math.sqrt(1 - (x / a) * (x / a))
      const yStart = 0.35 - yBoundary
      const yEnd = 0.35 + yBoundary
      const points = []

      if (isBroken) {
        // Generate wavy sagging line when broken
        const segments = 15
        for (let i = 0; i <= segments; i++) {
          const t = i / segments
          const currY = yStart + (yEnd - yStart) * t
          // Wave pattern for loose string
          const wave = Math.sin(t * Math.PI * 4) * 0.02
          points.push(new THREE.Vector3(x + wave, currY, (Math.random() - 0.5) * 0.015))
        }
      } else {
        points.push(new THREE.Vector3(x, yStart, 0))
        points.push(new THREE.Vector3(x, yEnd, 0))
      }

      const stringGeo = new THREE.BufferGeometry().setFromPoints(points)
      const stringLine = new THREE.Line(stringGeo, stringMat)
      stringsGroup.add(stringLine)
    }

    // Horizontal strings
    for (let y = -b + step; y < b; y += step) {
      const xBoundary = a * Math.sqrt(1 - (y / b) * (y / b))
      const xStart = -xBoundary
      const xEnd = xBoundary
      const points = []

      if (isBroken) {
        // Generate wavy sagging line when broken
        const segments = 15
        for (let i = 0; i <= segments; i++) {
          const t = i / segments
          const currX = xStart + (xEnd - xStart) * t
          // Wave pattern for loose string
          const wave = Math.sin(t * Math.PI * 4) * 0.02
          points.push(new THREE.Vector3(currX, 0.35 + y + wave, (Math.random() - 0.5) * 0.015))
        }
      } else {
        points.push(new THREE.Vector3(xStart, 0.35 + y, 0))
        points.push(new THREE.Vector3(xEnd, 0.35 + y, 0))
      }

      const stringGeo = new THREE.BufferGeometry().setFromPoints(points)
      const stringLine = new THREE.Line(stringGeo, stringMat)
      stringsGroup.add(stringLine)
    }

    // 3. T-Joint
    const jointGeo = new THREE.CylinderGeometry(0.015, 0.01, 0.06, 12)
    const jointMat = new THREE.MeshStandardMaterial({
      color: palette.frame2,
      roughness: 0.3,
      metalness: 0.7,
    })
    const joint = new THREE.Mesh(jointGeo, jointMat)
    joint.position.y = 0.35 - b
    proceduralRacketGroup.add(joint)

    // Joint brand decal rings
    const ringGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.01, 12)
    const ring = new THREE.Mesh(ringGeo, decalMat)
    ring.position.y = 0.35 - b - 0.01
    proceduralRacketGroup.add(ring)

    // 4. Shaft
    const shaftLength = 0.55
    const shaftGeo = new THREE.CylinderGeometry(0.008, 0.008, shaftLength, 12)
    const shaftMat = new THREE.MeshStandardMaterial({
      color: palette.shaft,
      roughness: 0.2,
      metalness: 0.9,
    })
    const shaft = new THREE.Mesh(shaftGeo, shaftMat)
    shaft.position.y = 0.35 - b - (shaftLength / 2)
    proceduralRacketGroup.add(shaft)

    // 5. Handle Cone
    const coneLength = 0.06
    const coneGeo = new THREE.CylinderGeometry(0.009, 0.018, coneLength, 12)
    const coneMat = new THREE.MeshStandardMaterial({
      color: palette.frame2,
      roughness: 0.4,
    })
    const cone = new THREE.Mesh(coneGeo, coneMat)
    cone.position.y = 0.35 - b - shaftLength - (coneLength / 2)
    proceduralRacketGroup.add(cone)

    // 6. Grip Handle
    const gripLength = 0.3
    const gripGeo = new THREE.CylinderGeometry(0.018, 0.018, gripLength, 8)
    const selectedGrip = gripColors.find(c => c.value === gripColor)
    const gripMat = new THREE.MeshStandardMaterial({
      color: selectedGrip ? selectedGrip.hex : 0x111827,
      roughness: 0.85,
      bumpScale: 0.05,
    })
    gripMaterialRef.current = gripMat
    const grip = new THREE.Mesh(gripGeo, gripMat)
    grip.position.y = 0.35 - b - shaftLength - coneLength - (gripLength / 2)
    proceduralRacketGroup.add(grip)

    // 7. Grip wraps
    const wrapCount = 14
    for (let i = 0; i < wrapCount; i++) {
      const wrapGeo = new THREE.CylinderGeometry(0.0185, 0.0185, 0.003, 8)
      const wrapMat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.2
      })
      const wrap = new THREE.Mesh(wrapGeo, wrapMat)
      wrap.position.y = grip.position.y + (gripLength / 2) - (i * (gripLength / wrapCount))
      wrap.rotation.z = 0.05
      proceduralRacketGroup.add(wrap)
    }

    // 8. Butt cap
    const capLength = 0.015
    const capGeo = new THREE.CylinderGeometry(0.02, 0.02, capLength, 8)
    const capMat = new THREE.MeshStandardMaterial({
      color: palette.frame1,
      roughness: 0.5,
    })
    const cap = new THREE.Mesh(capGeo, capMat)
    cap.position.y = grip.position.y - (gripLength / 2) - (capLength / 2)
    proceduralRacketGroup.add(cap)

    racketGroup.position.y = -0.1

    // Controls
    let isDragging = false
    let prevMousePos = { x: 0, y: 0 }
    const spinSpeedY = 0.005

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true
      prevMousePos = { x: e.clientX, y: e.clientY }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const dx = e.clientX - prevMousePos.x
      const dy = e.clientY - prevMousePos.y
      
      racketGroup.rotation.y += dx * 0.006
      racketGroup.rotation.x += dy * 0.006

      prevMousePos = { x: e.clientX, y: e.clientY }
    }

    const onMouseUp = () => {
      isDragging = false
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true
        prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return
      const dx = e.touches[0].clientX - prevMousePos.x
      const dy = e.touches[0].clientY - prevMousePos.y
      
      racketGroup.rotation.y += dx * 0.007
      racketGroup.rotation.x += dy * 0.007

      prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }

    container.addEventListener("mousedown", onMouseDown)
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    
    container.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    window.addEventListener("touchend", onMouseUp)

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      camera.position.z = Math.min(Math.max(camera.position.z + e.deltaY * 0.0018, 1.3), 3.5)
    }
    container.addEventListener("wheel", onWheel, { passive: false })

    const onResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    const resizeObserver = new ResizeObserver(() => onResize())
    resizeObserver.observe(container)

    let animFrameId: number
    const animate = () => {
      animFrameId = requestAnimationFrame(animate)

      if (!isDragging && autoRotate) {
        racketGroup.rotation.y += spinSpeedY
        racketGroup.rotation.x += (0.15 - racketGroup.rotation.x) * 0.02
      }

      // Camera shake decay effect
      if (shakeRef.current > 0.001) {
        camera.position.x = (Math.random() - 0.5) * shakeRef.current
        camera.position.y = (Math.random() - 0.5) * shakeRef.current
        shakeRef.current *= 0.85 // decay camera shake
      } else {
        camera.position.x = 0
        camera.position.y = 0
      }

      // Update floating specifications labels projection in screen space
      const tempV = new THREE.Vector3()
      const width = container.clientWidth
      const height = container.clientHeight

      // Width Label (Horizontal center of head)
      tempV.set(0, 0.35, 0.02)
      tempV.applyMatrix4(racketGroup.matrixWorld)
      tempV.project(camera)
      if (widthLabelRef.current) {
        const wx = (tempV.x * 0.5 + 0.5) * width
        const wy = (-(tempV.y * 0.5) + 0.5) * height
        widthLabelRef.current.style.left = `${wx}px`
        widthLabelRef.current.style.top = `${wy - 25}px`
        widthLabelRef.current.style.display = tempV.z <= 1 ? "flex" : "none"
      }

      // Height Label (Vertical center left)
      tempV.set(-a - 0.04, 0.35, 0.02)
      tempV.applyMatrix4(racketGroup.matrixWorld)
      tempV.project(camera)
      if (heightLabelRef.current) {
        const hx = (tempV.x * 0.5 + 0.5) * width
        const hy = (-(tempV.y * 0.5) + 0.5) * height
        heightLabelRef.current.style.left = `${hx - 50}px`
        heightLabelRef.current.style.top = `${hy}px`
        heightLabelRef.current.style.display = tempV.z <= 1 ? "flex" : "none"
      }

      // Total Length Label (Vertical center right)
      tempV.set(a + 0.04, -0.2, 0.02)
      tempV.applyMatrix4(racketGroup.matrixWorld)
      tempV.project(camera)
      if (totalLabelRef.current) {
        const tx = (tempV.x * 0.5 + 0.5) * width
        const ty = (-(tempV.y * 0.5) + 0.5) * height
        totalLabelRef.current.style.left = `${tx + 50}px`
        totalLabelRef.current.style.top = `${ty}px`
        totalLabelRef.current.style.display = tempV.z <= 1 ? "flex" : "none"
      }

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animFrameId)
      container.removeEventListener("mousedown", onMouseDown)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
      container.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onMouseUp)
      container.removeEventListener("wheel", onWheel)
      resizeObserver.disconnect()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
      scene.clear()
      renderer.dispose()
    }
  }, [palette.frame1, palette.frame2, palette.shaft, autoRotate, isBroken, maxTensionLimit])

  const handleApplySpecs = () => {
    setCustomized(true)
    toast.success("Đã áp dụng cấu hình đan vợt 3D!", {
      description: `Lưới: ${stringColors.find(c => c.value === stringColor)?.name} | Căng: ${tension} lbs | Cán: ${gripColors.find(c => c.value === gripColor)?.name}`,
    })
  }

  return (
    <div className="flex flex-col h-full bg-white text-slate-800 rounded-2xl overflow-hidden border border-slate-200 shadow-lg relative">
      
      {/* 3D Viewport */}
      <div className="flex-1 relative min-h-[280px] cursor-grab active:cursor-grabbing">
        
        {/* Canvas container */}
        <div ref={containerRef} className="w-full h-full absolute inset-0 bg-gradient-to-br from-slate-50 to-white" />

        {/* Floating 3D specifications labels */}
        {showSpecs && (
          <>
            <div
              ref={widthLabelRef}
              className="absolute bg-slate-900/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border border-slate-700 pointer-events-none whitespace-nowrap z-20 flex items-center gap-1 -translate-x-1/2 -translate-y-1/2"
            >
              <span>↔️ Rộng: 220 mm</span>
            </div>
            <div
              ref={heightLabelRef}
              className="absolute bg-slate-900/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border border-slate-700 pointer-events-none whitespace-nowrap z-20 flex items-center gap-1 -translate-x-1/2 -translate-y-1/2"
            >
              <span>↕️ Dài khung: 250 mm</span>
            </div>
            <div
              ref={totalLabelRef}
              className="absolute bg-slate-900/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border border-slate-700 pointer-events-none whitespace-nowrap z-20 flex items-center gap-1 -translate-x-1/2 -translate-y-1/2"
            >
              <span>📏 Chiều dài: 675 mm</span>
            </div>
          </>
        )}

        {/* 3D Mode Overlays */}
        <div className="absolute top-4 left-4 z-10 pointer-events-none space-y-1">
          {isBroken ? (
            <Badge className="bg-red-600 hover:bg-red-600 text-white border-red-500/20 backdrop-blur-sm px-2.5 py-1 animate-pulse flex items-center gap-1">
              ⚠️ KHUNG GÃY DO QUÁ CÂN!
            </Badge>
          ) : (
            <Badge className="bg-primary text-white border-primary/20 backdrop-blur-sm px-2.5 py-1">
              Chế độ 3D Review
            </Badge>
          )}
          <div className="text-[10px] text-slate-600 bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded border border-slate-200">
            {isBroken ? "Giảm sức căng đan cước để phục hồi" : "Dùng chuột/vuốt để xoay • Cuộn để phóng to"}
          </div>
        </div>

        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Button
            size="icon"
            variant="secondary"
            onClick={() => setShowSpecs(!showSpecs)}
            title="Hiển thị thông số"
            className={showSpecs 
              ? "bg-[#0ea5e9] text-white hover:bg-[#0ea5e9]/90" 
              : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm"}
          >
            <Ruler className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            onClick={() => setAutoRotate(!autoRotate)}
            title="Tự động xoay"
            className={autoRotate 
              ? "bg-primary text-white hover:bg-primary/90" 
              : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm"}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Floating customization info */}
        <div className="absolute bottom-4 left-4 z-10 bg-white/95 border border-slate-200 rounded-xl p-3 backdrop-blur-sm max-w-[200px] text-xs shadow-sm">
          <p className="font-bold text-slate-700 mb-1 flex items-center gap-1">
            <Hammer className="h-3.5 w-3.5 text-primary" /> Thông số căng lưới:
          </p>
          <div className="space-y-1 text-slate-500">
            <p>Màu lưới: <strong className="text-slate-800">{stringColors.find(c => c.value === stringColor)?.name}</strong></p>
            <p>Màu cuốn cán: <strong className="text-slate-800">{gripColors.find(c => c.value === gripColor)?.name}</strong></p>
            <p>Sức căng: <strong className={cn(isBroken ? "text-red-600 font-bold" : "text-primary")}>{tension} lbs</strong></p>
          </div>
        </div>
      </div>

      {/* Control panel at bottom - Compact Design */}
      <div className="bg-slate-50/80 border-t border-slate-200 p-3 space-y-3">
        
        {/* Colors Row */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* 1. String Color Swatches */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Màu cước đan</label>
              <span className="text-[10px] font-bold text-slate-700">{stringColors.find(c => c.value === stringColor)?.name}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {stringColors.map(c => (
                <button
                  key={c.value}
                  onClick={() => setStringColor(c.value)}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                  className={cn(
                    "h-6 w-6 rounded-full border transition-all hover:scale-110 active:scale-95 cursor-pointer relative",
                    stringColor === c.value
                      ? "border-primary ring-2 ring-primary/30 scale-105"
                      : "border-slate-300 hover:border-slate-400"
                  )}
                >
                  {stringColor === c.value && (
                    <span className={cn(
                      "absolute inset-0 m-auto h-1.5 w-1.5 rounded-full",
                      c.value === "white" || c.value === "yellow" ? "bg-slate-800" : "bg-white"
                    )} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Grip Color Swatches */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Màu cuốn cán</label>
              <span className="text-[10px] font-bold text-slate-700">{gripColors.find(c => c.value === gripColor)?.name}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {gripColors.map(c => (
                <button
                  key={c.value}
                  onClick={() => setGripColor(c.value)}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                  className={cn(
                    "h-6 w-6 rounded-full border transition-all hover:scale-110 active:scale-95 cursor-pointer relative",
                    gripColor === c.value
                      ? "border-primary ring-2 ring-primary/30 scale-105"
                      : "border-slate-300 hover:border-slate-400"
                  )}
                >
                  {gripColor === c.value && (
                    <span className={cn(
                      "absolute inset-0 m-auto h-1.5 w-1.5 rounded-full",
                      c.value === "white" || c.value === "yellow" ? "bg-slate-800" : "bg-white"
                    )} />
                  )}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* 3. Tension Level Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              Sức căng đan cước
              {isBroken && <span className="text-[9px] font-bold text-red-600 animate-pulse bg-red-50 px-1 py-0.5 rounded border border-red-200">Gãy Khung!</span>}
            </label>
            <span className={cn(
              "text-xs font-bold transition-colors",
              isBroken ? "text-red-600 font-extrabold" : "text-primary"
            )}>
              {tension} lbs (~{Math.round(tension * 0.4535)}kg) {isBroken ? "⚠️ (Quá tải)" : ""}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="20"
              max="32"
              value={tension}
              onChange={(e) => setTension(parseInt(e.target.value))}
              className={cn(
                "w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary",
                isBroken && "accent-red-600"
              )}
            />
            <span className="text-[10px] text-slate-400 shrink-0">MAX 32 (Tối đa vợt: {maxTensionLimit} lbs)</span>
          </div>
        </div>

        <Separator className="bg-slate-200" />

        {/* Footer info/actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 text-[11px]">
          <p className="text-slate-500 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-sky-500 shrink-0" />
            Vợt được đan trực tiếp tại cửa hàng bằng máy điện tử Victor chuyên dụng.
          </p>
          <Button
            size="sm"
            onClick={handleApplySpecs}
            className="w-full sm:w-auto h-8 text-[11px] bg-[#FF6B35] text-white hover:bg-[#e85a28] gap-1.5 font-semibold shadow-sm"
          >
            {customized ? <CheckCircle className="h-3.5 w-3.5" /> : <Hammer className="h-3.5 w-3.5" />}
            {customized ? "Đã lưu cấu hình đan" : "Áp dụng cấu hình đan"}
          </Button>
        </div>

      </div>

    </div>
  )
}
