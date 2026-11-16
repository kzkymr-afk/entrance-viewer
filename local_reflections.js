import * as THREE from 'three';
import { Reflector } from './vendor/addons/objects/Reflector.js';

// A view-dependent planar capture only for the coplanar EV front region.
// No architecture, albedo, physical roughness or metalness is changed.
export function createLocalReflections(renderer,scene,camera,model){
 const mirrors=[1024,512].map(size=>{const mirror=new Reflector(new THREE.PlaneGeometry(5.3,3.1),{textureWidth:size,textureHeight:size,clipBias:.0003,multisample:0});mirror.position.set(5.885,1.55,-16.55);mirror.rotation.y=-Math.PI/2;mirror.updateMatrixWorld(true);const target=mirror.getRenderTarget();target.texture.generateMipmaps=true;target.texture.minFilter=THREE.LinearMipmapLinearFilter;return mirror;});
 let mirror=mirrors[0];const target=mirror.getRenderTarget();
 const matrix=new THREE.Matrix4(),inverse=mirror.matrixWorld.clone().invert();
 const uniforms={r5Planar:{value:target.texture},r5Projection:{value:matrix},r5Active:{value:0},r5Capture:{value:0}};
 const materials=new Set();
 model.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.name==='Brushed stainless steel'||m.name==='Observed gray green vertically veined polished stone')materials.add(m)});
 for(const m of materials){
  m.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,uniforms);
   shader.vertexShader='uniform mat4 r5Projection; varying vec4 vR5Projection; varying vec3 vR5World;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvR5World=worldPosition.xyz;vR5Projection=r5Projection*worldPosition;');
   shader.fragmentShader='uniform sampler2D r5Planar;uniform float r5Active;uniform float r5Capture;varying vec4 vR5Projection;varying vec3 vR5World;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',`#include <lights_fragment_maps>
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
vec3 r5N=inverseTransformDirection(geometryNormal,viewMatrix);
bool r5Surface=vR5World.x>5.83&&vR5World.x<5.95&&vR5World.z>-19.18&&vR5World.z<-13.2&&abs(r5N.x)>.95;
// Coplanar receiver backs must not reflect themselves in the virtual camera.
if(r5Capture>.5&&r5Surface)discard;
if(r5Active>.5&&r5Surface&&vR5Projection.w>0.){
 vec2 r5UV=vR5Projection.xy/vR5Projection.w;
 float r5Edge=smoothstep(0.,.025,min(min(r5UV.x,r5UV.y),min(1.-r5UV.x,1.-r5UV.y)));
 if(r5Edge>0.){
  float r5Lod=clamp(material.roughness*15.,0.,7.);
  vec3 r5Local=textureLod(r5Planar,r5UV,r5Lod).rgb;
  radiance=mix(radiance,r5Local,r5Edge);
 }
}
#endif
`);
  };
  m.customProgramCacheKey=()=> 'r5_ev_local_planar_radiance_v1';m.needsUpdate=true;
 }
 const bounds=new THREE.Box3(new THREE.Vector3(5.8,0,-19.2),new THREE.Vector3(6.04,3.1,-13.2));
 const frustum=new THREE.Frustum(),viewProjection=new THREE.Matrix4();let captures=0,wasVisible=false,dirty=true,lastCamera='';
 return {setDetail(scale){const next=mirrors[scale<.9?1:0];if(next===mirror)return false;mirror=next;uniforms.r5Planar.value=mirror.getRenderTarget().texture;dirty=true;return true;},async prepare(){const previous=renderer.getRenderTarget();try{renderer.setRenderTarget(target);await renderer.compileAsync(scene,camera);}finally{renderer.setRenderTarget(previous);}},invalidate(){dirty=true;},update(){
  camera.updateMatrixWorld();viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(viewProjection);
  const visible=camera.position.x<5.83&&frustum.intersectsBox(bounds);
  const key=camera.matrixWorld.elements.join(',')+';'+camera.projectionMatrix.elements.join(',');
  uniforms.r5Active.value=visible?1:0;
  if(visible&&(dirty||key!==lastCamera||!wasVisible)){uniforms.r5Capture.value=1;try{mirror.onBeforeRender(renderer,scene,camera);}finally{uniforms.r5Capture.value=0;}matrix.copy(mirror.material.uniforms.textureMatrix.value).multiply(inverse);uniforms.r5Active.value=1;captures++;dirty=false;lastCamera=key;}
  wasVisible=visible;
 },get diagnostics(){return {captures,active:wasVisible,planeX:5.885,resolution:[mirror.getRenderTarget().width,mirror.getRenderTarget().height],physicalMaterialsChanged:false}},dispose(){for(const m of mirrors){m.dispose();m.geometry.dispose();}}};
}
