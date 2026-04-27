/**
 * 2D path smoothing helpers for user-drawn strokes.
 * Pipeline:
 * 1) Light RDP simplification (remove jitter, keep shape)
 * 2) Chaikin corner-cutting (round corners)
 * 3) Moving-average pass (stabilize spacing)
 */

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v))
}

function perpendicularDist(pt, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(pt.x - lineStart.x, pt.y - lineStart.y)

  let t = ((pt.x - lineStart.x) * dx + (pt.y - lineStart.y) * dy) / lenSq
  t = clamp(t, 0, 1)
  const proj = { x: lineStart.x + t * dx, y: lineStart.y + t * dy }
  return Math.hypot(pt.x - proj.x, pt.y - proj.y)
}

// Ramer-Douglas-Peucker simplification
export function rdpSimplify(points, epsilon) {
  if (points.length < 3) return [...points]

  let maxDist = 0
  let maxIdx = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDist(points[i], points[0], points[points.length - 1])
    if (d > maxDist) {
      maxDist = d
      maxIdx = i
    }
  }

  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, maxIdx + 1), epsilon)
    const right = rdpSimplify(points.slice(maxIdx), epsilon)
    return [...left.slice(0, -1), ...right]
  }

  return [points[0], points[points.length - 1]]
}

export function movingAverageSmooth(points, windowSize) {
  if (points.length < 3 || windowSize < 2) return points

  const half = Math.floor(windowSize / 2)
  const result = []
  for (let i = 0; i < points.length; i++) {
    let sx = 0
    let sy = 0
    let count = 0

    for (let j = Math.max(0, i - half); j <= Math.min(points.length - 1, i + half); j++) {
      sx += points[j].x
      sy += points[j].y
      count++
    }
    result.push({ x: sx / count, y: sy / count })
  }

  // Keep endpoints unchanged for stable attachment placement
  result[0] = { ...points[0] }
  result[result.length - 1] = { ...points[points.length - 1] }
  return result
}

// Chaikin corner-cutting (C1-like smoothing, keeps endpoints)
export function chaikinSmooth(points, iterations = 1) {
  if (points.length < 3 || iterations <= 0) return points

  let result = [...points]
  for (let it = 0; it < iterations; it++) {
    if (result.length < 3) break

    const next = [{ ...result[0] }]
    for (let i = 0; i < result.length - 1; i++) {
      const p0 = result[i]
      const p1 = result[i + 1]
      next.push({
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
      })
      next.push({
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
      })
    }
    next.push({ ...result[result.length - 1] })
    result = next
  }
  return result
}

/**
 * Composite smoothing:
 * - avoid over-simplifying to a few hard corners
 * - produce a visually smooth centerline for tube generation
 */
export function smoothPath(points, level = 3) {
  if (points.length < 3) return points

  const lv = clamp(Number.isFinite(level) ? level : 3, 1, 10)

  // Keep simplification gentle; previous mapping was too aggressive.
  const epsilon = 0.0008 + lv * 0.00045
  let result = points.length > 10 ? rdpSimplify(points, epsilon) : [...points]

  // Do not collapse to too few points for 3D tube generation.
  if (result.length < 6 && points.length >= 6) {
    result = [...points]
  }

  const cornerIterations = 1 + Math.floor(lv / 3)
  result = chaikinSmooth(result, cornerIterations)

  const windowSize = 3 + Math.floor(lv / 4)
  result = movingAverageSmooth(result, windowSize)

  return result
}
