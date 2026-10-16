/* A dependency-free integration harness, not a substitute for browser visual QA. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const simulation=require('../simulation.js');
const graphics=require('../renderer.js');

class Element {
  constructor(attrs=''){
    this.attrs=new Map();for(const [,key,value]of attrs.matchAll(/([\w-]+)="([^"]*)"/g))this.attrs.set(key,value);
    this.dataset={};for(const [key,value]of this.attrs)if(key.startsWith('data-'))this.dataset[key.slice(5)]=value;
    this.listeners=new Map();this.style={};this.hidden=/\bhidden\b/.test(attrs);this.disabled=false;this.textContent='';this.dots=[];
    const classes=new Set((this.attrs.get('class')||'').split(' '));this.classList={toggle:(name,on)=>on?classes.add(name):classes.delete(name),contains:name=>classes.has(name)};
  }
  setAttribute(key,value){this.attrs.set(key,value);}
  getAttribute(key){return this.attrs.get(key);}
  set innerHTML(value){this.dots=Array.from(value.matchAll(/<i>/g),()=>new Element());}
  querySelectorAll(selector){if(selector==='i')return this.dots;throw new Error(`Unsupported element selector: ${selector}`);}
  querySelector(selector){if(selector==='.slots')return this;throw new Error(`Unsupported element selector: ${selector}`);}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);}
  dispatch(type,extra={}){const e={target:this,isPrimary:true,button:0,pointerId:1,preventDefault(){},...extra};for(const fn of this.listeners.get(type)||[])fn(e);}
  setPointerCapture(){}
  focus(){}
  matches(selector){return selector.split(',').includes(this.attrs.get('tag')||'body');}
  closest(selector){return selector==='button'&&this.attrs.get('tag')==='button'?this:null;}
}
function boot(width=1440,height=900){
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),elements=[];
  for(const [,tag,attrs]of html.matchAll(/<(\w+)\b([^>]*)>/g)){const el=new Element(attrs);el.attrs.set('tag',tag);elements.push(el);}
  const document=new Element(),window=new Element();
  document.querySelectorAll=selector=>elements.filter(el=>selector[0]==='.'?el.classList.contains(selector.slice(1)):selector==='[data-tool]'?!!el.dataset.tool:false);
  document.querySelector=selector=>{const el=elements.find(el=>el.attrs.get('id')===selector.slice(1));assert.ok(el,`Missing actual HTML element ${selector}`);return el;};
  const gl={draws:0,vertices:0};
  for(const name of ['createShader','createProgram','createBuffer','getUniformLocation'])gl[name]=()=>({});
  for(const name of ['shaderSource','compileShader','attachShader','linkProgram','bindBuffer','useProgram','enableVertexAttribArray','vertexAttribPointer','enable','depthFunc','clearColor','viewport','clear','uniform3fv','uniform2f'])gl[name]=()=>{};
  gl.getShaderParameter=gl.getProgramParameter=()=>true;gl.getAttribLocation=()=>0;
  gl.bufferData=(_,data)=>{assert.equal(data.length%10,0);for(const value of data)assert.ok(Number.isFinite(value),'A non-finite vertex reached WebGL');};
  gl.drawArrays=(_,__,count)=>{gl.draws++;gl.vertices=count;assert.ok(count>100);};
  const canvas=document.querySelector('#world');Object.assign(canvas,{clientWidth:width,clientHeight:height,getContext:()=>gl,getBoundingClientRect:()=>({left:0,top:0})});
  let world,renderer,scheduled,now=1000;
  class World extends simulation.World{constructor(){super(()=>.4);world=this;}}
  class Renderer extends graphics.Renderer{constructor(c){super(c);renderer=this;}}
  const context=vm.createContext({document,window,console,LittleWorld3D:{...simulation,World},Wonder3D:{...graphics,Renderer},requestAnimationFrame:fn=>{scheduled=fn;}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../world.js'),'utf8'),context,{filename:'world.js'});
  function frame(ms=100){now+=ms;const fn=scheduled;assert.ok(fn);scheduled=null;fn(now);}
  function drag(a,b){canvas.dispatch('pointerdown',{clientX:a.x,clientY:a.y});canvas.dispatch('pointermove',{clientX:b.x,clientY:b.y});canvas.dispatch('pointerup',{clientX:b.x,clientY:b.y});}
  const click=selector=>document.querySelector(selector).dispatch('click');
  const shape=id=>document.querySelectorAll('.shape').find(b=>Number(b.dataset.shape)===id).dispatch('click');
  const tool=kind=>document.querySelectorAll('[data-tool]').find(b=>b.dataset.tool===kind).dispatch('click');
  return {world,renderer,canvas,gl,document,window,frame,drag,click,shape,tool};
}

test('the actual application starts and submits all six 3D discoveries',()=>{
  const app=boot();app.frame();assert.ok(app.gl.vertices>10000);assert.equal(app.world.people.length,48);
  app.world.people=[];
  for(let id=0;id<6;id++)assert.ok(app.world.place(id,{x:-8+id*3,y:0,z:0}));
  for(let i=0;i<40;i++)app.frame();
  assert.ok(app.world.tokens.every(t=>t.cycle===1));assert.ok(app.gl.vertices>15000);assert.equal(app.gl.draws,41);
  app.click('#pause');const time=app.world.time;app.frame();app.frame();assert.equal(app.world.time,time);
  app.click('#pause');app.frame();assert.ok(app.world.time>time);
});

for(const [width,height]of[[1440,900],[390,844]])test(`placement, camera, drawing, and undo controls work at ${width}px`,()=>{
  const a=boot(width,height);a.frame();a.world.people=[];a.click('#pause');
  const camera=a.renderer.camera,initial=camera.targetYaw;
  a.click('#rotate-right');assert.ok(camera.targetYaw>initial);a.frame();
  a.shape(3);const origin={x:-3,y:0,z:2},screen=camera.project(origin);a.drag(screen,screen);
  assert.equal(a.world.tokens.length,1);assert.ok(Math.hypot(a.world.tokens[0].x-origin.x,a.world.tokens[0].z-origin.z)<1e-9);
  a.tool('move');const from=camera.project({...origin,y:.72}),dest=camera.project({x:3,y:0,z:-2}),startFloor=camera.project(origin);
  const delta={x:dest.x-startFloor.x,y:dest.y-startFloor.y};a.drag(from,{x:from.x+delta.x,y:from.y+delta.y});
  assert.ok(Math.hypot(a.world.tokens[0].x-3,a.world.tokens[0].z+2)<1e-9);
  a.click('#undo');assert.ok(Math.abs(a.world.tokens[0].x+3)<1e-9);
  a.tool('line');const lineCount=a.world.lines.length;
  a.drag(camera.project({x:-4,y:0,z:-6}),camera.project({x:4,y:0,z:-6}));assert.equal(a.world.lines.length,lineCount+1);
  a.click('#height-up');a.tool('ladder');
  a.drag(camera.project({x:-2,y:0,z:0}),camera.project({x:-2,y:2.4,z:-3}));
  const ladder=a.world.lines.at(-1);assert.equal(ladder.kind,'ladder');assert.ok(Math.abs(ladder.a.x+2)<1e-9);assert.ok(Math.abs(ladder.a.z)<1e-9);assert.equal(ladder.a.y,0);assert.equal(ladder.b.y,2.4);
  a.click('#orbit');assert.equal(camera.auto,true);a.frame();assert.ok(camera.targetYaw>initial);
  a.click('#zoom-in');assert.ok(camera.zoom<1);a.click('#home');assert.equal(camera.auto,false);assert.equal(camera.zoom,1);
  a.click('#help');assert.equal(a.document.querySelector('#instructions').hidden,false);a.click('#close-help');assert.equal(a.document.querySelector('#instructions').hidden,true);
  a.click('#clear');assert.equal(a.world.tokens.length,0);assert.equal(a.world.lines.length,5);assert.equal(a.world.people.length,48);
});
