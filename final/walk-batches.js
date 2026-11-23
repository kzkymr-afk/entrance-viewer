import * as THREE from 'three';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';

// Combine opaque surfaces sharing the same finish. Glass stays separate for depth sorting.
export function batchWalkMeshes(root) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  root.traverse(mesh => {
    if (!mesh.isMesh || mesh.isInstancedMesh || mesh.material.transparent || Array.isArray(mesh.material)) return;
    const geometry = mesh.geometry;
    if (!geometry.index || mesh.matrixWorld.determinant() <= 0) return;
    const attributes = Object.keys(geometry.attributes).filter(k => ['position','color','uv','uv1'].includes(k)).sort();
    const key = [mesh.material.uuid,...attributes].join('/');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({mesh, attributes});
  });
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const parts = group.map(({mesh,attributes}) => {
      const part = new THREE.BufferGeometry();
      for (const name of attributes) part.setAttribute(name, mesh.geometry.getAttribute(name).clone());
      part.setIndex(mesh.geometry.index);
      return part.applyMatrix4(mesh.matrixWorld);
    });
    const geometry = mergeGeometries(parts);
    if (!geometry) continue;
    geometry.computeBoundingSphere();
    const batch = new THREE.Mesh(geometry,group[0].mesh.material);
    root.add(batch);
    // A mesh can have visible children. Keep the hierarchy and suppress only its draw call.
    for (const {mesh} of group) {
      if (mesh.children.length) mesh.layers.disable(0);
      else mesh.removeFromParent();
    }
  }
}
