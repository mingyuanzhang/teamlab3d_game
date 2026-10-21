/* Tiny local WebGL renderer: real meshes, lighting, depth testing, and an orbit camera. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.Wonder3D=factory();
})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const TAU=Math.PI*2;
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const normalize=a=>{const d=Math.hypot(...a)||1;return a.map(n=>n/d);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const colors=new Map();
  function color(hex){if(colors.has(hex))return colors.get(hex);const h=hex.replace('#','');const c=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);colors.set(hex,c);return c;}
  function triangle(out,a,b,c,n){n=n||normalize(cross(b.map((v,i)=>v-a[i]),c.map((v,i)=>v-a[i])));for(const v of [a,b,c])out.push(...v,...n);}
  function box(){const out=[],p=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]];for(const [a,b,c,d]of[[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]){triangle(out,p[a],p[b],p[c]);triangle(out,p[a],p[c],p[d]);}return out;}
  function sphere(segments=10,rings=6){const out=[],v=(i,j)=>{const a=i/segments*TAU,b=j/rings*Math.PI;return [Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a)];};for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const a=v(i,j),b=v(i+1,j),c=v(i+1,j+1),d=v(i,j+1);for(const tri of [[a,d,b],[b,d,c]])for(const p of tri)out.push(...p,...p);}return out;}
  function cylinder(sides=10,top=1,capped=true){const out=[];for(let i=0;i<sides;i++){const a=i/sides*TAU,b=(i+1)/sides*TAU,p=[Math.cos(a),-.5,Math.sin(a)],q=[Math.cos(b),-.5,Math.sin(b)],r=[Math.cos(a)*top,.5,Math.sin(a)*top],s=[Math.cos(b)*top,.5,Math.sin(b)*top];triangle(out,p,r,q);triangle(out,q,r,s);if(capped){triangle(out,[0,-.5,0],p,q,[0,-1,0]);triangle(out,[0,.5,0],s,r,[0,1,0]);}}return out;}
  function octahedron(){const out=[],p=[[0,1,0],[0,-1,0],[1,0,0],[0,0,1],[-1,0,0],[0,0,-1]];for(let i=0;i<4;i++){triangle(out,p[0],p[2+i],p[2+(i+1)%4]);triangle(out,p[1],p[2+(i+1)%4],p[2+i]);}return out;}
  function torus(segments=28,sides=5,tube=.025){const out=[],v=(i,j)=>{const a=i/segments*TAU,b=j/sides*TAU;return [(1+Math.cos(b)*tube)*Math.cos(a),Math.sin(b)*tube,(1+Math.cos(b)*tube)*Math.sin(a)];};for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=v(i,j),b=v(i+1,j),c=v(i+1,j+1),d=v(i,j+1);triangle(out,a,b,d);triangle(out,b,c,d);}return out;}
  function crescent(){
    const out=[],count=24,outer=[],inner=[];
    for(let i=0;i<=count;i++){const a=.88+(TAU-1.76)*i/count;outer.push([Math.cos(a),Math.sin(a)]);inner.push([.64-.98*Math.sin(Math.PI*i/count),Math.cos(Math.PI*i/count)*Math.sin(.88)]);}
    for(let i=0;i<count;i++){
      const [a,b,c,d]=[outer[i],outer[i+1],inner[i+1],inner[i]];
      for(const z of [-.2,.2]){triangle(out,[...a,z],[...b,z],[...d,z],[0,0,Math.sign(z)]);triangle(out,[...b,z],[...c,z],[...d,z],[0,0,Math.sign(z)]);}
      for(const [p,q]of[[a,b],[d,c]]){triangle(out,[...p,-.2],[...q,-.2],[...p,.2]);triangle(out,[...q,-.2],[...q,.2],[...p,.2]);}
    }return out;
  }
  function petal(){
    const out=[],point=(u,v)=>{
      const width=Math.sin(u*Math.PI)**.7*.5;
      return [v*width,Math.sin(u*Math.PI)*(.12+.14*(1-v*v))-.06*u*u,u];
    };
    for(let i=0;i<10;i++)for(const [a,b]of[[-1,0],[0,1]]){
      const p=point(i/10,a),q=point((i+1)/10,a),r=point((i+1)/10,b),s=point(i/10,b);
      triangle(out,p,q,s);triangle(out,q,r,s);
    }
    return out;
  }
  function star(){
    const out=[];
    for(let i=0;i<8;i++){
      const a=i/8*TAU,b=(i+1)/8*TAU,r=i%2?.23:1,s=i%2?1:.23;
      triangle(out,[0,0,.06],[Math.cos(a)*r,Math.sin(a)*r,0],[Math.cos(b)*s,Math.sin(b)*s,0]);
    }
    return out;
  }
  const meshes={box:box(),sphere:sphere(),particle:sphere(6,4),cylinder:cylinder(),line:cylinder(5),filament:cylinder(5,1,false),cone:cylinder(10,0),pyramid:cylinder(3,0),hex:cylinder(6),diamond:octahedron(),torus:torus(),crescent:crescent(),petal:petal(),star:star()};
  class Camera {
    constructor(){this.yaw=.64;this.targetYaw=.64;this.pitch=.63;this.targetPitch=.63;this.zoom=1;this.auto=false;this.width=1200;this.height=800;this.target=[0,1.2,0];this.refresh();}
    refresh(){
      this.right=[Math.cos(this.yaw),0,-Math.sin(this.yaw)];
      this.up=[-Math.sin(this.yaw)*Math.sin(this.pitch),Math.cos(this.pitch),-Math.cos(this.yaw)*Math.sin(this.pitch)];
      this.forward=[Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),Math.cos(this.yaw)*Math.cos(this.pitch)];
      this.halfHeight=Math.max(11.8,16.2/(this.width/this.height))*this.zoom;this.halfWidth=this.halfHeight*this.width/this.height;
    }
    update(dt){if(this.auto)this.targetYaw+=dt*.16;const t=1-Math.exp(-dt*9);this.yaw+=(this.targetYaw-this.yaw)*t;this.pitch+=(this.targetPitch-this.pitch)*t;this.refresh();}
    project(p){const q=[p.x-this.target[0],p.y-this.target[1],p.z-this.target[2]];return {x:(dot(q,this.right)/this.halfWidth+1)*this.width/2,y:(1-dot(q,this.up)/this.halfHeight-.03)*this.height/2,depth:dot(q,this.forward)};}
    unproject(x,y,height=0){
      const sx=(x/this.width*2-1)*this.halfWidth,sy=(1-y/this.height*2-.03)*this.halfHeight;
      const base=this.target.map((v,i)=>v+this.right[i]*sx+this.up[i]*sy);
      const t=(height-base[1])/this.forward[1];
      return {x:base[0]+this.forward[0]*t,y:height,z:base[2]+this.forward[2]*t};
    }
    reset(){this.targetYaw=.64;this.targetPitch=.63;this.zoom=1;this.auto=false;}
  }
  class Renderer {
    constructor(canvas){
      this.canvas=canvas;this.gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'high-performance'});
      if(!this.gl)throw new Error('WebGL is unavailable');
      const gl=this.gl;
      const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
      const vertex=shader(gl.VERTEX_SHADER,`attribute vec3 aPosition;attribute vec3 aNormal;attribute vec4 aColor;attribute float aOpacity;uniform vec3 uRight,uUp,uForward,uTarget;uniform vec2 uScale;varying vec3 vColor;varying float vDepth;varying float vOpacity;void main(){vOpacity=aOpacity;vec3 p=aPosition-uTarget;float light=.48+max(0.,dot(normalize(aNormal),normalize(vec3(-.5,1.,.7))))*.52;vColor=aColor.rgb*mix(light,1.12,aColor.a);vDepth=dot(p,uForward);gl_Position=vec4(dot(p,uRight)*uScale.x,dot(p,uUp)*uScale.y+.03,-vDepth/60.,1.);}`);
      // Screen-door transparency reveals the actual scene behind dissolving
      // effects, while keeping correct depth for every mesh in one draw call.
      const fragment=shader(gl.FRAGMENT_SHADER,`precision mediump float;varying vec3 vColor;varying float vDepth;varying float vOpacity;
float bayer(vec2 p){vec2 a=mod(floor(p),2.);return 2.*a.x+3.*a.y-4.*a.x*a.y;}
void main(){if(vOpacity<.999){vec2 p=gl_FragCoord.xy;float threshold=(16.*bayer(p)+4.*bayer(floor(p/2.))+bayer(floor(p/4.))+.5)/64.;if(vOpacity<threshold)discard;}float fog=clamp((-vDepth-9.)/55.,0.,.19);gl_FragColor=vec4(mix(vColor,vec3(.09,.15,.18),fog),1.);}`);
      this.program=gl.createProgram();gl.attachShader(this.program,vertex);gl.attachShader(this.program,fragment);gl.linkProgram(this.program);
      if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
      this.uniforms={};for(const name of ['uRight','uUp','uForward','uTarget','uScale'])this.uniforms[name]=gl.getUniformLocation(this.program,name);
      this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.useProgram(this.program);
      for(const [name,size,offset]of[['aPosition',3,0],['aNormal',3,12],['aColor',4,24],['aOpacity',1,40]]){const loc=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,44,offset);}
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(0,0,0,0);
      this.data=new Float32Array(1000000);this.cursor=0;this.camera=new Camera();this.lost=false;
      canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.lost=true;});
    }
    resize(){const ratio=Math.min(globalThis.devicePixelRatio||1,2),w=this.canvas.clientWidth,h=this.canvas.clientHeight;this.canvas.width=Math.round(w*ratio);this.canvas.height=Math.round(h*ratio);this.gl.viewport(0,0,this.canvas.width,this.canvas.height);this.camera.width=w;this.camera.height=h;this.camera.refresh();}
    begin(){this.cursor=0;}
    mesh(name,position,scale,hex,rotation={},glow=0,opacity=1){
      const vertices=Array.isArray(name)?name:meshes[name],c=Array.isArray(hex)?hex:color(hex),sx=scale[0],sy=scale[1],sz=scale[2];
      if(Math.min(Math.abs(sx),Math.abs(sy),Math.abs(sz))<.00001)return;
      const ax=rotation.x||0,ay=rotation.y||0,az=rotation.z||0;
      const cx=Math.cos(ax),nx=Math.sin(ax),cy=Math.cos(ay),ny=Math.sin(ay),cz=Math.cos(az),nz=Math.sin(az);
      const m00=cz*cy,m01=cz*ny*nx-nz*cx,m02=cz*ny*cx+nz*nx;
      const m10=nz*cy,m11=nz*ny*nx+cz*cx,m12=nz*ny*cx-cz*nx;
      const m20=-ny,m21=cy*nx,m22=cy*cx;
      const needed=this.cursor+vertices.length/6*11;if(needed>this.data.length){const data=new Float32Array(Math.max(needed,this.data.length*2));data.set(this.data);this.data=data;}
      const d=this.data;let offset=this.cursor;
      for(let i=0;i<vertices.length;i+=6){
        const x=vertices[i]*sx,y=vertices[i+1]*sy,z=vertices[i+2]*sz;
        const normalX=vertices[i+3]/sx,normalY=vertices[i+4]/sy,normalZ=vertices[i+5]/sz;
        d[offset++]=m00*x+m01*y+m02*z+position[0];d[offset++]=m10*x+m11*y+m12*z+position[1];d[offset++]=m20*x+m21*y+m22*z+position[2];
        d[offset++]=m00*normalX+m01*normalY+m02*normalZ;d[offset++]=m10*normalX+m11*normalY+m12*normalZ;d[offset++]=m20*normalX+m21*normalY+m22*normalZ;
        d[offset++]=c[0];d[offset++]=c[1];d[offset++]=c[2];d[offset++]=glow;d[offset++]=opacity;
      }
      this.cursor=offset;
    }
    line(a,b,r,hex,glow=0,opacity=1){const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz);if(length<.0001)return;this.mesh(r<.025?'filament':'line',a.map((v,i)=>(v+b[i])/2),[r,length,r],hex,{x:Math.acos(Math.max(-1,Math.min(1,dy/length))),y:Math.atan2(dx,dz)},glow,opacity);}
    ring(p,r,hex,rotation={},glow=.25,opacity=1){this.mesh('torus',p,[r,r,r],hex,rotation,glow,opacity);}
    ribbon(points,widths,hex,glow=.3,opacity=1,twist=0,turns=1.5){
      if(points.length<2)return;
      let previousSide;
      const edges=points.map((p,i)=>{
        const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],tangent=normalize(b.map((v,j)=>v-a[j]));
        // Carry the frame along the curve so cloth never flips at a steep bend.
        const projection=previousSide?dot(previousSide,tangent):0;
        let side=previousSide?normalize(previousSide.map((v,j)=>v-tangent[j]*projection)):null;
        if(!side||Math.hypot(...side)<.001)side=normalize(cross(tangent,Math.abs(tangent[0])>.95?[0,1,0]:[1,0,0]));
        previousSide=side;
        const normal=cross(tangent,side),angle=twist+i/(points.length-1)*Math.PI*turns;
        const width=Array.isArray(widths)?widths[i]:widths;
        const offset=side.map((v,j)=>(v*Math.cos(angle)+normal[j]*Math.sin(angle))*width);
        return [p.map((v,j)=>v-offset[j]),p.map((v,j)=>v+offset[j])];
      });
      const vertices=[];
      for(let i=1;i<edges.length;i++){
        triangle(vertices,edges[i-1][0],edges[i][0],edges[i-1][1]);
        triangle(vertices,edges[i][0],edges[i][1],edges[i-1][1]);
      }
      this.mesh(vertices,[0,0,0],[1,1,1],hex,{},glow,opacity);
    }
    render(){
      if(this.lost)return;const gl=this.gl,c=this.camera,u=this.uniforms;gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
      for(const [name,value]of[['uRight',c.right],['uUp',c.up],['uForward',c.forward],['uTarget',c.target]])gl.uniform3fv(u[name],value);
      gl.uniform2f(u.uScale,1/c.halfWidth,1/c.halfHeight);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.data.subarray(0,this.cursor),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,this.cursor/11);
    }
  }
  return {Renderer,Camera,meshes,color};
});
