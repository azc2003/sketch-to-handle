import { useMemo, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import useStore from '../store'
import { generateTubularHandle } from '../utils/tubularHandleGenerator'
import { sampleBezierSpline } from '../utils/bezierPath'

function HandleScene({ partView }) {
  const image = useStore(s => s.image)
  const curvePoints = useStore(s => s.curvePoints)

  const fabricationMode = useStore(s => s.fabricationMode)
  const smoothLevel = useStore(s => s.smoothLevel)
  const handleMode = useStore(s => s.handleMode)
  const handleHeightM = useStore(s => s.handleHeightM)
  const handleWidthScale = useStore(s => s.handleWidthScale)
  const padWidthScale = useStore(s => s.padWidthScale)
  const cupTopDiameterMm = useStore(s => s.cupTopDiameterMm)
  const cupBottomDiameterMm = useStore(s => s.cupBottomDiameterMm)
  const ringClearanceMm = useStore(s => s.ringClearanceMm)
  const ringWallThicknessMm = useStore(s => s.ringWallThicknessMm)
  const ringHeightMm = useStore(s => s.ringHeightMm)
  const platformMarginMm = useStore(s => s.platformMarginMm)
  const platformThicknessMm = useStore(s => s.platformThicknessMm)
  const jointClearanceMm = useStore(s => s.jointClearanceMm)
  const filledWeightG = useStore(s => s.filledWeightG)
  const targetSafetyFactor = useStore(s => s.targetSafetyFactor)

  const inputStroke = useMemo(() => {
    if (curvePoints.length < 2) return null
    return sampleBezierSpline(curvePoints, 36)
  }, [curvePoints])

  const result = useMemo(() => {
    if (!inputStroke || inputStroke.length < 2) return null
    try {
      return generateTubularHandle(inputStroke, {
        imageWidthPx: image?.width || 1000,
        imageHeightPx: image?.height || 1000,
        handleMode,
        handleHeightM,
        handleWidthScale,
        padWidthScale,
        cupTopDiameterMm,
        cupBottomDiameterMm,
        ringClearanceMm,
        ringWallThicknessMm,
        ringHeightMm,
        platformMarginMm,
        platformThicknessMm,
        jointClearanceMm,
        filledWeightG,
        targetSafetyFactor,
        smoothLevel,
      })
    } catch (e) {
      console.warn('Handle generation failed:', e.message)
      return null
    }
  }, [
    inputStroke,
    image,
    handleMode,
    handleHeightM,
    handleWidthScale,
    padWidthScale,
    cupTopDiameterMm,
    cupBottomDiameterMm,
    ringClearanceMm,
    ringWallThicknessMm,
    ringHeightMm,
    platformMarginMm,
    platformThicknessMm,
    jointClearanceMm,
    filledWeightG,
    targetSafetyFactor,
    smoothLevel,
  ])

  useEffect(() => {
    if (!result?.group) return
    result.group.traverse(child => {
      if (!child.isMesh) return
      const part = child.userData?.part
      if (fabricationMode === 'hybrid') {
        child.visible = (partView === 'assembly' || partView === 'handle') && part === 'handle'
        return
      }
      child.visible = partView === 'assembly' || part === partView
    })
  }, [result, partView, fabricationMode])

  useEffect(() => {
    if (result?.group) {
      const meshes = []
      result.group.traverse(child => {
        if (child.isMesh) meshes.push(child)
      })
      window.__handleMeshes = meshes
      window.__strengthReport = result.strengthReport
    } else {
      window.__handleMeshes = []
      window.__strengthReport = null
    }

    return () => {
      window.__handleMeshes = []
      window.__strengthReport = null
    }
  }, [result])

  if (!result) {
    return (
      <Html center>
        <div style={{ color: '#aaa', fontSize: 14, textAlign: 'center', userSelect: 'none' }}>
          Draw a handle curve on the photo
          <br />
          to generate a 3D handle
        </div>
      </Html>
    )
  }

  return (
    <>
      <primitive object={result.group} />
      <SleeveReference visible={fabricationMode === 'hybrid' && (partView === 'assembly' || partView === 'sleeve')} />
    </>
  )
}

function SleeveReference({ visible }) {
  const handleHeightM = useStore(s => s.handleHeightM)
  const cupTopDiameterMm = useStore(s => s.cupTopDiameterMm)
  const cupBottomDiameterMm = useStore(s => s.cupBottomDiameterMm)
  const sleeveStyle = useStore(s => s.sleeveStyle)
  const sleeveSlitAngleDeg = useStore(s => s.sleeveSlitAngleDeg)

  const group = useMemo(() => {
    const heightMm = Math.max(20, handleHeightM * 1000)
    const topRadiusMm = Math.max(1, cupTopDiameterMm * 0.5)
    const bottomRadiusMm = Math.max(1, cupBottomDiameterMm * 0.5)
    const maxRadiusMm = Math.max(topRadiusMm, bottomRadiusMm)
    const slitRad = THREE.MathUtils.degToRad(Math.max(0, sleeveSlitAngleDeg))
    const thetaLength = Math.max(THREE.MathUtils.degToRad(180), Math.PI * 2 - slitRad)

    const sleeveGroup = new THREE.Group()
    const sleeveGeo = new THREE.CylinderGeometry(
      topRadiusMm,
      bottomRadiusMm,
      heightMm,
      96,
      1,
      true,
      Math.PI / 2 + slitRad * 0.5,
      thetaLength,
    )
    const sleeveMat = new THREE.MeshStandardMaterial({
      color: 0x86D9C8,
      transparent: true,
      opacity: 0.34,
      roughness: 0.55,
      side: THREE.DoubleSide,
    })
    const sleeve = new THREE.Mesh(sleeveGeo, sleeveMat)
    sleeve.position.x = -maxRadiusMm
    sleeveGroup.add(sleeve)

    if (sleeveStyle === 'base') {
      const baseRadiusMm = bottomRadiusMm + 8
      const baseGeo = new THREE.CylinderGeometry(baseRadiusMm, baseRadiusMm, 4, 96)
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x90A4AE,
        transparent: true,
        opacity: 0.36,
        roughness: 0.6,
        side: THREE.DoubleSide,
      })
      const base = new THREE.Mesh(baseGeo, baseMat)
      base.position.set(-bottomRadiusMm, -heightMm * 0.5 - 3, 0)
      sleeveGroup.add(base)
    }

    return sleeveGroup
  }, [
    handleHeightM,
    cupTopDiameterMm,
    cupBottomDiameterMm,
    sleeveStyle,
    sleeveSlitAngleDeg,
  ])

  if (!visible) return null
  return <primitive object={group} />
}

export default function Preview3D() {
  const [view, setView] = useState('assembly')
  const fabricationMode = useStore(s => s.fabricationMode)

  useEffect(() => {
    if (fabricationMode === 'hybrid' && (view === 'topRing' || view === 'bottomPlatform')) {
      setView('assembly')
    }
  }, [fabricationMode, view])

  const tabBtn = (id, label) => (
    <button
      type="button"
      onClick={() => setView(id)}
      style={{
        padding: '4px 10px', fontSize: 11,
        border: '1px solid #bdbdbd', borderRadius: 6,
        background: view === id ? '#00BCD4' : '#fff',
        color: view === id ? '#fff' : '#333',
        cursor: 'pointer',
      }}
    >{label}</button>
  )

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 6, padding: '4px 6px', borderBottom: '1px solid #eee' }}>
        {tabBtn('assembly', 'Assembly')}
        {tabBtn('handle', 'Handle')}
        {fabricationMode === 'hybrid' && tabBtn('sleeve', 'Sleeve')}
        {fabricationMode !== 'hybrid' && tabBtn('topRing', 'Top Ring')}
        {fabricationMode !== 'hybrid' && tabBtn('bottomPlatform', 'Bottom Platform')}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Canvas camera={{ position: [0, 0, 200], fov: 50 }} style={{ width: '100%', height: '100%' }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[50, 80, 60]} intensity={1} />
          <HandleScene partView={view} />
          <OrbitControls makeDefault />
          <gridHelper args={[400, 40, '#ddd', '#eee']} rotation={[Math.PI / 2, 0, 0]} />
        </Canvas>
      </div>
    </div>
  )
}
