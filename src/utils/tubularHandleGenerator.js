import * as THREE from 'three'
import { smoothPath } from './smoothPath'

// ─── Constants ───

const GRAVITY = 9.81
const MATERIAL_TENSILE_STRESS_PA = 25_000_000
const ADHESIVE_ALLOWABLE_SHEAR_PA = 180_000
const DEFAULT_TARGET_SAFETY_FACTOR = 5.0
const MIN_ENDPOINT_SPAN_MM = 20.0
const DEFAULT_HANDLE_MODE = 'tubular'

// ─── Vector helpers (flat [x, y, z] arrays) ───

function vec3Len(v) {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
}

function unit(v) {
  const n = vec3Len(v)
  if (n <= 1e-12) return [0, 0, 0]
  return [v[0] / n, v[1] / n, v[2] / n]
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function vecSub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function vecScale(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s]
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v))
}

/**
 * Linear interpolation (replacement for np.interp).
 * xp must be monotonically increasing.
 */
function interp1d(targets, xp, fp) {
  const result = new Float64Array(targets.length)
  let j = 0
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]
    if (t <= xp[0]) { result[i] = fp[0]; continue }
    if (t >= xp[xp.length - 1]) { result[i] = fp[fp.length - 1]; continue }
    while (j < xp.length - 2 && xp[j + 1] < t) j++
    const frac = (t - xp[j]) / (xp[j + 1] - xp[j])
    result[i] = fp[j] + frac * (fp[j + 1] - fp[j])
  }
  return result
}

// ─── Geometry helpers ───

/**
 * Auto-scale dimensions based on handle height.
 * Port of _auto_dimensions (app.py:84-91)
 */
export function autoDimensions(handleHeightMm) {
  const scale = clamp(handleHeightMm / 120.0, 0.55, 2.4)
  return {
    // Slightly denser sampling improves visual smoothness of the tube.
    resampleStepMm: Math.max(0.6, 1.15 * scale),
    baseGripRadiusMm: Math.max(3.2, 5.0 * scale),
    basePadThicknessMm: Math.max(2.4, 3.0 * scale),
  }
}

/**
 * Linear interpolation of cup diameter along height.
 * Port of _local_cup_diameter_mm (app.py:94-96)
 */
function localCupDiameterMm(cupTopDiameterMm, cupBottomDiameterMm, y01) {
  const t = clamp(y01, 0.0, 1.0)
  return cupTopDiameterMm + (cupBottomDiameterMm - cupTopDiameterMm) * t
}

/**
 * Convert 2D normalized canvas points to 3D handle path.
 * Port of _normalize_points (app.py:49-74)
 *
 * @param {Array} rawPoints - [[x01, y01], ...] normalized 0-1
 * @param {number} imageWidthPx
 * @param {number} imageHeightPx
 * @param {number} mmPerPixel
 * @returns {Array} [[x, 0, z], ...] in mm
 */
export function normalizePoints(rawPoints, imageWidthPx, imageHeightPx, mmPerPixel) {
  if (rawPoints.length < 2) throw new Error('Need at least 2 points')

  const n = rawPoints.length

  const mmPerPx = Math.max(0.001, mmPerPixel)

  // Z uses image pixel vertical scale directly.
  const zMm = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    zMm[i] = (0.5 - rawPoints[i][1]) * imageHeightPx * mmPerPx
  }

  // X = lateral deviation from baseline, scaled with the same mm/px.
  const xRel = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const baseline = rawPoints[0][0] + (rawPoints[n - 1][0] - rawPoints[0][0]) * t
    xRel[i] = (rawPoints[i][0] - baseline) * imageWidthPx
  }

  let maxAbs = 0
  for (let i = 0; i < n; i++) maxAbs = Math.max(maxAbs, Math.abs(xRel[i]))
  if (maxAbs <= 1e-5) throw new Error('Curve has no horizontal variation; please draw a curved handle')

  // Ensure positive deviation
  let mean = 0
  for (let i = 0; i < n; i++) mean += xRel[i]
  if (mean < 0) for (let i = 0; i < n; i++) xRel[i] = -xRel[i]

  const result = []
  for (let i = 0; i < n; i++) {
    let xMm = xRel[i] * mmPerPx
    if (i === 0 || i === n - 1) xMm = 0
    result.push([xMm, 0, zMm[i]])
  }

  return result
}

/**
 * Convert a polyline centerline to a smooth curve before arc-length resampling.
 * This removes visible "kinks" from sparse hand-drawn control points.
 */
export function smoothCenterline3D(points, smoothLevel = 3) {
  if (!points || points.length < 3) return points

  const level = clamp(Number.isFinite(smoothLevel) ? smoothLevel : 3, 1, 10)
  const vectors = points.map(p => new THREE.Vector3(p[0], p[1], p[2]))
  const curve = new THREE.CatmullRomCurve3(vectors, false, 'centripetal', 0.5)

  const perSpanSamples = 4 + Math.floor(level * 1.2) // 5..16
  const sampleCount = Math.min(
    Math.max((points.length - 1) * perSpanSamples, points.length),
    1200
  )

  const sampled = curve.getPoints(sampleCount)
  const result = sampled.map(v => [v.x, v.y, v.z])

  // Preserve exact anchors and keep radial offset outside cup wall.
  result[0] = [...points[0]]
  result[result.length - 1] = [...points[points.length - 1]]
  for (let i = 1; i < result.length - 1; i++) {
    result[i][0] = Math.max(0, result[i][0])
  }

  return result
}

/**
 * Resample a 3D polyline at equal arc-length steps.
 * Port of _resample_polyline_3d (app.py:24-46)
 */
export function resamplePolyline3D(points, stepMm) {
  if (points.length < 2) throw new Error('Need at least 2 points')

  // Cumulative arc lengths
  const cumLen = [0]
  for (let i = 1; i < points.length; i++) {
    const d = vec3Len(vecSub(points[i], points[i - 1]))
    cumLen.push(cumLen[i - 1] + d)
  }
  const totalLen = cumLen[cumLen.length - 1]
  if (totalLen <= 1e-6) throw new Error('The drawn line is too short')
  if (totalLen <= stepMm) return points.slice()

  // Generate target distances
  const targets = []
  for (let d = 0; d < totalLen; d += stepMm) targets.push(d)
  if (targets[targets.length - 1] !== totalLen) targets.push(totalLen)

  // Extract x, y, z channels
  const px = points.map(p => p[0])
  const py = points.map(p => p[1])
  const pz = points.map(p => p[2])

  const tArr = new Float64Array(targets)
  const rx = interp1d(tArr, cumLen, px)
  const ry = interp1d(tArr, cumLen, py)
  const rz = interp1d(tArr, cumLen, pz)

  const result = []
  for (let i = 0; i < targets.length; i++) {
    result.push([rx[i], ry[i], rz[i]])
  }
  return result
}

/**
 * Smooth radius profile along path: thick at roots, thin at grip.
 * Port of _radius_profile_along_path (app.py:99-109)
 */
function radiusProfileAlongPath(pathPoints, gripRadiusMm, rootRadiusMm) {
  const n = pathPoints.length
  const segLengths = []
  for (let i = 1; i < n; i++) {
    segLengths.push(vec3Len(vecSub(pathPoints[i], pathPoints[i - 1])))
  }
  const totalLen = segLengths.reduce((a, b) => a + b, 0)
  if (totalLen <= 1e-9) return new Float64Array(n).fill(rootRadiusMm)

  const cumLen = [0]
  for (let i = 0; i < segLengths.length; i++) cumLen.push(cumLen[i] + segLengths[i])

  const radii = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const t = cumLen[i] / totalLen
    const edge = Math.abs(t - 0.5) / 0.5
    const blend = Math.pow(edge, 1.6)
    radii[i] = gripRadiusMm + (rootRadiusMm - gripRadiusMm) * blend
  }
  return radii
}

// ─── Mechanical Design ───

/**
 * Compute mechanical design parameters and safety factors.
 * Port of _compute_mechanical_design (app.py:112-225)
 */
export function computeMechanicalDesign(
  pathPoints, rawPoints, handleHeightMm,
  cupTopDiameterMm, cupBottomDiameterMm,
  filledWeightG, targetSafetyFactor, baseDims,
  handleWidthScale = 1.0, padWidthScale = 1.0,
  supportParams = {},
) {
  const safeHandleWidthScale = clamp(Number(handleWidthScale) || 1.0, 0.5, 2.8)
  const safePadWidthScale = clamp(Number(padWidthScale) || 1.0, 0.5, 2.8)
  const ringClearanceMm = clamp(Number(supportParams.ringClearanceMm) || 0, 0, 10)
  const ringWallThicknessMm = clamp(Number(supportParams.ringWallThicknessMm) || 4, 1.5, 20)
  const ringHeightMm = clamp(Number(supportParams.ringHeightMm) || 8, 2, 40)
  const platformMarginMm = clamp(Number(supportParams.platformMarginMm) || 0, 0, 40)
  const platformThicknessMm = clamp(Number(supportParams.platformThicknessMm) || 5, 1.5, 30)
  const jointClearanceMm = clamp(Number(supportParams.jointClearanceMm) || 0.25, 0.05, 0.8)

  const massKg = filledWeightG / 1000.0
  const leverArmMm = Math.max(Math.max(...pathPoints.map(p => p[0])), 6.0)
  const endpointSpanMm = Math.max(
    Math.abs(pathPoints[pathPoints.length - 1][2] - pathPoints[0][2]),
    MIN_ENDPOINT_SPAN_MM
  )
  const spanM = endpointSpanMm / 1000.0

  // Segment lengths and total path length
  let pathLengthMm = 0
  for (let i = 1; i < pathPoints.length; i++) {
    pathLengthMm += vec3Len(vecSub(pathPoints[i], pathPoints[i - 1]))
  }

  const nominalForceN = massKg * GRAVITY
  const nominalMomentNm = nominalForceN * (leverArmMm / 1000.0)

  // Required root radius from bending stress
  let requiredRootRadiusM = 0
  if (nominalMomentNm > 1e-12) {
    requiredRootRadiusM = Math.pow(
      (4.0 * targetSafetyFactor * nominalMomentNm) / (Math.PI * MATERIAL_TENSILE_STRESS_PA),
      1.0 / 3.0
    )
  }

  const gripRadiusMm = Math.max(2.6, baseDims.baseGripRadiusMm * safeHandleWidthScale)
  const rootRadiusMm = Math.max(requiredRootRadiusM * 1000.0, gripRadiusMm * 1.12)
  const tubeRadiiMm = radiusProfileAlongPath(pathPoints, gripRadiusMm, rootRadiusMm)

  // Structural safety factor
  const rootActualRadiusM = Math.min(tubeRadiiMm[0], tubeRadiiMm[tubeRadiiMm.length - 1]) / 1000.0
  let structuralSf = 999.0
  if (nominalMomentNm > 1e-12) {
    structuralSf = (Math.PI * MATERIAL_TENSILE_STRESS_PA * Math.pow(rootActualRadiusM, 3)) /
      (4.0 * nominalMomentNm)
  }

  // Local cup diameters at endpoints
  const endpointY = [rawPoints[0][1], rawPoints[rawPoints.length - 1][1]]
  const localDiametersMm = [
    localCupDiameterMm(cupTopDiameterMm, cupBottomDiameterMm, endpointY[0]),
    localCupDiameterMm(cupTopDiameterMm, cupBottomDiameterMm, endpointY[1]),
  ]

  // Per-pad force (combined vertical + moment)
  const momentArmTermN = nominalMomentNm / spanM
  const perPadNominalForceN = Math.sqrt(
    Math.pow(nominalForceN * 0.5, 2) + Math.pow(momentArmTermN, 2)
  )

  // Required pad area
  let requiredPadAreaM2 = 0
  if (perPadNominalForceN > 1e-12) {
    requiredPadAreaM2 = (targetSafetyFactor * perPadNominalForceN) / ADHESIVE_ALLOWABLE_SHEAR_PA
  }
  const requiredPadDiameterMm = 2.0 * Math.sqrt((requiredPadAreaM2 * 1_000_000.0) / Math.PI)

  const scale = clamp(handleHeightMm / 120.0, 0.55, 2.4)
  const basePadDiameterMm = Math.max(rootRadiusMm * 4.0, 16.0 * scale)
  const autoPadDiameterMm = Math.max(requiredPadDiameterMm, basePadDiameterMm)
  const idealPadDiameterMm = Math.max(8.0, autoPadDiameterMm * safePadWidthScale)

  const curvatureFitLimitMm = Math.min(...localDiametersMm) * 0.88
  const padDiameterMm = Math.min(idealPadDiameterMm, curvatureFitLimitMm)
  const curvatureLimited = idealPadDiameterMm > padDiameterMm + 1e-6

  const padThicknessMm = Math.max(baseDims.basePadThicknessMm, 0.42 * rootRadiusMm)
  const padAreaEachMm2 = Math.PI * Math.pow(padDiameterMm * 0.5, 2)
  const areaEachPadM2 = padAreaEachMm2 / 1_000_000.0
  const perPadCapacityN = ADHESIVE_ALLOWABLE_SHEAR_PA * areaEachPadM2

  let adhesiveSf = 999.0
  if (perPadNominalForceN > 1e-12) {
    adhesiveSf = perPadCapacityN / perPadNominalForceN
  }

  const topRingInnerDiameterMm = Math.max(1, cupTopDiameterMm + ringClearanceMm)
  const topRingOuterDiameterMm = topRingInnerDiameterMm + 2 * ringWallThicknessMm
  const bottomPlatformDiameterMm = Math.max(1, cupBottomDiameterMm + 2 * platformMarginMm)

  const supportBearingAreaMm2 = Math.PI * (
    Math.pow(bottomPlatformDiameterMm * 0.5, 2) -
    Math.pow(cupBottomDiameterMm * 0.5, 2)
  )
  const ringSectionAreaMm2 = Math.max(1, ringWallThicknessMm * ringHeightMm)
  const supportCapacityN = Math.max(
    1,
    (supportBearingAreaMm2 * 0.08) + (ringSectionAreaMm2 * 0.35)
  )
  const supportLoadN = Math.max(nominalForceN + momentArmTermN * 0.35, 1e-6)
  const supportSf = supportCapacityN / supportLoadN

  const minimumSf = Math.min(structuralSf, supportSf)

  const cupCurvatureRadiiMm = localDiametersMm.map(d =>
    Math.max(d * 0.5, padDiameterMm * 0.55)
  )

  // Notes
  const notes = []
  if (curvatureLimited) notes.push('Attachment root sizing is constrained by local cup fit.')
  if (structuralSf < targetSafetyFactor) notes.push('Handle root section is below target safety factor.')
  if (supportSf < targetSafetyFactor) notes.push('Ring and base support estimate is below target safety factor.')
  if (endpointSpanMm < 28.0) notes.push('Vertical distance between ring and base is small; torque load increases.')
  if ((rootRadiusMm / Math.max(gripRadiusMm, 1e-6)) > 1.85) notes.push('Root is much thicker than grip area; handle comfort may decrease.')
  if (pathLengthMm < 0.34 * handleHeightMm) notes.push('Handle path is short relative to handle height; gripping space may be limited.')
  if (ringClearanceMm < 0.75) notes.push('Top ring clearance is tight; add room for print tolerance or silicone padding.')
  if (platformMarginMm < 3) notes.push('Bottom platform margin is small; cup stability may be sensitive to placement.')

  return {
    tubeRadiiMm,
    gripRadiusMm,
    rootRadiusMm,
    padDiameterMm,
    padThicknessMm,
    cupCurvatureRadiiMm,
    localDiametersMm,
    cupTopDiameterMm,
    cupBottomDiameterMm,
    leverArmMm,
    endpointSpanMm,
    structuralSf,
    adhesiveSf,
    supportSf,
    minimumSf,
    targetSafetyFactor,
    pathLengthMm,
    padAreaEachMm2,
    padAreaTotalMm2: padAreaEachMm2 * 2.0,
    notes,
    curvatureLimited,
    topRingInnerDiameterMm,
    topRingOuterDiameterMm,
    ringClearanceMm,
    ringWallThicknessMm,
    ringHeightMm,
    bottomPlatformDiameterMm,
    platformMarginMm,
    platformThicknessMm,
    supportBearingAreaMm2,
    jointClearanceMm,
  }
}

// ─── Mesh Generation ───

/**
 * Build a tube mesh with varying radius along a 3D path.
 * Port of _build_tube_mesh (app.py:228-297)
 *
 * @returns {THREE.BufferGeometry}
 */
function buildFoldableCrossSectionShape({
  webWidthMm,
  sideWallWidthMm,
  flapWidthMm,
  hingeBandMm,
  panelThicknessMm,
  hingeThicknessMm,
}) {
  const tFull = Math.max(0.8, panelThicknessMm)
  // Living hinge: must be genuinely thin (0.3-0.5mm) to allow folding
  const tHinge = clamp(hingeThicknessMm, 0.25, 0.5)
  const halfWeb = webWidthMm * 0.5

  // Layout: flap | hinge | sideWall | hinge | web | hinge | sideWall | hinge | flap
  const u0 = -(halfWeb + hingeBandMm + sideWallWidthMm + hingeBandMm + flapWidthMm)
  const u1 = u0 + flapWidthMm
  const u2 = u1 + hingeBandMm
  const u3 = u2 + sideWallWidthMm
  const u4 = u3 + hingeBandMm
  const u5 = u4 + webWidthMm
  const u6 = u5 + hingeBandMm
  const u7 = u6 + sideWallWidthMm
  const u8 = u7 + hingeBandMm
  const u9 = u8 + flapWidthMm

  // Bottom-aligned: panels sit on y=0, hinges are notched from the top
  const points = [
    [u0, 0],
    [u0, tFull],
    [u1, tFull],
    [u1, tHinge],    // hinge notch (drop to thin)
    [u2, tHinge],
    [u2, tFull],
    [u3, tFull],
    [u3, tHinge],
    [u4, tHinge],
    [u4, tFull],
    [u5, tFull],
    [u5, tHinge],
    [u6, tHinge],
    [u6, tFull],
    [u7, tFull],
    [u7, tHinge],
    [u8, tHinge],
    [u8, tFull],
    [u9, tFull],
    [u9, 0],
  ]

  const shape = new THREE.Shape()
  shape.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i][0], points[i][1])
  }
  shape.closePath()
  return shape
}

function buildFoldableBlankMesh(pathPoints, foldSpec) {
  const curvePoints = pathPoints.map(p => new THREE.Vector3(p[0], 0, p[2]))
  const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'centripetal', 0.5)
  const profileShape = buildFoldableCrossSectionShape(foldSpec)

  const steps = Math.max(24, Math.min(pathPoints.length * 2, 540))
  const geo = new THREE.ExtrudeGeometry(profileShape, {
    steps,
    bevelEnabled: false,
    extrudePath: curve,
  })
  geo.computeVertexNormals()
  return geo
}

function buildFlatPadDiskMesh(endpoint, padRadiusMm, padThicknessMm, radialSegments = 48) {
  const seg = Math.max(24, radialSegments)
  const geo = new THREE.CylinderGeometry(padRadiusMm, padRadiusMm, padThicknessMm, seg)
  geo.translate(endpoint[0], padThicknessMm * 0.5, endpoint[2])
  return geo
}

function tagPart(mesh, part) {
  mesh.userData.part = part
  return mesh
}

function buildDovetailSpec(design) {
  const rootDiameterMm = design.rootRadiusMm * 2
  const maleNeckWidthMm = Math.max(rootDiameterMm * 1.25, 10)
  const maleHeadWidthMm = maleNeckWidthMm + Math.max(4, design.ringWallThicknessMm * 0.8)
  const heightMm = Math.max(rootDiameterMm * 1.45, 10)
  const depthMm = clamp(design.ringWallThicknessMm * 3.2, 11, 15)
  const clearanceMm = clamp(design.jointClearanceMm ?? 0.25, 0.05, 0.8)

  return {
    maleNeckWidthMm,
    maleHeadWidthMm,
    heightMm,
    depthMm,
    clearanceMm,
    femaleNeckWidthMm: maleNeckWidthMm + clearanceMm * 2,
    femaleHeadWidthMm: maleHeadWidthMm + clearanceMm * 2,
    femaleHeightMm: heightMm + clearanceMm * 2,
    railWallMm: Math.max(2.2, design.ringWallThicknessMm * 0.55),
    backPlateMm: Math.max(2, design.ringWallThicknessMm * 0.45),
  }
}

function buildDovetailTenonMesh(endpoint, spec, material, connectorOuterEndX) {
  const outerEndX = Number.isFinite(connectorOuterEndX) ? Math.max(spec.depthMm, connectorOuterEndX) : spec.depthMm
  const halfNeck = spec.maleNeckWidthMm * 0.5
  const halfHead = spec.maleHeadWidthMm * 0.5
  const halfHeight = spec.heightMm * 0.5

  const x0 = outerEndX - spec.depthMm
  const x1 = outerEndX
  const z0 = endpoint[2] - halfHeight
  const z1 = endpoint[2] + halfHeight
  const profile = [
    [-halfNeck, z0],
    [halfNeck, z0],
    [halfHead, z1],
    [-halfHead, z1],
  ]

  const vertices = []
  for (const x of [x0, x1]) {
    for (const [y, z] of profile) vertices.push(x, y, z)
  }

  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0,
  ]

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return tagPart(new THREE.Mesh(geo, material), 'handle')
}

function buildDovetailReceiverMesh(endpoint, spec, material, part, connectorOuterEndX, bodyOutsideEdgeX = connectorOuterEndX) {
  const outerEndX = Number.isFinite(connectorOuterEndX) ? Math.max(spec.depthMm, connectorOuterEndX) : spec.depthMm
  const slotStartX = outerEndX - spec.depthMm
  const bodyEdgeX = Number.isFinite(bodyOutsideEdgeX) ? Math.max(0, bodyOutsideEdgeX) : slotStartX
  const embedMm = Math.max(2.5, spec.railWallMm, slotStartX - bodyEdgeX + 2.0)
  const receiverStartX = Math.max(0, slotStartX - embedMm)
  const receiverDepthMm = outerEndX - receiverStartX
  const halfOuterWidth = spec.femaleHeadWidthMm * 0.5 + spec.railWallMm
  const halfOuterHeight = spec.femaleHeightMm * 0.5 + spec.railWallMm
  const halfSlotNeck = spec.femaleNeckWidthMm * 0.5
  const halfSlotHead = spec.femaleHeadWidthMm * 0.5
  const halfSlotHeight = spec.femaleHeightMm * 0.5

  const shape = new THREE.Shape()
  shape.moveTo(-halfOuterWidth, -halfOuterHeight)
  shape.lineTo(halfOuterWidth, -halfOuterHeight)
  shape.lineTo(halfOuterWidth, halfOuterHeight)
  shape.lineTo(-halfOuterWidth, halfOuterHeight)
  shape.closePath()

  const slot = new THREE.Path()
  slot.moveTo(-halfSlotNeck, -halfSlotHeight)
  slot.lineTo(halfSlotNeck, -halfSlotHeight)
  slot.lineTo(halfSlotHead, halfSlotHeight)
  slot.lineTo(-halfSlotHead, halfSlotHeight)
  slot.closePath()
  shape.holes.push(slot)

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: receiverDepthMm,
    steps: 1,
    bevelEnabled: false,
  })
  geo.applyMatrix4(new THREE.Matrix4().set(
    0, 0, 1, receiverStartX,
    1, 0, 0, 0,
    0, 1, 0, endpoint[2],
    0, 0, 0, 1
  ))
  geo.computeVertexNormals()

  const group = new THREE.Group()
  group.userData.part = part
  group.add(tagPart(new THREE.Mesh(geo, material), part))

  const capThicknessMm = Math.max(1.2, spec.backPlateMm)
  const capGeo = new THREE.BoxGeometry(
    capThicknessMm,
    halfOuterWidth * 2,
    halfOuterHeight * 2
  )
  capGeo.translate(receiverStartX - capThicknessMm * 0.5, 0, endpoint[2])
  group.add(tagPart(new THREE.Mesh(capGeo, material), part))

  return group
}

function buildTopSupportRingMesh(endpoint, design, radialSegments = 96) {
  const innerRadiusMm = design.topRingInnerDiameterMm * 0.5
  const outerRadiusMm = design.topRingOuterDiameterMm * 0.5
  const heightMm = design.ringHeightMm
  const centerX = -innerRadiusMm
  const centerY = 0

  const shape = new THREE.Shape()
  shape.absarc(centerX, centerY, outerRadiusMm, 0, Math.PI * 2, false)

  const innerHole = new THREE.Path()
  innerHole.absarc(centerX, centerY, innerRadiusMm, 0, Math.PI * 2, true)
  shape.holes.push(innerHole)

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: heightMm,
    steps: 1,
    curveSegments: Math.max(32, radialSegments),
    bevelEnabled: false,
  })
  geo.translate(0, 0, endpoint[2] - heightMm * 0.5)
  geo.computeVertexNormals()
  return geo
}

function buildBottomPlatformMesh(endpoint, design, radialSegments = 96) {
  const cupRadiusMm = Math.max(1, design.cupBottomDiameterMm * 0.5)
  const platformRadiusMm = design.bottomPlatformDiameterMm * 0.5
  const thicknessMm = design.platformThicknessMm

  const geo = new THREE.CylinderGeometry(
    platformRadiusMm,
    platformRadiusMm,
    thicknessMm,
    Math.max(32, radialSegments)
  )
  geo.rotateX(Math.PI / 2)
  geo.translate(-cupRadiusMm, 0, endpoint[2] - thicknessMm * 0.5)
  geo.computeVertexNormals()
  return geo
}

function buildFoldableAssembly(pathPoints, design) {
  // Thinner panels for realistic folding
  const panelThicknessMm = clamp(design.gripRadiusMm * 0.35, 1.5, 2.5)
  // Living hinge: 0.3-0.45mm is the sweet spot for PETG/PP
  const hingeThicknessMm = clamp(panelThicknessMm * 0.18, 0.3, 0.45)
  // Wider hinge band = easier to bend
  const hingeBandMm = clamp(panelThicknessMm * 1.2, 2.0, 4.0)
  const webWidthMm = Math.max(design.gripRadiusMm * 2.0, 8.0)
  const sideWallWidthMm = Math.max(design.gripRadiusMm * 1.6, 6.0)
  const flapWidthMm = Math.max(webWidthMm * 0.5, design.gripRadiusMm * 1.0)

  const foldedOuterWidthMm = webWidthMm + panelThicknessMm * 2
  const foldedOuterHeightMm = sideWallWidthMm + panelThicknessMm * 2

  const foldSpec = {
    webWidthMm,
    sideWallWidthMm,
    flapWidthMm,
    hingeBandMm,
    panelThicknessMm,
    hingeThicknessMm,
    foldedOuterWidthMm,
    foldedOuterHeightMm,
  }

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xE0E0E0, side: THREE.FrontSide, roughness: 0.38, metalness: 0.08,
  })

  const group = new THREE.Group()

  const blankGeo = buildFoldableBlankMesh(pathPoints, foldSpec)
  group.add(new THREE.Mesh(blankGeo, bodyMat))

  const padRadiusMm = design.padDiameterMm * 0.5
  const padThicknessMm = Math.max(panelThicknessMm, design.padThicknessMm * 0.72)
  const endpoints = [pathPoints[0], pathPoints[pathPoints.length - 1]]
  for (let i = 0; i < endpoints.length; i++) {
    const padGeo = buildFlatPadDiskMesh(endpoints[i], padRadiusMm, padThicknessMm)
    group.add(new THREE.Mesh(padGeo, bodyMat))
  }

  return { group, foldSpec }
}

function applyFoldableSafetyPenalty(design, foldSpec) {
  const hingeRatio = clamp(
    foldSpec.hingeThicknessMm / Math.max(foldSpec.panelThicknessMm, 1e-6),
    0.1,
    1.0
  )
  // Thinner hinges = bigger penalty
  const foldPenalty = clamp(0.45 + hingeRatio * 0.45, 0.35, 0.85)
  const structuralSf = design.structuralSf * foldPenalty
  return {
    ...design,
    structuralSf,
    minimumSf: Math.min(structuralSf, design.adhesiveSf),
  }
}

export function buildTubeMesh(pathPoints, radiiMm, sections = 40, capEnds = true) {
  const n = pathPoints.length
  if (n < 2) throw new Error('Need at least 2 points for tube')

  // Compute tangents — endpoints hardcoded to [1,0,0] (perpendicular to cup wall)
  // so pad and tube cross-sections align at attachment points.
  // Matches reference: app.py:234-236
  const tangents = []
  if (n === 2) {
    const dir = unit(vecSub(pathPoints[1], pathPoints[0]))
    tangents[0] = dir
    tangents[1] = dir
  } else {
    tangents[0] = unit(vecSub(pathPoints[1], pathPoints[0]))
    tangents[n - 1] = unit(vecSub(pathPoints[n - 1], pathPoints[n - 2]))
    for (let i = 1; i < n - 1; i++) {
      tangents[i] = unit(vecSub(pathPoints[i + 1], pathPoints[i - 1]))
    }
  }

  const angles = new Float64Array(sections)
  for (let j = 0; j < sections; j++) {
    angles[j] = (2.0 * Math.PI * j) / sections
  }
  const cosA = angles.map(Math.cos)
  const sinA = angles.map(Math.sin)

  // Build vertex rings with parallel transport frame
  const vertices = [] // flat [x, y, z, x, y, z, ...]
  let prevNormal = null

  for (let i = 0; i < n; i++) {
    const p = pathPoints[i]
    let t = tangents[i]
    if (vec3Len(t) <= 1e-12) t = [0, 0, 1]

    let normal
    if (prevNormal === null) {
      let ref = [0, 1, 0]
      if (Math.abs(dot(ref, t)) > 0.9) ref = [0, 0, 1]
      normal = unit(cross(t, ref))
    } else {
      // Project previous normal onto plane perpendicular to t
      normal = vecSub(prevNormal, vecScale(t, dot(prevNormal, t)))
      if (vec3Len(normal) <= 1e-10) {
        let ref = [0, 1, 0]
        if (Math.abs(dot(ref, t)) > 0.9) ref = [0, 0, 1]
        normal = unit(cross(t, ref))
      } else {
        normal = unit(normal)
      }
    }
    const binormal = unit(cross(t, normal))
    prevNormal = normal

    const r = radiiMm[i]
    for (let j = 0; j < sections; j++) {
      vertices.push(
        p[0] + r * (cosA[j] * normal[0] + sinA[j] * binormal[0]),
        p[1] + r * (cosA[j] * normal[1] + sinA[j] * binormal[1]),
        p[2] + r * (cosA[j] * normal[2] + sinA[j] * binormal[2]),
      )
    }
  }

  // Faces (index buffer)
  const indices = []

  // Side faces: connect adjacent rings
  for (let i = 0; i < n - 1; i++) {
    const base0 = i * sections
    const base1 = (i + 1) * sections
    for (let j = 0; j < sections; j++) {
      const j1 = (j + 1) % sections
      const a = base0 + j
      const b = base0 + j1
      const c = base1 + j
      const d = base1 + j1
      // Winding order chosen for outward-facing normals.
      indices.push(a, b, c)
      indices.push(b, d, c)
    }
  }

  // No end caps — pads cover the tube ends at attachment points

  if (capEnds) {
    const startCenterIdx = vertices.length / 3
    const startInset = Math.max(0.15, radiiMm[0] * 0.07)
    vertices.push(
      pathPoints[0][0] + tangents[0][0] * startInset,
      pathPoints[0][1] + tangents[0][1] * startInset,
      pathPoints[0][2] + tangents[0][2] * startInset,
    )

    const endCenterIdx = vertices.length / 3
    const endInset = Math.max(0.15, radiiMm[n - 1] * 0.07)
    vertices.push(
      pathPoints[n - 1][0] - tangents[n - 1][0] * endInset,
      pathPoints[n - 1][1] - tangents[n - 1][1] * endInset,
      pathPoints[n - 1][2] - tangents[n - 1][2] * endInset,
    )

    const startBase = 0
    const endBase = (n - 1) * sections
    for (let j = 0; j < sections; j++) {
      const j1 = (j + 1) % sections
      indices.push(startCenterIdx, startBase + j1, startBase + j)
      indices.push(endCenterIdx, endBase + j, endBase + j1)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(vertices), 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/**
 * Build a curved adhesive pad mesh that conforms to cup surface.
 * Port of _build_curved_pad_mesh (app.py:300-374)
 *
 * @returns {THREE.BufferGeometry}
 */
export function buildCurvedPadMesh(
  endpoint, padRadiusMm, padThicknessMm, cupRadiusMm,
  radialSteps = 8, angularSteps = 56
) {
  const ringCount = Math.max(3, radialSteps)
  const sec = Math.max(24, angularSteps)
  cupRadiusMm = Math.max(cupRadiusMm, padRadiusMm * 0.6 + 1.0)

  const vertices = [] // flat
  // Outer surface rings (x=0, flat)
  // Inner surface rings (x = -(thickness + sag), curved)
  for (let ri = 1; ri <= ringCount; ri++) {
    const rho = padRadiusMm * ri / ringCount
    for (let j = 0; j < sec; j++) {
      const theta = (2.0 * Math.PI * j) / sec
      const y = rho * Math.cos(theta)
      const z = rho * Math.sin(theta)
      // Outer vertex
      vertices.push(0, y, z)
    }
  }
  for (let ri = 1; ri <= ringCount; ri++) {
    const rho = padRadiusMm * ri / ringCount
    for (let j = 0; j < sec; j++) {
      const theta = (2.0 * Math.PI * j) / sec
      const y = rho * Math.cos(theta)
      const z = rho * Math.sin(theta)
      const yCurve = clamp(y, -0.995 * cupRadiusMm, 0.995 * cupRadiusMm)
      const sag = cupRadiusMm - Math.sqrt(Math.max(cupRadiusMm * cupRadiusMm - yCurve * yCurve, 0))
      // Inner vertex
      vertices.push(-(padThicknessMm + sag), y, z)
    }
  }

  // Center points (outer and inner)
  const outerCenterIdx = vertices.length / 3
  vertices.push(0, 0, 0)
  const innerCenterIdx = vertices.length / 3
  vertices.push(-padThicknessMm, 0, 0)

  const outerIdx = (ring, angle) => ring * sec + angle
  const innerIdx = (ring, angle) => ringCount * sec + ring * sec + angle

  const indices = []

  // Center fan for first ring
  for (let j = 0; j < sec; j++) {
    const j1 = (j + 1) % sec
    indices.push(outerCenterIdx, outerIdx(0, j), outerIdx(0, j1))
    indices.push(innerCenterIdx, innerIdx(0, j1), innerIdx(0, j))
  }

  // Ring-to-ring quads
  for (let ring = 0; ring < ringCount - 1; ring++) {
    for (let j = 0; j < sec; j++) {
      const j1 = (j + 1) % sec
      const oa = outerIdx(ring, j)
      const ob = outerIdx(ring, j1)
      const oc = outerIdx(ring + 1, j)
      const od = outerIdx(ring + 1, j1)
      const ia = innerIdx(ring, j)
      const ib = innerIdx(ring, j1)
      const ic = innerIdx(ring + 1, j)
      const id = innerIdx(ring + 1, j1)

      // Outer face
      indices.push(oa, oc, ob)
      indices.push(ob, oc, od)
      // Inner face
      indices.push(ia, ib, ic)
      indices.push(ib, id, ic)
    }
  }

  // Rim (connect outer and inner at last ring)
  const last = ringCount - 1
  for (let j = 0; j < sec; j++) {
    const j1 = (j + 1) % sec
    const oo = outerIdx(last, j)
    const oo1 = outerIdx(last, j1)
    const ii = innerIdx(last, j)
    const ii1 = innerIdx(last, j1)
    indices.push(oo, ii, oo1)
    indices.push(oo1, ii, ii1)
  }

  // Translate all vertices to endpoint
  for (let i = 0; i < vertices.length; i += 3) {
    vertices[i] += endpoint[0]
    vertices[i + 1] += endpoint[1]
    vertices[i + 2] += endpoint[2]
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(vertices), 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

// ─── Strength Report ───

/**
 * Format design results into a human-readable strength report.
 * Port of _build_strength_report (app.py:511-537)
 */
export function buildStrengthReport(design) {
  const r = (v) => Math.round(v * 100) / 100
  return {
    pass: design.minimumSf >= design.targetSafetyFactor,
    targetSafetyFactor: r(design.targetSafetyFactor),
    minimumSafetyFactor: r(design.minimumSf),
    structuralSafetyFactor: r(design.structuralSf),
    adhesiveSafetyFactor: r(design.adhesiveSf),
    supportSafetyFactor: r(design.supportSf),
    tubeGripDiameterMm: r(design.gripRadiusMm * 2),
    tubeRootDiameterMm: r(design.rootRadiusMm * 2),
    padDiameterMm: r(design.padDiameterMm),
    padThicknessMm: r(design.padThicknessMm),
    padAreaEachMm2: r(design.padAreaEachMm2),
    padAreaTotalMm2: r(design.padAreaTotalMm2),
    handlePathLengthMm: r(design.pathLengthMm),
    leverArmMm: r(design.leverArmMm),
    endpointSpanMm: r(design.endpointSpanMm),
    localPadFitDiametersMm: design.localDiametersMm.map(r),
    padCurvatureRadiiMm: design.cupCurvatureRadiiMm.map(r),
    topRingInnerDiameterMm: r(design.topRingInnerDiameterMm),
    topRingOuterDiameterMm: r(design.topRingOuterDiameterMm),
    ringClearanceMm: r(design.ringClearanceMm),
    ringWallThicknessMm: r(design.ringWallThicknessMm),
    ringHeightMm: r(design.ringHeightMm),
    bottomPlatformDiameterMm: r(design.bottomPlatformDiameterMm),
    platformMarginMm: r(design.platformMarginMm),
    platformThicknessMm: r(design.platformThicknessMm),
    supportBearingAreaMm2: r(design.supportBearingAreaMm2),
    jointClearanceMm: r(design.jointClearanceMm),
    notes: design.notes,
  }
}

// ─── Main Entry Point ───

/**
 * Generate a tubular handle from a drawn stroke.
 *
 * @param {Array} strokePoints - [{x, y}, ...] normalized 0-1
 * @param {Object} params
 * @returns {{ group: THREE.Group, strengthReport: Object, pathPoints: Array }}
 */
export function generateTubularHandle(strokePoints, params = {}) {
  const {
    imageWidthPx = 1000,
    imageHeightPx = 1000,
    handleMode = DEFAULT_HANDLE_MODE,
    handleHeightM = 0.12,
    handleWidthScale = 1.0,
    handleDepthScale = 1.6,
    padWidthScale = 1.0,
    cupTopDiameterMm = 80,
    cupBottomDiameterMm = 65,
    ringClearanceMm = 1.5,
    ringWallThicknessMm = 4,
    ringHeightMm = 8,
    platformMarginMm = 6,
    platformThicknessMm = 5,
    jointClearanceMm = 0.25,
    filledWeightG = 450,
    targetSafetyFactor = DEFAULT_TARGET_SAFETY_FACTOR,
    smoothLevel = 3,
  } = params

  if (!strokePoints || strokePoints.length < 2) return null

  // 1. Smooth the stroke
  const smoothed = smoothPath(strokePoints, smoothLevel)
  if (smoothed.length < 2) return null

  // 2. Convert to [[x, y], ...] flat array format
  const rawPoints = smoothed.map(p => [p.x, p.y])

  // 3. User sets desired endpoint height (meters); convert to mm.
  const handleHeightMm = Math.max(Number(handleHeightM) * 1000.0, MIN_ENDPOINT_SPAN_MM)

  // 4. Derive scale from endpoint pixel span so drawn proportions are preserved.
  const endpointSpan01 = Math.abs(rawPoints[rawPoints.length - 1][1] - rawPoints[0][1])
  const endpointSpanPx = endpointSpan01 * Math.max(imageHeightPx, 1)
  if (endpointSpanPx <= 1e-6) return null
  const derivedMmPerPixel = handleHeightMm / endpointSpanPx

  // 5. Auto-dimensions based on handle height
  const baseDims = autoDimensions(handleHeightMm)

  // 6. Normalize to 3D path
  let pathPoints
  try {
    pathPoints = normalizePoints(rawPoints, imageWidthPx, imageHeightPx, derivedMmPerPixel)
    const safeDepthScale = clamp(Number(handleDepthScale) || 1.0, 0.35, 3.5)
    for (const point of pathPoints) point[0] *= safeDepthScale
    pathPoints = smoothCenterline3D(pathPoints, smoothLevel)
  } catch (e) {
    return null // e.g., no horizontal variation
  }

  // 7. Resample at equal arc-length steps
  try {
    pathPoints = resamplePolyline3D(pathPoints, baseDims.resampleStepMm)
  } catch (e) {
    return null // line too short
  }

  // 8. Mechanical design
  const design = computeMechanicalDesign(
    pathPoints, rawPoints, handleHeightMm,
    cupTopDiameterMm, cupBottomDiameterMm,
    filledWeightG, targetSafetyFactor, baseDims,
    handleWidthScale, padWidthScale,
    {
      ringClearanceMm,
      ringWallThicknessMm,
      ringHeightMm,
      platformMarginMm,
      platformThicknessMm,
      jointClearanceMm,
    },
  )

  const mode = handleMode === 'foldable' ? 'foldable' : DEFAULT_HANDLE_MODE
  if (mode === 'foldable') {
    const { group, foldSpec } = buildFoldableAssembly(pathPoints, design)
    group.rotation.x = -Math.PI / 2
    const foldDesign = applyFoldableSafetyPenalty(design, foldSpec)
    const foldNotes = [
      ...foldDesign.notes,
      'Foldable mode: print flat, heat hinge lines with heat gun, then fold into shape.',
      'Seal the top seam with epoxy or cyanoacrylate for permanent fixation.',
      'PETG or PP recommended. PLA hinges will crack.',
    ]
    const r = (v) => Math.round(v * 100) / 100
    const strengthReport = {
      ...buildStrengthReport({ ...foldDesign, notes: foldNotes }),
      handleMode: 'foldable',
      foldPanelThicknessMm: r(foldSpec.panelThicknessMm),
      foldHingeThicknessMm: r(foldSpec.hingeThicknessMm),
      foldBodyWidthMm: r(foldSpec.foldedOuterWidthMm),
      foldBodyHeightMm: r(foldSpec.foldedOuterHeightMm),
      foldHingeBandMm: r(foldSpec.hingeBandMm),
    }
    return { group, strengthReport, pathPoints }
  }

  const endpoints = [pathPoints[0], pathPoints[pathPoints.length - 1]]
  const topEndpoint = endpoints[0][2] >= endpoints[1][2] ? endpoints[0] : endpoints[1]
  const bottomEndpoint = endpoints[0][2] < endpoints[1][2] ? endpoints[0] : endpoints[1]
  const topIndex = pathPoints[0][2] >= pathPoints[pathPoints.length - 1][2] ? 0 : pathPoints.length - 1
  const bottomIndex = topIndex === 0 ? pathPoints.length - 1 : 0
  const topOutsideEdgeX = design.ringWallThicknessMm
  const bottomOutsideEdgeX = design.platformMarginMm
  const bossEmbedMm = Math.max(1.5, design.rootRadiusMm * 0.38)
  const bossLengthMm = Math.max(6.5, design.rootRadiusMm * 1.15)
  const transitionLengthMm = Math.max(8.5, design.rootRadiusMm * 1.55)
  const transitionTangentMm = transitionLengthMm * 0.72

  const supportOuterEdgeForIndex = (index) => (
    index === topIndex ? topOutsideEdgeX : bottomOutsideEdgeX
  )

  const connectionSpecForIndex = (index) => {
    const supportOuterEdgeX = supportOuterEdgeForIndex(index)
    const z = pathPoints[index][2]
    return {
      a: [supportOuterEdgeX - bossEmbedMm, 0, z],
      b: [supportOuterEdgeX + bossLengthMm, 0, z],
      c: [supportOuterEdgeX + bossLengthMm + transitionLengthMm, 0, z],
    }
  }

  const startSpec = connectionSpecForIndex(0)
  const endSpec = connectionSpecForIndex(pathPoints.length - 1)

  // Shift the user-drawn handle curve outward so the drawn endpoints become C,
  // while A-B-C forms the horizontal boss plus transition from the support.
  const transformedPathPoints = pathPoints.map((point, index) => {
    const t = pathPoints.length <= 1 ? 0 : index / (pathPoints.length - 1)
    const rootOffsetX = startSpec.c[0] * (1 - t) + endSpec.c[0] * t
    return [point[0] + rootOffsetX, 0, point[2]]
  })

  const hermitePoint = (p0, p1, m0, m1, t) => {
    const t2 = t * t
    const t3 = t2 * t
    const h00 = 2 * t3 - 3 * t2 + 1
    const h10 = t3 - 2 * t2 + t
    const h01 = -2 * t3 + 3 * t2
    const h11 = t3 - t2
    return [
      h00 * p0[0] + h10 * m0[0] + h01 * p1[0] + h11 * m1[0],
      h00 * p0[1] + h10 * m0[1] + h01 * p1[1] + h11 * m1[1],
      h00 * p0[2] + h10 * m0[2] + h01 * p1[2] + h11 * m1[2],
    ]
  }

  const transitionSequence = (spec, index) => {
    const c = transformedPathPoints[index]
    const neighborIndex = index === 0 ? 1 : pathPoints.length - 2
    const handleTangent = unit(vecSub(transformedPathPoints[neighborIndex], c))
    const startTangent = [transitionTangentMm, 0, 0]
    const endTangent = vecScale(handleTangent[0] < 0 ? [1, 0, 0] : handleTangent, transitionTangentMm)
    return [
      spec.a,
      spec.b,
      hermitePoint(spec.b, c, startTangent, endTangent, 0.34),
      hermitePoint(spec.b, c, startTangent, endTangent, 0.68),
      c,
    ]
  }

  const startSequence = transitionSequence(startSpec, 0)
  const endSequence = transitionSequence(endSpec, pathPoints.length - 1)
  const meshPathPoints = [
    ...startSequence,
    ...transformedPathPoints.slice(1, -1),
    ...endSequence.slice().reverse(),
  ]
  const meshRadii = [
    ...startSequence.map(() => design.rootRadiusMm),
    ...Array.from(design.tubeRadiiMm).slice(1, -1),
    ...endSequence.map(() => design.rootRadiusMm),
  ]
  const meshRadiiMm = Float64Array.from(meshRadii)

  // 9. Build meshes
  const group = new THREE.Group()

  const handleMat = new THREE.MeshStandardMaterial({
    color: 0xE0E0E0, side: THREE.FrontSide, roughness: 0.35, metalness: 0.15,
  })

  // Tube handle between top ring and bottom platform.
  const tubeGeo = buildTubeMesh(meshPathPoints, meshRadiiMm, 40, false)
  group.add(tagPart(new THREE.Mesh(tubeGeo, handleMat), 'handle'))

  const topRingGeo = buildTopSupportRingMesh(topEndpoint, design)
  group.add(tagPart(new THREE.Mesh(topRingGeo, handleMat), 'topRing'))

  const platformGeo = buildBottomPlatformMesh(bottomEndpoint, design)
  group.add(tagPart(new THREE.Mesh(platformGeo, handleMat), 'bottomPlatform'))

  // Coordinate system: reference uses X=radial, Y=0, Z=vertical
  // Three.js scene uses Y-up. Rotate to align.
  group.rotation.x = -Math.PI / 2

  // 10. Strength report
  const strengthReport = buildStrengthReport({
    ...design,
    notes: [
      ...design.notes,
      'Integrated frame: handle roots are embedded directly into the ring and base edges.',
    ],
  })

  return { group, strengthReport, pathPoints }
}
