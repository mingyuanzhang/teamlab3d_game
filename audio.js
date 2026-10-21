/* Original, local music: soft additive instruments, with no audio downloads. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(root);
  else root.WonderAudio=factory(root);
})(typeof globalThis!=='undefined'?globalThis:this,root=>{
  'use strict';
  const TAU=Math.PI*2,BEAT=60/84,STORAGE_KEY='little-wonders-muted',THEME_KEY='little-wonders-music-theme';
  const CHORDS=[[48,55,60,64,71],[45,52,57,60,67],[41,48,53,57,64],[43,50,55,59,64]];
  const JAZZ_CHORDS=[
    [38,45,50,53,60,64],[31,38,43,47,53,57,64],[36,43,48,52,59,62],[33,40,45,48,55,59],
    [38,45,50,53,60,64],[31,38,43,47,53,57,64],[40,47,52,55,62],[33,40,45,49,55,58]
  ];
  const ROCK_CHORDS=[
    [40,47,52,55,64],[36,43,48,52,60],[31,38,43,47,55],[38,45,50,54,62],
    [40,47,52,55,64],[36,43,48,52,60],[33,40,45,48,57],[35,42,47,51,57]
  ];
  const CLASSICAL_CHORDS=[
    [36,43,48,52,60],[41,48,53,57,65],[38,45,50,53,62],[31,38,43,47,55],
    [33,40,45,48,57],[38,45,50,53,62],[31,38,43,47,53],[36,43,48,52,60]
  ];
  const THEMES={
    default:{name:'Default',bpm:84,swing:.5,chords:CHORDS,octave:0,cueGain:1},
    jazz:{name:'Jazz',bpm:104,swing:.62,chords:JAZZ_CHORDS,octave:12,cueGain:.85,
      voices:['vibes','piano','clarinet','guitar','keys','vibes']},
    rock:{name:'Rock',bpm:120,swing:.5,chords:ROCK_CHORDS,octave:0,cueGain:.7,
      voices:['electricLead','electric','organ','palmMute','electricHarmonic','electricLead']},
    classical:{name:'Classical',bpm:92,swing:.5,chords:CLASSICAL_CHORDS,octave:12,cueGain:.85,
      voices:['celesta','piano','oboe','pizzicato','harp','strings']}
  };
  const themeFor=id=>Object.hasOwn(THEMES,id)?THEMES[id]:THEMES.default;
  function grooveBeat(beat,theme='default'){
    const whole=Math.floor(beat),part=beat-whole,swing=themeFor(theme).swing;
    return whole+(part<.5?part*2*swing:swing+(part-.5)*2*(1-swing));
  }
  function straightBeat(beat,theme='default'){
    const whole=Math.floor(beat),part=beat-whole,swing=themeFor(theme).swing;
    return whole+(part<swing?part/(2*swing):.5+(part-swing)/(2*(1-swing)));
  }
  const instruments={
    pad:[[1,1],[2,.16],[3,.05]],
    bass:[[1,1],[2,.18]],
    glass:[[1,1],[2.01,.28],[3.98,.08]],
    sparkle:[[1,1],[2,.32],[4,.12]],
    flute:[[1,1],[2,.10],[3,.04]],
    wood:[[1,1],[3,.22],[7,.035]],
    harp:[[1,1],[2,.26],[3,.12]],
    bell:[[1,1],[2.003,.35],[3.01,.08]],
    piano:[[1,1],[2,.28],[3,.15],[4,.07],[6,.025]],
    keys:[[1,1],[2,.34],[3,.07],[4.01,.035]],
    upright:[[1,1],[2,.38],[3,.13],[4,.04]],
    vibes:[[1,1],[2.002,.22],[4.01,.045]],
    clarinet:[[1,1],[3,.16],[5,.045]],
    guitar:[[1,1],[2,.18],[3,.12],[4,.025]],
    electric:[[1,.8],[2,.42],[3,.3],[4,.16],[5,.11],[7,.055]],
    electricLead:[[1,1],[2,.32],[3,.24],[4,.1],[5,.065]],
    electricBass:[[1,1],[2,.32],[3,.16],[4,.055]],
    palmMute:[[1,1],[2,.55],[3,.26],[4,.11],[6,.04]],
    electricHarmonic:[[1,1],[2,.13],[3,.075],[4,.02]],
    organ:[[1,1],[2,.25],[3,.2],[4,.1]],
    strings:[[.997,.5],[1.003,.5],[2,.24],[3,.11],[4,.045]],
    cello:[[1,1],[2,.3],[3,.15],[4,.06]],
    oboe:[[1,1],[2,.12],[3,.18],[5,.055]],
    pizzicato:[[1,1],[2,.22],[3,.14],[4,.06]],
    celesta:[[1,1],[2.004,.18],[3.99,.045]]
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
    const sustained=voice==='pad'||voice==='flute'||voice==='bass'||voice==='clarinet'||
      voice==='electric'||voice==='electricLead'||voice==='organ'||voice==='strings'||voice==='cello'||voice==='oboe';
    const attack=voice==='pad'?.35:voice==='flute'?.065:voice==='clarinet'?.04:
      voice==='strings'?.12:voice==='cello'?.09:voice==='oboe'?.065:voice==='organ'||voice==='electricLead'?.02:.008;
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

  function makeDefaultMusic(context){
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

  function percussion(buffer,start,duration,volume,ride=false){
    const rate=buffer.sampleRate,offset=Math.round(start*rate),count=Math.ceil(duration*rate);
    const left=buffer.getChannelData(0),right=buffer.getChannelData(1);
    let seed=(offset+7919)>>>0,previous=0,decay=1;
    const falloff=Math.exp(-(ride?5:7)/count);
    for(let i=0;i<count;i++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const white=seed/2147483648-1,high=white-previous*.8,t=i/rate;previous=white;
      const metal=ride?(Math.sin(TAU*2180*t)+Math.sin(TAU*3077*t)*.4+Math.sin(TAU*4811*t)*.22)*.45:0;
      const value=(high*(ride?.15:.6)+metal)*volume*decay*Math.min(1,t/.003);
      const index=(offset+i)%buffer.length;left[index]+=value*.58;right[index]+=value*.82;decay*=falloff;
    }
  }

  function makeJazzMusic(context){
    const rate=24000,beat=60/THEMES.jazz.bpm,bar=beat*4;
    const buffer=context.createBuffer(2,Math.round(bar*8*rate),rate);
    const voicings=[[53,60,64,69],[53,59,64,69],[52,59,62,67],[48,55,59,64],
      [53,60,64,69],[53,59,64,69],[55,62,67,71],[55,58,61,64]];
    const bass=[[38,41,45,36],[31,35,38,41],[36,40,43,35],[33,36,40,43],
      [38,45,41,36],[31,38,35,41],[40,43,47,38],[33,37,40,43]];
    const melody=[[69,72,76,77,72],[71,69,67,64,65],[67,71,74,76,71],[72,71,69,67,64],
      [65,69,72,76,74],[69,67,65,64,62],[67,71,74,76,71],[73,70,69,67,61]];
    function play(midi,position,length,volume,voice,pan){
      const end=position+length;
      while(position<end-1e-8){
        const bar=Math.floor((position+1e-8)/4),chord=JAZZ_CHORDS[bar%8],next=Math.min(end,(bar+1)*4);
        let pitch=midi;
        if(!chord.some(n=>n%12===midi%12)){
          const candidates=chord.map(n=>n+12*Math.round((midi-n)/12));
          pitch=candidates.sort((a,b)=>Math.abs(a-midi)-Math.abs(b-midi))[0];
        }
        const when=grooveBeat(position,'jazz')*beat,duration=(grooveBeat(next,'jazz')-grooveBeat(position,'jazz'))*beat;
        note(buffer,pitch,when,duration,volume,voice,pan,true);position=next;
      }
    }
    for(let b=0;b<8;b++){
      const start=b*4,at=u=>grooveBeat(start+u,'jazz')*beat;
      bass[b].forEach((midi,i)=>play(midi,start+i,.85,.13,'upright',-.18));
      for(const [position,length,volume]of[[0,1.2,.025],[1.5,.7,.019],[3,1.1,.023]]){
        voicings[b].forEach((midi,i)=>play(midi,start+position,length,volume,'keys',(i-1.5)*.12));
      }
      melody[b].forEach((midi,i)=>{
        const position=start+[.5,1.5,2,2.5,3.5][i];
        play(midi,position,.85,i===0?.07:.054,'piano',.24);
        play(midi,position+1,.7,.009,'piano',-.3);
      });
      for(const position of[0,1,1.5,2,3,3.5])percussion(buffer,at(position),beat*.7,position%1?.006:.009,true);
      for(const position of[1,3])percussion(buffer,at(position),beat*.65,.024);
      for(const position of[.5,2.5])percussion(buffer,at(position),beat*.18,.007);
    }
    return buffer;
  }

  // All pitched parts in the new arrangements use the same chord clock as
  // discoveries. Sustains and echoes retune when they cross a bar or loop.
  function renderArrangement(context,theme,arrange){
    const profile=themeFor(theme),beat=60/profile.bpm,rate=24000;
    const buffer=context.createBuffer(2,Math.round(32*beat*rate),rate);
    function play(midi,position,length,volume,voice,pan=0){
      const end=position+length;
      while(position<end-1e-8){
        const bar=Math.floor((position+1e-8)/4),chord=profile.chords[bar%profile.chords.length],next=Math.min(end,(bar+1)*4);
        let pitch=midi;
        if(!chord.some(n=>n%12===midi%12)){
          pitch=chord.map(n=>n+12*Math.round((midi-n)/12)).sort((a,b)=>Math.abs(a-midi)-Math.abs(b-midi))[0];
        }
        const when=grooveBeat(position,theme)*beat,duration=(grooveBeat(next,theme)-grooveBeat(position,theme))*beat;
        note(buffer,pitch,when,duration,volume,voice,pan,true);position=next;
      }
    }
    arrange(play,buffer,beat);return buffer;
  }

  function rockDrum(buffer,start,duration,volume,kind){
    const rate=buffer.sampleRate,offset=Math.round(start*rate),count=Math.ceil(duration*rate);
    const left=buffer.getChannelData(0),right=buffer.getChannelData(1),pan=kind==='hat'?.4:kind==='snare'?-.08:0;
    const l=Math.sqrt((1-pan)/2)*volume,r=Math.sqrt((1+pan)/2)*volume;
    let seed=(offset+3571)>>>0,previous=0;
    for(let i=0;i<count;i++){
      const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const white=seed/2147483648-1,high=white-previous*.85;previous=white;
      let value;
      if(kind==='kick')value=Math.sin(TAU*(48*t+3*(1-Math.exp(-30*t))))*Math.exp(-18*t)+high*.045*Math.exp(-90*t);
      else if(kind==='snare')value=high*.65*Math.exp(-24*t)+Math.sin(TAU*180*t)*.3*Math.exp(-35*t);
      else value=high*.48*Math.exp(-70*t);
      value*=Math.min(1,t/.002)*Math.min(1,(duration-t)/.015);
      const index=(offset+i)%buffer.length;left[index]+=value*l;right[index]+=value*r;
    }
  }

  function makeRockMusic(context){
    return renderArrangement(context,'rock',(play,buffer,beat)=>{
      const melody=[[76,79,83,79],[76,79,84,79],[74,79,83,79],[74,78,81,78],
        [79,83,88,83],[79,84,88,84],[76,81,84,81],[75,78,81,83]];
      for(let b=0;b<8;b++){
        const start=b*4,chord=ROCK_CHORDS[b];
        // Alternating muted chugs and open power chords, with a second guitar
        // answering across the stereo field rather than doubling every hit.
        for(const position of[0,.75,1.5,2,2.75,3.5]){
          const open=position===0||position===2;
          for(const midi of[chord[0]+12,chord[1]+12,chord[0]+24]){
            play(midi,start+position,open?.65:.32,open?.032:.026,open?'electric':'palmMute',-.42);
          }
        }
        for(const position of[.5,2.5])for(const midi of[chord[3]+12,chord[1]+12]){
          play(midi,start+position,.65,.021,'electric',.42);
        }
        [0,.5,1.5,2,2.5,3.5].forEach((position,i)=>{
          play(i===2||i===5?chord[1]:chord[0],start+position,.42,.12,'electricBass',-.08);
        });
        melody[b].forEach((midi,i)=>{
          const position=start+[.5,1.5,2.5,3.25][i];
          play(midi,position,i===3?.65:.8,.045,'electricLead',.15);
          play(midi,position+.5,.6,.008,'electricHarmonic',-.25);
        });
        for(const position of[0,1.5,2,2.75])rockDrum(buffer,(start+position)*beat,beat*.65,.16,'kick');
        for(const position of[1,3])rockDrum(buffer,(start+position)*beat,beat*.6,.09,'snare');
        for(let i=0;i<8;i++)rockDrum(buffer,(start+i*.5)*beat,beat*.2,i%2?.026:.036,'hat');
      }
    });
  }

  function makeClassicalMusic(context){
    return renderArrangement(context,'classical',(play,buffer)=>{
      const melody=[[76,72,67,72],[72,69,65,69],[69,77,74,69],[71,74,79,74],
        [76,72,69,72],[74,77,81,77],[79,77,74,71],[76,79,72,72]];
      for(let b=0;b<8;b++){
        const start=b*4,chord=CLASSICAL_CHORDS[b],phrase=b<4?1:.88;
        const arpeggio=[chord[0]+12,chord[3],chord[1]+12,chord[0]+24];
        [chord[2],chord[3],chord[1]+12].forEach((midi,i)=>play(midi,start,4,.024*phrase,'strings',(i-1)*.4));
        play(chord[0],start,1.9,.10,'cello',-.2);play(chord[1],start+2,1.9,.075,'cello',-.2);
        [0,1,2,3,2,1,2,1].forEach((degree,i)=>{
          play(arpeggio[degree],start+i*.5,.9,.041*phrase,b%2?'harp':'piano',i%2?.3:-.3);
        });
        melody[b].forEach((midi,i)=>{
          const position=start+[0,1.5,2,3][i],length=[1.4,.45,.9,.95][i];
          play(midi,position,length,(i===0?.068:.055)*phrase,b<4?'oboe':'strings',.18);
        });
        for(const position of[1,3])play(chord[3],start+position,.5,.026,'pizzicato',-.38);
        // A quiet harp answer carries the cadence back into the opening bar.
        if(b===3||b===7)play(chord[2]+12,start+3.5,.9,.022,'harp',.4);
      }
    });
  }

  function makeMusic(context,theme='default'){
    if(theme==='jazz')return makeJazzMusic(context);
    if(theme==='rock')return makeRockMusic(context);
    if(theme==='classical')return makeClassicalMusic(context);
    return makeDefaultMusic(context);
  }

  function discoveryScore(id,startBeat=0,theme='default'){
    const tune=tunes[id],profile=themeFor(theme),score=[];
    function add(step,beat,length,volume,pan){
      const end=beat+length;
      while(beat<end-1e-8){
        const bar=Math.floor((beat+1e-8)/4),chord=profile.chords[((bar%profile.chords.length)+profile.chords.length)%profile.chords.length];
        const tones=[chord[0]+12,chord[3],chord[1]+12,chord[4]];
        const duration=Math.min(end,(bar+1)*4)-beat;
        const midi=tones[step%4]+12*Math.floor(step/4)+profile.octave;
        score.push({midi,beat:beat-startBeat,duration,volume:volume*profile.cueGain,pan,voice:profile.voices?.[id]||tune.voice});
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

  function makeTune(context,id,startBeat=0,beatLength,theme='default'){
    beatLength??=60/themeFor(theme).bpm;
    const tune=tunes[id],rate=24000;
    const start=grooveBeat(startBeat,theme),end=grooveBeat(startBeat+tune.beats.at(-1)+tune.length+.5,theme);
    const duration=(end-start)*beatLength+.04;
    const buffer=context.createBuffer(2,Math.ceil(duration*rate),rate);
    for(const n of discoveryScore(id,startBeat,theme)){
      const onset=grooveBeat(startBeat+n.beat,theme),end=grooveBeat(startBeat+n.beat+n.duration,theme);
      note(buffer,n.midi,(onset-start)*beatLength,(end-onset)*beatLength,n.volume,n.voice,n.pan);
    }
    return buffer;
  }

  class Soundtrack {
    constructor({onChange=()=>{}}={}){
      this.Context=root.AudioContext||root.webkitAudioContext;
      this.supported=!!this.Context;this.onChange=onChange;
      this.context=null;this.muted=false;this.paused=false;this.hidden=false;this.theme='default';
      this.voices=new Map();this.buffers=new Map();this.musicBuffers=new Map();
      try{
        this.muted=root.localStorage?.getItem(STORAGE_KEY)==='true';
        const saved=root.localStorage?.getItem(THEME_KEY);if(Object.hasOwn(THEMES,saved))this.theme=saved;
      }catch{}
      this.beatLength=60/themeFor(this.theme).bpm;
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
          this.startMusic();
        }catch{
          if(this.context)this.context.close().catch(()=>{});
          this.context=null;this.supported=false;this.onChange();return;
        }
      }
      this.sync();
    }
    startMusic(transition=false){
      const context=this.context;
      if(!this.musicBuffers.has(this.theme))this.musicBuffers.set(this.theme,makeMusic(context,this.theme));
      if(this.music){this.musicVolume.gain.setTargetAtTime(0,context.currentTime,.018);this.music.stop(context.currentTime+.09);}
      const music=context.createBufferSource(),volume=context.createGain();
      music.buffer=this.musicBuffers.get(this.theme);music.loop=true;volume.gain.value=.58;
      music.connect(volume);volume.connect(this.master);
      this.beatLength=music.buffer.duration/32;this.startedAt=context.currentTime+(transition ? .12 : .05);
      music.onended=()=>{music.disconnect();volume.disconnect();};
      music.start(this.startedAt);this.music=music;this.musicVolume=volume;
    }
    setTheme(theme){
      if(!Object.hasOwn(THEMES,theme)||theme===this.theme)return false;
      // Prepare first, so a failed buffer allocation leaves the current theme playing.
      if(this.context&&!this.musicBuffers.has(theme)){
        try{this.musicBuffers.set(theme,makeMusic(this.context,theme));}catch{return false;}
      }
      this.clearEffects();this.buffers.clear();this.theme=theme;this.beatLength=60/themeFor(theme).bpm;
      try{root.localStorage?.setItem(THEME_KEY,theme);}catch{}
      if(this.context)this.startMusic(true);
      this.unlock();this.sync();this.onChange();return true;
    }
    currentBeat(){
      return this.context&&this.music?straightBeat((this.context.currentTime-this.startedAt)/this.beatLength,this.theme):null;
    }
    nextEntrance(lead=.04){
      if(!this.context||!this.music)return;
      const position=straightBeat((this.context.currentTime+lead-this.startedAt)/this.beatLength,this.theme);
      const beat=Math.max(0,Math.ceil(position*2)/2);
      return {beat,when:this.startedAt+grooveBeat(beat,this.theme)*this.beatLength,theme:this.theme};
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
      if(!context||this.paused||this.hidden||context.state!=='running')return;
      return this.queueDiscovery(event);
    }
    queueDiscovery(event){
      const context=this.context;
      if(!context||this.muted||context.state==='closed'||!Number.isInteger(event.id)||!tunes[event.id])return;
      let cue=this.nextEntrance(),buffer,prepared=false;
      // A cold buffer can take a little time to synthesize. If it misses the
      // scheduling margin, advance to the next eighth note with its new chord.
      for(let attempt=0;attempt<4;attempt++){
        const began=context.currentTime;
        const key=`${this.theme}:${event.id}:${Math.round(cue.beat*2)%(themeFor(this.theme).chords.length*8)}`;
        if(!this.buffers.has(key)){
          if(this.buffers.size>=24)this.buffers.delete(this.buffers.keys().next().value);
          this.buffers.set(key,makeTune(context,event.id,cue.beat,this.beatLength,this.theme));
        }
        buffer=this.buffers.get(key);
        if(cue.when>=context.currentTime+.008){prepared=true;break;}
        cue=this.nextEntrance(Math.max(.04,(context.currentTime-began)*1.5));
      }
      if(!prepared)return;
      // Bound simultaneous sources even when all 36 shapes are revealing.
      if(this.voices.size>=48)this.stopVoice(this.voices.keys().next().value);
      const source=context.createBufferSource(),gain=context.createGain();
      source.buffer=buffer;
      gain.gain.value=.65/Math.sqrt(1+this.voices.size*.3);
      source.connect(gain);gain.connect(this.master);this.voices.set(source,gain);
      source.onended=()=>{source.disconnect();gain.disconnect();this.voices.delete(source);};
      source.start(cue.when);return cue;
    }
    stopVoice(source){
      const gain=this.voices.get(source);if(!gain)return;
      const now=this.context.currentTime;gain.gain.setTargetAtTime(0,now,.008);
      source.stop(now+.04);this.voices.delete(source);
    }
    clearEffects(){for(const source of this.voices.keys())this.stopVoice(source);}
  }
  return {Soundtrack,makeMusic,makeTune,discoveryScore,grooveBeat,straightBeat,BEAT,CHORDS,THEMES};
});
