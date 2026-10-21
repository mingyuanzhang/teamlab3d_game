/* Original, local music: soft additive instruments, with no audio downloads. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(root);
  else root.WonderAudio=factory(root);
})(typeof globalThis!=='undefined'?globalThis:this,root=>{
  'use strict';
  const TAU=Math.PI*2,BEAT=60/84,STORAGE_KEY='little-wonders-muted';
  const CHORDS=[[48,55,60,64,71],[45,52,57,60,67],[41,48,53,57,64],[43,50,55,59,64]];
  const instruments={
    pad:[[1,1],[2,.16],[3,.05]],
    bass:[[1,1],[2,.18]],
    glass:[[1,1],[2.01,.28],[3.98,.08]],
    sparkle:[[1,1],[2,.32],[4,.12]],
    flute:[[1,1],[2,.10],[3,.04]],
    wood:[[1,1],[3,.22],[7,.035]],
    harp:[[1,1],[2,.26],[3,.12]],
    bell:[[1,1],[2.003,.35],[3.01,.08]]
  };
  // Melodies use chord degrees and beat subdivisions, rather than fixed
  // pitches or seconds. They follow the accompaniment even across bar lines.
  const tunes=[
    {voice:'glass',steps:[7,6,5,4,3,2],beats:[0,.5,1,1.5,2,2.5],length:1},
    {voice:'sparkle',steps:[0,2,4,5,6,7,4,6],beats:[0,.25,.5,.75,1,1.5,1.5,1.5],length:1.25},
    {voice:'flute',steps:[2,3,4,5,6],beats:[0,.5,1,1.75,2.5],length:1},
    {voice:'wood',steps:[0,1,2,4,2,5,4],beats:[0,.5,1,1.75,2.25,2.75,3.25],length:.75},
    {voice:'harp',steps:[4,5,6,7,6,5,4,3,2],beats:[0,.25,.5,.75,1,1.25,1.5,1.75,2],length:1},
    {voice:'bell',steps:[4,6,5,7,6,3],beats:[0,.75,1.5,2.25,3,3.75],length:1.5}
  ];

  function note(buffer,midi,start,duration,volume,voice='glass',pan=0,wrap=false){
    const rate=buffer.sampleRate,offset=Math.round(start*rate),count=Math.ceil(duration*rate);
    const hz=440*2**((midi-69)/12),partials=instruments[voice];
    const left=buffer.getChannelData(0),right=buffer.getChannelData(1);
    const l=Math.sqrt((1-pan)/2)*volume,r=Math.sqrt((1+pan)/2)*volume;
    const sustained=voice==='pad'||voice==='flute'||voice==='bass';
    const attack=voice==='pad'?.35:voice==='flute'?.065:.008;
    // Advance sine phases and decay by recurrence, keeping buffer generation
    // light enough for the first tap on a phone.
    const tones=partials.map(([ratio,weight])=>{
      const step=TAU*hz*ratio/rate;
      return {sin:0,cos:1,stepSin:Math.sin(step),stepCos:Math.cos(step),weight,decay:Math.exp(-(ratio-1)*.6/(duration*rate))};
    });
    const decayStep=Math.exp(-(sustained?.8:4.8)/(duration*rate));let decay=1;
    for(let i=0;i<count;i++){
      const t=i/rate,index=wrap?(offset+i)%buffer.length:offset+i;
      if(index>=buffer.length)break;
      const envelope=Math.min(1,t/attack)*Math.min(1,(duration-t)/(sustained?.25:.12))*decay;
      let value=0;
      for(const tone of tones){
        value+=tone.sin*tone.weight;
        const next=tone.sin*tone.stepCos+tone.cos*tone.stepSin;
        tone.cos=tone.cos*tone.stepCos-tone.sin*tone.stepSin;tone.sin=next;tone.weight*=tone.decay;
      }
      decay*=decayStep;
      value*=envelope;left[index]+=value*l;right[index]+=value*r;
    }
  }

  function makeMusic(context){
    const rate=24000,bar=BEAT*4,buffer=context.createBuffer(2,Math.round(bar*8*rate),rate);
    const melody=[[76,79,81,79],[72,76,79,76],[69,72,76,74],[71,74,79,74],
      [79,84,81,79],[76,79,72,76],[72,76,79,76],[74,79,76,72]];
    for(let b=0;b<8;b++){
      const chord=CHORDS[b%4],start=b*bar;
      chord.slice(1).forEach((midi,i)=>note(buffer,midi,start+i*.035,bar*1.3,.026,'pad',(i-1.5)*.3,true));
      note(buffer,chord[0],start,BEAT*1.8,.105,'bass',-.12,true);
      note(buffer,chord[0]+12,start+BEAT*2.5,BEAT*1.3,.055,'bass',.12,true);
      melody[b].forEach((midi,i)=>{
        const when=start+[0,1.5,2.5,3.25][i]*BEAT;
        note(buffer,midi,when,1.15,i===0?.073:.053,'glass',i%2?.35:-.35,true);
        note(buffer,midi,when+.28,.9,.014,'glass',i%2?-.5:.5,true);
      });
    }
    return buffer;
  }

  function discoveryScore(id,startBeat=0){
    const tune=tunes[id],score=[];
    function add(step,beat,length,volume,pan){
      const end=beat+length;
      while(beat<end-1e-8){
        const bar=Math.floor((beat+1e-8)/4),chord=CHORDS[((bar%4)+4)%4];
        const tones=[chord[0]+12,chord[3],chord[1]+12,chord[4]];
        const duration=Math.min(end,(bar+1)*4)-beat;
        const midi=tones[step%4]+12*Math.floor(step/4);
        score.push({midi,beat:beat-startBeat,duration,volume,pan,voice:tune.voice});
        beat+=duration;
      }
    }
    tune.steps.forEach((step,i)=>{
      const pan=(i/(tune.steps.length-1)-.5)*.55,beat=startBeat+tune.beats[i];
      add(step,beat,tune.length,.23,pan);
      add(step,beat+.5,tune.length,.037,-pan);
    });
    return score;
  }

  function makeTune(context,id,startBeat=0,beatLength=BEAT){
    const tune=tunes[id],rate=24000;
    const duration=(tune.beats.at(-1)+tune.length+.5)*beatLength+.04;
    const buffer=context.createBuffer(2,Math.ceil(duration*rate),rate);
    for(const n of discoveryScore(id,startBeat))note(buffer,n.midi,n.beat*beatLength,n.duration*beatLength,n.volume,n.voice,n.pan);
    return buffer;
  }

  class Soundtrack {
    constructor({onChange=()=>{}}={}){
      this.Context=root.AudioContext||root.webkitAudioContext;
      this.supported=!!this.Context;this.onChange=onChange;
      this.context=null;this.muted=false;this.paused=false;this.hidden=false;
      this.voices=new Map();this.buffers=new Map();
      try{this.muted=root.localStorage?.getItem(STORAGE_KEY)==='true';}catch{}
    }
    // Called from user input, never from autoplay or the animation loop.
    unlock(){
      if(!this.supported||this.muted||this.paused||this.hidden)return;
      if(!this.context){
        try{
          const context=new this.Context();this.context=context;
          this.master=context.createGain();this.master.gain.value=0;
          const limiter=context.createDynamicsCompressor();
          limiter.threshold.value=-18;limiter.knee.value=16;limiter.ratio.value=8;
          limiter.attack.value=.003;limiter.release.value=.25;
          this.master.connect(limiter);limiter.connect(context.destination);
          const music=context.createBufferSource();music.buffer=makeMusic(context);music.loop=true;
          const volume=context.createGain();volume.gain.value=.58;
          music.connect(volume);volume.connect(this.master);
          this.beatLength=music.buffer.duration/32;this.startedAt=context.currentTime+.05;
          music.start(this.startedAt);this.music=music;
        }catch{
          if(this.context)this.context.close().catch(()=>{});
          this.context=null;this.supported=false;this.onChange();return;
        }
      }
      this.sync();
    }
    sync(){
      const context=this.context;if(!context)return;
      this.master.gain.setTargetAtTime(this.muted?0:.72,context.currentTime,.025);
      const blocked=this.paused||this.hidden,target=blocked?'suspended':'running';
      if(context.state===target||context.state==='closed')return;
      // Recheck after completion so rapid pause / resume cannot leave stale audio.
      context[blocked?'suspend':'resume']().then(()=>{
        if((this.paused||this.hidden)!==(context.state==='suspended'))this.sync();
      }).catch(()=>{}); // Another gesture can retry a browser-blocked resume.
    }
    setMuted(muted){
      this.muted=!!muted;
      try{root.localStorage?.setItem(STORAGE_KEY,String(this.muted));}catch{}
      if(this.muted)this.clearEffects();else this.unlock();
      this.sync();this.onChange();
    }
    setPaused(paused){this.paused=!!paused;this.sync();}
    setHidden(hidden){this.hidden=!!hidden;this.sync();}
    playDiscovery(event){
      const context=this.context;
      if(!context||this.muted||this.paused||this.hidden||context.state!=='running'||!Number.isInteger(event.id)||!tunes[event.id])return;
      const nextBeat=()=>Math.max(0,Math.ceil((context.currentTime+.04-this.startedAt)/this.beatLength*2)/2);
      let beat=nextBeat(),when,buffer;
      // A cold buffer can take a little time to synthesize. If it misses the
      // scheduling margin, advance to the next eighth note with its new chord.
      for(let attempt=0;attempt<3;attempt++){
        const key=`${event.id}:${Math.round(beat*2)%32}`;
        if(!this.buffers.has(key)){
          if(this.buffers.size>=24)this.buffers.delete(this.buffers.keys().next().value);
          this.buffers.set(key,makeTune(context,event.id,beat,this.beatLength));
        }
        buffer=this.buffers.get(key);when=this.startedAt+beat*this.beatLength;
        if(when>=context.currentTime+.008)break;
        beat=nextBeat();
      }
      // Bound simultaneous sources even when all 36 shapes are revealing.
      if(this.voices.size>=48)this.stopVoice(this.voices.keys().next().value);
      const source=context.createBufferSource(),gain=context.createGain();
      source.buffer=buffer;
      gain.gain.value=.65/Math.sqrt(1+this.voices.size*.3);
      source.connect(gain);gain.connect(this.master);this.voices.set(source,gain);
      source.onended=()=>{source.disconnect();gain.disconnect();this.voices.delete(source);};
      source.start(when);return {when};
    }
    stopVoice(source){
      const gain=this.voices.get(source);if(!gain)return;
      const now=this.context.currentTime;gain.gain.setTargetAtTime(0,now,.008);
      source.stop(now+.04);this.voices.delete(source);
    }
    clearEffects(){for(const source of this.voices.keys())this.stopVoice(source);}
  }
  return {Soundtrack,makeMusic,makeTune,discoveryScore,BEAT,CHORDS};
});
