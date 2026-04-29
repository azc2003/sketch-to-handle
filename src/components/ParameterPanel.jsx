import { useEffect } from 'react'
import useStore from '../store'
import {
  MIN_BOTTOM_PLATFORM_HEIGHT_MM,
  MIN_TOP_RING_HEIGHT_MM,
} from '../utils/tubularHandleGenerator'

export default function ParameterPanel() {
  const s = useStore()

  useEffect(() => {
    if (s.fabricationMode !== 'printed') s.setFabricationMode('printed')
  }, [s.fabricationMode, s.setFabricationMode])

  const bottomRadiusMm = Math.round((s.cupBottomDiameterMm * 0.5 + s.platformMarginMm) * 10) / 10
  const topRingRadiusMm = Math.round((s.cupTopDiameterMm * 0.5) * 10) / 10
  const handleWidthMm = Math.round((s.handleWidthScale * 10) * 10) / 10
  const minimumHandleWidthMm = Math.max(
    6,
    MIN_TOP_RING_HEIGHT_MM,
    MIN_BOTTOM_PLATFORM_HEIGHT_MM,
    s.ringHeightMm,
    s.platformThicknessMm,
  )

  useEffect(() => {
    if (s.ringHeightMm < MIN_TOP_RING_HEIGHT_MM) {
      s.setRingHeightMm(MIN_TOP_RING_HEIGHT_MM)
    }
    if (s.platformThicknessMm < MIN_BOTTOM_PLATFORM_HEIGHT_MM) {
      s.setPlatformThicknessMm(MIN_BOTTOM_PLATFORM_HEIGHT_MM)
    }
    if (handleWidthMm < minimumHandleWidthMm) {
      s.setHandleWidthScale(minimumHandleWidthMm / 10)
    }
  }, [
    handleWidthMm,
    minimumHandleWidthMm,
    s.ringHeightMm,
    s.platformThicknessMm,
    s.setHandleWidthScale,
    s.setPlatformThicknessMm,
    s.setRingHeightMm,
  ])

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
    const safeWidth = Math.max(minimumHandleWidthMm, Number(widthMm) || minimumHandleWidthMm)
    s.setHandleWidthScale(safeWidth / 10)
    if (s.ringHeightMm < safeWidth) {
      s.setRingHeightMm(safeWidth)
    }
    if (s.platformThicknessMm < safeWidth) {
      s.setPlatformThicknessMm(safeWidth)
    }
  }

  const sliders = [
    { label: 'Bottom Radius', value: bottomRadiusMm,        set: setBottomRadiusMm,       min: 18, max: 90, step: 0.5, unit: 'mm' },
    { label: 'Bottom Height', value: s.platformThicknessMm, set: s.setPlatformThicknessMm, min: MIN_BOTTOM_PLATFORM_HEIGHT_MM, max: 28, step: 0.5, unit: 'mm' },
    { label: 'Top Ring Radius', value: topRingRadiusMm,     set: setTopRingRadiusMm,      min: 18, max: 90, step: 0.5, unit: 'mm' },
    { label: 'Top Ring Thickness', value: s.ringWallThicknessMm, set: s.setRingWallThicknessMm, min: 2, max: 14, step: 0.5, unit: 'mm' },
    { label: 'Top Ring Height', value: s.ringHeightMm,      set: s.setRingHeightMm,       min: MIN_TOP_RING_HEIGHT_MM, max: 28, step: 0.5, unit: 'mm' },
    { label: 'Handle Width', value: handleWidthMm,          set: setHandleWidthMm,        min: minimumHandleWidthMm, max: Math.max(22, minimumHandleWidthMm), step: 0.5, unit: 'mm' },
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
