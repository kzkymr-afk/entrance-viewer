import * as THREE from './vendor/three.module.js';
// Subtract only identified ceiling-board triangles. Every interpolated attribute is retained.
// Cutting triangles at the zone boundaries avoids deleting the rear corridor roof or shared-material equipment.
export function subtractCeilingGeometry(mesh,triangles,boxes){
 const source=mesh.geometry,attributes=Object.entries(source.attributes),eligible=new Set(triangles);
 const offsets=[];let stride=0;for(const [,a] of attributes){offsets.push(stride);stride+=a.itemSize;}
 const output=attributes.map(()=>[]),positionOffset=offsets[attributes.findIndex(([name])=>name==='position')];
 const vector=new THREE.Vector3();
 const vertex=i=>{const data=[];for(const [,a] of attributes)for(let k=0;k<a.itemSize;k++)data.push(a.getComponent(i,k));vector.set(data[positionOffset],data[positionOffset+1],data[positionOffset+2]).applyMatrix4(mesh.matrixWorld);return {data,world:vector.toArray()};};
 const lerp=(a,b,t)=>({data:a.data.map((v,i)=>v+(b.data[i]-v)*t),world:a.world.map((v,i)=>v+(b.world[i]-v)*t)});
 function split(poly,axis,value,sign){const inside=[],outside=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a.world[axis]-value)*sign,db=(b.world[axis]-value)*sign;const ai=da>=-1e-9,bi=db>=-1e-9;(ai?inside:outside).push(a);if(ai!==bi){const v=lerp(a,b,da/(da-db));inside.push(v);outside.push(v);}}return [inside,outside];}
 function subtract(poly,box){let inside=poly;const kept=[];for(const [axis,value,sign] of [[0,box.x0,1],[0,box.x1,-1],[1,box.y0,1],[1,box.y1,-1],[2,box.z0,1],[2,box.z1,-1]]){if(inside.length<3)break;const [a,b]=split(inside,axis,value,sign);if(b.length>=3)kept.push(b);inside=a;}return kept;}
 function emit(a,b,c){const ab=new THREE.Vector3().fromArray(b.world).sub(new THREE.Vector3().fromArray(a.world)),ac=new THREE.Vector3().fromArray(c.world).sub(new THREE.Vector3().fromArray(a.world));if(ab.cross(ac).lengthSq()<1e-18)return;for(const v of [a,b,c])for(let i=0;i<attributes.length;i++){const count=attributes[i][1].itemSize;output[i].push(...v.data.slice(offsets[i],offsets[i]+count));}}
 const count=source.index?.count??source.attributes.position.count;
 for(let at=0;at<count;at+=3){const v=[0,1,2].map(k=>vertex(source.index?source.index.getX(at+k):at+k));let polygons=[v];if(eligible.has(at/3))for(const box of boxes)polygons=polygons.flatMap(poly=>subtract(poly,box));for(const poly of polygons)for(let k=1;k<poly.length-1;k++)emit(poly[0],poly[k],poly[k+1]);}
 const result=new THREE.BufferGeometry();attributes.forEach(([name,a],i)=>result.setAttribute(name,new THREE.Float32BufferAttribute(output[i],a.itemSize)));result.computeBoundingBox();result.computeBoundingSphere();return result;
}
