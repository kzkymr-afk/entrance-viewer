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
  this.uniforms={};
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
   depth.colorSpace=THREE.NoColorSpace;depth.minFilter=depth.magFilter=THREE.NearestFilter;depth.generateMipmaps=false;
   return {color,depth,origin:new THREE.Vector3().fromArray(cameras[names[i]][0])};
  }));return images;
 }
 use(images){
  this.images=images;
  images.forEach(({color,depth,origin},i)=>{
   this.uniforms['capture'+i].value=color;this.uniforms['distanceMap'+i].value=depth;this.uniforms['origin'+i].value.copy(origin);
  });
 }
 renderAnchor(renderer,camera){
  if(!this.images)return false;
  const anchor=this.images.find(p=>p.origin.distanceToSquared(camera.position)<.000001);
  if(!anchor)return false;
  this.material.uniforms.image.value=anchor.color;renderer.render(this.scene,camera);return true;
 }
 apply(material){
  material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,this.uniforms);
   shader.vertexShader='varying vec3 roomPosition;\n'+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nroomPosition=(modelMatrix*vec4(transformed,1.)).xyz;');
   const uniforms=directions.map((_,i)=>'uniform vec3 origin'+i+';uniform sampler2D capture'+i+',distanceMap'+i+';').join('\n');
   const fn=`
void sampleRoom(vec3 origin,sampler2D image,sampler2D depthImage,inout vec3 colors,inout float total){
 vec3 ray=roomPosition-origin;float dist=length(ray);
 vec2 uv=roomUV(ray);vec2 packedDepth=texture2D(depthImage,uv).rg;
 float measured=dot(floor(packedDepth*255.+.5),vec2(256.,1.))*.001;
 float valid=1.-smoothstep(.035+.005*dist,.09+.014*dist,abs(measured-dist));
 vec3 eyeRay=normalize(roomPosition-cameraPosition);
 float alignment=clamp(dot(eyeRay,normalize(ray)),0.,1.);
 float weight=valid*mix(.05,1.,alignment*alignment)/(1.+dot(cameraPosition-origin,cameraPosition-origin)*.20);
 colors+=weight*texture2D(image,uv).rgb;total+=weight;
}`;
   shader.fragmentShader='varying vec3 roomPosition;\n'+uniforms+panoUV+fn+'\n'+shader.fragmentShader;
   let body='vec3 projected=vec3(0.);float coverage=0.;';
   for(let i=0;i<3;i++)body+='sampleRoom(origin'+i+',capture'+i+',distanceMap'+i+',projected,coverage);';
   body+='if(coverage>.0001){gl_FragColor.rgb=mix(gl_FragColor.rgb,projected/coverage,smoothstep(.001,.025,coverage));}';
   shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>','#include <colorspace_fragment>\n'+body);
  };
  material.customProgramCacheKey=()=>'cycles-room-v1';
 }
}
