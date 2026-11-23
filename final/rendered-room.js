import * as THREE from 'three';
const directions = ['entry','rear','vending'];
const names = ['PROPOSAL entry','PROPOSAL rear','Vending to EV'];
const panoUV = `
vec2 roomUV(vec3 ray) {
 vec3 d=normalize(ray);
 return vec2(.5+atan(d.x,-d.z)/6.28318530718,.5+asin(clamp(d.y,-1.,1.))/3.14159265359);
}`;
export class RenderedRoom {
 constructor(){
  this.loader=new THREE.TextureLoader();
  this.uniforms={soffit:{value:null},glazing:{value:null},upper:{value:null},splitCoffer:{value:false},openCeiling:{value:false}};
  for(let k=0;k<3;k++){
   this.uniforms['capture'+k]={value:null};
   this.uniforms['distanceMap'+k]={value:null};
   this.uniforms['origin'+k]={value:new THREE.Vector3()};
  }
  this.scene=new THREE.Scene();
  this.material=new THREE.ShaderMaterial({
   uniforms:{image:{value:null}},side:THREE.BackSide,depthTest:false,depthWrite:false,toneMapped:false,
   vertexShader:'varying vec3 ray;void main(){ray=position;gl_Position=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);}',
   fragmentShader:panoUV+'\nuniform sampler2D image;varying vec3 ray;void main(){gl_FragColor=texture2D(image,roomUV(ray));}'
  });
  this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(12,80,48),this.material));
  this.scene.children[0].frustumCulled=false;
 }
 async prepare(key,cameras){
  const images=await Promise.all(directions.map(async(v,i)=>{
   const [color,depth]=await Promise.all([this.loader.loadAsync(key+'_'+v+'_360.jpg'),this.loader.loadAsync(key+'_'+v+'_depth.png')]);
   color.colorSpace=THREE.NoColorSpace;color.wrapS=THREE.RepeatWrapping;
   depth.wrapS=THREE.RepeatWrapping;depth.colorSpace=THREE.NoColorSpace;depth.minFilter=depth.magFilter=THREE.NearestFilter;depth.generateMipmaps=false;
   return {color,depth,origin:new THREE.Vector3().fromArray(cameras[names[i]][0])};
   }));
  const surfaces=await Promise.all(['soffit','glazing'].map(async name=>{
   const texture=await this.loader.loadAsync(key+'_'+name+'.jpg');
   texture.anisotropy=8;
   return texture;
  }));
  const splitCoffer=key==='coffer';
  const upper=splitCoffer ? await this.loader.loadAsync('coffer_upper.jpg') : surfaces[0];
  upper.anisotropy=8;
  return {images,surfaces,upper,splitCoffer,openCeiling:key==='wood'};
 }
 use({images,surfaces,upper,splitCoffer,openCeiling}){
  this.uniforms.openCeiling.value=openCeiling;this.uniforms.upper.value=upper;this.uniforms.splitCoffer.value=splitCoffer;
  [this.uniforms.soffit.value,this.uniforms.glazing.value]=surfaces;
  this.images=images;
  images.forEach(({color,depth,origin},i)=>{
   this.uniforms['capture'+i].value=color;this.uniforms['distanceMap'+i].value=depth;this.uniforms['origin'+i].value.copy(origin);
  });
 }
 apply(material){
  material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,this.uniforms);
   shader.vertexShader='varying vec3 roomPosition;\n'+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nroomPosition=(modelMatrix*vec4(transformed,1.)).xyz;');
   const uniforms=directions.map((_,i)=>'uniform vec3 origin'+i+';uniform sampler2D capture'+i+',distanceMap'+i+';').join('\n');
   const fn=`
float depthConfidence(sampler2D depthImage,vec2 pixelUV,float dist){
 vec2 packedDepth=texture2D(depthImage,pixelUV).rg;
 float measured=dot(floor(packedDepth*255.+.5),vec2(256.,1.))*.001;
 return 1.-smoothstep(.035+.005*dist,.09+.014*dist,abs(measured-dist));
}
void sampleRoom(vec3 origin,sampler2D image,sampler2D depthImage,inout vec3 colors,inout float total){
 vec3 ray=roomPosition-origin;float dist=length(ray);
 vec2 uv=roomUV(ray);
 vec2 size=vec2(textureSize(depthImage,0));
 vec2 cell=uv*size-.5;
 vec2 f=fract(cell), p=(floor(cell)+.5)/size, stepUV=1./size;
 float valid=mix(mix(depthConfidence(depthImage,p,dist),depthConfidence(depthImage,p+vec2(stepUV.x,0.),dist),f.x),
                 mix(depthConfidence(depthImage,p+vec2(0.,stepUV.y),dist),depthConfidence(depthImage,p+stepUV,dist),f.x),f.y);
 vec3 eyeRay=normalize(roomPosition-cameraPosition);
 float alignment=clamp(dot(eyeRay,normalize(ray)),0.,1.);
 float weight=valid*mix(.05,1.,alignment*alignment)/(1.+dot(cameraPosition-origin,cameraPosition-origin)*.20);
 colors+=weight*texture2D(image,uv).rgb;total+=weight;
}`;
   shader.fragmentShader='uniform sampler2D soffit,glazing,upper;uniform bool splitCoffer,openCeiling;\nvarying vec3 roomPosition;\n'+uniforms+panoUV+fn+'\n'+shader.fragmentShader;
   let body=`
vec3 face=normalize(cross(dFdx(roomPosition),dFdy(roomPosition)));
vec2 ceilingUV=vec2((roomPosition.x-2.6)/8.,(roomPosition.z+10.)/22.)+.5;
vec2 glassUV=vec2((-roomPosition.z-10.)/22.,(roomPosition.y-1.75)/4.)+.5;
bool inCeiling=roomPosition.y>=(splitCoffer ? 3.095 : 2.975) && roomPosition.y<3.39 && all(greaterThan(ceilingUV,vec2(0.))) && all(lessThan(ceilingUV,vec2(1.)));
bool onWindow=abs(roomPosition.x)<.13 && roomPosition.z<-.1 && roomPosition.z>-20.1 && roomPosition.y<3.095 && roomPosition.y>.055 && abs(face.x)>.8;
if(${material.name.includes('smoked warm oak') ? 'true' : 'false'}){
 // The narrow sides share their blade's underside sample. Stay inside the blade at grazing angles.
 vec2 bladeUV=ceilingUV;
 bladeUV.y-=face.z*.009/22.;
 gl_FragColor.rgb=texture2D(soffit,bladeUV).rgb*mix(.84,1.,abs(face.y));
}else if(openCeiling && roomPosition.y>3.10 && roomPosition.z<0. && roomPosition.z>-20.2 && roomPosition.x>0. && roomPosition.x<5.7){
 gl_FragColor.rgb=min(gl_FragColor.rgb,vec3(.12,.096,.078));
}else if(${material.name==='PROPOSAL | warm mineral paint' ? 'true' : 'false'} && splitCoffer && inCeiling && abs(face.y)<=.80){
 // Sample just inside the painted edge so its thin return stays on the same finish at oblique angles.
 vec2 insideUV=ceilingUV-vec2(face.x/8.,face.z/22.)*.015;
 gl_FragColor.rgb=texture2D(soffit,insideUV).rgb;
}else if(inCeiling && abs(face.y)>.80){
 gl_FragColor.rgb=splitCoffer && roomPosition.y>3.30 ? texture2D(upper,ceilingUV).rgb : texture2D(soffit,ceilingUV).rgb;
}else if(onWindow){
 gl_FragColor=vec4(texture2D(glazing,glassUV).rgb,1.);
}else{
 vec3 projected=vec3(0.);float coverage=0.;`;
   for(let i=0;i<3;i++)body+='sampleRoom(origin'+i+',capture'+i+',distanceMap'+i+',projected,coverage);';
   body+='if(inCeiling)gl_FragColor.rgb=texture2D(soffit,ceilingUV).rgb;if(coverage>.0001){gl_FragColor.rgb=mix(gl_FragColor.rgb,projected/coverage,smoothstep(.001,.025,coverage));}}';
   shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>','#include <colorspace_fragment>\n'+body);
  };
  material.customProgramCacheKey=()=>material.name.includes('smoked warm oak')?'room-oak-v28':material.name==='PROPOSAL | warm mineral paint'?'room-paint-v28':'room-v28';
 }
}
