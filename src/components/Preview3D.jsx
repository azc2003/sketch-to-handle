import { useMemo, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import useStore from '../store'
import { generateTubularHandle } from '../utils/tubularHandleGenerator'
import { sampleBezierSpline } from '../utils/bezierPath'

function HandleScene() {
  const image = useStore(s => s.image)
  const curvePoints = useStore(s => s.curvePoints)

  const smoothLevel = useStore(s => s.smoothLevel)
  const handleMode = useStore(s => s.handleMode)
  const handleHeightM = useStore(s => s.handleHeightM)
  const handleWidthScale = useStore(s => s.handleWidthScale)
  const handleDepthScale = useStore(s => s.handleDepthScale)
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
        handleDepthScale,
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
    handleDepthScale,
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

  const resultKey = useMemo(() => {
    const curveKey = curvePoints.map(p =>
      `${Number(p.x).toFixed(4)},${Number(p.y).toFixed(4)}`
    ).join(';')
    return [
      curveKey,
      image?.width || 1000,
      image?.height || 1000,
      handleMode,
      handleHeightM,
      handleWidthScale,
      handleDepthScale,
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
    ].join('|')
  }, [
    curvePoints,
    image,
    handleMode,
    handleHeightM,
    handleWidthScale,
    handleDepthScale,
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
    <primitive key={resultKey} object={result.group} />
  )
}

export default function Preview3D() {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas camera={{ position: [0, 0, 200], fov: 50 }} style={{ width: '100%', height: '100%' }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[50, 80, 60]} intensity={1} />
        <HandleScene />
        <OrbitControls makeDefault />
        <gridHelper args={[400, 40, '#ddd', '#eee']} rotation={[Math.PI / 2, 0, 0]} />
      </Canvas>
    </div>
  )
}
