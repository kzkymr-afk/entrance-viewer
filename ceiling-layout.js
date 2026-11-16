// Dimensions follow the R5 plan reconstruction; ceiling/plenum heights remain design assumptions.
export const ZONES=[{x0:0,x1:4.335,z0:-10.3,z1:0},{x0:0,x1:5.33,z0:-13.2,z1:-10.3},{x0:0,x1:5.865,z0:-20.2,z1:-13.2}];
export const OUTLINE=[[0,0],[4.335,0],[4.335,-10.3],[5.33,-10.3],[5.33,-13.2],[5.865,-13.2],[5.865,-20.2],[0,-20.2]];
export const COFFERS=[
 {id:'approach',label:'入口からの連続した折り上げ',x0:.58,x1:3.755,z0:-12.65,z1:-.65},
 {id:'hall',label:'EV前をまとめる大きな折り上げ',x0:.70,x1:5.165,z0:-19.58,z1:-13.82}
];
export const LIGHTING_DEFAULTS=Object.freeze({coffer:{kelvin:2700,brightness:1},panel:{kelvin:3500,brightness:1},wood:{kelvin:3000,brightness:1}});
export const CEILING_HEIGHTS=Object.freeze({soffit:2.80,raised:3.18,cofferRiserTop:3.14,woodBottom:2.945,exposedSlab:3.68});
