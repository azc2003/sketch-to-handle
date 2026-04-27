import useStore from '../store'
import { exportSTL } from '../utils/stlExporter'

export default function ExportPanel() {
  const handleMode = useStore(s => s.handleMode)
  const stlBinary = useStore(s => s.stlBinary)
  const setStlBinary = useStore(s => s.setStlBinary)

  const handleExportSTL = () => {
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

  return (
    <>
      <h3 style={{ fontSize: 13, color: '#00BCD4', textTransform: 'uppercase', letterSpacing: .5, margin: '4px 0' }}>Export</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button onClick={handleExportSTL}>Export Assembly STL</button>
        <button onClick={() => handleExportPartSTL('handle', 'cup_handle_dovetail.stl')}>Export Handle STL</button>
        <button onClick={() => handleExportPartSTL('topRing', 'cup_split_top_ring.stl')}>Export Top Ring STL</button>
        <button onClick={() => handleExportPartSTL('bottomPlatform', 'cup_bottom_platform.stl')}>Export Bottom Platform STL</button>
        <label style={{ fontSize: 12 }}>
          <input type="checkbox" checked={stlBinary} onChange={e => setStlBinary(e.target.checked)} />
          Binary STL
        </label>
      </div>
    </>
  )
}
