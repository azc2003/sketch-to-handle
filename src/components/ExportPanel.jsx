import useStore from '../store'
import { exportSTL } from '../utils/stlExporter'
import { downloadDXF } from '../utils/dxfExporter'
import { generateSleevePattern } from '../utils/sleeveGenerator'

export default function ExportPanel() {
  const fabricationMode = useStore(s => s.fabricationMode)
  const handleMode = useStore(s => s.handleMode)
  const handleHeightM = useStore(s => s.handleHeightM)
  const cupTopDiameterMm = useStore(s => s.cupTopDiameterMm)
  const cupBottomDiameterMm = useStore(s => s.cupBottomDiameterMm)
  const sleeveStyle = useStore(s => s.sleeveStyle)
  const sleeveSlitAngleDeg = useStore(s => s.sleeveSlitAngleDeg)
  const stlBinary = useStore(s => s.stlBinary)
  const setStlBinary = useStore(s => s.setStlBinary)

  const handleExportAssemblySTL = () => {
    const meshes = [...(window.__handleMeshes || [])]
    if (meshes.length > 0) {
      const filename = handleMode === 'foldable' ? 'cup_handle_foldable.stl' : 'cup_assembly.stl'
      exportSTL(meshes, stlBinary, filename)
    } else {
      alert('Draw a handle first!')
    }
  }

  const handleExportPartSTL = (part, filename) => {
    const meshes = [...(window.__handleMeshes || [])].filter(mesh => mesh.userData?.part === part)
    if (meshes.length > 0) {
      exportSTL(meshes, stlBinary, filename)
    } else {
      alert('Draw a handle first!')
    }
  }

  const handleExportSleeveDXF = () => {
    const pattern = generateSleevePattern({
      topDiameterMm: cupTopDiameterMm,
      bottomDiameterMm: cupBottomDiameterMm,
      heightMm: Math.max(20, handleHeightM * 1000),
      slitAngleDeg: sleeveSlitAngleDeg,
      style: sleeveStyle,
      includeJointSlots: true,
    })
    downloadDXF(pattern.pieces, `cup_sleeve_${sleeveStyle}.dxf`)
  }

  const isHybrid = fabricationMode === 'hybrid'

  return (
    <>
      <h3 style={{ fontSize: 13, color: '#00BCD4', textTransform: 'uppercase', letterSpacing: .5, margin: '4px 0' }}>Export</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {!isHybrid && (
          <>
            <button onClick={handleExportAssemblySTL}>Export Assembly STL</button>
            <button onClick={() => handleExportPartSTL('handle', 'cup_handle_dovetail.stl')}>Export Handle STL</button>
            <button onClick={() => handleExportPartSTL('topRing', 'cup_split_top_ring.stl')}>Export Top Ring STL</button>
            <button onClick={() => handleExportPartSTL('bottomPlatform', 'cup_bottom_platform.stl')}>Export Bottom Platform STL</button>
          </>
        )}

        {isHybrid && (
          <>
            <button onClick={() => handleExportPartSTL('handle', 'cup_handle_hybrid.stl')}>Export Handle STL</button>
            <button onClick={handleExportSleeveDXF}>Export Sleeve DXF</button>
          </>
        )}

        <label style={{ fontSize: 12 }}>
          <input type="checkbox" checked={stlBinary} onChange={e => setStlBinary(e.target.checked)} />
          Binary STL
        </label>
      </div>
    </>
  )
}
