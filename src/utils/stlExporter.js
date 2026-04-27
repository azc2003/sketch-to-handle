import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import * as THREE from 'three'

/**
 * 导出场景中的几何体为 STL 文件并下载
 * @param {THREE.Mesh[]} meshes - 要导出的网格数组
 * @param {boolean} binary - 是否二进制格式
 * @param {string} filename - 文件名
 */
export function exportSTL(meshes, binary = true, filename = 'handle_export.stl') {
  if (!meshes || meshes.length === 0) {
    alert('No handle geometry to export. Draw a path first!')
    return
  }

  // 创建临时场景，放入所有 mesh
  const scene = new THREE.Scene()
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false)
    const clone = mesh.clone()
    clone.geometry = mesh.geometry.clone()
    clone.geometry.applyMatrix4(mesh.matrixWorld)
    clone.position.set(0, 0, 0)
    clone.rotation.set(0, 0, 0)
    clone.scale.set(1, 1, 1)
    clone.updateMatrix()
    scene.add(clone)
  }

  const exporter = new STLExporter()
  const result = exporter.parse(scene, { binary })

  // 下载
  let blob
  if (binary) {
    blob = new Blob([result], { type: 'application/octet-stream' })
  } else {
    blob = new Blob([result], { type: 'text/plain' })
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
