import { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import useStore from '../store'
import { sampleBezierSpline } from '../utils/bezierPath'

const ANCHOR_HIT_RADIUS_PX = 10
const ANCHOR_DRAW_RADIUS_PX = 4
const SEGMENT_HIT_RADIUS_PX = 12

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v))
}

export default function PhotoCanvas() {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const draggingAnchorIndex = useRef(-1)
  const [isDraggingAnchor, setIsDraggingAnchor] = useState(false)
  const [hoverAnchorIndex, setHoverAnchorIndex] = useState(-1)
  const [hoverOnSegment, setHoverOnSegment] = useState(false)
  const [altPressed, setAltPressed] = useState(false)

  const image = useStore(s => s.image)
  const setImage = useStore(s => s.setImage)
  const handleHeightM = useStore(s => s.handleHeightM)

  const curvePoints = useStore(s => s.curvePoints)
  const addCurvePoint = useStore(s => s.addCurvePoint)
  const insertCurvePoint = useStore(s => s.insertCurvePoint)
  const removeCurvePoint = useStore(s => s.removeCurvePoint)
  const updateCurvePoint = useStore(s => s.updateCurvePoint)

  const bezierStroke = useMemo(() => {
    if (curvePoints.length < 2) return []
    return sampleBezierSpline(curvePoints, 30)
  }, [curvePoints])

  const derivedMmPerPixel = useMemo(() => {
    if (!image || curvePoints.length < 2) return 0
    const first = curvePoints[0]
    const last = curvePoints[curvePoints.length - 1]
    const endpointDyPx = Math.abs(last.y - first.y) * image.height
    if (endpointDyPx <= 1e-6) return 0
    return (Math.max(0.02, handleHeightM) * 1000) / endpointDyPx
  }, [image, curvePoints, handleHeightM])

  const canvasCursor = useMemo(() => {
    if (!image) return 'default'
    if (isDraggingAnchor) return 'grabbing'
    if (hoverAnchorIndex >= 0) return altPressed ? 'not-allowed' : 'grab'
    if (hoverOnSegment) return 'copy'
    return 'crosshair'
  }, [image, isDraggingAnchor, hoverAnchorIndex, hoverOnSegment, altPressed])

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    const img = new Image()
    img.onload = () => setImage(img)
    img.src = URL.createObjectURL(file)
  }, [setImage])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const handleClick = useCallback(() => {
    if (image) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => handleFile(e.target.files[0])
    input.click()
  }, [image, handleFile])

  const getNorm = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) }
  }, [])

  const findAnchorAt = useCallback((pt) => {
    const canvas = canvasRef.current
    if (!canvas) return -1

    const radiusSq = ANCHOR_HIT_RADIUS_PX * ANCHOR_HIT_RADIUS_PX
    for (let i = curvePoints.length - 1; i >= 0; i--) {
      const dxPx = (curvePoints[i].x - pt.x) * canvas.width
      const dyPx = (curvePoints[i].y - pt.y) * canvas.height
      const d2 = dxPx * dxPx + dyPx * dyPx
      if (d2 <= radiusSq) return i
    }
    return -1
  }, [curvePoints])

  const findSegmentAt = useCallback((pt) => {
    const canvas = canvasRef.current
    if (!canvas || curvePoints.length < 2) return null

    const px = pt.x * canvas.width
    const py = pt.y * canvas.height

    let best = null
    let bestDistSq = Number.POSITIVE_INFINITY

    for (let i = 0; i < curvePoints.length - 1; i++) {
      const a = curvePoints[i]
      const b = curvePoints[i + 1]

      const ax = a.x * canvas.width
      const ay = a.y * canvas.height
      const bx = b.x * canvas.width
      const by = b.y * canvas.height

      const abx = bx - ax
      const aby = by - ay
      const abLenSq = abx * abx + aby * aby
      if (abLenSq < 1e-9) continue

      const t = clamp(((px - ax) * abx + (py - ay) * aby) / abLenSq, 0, 1)
      const projX = ax + t * abx
      const projY = ay + t * aby

      const dx = px - projX
      const dy = py - projY
      const distSq = dx * dx + dy * dy

      if (distSq < bestDistSq) {
        bestDistSq = distSq
        best = {
          insertIndex: i + 1,
          point: {
            x: clamp(projX / canvas.width, 0, 1),
            y: clamp(projY / canvas.height, 0, 1),
          },
        }
      }
    }

    if (!best) return null
    if (bestDistSq > SEGMENT_HIT_RADIUS_PX * SEGMENT_HIT_RADIUS_PX) return null
    return best
  }, [curvePoints])

  const onPointerDown = useCallback((e) => {
    if (!image) return
    const pt = getNorm(e)
    if (!pt) return

    const hitIndex = findAnchorAt(pt)
    if (hitIndex >= 0) {
      if (e.altKey) {
        removeCurvePoint(hitIndex)
        setHoverAnchorIndex(-1)
        setHoverOnSegment(false)
        return
      }

      draggingAnchorIndex.current = hitIndex
      setIsDraggingAnchor(true)
      if (e.currentTarget?.setPointerCapture) {
        e.currentTarget.setPointerCapture(e.pointerId)
      }
      return
    }

    const segmentHit = findSegmentAt(pt)
    if (segmentHit) {
      insertCurvePoint(segmentHit.insertIndex, segmentHit.point)
      return
    }

    addCurvePoint(pt)
  }, [image, getNorm, findAnchorAt, findSegmentAt, insertCurvePoint, addCurvePoint, removeCurvePoint])

  const onPointerMove = useCallback((e) => {
    const pt = getNorm(e)
    if (!pt) return
    const anchorIndex = findAnchorAt(pt)

    if (draggingAnchorIndex.current >= 0) {
      updateCurvePoint(draggingAnchorIndex.current, pt)
      setHoverAnchorIndex(anchorIndex)
      setHoverOnSegment(false)
      return
    }

    const segmentHit = anchorIndex < 0 ? findSegmentAt(pt) : null
    setHoverAnchorIndex(prev => (prev === anchorIndex ? prev : anchorIndex))
    setHoverOnSegment(prev => (prev === !!segmentHit ? prev : !!segmentHit))
  }, [getNorm, findAnchorAt, findSegmentAt, updateCurvePoint])

  const onPointerUp = useCallback((e) => {
    draggingAnchorIndex.current = -1
    setIsDraggingAnchor(false)
    if (e.currentTarget?.releasePointerCapture) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => setAltPressed(!!e.altKey)
    const onKeyUp = (e) => setAltPressed(!!e.altKey)
    const onBlur = () => setAltPressed(false)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const w = container.clientWidth
    const h = container.clientHeight
    let cw = w
    let ch = h

    if (image) {
      const ratio = image.width / image.height
      if (w / h > ratio) {
        cw = h * ratio
        ch = h
      } else {
        cw = w
        ch = w / ratio
      }
    }

    canvas.width = cw
    canvas.height = ch

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, cw, ch)

    if (image) {
      ctx.drawImage(image, 0, 0, cw, ch)
    }

    if (curvePoints.length > 1) {
      ctx.strokeStyle = 'rgba(0, 188, 212, 0.4)'
      ctx.lineWidth = 1
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      ctx.moveTo(curvePoints[0].x * cw, curvePoints[0].y * ch)
      for (let i = 1; i < curvePoints.length; i++) {
        ctx.lineTo(curvePoints[i].x * cw, curvePoints[i].y * ch)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    if (bezierStroke.length > 1) {
      ctx.strokeStyle = '#00E5FF'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(bezierStroke[0].x * cw, bezierStroke[0].y * ch)
      for (let i = 1; i < bezierStroke.length; i++) {
        ctx.lineTo(bezierStroke[i].x * cw, bezierStroke[i].y * ch)
      }
      ctx.stroke()
    }

    for (let i = 0; i < curvePoints.length; i++) {
      const p = curvePoints[i]
      const isEdge = i === 0 || i === curvePoints.length - 1
      ctx.beginPath()
      ctx.arc(p.x * cw, p.y * ch, ANCHOR_DRAW_RADIUS_PX, 0, Math.PI * 2)
      ctx.fillStyle = isEdge ? '#00BCD4' : '#4DD0E1'
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }, [
    image,
    curvePoints,
    bezierStroke,
  ])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ cursor: canvasCursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {image && curvePoints.length >= 2 && (
        <div className="canvas-metric">
          Handle: {handleHeightM.toFixed(3)} m | Scale: {derivedMmPerPixel.toFixed(2)} mm/px
        </div>
      )}
      {!image && (
        <div
          className="drop-zone"
          onClick={handleClick}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
        >
          <span style={{ fontSize: 40 }}>IMG</span>
          <span>Drop a photo here or click to upload</span>
          <span style={{ fontSize: 12, color: '#999' }}>
            Take a photo of your cup, bottle, or box
          </span>
        </div>
      )}
    </div>
  )
}
