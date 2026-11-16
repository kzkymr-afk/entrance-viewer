import * as THREE from './vendor/three.module.js';
import {RoundedBoxGeometry} from './vendor/addons/geometries/RoundedBoxGeometry.js';
import {ZONES,OUTLINE,COFFERS,LIGHTING_DEFAULTS,CEILING_HEIGHTS} from './ceiling-layout.js';
import {surfaceMaterial,emitter,kelvinColor} from './ceiling-materials.js';
import {subtractCeilingGeometry} from './ceiling-geometry.js';
export const CEILING_OPTIONS=Object.freeze([{id:'existing',label:'現状'},{id:'coffer',label:'折り上げ天井'},{id:'panel',label:'パネル'},{id:'wood',label:'木ルーバー'}]);
function batch(group,mat,items,geometry){if(!items.length){geometry.dispose();return;}const mesh=new THREE.InstancedMesh(geometry,mat,items.length),m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),p=new THREE.Vector3();items.forEach((a,i)=>{q.setFromEuler(new THREE.Euler(a[6]||0,a[7]||0,a[8]||0));m.compose(p.set(a[0],a[1],a[2]),q,s.set(a[3],a[4],a[5]));mesh.setMatrixAt(i,m);if(mat.name==='ceiling-wood')mesh.setColorAt(i,new THREE.Color().setRGB(1-(i*17%13)*.006,1-(i*7%11)*.006,1-(i*3%7)*.006));});mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=mat.name;group.add(mesh);return mesh;}
function area(g,pos,target,width,height,intensity,offset=0){const l=new THREE.RectAreaLight(0xffffff,intensity,width,height);l.position.set(...pos);l.lookAt(...target);l.userData={ceilingEmitter:true,baseIntensity:intensity,kelvinOffset:offset};g.add(l);return l;}
function generateGroups(){
 const groups=new Map(CEILING_OPTIONS.slice(1).map(o=>[o.id,new THREE.Group()])),co=groups.get('coffer'),pa=groups.get('panel'),wo=groups.get('wood');
 const paint=surfaceMaterial('paint','#dedbd3',.78),tile=surfaceMaterial('panel','#d4cec2',.57),black=surfaceMaterial('black-painted-services','#303536',.72,.12),joint=surfaceMaterial('panel-joint','#858078',.85),wood=surfaceMaterial('wood','#9b683f',.54),slab=surfaceMaterial('exposed-slab','#191d1e',.91);
 const cove=emitter('cove'),coDown=emitter('downlight',300),panelDown=emitter('downlight'),woodStrip=emitter('linear');
 const box=()=>new THREE.BoxGeometry(1,1,1),cylinder=()=>new THREE.CylinderGeometry(.5,.5,1,20);
 // Two large recesses reflect the approach / waiting space in the actual A-02 plan.
 const shape=new THREE.Shape();OUTLINE.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();
 for(const c of COFFERS){const path=new THREE.Path();path.moveTo(c.x0,c.z0);path.lineTo(c.x1,c.z0);path.lineTo(c.x1,c.z1);path.lineTo(c.x0,c.z1);path.closePath();shape.holes.push(path);}
 const frameGeometry=new THREE.ExtrudeGeometry(shape,{depth:CEILING_HEIGHTS.cofferRiserTop-CEILING_HEIGHTS.soffit,bevelEnabled:true,bevelThickness:.002,bevelSize:.002,bevelSegments:1,steps:1});frameGeometry.rotateX(Math.PI/2);frameGeometry.translate(0,CEILING_HEIGHTS.cofferRiserTop,0);const frame=new THREE.Mesh(frameGeometry,paint);frame.name='ceiling-coffer-frame';frame.castShadow=frame.receiveShadow=true;co.add(frame);
 const outer=new THREE.Shape();OUTLINE.forEach(([x,z],i)=>i?outer.lineTo(x,z):outer.moveTo(x,z));outer.closePath();const capGeometry=new THREE.ExtrudeGeometry(outer,{depth:.025,bevelEnabled:false});capGeometry.rotateX(Math.PI/2);capGeometry.translate(0,3.27,0);const cap=new THREE.Mesh(capGeometry,paint);cap.name='ceiling-coffer-upper-closure';co.add(cap);
 const upperReturns=[];for(let i=0;i<OUTLINE.length;i++){const a=OUTLINE[i],b=OUTLINE[(i+1)%OUTLINE.length],dx=b[0]-a[0],dz=b[1]-a[1];upperReturns.push([(a[0]+b[0])/2,3.205,(a[1]+b[1])/2,Math.hypot(dx,dz),.13,.025,0,-Math.atan2(dz,dx)]);}batch(co,paint,upperReturns,box());
 const raised=[],lips=[],ledges=[],glows=[],housings=[],discs=[];
 for(const c of COFFERS){const w=c.x1-c.x0,l=c.z1-c.z0,cx=(c.x0+c.x1)/2,cz=(c.z0+c.z1)/2;
  raised.push([cx,CEILING_HEIGHTS.raised+.015,cz,w+.016,.03,l+.016]);
  for(const x of [c.x0,c.x1]){lips.push([x,3.15,cz,.025,.04,l]);ledges.push([x+(x===c.x0?-.04:.04),3.148,cz,.10,.014,l]);glows.push([x+(x===c.x0?-.025:.025),3.162,cz,.018,.006,l-.06]);area(co,[x+(x===c.x0?.055:-.055),3.155,cz],[x+(x===c.x0?.055:-.055),CEILING_HEIGHTS.raised,cz],.085,l-.06,6);}
  for(const z of [c.z0,c.z1]){lips.push([cx,3.15,z,w,.04,.025]);glows.push([cx,3.162,z+(z===c.z0?-.025:.025),w-.04,.006,.018]);}
  const sideX=[c.x0*.48,c.x1+(c.id==='hall'?5.865:4.335)-c.x1];sideX[1]=c.x1+((c.id==='hall'?5.865:4.335)-c.x1)*.5;
  for(let z=c.z0+.9;z<c.z1-.35;z+=2.8)for(const x of sideX){housings.push([x,2.802,z,.095,.022,.095]);discs.push([x,2.787,z,.067,.006,.067]);}
 }
 // Broad point lights are indirect fill; do not project cove hardware shadows onto the raised plane.
 // The rectangular cove emitters supply its continuous light gradient.
 const raisedMesh=batch(co,paint,raised,box());raisedMesh.name='ceiling-coffer-raised';raisedMesh.receiveShadow=false;batch(co,paint,lips,box());batch(co,paint,ledges,box());batch(co,cove,glows,box());batch(co,black,housings,cylinder());batch(co,coDown,discs,cylinder());
 // Satin panels have real thickness, fine bevels, and backed grey joints rather than black cracks.
 const panelSlots=[],panelHousings=[],panelDiscs=[];
 for(const z of ZONES){const w=z.x1-z.x0,l=z.z1-z.z0,cx=(z.x0+z.x1)/2,cz=(z.z0+z.z1)/2,cols=Math.round(w/1.05),rows=Math.round(l/1.2),dx=w/cols,dz=l/rows;
  batch(pa,joint,[[cx,3.064,cz,w,.035,l]],box());const tiles=[];for(let a=0;a<cols;a++)for(let b=0;b<rows;b++)tiles.push([z.x0+(a+.5)*dx,3.043,z.z0+(b+.5)*dz,1,1,1]);batch(pa,tile,tiles,new RoundedBoxGeometry(dx-.0025,.034,dz-.0025,2,.0008));
  for(const x of [z.x0+.53,z.x1-.53]){panelSlots.push([x,3.021,cz,.095,.012,l]);area(pa,[x,2.998,cz],[x,0,cz],.055,l-.1,34);for(let t=z.z0+.8;t<z.z1-.2;t+=2.4){panelHousings.push([x,3.008,t,.10,.025,.10]);panelDiscs.push([x,2.992,t,.071,.007,.071]);}}
 }
 batch(pa,black,panelSlots,box());batch(pa,black,panelHousings,cylinder());batch(pa,panelDown,panelDiscs,cylinder());
 // Open skeleton: no suspended backing board. The elevated black slab closes the model.
 const slabParts=[],rails=[],ducts=[],ductSeams=[],tray=[],cables=[],rods=[],woodHousing=[],woodGlow=[];
 for(const z of ZONES){const w=z.x1-z.x0,l=z.z1-z.z0,cx=(z.x0+z.x1)/2,cz=(z.z0+z.z1)/2;
  slabParts.push([cx,CEILING_HEIGHTS.exposedSlab+.035,cz,w,.07,l]);
  const slats=[];for(let t=z.z0+.065;t<z.z1-.02;t+=.13)slats.push([cx,2.995,t,1,1,1]);batch(wo,wood,slats,new RoundedBoxGeometry(w-.16,.10,.043,2,.0017));
  for(const x of [z.x0+.72,z.x1-.72])rails.push([x,3.072,cz,.035,.035,l]);
  for(let t=z.z0+.65;t<z.z1;t+=2.6)for(const x of [z.x0+.72,z.x1-.72])rods.push([x,3.37,t,.008,.56,.008]);
  for(let t=z.z0+1.25;t<z.z1-.2;t+=3.4){woodHousing.push([cx,2.964,t,w-.25,.027,.055]);woodGlow.push([cx,2.946,t,w-.29,.008,.026]);area(wo,[cx,2.937,t],[cx,0,t],w-.29,.026,115);}
  // A restrained main duct, branches and cable tray are conceptual, not surveyed MEP routes.
  const trunkX=z.x0+1.15,trayX=z.x1-.72;ducts.push([trunkX,3.43,cz,.43,.22,l]);
  for(let t=z.z0+.8;t<z.z1;t+=1.3)ductSeams.push([trunkX,3.43,t,.443,.233,.012]);
  for(let t=z.z0+1.2;t<z.z1-.3;t+=4.4)ducts.push([(trunkX+z.x1-.35)/2,3.43,t,z.x1-.35-trunkX,.16,.24]);
  tray.push([trayX-.16,3.39,cz,.018,.10,l],[trayX+.16,3.39,cz,.018,.10,l]);for(let t=z.z0+.2;t<z.z1;t+=.24)tray.push([trayX,3.345,t,.32,.014,.022]);
  for(let k=0;k<5;k++)cables.push([trayX-.10+k*.045,3.37,cz,.016,l,.016,Math.PI/2]);
 }
 for(let i=0;i<OUTLINE.length;i++){const a=OUTLINE[i],b=OUTLINE[(i+1)%OUTLINE.length],dx=b[0]-a[0],dz=b[1]-a[1];slabParts.push([(a[0]+b[0])/2,3.39,(a[1]+b[1])/2,Math.hypot(dx,dz),.58,.035,0,-Math.atan2(dz,dx)]);}
 area(wo,[2,3.13,-5.5],[2,3.6,-5.5],2.9,1.8,1.2);area(wo,[2.7,3.13,-16.5],[2.7,3.6,-16.5],3.9,1.8,1.2);
 batch(wo,slab,slabParts,box());batch(wo,black,rails,box());batch(wo,black,ducts,box());batch(wo,black,ductSeams,box());batch(wo,black,tray,box());batch(wo,black,cables,cylinder());batch(wo,black,rods,cylinder());batch(wo,black,woodHousing,box());batch(wo,woodStrip,woodGlow,box());
 for(const [id,g] of groups){g.name='ceiling-option-'+id;g.visible=false;g.userData.comparisonConcept=true;}
 return groups;
}
function fixtureGeometry(original,mask){const filtered=new THREE.BufferGeometry();for(const [key,a] of Object.entries(original.attributes))filtered.setAttribute(key,a);const drop=new Set(mask.dropTriangles),keep=[],index=original.index.array;for(let t=0;t<index.length/3;t++)if(!drop.has(t))keep.push(index[t*3],index[t*3+1],index[t*3+2]);filtered.setIndex(keep);filtered.boundingBox=original.boundingBox?.clone()||null;filtered.boundingSphere=original.boundingSphere?.clone()||null;return filtered;}
export function createCeilingOptions(scene,model,masks,onChange=()=>{},settings={}){
 const baseLights=scene.children.filter(l=>l.isPointLight&&l.position.z>-21).map(light=>({light,color:light.color.clone(),intensity:light.intensity,position:light.position.clone()}));
 const ambient=scene.children.filter(l=>l.isHemisphereLight).map(light=>({light,intensity:light.intensity})),environmentIntensity=scene.environmentIntensity;
 const groups=generateGroups(),edits=[],boards=[],boardMasks=settings.boardMasks||[],lighting=Object.fromEntries(Object.entries(LIGHTING_DEFAULTS).map(([id,v])=>[id,{...v}]));let current='existing',disposed=false;
 // Keep the shader light count stable across all four options. Zero-power slots
 // contribute nothing; transforms and photometry of active lights are unchanged.
 const sources=new Map([...groups].map(([id,g])=>{const lights=[];g.traverse(o=>{if(o.isRectAreaLight)lights.push(o);});for(const l of lights)g.remove(l);return [id,lights];}));
 const lightPool=Array.from({length:Math.max(...[...sources.values()].map(a=>a.length))},()=>new THREE.RectAreaLight(0xffffff,0,1,1));
 for(const light of lightPool)scene.add(light);
 const syncAreaLights=()=>{const active=sources.get(current)||[];for(let i=0;i<lightPool.length;i++){const light=lightPool[i],source=active[i];if(!source){light.intensity=0;continue;}light.position.copy(source.position);light.quaternion.copy(source.quaternion);light.width=source.width;light.height=source.height;light.color.copy(kelvinColor(lighting[current].kelvin+(source.userData.kelvinOffset||0)));light.intensity=source.userData.baseIntensity*lighting[current].brightness;}};
 const restoreLighting=()=>{for(const x of baseLights){x.light.color.copy(x.color);x.light.intensity=x.intensity;x.light.position.copy(x.position);}for(const x of ambient)x.light.intensity=x.intensity;scene.environmentIntensity=environmentIntensity;};
 function applyLighting(){syncAreaLights();if(current==='existing'){restoreLighting();return;}const {kelvin,brightness}=lighting[current],offset=current==='coffer'?300:0;
  baseLights.forEach((x,i)=>{x.light.color.copy(kelvinColor(kelvin+offset));x.light.intensity=({coffer:[8,11],panel:[11,14],wood:[6,9]}[current][i]??12)*brightness;x.light.position.y=2.45;});
  for(const x of ambient)x.light.intensity=x.intensity*({coffer:.72,panel:.76,wood:.66}[current]);scene.environmentIntensity=environmentIntensity*.84;
  const g=groups.get(current);g.traverse(o=>{if(o.isLight&&o.userData.ceilingEmitter){o.color.copy(kelvinColor(kelvin+(o.userData.kelvinOffset||0)));o.intensity=o.userData.baseIntensity*brightness;}const m=o.material;if(m?.userData.ceilingEmitter){m.emissive.copy(kelvinColor(kelvin+(m.userData.kelvinOffset||0)));m.emissiveIntensity=m.userData.baseEmission*brightness;}});
 }
 try{model.traverse(o=>{if(!o.isMesh||Array.isArray(o.material)||!o.geometry.index)return;const match=m=>m.material===o.material.name&&m.positionCount===o.geometry.attributes.position.count&&m.indexCount===o.geometry.index.count;
   const mask=masks.find(match);if(mask)edits.push({object:o,original:o.geometry,filtered:fixtureGeometry(o.geometry,mask)});
   const board=boardMasks.find(match);if(board){const zones=ZONES.map(z=>({...z,y0:3.06,y1:3.25}));boards.push({object:o,original:o.geometry,finished:subtractCeilingGeometry(o,board.triangles,zones.map(z=>({...z,y1:3.099}))),open:subtractCeilingGeometry(o,board.triangles,zones)});}
  });if(edits.length!==masks.length||boards.length!==boardMasks.length)throw Error('天井部品の対応が一致しません');for(const g of groups.values())scene.add(g);
 }catch(e){for(const x of edits)x.filtered.dispose();for(const x of boards){x.finished.dispose();x.open.dispose();}for(const l of lightPool)l.removeFromParent();disposeGroups(groups);throw e;}
 return {
  get current(){return current;},get lighting(){return current==='existing'?null:{...lighting[current]};},get diagnostics(){return {current,areaLightSlots:lightPool.length,originalFixtureMeshes:edits.length,openedBoardMeshes:current==='wood'||current==='coffer'?boards.length:0,visibleOptions:[...groups].filter(([,g])=>g.visible).map(([id])=>id),lighting:current==='existing'?null:{...lighting[current]},comparisonZones:ZONES.map(z=>({...z})),conceptDimensions:true,servicesAreAssumed:true};},
  set(id){if(disposed)throw Error('天井の比較は終了しています');if(!CEILING_OPTIONS.some(o=>o.id===id))throw Error('不明な天井案');for(const x of edits)x.object.geometry=id==='existing'?x.original:x.filtered;for(const x of boards)x.object.geometry=id==='existing'?x.original:id==='wood'||id==='coffer'?x.open:x.finished;for(const [name,g] of groups)g.visible=name===id;current=id;applyLighting();onChange({geometryChanged:true});},
  setLighting({kelvin,brightness}){if(disposed)throw Error('天井の比較は終了しています');if(current==='existing')return;if(!Number.isFinite(kelvin)||!Number.isFinite(brightness))throw Error('照明設定が不正です');lighting[current]={kelvin:Math.max(2500,Math.min(4000,kelvin)),brightness:Math.max(.5,Math.min(1.5,brightness))};applyLighting();onChange({geometryChanged:false});},
  resetLighting(){if(current!=='existing'){lighting[current]={...LIGHTING_DEFAULTS[current]};applyLighting();onChange({geometryChanged:false});}},
  dispose(){if(disposed)return;disposed=true;for(const l of lightPool)l.removeFromParent();restoreLighting();for(const x of edits){x.object.geometry=x.original;x.filtered.dispose();}for(const x of boards){x.object.geometry=x.original;x.finished.dispose();x.open.dispose();}disposeGroups(groups);}
 };
}
function disposeGroups(groups){const geometries=new Set(),materials=new Set(),textures=new Set();for(const g of groups.values()){g.removeFromParent();g.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);o.dispose?.();});}for(const m of materials){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();}for(const t of textures)t.dispose();for(const g of geometries)g.dispose();}
