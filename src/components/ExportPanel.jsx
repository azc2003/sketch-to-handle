import useStore from '../store'
import { exportSTL } from '../utils/stlExporter'

export default function ExportPanel() {
  const stlBinary = useStore(s => s.stlBinary)
  const setStlBinary = useStore(s => s.setStlBinary)
  const printMode = useStore(s => s.printMode)

  const handleExportAssemblySTL = () => {
    const meshes = [...(window.__handleMeshes || [])]
    if (meshes.length > 0) {
      exportSTL(meshes, stlBinary, 'cup_handle_frame.stl')
    } else {
      alert('Draw a handle first!')
    }
  }

  const handleExportPartSTL = (parts, filename) => {
    const meshes = [...(window.__handleMeshes || [])].filter(mesh =>
      parts.includes(mesh.userData.part)
    )
    if (meshes.length > 0) {
      exportSTL(meshes, stlBinary, filename)
    } else {
      alert('Draw a handle first!')
    }
  }

  return (
    <>
      <h3 style={{ fontSize: 13, color: '#00BCD4', textTransform: 'uppercase', letterSpacing: .5, margin: '4px 0' }}>Export</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {printMode === 'split' ? (
          <>
            <button onClick={() => handleExportPartSTL(['handle', 'bottomPlatform'], 'cup_handle_base.stl')}>Export Handle + Base</button>
            <button onClick={() => handleExportPartSTL(['topRing'], 'cup_handle_top_ring.stl')}>Export Top Ring</button>
            <button onClick={handleExportAssemblySTL}>Export Assembly STL</button>
          </>
        ) : (
          <button onClick={handleExportAssemblySTL}>Export STL</button>
        )}

        <label style={{ fontSize: 12 }}>
          <input type="checkbox" checked={stlBinary} onChange={e => setStlBinary(e.target.checked)} />
          Binary STL
        </label>
      </div>
    </>
  )
}
