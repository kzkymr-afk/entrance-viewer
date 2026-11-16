// Short-range, static visibility only. Applied to indirect diffuse in the stairs;
// it neither paints surface color nor replaces direct lighting/specular reflection.
export function attachLocalAO(model,strength=.45){
 const seen=new Set();let meshes=0;
 model.traverse(o=>{if(!o.isMesh||!o.geometry.attributes._r5_occlusion)return;meshes++;for(const m of Array.isArray(o.material)?o.material:[o.material]){
  if(seen.has(m))continue;seen.add(m);const previous=m.onBeforeCompile;
  m.onBeforeCompile=(shader,...args)=>{previous(shader,...args);shader.uniforms.r5AOStrength={value:strength};
   shader.vertexShader='attribute float _r5_occlusion;varying float vR5Occlusion;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvR5Occlusion=_r5_occlusion;');
   shader.fragmentShader='uniform float r5AOStrength;varying float vR5Occlusion;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   bool r5Stair=vR5World.x>3.45&&vR5World.x<5.2&&vR5World.z>-24.9&&vR5World.z<-20.15&&vR5World.y>-.05;
   if(r5Stair)reflectedLight.indirectDiffuse*=mix(1.,clamp(vR5Occlusion,0.,1.),r5AOStrength);
   `);
  };
  m.customProgramCacheKey=()=> 'r5_local_planar_and_stair_occlusion_v2';m.needsUpdate=true;
 }});
 return {meshes,strength,distanceMeters:.35,scope:'existing upward stair; indirect diffuse only'};
}
