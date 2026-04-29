import useStore from '../store'

export default function ParameterPanel() {
  const s = useStore()

  const sliders = [
    { label: 'Handle Height',   value: s.handleHeightM,       set: s.setHandleHeightM,       min: 0.02, max: 0.5,  step: 0.005, unit: 'm' },
    { label: 'Handle Width',    value: s.handleWidthScale,    set: s.setHandleWidthScale,    min: 0.6,  max: 2.0,  step: 0.05,  unit: 'x' },
    { label: 'Handle Depth',    value: s.handleDepthScale,    set: s.setHandleDepthScale,    min: 0.5,  max: 3.0,  step: 0.05,  unit: 'x' },
    { label: 'Top Diameter',    value: s.cupTopDiameterMm,    set: s.setCupTopDiameterMm,    min: 30,   max: 150,                unit: 'mm' },
    { label: 'Bottom Dia.',     value: s.cupBottomDiameterMm, set: s.setCupBottomDiameterMm, min: 30,   max: 150,                unit: 'mm' },
    { label: 'Ring Clearance',  value: s.ringClearanceMm,     set: s.setRingClearanceMm,     min: 0,    max: 5,    step: 0.25,  unit: 'mm' },
    { label: 'Ring Wall',       value: s.ringWallThicknessMm, set: s.setRingWallThicknessMm, min: 2,    max: 12,   step: 0.5,   unit: 'mm' },
    { label: 'Ring Height',     value: s.ringHeightMm,        set: s.setRingHeightMm,        min: 3,    max: 25,   step: 0.5,   unit: 'mm' },
    { label: 'Base Margin',     value: s.platformMarginMm,    set: s.setPlatformMarginMm,    min: 0,    max: 20,   step: 0.5,   unit: 'mm' },
    { label: 'Base Thick.',     value: s.platformThicknessMm, set: s.setPlatformThicknessMm, min: 2,    max: 15,   step: 0.5,   unit: 'mm' },
    { label: 'Joint Clearance', value: s.jointClearanceMm,    set: s.setJointClearanceMm,    min: 0.05, max: 0.6,  step: 0.05,  unit: 'mm' },
    { label: 'Filled Weight',   value: s.filledWeightG,       set: s.setFilledWeightG,       min: 50,   max: 1500,               unit: 'g' },
    { label: 'Safety Factor',   value: s.targetSafetyFactor,  set: s.setTargetSafetyFactor,  min: 1.5,  max: 10,   step: 0.5,   unit: 'x' },
    { label: 'Smoothing',       value: s.smoothLevel,         set: s.setSmoothLevel,         min: 1,    max: 10,                 unit: '' },
  ]

  return (
    <div className="param-group">
      <h3>Parameters</h3>

      <div className="param-choice-row">
        <label>Fabrication</label>
        <select
          value={s.fabricationMode}
          onChange={e => s.setFabricationMode(e.target.value)}
        >
          <option value="printed">Fully 3D Printed</option>
          <option value="hybrid">Laser Cut + 3D Print</option>
        </select>
      </div>

      {s.fabricationMode === 'hybrid' && (
        <>
          <div className="param-choice-row">
            <label>Sleeve Style</label>
            <select
              value={s.sleeveStyle}
              onChange={e => s.setSleeveStyle(e.target.value)}
            >
              <option value="tapered">Tapered Sleeve</option>
              <option value="base">Base Integrated</option>
            </select>
          </div>

          <div className="param-row">
            <label>Sleeve Slit</label>
            <input
              type="range"
              min={2}
              max={24}
              step={1}
              value={s.sleeveSlitAngleDeg}
              onChange={e => s.setSleeveSlitAngleDeg(Number(e.target.value))}
            />
            <span className="param-val">{s.sleeveSlitAngleDeg}deg</span>
          </div>
        </>
      )}

      {sliders.map(row => (
        <div className="param-row" key={row.label}>
          <label>{row.label}</label>
          <input
            type="range"
            min={row.min}
            max={row.max}
            step={row.step || 1}
            value={row.value}
            onChange={e => row.set(Number(e.target.value))}
          />
          <span className="param-val">{row.value}{row.unit}</span>
        </div>
      ))}
    </div>
  )
}
