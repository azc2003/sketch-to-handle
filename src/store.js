import { create } from 'zustand'

const useStore = create((set) => ({
  // Image
  image: null,
  setImage: (img) => set({ image: img }),

  // Bezier anchor points (normalized 0-1)
  curvePoints: [],
  addCurvePoint: (pt) => set((s) => ({ curvePoints: [...s.curvePoints, pt] })),
  insertCurvePoint: (index, pt) => set((s) => {
    const i = Math.max(0, Math.min(index, s.curvePoints.length))
    const next = s.curvePoints.slice()
    next.splice(i, 0, pt)
    return { curvePoints: next }
  }),
  removeCurvePoint: (index) => set((s) => {
    if (index < 0 || index >= s.curvePoints.length) return {}
    const next = s.curvePoints.slice()
    next.splice(index, 1)
    return { curvePoints: next }
  }),
  updateCurvePoint: (index, pt) => set((s) => {
    if (index < 0 || index >= s.curvePoints.length) return {}
    const next = s.curvePoints.slice()
    next[index] = pt
    return { curvePoints: next }
  }),
  undoCurvePoint: () => set((s) => ({ curvePoints: s.curvePoints.slice(0, -1) })),
  clearCurvePoints: () => set({ curvePoints: [] }),

  // Path smoothing
  smoothLevel: 3,
  setSmoothLevel: (v) => set({ smoothLevel: v }),

  // Handle physical parameters
  fabricationMode: 'printed',
  setFabricationMode: (v) => set({ fabricationMode: v }),
  handleMode: 'tubular',
  setHandleMode: (v) => set({ handleMode: v }),
  handleHeightM: 0.12,
  setHandleHeightM: (v) => set({ handleHeightM: v }),
  handleWidthScale: 1.0,
  setHandleWidthScale: (v) => set({ handleWidthScale: v }),
  handleDepthScale: 1.6,
  setHandleDepthScale: (v) => set({ handleDepthScale: v }),

  // Hybrid laser-cut sleeve options
  sleeveStyle: 'tapered',
  setSleeveStyle: (v) => set({ sleeveStyle: v }),
  sleeveSlitAngleDeg: 8,
  setSleeveSlitAngleDeg: (v) => set({ sleeveSlitAngleDeg: v }),

  // Cup geometry
  cupTopDiameterMm: 50,
  setCupTopDiameterMm: (v) => set({ cupTopDiameterMm: v }),
  cupBottomDiameterMm: 50,
  setCupBottomDiameterMm: (v) => set({ cupBottomDiameterMm: v }),
  ringClearanceMm: 1.5,
  setRingClearanceMm: (v) => set({ ringClearanceMm: v }),
  ringWallThicknessMm: 4,
  setRingWallThicknessMm: (v) => set({ ringWallThicknessMm: v }),
  ringHeightMm: 8,
  setRingHeightMm: (v) => set({ ringHeightMm: v }),
  platformMarginMm: 6,
  setPlatformMarginMm: (v) => set({ platformMarginMm: v }),
  platformThicknessMm: 5,
  setPlatformThicknessMm: (v) => set({ platformThicknessMm: v }),
  filledWeightG: 450,
  setFilledWeightG: (v) => set({ filledWeightG: v }),
  targetSafetyFactor: 5.0,
  setTargetSafetyFactor: (v) => set({ targetSafetyFactor: v }),

  // Dovetail fit between printed parts
  jointClearanceMm: 0.2,
  setJointClearanceMm: (v) => set({ jointClearanceMm: v }),

  // Export options
  stlBinary: true,
  setStlBinary: (v) => set({ stlBinary: v }),
}))

export default useStore
