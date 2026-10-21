const {test}=require('node:test');
const assert=require('node:assert/strict');
const {World,overlaps}=require('../simulation.js');
const {Camera,meshes}=require('../renderer.js');
const create=(seed=31)=>new World(()=>((seed=seed*16807%2147483647)/2147483647));
function advance(w,seconds){for(let i=0;i<seconds*60;i++)w.update(1/60);}
function assertSpace(w){for(let i=0;i<w.people.length;i++)for(let j=i+1;j<w.people.length;j++)assert.ok(!overlaps(w.people[i],w.people[j]),`Bodies ${i} and ${j} overlap at ${w.time}`);}
function groundPerson(p,x,z){Object.assign(p,{x,y:0,z,support:'ground',ladder:null,rest:0,decision:100,cooldown:100,vy:0,vx:0,vz:0,state:'walk'});return p;}

test('48 people start with distinct body volumes, including maximum sizes',()=>{
  for(const w of [create(),new World(()=>0),new World(()=>.99999)]){assert.equal(w.people.length,48);assert.equal(new Set(w.people.map(p=>p.trait.name)).size,6);assertSpace(w);}
});

test('people at different heights can share a horizontal position',()=>{
  const a={x:0,y:0,z:0,radius:.34,height:1.14};
  assert.ok(overlaps(a,{...a,x:.4}));assert.ok(!overlaps(a,{...a,y:2.4}));assert.ok(!overlaps(a,{...a,x:.69}));
});

test('collision capsules enclose swinging shoes, arms, heads, and hats',()=>{
  const p=create().people[0],s=p.size,low=p.radius-p.footPadding,high=p.height-p.radius;
  for(const [x,y,z]of[[.145,.017,.21],[.295,.4,.1],[.15,1.03,.04],[.125,1.157,.025],[.19,1.047,.04]]){
    const dy=Math.max(0,low-y*s,y*s-high);
    assert.ok((x*s)**2+(z*s)**2+dy*dy<=p.radius**2,'Animated body exceeded its collision volume');
  }
});

test('walkers approaching head-on yield without passing through each other',()=>{
  const w=create();w.lines=[];w.people=w.people.slice(0,2);
  const a=groundPerson(w.people[0],-2,0),b=groundPerson(w.people[1],2,0);a.heading=Math.PI/2;b.heading=-Math.PI/2;
  for(let i=0;i<1200;i++){w.update(1/60);assertSpace(w);}
  assert.ok(Math.hypot(a.x+2,a.z)>1);assert.ok(Math.hypot(b.x-2,b.z)>1);
});

test('swept movement cannot jump through an occupied volume',()=>{
  const w=create();w.lines=[];w.people=w.people.slice(0,2);
  const p=groundPerson(w.people[0],-2,0);groundPerson(w.people[1],0,0);
  assert.equal(w.commit(p,{x:2,y:0,z:0}),false);assert.equal(p.x,-2);assertSpace(w);
});

test('falling bodies cannot land inside another person',()=>{
  const w=create();w.lines=[];w.people=w.people.slice(0,2);
  const a=groundPerson(w.people[0],0,0),b=groundPerson(w.people[1],0,0);a.rest=100;
  Object.assign(b,{y:4,support:null,vy:-3});
  for(let i=0;i<600;i++){w.update(1/60);assertSpace(w);}
  assert.ok(b.y<.01,'falling person eventually finds room to land');
});

test('gravity lands people on elevated paths; removing a support releases them',()=>{
  const w=create();w.people=w.people.slice(0,1);w.lines=[];
  assert.ok(w.addLine('line',{x:-3,y:0,z:0},{x:3,y:0,z:0},2.4));
  const p=w.people[0];Object.assign(p,{x:0,y:4,z:0,support:null,ladder:null,vx:0,vz:0,vy:0});
  advance(w,.7);assert.equal(p.support,w.lines[0].uid);assert.equal(p.y,2.4);
  w.undo();assert.equal(p.support,null);advance(w,2);assert.equal(p.y,0);assert.equal(p.support,'ground');
});

test('springs launch people upwards in 3D',()=>{
  const w=create();w.people=w.people.slice(0,1);w.lines=[];
  w.addLine('spring',{x:-3,y:0,z:0},{x:3,y:0,z:0},0);
  const p=groundPerson(w.people[0],0,0);p.cooldown=0;w.update(1/60);
  assert.equal(p.state,'jump');assert.ok(p.vy>0);advance(w,.3);assert.ok(p.y>1);assert.ok(w.lines[0].pulse>0);
});

test('a ladder connects a lower surface to a raised platform',()=>{
  const w=create();w.random=()=>0;w.lines=[];w.people=w.people.slice(0,1);
  w.addLine('line',{x:-3,y:0,z:0},{x:3,y:0,z:0},2.4);
  w.addLine('ladder',{x:0,y:0,z:3},{x:0,y:0,z:0},2.4);
  const p=groundPerson(w.people[0],0,3);p.cooldown=0;w.update(1/60);assert.equal(p.state,'climb');
  let arrived=false;for(let i=0;i<600;i++){w.update(1/60);if(p.support===w.lines[0].uid){arrived=true;break;}}
  assert.ok(arrived);assert.equal(p.y,2.4);
});

test('climbers on the same ladder keep their distance',()=>{
  const w=create();w.lines=[];w.people=w.people.slice(0,2);
  w.addLine('ladder',{x:0,y:0,z:4},{x:0,y:0,z:0},3.8);const l=w.lines[0];
  for(let i=0;i<2;i++){const p=w.people[i],u=.2+i*.5;Object.assign(p,{x:0,y:3.8*u,z:4*(1-u),u,ladder:l.uid,support:null,direction:i===0?1:-1});}
  let waited=false;for(let i=0;i<600;i++){w.update(1/60);assertSpace(w);if(w.people.some(p=>p.state==='wait'))waited=true;}
  assert.ok(waited);
  w.undo();for(const p of w.people)assert.equal(p.ladder,null);advance(w,3);assertSpace(w);
});

test('six copies of each shape have independent clocks and 3D positions',()=>{
  const w=create();w.people=[];
  for(let id=0;id<6;id++)for(let n=0;n<6;n++)assert.ok(w.place(id,{x:n-3,y:id*.8,z:id-3}));
  assert.equal(w.tokens.length,36);assert.equal(new Set(w.tokens.map(t=>t.uid)).size,36);
  assert.equal(w.place(0,{x:0,y:0,z:0}),undefined);assert.equal(w.place(6,{x:0,y:0,z:0}),undefined);
  advance(w,.6);const first=w.drainEvents();assert.equal(first.length,36);assert.ok(first.some(e=>e.y===4));
  advance(w,9);assert.ok(w.drainEvents().some(e=>e.id===0));
  const uid=w.tokens[0].uid,other=JSON.stringify(w.tokens[1]);assert.ok(w.move(uid,{x:5,y:3.8,z:6}));assert.equal(JSON.stringify(w.tokens[1]),other);
  advance(w,.6);assert.ok(w.drainEvents().some(e=>e.tokenId===uid&&e.x===5&&e.y===3.8&&e.z===6));
  assert.ok(w.undo());assert.equal(w.tokens[0].x,-3);assert.equal(w.tokens[0].y,0);
});

test('people block both placement and movement, while shapes can share an origin',()=>{
  const w=create();w.people=w.people.slice(0,1);groundPerson(w.people[0],0,0);
  assert.ok(w.placementBlocked({x:0,y:0,z:0}));assert.ok(w.placementBlocked({x:.7,y:0,z:0}));
  assert.equal(w.placementBlocked({x:.8,y:0,z:0}),false,'Compact shapes leave space beside a person');
  assert.equal(w.place(0,{x:0,y:0,z:0}),undefined);
  const t=w.place(0,{x:3,y:0,z:0});assert.ok(t);assert.equal(w.move(t.uid,{x:0,y:0,z:0}),undefined);assert.equal(t.x,3);
  assert.ok(w.place(1,{x:3,y:0,z:0}));assert.ok(w.place(2,{x:0,y:2.4,z:0}));
});

test('walkers avoid placed shapes',()=>{
  const w=create();w.lines=[];w.people=w.people.slice(0,1);const p=groundPerson(w.people[0],-3,0);p.heading=Math.PI/2;
  const t=w.place(0,{x:0,y:0,z:0});assert.ok(t);
  for(let i=0;i<1200;i++){w.update(1/60);assert.ok(!overlaps(p,w.tokenBody(t)));}assert.ok(Math.abs(p.z)>.1);
});

test('invalid edits and background delays keep the world bounded',()=>{
  const w=create(),history=w.history.length;
  for(const p of [{x:NaN,y:0,z:0},{x:Infinity,y:0,z:0},{x:0,y:-1,z:0},{x:30,y:0,z:0}])assert.equal(w.place(0,p),undefined);
  assert.equal(w.history.length,history);assert.equal(w.addLine('line',{x:0,y:0,z:0},{x:2,y:0,z:0},NaN),false);
  w.update(Infinity);w.update(-1);assert.equal(w.time,0);w.update(10000);assert.ok(w.time<=.051);
});

for(const seed of [31,9871])test(`ten simulated minutes without overlapping bodies (seed ${seed})`,()=>{
  const w=create(seed),states=new Set();
  for(let frame=0;frame<36000;frame++){
    if(frame%900===0){const p={x:-9+(frame/900)%6*3,y:frame%1800?2.4:0,z:-7+(frame/900)%5*3};w.place((frame/900)%6,p);}
    if(frame%4000===0)w.addLine('line',{x:-8,y:0,z:0},{x:7,y:0,z:0},2.4);
    if(frame===13000)w.undo();if(frame===22000)w.reset();
    w.update(1/60);assertSpace(w);
    if(frame%60===0)w.drainEvents();
    for(const p of w.people){states.add(p.state);assert.ok([p.x,p.y,p.z,p.vy].every(Number.isFinite));assert.ok(p.y>=0&&p.y<10);assert.ok(Math.abs(p.x)<=12&&Math.abs(p.z)<=9);}
    assert.ok(w.events.length<=72);assert.ok(w.history.length<=50);assert.ok(w.tokens.length<=36);
  }
  for(const state of ['walk','climb','jump','fall','wait'])assert.ok(states.has(state),`missing ${state}`);
});

test('camera placement rays stay aligned through rotation, zoom, and phone dimensions',()=>{
  const c=new Camera();
  for(const [width,height]of[[1440,900],[390,844]])for(const yaw of [0,.64,Math.PI/2,Math.PI,5])for(const pitch of [.3,.63,1.15])for(const zoom of [.55,1,1.65]){
    Object.assign(c,{width,height,yaw,pitch,zoom});c.refresh();
    for(const p of [{x:3,y:0,z:-4},{x:-5,y:3.8,z:2}]){const screen=c.project(p),q=c.unproject(screen.x,screen.y,p.y);assert.ok(Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)<1e-10);}
  }
});

test('all local meshes have finite vertices and normals',()=>{
  for(const [name,mesh]of Object.entries(meshes)){assert.ok(mesh.length>0);assert.equal(mesh.length%18,0,name);assert.ok(mesh.every(Number.isFinite),name);}
});
