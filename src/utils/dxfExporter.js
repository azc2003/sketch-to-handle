// Minimal ASCII DXF writer (AutoCAD R12 compatible — accepted by LightBurn,
// Inkscape, RDWorks, etc.). Each input piece is written as one LWPOLYLINE
// in a layer named by the piece. Coordinates are in millimetres.
//
// piece = { name, polyline: [[x,y],...], closed: bool, offset?: [dx,dy] }

function lwpolyline(layer, points, closed) {
  const lines = [
    '0', 'LWPOLYLINE',
    '8', layer,
    '90', String(points.length),
    '70', closed ? '1' : '0',
  ]
  for (const [x, y] of points) {
    lines.push('10', x.toFixed(4))
    lines.push('20', y.toFixed(4))
  }
  return lines
}

export function buildDXF(pieces) {
  const out = [
    '0', 'SECTION',
    '2', 'HEADER',
    '9', '$INSUNITS', '70', '4',     // 4 = millimetres
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'ENTITIES',
  ]
  for (const p of pieces) {
    const [dx, dy] = p.offset || [0, 0]
    const shifted = p.polyline.map(([x, y]) => [x + dx, y + dy])
    out.push(...lwpolyline(p.name || '0', shifted, !!p.closed))
  }
  out.push('0', 'ENDSEC', '0', 'EOF')
  return out.join('\n') + '\n'
}

export function downloadDXF(pieces, filename = 'sleeve.dxf') {
  const text = buildDXF(pieces)
  const blob = new Blob([text], { type: 'application/dxf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
