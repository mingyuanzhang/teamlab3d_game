/* A small 3D world. Metres, Y up. No browser or rendering dependencies. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.LittleWorld3D=factory();
})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  const traits=[
    {name:'wanderer',speed:1.05,climb:.75,bravery:.8,pause:.08},
    {name:'dreamer',speed:.65,climb:.35,bravery:.25,pause:.35},
    {name:'acrobat',speed:1.4,climb:.9,bravery:1,pause:.03},
    {name:'shy',speed:.85,climb:.45,bravery:.12,pause:.2},
    {name:'curious',speed:1.1,climb:.95,bravery:.65,pause:.1},
    {name:'dancer',speed:.95,climb:.6,bravery:.5,pause:.2}
  ];
  function closest(line,x,z){
    const dx=line.b.x-line.a.x,dz=line.b.z-line.a.z;
    const t=clamp(((x-line.a.x)*dx+(z-line.a.z)*dz)/(dx*dx+dz*dz||1),0,1);
    return {x:mix(line.a.x,line.b.x,t),y:mix(line.a.y,line.b.y,t),z:mix(line.a.z,line.b.z,t),t};
  }
  // Vertical capsules include the full animated body and arm width.
  function overlaps(a,b,margin=0){
    const lowA=a.y+a.radius-(a.footPadding||0),highA=a.y+a.height-a.radius;
    const lowB=b.y+b.radius-(b.footPadding||0),highB=b.y+b.height-b.radius;
    const dy=Math.max(0,lowA-highB,lowB-highA),r=a.radius+b.radius+margin;
    return (a.x-b.x)**2+(a.z-b.z)**2+dy*dy<r*r-1e-9;
  }
  class World {
    constructor(random=Math.random){this.random=random;this.nextId=0;this.halfWidth=12;this.halfDepth=9;this.reset();}
    range(a,b){return a+this.random()*(b-a);}
    reset(){
      this.time=0;this.tokens=[];this.lines=[];this.events=[];this.history=[];
      const line=(kind,a,b,width=1.55)=>{const l={uid:++this.nextId,kind,a,b,width,pulse:0};this.lines.push(l);return l;};
      const lower=line('line',{x:-8,y:2.4,z:-3},{x:-1,y:2.4,z:-3});
      const upper=line('line',{x:1,y:3.8,z:2.5},{x:8,y:3.8,z:2.5});
      line('spring',{x:-5,y:0,z:4.5},{x:-1,y:0,z:4.5});
      line('ladder',{x:-6,y:0,z:-.4},{x:-6,y:2.4,z:-3},.8);
      line('ladder',{x:5,y:0,z:6},{x:5,y:3.8,z:2.5},.8);
      this.people=Array.from({length:48},(_,i)=>{
        const platform=i<12?lower:i<24?upper:null,k=i%12;
        const size=this.range(.86,1.08);
        return {id:i,trait:traits[i%6],size,radius:.34*size,height:1.24*size,footPadding:.12*size,
          x:platform?platform.a.x+.7+(k%6)*1.1:-9+(i%6)*3.5,
          y:platform?platform.a.y:0,z:platform?platform.a.z+(k<6?-.37:.37):-6+Math.floor((i-24)/6)*4,
          heading:this.range(-Math.PI,Math.PI),direction:i%2?1:-1,speed:this.range(.85,1.15),
          phase:this.range(0,Math.PI*2),color:i%6,hat:i%4,skin:i%3,
          support:platform?platform.uid:'ground',ladder:null,u:0,vy:0,vx:0,vz:0,
          state:'walk',rest:0,decision:this.range(1,5),cooldown:this.range(1,4),expression:0,walk:0};
      });
    }
    snapshot(){this.history.push({tokens:this.tokens.map(t=>({...t})),lines:this.lines.map(l=>({...l,a:{...l.a},b:{...l.b}}))});if(this.history.length>50)this.history.shift();}
    validPoint(p){return p&&[p.x,p.y,p.z].every(Number.isFinite)&&Math.abs(p.x)<=11.5&&Math.abs(p.z)<=8.5&&p.y>=0&&p.y<=6;}
    tokenBody(t){return {x:t.x,y:t.y+.04,z:t.z,radius:.62,height:1.45};}
    placementBlocked(p){return !this.validPoint(p)||this.people.some(person=>overlaps(person,this.tokenBody(p),.06));}
    place(id,p){
      if(!Number.isInteger(id)||id<0||id>5||this.tokens.filter(t=>t.id===id).length>=6||this.placementBlocked(p))return;
      this.snapshot();const t={id,uid:++this.nextId,x:p.x,y:p.y,z:p.z,period:9+id*1.7,timer:.55,cycle:0};this.tokens.push(t);return t;
    }
    move(uid,p){const t=this.tokens.find(t=>t.uid===uid);if(!t||this.placementBlocked(p))return;this.snapshot();Object.assign(t,{x:p.x,y:p.y,z:p.z,timer:.55});return t;}
    addLine(kind,a,b,height=0){
      if(!['line','ladder','spring'].includes(kind)||!this.validPoint(a)||!this.validPoint(b)||!Number.isFinite(height)||height<0||height>6||this.lines.length>=30)return false;
      const distance=Math.hypot(b.x-a.x,b.z-a.z);if(distance<.7)return false;
      a={x:a.x,y:height,z:a.z};b={x:b.x,y:height,z:b.z};
      if(kind==='ladder'){
        if(height<=0)return false;
        // A ladder begins on the highest surface below the chosen level.
        a.y=this.heightBelow(a.x,a.z,height-.15);
        if(b.y-a.y<.4)return false;
      }
      this.snapshot();this.lines.push({uid:++this.nextId,kind,a,b,width:kind==='ladder'?.8:1.55,pulse:0});return true;
    }
    heightBelow(x,z,ceiling){let y=0;for(const l of this.lines){if(l.kind==='ladder')continue;const q=closest(l,x,z);if(Math.hypot(q.x-x,q.z-z)<=l.width/2&&q.y<=ceiling)y=Math.max(y,q.y);}return y;}
    undo(){
      const prior=this.history.pop();if(!prior)return false;this.tokens=prior.tokens;this.lines=prior.lines;this.events=[];
      for(const p of this.people){
        if(p.ladder&&!this.lines.some(l=>l.uid===p.ladder)){p.ladder=null;p.support=null;p.state='fall';}
        if(p.support!=='ground'&&!this.lines.some(l=>l.uid===p.support)){p.support=null;p.state='fall';}
      }return true;
    }
    drainEvents(){return this.events.splice(0);}
    canOccupy(p,next){
      if(Math.abs(next.x)>this.halfWidth-p.radius-.15||Math.abs(next.z)>this.halfDepth-p.radius-.15||next.y<-.001)return false;
      const steps=Math.max(1,Math.ceil(Math.hypot(next.x-p.x,next.y-p.y,next.z-p.z)/.12));
      for(let step=1;step<=steps;step++){
        const t=step/steps,q={...p,x:mix(p.x,next.x,t),y:mix(p.y,next.y,t),z:mix(p.z,next.z,t)};
        if(this.people.some(other=>other!==p&&overlaps(q,other,.025)))return false;
        for(const token of this.tokens){const body=this.tokenBody(token);if(overlaps(q,body,.025)&&!overlaps(p,body,.025))return false;}
      }return true;
    }
    commit(p,next){if(!this.canOccupy(p,next))return false;Object.assign(p,next);return true;}
    update(dt){
      if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.05);
      const steps=Math.ceil(dt*120);for(let i=0;i<steps;i++)this.step(dt/steps);
    }
    step(dt){
      this.time+=dt;
      for(const t of this.tokens){
        t.timer-=dt;if(t.timer>0)continue;t.timer=t.period;t.cycle++;
        this.events.push({id:t.id,tokenId:t.uid,x:t.x,y:t.y,z:t.z,cycle:t.cycle});
        for(const p of this.people)if(Math.hypot(p.x-t.x,p.z-t.z)<5){p.expression=3;if(p.trait.name==='dreamer')p.rest=this.range(.5,1.5);}
      }
      if(this.events.length>72)this.events.splice(0,this.events.length-72);
      for(const l of this.lines)l.pulse=Math.max(0,l.pulse-dt);
      // Rotate update order so a crowded crossing does not favour one person.
      const offset=Math.floor(this.time*60)%this.people.length;
      for(let i=0;i<this.people.length;i++)this.updatePerson(this.people[(i+offset)%this.people.length],dt);
    }
    updatePerson(p,dt){
      p.cooldown=Math.max(0,p.cooldown-dt);p.expression=Math.max(0,p.expression-dt);p.rest=Math.max(0,p.rest-dt);
      p.decision-=dt;
      if(p.decision<=0){p.decision=this.range(2,7);p.heading+=this.range(-1.5,1.5);if(this.random()<p.trait.pause)p.rest=this.range(.4,2);if(this.random()<.15)p.direction*=-1;}
      const speed=p.trait.speed*p.speed;
      if(p.ladder){
        const l=this.lines.find(l=>l.uid===p.ladder);
        if(!l){p.ladder=null;p.support=null;p.state='fall';return;}
        const length=Math.hypot(l.b.x-l.a.x,l.b.y-l.a.y,l.b.z-l.a.z);
        const u=clamp(p.u+p.direction*speed*.75*dt/length,0,1),next={x:mix(l.a.x,l.b.x,u),y:mix(l.a.y,l.b.y,u),z:mix(l.a.z,l.b.z,u)};
        p.heading=Math.atan2((l.b.x-l.a.x)*p.direction,(l.b.z-l.a.z)*p.direction);
        p.state='climb';if(!this.commit(p,next)){p.state='wait';return;}p.u=u;p.walk+=dt*speed;
        if(u===0||u===1){p.ladder=null;p.cooldown=2;p.support=this.supportAt(p,p.y+.1)?.uid||(p.y<.05?'ground':null);p.vy=0;p.state=p.support?'walk':'fall';}
        return;
      }
      let support=p.support==='ground'?{kind:'ground'}:this.lines.find(l=>l.uid===p.support&&l.kind!=='ladder');
      if(support&&support.kind!=='ground'){
        const q=closest(support,p.x,p.z);if(Math.hypot(q.x-p.x,q.z-p.z)>support.width/2+.02||Math.abs(q.y-p.y)>.1)support=null;
      }
      if(!support)p.support=null;
      if(support){
        p.state=p.rest>0?'rest':'walk';p.vy=0;if(p.rest>0)return;
        if(p.cooldown===0){
          for(const l of this.lines){
            if(l.kind!=='ladder')continue;
            const start=Math.hypot(l.a.x-p.x,l.a.z-p.z)<.65&&Math.abs(p.y-l.a.y)<.16;
            const end=Math.hypot(l.b.x-p.x,l.b.z-p.z)<.65&&Math.abs(p.y-l.b.y)<.16;
            if(!start&&!end)continue;p.cooldown=2;
            if(this.random()<p.trait.climb){const q=start?l.a:l.b;if(this.commit(p,q)){p.ladder=l.uid;p.u=start?0:1;p.direction=start?1:-1;p.support=null;p.state='climb';}return;}
          }
        }
        let dx=Math.sin(p.heading),dz=Math.cos(p.heading);
        if(support.kind!=='ground'){
          const length=Math.hypot(support.b.x-support.a.x,support.b.z-support.a.z);
          dx=(support.b.x-support.a.x)/length*p.direction;dz=(support.b.z-support.a.z)/length*p.direction;
          p.heading=Math.atan2(dx,dz);
          const q=closest(support,p.x+dx*speed*dt,p.z+dz*speed*dt);
          if((q.t<.025||q.t>.975)&&p.trait.bravery<.4){p.direction*=-1;return;}
        }
        const next={x:p.x+dx*speed*dt,y:p.y,z:p.z+dz*speed*dt};
        if(!this.commit(p,next)){
          p.state='wait';
          if(support.kind==='ground'){
            // Slide around a neighbour instead of pushing through their body.
            const sign=p.id%2?1:-1,side={x:p.x+dz*speed*dt*sign,y:p.y,z:p.z-dx*speed*dt*sign};
            if(this.commit(p,side)){p.heading+=sign*dt*2;p.walk+=dt*speed;}
            else p.heading+=dt*(p.id%2?3:-3);
          }else{p.direction*=-1;p.rest=.2;}
          return;
        }
        p.walk+=dt*speed;
        if(support.kind!=='ground'){
          const q=closest(support,p.x,p.z);if(Math.hypot(q.x-p.x,q.z-p.z)>support.width/2){p.support=null;p.vx=dx*speed;p.vz=dz*speed;p.state='fall';}
        }
        const spring=this.lines.find(l=>l.kind==='spring'&&Math.abs(l.a.y-p.y)<.1&&Math.hypot(closest(l,p.x,p.z).x-p.x,closest(l,p.x,p.z).z-p.z)<l.width/2);
        if(spring&&p.cooldown<=0){p.support=null;p.vy=this.range(5,6.7);p.vx=dx*speed;p.vz=dz*speed;p.cooldown=.4;p.state='jump';p.expression=2;spring.pulse=.6;}
      }else{
        p.vy-=10*dt;let next={x:clamp(p.x+p.vx*dt,-11.4,11.4),y:Math.max(0,p.y+p.vy*dt),z:clamp(p.z+p.vz*dt,-8.4,8.4)};
        let landing=null;
        if(p.vy<=0){landing=this.supportAt(next,p.y+.005,next.y);if(landing)next.y=closest(landing,next.x,next.z).y;else if(next.y===0)landing={uid:'ground',kind:'ground'};}
        if(this.commit(p,next)){
          p.state=p.vy>0?'jump':'fall';
          if(landing){p.vy=0;p.support=landing.uid;p.state='walk';if(landing.kind==='spring'){p.support=null;p.vy=this.range(5,6.7);landing.pulse=.6;p.state='jump';}}
        }else{
          // A falling body may yield sideways, but can never enter another body.
          p.vy=0;p.state='wait';const angle=p.heading+dt;
          this.commit(p,{x:p.x+Math.sin(angle)*speed*dt,y:p.y,z:p.z+Math.cos(angle)*speed*dt});p.heading+=dt*2;
        }
      }
    }
    supportAt(p,ceiling,floor=ceiling-.2){
      let best=null,bestY=-Infinity;
      for(const l of this.lines){if(l.kind==='ladder')continue;const q=closest(l,p.x,p.z);if(Math.hypot(q.x-p.x,q.z-p.z)<=l.width/2&&q.y<=ceiling&&q.y>=floor-.001&&q.y>bestY){best=l;bestY=q.y;}}
      return best;
    }
  }
  return {World,traits,overlaps,closest,clamp};
});
