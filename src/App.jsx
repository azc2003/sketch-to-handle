import Toolbar from './components/Toolbar'
import PhotoCanvas from './components/PhotoCanvas'
import ParameterPanel from './components/ParameterPanel'
import Preview3D from './components/Preview3D'
import ExportPanel from './components/ExportPanel'
import StrengthReport from './components/StrengthReport'

export default function App() {
  return (
    <div className="app">
      <div className="header">
        <h1>Sketch to Handle</h1>
        <span>Draw a cup handle and export 3D-print or hybrid laser-cut parts</span>
      </div>
      <div className="main-layout">
        <Toolbar />
        <div className="content-grid">
          <div className="cell-canvas">
            <PhotoCanvas />
          </div>
          <div className="cell-3d">
            <Preview3D />
          </div>
          <div className="cell-params">
            <ParameterPanel />
          </div>
          <div className="cell-output">
            <div className="output-strength">
              <StrengthReport />
            </div>
            <div className="output-export">
              <ExportPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
