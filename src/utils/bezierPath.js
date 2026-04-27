function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v))
}

function cubicPoint(p0, p1, p2, p3, t) {
  const u = 1 - t
  const uu = u * u
  const uuu = uu * u
  const tt = t * t
  const ttt = tt * t

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  }
}

/**
 * Build a smooth cubic Bezier spline through anchor points and sample it.
 * Conversion uses Catmull-Rom to Bezier control points for C1 continuity.
 *
 * @param {{x:number,y:number}[]} points
 * @param {number} samplesPerSegment
 * @param {number} tension
 * @returns {{x:number,y:number}[]}
 */
export function sampleBezierSpline(points, samplesPerSegment = 24, tension = 1.0) {
  if (!points || points.length === 0) return []
  if (points.length === 1) return [{ ...points[0] }]

  const segSamples = Math.max(6, Math.floor(samplesPerSegment))
  const tScale = clamp(Number.isFinite(tension) ? tension : 1.0, 0.05, 1.5)

  const result = []

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = i + 2 < points.length ? points[i + 2] : points[i + 1]

    const c1 = {
      x: p1.x + ((p2.x - p0.x) / 6) * tScale,
      y: p1.y + ((p2.y - p0.y) / 6) * tScale,
    }
    const c2 = {
      x: p2.x - ((p3.x - p1.x) / 6) * tScale,
      y: p2.y - ((p3.y - p1.y) / 6) * tScale,
    }

    const startK = i === 0 ? 0 : 1
    for (let k = startK; k <= segSamples; k++) {
      const t = k / segSamples
      result.push(cubicPoint(p1, c1, c2, p2, t))
    }
  }

  result[0] = { ...points[0] }
  result[result.length - 1] = { ...points[points.length - 1] }
  return result
}
