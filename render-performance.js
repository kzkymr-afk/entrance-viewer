import * as THREE from './vendor/three.module.js';

// Full resolution at rest. Only sustained slow interaction teaches a lower
// moving resolution; fast machines retain their original pixel ratio.
export function createMotionResolution({nativeRatio, width, height, mode='auto'}){
 let learned=nativeRatio,lastMove=-Infinity,previousMoving=false,samples=[],lastSample=0,current=nativeRatio,interacting=false;
 const idleDelay=180,minimum=()=>Math.min(nativeRatio,.5);
 function motionRatio(){return mode==='quality'?nativeRatio:mode==='responsive'?Math.min(nativeRatio,Math.max(minimum(),Math.sqrt(900000/(width*height)))):learned;}
 return {
  setMode(value){if(!['auto','quality','responsive'].includes(value))throw Error('Unknown rendering mode');mode=value;samples=[];previousMoving=false;},
  resize(w,h,ratio=nativeRatio){width=w;height=h;nativeRatio=ratio;learned=Math.min(learned,nativeRatio);samples=[];},
  update(now,moving){
   if(moving){lastMove=now;if(previousMoving&&lastSample&&mode==='auto'){const dt=now-lastSample;if(dt>0&&dt<2000){samples.push(dt);if(samples.length>=6){const mean=samples.reduce((a,b)=>a+b,0)/samples.length;if(mean>25&&(samples.length>=18||mean>50)){learned=Math.max(minimum(),learned*Math.max(.7,Math.min(.88,Math.sqrt(20/mean))));}else if(mean<18&&samples.length>=90){learned=Math.min(nativeRatio,learned*1.08);samples=[];}if((mean>=18&&samples.length>=18)||mean>50||samples.length>=90)samples=[];}}else samples=[];}lastSample=now;}
   else {samples=[];lastSample=0;}
   previousMoving=moving;
   interacting=now-lastMove<idleDelay;current=interacting?motionRatio():nativeRatio;
   return current;
  },
  get diagnostics(){return {mode,nativeRatio,movingRatio:motionRatio(),currentRatio:current,detailScale:interacting&&mode==='responsive'?.5:current/nativeRatio,settleMs:idleDelay};}
 };
}

// Static point shadows are generated sequentially, so their depth attachment
// can be shared. Keep every independent color atlas and its full resolution.
export function allocateSharedShadowDepth(renderer,lights){
 const pointLights=lights.filter(l=>l.isPointLight&&l.castShadow);
 if(pointLights.length<2)return null;
 const sizes=pointLights.map(l=>{const e=l.shadow.getFrameExtents(),max=renderer.capabilities.maxTextureSize;return [Math.min(l.shadow.mapSize.x,Math.floor(max/e.x))*e.x,Math.min(l.shadow.mapSize.y,Math.floor(max/e.y))*e.y];});
 if(sizes.some(s=>s[0]!==sizes[0][0]||s[1]!==sizes[0][1])||pointLights.some(l=>l.shadow.map))return null;
 const [width,height]=sizes[0],depth=new THREE.DepthTexture(width,height,THREE.UnsignedIntType);
 for(const light of pointLights){light.shadow.map=new THREE.WebGLRenderTarget(width,height,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthTexture:depth});light.shadow.map.texture.name='Static point shadow';}
 return {width,height,atlases:pointLights.length,depthAttachments:1,estimatedDepthBytesSaved:(pointLights.length-1)*width*height*4};
}

