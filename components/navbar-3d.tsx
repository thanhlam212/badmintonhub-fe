"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

export function Navbar3DBackground() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.z = 15

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    // Particles
    const particleCount = 120
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)
    const initialPositions: { x: number; y: number; z: number; speedX: number; speedY: number; speedZ: number }[] = []

    const colorGreen = new THREE.Color("#4ADE80") // emerald mint
    const colorOrange = new THREE.Color("#FF6B35") // primary orange

    for (let i = 0; i < particleCount; i++) {
      // Random coordinates inside container boundaries (spread out)
      const x = (Math.random() - 0.5) * 35
      const y = (Math.random() - 0.5) * 12
      const z = (Math.random() - 0.5) * 10

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      // Speed
      initialPositions.push({
        x,
        y,
        z,
        speedX: (Math.random() - 0.5) * 0.015,
        speedY: (Math.random() - 0.5) * 0.015,
        speedZ: (Math.random() - 0.5) * 0.01,
      })

      // Color (mix of orange and green)
      const color = Math.random() > 0.5 ? colorGreen : colorOrange
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))

    // Material
    // Use canvas round texture to make particles soft circles
    const canvas = document.createElement("canvas")
    canvas.width = 16
    canvas.height = 16
    const ctx = canvas.getContext("2d")
    if (ctx) {
      const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8)
      gradient.addColorStop(0, "rgba(255,255,255,1)")
      gradient.addColorStop(1, "rgba(255,255,255,0)")
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 16, 16)
    }
    const texture = new THREE.CanvasTexture(canvas)

    const material = new THREE.PointsMaterial({
      size: 0.28,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      map: texture,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    const particles = new THREE.Points(geometry, material)
    scene.add(particles)

    // Mouse interactive coordinates
    let targetMouseX = 0
    let targetMouseY = 0
    let mouseX = 0
    let mouseY = 0

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate mouse position relative to container
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      targetMouseX = (x / rect.width - 0.5) * 10
      targetMouseY = -(y / rect.height - 0.5) * 4
    }

    window.addEventListener("mousemove", handleMouseMove)

    // Resize handler
    const handleResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    const resizeObserver = new ResizeObserver(() => handleResize())
    resizeObserver.observe(container)

    // Animation Loop
    let animationFrameId: number
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)

      // Interpolate mouse coordinates for smooth lag effect
      mouseX += (targetMouseX - mouseX) * 0.05
      mouseY += (targetMouseY - mouseY) * 0.05

      const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute
      const positionsArray = posAttr.array as Float32Array

      for (let i = 0; i < particleCount; i++) {
        // Retrieve initial settings
        const init = initialPositions[i]

        // Add gentle drift
        init.x += init.speedX
        init.y += init.speedY
        init.z += init.speedZ

        // Wrap boundaries
        if (init.x > 18) init.x = -18
        if (init.x < -18) init.x = 18
        if (init.y > 6) init.y = -6
        if (init.y < -6) init.y = 6

        // Gravitational attraction/push to mouse pointer
        const dx = mouseX - init.x
        const dy = mouseY - init.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        let pullX = 0
        let pullY = 0

        if (dist < 5) {
          const force = (5 - dist) * 0.03
          pullX = (dx / dist) * force
          pullY = (dy / dist) * force
        }

        // Apply back to vertex positions
        positionsArray[i * 3] = init.x + pullX
        positionsArray[i * 3 + 1] = init.y + pullY
        positionsArray[i * 3 + 2] = init.z
      }

      posAttr.needsUpdate = true

      // Slow overall rotation of the field
      particles.rotation.y += 0.0005
      particles.rotation.z += 0.0002

      renderer.render(scene, camera)
    }

    animate()

    // Clean up
    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener("mousemove", handleMouseMove)
      resizeObserver.disconnect()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
      geometry.dispose()
      material.dispose()
      texture.dispose()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none opacity-40 z-0"
    />
  )
}

export function Shuttlecock3D() {
  const canvasContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !canvasContainerRef.current) return

    const container = canvasContainerRef.current
    const size = 56 // 14rem/w-14 is 56px

    // Scene
    const scene = new THREE.Scene()

    // Camera
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.set(0, 0.2, 2.2)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(size, size)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(2, 4, 3)
    scene.add(dirLight)

    // Shuttlecock Group
    const shuttleGroup = new THREE.Group()
    scene.add(shuttleGroup)

    // 1. Cork Base (Half sphere)
    const baseGeo = new THREE.SphereGeometry(0.24, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2)
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.4,
      metalness: 0.1,
    })
    const base = new THREE.Mesh(baseGeo, baseMat)
    // Rotate to point downwards
    base.rotation.x = Math.PI
    base.position.y = -0.15
    shuttleGroup.add(base)

    // 2. Red Stripe/Band
    const stripeGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.03, 16)
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xe11d48, // red
      roughness: 0.5,
    })
    const stripe = new THREE.Mesh(stripeGeo, stripeMat)
    stripe.position.y = -0.13
    shuttleGroup.add(stripe)

    // 3. Feathers
    const featherCount = 14
    const baseRadius = 0.23
    const topRadius = 0.42
    const height = 0.5

    for (let i = 0; i < featherCount; i++) {
      const angle = (i / featherCount) * Math.PI * 2

      const x1 = Math.cos(angle) * baseRadius
      const z1 = Math.sin(angle) * baseRadius
      const y1 = -0.12

      const x2 = Math.cos(angle) * topRadius
      const z2 = Math.sin(angle) * topRadius
      const y2 = y1 + height

      // Shaft (Stem of the feather)
      const points = [new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)]
      const shaftGeo = new THREE.BufferGeometry().setFromPoints(points)
      const shaftMat = new THREE.LineBasicMaterial({ color: 0xdddddd, linewidth: 2 })
      const shaft = new THREE.Line(shaftGeo, shaftMat)
      shuttleGroup.add(shaft)

      // Vane (Feather blade at top)
      const vaneWidth = 0.07
      const vaneHeight = 0.22
      const vaneGeo = new THREE.PlaneGeometry(vaneWidth, vaneHeight)
      const vaneMat = new THREE.MeshStandardMaterial({
        color: 0xf5f5f5,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        roughness: 0.8,
      })
      const vane = new THREE.Mesh(vaneGeo, vaneMat)

      // Position vane on the top portion of the shaft
      const vanePos = new THREE.Vector3()
      vanePos.lerpVectors(points[0], points[1], 0.75) // 75% up the shaft
      vane.position.copy(vanePos)

      // Align vane with outer normal
      vane.lookAt(new THREE.Vector3(0, y2 + 0.5, 0))
      // Rotate slightly so they overlap like real feathers
      vane.rotation.y += 0.25

      shuttleGroup.add(vane)
    }

    // Interactive hovering state
    let isHovered = false
    let targetRotationX = 0
    let targetRotationY = 0
    let currentRotationX = 0
    let currentRotationY = 0

    const onMouseEnter = () => {
      isHovered = true
    }

    const onMouseLeave = () => {
      isHovered = false
      targetRotationX = 0
      targetRotationY = 0
    }

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left - rect.width / 2
      const y = e.clientY - rect.top - rect.height / 2
      targetRotationY = (x / rect.width) * 1.5
      targetRotationX = (y / rect.height) * 1.5
    }

    container.addEventListener("mouseenter", onMouseEnter)
    container.addEventListener("mouseleave", onMouseLeave)
    container.addEventListener("mousemove", onMouseMove)

    // Animation loop
    let animationFrameId: number
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)

      // Base idle rotation
      if (!isHovered) {
        shuttleGroup.rotation.y += 0.008
        shuttleGroup.rotation.x = Math.sin(Date.now() * 0.001) * 0.1
        shuttleGroup.position.y = Math.sin(Date.now() * 0.002) * 0.04
      } else {
        // Fast rotation on hover + tracking mouse
        shuttleGroup.rotation.y += 0.045
        shuttleGroup.position.y = Math.sin(Date.now() * 0.005) * 0.02
      }

      // Smooth tracking of mouse tilts
      currentRotationX += (targetRotationX - currentRotationX) * 0.1
      currentRotationY += (targetRotationY - currentRotationY) * 0.1

      shuttleGroup.rotation.x += currentRotationX * 0.1
      shuttleGroup.rotation.z = -currentRotationY * 0.3

      renderer.render(scene, camera)
    }

    animate()

    // Clean up
    return () => {
      cancelAnimationFrame(animationFrameId)
      if (container) {
        container.removeEventListener("mouseenter", onMouseEnter)
        container.removeEventListener("mouseleave", onMouseLeave)
        container.removeEventListener("mousemove", onMouseMove)
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement)
        }
      }
      scene.clear()
      renderer.dispose()
    }
  }, [])

  return (
    <div
      ref={canvasContainerRef}
      className="relative w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center cursor-pointer overflow-hidden z-10"
    />
  )
}
