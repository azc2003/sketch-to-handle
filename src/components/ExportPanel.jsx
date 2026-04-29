import useStore from '../store'
import { exportSTL } from '../utils/stlExporter'

export default function ExportPanel() {
  const stlBinary = useStore(s => s.stlBinary)
  const setStlBinary = useStore(s => s.setStlBinary)

  const handleExportAssemblySTL = () => {
    const meshes = [...(window.__handleMeshes || [])]
    if (meshes.length > 0) {
      exportSTL(meshes, stlBinary, 'cup_handle_frame.stl')
    } else {
      alert('Draw a handle first!')
    }
  }

  return (
    <>
      <h3 style={{ fontSize: 13, color: '#00BCD4', textTransform: 'uppercase', letterSpacing: .5, margin: '4px 0' }}>Export</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button onClick={handleExportAssemblySTL}>Export STL</button>

        <label style={{ fontSize: 12 }}>
          <input type="checkbox" checked={stlBinary} onChange={e => setStlBinary(e.target.checked)} />
          Binary STL
        </label>
      </div>
    </>
  )
}
