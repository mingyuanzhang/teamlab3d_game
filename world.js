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
  const soundButton=$('#sound'),themeSelect=$('#music-theme'),sound=new WonderAudio.Soundtrack({onChange:syncSound,themeIds:WonderAudio.PLAYABLE_THEMES});
  function syncSound(){
    soundButton.disabled=!sound.supported;soundButton.setAttribute('aria-pressed',String(sound.muted));
    const label=!sound.supported?'Audio unavailable in this browser':sound.muted?'Unmute sound':'Mute sound';
    soundButton.setAttribute('aria-label',label);soundButton.title=`${label} · M`;
    themeSelect.disabled=!sound.supported;themeSelect.value=sound.theme;
  }
  function toggleSound(){if(!sound.supported)return;sound.setMuted(!sound.muted);if(sound.supported)status(sound.muted?'Music and discovery tunes muted.':'Music and discovery tunes on.',false);}
  function chooseMusicTheme(){
    if(!sound.setTheme(themeSelect.value)){syncSound();return;}
    for(const effect of effects){
      effect.musicBeat=0;
      if(effect.age<0){
        const cue=sound.queueDiscovery(effect)||sound.nextEntrance();
        effect.startsAt=cue?.when;effect.musicBeat=cue?.beat??0;
        effect.age=cue?Math.min(0,sound.context.currentTime-cue.when):0;
      }
    }
    status(`${WonderAudio.THEMES[sound.theme].name} music. Every discovery follows its chords and groove.`,false);
  }
  document.addEventListener('pointerdown',e=>{if(e.isPrimary!==false&&e.button===0&&!soundButton.contains(e.target)&&!themeSelect.contains(e.target))sound.unlock();},{capture:true});
  document.addEventListener('click',e=>{if(!soundButton.contains(e.target)&&!themeSelect.contains(e.target))sound.unlock();},{capture:true});
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
    return world.tokens.map(token=>({token,screen:camera.project({x:token.x,y:token.y+.45,z:token.z})}))
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
    const y=p.y+.45+Math.sin(age*1.3+t.id)*.03;
    r.ring([p.x,p.y+.035,p.z],.41,preview?c:'#a9b8a2',{},.12);
    r.mesh('cylinder',[p.x,p.y+.02,p.z],[.33,.025,.33],preview?'#506e63':'#526c61');
    const mesh=['sphere','pyramid','diamond','box','hex','crescent'][t.id];
    const size=t.id===3?[.72,.72,.72]:t.id===1?[.49,.94,.49]:t.id===4?[.44,.7,.44]:[.43,.43,.43];
    r.mesh(mesh,[p.x,y,p.z],size.map(v=>v*.62),c,{y:age*.24+t.id*.7},.1);
    if(!preview){const a=(1-t.timer/t.period)*TAU;r.mesh('particle',[p.x+Math.cos(a)*.41,p.y+.06,p.z+Math.sin(a)*.41],[.025,.025,.025],c,{},.65);}
  }
  function drawEffect(e){
    const t=e.age;if(t<0)return;
    const c=palettes[e.id],grow=1-Math.exp(-t*8)*Math.cos(t*15),seed=e.tokenId*7+e.cycle*53;
    const transport=sound.currentBeat();
    const beat=e.musicBeat!==undefined&&transport!==null?Math.max(0,transport-e.musicBeat):WonderAudio.straightBeat(t/sound.beatLength,sound.theme);
    const pulse=.5+.5*Math.cos((transport??beat)*TAU);
    const wobble=Math.sin(t*18)*Math.exp(-t*5)*.16;
    const stretch=[grow*(1+wobble),grow*(1-wobble*.8),grow*(1+wobble*.6)];
    const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
    const fade=smooth((t-e.life+2)/2),opacity=1-fade;
    const p=(x,y,z)=>[e.x+x*stretch[0],e.y+y*stretch[1],e.z+z*stretch[2]];
    const mesh=(name,pos,scale,hex,rot={},glow=.18,alpha=1)=>r.mesh(name,p(...pos),scale.map((v,i)=>v*stretch[i]),hex,rot,glow,opacity*clamp(alpha,0,1));
    const line=(a,b,radius,hex,glow=.3,alpha=1)=>r.line(p(...a),p(...b),radius*grow,hex,glow,opacity*clamp(alpha,0,1));
    const ring=(pos,radius,hex,rot={},alpha=1)=>mesh('torus',pos,[radius,radius,radius],hex,rot,.48,alpha);
    const star=(pos,size,hex,spin=0,alpha=1)=>mesh('star',pos,[size,size,size],hex,{x:-camera.pitch,y:camera.yaw,z:spin},.8,alpha);
    const curve=(fn,steps,radius,hex,glow=.3,alpha=1)=>{
      let previous=fn(0);
      for(let i=1;i<=steps;i++){const next=fn(i/steps);line(previous,next,radius,hex,glow,alpha);previous=next;}
    };
    const ribbon=(points,widths,hex,alpha=1,twist=0,turns=1.5)=>r.ribbon(points.map(q=>p(...q)),widths.map(v=>v*grow),hex,.38,opacity*clamp(alpha,0,1),twist,turns);

    // A small stage-level flourish gives every reveal a musical entrance.
    const entrance=(1-smooth(t/1.15))*.65;
    if(entrance>0){
      ring([0,.08,0],.65+t*1.6,c[0],{},entrance);
      for(let i=0;i<6;i++){
        const a=i/6*TAU+noise(seed)*TAU,radius=.7+t*1.1;
        star([Math.cos(a)*radius,.2+Math.sin(t*3)*.3,Math.sin(a)*radius],.055,c[i%3],a,entrance);
      }
    }

    if(e.id===0){
      // A tiny weather theatre: layered clouds, a rainbow, and falling pearls.
      const drift=Math.sin(t*.55+noise(seed)*TAU)*.12;
      for(let j=0;j<5;j++)mesh('sphere',[(j-2)*.43+drift,4.2+Math.sin(j)*.15,Math.cos(j)*.22],[.64,.29,.47],j%2?c[2]:c[0]);
      for(let j=0;j<3;j++)mesh('sphere',[(j-1)*.62+drift,4.43+Math.sin(t*.7+j)*.045,-.08],[.53,.35,.43],j===1?'#d3e4df':c[2]);
      const rainbow=['#edbdc6','#e7d3ad','#b9d9c6','#aebfdf'];
      for(let j=0;j<4;j++){
        const points=[],widths=[];
        for(let i=0;i<=24;i++){
          const a=i/24*Math.PI,radius=1.58+j*.105;
          points.push([Math.cos(a)*radius,2.9+Math.sin(a)*radius,-.38]);widths.push(.034);
        }
        ribbon(points,widths,rainbow[j],smooth((t-.45)/1.2),Math.PI/2,0);
      }
      mesh('cylinder',[0,.055,0],[1.55,.014,.95],'#a2ccd0',{},.25,.13);
      for(let i=0;i<30;i++){
        const fall=(beat*.33+noise(i+seed))%1;
        const x=(noise(i+seed+11)-.5)*2.75+Math.sin(t*.8+i)*.12,z=(noise(i+seed+43)-.5)*1.65;
        const y=4-fall*3.75;
        line([x,y,z],[x-.025,y+.17,z],.012,c[i%3],.5,.8);
        mesh('diamond',[x,y,z],[.03,.058,.03],i%4?'#c7e4e5':'#f0dfb8',{},.65);
        if(i%5===0&&fall>.65){
          const ripple=(fall-.65)/.35;
          ring([x,.09,z],.08+ripple*.48,c[0],{},(1-ripple)*.65);
        }
      }
      curve(u=>[-1.5+u*3,4.02-Math.sin(u*Math.PI)*.12,.28],16,.014,'#e4ece0',.55,.7);
    }else if(e.id===1){
      // Chrysanthemums of curling light, with ballistic trails and warm embers.
      for(let burst=0;burst<2;burst++){
        const phase=(beat+burst*2.25)%4.5,age=Math.max(0,(phase-.75)*(sound.beatLength||WonderAudio.BEAT));
        const center=[burst?.8:-.65,3.4+burst*.9,burst?-.55:.4];
        const glow=1-smooth((phase-3.1)/1.4);
        if(phase<.75){
          const launch=phase/.75;
          curve(u=>[center[0]+Math.sin(u*3)*.07,.65+launch*2.7-u*.75,center[2]],6,.018,'#efd7a4',.75);
          star([center[0],.65+launch*2.7,center[2]],.085,'#fff0cc',t);
          continue;
        }
        for(let i=0;i<22;i++){
          const az=i*2.39996+noise(seed+burst)*TAU,dy=1-2*(i+.5)/22,slice=Math.sqrt(1-dy*dy);
          const trajectory=u=>{
            const reach=(1-Math.exp(-age*u*2.7))*2.05,a=az+age*u*.18*(i%2?1:-1);
            return [center[0]+Math.cos(a)*slice*reach,center[1]+dy*reach-age*age*u*u*.26,center[2]+Math.sin(a)*slice*reach];
          };
          const head=trajectory(1);
          for(let j=0;j<3;j++)line(trajectory(1-j*.15),trajectory(1-(j+1)*.15),.019-j*.004,c[(i+burst)%3],.8,glow*(1-j*.22));
          star(head,.038+.025*noise(seed+i),i%4?c[i%3]:'#fff0cc',az+t*.4,glow);
          if(i%4===0){const q=trajectory(.68);mesh('diamond',q,[.025,.025,.025],'#f2dfb2',{},.8,glow*.65);}
        }
        const halo=1-smooth(age/.75);
        if(halo>0)ring(center,.2+age*2.7,'#f4dfb9',{x:-camera.pitch+Math.PI/2,y:camera.yaw},halo*.55);
      }
    }else if(e.id===2){
      // Candy-coloured balloons with highlights, tied bows, and silk tails.
      for(let i=0;i<8;i++){
        const age=t-i*.2;if(age<0)continue;
        const open=1-Math.exp(-age*7)*Math.cos(age*13),sway=Math.sin(t*.85+i*1.8+noise(seed)*TAU);
        const x=sway*.5+(noise(seed+i)-.5)*1.9,z=Math.cos(t*.55+i)*.42+(noise(i+11)-.5)*1.2;
        const y=1.35+age*.55,tilt=sway*.12,hue=c[(i+Math.floor(noise(seed)*3))%3];
        mesh('sphere',[x,y,z],[.29*open,.39*open,.29*open],hue,{z:tilt},.16);
        const highlight=[x+camera.forward[0]*.23-camera.right[0]*.07,y+.15,z+camera.forward[2]*.23-camera.right[2]*.07];
        mesh('sphere',highlight,[.058*open,.11*open,.026*open],'#f8e9dd',{y:camera.yaw,z:tilt},.65,.8);
        mesh('cone',[x,y-.38*open,z],[.045*open,.09*open,.045*open],hue,{z:Math.PI},.25);
        const tail=u=>[x+Math.sin(t*1.7+i+u*5)*u*.14,y-.4*open-u*(.8+noise(i+seed)*.35),z+Math.cos(t+i+u*3)*u*.08];
        curve(tail,8,.006,'#d7d8c3',.2,.85);
        const end=tail(1);
        for(const sign of [-1,1])mesh('petal',end,[.12,.12,.17],hue,{x:-.4,y:sign*.85,z:sign*.4},.35);
        if(i%2===0)star([x+.4*Math.cos(t+i),y-.65,z+.25],.045,'#ead9b7',t*.4+i,.7);
      }
    }else if(e.id===3){
      // Curved stems and cupped paper petals unfurl in a loose spiral.
      for(let i=0;i<7;i++){
        const angle=i*2.39996+noise(seed)*.35,reach=.3+noise(i+seed)*1.1;
        const growth=smooth(t*.85-i*.08),height=(1.35+noise(i+seed+9)*1.65)*growth;
        const lean=Math.sin(t*.85+i)*.12*growth,x=Math.cos(angle)*reach+lean,z=Math.sin(angle)*reach;
        const stem=u=>[x*u*u,height*u+.1,z*u*u+Math.sin(u*Math.PI)*lean];
        curve(stem,5,.022,'#91ae88',.12);
        for(let j=0;j<2;j++){
          const leaf=stem(.37+j*.2),open=smooth(t-i*.07-j*.2);
          mesh('petal',leaf,[.32*open,.35*open,.58*open],j?'#aec49b':'#8fae91',{x:-.45,y:angle+(j?1.6:-1.2),z:Math.sin(t+i)*.06},.15);
        }
        const bloom=smooth((t-.45-i*.095)*1.15),head=stem(1),nod=Math.sin(t*.9+i)*.12;
        for(let j=0;j<12;j++){
          const inner=j>=7,a=(inner?(j-7)/5:j/7)*TAU+angle+(inner?.4:0);
          const opening=smooth(bloom*1.3-(inner?.22:0)),length=(inner?.32:.52)*opening;
          mesh('petal',head,[(inner?.3:.48)*opening,.65*opening,length],c[1+(i+j)%2],{x:-1.3*(1-opening)-.22+nod,y:a},.22);
        }
        mesh('particle',[head[0],head[1]+.035,head[2]],[.115*bloom,.065*bloom,.115*bloom],'#edcf8f',{},.4);
        for(let j=0;j<3;j++){
          const a=j/3*TAU+t*.25;
          mesh('diamond',[head[0]+Math.cos(a)*.07*bloom,head[1]+.1*bloom,head[2]+Math.sin(a)*.07*bloom],[.026*bloom,.03*bloom,.026*bloom],'#f9e5b3',{},.65);
        }
      }
      for(let i=0;i<2;i++){
        const a=t*.6+i*Math.PI,q=[Math.cos(a)*1.5,2.45+Math.sin(t*1.1+i)*.4,Math.sin(a)*1.2];
        const flap=.35+Math.sin(beat*TAU*2+i)*.8;
        for(const sign of [-1,1])mesh('petal',q,[.23,.22,.3],c[1+i],{x:-.4,y:a+sign*.8,z:sign*flap},.35);
        mesh('diamond',q,[.035,.07,.035],'#e9d5a7',{},.5);
      }
    }else if(e.id===4){
      // Broad twisting ribbons, with small lights travelling along the weave.
      for(let j=0;j<4;j++){
        const path=u=>{
          const a=u*TAU*1.15-t*.7+j*.78+noise(seed)*TAU,radius=.28+u*1.25;
          return [Math.cos(a)*radius+Math.sin(t*.35)*u*.35,.85+u*3.55+Math.sin(a*1.5)*.18,Math.sin(a)*radius*.8];
        };
        const points=[],widths=[];
        for(let i=0;i<=32;i++){const u=i/32;points.push(path(u));widths.push(.015+Math.sin(u*Math.PI)**.65*(j%2?.07:.12));}
        ribbon(points,widths,c[j%3],1,t*.2+j*.7);
        for(let i=0;i<3;i++){
          const u=(beat*.11+i/3+j*.17)%1,q=path(u);
          star(q,.04+Math.sin(u*Math.PI)*.03,j%2?'#f1dfc4':c[(j+1)%3],t*.3+j,.85);
        }
      }
      for(let i=0;i<5;i++){
        const a=i/5*TAU-t*.25;
        mesh('diamond',[Math.cos(a)*.55,.45+Math.sin(t+i)*.08,Math.sin(a)*.55],[.035,.035,.035],c[i%3],{},.55);
      }
    }else{
      // An illuminated orrery: a little sun, tilted worlds, and constellations.
      const centerY=2.5+Math.sin(t*.6)*.13;
      mesh('sphere',[0,centerY,0],[.33,.33,.33],'#ead29c',{},.7);
      ring([0,centerY,0],.47,'#f0dcac',{x:-camera.pitch+Math.PI/2,y:camera.yaw},.75);
      for(let i=0;i<8;i++){
        const a=i/8*TAU+t*.12;
        line([Math.cos(a)*.43,centerY+Math.sin(a)*.43,0],[Math.cos(a)*(.5+pulse*.025),centerY+Math.sin(a)*(.5+pulse*.025),0],.01,'#f0dcac',.7,.65);
      }
      mesh('crescent',[.65,centerY+.85,-.35],[.29,.29,.29],c[2],{z:-.3,y:t*.12},.5);
      for(let i=0;i<4;i++){
        const a=t*.12+i*.8,rx=.4+i*.24,rz=i*.65,radius=.92+i*.38;
        const orbit=beat*TAU*(i%2?-.09:.125)+i+noise(seed)*TAU;
        const onOrbit=theta=>{
          const x=Math.cos(theta)*radius,y=-Math.sin(theta)*radius*Math.sin(rx),z=Math.sin(theta)*radius*Math.cos(rx);
          const x1=x*Math.cos(a)+z*Math.sin(a),z1=-x*Math.sin(a)+z*Math.cos(a);
          return [x1*Math.cos(rz)-y*Math.sin(rz),centerY+x1*Math.sin(rz)+y*Math.cos(rz),z1];
        };
        ring([0,centerY,0],radius,c[i%3],{x:rx,z:rz,y:a},.55);
        const planet=onOrbit(orbit),size=.105+i*.023;
        mesh('sphere',planet,[size,size,size],c[i%3],{},.38);
        if(i%2)mesh('torus',planet,[size*1.75,size*1.75,size*1.75],'#e6cfac',{x:.4,z:.3},.5);
        curve(u=>onOrbit(orbit-u*.5),7,.017,c[i%3],.65,.8);
      }
      const constellation=[];
      for(let i=0;i<6;i++){
        const a=i/6*TAU+noise(seed)*TAU;
        const q=[Math.cos(a)*(1.9+noise(seed+i)*.35),centerY+Math.sin(a)*1.7,-.6+Math.sin(i)*.2];
        constellation.push(q);star(q,.04+noise(seed+i+9)*.045,c[i%3],i*.6+t*.08,.5+pulse*.3);
      }
      for(let i=1;i<4;i++)line(constellation[i-1],constellation[i],.006,'#b5c7cb',.4,.35);
    }

    // The sculpture keeps its shape as it dissolves; loose flecks drift away.
    if(fade>0)for(let i=0;i<9;i++){
      const a=noise(seed+i)*TAU,radius=.5+noise(seed+i+20)*1.35;
      const q=[Math.cos(a)*radius+Math.sin(t+i)*.15,.6+noise(seed+i+40)*3.3+fade*.65,Math.sin(a)*radius];
      star(q,.035+noise(seed+i+60)*.035,c[i%3],t*.35+i,Math.sin(fade*Math.PI)*.75);
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
  function undo(){if(world.undo()){effects=[];sound.clearEffects();cancelGesture();sync();status('One small step back.');}}
  function pause(){paused=!paused;accumulator=0;sound.setPaused(paused);if(!paused)sound.unlock();const b=$('#pause');b.setAttribute('aria-pressed',String(paused));b.textContent=paused?'▷':'Ⅱ';b.setAttribute('aria-label',paused?'Resume animation':'Pause animation');b.title=paused?'Resume · Space':'Pause · Space';status(paused?'A quiet moment. You can still build and rotate.':'Their little lives go on.');}
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
  $('#clear').addEventListener('click',()=>{world.reset();effects=[];sound.clearEffects();cancelGesture();selected=null;tool='move';sync();status('A fresh start. Six of each shape, all to discover.');});
  soundButton.addEventListener('click',toggleSound);
  themeSelect.addEventListener('change',chooseMusicTheme);
  $('#pause').addEventListener('click',pause);$('#rotate-left').addEventListener('click',()=>rotate(-Math.PI/4));$('#rotate-right').addEventListener('click',()=>rotate(Math.PI/4));$('#orbit').addEventListener('click',autoRotate);
  $('#zoom-in').addEventListener('click',()=>zoom(.88));$('#zoom-out').addEventListener('click',()=>zoom(1/.88));$('#home').addEventListener('click',()=>{camera.reset();sync();});
  $('#help').addEventListener('click',()=>help($('#instructions').hidden));$('#close-help').addEventListener('click',()=>help(false));
  window.addEventListener('keydown',e=>{
    if(e.target.matches('input,textarea,select')||e.repeat)return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();return;}
    if(e.key==='Escape'){cancelGesture();selected=null;tool='move';sync();if(!$('#instructions').hidden)help(false);return;}
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.key.toLowerCase()==='m'){e.preventDefault();toggleSound();return;}
    sound.unlock();
    if(/^[1-6]$/.test(e.key))chooseShape(Number(e.key)-1);
    const shortcut={v:'move',l:'line',h:'ladder',b:'spring'}[e.key.toLowerCase()];if(shortcut)chooseTool(shortcut);
    if(e.key==='ArrowLeft'){e.preventDefault();rotate(-Math.PI/4);}if(e.key==='ArrowRight'){e.preventDefault();rotate(Math.PI/4);}
    if(e.key.toLowerCase()==='r')autoRotate();if(e.key==='[')changeHeight(-1);if(e.key===']')changeHeight(1);
    if(e.code==='Space'&&!e.target.closest('button')){e.preventDefault();pause();}
  });
  function resize(){renderer.resize();cancelGesture();}
  window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;sound.setHidden(document.hidden);});
  canvas.addEventListener('webglcontextlost',()=>{sound.setPaused(true);$('#webgl-error').hidden=false;$('#webgl-error').textContent='The 3D connection was interrupted. Reload the page to return to the world.';});
  function frame(now){
    if(renderer.lost)return;const dt=last?Math.min((now-last)/1000,.1):0;last=now;camera.update(dt);
    if(!paused){
      accumulator+=dt;while(accumulator>=1/60){
        world.update(1/60);for(const event of world.drainEvents()){
          const cue=sound.playDiscovery(event),startsAt=cue?.when;
          effects.push({...event,age:cue?Math.min(0,sound.context.currentTime-startsAt):0,startsAt,musicBeat:cue?.beat,life:8.5});
        }
        for(const effect of effects){
          if(effect.age<0&&effect.startsAt!==undefined)effect.age=sound.context.currentTime-effect.startsAt;
          else effect.age+=1/60;
        }
        effects=effects.filter(e=>e.age<e.life).slice(-48);accumulator-=1/60;
      }
    }
    render();requestAnimationFrame(frame);
  }
  resize();sync();syncSound();sound.setHidden(document.hidden);requestAnimationFrame(frame);
})();
