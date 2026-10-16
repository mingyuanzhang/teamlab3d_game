(() => {
  'use strict';
  const $=selector=>document.querySelector(selector);
  const canvas=$('#world'),{World,clamp}=LittleWorld3D;
  let renderer;
  try{renderer=new Wonder3D.Renderer(canvas);}catch(error){$('#webgl-error').hidden=false;console.error(error);return;}
  const camera=renderer.camera,world=new World();
  const shapeButtons=[...document.querySelectorAll('.shape')],toolButtons=[...document.querySelectorAll('[data-tool]')];
  const names=['Circle','Triangle','Diamond','Square','Hexagon','Crescent'];
  const palettes=[['#a6d7df','#729ebf','#c4b6df'],['#efae83','#edcf8f','#dc8fa4'],['#e5aeb9','#c4b1d8','#f3cfad'],['#b4c9a7','#e7b5c3','#c7accd'],['#adbbec','#dac6e4','#b0d9cb'],['#aad2ca','#e6cfa2','#bdc9ec']];
  const coats=['#ddc4a3','#adc1af','#c498a4','#a2b8d0','#cabb8e','#aaa1bf'];
  const skins=['#d9b99a','#a87959','#e7cdb4'];
  const levels=[0,2.4,3.8,5.2];
  let selected=null,tool='move',level=0,paused=false,last=0,accumulator=0,gesture=null,pointer=null,effects=[];
  const r=renderer,TAU=Math.PI*2;
  const noise=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
  const status=(text,visible=true)=>{$('#status').textContent=text;if(visible)$('#hint').textContent=text;};
  const point=e=>{const rect=canvas.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top};};
  const onPlane=(p,height=levels[level])=>camera.unproject(p.x,p.y,height);
  const stagePoint=(p,height=levels[level])=>{const q=onPlane(p,height);return world.validPoint(q)?q:null;};
  function lowerSurfacePoint(p){
    const candidates=[],ground=stagePoint(p,0);if(ground)candidates.push(ground);
    for(const line of world.lines){
      if(line.kind==='ladder'||line.a.y>=levels[level]-.15)continue;
      const q=stagePoint(p,line.a.y);if(!q)continue;const near=LittleWorld3D.closest(line,q.x,q.z);
      if(Math.hypot(near.x-q.x,near.z-q.z)<=line.width/2)candidates.push(q);
    }
    return candidates.sort((a,b)=>camera.project(b).depth-camera.project(a).depth)[0]||null;
  }
  const coords=p=>[p.x,p.y,p.z];
  function sync(){
    shapeButtons.forEach(b=>{
      const id=Number(b.dataset.shape),count=world.tokens.filter(t=>t.id===id).length;
      b.classList.toggle('selected',selected===id);b.classList.toggle('full',count===6);b.setAttribute('aria-pressed',String(selected===id));
      b.setAttribute('aria-label',`${names[id]}, ${count} of 6 placed`);
      b.querySelectorAll('i').forEach((dot,i)=>dot.classList.toggle('used',i<count));
    });
    toolButtons.forEach(b=>{b.classList.toggle('active',b.dataset.tool===tool);b.setAttribute('aria-pressed',String(b.dataset.tool===tool));});
    $('#height').value=`${levels[level]} m`;$('#height-up').disabled=level===levels.length-1;$('#height-down').disabled=level===0;
    $('#undo').disabled=!world.history.length;$('#orbit').setAttribute('aria-pressed',String(camera.auto));
    canvas.style.cursor=tool==='move'?'grab':'crosshair';
  }
  function chooseShape(id){selected=id;tool='place';gesture=null;sync();status(world.tokens.filter(t=>t.id===id).length===6?'All six are placed. Use the arrow to move them.':'Tap the stage. Let a little wonder unfold.');}
  function chooseTool(next){
    gesture=null;selected=null;tool=next;if(next==='ladder'&&level===0)level=1;sync();
    status({move:'Drag a shape to move it. Drag empty space to orbit.',line:`Draw a path at ${levels[level]} metres.`,ladder:`Draw from a lower surface to a path at ${levels[level]} metres.`,spring:`Draw a bouncing path at ${levels[level]} metres.`}[next]);
  }
  function changeHeight(delta){level=clamp(level+delta,0,levels.length-1);gesture=null;sync();status(`Building at ${levels[level]} metres. ${level?'Place a path, shape, or ladder up here.':'Back on the ground.'}`);}
  function place(id,p){
    const token=p&&world.place(id,p);sync();
    status(token?'Something is stirring. Give it a moment.':!p?'Place it inside the stage.':world.placementBlocked(p)?'A little person is here. Give them some room.':'All six are placed. Use the arrow to move them.');return token;
  }
  function hitToken(p){
    return world.tokens.map(token=>({token,screen:camera.project({x:token.x,y:token.y+.72,z:token.z})}))
      .filter(({screen})=>Math.hypot(screen.x-p.x,screen.y-p.y)<Math.max(15,canvas.clientHeight/camera.halfHeight*.40))
      .sort((a,b)=>b.screen.depth-a.screen.depth)[0]?.token;
  }
  function drawStage(){
    r.mesh('box',[0,-.64,0],[24.18,.20,18.18],'#0e1e25');
    r.mesh('box',[0,-.32,0],[24,.55,18],'#30494b');
    r.mesh('box',[0,-.075,0],[23.98,.09,17.98],'#3c5754');
    for(let x=-10;x<=10;x+=2)r.line([x,-.023,-8.9],[x,-.023,8.9],.009,'#49625b');
    for(let z=-8;z<=8;z+=2)r.line([-11.9,-.023,z],[11.9,-.023,z],.009,'#49625b');
    for(const z of [-8.97,8.97])r.line([-11.97,-.02,z],[11.97,-.02,z],.022,'#809384');
    for(const x of [-11.97,11.97])r.line([x,-.02,-8.97],[x,-.02,8.97],.022,'#809384');
    // Sparse tufts and little stones stay below the walking bodies.
    for(let i=0;i<35;i++){
      const x=(noise(i+9)-.5)*22.5,z=(noise(i+90)-.5)*16.5;
      if(i%3===0)r.mesh('particle',[x,.025,z],[.07,.04,.09],'#657b6b');
      else for(let j=0;j<3;j++)r.line([x,.005,z],[x+(j-1)*.05,.08+noise(i+j)*.08,z+.03],.009,'#718773');
    }
    for(const l of world.lines)drawPath(l);
  }
  function drawPath(l,preview=false){
    const a=coords(l.a),b=coords(l.b),dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz);
    const tint=preview?'#9dcbb6':l.kind==='spring'?'#ba9780':'#b1b39b';
    if(l.kind==='ladder'){
      const side=[Math.cos(yaw)*.38,0,-Math.sin(yaw)*.38];
      for(const sign of [-1,1])r.line(a.map((v,i)=>v+side[i]*sign),b.map((v,i)=>v+side[i]*sign),.035,preview?tint:'#a4b7ae');
      const count=Math.max(3,Math.ceil(Math.hypot(length,b[1]-a[1])/.28));
      for(let i=0;i<=count;i++){const p=a.map((v,j)=>v+(b[j]-v)*i/count);r.line(p.map((v,j)=>v-side[j]),p.map((v,j)=>v+side[j]),.026,preview?tint:'#c7c3a9');}
    }else{
      r.mesh('box',[(a[0]+b[0])/2,a[1]-.09,(a[2]+b[2])/2],[l.width,.16,length],preview?'#769c8b':'#7b8a7a',{y:yaw});
      r.mesh('box',[(a[0]+b[0])/2,a[1]-.015,(a[2]+b[2])/2],[l.width,.035,length],tint,{y:yaw});
      for(const end of [a,b]){r.mesh('cylinder',[end[0],end[1]-.09,end[2]],[l.width/2,.16,l.width/2],preview?'#769c8b':'#7b8a7a');r.mesh('cylinder',[end[0],end[1]-.015,end[2]],[l.width/2,.035,l.width/2],tint);}
      for(const sign of [-1,1]){
        const offset=[Math.cos(yaw)*l.width*.43*sign,.015,-Math.sin(yaw)*l.width*.43*sign];
        r.line(a.map((v,i)=>v+offset[i]),b.map((v,i)=>v+offset[i]),.012,preview?tint:'#d2cbb0');
      }
      if(l.a.y>.3&&!preview){
        for(const t of [.08,.92]){const x=a[0]+dx*t,z=a[2]+dz*t;r.mesh('cylinder',[x,a[1]/2-.12,z],[.055,a[1]-.14,.055],'#657d73');r.mesh('cylinder',[x,.025,z],[.19,.05,.19],'#526e63');}
      }
      if(l.kind==='spring'){
        const count=Math.ceil(length/.23);for(let i=0;i<count;i++){const t=i/count,x=a[0]+dx*t,z=a[2]+dz*t;const q=[Math.cos(yaw)*l.width*.32,0,-Math.sin(yaw)*l.width*.32];r.line([x-q[0],a[1]+.02+(l.pulse||0)*.14,z-q[2]],[x+q[0],a[1]+.02+(l.pulse||0)*.14,z+q[2]],.019,'#e9c394');}
      }
    }
  }
  function drawPerson(p){
    const s=p.size,yaw=p.heading,sy=Math.sin(yaw),cy=Math.cos(yaw),moving=['walk','climb'].includes(p.state);
    const swing=moving?Math.sin(p.walk*9+p.phase):p.state==='jump'?.7:0;
    const bob=moving?Math.abs(swing)*.022:0;
    const local=(x,y,z)=>[p.x+(x*cy+z*sy)*s,p.y+(y+bob)*s,p.z+(-x*sy+z*cy)*s];
    const mesh=(name,pos,scale,c,rot={})=>r.mesh(name,local(...pos),scale.map(v=>v*s),c,{...rot,y:(rot.y||0)+yaw});
    const limb=(a,b,radius,c)=>r.line(local(...a),local(...b),radius*s,c);
    const shadowY=world.heightBelow(p.x,p.z,p.y+.03);
    r.mesh('cylinder',[p.x,shadowY+.012,p.z],[.25*s,.012,.19*s],'#334c48');
    const leg=swing*.10,skin=skins[p.skin],coat=coats[p.color];
    limb([-.075,.4,0],[-.085,.09,leg],.051,'#555c62');limb([.075,.4,0],[.085,.09,-leg],.051,'#555c62');
    mesh('box',[-.085,.055,leg+.025],[.115,.075,.17],'#3e464b');mesh('box',[.085,.055,-leg+.025],[.115,.075,.17],'#3e464b');
    mesh('box',[0,.55,0],[.31,.38,.20],coat);mesh('sphere',[0,.76,0],[.08,.08,.08],skin);
    mesh('sphere',[0,.91,0],[.146,.162,.14],skin);
    const climbing=p.state==='climb';
    for(const sign of [-1,1]){
      const hand=[sign*.245,climbing?.78+sign*swing*.09:.37,climbing?.12:-sign*leg];
      limb([sign*.16,.69,0],hand,.049,coat);mesh('particle',hand,[.05,.05,.05],skin);
    }
    for(const x of [-.052,.052])mesh('particle',[x,.925,.132],[.017,.021,.012],'#43494a');
    mesh('particle',[0,.883,.147],[.025,.016,.017],skin);
    if(p.hat===0){mesh('cylinder',[0,1.035,0],[.19,.025,.18],'#b5ab8c');mesh('cylinder',[0,1.085,0],[.125,.10,.12],'#c4b899');}
    else if(p.hat===1){mesh('sphere',[0,1.035,-.01],[.15,.075,.14],'#7d9398');mesh('box',[0,1.025,.1],[.20,.025,.18],'#8aa0a2');}
    else if(p.hat===2)mesh('cone',[0,1.06,0],[.145,.17,.145],'#b6a3a7');
    else mesh('sphere',[0,1.025,-.025],[.148,.065,.135],'#796957');
    if(p.expression>0){const q=local(0,1.31,0);r.mesh('diamond',q,[.043,.071,.043],'#ebd5a1',{y:world.time},.7);}
  }
  function drawToken(t,position=null,preview=false){
    const p=position||t,age=world.time,blocked=preview&&world.placementBlocked(p),c=blocked?'#d88b85':palettes[t.id][0];
    const y=p.y+.72+Math.sin(age*1.3+t.id)*.045;
    r.ring([p.x,p.y+.035,p.z],.64,preview?c:'#a9b8a2',{},.15);
    r.mesh('cylinder',[p.x,p.y+.02,p.z],[.51,.035,.51],preview?'#506e63':'#526c61');
    const mesh=['sphere','pyramid','diamond','box','hex','crescent'][t.id];
    const size=t.id===3?[.72,.72,.72]:t.id===1?[.49,.94,.49]:t.id===4?[.44,.7,.44]:[.43,.43,.43];
    r.mesh(mesh,[p.x,y,p.z],size,c,{y:age*.24+t.id*.7},.15);
    if(!preview){const a=(1-t.timer/t.period)*TAU;r.mesh('particle',[p.x+Math.cos(a)*.64,p.y+.07,p.z+Math.sin(a)*.64],[.04,.04,.04],c,{},.8);}
  }
  function drawEffect(e){
    const t=e.age,c=palettes[e.id],grow=clamp(t*1.8,0,1)*clamp(e.life-t,0,1),seed=e.tokenId*7;
    const p=(x,y,z)=>[e.x+x*grow,e.y+y*grow,e.z+z*grow];
    const mesh=(name,pos,scale,hex,rot={},glow=.18)=>r.mesh(name,p(...pos),scale.map(v=>v*grow),hex,rot,glow);
    const line=(a,b,radius,hex,glow=.3)=>r.line(p(...a),p(...b),radius*grow,hex,glow);
    if(e.id===0){
      for(let j=0;j<5;j++)mesh('sphere',[(j-2)*.43,4.2+Math.sin(j)*.15,Math.cos(j)*.22],[.64,.29,.47],j%2?c[2]:c[0]);
      for(let i=0;i<27;i++){const x=(noise(i+seed)-.5)*2.8,z=(noise(i+seed+43)-.5)*1.7,y=4-((t*1.7+noise(i+7)*4)%3.7);line([x,y,z],[x-.03,y+.20,z],.018,c[i%3]);}
      for(let i=0;i<4;i++){const a=t*1.5+i*1.57;mesh('particle',[Math.cos(a)*.9,.16,Math.sin(a)*.6],[.06,.035,.06],c[i%3]);}
    }else if(e.id===1){
      for(let burst=0;burst<2;burst++){
        const age=(t+burst*1.15)%2.8,explode=clamp((age-.5)/1.4,0,1),center=[burst?.8:-.6,3.2+burst*.9,burst?-.7:.4];
        if(age<.5)line([center[0],.8+age*4.8,center[2]],[center[0],1+age*4.8,center[2]],.035,c[1]);
        else for(let i=0;i<23;i++){
          const az=i*2.3999,dy=1-2*(i+.5)/23,slice=Math.sqrt(1-dy*dy),reach=explode*2.1;
          const end=[center[0]+Math.cos(az)*slice*reach,center[1]+dy*reach-explode*explode*.7,center[2]+Math.sin(az)*slice*reach];
          const start=end.map((v,j)=>center[j]+(v-center[j])*.88);line(start,end,.024*(1-explode*.65),c[i%3],.8);
          mesh('particle',end,[.043,.043,.043].map(v=>v*(1-explode*.7)),c[i%3],{},.8);
        }
      }
    }else if(e.id===2){
      for(let i=0;i<8;i++){
        const rise=(t*.44+i*.43)%4.7,x=Math.sin(t*.7+i*2)*.45+(noise(seed+i)-.5)*1.9,z=Math.cos(t*.4+i)*.5+(noise(i+11)-.5)*1.3;
        mesh('sphere',[x,1.4+rise,z],[.25,.34,.25],c[i%3]);
        let previous=[x,1.08+rise,z];for(let j=1;j<=6;j++){const q=[x+Math.sin(t+i+j*.5)*j*.013,1.08+rise-j*.14,z+Math.sin(j*.4+t)*.05];line(previous,q,.007,'#c1c7b4',0);previous=q;}
      }
    }else if(e.id===3){
      for(let i=0;i<7;i++){
        const angle=i*2.399,reach=.3+noise(i+seed)*1.15,h=(1.2+noise(i+9)*1.8)*clamp(t*.7-i*.07,0,1),x=Math.cos(angle)*reach,z=Math.sin(angle)*reach;
        line([0,.1,0],[x*.5,h*.5,z*.5],.023,'#7b9d85');line([x*.5,h*.5,z*.5],[x,h,z],.019,'#9eb990');
        mesh('sphere',[x*.55+.13,h*.5,z*.55],[.25,.045,.11],c[0],{z:.5,y:angle});
        const bloom=clamp(t-1-i*.08,0,1);for(let j=0;j<6;j++){const a=j/6*TAU;mesh('sphere',[x+Math.cos(a)*.16*bloom,h+Math.sin(a)*.16*bloom,z],[.13*bloom,.1*bloom,.065*bloom],c[1+i%2],{z:a});}
        mesh('particle',[x,h,z],[.075,.075,.075],'#e5cf8e');
      }
    }else if(e.id===4){
      for(let j=0;j<5;j++){
        let previous=null;for(let i=0;i<=29;i++){
          const u=i/29,a=u*7-t*1.1+j*.16,q=[u*4.2-1.8,u*2.6+1+Math.sin(a)*.42,Math.cos(a)*(.25+u*.8)+(j-2)*.10];
          if(previous)line(previous,q,j%2?.014:.022,c[j%3],.4);previous=q;
        }
      }
    }else{
      const center=p(0,2.1+Math.sin(t*.6)*.2,0);
      mesh('sphere',[0,2.1+Math.sin(t*.6)*.2,0],[.24,.24,.24],c[1],{},.8);
      for(let i=0;i<4;i++){
        const a=t*.35+i*.8,rx=.45+i*.22,rz=i*.7;
        r.ring(center,(.8+i*.35)*grow,c[i%3],{x:rx,z:rz,y:a},.55);
        const radius=(.8+i*.35)*grow,orbit=t*(.7+i*.12)+i;
        // Rotate an orbiting bead with its ring, in all three dimensions.
        const x=Math.cos(orbit)*radius,y=-Math.sin(orbit)*radius*Math.sin(rx),z=Math.sin(orbit)*radius*Math.cos(rx);
        const x1=x*Math.cos(a)+z*Math.sin(a),z1=-x*Math.sin(a)+z*Math.cos(a);
        r.mesh('particle',[center[0]+x1*Math.cos(rz)-y*Math.sin(rz),center[1]+x1*Math.sin(rz)+y*Math.cos(rz),center[2]+z1],[.07*grow,.07*grow,.07*grow],c[i%3],{},.8);
      }
    }
  }
  function render(){
    r.begin();drawStage();world.people.forEach(drawPerson);
    for(const token of world.tokens){const moved=gesture?.type==='token'&&gesture.uid===token.uid;drawToken(token,moved?gesture.world:null,moved);}
    effects.forEach(drawEffect);
    let ghost=null,id=selected;
    if(gesture?.type==='new'){ghost=stagePoint(gesture.screen);id=gesture.id;}
    else if(pointer&&tool==='place'&&!gesture)ghost=stagePoint(pointer);
    if(ghost&&id!==null)drawToken({id},ghost,true);
    if(gesture?.type==='draw'&&gesture.world){const a=gesture.start,b=gesture.world;const lower=tool==='ladder'?world.heightBelow(a.x,a.z,levels[level]-.15):levels[level];drawPath({a:{...a,y:lower},b:{...b,y:levels[level]},kind:tool,width:tool==='ladder'?.8:1.55},true);}
    r.render();
  }
  function cancelGesture(){gesture=null;canvas.style.cursor=tool==='move'?'grab':'crosshair';}
  function undo(){if(world.undo()){effects=[];cancelGesture();sync();status('One small step back.');}}
  function pause(){paused=!paused;accumulator=0;const b=$('#pause');b.setAttribute('aria-pressed',String(paused));b.textContent=paused?'▷':'Ⅱ';b.setAttribute('aria-label',paused?'Resume animation':'Pause animation');b.title=paused?'Resume · Space':'Pause · Space';status(paused?'A quiet moment. You can still build and rotate.':'Their little lives go on.');}
  function rotate(delta){camera.targetYaw+=delta;camera.auto=false;sync();}
  function autoRotate(){camera.auto=!camera.auto;sync();}
  function zoom(factor){camera.zoom=clamp(camera.zoom*factor,.55,1.65);camera.refresh();}
  function help(open){$('#instructions').hidden=!open;$('#help').setAttribute('aria-expanded',String(open));if(open)$('#close-help').focus();else $('#help').focus();}
  canvas.addEventListener('pointerdown',e=>{
    if(e.isPrimary===false||gesture||e.button!==0)return;const p=point(e);pointer=p;canvas.setPointerCapture(e.pointerId);
    if(tool==='place'){gesture={type:'place',startScreen:p,screen:p,pointerId:e.pointerId};return;}
    if(tool!=='move'){const q=tool==='ladder'?lowerSurfacePoint(p):stagePoint(p);if(q)gesture={type:'draw',start:q,world:stagePoint(p),pointerId:e.pointerId};return;}
    const token=hitToken(p);camera.auto=false;sync();
    if(token){const q=onPlane(p,token.y);gesture={type:'token',uid:token.uid,height:token.y,world:{x:token.x,y:token.y,z:token.z},offset:{x:token.x-q.x,z:token.z-q.z},pointerId:e.pointerId};canvas.style.cursor='grabbing';}
    else{gesture={type:'orbit',startScreen:p,yaw:camera.targetYaw,pitch:camera.targetPitch,pointerId:e.pointerId};canvas.style.cursor='grabbing';}
  });
  canvas.addEventListener('pointermove',e=>{
    pointer=point(e);const g=gesture;if(!g||g.pointerId!==e.pointerId)return;
    if(g.type==='orbit'){camera.targetYaw=g.yaw-(pointer.x-g.startScreen.x)*.008;camera.targetPitch=clamp(g.pitch+(pointer.y-g.startScreen.y)*.004,.30,1.15);}
    else if(g.type==='token'){const p=onPlane(pointer,g.height);g.world={x:clamp(p.x+g.offset.x,-11.45,11.45),y:g.height,z:clamp(p.z+g.offset.z,-8.45,8.45)};}
    else if(g.type==='draw')g.world=stagePoint(pointer);
    else g.screen=pointer;
  });
  canvas.addEventListener('pointerup',e=>{
    const g=gesture;if(!g||g.pointerId!==e.pointerId)return;
    if(g.type==='place'&&Math.hypot(point(e).x-g.startScreen.x,point(e).y-g.startScreen.y)<12)place(selected,stagePoint(point(e)));
    if(g.type==='token'){
      const t=world.tokens.find(t=>t.uid===g.uid);if(t&&Math.hypot(t.x-g.world.x,t.z-g.world.z)>.05){const moved=world.move(g.uid,g.world);status(moved?'A new home for the next discovery.':'A little person is here. The shape stayed put.');sync();}
    }
    if(g.type==='draw'){
      const made=g.world&&world.addLine(tool,g.start,g.world,levels[level]);sync();
      status(made?'A new possibility for their little lives.':tool==='ladder'&&level===0?'Raise the building height to draw a ladder.':world.lines.length>=30?'The world is full. Undo a path to make room.':'Drag a little farther, inside the stage.');
    }
    cancelGesture();
  });
  canvas.addEventListener('pointercancel',cancelGesture);canvas.addEventListener('lostpointercapture',cancelGesture);canvas.addEventListener('pointerleave',()=>{pointer=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(e.deltaY*.001));},{passive:false});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  shapeButtons.forEach(b=>{
    b.querySelector('.slots').innerHTML='<i></i>'.repeat(6);
    b.addEventListener('click',()=>chooseShape(Number(b.dataset.shape)));
    b.addEventListener('pointerdown',e=>{
      if(e.isPrimary===false||gesture||e.button!==0)return;const id=Number(b.dataset.shape);chooseShape(id);b.setPointerCapture(e.pointerId);const p=point(e);gesture={type:'new',id,screen:p,startScreen:p,pointerId:e.pointerId};
    });
    b.addEventListener('pointermove',e=>{if(gesture?.type==='new'&&gesture.pointerId===e.pointerId)gesture.screen=point(e);});
    b.addEventListener('pointerup',e=>{
      if(gesture?.type!=='new'||gesture.pointerId!==e.pointerId)return;const g=gesture,p=point(e);
      if(Math.hypot(p.x-g.startScreen.x,p.y-g.startScreen.y)>12)place(g.id,stagePoint(p));cancelGesture();
    });
    b.addEventListener('pointercancel',cancelGesture);b.addEventListener('lostpointercapture',cancelGesture);
    b.addEventListener('keydown',e=>{
      if(e.key!=='Enter')return;e.preventDefault();const id=Number(b.dataset.shape);chooseShape(id);
      for(let i=0;i<100;i++){const angle=i*2.3999,reach=Math.sqrt(i)*.8,p={x:Math.cos(angle)*reach,y:levels[level],z:Math.sin(angle)*reach};if(!world.placementBlocked(p)){place(id,p);return;}}
      status('No room here. Try a different building height.');
    });
  });
  toolButtons.forEach(b=>b.addEventListener('click',()=>chooseTool(b.dataset.tool)));
  $('#height-up').addEventListener('click',()=>changeHeight(1));$('#height-down').addEventListener('click',()=>changeHeight(-1));
  $('#undo').addEventListener('click',undo);
  $('#clear').addEventListener('click',()=>{world.reset();effects=[];cancelGesture();selected=null;tool='move';sync();status('A fresh start. Six of each shape, all to discover.');});
  $('#pause').addEventListener('click',pause);$('#rotate-left').addEventListener('click',()=>rotate(-Math.PI/4));$('#rotate-right').addEventListener('click',()=>rotate(Math.PI/4));$('#orbit').addEventListener('click',autoRotate);
  $('#zoom-in').addEventListener('click',()=>zoom(.88));$('#zoom-out').addEventListener('click',()=>zoom(1/.88));$('#home').addEventListener('click',()=>{camera.reset();sync();});
  $('#help').addEventListener('click',()=>help($('#instructions').hidden));$('#close-help').addEventListener('click',()=>help(false));
  window.addEventListener('keydown',e=>{
    if(e.target.matches('input,textarea,select')||e.repeat)return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();return;}
    if(e.key==='Escape'){cancelGesture();selected=null;tool='move';sync();if(!$('#instructions').hidden)help(false);return;}
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(/^[1-6]$/.test(e.key))chooseShape(Number(e.key)-1);
    const shortcut={v:'move',l:'line',h:'ladder',b:'spring'}[e.key.toLowerCase()];if(shortcut)chooseTool(shortcut);
    if(e.key==='ArrowLeft'){e.preventDefault();rotate(-Math.PI/4);}if(e.key==='ArrowRight'){e.preventDefault();rotate(Math.PI/4);}
    if(e.key.toLowerCase()==='r')autoRotate();if(e.key==='[')changeHeight(-1);if(e.key===']')changeHeight(1);
    if(e.code==='Space'&&!e.target.closest('button')){e.preventDefault();pause();}
  });
  function resize(){renderer.resize();cancelGesture();}
  window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;});
  canvas.addEventListener('webglcontextlost',()=>{$('#webgl-error').hidden=false;$('#webgl-error').textContent='The 3D connection was interrupted. Reload the page to return to the world.';});
  function frame(now){
    if(renderer.lost)return;const dt=last?Math.min((now-last)/1000,.1):0;last=now;camera.update(dt);
    if(!paused){
      accumulator+=dt;while(accumulator>=1/60){
        world.update(1/60);for(const event of world.drainEvents())effects.push({...event,age:0,life:8.5});
        for(const effect of effects)effect.age+=1/60;effects=effects.filter(e=>e.age<e.life).slice(-48);accumulator-=1/60;
      }
    }
    render();requestAnimationFrame(frame);
  }
  resize();sync();requestAnimationFrame(frame);
})();
