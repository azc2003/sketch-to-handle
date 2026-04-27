// Unroll a tapered (frustum) sleeve into a flat 2D pattern for laser cutting.
//
// Geometry:
//   Truncated cone with top radius R1 (wider), bottom radius R2 (narrower),
//   vertical sleeve height h. Slant height L = sqrt((R1-R2)^2 + h^2).
//   The unrolled shape is an annular sector with:
//     - outer arc radius  Ro = R1 * L / (R1 - R2)
//     - inner arc radius  Ri = R2 * L / (R1 - R2)
//     - full sweep angle  θ_full = 2π * (R1 - R2) / L
//   We subtract a small slit angle so the sleeve clamps onto the cup
//   instead of fully closing.
//
// When R1 ≈ R2 (cylindrical cup) the apex blows up; we fall back to a
// rectangular wrap pattern of width 2π·R · (1 - slit) and height h.

const TWO_PI = Math.PI * 2

export function generateSleevePattern({
  topDiameterMm,
  bottomDiameterMm,
  heightMm,
  slitAngleDeg = 4,
  arcSegments = 96,
  style = 'tapered', // 'tapered' | 'base'
}) {
  const Rtop = Math.max(0.1, topDiameterMm / 2)
  const Rbot = Math.max(0.1, bottomDiameterMm / 2)
  const R1 = Math.max(Rtop, Rbot)
  const R2 = Math.min(Rtop, Rbot)
  const h = Math.max(1, heightMm)
  const dR = R1 - R2
  const slitFrac = Math.max(0, Math.min(0.4, slitAngleDeg / 360))

  const pieces = []

  if (dR < 0.5) {
    // Near-cylinder fallback: rectangle (width = arc length minus slit).
    const C = TWO_PI * R1 * (1 - slitFrac)
    const rect = [
      [0, 0], [C, 0], [C, h], [0, h], [0, 0],
    ]
    pieces.push({ name: 'sleeve_wrap', polyline: rect, closed: true, offset: [0, 0] })
  } else {
    const L = Math.sqrt(dR * dR + h * h)
    const Ro = (R1 * L) / dR
    const Ri = (R2 * L) / dR
    const sweep = TWO_PI * (dR / L) * (1 - slitFrac)

    // Sector outline. Center sweep around -π/2 (opens downward) so the part
    // sits centered around x=0.
    const a0 = -Math.PI / 2 - sweep / 2
    const pts = []
    for (let i = 0; i <= arcSegments; i++) {
      const a = a0 + (sweep * i) / arcSegments
      pts.push([Ro * Math.cos(a), Ro * Math.sin(a)])
    }
    for (let i = arcSegments; i >= 0; i--) {
      const a = a0 + (sweep * i) / arcSegments
      pts.push([Ri * Math.cos(a), Ri * Math.sin(a)])
    }
    pts.push(pts[0])

    pieces.push({
      name: 'sleeve_wrap',
      polyline: pts,
      closed: true,
      offset: [0, 0],
      meta: { Ro, Ri, sweep, slantHeightMm: L },
    })
  }

  // Base-integrated style: add a flat annular base ring that sits under the
  // cup, with a small notch on its outer edge to accept the sleeve seam tab.
  if (style === 'base') {
    const baseRingId = circlePolyline(R2 + 1.0, 96)        // outer
    const baseHoleId = circlePolyline(R2 - 2.0, 96)        // hole for cup
    // Place to the right of the wrap so they don't overlap on the sheet.
    const xOffset = boundsWidth(pieces[0].polyline) / 2 + R2 + 8
    pieces.push({ name: 'base_ring_outer', polyline: baseRingId, closed: true, offset: [xOffset, 0] })
    pieces.push({ name: 'base_ring_hole',  polyline: baseHoleId, closed: true, offset: [xOffset, 0] })
  }

  return { pieces, style }
}

function circlePolyline(r, segments) {
  const pts = []
  for (let i = 0; i <= segments; i++) {
    const a = (TWO_PI * i) / segments
    pts.push([r * Math.cos(a), r * Math.sin(a)])
  }
  return pts
}

function boundsWidth(poly) {
  let xMin = Infinity, xMax = -Infinity
  for (const [x] of poly) {
    if (x < xMin) xMin = x
    if (x > xMax) xMax = x
  }
  return xMax - xMin
}
