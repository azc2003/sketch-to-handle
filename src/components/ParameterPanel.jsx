import { useEffect } from 'react'
import useStore from '../store'

export default function ParameterPanel() {
  const s = useStore()

  useEffect(() => {
    if (s.fabricationMode !== 'printed') s.setFabricationMode('printed')
  }, [s.fabricationMode, s.setFabricationMode])

  const bottomRadiusMm = Math.round((s.cupBottomDiameterMm * 0.5 + s.platformMarginMm) * 10) / 10
  const topRingRadiusMm = Math.round((s.cupTopDiameterMm * 0.5) * 10) / 10
  const handleWidthMm = Math.round((s.handleWidthScale * 10) * 10) / 10

  const setBottomRadiusMm = (radiusMm) => {
    const safeRadius = Math.max(16, Number(radiusMm) || 16)
    const cupRadius = Math.min(s.cupBottomDiameterMm * 0.5, Math.max(8, safeRadius - 2))
    s.setCupBottomDiameterMm(cupRadius * 2)
    s.setPlatformMarginMm(Math.max(0, safeRadius - cupRadius))
  }

  const setTopRingRadiusMm = (radiusMm) => {
    const safeRadius = Math.max(15, Number(radiusMm) || 15)
    s.setCupTopDiameterMm(safeRadius * 2)
  }

  const setHandleWidthMm = (widthMm) => {
    const safeWidth = Math.max(6, Number(widthMm) || 6)
    s.setHandleWidthScale(safeWidth / 10)
  }

  const sliders = [
    { label: 'Bottom Radius', value: bottomRadiusMm,        set: setBottomRadiusMm,       min: 18, max: 90, step: 0.5, unit: 'mm' },
    { label: 'Bottom Height', value: s.platformThicknessMm, set: s.setPlatformThicknessMm, min: 2,  max: 18, step: 0.5, unit: 'mm' },
    { label: 'Top Ring Radius', value: topRingRadiusMm,     set: setTopRingRadiusMm,      min: 18, max: 90, step: 0.5, unit: 'mm' },
    { label: 'Top Ring Thickness', value: s.ringWallThicknessMm, set: s.setRingWallThicknessMm, min: 2, max: 14, step: 0.5, unit: 'mm' },
    { label: 'Top Ring Height', value: s.ringHeightMm,      set: s.setRingHeightMm,       min: 3,  max: 28, step: 0.5, unit: 'mm' },
    { label: 'Handle Width', value: handleWidthMm,          set: setHandleWidthMm,        min: 6,  max: 22, step: 0.5, unit: 'mm' },
  ]

  return (
    <div className="param-group">
      <h3>Parameters</h3>

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
