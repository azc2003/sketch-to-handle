import { useMemo } from 'react'
import useStore from '../store'
import { generateTubularHandle } from '../utils/tubularHandleGenerator'
import { sampleBezierSpline } from '../utils/bezierPath'

export default function StrengthReport() {
  const image = useStore(s => s.image)
  const curvePoints = useStore(s => s.curvePoints)

  const fabricationMode = useStore(s => s.fabricationMode)
  const sleeveStyle = useStore(s => s.sleeveStyle)
  const sleeveSlitAngleDeg = useStore(s => s.sleeveSlitAngleDeg)
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
  const topRingOpeningRatio = useStore(s => s.topRingOpeningRatio)
  const platformMarginMm = useStore(s => s.platformMarginMm)
  const platformThicknessMm = useStore(s => s.platformThicknessMm)
  const jointClearanceMm = useStore(s => s.jointClearanceMm)
  const filledWeightG = useStore(s => s.filledWeightG)
  const targetSafetyFactor = useStore(s => s.targetSafetyFactor)

  const inputStroke = useMemo(() => {
    if (curvePoints.length < 2) return null
    return sampleBezierSpline(curvePoints, 36)
  }, [curvePoints])

  const report = useMemo(() => {
    if (!inputStroke || inputStroke.length < 2) return null
    try {
      const result = generateTubularHandle(inputStroke, {
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
        topRingOpeningRatio,
        platformMarginMm,
        platformThicknessMm,
        jointClearanceMm,
        filledWeightG,
        targetSafetyFactor,
        smoothLevel,
      })
      return result?.strengthReport || null
    } catch {
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
    topRingOpeningRatio,
    platformMarginMm,
    platformThicknessMm,
    jointClearanceMm,
    filledWeightG,
    targetSafetyFactor,
    smoothLevel,
  ])

  if (!report) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#aaa',
          height: '100%',
          fontSize: 13,
          padding: 16,
          textAlign: 'center',
        }}
      >
        Draw a handle curve to see
        <br />
        the strength analysis
      </div>
    )
  }

  const pass = report.pass
  const isFoldable = report.handleMode === 'foldable'
  const isHybrid = fabricationMode === 'hybrid'

  return (
    <div className="strength-report">
      <div className={`strength-banner ${pass ? 'pass' : 'fail'}`}>
        {pass ? 'PASS' : 'FAIL'} - Min SF: {report.minimumSafetyFactor}x (target: {report.targetSafetyFactor}x)
      </div>

      <h4>Fabrication</h4>
      <table className="strength-table">
        <tbody>
          <Row label="Mode" value={isHybrid ? 'Laser cut + 3D print' : 'Fully 3D printed'} />
          {isHybrid && <Row label="Sleeve style" value={sleeveStyle === 'base' ? 'Base integrated' : 'Tapered sleeve'} />}
          {isHybrid && <Row label="Sleeve height" value={`${Math.round(handleHeightM * 1000 * 100) / 100} mm`} />}
          {isHybrid && <Row label="Sleeve slit" value={`${sleeveSlitAngleDeg} deg`} />}
        </tbody>
      </table>

      <h4>Safety Factors</h4>
      <table className="strength-table">
        <tbody>
          <Row
            label="Structural"
            value={`${report.structuralSafetyFactor}x`}
            warn={report.structuralSafetyFactor < report.targetSafetyFactor}
          />
          <Row
            label="Ring/base support"
            value={`${report.supportSafetyFactor}x`}
            warn={report.supportSafetyFactor < report.targetSafetyFactor}
          />
          <Row label="Minimum" value={`${report.minimumSafetyFactor}x`} warn={!pass} />
        </tbody>
      </table>

      <h4>{isFoldable ? 'Handle Body' : 'Handle Tube'}</h4>
      <table className="strength-table">
        <tbody>
          <Row label="Grip section" value={`${report.tubeGripDiameterMm} x ${report.tubeGripWidthMm} mm`} />
          <Row label="Root section" value={`${report.tubeRootDiameterMm} x ${report.tubeRootWidthMm} mm`} />
          <Row label="Path length" value={`${report.handlePathLengthMm} mm`} />
          <Row label="Lever arm" value={`${report.leverArmMm} mm`} />
          <Row label="Center height" value={`${report.handleCenterHeightMm} mm`} />
        </tbody>
      </table>

      {isFoldable && (
        <>
          <h4>Foldable Build</h4>
          <table className="strength-table">
            <tbody>
              <Row label="Panel thickness" value={`${report.foldPanelThicknessMm} mm`} />
              <Row label="Hinge thickness" value={`${report.foldHingeThicknessMm} mm`} />
              <Row label="Folded width" value={`${report.foldBodyWidthMm} mm`} />
              <Row label="Folded height" value={`${report.foldBodyHeightMm} mm`} />
              <Row label="Hinge band" value={`${report.foldHingeBandMm} mm`} />
            </tbody>
          </table>
        </>
      )}

      <h4>Cup Support</h4>
      <table className="strength-table">
        <tbody>
          <Row label="Top ring ID" value={`${report.topRingInnerDiameterMm} mm`} />
          <Row label="Top ring OD" value={`${report.topRingOuterDiameterMm} mm`} />
          <Row label="Top ring opening" value={`${report.topRingOpeningRatioPercent}% / ${report.topRingOpeningWidthMm} mm`} />
          <Row label="Ring wall / height" value={`${report.ringWallThicknessMm} / ${report.ringHeightMm} mm`} />
          <Row label="Ring clearance" value={`${report.ringClearanceMm} mm`} />
          <Row label="Base diameter" value={`${report.bottomPlatformDiameterMm} mm`} />
          <Row label="Base thickness" value={`${report.platformThicknessMm} mm`} />
          <Row label="Base margin" value={`${report.platformMarginMm} mm`} />
          <Row label="Bearing area" value={`${report.supportBearingAreaMm2} mm2`} />
          <Row label="Print clearance" value={`${report.jointClearanceMm} mm`} />
        </tbody>
      </table>

      {report.notes.length > 0 && (
        <>
          <h4>Notes</h4>
          <ul className="strength-notes">
            {report.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function Row({ label, value, warn }) {
  return (
    <tr>
      <td>{label}</td>
      <td style={warn ? { color: '#C62828', fontWeight: 600 } : undefined}>{value}</td>
    </tr>
  )
}
