import * as THREE from './vendor/three.module.js';
let seed=1347;
function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function microTexture(){const pixels=new Uint8Array(128*128*4);for(let i=0;i<pixels.length;i+=4){const v=118+Math.floor(random()*22);pixels.set([v,v,v,255],i);}const t=new THREE.DataTexture(pixels,128,128,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(24,24);t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;}
export function surfaceMaterial(kind,color,roughness,metalness=0){
 const m=new THREE.MeshStandardMaterial({color,roughness,metalness});m.name='ceiling-'+kind;m.bumpMap=microTexture();m.bumpScale=kind==='wood'?.00018:.00009;
 m.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vCeilingWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
vec4 ceilingP=vec4(transformed,1.0);
#ifdef USE_INSTANCING
ceilingP=instanceMatrix*ceilingP;
#endif
vCeilingWorld=(modelMatrix*ceilingP).xyz;`);
  shader.fragmentShader=`varying vec3 vCeilingWorld;
float ceilingHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float ceilingNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(ceilingHash(i),ceilingHash(i+vec2(1,0)),f.x),mix(ceilingHash(i+vec2(0,1)),ceilingHash(i+vec2(1,1)),f.x),f.y);}
`+shader.fragmentShader;
  const grain=kind==='wood'?`float ceilingWarp=ceilingNoise(vec2(vCeilingWorld.x*.45,vCeilingWorld.z*19.));
float ceilingGrain=.5+.5*sin(vCeilingWorld.z*1350.+ceilingWarp*13.+sin(vCeilingWorld.x*3.)*.5);
float ceilingPore=smoothstep(.7,.99,ceilingGrain);
float ceilingFigure=ceilingNoise(vec2(vCeilingWorld.x*.45,vCeilingWorld.z*165.+ceilingWarp*2.));
diffuseColor.rgb*=.73+.35*ceilingFigure-.06*ceilingPore;`:`diffuseColor.rgb*=.992+.016*ceilingNoise(vCeilingWorld.xz*165.);`;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+grain);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+(ceilingNoise(vCeilingWorld.xz*95.)-.5)*.045,.1,.98);');
 };m.customProgramCacheKey=()=> 'ceiling-quality-surface-v2-'+kind;return m;
}
export function kelvinColor(k){const t=Math.max(1800,Math.min(6500,k))/100;const r=t<=66?255:329.698727446*Math.pow(t-60,-.1332047592),g=t<=66?99.4708025861*Math.log(t)-161.1195681661:288.1221695283*Math.pow(t-60,-.0755148492),b=t>=66?255:t<=19?0:138.5177312231*Math.log(t-10)-305.0447927307;return new THREE.Color().setRGB(...[r,g,b].map(v=>Math.max(0,Math.min(255,v))/255),THREE.SRGBColorSpace);}
export function emitter(role,offset=0){const m=new THREE.MeshStandardMaterial({color:'#fff5e7',emissive:'#ffffff',emissiveIntensity:role==='cove'?3.6:2.7,roughness:.35});m.name='ceiling-emitter-'+role;m.userData={ceilingEmitter:true,baseEmission:m.emissiveIntensity,kelvinOffset:offset};return m;}
