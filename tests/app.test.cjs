/* A dependency-free integration harness, not a substitute for browser visual QA. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const simulation=require('../simulation.js');
const graphics=require('../renderer.js');
const {AudioContext}=require('./helpers/audio.cjs');
const {PLAYABLE_THEMES}=require('../vendor/wonder-audio/audio.js');

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
  contains(element){return element===this;}
}
function boot(width=1440,height=900,{audio=false,muted=false,capture=false,theme='default'}={}){
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),elements=[];
  for(const [,tag,attrs]of html.matchAll(/<(\w+)\b([^>]*)>/g)){const el=new Element(attrs);el.attrs.set('tag',tag);elements.push(el);}
  const document=new Element(),window=new Element();
  document.querySelectorAll=selector=>elements.filter(el=>selector[0]==='.'?el.classList.contains(selector.slice(1)):selector==='[data-tool]'?!!el.dataset.tool:false);
  document.querySelector=selector=>{const el=elements.find(el=>el.attrs.get('id')===selector.slice(1));assert.ok(el,`Missing actual HTML element ${selector}`);return el;};
  const gl={draws:0,vertices:0};
  for(const name of ['createShader','createProgram','createBuffer','getUniformLocation'])gl[name]=()=>({});
  for(const name of ['shaderSource','compileShader','attachShader','linkProgram','bindBuffer','useProgram','enableVertexAttribArray','vertexAttribPointer','enable','depthFunc','clearColor','viewport','clear','uniform3fv','uniform2f'])gl[name]=()=>{};
  gl.getShaderParameter=gl.getProgramParameter=()=>true;gl.getAttribLocation=()=>0;
  gl.bufferData=(_,data)=>{assert.equal(data.length%11,0);for(const value of data)assert.ok(Number.isFinite(value),'A non-finite vertex reached WebGL');for(let i=10;i<data.length;i+=11)assert.ok(data[i]>=0&&data[i]<=1,'Vertex opacity is bounded');};
  gl.drawArrays=(_,__,count)=>{gl.draws++;gl.vertices=count;assert.ok(count>100);};
  const canvas=document.querySelector('#world');Object.assign(canvas,{clientWidth:width,clientHeight:height,getContext:()=>gl,getBoundingClientRect:()=>({left:0,top:0})});
  let world,renderer,scheduled,sound,now=1000;
  class World extends simulation.World{constructor(){super(()=>.4);world=this;}}
  class Renderer extends graphics.Renderer{
    constructor(c){super(c);renderer=this;this.calls=[];}
    begin(){super.begin();this.calls=[];}
    mesh(name,position,scale,hex,rotation,glow,opacity=1){
      if(capture)this.calls.push({name,position,scale,hex,rotation,opacity});
      super.mesh(name,position,scale,hex,rotation,glow,opacity);
    }
  }
  const storage=new Map([['little-wonders-muted',String(muted)],['little-wonders-music-theme',theme]]);
  const context=vm.createContext({document,window,console,AudioContext:audio?AudioContext:undefined,localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},LittleWorld3D:{...simulation,World},Wonder3D:{...graphics,Renderer},requestAnimationFrame:fn=>{scheduled=fn;}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../vendor/wonder-audio/audio.js'),'utf8'),context,{filename:'audio.js'});
  const BaseSoundtrack=context.WonderAudio.Soundtrack;
  context.WonderAudio.Soundtrack=class extends BaseSoundtrack{constructor(options){super(options);sound=this;}};
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../world.js'),'utf8'),context,{filename:'world.js'});
  function frame(ms=100){now+=ms;const fn=scheduled;assert.ok(fn);scheduled=null;fn(now);}
  function drag(a,b){canvas.dispatch('pointerdown',{clientX:a.x,clientY:a.y});canvas.dispatch('pointermove',{clientX:b.x,clientY:b.y});canvas.dispatch('pointerup',{clientX:b.x,clientY:b.y});}
  const click=selector=>document.querySelector(selector).dispatch('click');
  const shape=id=>document.querySelectorAll('.shape').find(b=>Number(b.dataset.shape)===id).dispatch('click');
  const tool=kind=>document.querySelectorAll('[data-tool]').find(b=>b.dataset.tool===kind).dispatch('click');
  return {world,renderer,canvas,gl,document,window,frame,drag,click,shape,tool,sound,storage};
}

test('the actual application starts and submits all six 3D discoveries',()=>{
  const app=boot();app.frame();assert.ok(app.gl.vertices>10000);assert.equal(app.world.people.length,48);
  app.world.people=[];
  for(let id=0;id<6;id++)assert.ok(app.world.place(id,{x:-8+id*3,y:0,z:0}));
  for(let i=0;i<40;i++)app.frame();
  assert.ok(app.world.tokens.every(t=>t.cycle===1));assert.ok(app.gl.vertices>15000);assert.equal(app.gl.draws,41);
  for(let i=0;i<55;i++)app.frame(); // Exercise every discovery through its dissolve.
  app.click('#pause');const time=app.world.time;app.frame();app.frame();assert.equal(app.world.time,time);
  app.click('#pause');app.frame();assert.ok(app.world.time>time);
});

test('real reveal events trigger every tune, repeat, and obey the sound controls',()=>{
  const a=boot(1440,900,{audio:true});a.frame();a.world.people=[];
  assert.equal(a.sound.context,null,'Page load must not autoplay');
  a.document.dispatch('pointerdown',{target:a.canvas});
  assert.equal(a.sound.context.state,'running');
  for(let id=0;id<6;id++)a.world.place(id,{x:-8+id*3,y:0,z:0});
  for(let i=0;i<7;i++)a.frame();
  assert.equal(a.sound.voices.size,6);
  assert.equal(a.sound.buffers.size,6);
  assert.ok(a.world.tokens.every(t=>t.cycle===1));
  for(const token of a.world.tokens)token.timer=.01;
  a.frame();assert.equal(a.sound.voices.size,9,'Repeated entrances share accents while foreground phrases finish');
  assert.equal([...a.sound.voiceInfo.values()].filter(info=>info.role==='phrase').length,3);
  a.click('#sound');assert.equal(a.sound.muted,true);assert.equal(a.sound.voices.size,0);
  assert.equal(a.document.querySelector('#sound').getAttribute('aria-pressed'),'true');
  for(const token of a.world.tokens)token.timer=.01;
  a.frame();assert.equal(a.sound.voices.size,0,'Muted reveals stay silent');
  a.window.dispatch('keydown',{key:'m'});assert.equal(a.sound.muted,false);
  a.click('#pause');assert.equal(a.sound.context.state,'suspended');
  a.document.hidden=true;a.document.dispatch('visibilitychange');
  a.click('#pause');assert.equal(a.sound.context.state,'suspended','Resuming while hidden stays silent');
  a.document.hidden=false;a.document.dispatch('visibilitychange');assert.equal(a.sound.context.state,'running');
  for(const token of a.world.tokens)token.timer=.01;
  a.frame();a.frame();assert.ok(a.sound.voices.size>0);
  a.click('#undo');assert.equal(a.sound.voices.size,0);
  a.sound.playDiscovery({id:0});a.click('#clear');assert.equal(a.sound.voices.size,0);
});

test('saved mute preference and unavailable audio preserve a playable world',()=>{
  const saved=boot(1440,900,{audio:true,muted:true});
  saved.document.dispatch('pointerdown',{target:saved.canvas});assert.equal(saved.sound.context,null);
  saved.click('#pause');saved.click('#sound');assert.equal(saved.sound.context,null);
  saved.click('#pause');assert.equal(saved.sound.context.state,'running','Unmute during pause starts music on resume');
  const silent=boot();silent.frame();silent.window.dispatch('keydown',{key:'1'});
  assert.equal(silent.document.querySelector('#sound').disabled,true);
  silent.world.people=[];assert.ok(silent.world.place(0,{x:0,y:0,z:0}));
  for(let i=0;i<7;i++)silent.frame();assert.equal(silent.world.tokens[0].cycle,1);
});

for(const theme of PLAYABLE_THEMES.filter(theme=>theme!=='default'))test(`the ${theme} selector updates all six existing objects and future placements together`,()=>{
  const a=boot(1440,900,{audio:true});a.frame();a.world.people=[];a.document.dispatch('pointerdown',{target:a.canvas});
  for(let id=0;id<6;id++)a.world.place(id,{x:-8+id*3,y:0,z:0});
  for(let i=0;i<7;i++)a.frame();
  const oldVoices=[...a.sound.voices.keys()],oldMusic=a.sound.music,select=a.document.querySelector('#music-theme');
  select.value=theme;select.dispatch('change');
  assert.equal(a.sound.theme,theme);assert.equal(select.value,theme);assert.equal(oldMusic.stopped,true);
  assert.ok(oldVoices.every(source=>source.stopped));assert.equal(a.sound.voices.size,6,'Pending entrances are rescheduled in the new theme');
  assert.ok([...a.sound.buffers.keys()].every(key=>key.startsWith(`${theme}:`)));
  assert.equal(a.storage.get('little-wonders-music-theme'),theme);
  a.sound.context.currentTime=a.sound.startedAt+.15;a.frame();
  for(const token of a.world.tokens)token.timer=.01;
  a.frame();assert.ok([...a.sound.buffers.keys()].every(key=>key.startsWith(`${theme}:`)));
  a.world.place(0,{x:0,y:0,z:5});for(let i=0;i<7;i++)a.frame();
  assert.equal(a.world.tokens.length,7);assert.ok([...a.sound.buffers.keys()].every(key=>key.startsWith(`${theme}:`)));
  a.click('#pause');select.value='default';select.dispatch('change');assert.equal(a.sound.context.state,'suspended');
  a.click('#pause');assert.equal(a.sound.theme,'default');assert.equal(a.sound.context.state,'running');
});

for(const theme of PLAYABLE_THEMES.filter(theme=>theme!=='default'))test(`saved ${theme} selection loads quietly and the selector keeps keyboard focus out of the game`,()=>{
  const a=boot(390,844,{audio:true,muted:true,theme}),select=a.document.querySelector('#music-theme');
  assert.equal(select.value,theme);assert.equal(a.sound.context,null);
  const yaw=a.renderer.camera.targetYaw;a.window.dispatch('keydown',{target:select,key:'ArrowRight'});
  assert.equal(a.renderer.camera.targetYaw,yaw);assert.equal(a.sound.context,null);
  select.value='default';select.dispatch('change');assert.equal(a.sound.muted,true);assert.equal(a.sound.context,null);
});

test('discoveries spring past full size, settle, and dissolve without contracting',()=>{
  const a=boot(1440,900,{capture:true});a.frame();a.world.people=[];
  a.world.place(0,{x:0,y:0,z:0});
  const cloud=()=>a.renderer.calls.find(c=>c.name==='sphere'&&c.hex==='#a6d7df'&&c.scale[0]/c.scale[1]>1.5);
  const sizes=[];
  for(let i=0;i<17;i++){a.frame();const c=cloud();if(c)sizes.push(c.scale[0]);}
  assert.ok(Math.max(...sizes)>.64*1.1,'The opening overshoots before settling');
  const settled=cloud();assert.ok(settled);assert.ok(Math.abs(settled.scale[0]-.64)<.003);
  assert.equal(settled.opacity,1);
  for(let i=0;i<67;i++)a.frame();
  const dissolving=cloud();assert.ok(dissolving);
  assert.ok(dissolving.opacity>0&&dissolving.opacity<.5);
  assert.ok(Math.abs(dissolving.scale[0]-settled.scale[0])<.003,'The ending preserves full geometry');
  a.click('#pause');const opacity=dissolving.opacity;a.frame();assert.equal(cloud().opacity,opacity);
});

test('the visual pop waits for the scheduled audio beat',()=>{
  const a=boot(1440,900,{audio:true,capture:true});a.frame();a.world.people=[];
  a.document.dispatch('pointerdown',{target:a.canvas});
  a.sound.context.currentTime=.63;
  a.world.place(0,{x:0,y:0,z:0});
  for(let i=0;i<7;i++)a.frame();
  const cloud=()=>a.renderer.calls.some(c=>c.name==='sphere'&&c.hex==='#a6d7df'&&c.scale[0]/c.scale[1]>1.5);
  assert.equal(cloud(),false,'The discovery stays hidden before its musical entrance');
  const source=[...a.sound.voices.keys()][0];assert.ok(source.when>a.sound.context.currentTime);
  a.sound.context.currentTime=source.when+.1;a.frame();
  assert.equal(cloud(),true,'The pop begins on the same clock as the tune');
});

test('compact mystery meshes fit inside their collision bodies',()=>{
  const a=boot(1440,900,{capture:true});a.frame();a.world.people=[];
  const kinds=['sphere','pyramid','diamond','box','hex','crescent'];
  for(let id=0;id<6;id++)a.world.place(id,{x:-8+id*3,y:0,z:0});
  a.frame();
  for(const token of a.world.tokens){
    const draw=a.renderer.calls.find(c=>c.name===kinds[token.id]&&Math.abs(c.position[0]-token.x)<1e-8&&c.position[1]>.1);
    assert.ok(draw);assert.ok(draw.scale.every(v=>v<.6),'The shapes stay smaller than the people');
    const vertices=graphics.meshes[draw.name],yaw=draw.rotation.y,body=a.world.tokenBody(token);
    for(let i=0;i<vertices.length;i+=6){
      const x=vertices[i]*draw.scale[0],y=vertices[i+1]*draw.scale[1],z=vertices[i+2]*draw.scale[2];
      const point={x:draw.position[0]+x*Math.cos(yaw)+z*Math.sin(yaw),y:draw.position[1]+y,z:draw.position[2]-x*Math.sin(yaw)+z*Math.cos(yaw),radius:.001,height:.002};
      assert.ok(simulation.overlaps(point,body),`Shape ${token.id} extends outside its collision body`);
    }
  }
});

for(const [width,height]of[[1440,900],[390,844]])test(`placement, camera, drawing, and undo controls work at ${width}px`,()=>{
  const a=boot(width,height);a.frame();a.world.people=[];a.click('#pause');
  const camera=a.renderer.camera,initial=camera.targetYaw;
  a.click('#rotate-right');assert.ok(camera.targetYaw>initial);a.frame();
  a.shape(3);const origin={x:-3,y:0,z:2},screen=camera.project(origin);a.drag(screen,screen);
  assert.equal(a.world.tokens.length,1);assert.ok(Math.hypot(a.world.tokens[0].x-origin.x,a.world.tokens[0].z-origin.z)<1e-9);
  a.tool('move');const from=camera.project({...origin,y:.45}),dest=camera.project({x:3,y:0,z:-2}),startFloor=camera.project(origin);
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


test('approved themes match the selector and archived or removed saved choices fall back quietly',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const choices=[...html.matchAll(/<option value="([^"]+)">/g)].map(m=>m[1]);
  assert.deepEqual(choices,PLAYABLE_THEMES);
  for(const theme of['jazz','rock','classical','british','guzheng','paganini']){
    const a=boot(390,844,{audio:true,theme});
    assert.equal(a.sound.theme,'default');assert.equal(a.sound.context,null);
    assert.equal(a.sound.setTheme(theme),false);
  }
});
