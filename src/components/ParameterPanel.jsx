import { useEffect, useState } from 'react'
import useStore from '../store'
import {
  DEFAULT_TOP_RING_OPENING_RATIO,
  MAX_TOP_RING_OPENING_RATIO,
  MIN_TOP_RING_OPENING_RATIO,
  MIN_BOTTOM_PLATFORM_HEIGHT_MM,
  MIN_TOP_RING_HEIGHT_MM,
} from '../utils/tubularHandleGenerator'

export default function ParameterPanel() {
  const s = useStore()
  const [connectorDriver, setConnectorDriver] = useState('Handle Width')

  useEffect(() => {
    if (s.fabricationMode !== 'printed') s.setFabricationMode('printed')
  }, [s.fabricationMode, s.setFabricationMode])

  const bottomRadiusMm = Math.round((s.cupBottomDiameterMm * 0.5 + s.platformMarginMm) * 10) / 10
  const topRingRadiusMm = Math.round((s.cupTopDiameterMm * 0.5) * 10) / 10
  const handleWidthMm = Math.round((s.handleWidthScale * 10) * 10) / 10
  const topRingOpeningPercent = Math.round((s.topRingOpeningRatio || DEFAULT_TOP_RING_OPENING_RATIO) * 100)
  const connectorThicknessMm = Math.max(
    MIN_TOP_RING_HEIGHT_MM,
    MIN_BOTTOM_PLATFORM_HEIGHT_MM,
    handleWidthMm,
    s.ringHeightMm,
    s.platformThicknessMm,
  )

  useEffect(() => {
    if (handleWidthMm !== connectorThicknessMm) {
      s.setHandleWidthScale(connectorThicknessMm / 10)
    }
    if (s.ringHeightMm !== connectorThicknessMm) {
      s.setRingHeightMm(connectorThicknessMm)
    }
    if (s.platformThicknessMm !== connectorThicknessMm) {
      s.setPlatformThicknessMm(connectorThicknessMm)
    }
  }, [
    handleWidthMm,
    connectorThicknessMm,
    s.ringHeightMm,
    s.platformThicknessMm,
    s.setHandleWidthScale,
    s.setPlatformThicknessMm,
    s.setRingHeightMm,
  ])

  const setConnectorThicknessMm = (driver, thicknessMm) => {
    const safeThickness = Math.max(
      MIN_TOP_RING_HEIGHT_MM,
      MIN_BOTTOM_PLATFORM_HEIGHT_MM,
      Number(thicknessMm) || MIN_TOP_RING_HEIGHT_MM,
    )
    setConnectorDriver(driver)
    s.setHandleWidthScale(safeThickness / 10)
    s.setRingHeightMm(safeThickness)
    s.setPlatformThicknessMm(safeThickness)
  }

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
    setConnectorThicknessMm('Handle Width', widthMm)
  }

  const setTopRingOpeningPercent = (percent) => {
    const safePercent = Math.max(
      MIN_TOP_RING_OPENING_RATIO * 100,
      Math.min(MAX_TOP_RING_OPENING_RATIO * 100, Number(percent) || DEFAULT_TOP_RING_OPENING_RATIO * 100)
    )
    s.setTopRingOpeningRatio(safePercent / 100)
  }

  const sliders = [
    { label: 'Bottom Radius', value: bottomRadiusMm,        set: setBottomRadiusMm,       min: 18, max: 90, step: 0.5, unit: 'mm' },
    { label: 'Bottom Height', value: s.platformThicknessMm, set: (v) => setConnectorThicknessMm('Bottom Height', v), min: MIN_BOTTOM_PLATFORM_HEIGHT_MM, max: 28, step: 0.5, unit: 'mm', drivenBy: connectorDriver !== 'Bottom Height' ? connectorDriver : null },
    { label: 'Top Ring Radius', value: topRingRadiusMm,     set: setTopRingRadiusMm,      min: 18, max: 90, step: 0.5, unit: 'mm' },
    { label: 'Top Ring Thickness', value: s.ringWallThicknessMm, set: s.setRingWallThicknessMm, min: 2, max: 14, step: 0.5, unit: 'mm' },
    { label: 'Ring Opening', value: topRingOpeningPercent,  set: setTopRingOpeningPercent, min: MIN_TOP_RING_OPENING_RATIO * 100, max: MAX_TOP_RING_OPENING_RATIO * 100, step: 1, unit: '%' },
    { label: 'Top Ring Height', value: s.ringHeightMm,      set: (v) => setConnectorThicknessMm('Top Ring Height', v), min: MIN_TOP_RING_HEIGHT_MM, max: 28, step: 0.5, unit: 'mm', drivenBy: connectorDriver !== 'Top Ring Height' ? connectorDriver : null },
    { label: 'Handle Width', value: handleWidthMm,          set: setHandleWidthMm,        min: Math.max(MIN_TOP_RING_HEIGHT_MM, MIN_BOTTOM_PLATFORM_HEIGHT_MM), max: 28, step: 0.5, unit: 'mm', drivenBy: connectorDriver !== 'Handle Width' ? connectorDriver : null },
  ]

  return (
    <div className="param-group">
      <h3>Parameters</h3>

      <div className="param-choice-row">
        <label>Print Mode</label>
        <select value={s.printMode} onChange={e => s.setPrintMode(e.target.value)}>
          <option value="single">Single-piece</option>
          <option value="split">Split print</option>
        </select>
      </div>

      {sliders.map(row => (
        <div
          className={`param-row${row.drivenBy ? ' is-driven' : ''}`}
          key={row.label}
          onPointerDownCapture={() => {
            if (row.drivenBy) setConnectorDriver(row.label)
          }}
          title={row.drivenBy ? `Driven by ${row.drivenBy}` : undefined}
        >
          <label>{row.label}</label>
          <input
            type="range"
            min={row.min}
            max={row.max}
            step={row.step || 1}
            value={row.value}
            disabled={Boolean(row.drivenBy)}
            onChange={e => row.set(Number(e.target.value))}
          />
          <span className="param-val">
            {row.value}{row.unit}
            {row.drivenBy && <small>Driven by {row.drivenBy.replace(' Width', '').replace(' Height', '')}</small>}
          </span>
        </div>
      ))}
    </div>
  )
}
