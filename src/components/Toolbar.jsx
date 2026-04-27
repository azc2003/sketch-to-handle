import useStore from '../store'

export default function Toolbar() {
  const curvePoints = useStore(s => s.curvePoints)
  const undoCurvePoint = useStore(s => s.undoCurvePoint)
  const clearCurvePoints = useStore(s => s.clearCurvePoints)

  return (
    <div className="toolbar">
      <button className="active" title="Bezier mode">
        B
      </button>

      <div className="sep" />

      <button onClick={undoCurvePoint} title="Undo last anchor">U</button>
      <button onClick={clearCurvePoints} title="Clear anchors">X</button>

      <div className="sep" />

      <label style={{ fontSize: 10, color: '#888', textAlign: 'center', lineHeight: 1.3 }}>
        {curvePoints.length} pt{curvePoints.length !== 1 ? 's' : ''}
      </label>
    </div>
  )
}
