import * as THREE from 'three';
import { RenderedRoom } from './rendered-room.js';
const el = id => document.getElementById(id);
const host = el('viewport'), scheme = el('scheme'), view = el('view');
const status = el('status'), still = el('still'), mode = el('mode');
const names = {entry:'PROPOSAL entry', ceiling:'PROPOSAL entry', rear:'PROPOSAL rear', vending:'Vending to EV'};
let renderer, room, camera, catalog, texture, activeURL, sequence = 0;
let yaw = 0, pitch = 0, drag, frame, showStill = false;
function draw() {
  if (frame || !texture || showStill) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    renderer.render(room.scene, camera);
  });
}
function rotate(x, y) {
  yaw += x;
  pitch = THREE.MathUtils.clamp(pitch+y,-1.55,1.55);
  draw();
}
function reset() {
  if (!catalog) return;
  const [, direction, lens] = catalog[scheme.value][names[view.value]];
  yaw = Math.atan2(-direction[0], -direction[2]);
  pitch = view.value === 'ceiling' ? Math.PI/6 : Math.asin(direction[1]);
  camera.fov = THREE.MathUtils.radToDeg(2*Math.atan(22.5/(2*lens)));
  camera.updateProjectionMatrix();
  draw();
}
function displayStill(on) {
  showStill = on;
  still.hidden = !on;
  mode.textContent = on ? '360°に戻る' : '最終パースを表示';
  mode.setAttribute('aria-pressed',String(on));
  if (on) still.src = scheme.value+'_'+view.value+'.jpg';
}
async function load() {
  const ticket = ++sequence;
  reset();
  if (showStill || !renderer) { displayStill(true); return; }
  const position = view.value === 'ceiling' ? 'entry' : view.value;
  const url = scheme.value+'_'+position+'_360.jpg';
  if (url === activeURL) { status.textContent = ''; draw(); return; }
  status.textContent = '360°画像を読み込み中…';
  try {
    const next = await room.loader.loadAsync(url);
    if (ticket !== sequence) { next.dispose(); return; }
    next.minFilter = THREE.LinearFilter;
    next.generateMipmaps = false;
    next.wrapS = THREE.RepeatWrapping;
    room.material.uniforms.image.value = next;
    texture?.dispose();
    texture = next;
    activeURL = url;
    status.textContent = '';
    draw();
  } catch {
    if (ticket === sequence) { displayStill(true); status.textContent = 'パースを表示中'; }
  }
}
scheme.onchange = view.onchange = load;
el('reset').onclick = reset;
mode.onclick = () => { displayStill(!showStill); status.textContent = ''; load(); };
try {
  catalog = await (await fetch('panorama-cameras.json')).json();
  renderer = new THREE.WebGLRenderer({antialias:false, powerPreference:'low-power', alpha:false});
  room = new RenderedRoom();
  camera = new THREE.PerspectiveCamera(55,1,.1,50);
  host.append(renderer.domElement);
  new ResizeObserver(() => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(1,1600/w,1000/h));
    renderer.setSize(w,h,false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
    draw();
  }).observe(host);
  const canvas = renderer.domElement;
  canvas.onpointerdown = e => {drag = [e.clientX,e.clientY]; canvas.setPointerCapture(e.pointerId);};
  canvas.onpointermove = e => {
    if (!drag) return;
    rotate((drag[0]-e.clientX)*.004,(drag[1]-e.clientY)*.004);
    drag = [e.clientX,e.clientY];
  };
  canvas.onlostpointercapture = () => drag = null;
  addEventListener('keydown',e => {
    if (showStill || e.target.tagName === 'SELECT') return;
    const turns = {ArrowLeft:[.06,0],ArrowRight:[-.06,0],ArrowUp:[0,.06],ArrowDown:[0,-.06]};
    if (turns[e.key]) {e.preventDefault(); rotate(...turns[e.key]);}
  });
  await load();
} catch {
  catalog = null;
  displayStill(true);
  mode.hidden = true;
  status.textContent = 'パースを表示中';
}
