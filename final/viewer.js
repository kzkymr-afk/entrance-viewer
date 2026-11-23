import * as THREE from 'three';
import {RenderedRoom} from './rendered-room.js?v=27';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {batchWalkMeshes} from './walk-batches.js';
const el=id=>document.getElementById(id);
const scheme=el('scheme'),view=el('view'),status=el('status'),still=el('still'),host=el('viewport');
const presetNames={entry:'PROPOSAL entry',ceiling:'PROPOSAL entry',rear:'PROPOSAL rear',vending:'Vending to EV'};
const keys=new Set(),cache=new Map();
const roomViews=new RenderedRoom();
let renderer,scene,camera,current,grid,catalog,yaw=0,pitch=0,pending=false,staticMode=false,failed=false,token=0,drag=null,lastTime=0;
function resize(){if(!renderer)return;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setPixelRatio(Math.min(devicePixelRatio,2048/w,1440/h));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();draw();}
function draw(){if(!pending&&renderer&&!staticMode){pending=true;requestAnimationFrame(frame);}}
function passable(x,z){const i=Math.floor((x-grid.originX)/grid.cellSize),j=Math.floor((z-grid.originZ)/grid.cellSize);return i>=0&&j>=0&&i<grid.width&&j<grid.height&&!grid.blocked[j*grid.width+i];}
function frame(now){
 pending=false;if(staticMode||!current)return;
 const dt=Math.min((now-lastTime)/1000,.06);lastTime=now;
 const forward=Number(keys.has('w'))-Number(keys.has('s')),side=Number(keys.has('d'))-Number(keys.has('a'));
 if(forward||side){const speed=dt*1.6/Math.hypot(forward,side),p=camera.position;
  const x=p.x+(-Math.sin(yaw)*forward+Math.cos(yaw)*side)*speed,z=p.z+(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*speed;
  if(passable(x,p.z))p.x=x;if(passable(p.x,z))p.z=z;}
 camera.rotation.set(pitch,yaw,0,'YXZ');
 renderer.render(scene,camera);if(keys.size)draw();
}

function preset(){still.src=scheme.value+'_'+view.value+'.jpg';if(!catalog||!camera)return;
 const [p,d,lens]=catalog[scheme.value].cameras[presetNames[view.value]];camera.position.fromArray(p);yaw=Math.atan2(-d[0],-d[2]);pitch=view.value==='ceiling'?Math.PI/6:Math.asin(d[1]);camera.fov=2*Math.atan(22.5/(2*lens))*180/Math.PI;camera.updateProjectionMatrix();draw();}
function mode(enable){staticMode=enable;still.hidden=!enable;el('mode').textContent=enable?'3Dに戻る':'最終パースを表示';el('mode').setAttribute('aria-pressed',String(enable));status.textContent='';keys.clear();if(!enable){if(failed){load();return;}draw();}}
async function json(url){const r=await fetch(url);if(!r.ok)throw Error(url);return r.json();}
function init(){
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;host.append(renderer.domElement);
 scene=new THREE.Scene();scene.background=new THREE.Color(0xbbc5c5);camera=new THREE.PerspectiveCamera(56,1,.045,100);
 const canvas=renderer.domElement;
 canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);};
 canvas.onpointermove=e=>{if(!drag)return;yaw-=(e.clientX-drag[0])*.004;pitch=THREE.MathUtils.clamp(pitch-(e.clientY-drag[1])*.004,-1.48,1.48);drag=[e.clientX,e.clientY];draw();};
 canvas.onlostpointercapture=()=>drag=null;new ResizeObserver(resize).observe(host);resize();
}
async function load(){
 const seq=++token,key=scheme.value;failed=false;preset();status.textContent='高画質の空間を読み込み中…';
 try{
  if(!renderer)init();
  if(!catalog)[catalog,grid]=await Promise.all([json('views.json'),json('../collision.json')]);
  if(!cache.has(key)){const task=(async()=>{const r=await fetch(key+'.glb.gz?v=23');if(!r.ok)throw Error(r.status);
   const buf=await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
   const gltf=await new GLTFLoader().parseAsync(buf,new URL('./',location.href).href);
   // Rendered panoramas supply the lighting during movement.
   const materials=new Map();
   function realtime(m){
    if(materials.has(m))return materials.get(m);
    const simple=new THREE.MeshBasicMaterial();
    for(const key of ['name','map','transparent','opacity','alphaTest','side','vertexColors','depthWrite'])if(m[key]!==undefined)simple[key]=m[key];
    simple.color.copy(m.color);if(m.emissiveIntensity>0 && m.emissive) simple.color.add(m.emissive);
    if(m.transmission>.2){simple.transparent=true;simple.opacity=Math.min(simple.opacity,.24);simple.depthWrite=false;}
    if(m.name.includes('smoked warm oak')){simple.color.setRGB(.18,.087,.036);}
    roomViews.apply(simple); materials.set(m,simple);return simple;
   }
   gltf.scene.traverse(o=>{if(o.isMesh)o.material=Array.isArray(o.material)?o.material.map(realtime):realtime(o.material);});
   batchWalkMeshes(gltf.scene);
   const images=await roomViews.prepare(key,catalog[key].cameras);
   return {mesh:gltf.scene,images};})();cache.set(key,task);task.catch(()=>cache.delete(key));}
  const model=await cache.get(key);if(seq!==token)return;if(current)scene.remove(current);current=model.mesh;roomViews.use(model.images);scene.add(current);preset();status.textContent='';draw();
 }catch(e){if(seq!==token)return;console.error(e);mode(true);failed=true;status.textContent='3Dを読み込めませんでした。最終パースを表示中です。';}
}
scheme.onchange=()=>{preset();load();};view.onchange=preset;el('reset').onclick=preset;el('mode').onclick=()=>mode(!staticMode);
const arrows={ArrowUp:'w',ArrowDown:'s',ArrowLeft:'a',ArrowRight:'d'};
for(const ev of ['keydown','keyup'])addEventListener(ev,e=>{if((e.target.tagName==='SELECT' && e.key.startsWith('Arrow'))||staticMode)return;const k=arrows[e.key]||e.key.toLowerCase();if(!'wasd'.split('').includes(k))return;e.preventDefault();if(ev==='keydown')keys.add(k);else keys.delete(k);draw();});
addEventListener('blur',()=>keys.clear());
for(const b of document.querySelectorAll('[data-key]')){b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);draw();};b.onlostpointercapture=()=>keys.delete(b.dataset.key);}
const params=new URLSearchParams(location.search);const initialView=params.get('view');if(Object.hasOwn(presetNames,initialView))view.value=initialView;const requested=params.get('scheme');if(['coffer','panel','wood'].includes(requested))scheme.value=requested;load();
