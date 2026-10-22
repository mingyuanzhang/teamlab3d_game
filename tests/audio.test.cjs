const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const {AudioContext}=require('./helpers/audio.cjs');
const {makeMusic,makeTune,discoveryScore,composerScore,THEMES,grooveBeat,straightBeat}=require('../audio.js');
const defaultHashes={music:'ccf9c142b7708c1d946b2cc6c2c6b54aeef080e28f4ba5f423b4b4e94617e7ec',tunes:[
  '14a63b7abd4b265382b3c1f9b02b0fe85ad24739e2b2e0b86a743b0e40a66e4f','f6bf7633608ad63311b82d5d86ac8784fff2e538cb8c29ff98b5c459d8ecf44b',
  'a4ebdada3efa12aeff22a8769b028ff9901670d42b2e9b1fd324df2cbcade626','6d57817404a9e4968794b79d38a3712078c566241fb67b7b78787d36760c131e',
  'd33204d4e4ed2cec1f9661d210f1da1e45c3b24f6d7c2f8b79d810126f652c0e','525af54f39ac62a03bf6e3f9bc3b1038bcd4603010819263ac84ecac0e5c24b5'
]};
function hash(buffer){const h=createHash('sha256');for(let i=0;i<2;i++)h.update(Buffer.from(buffer.getChannelData(i).buffer));return h.digest('hex');}

function samples(buffer){
  let peak=0,power=0;
  for(let channel=0;channel<buffer.numberOfChannels;channel++){
    for(const value of buffer.getChannelData(channel)){
      assert.ok(Number.isFinite(value));peak=Math.max(peak,Math.abs(value));power+=value*value;
    }
  }
  return {peak,rms:Math.sqrt(power/(buffer.length*buffer.numberOfChannels))};
}

test('music is audible stereo PCM with headroom and a continuous loop boundary',()=>{
  const buffer=makeMusic(new AudioContext()),{peak,rms}=samples(buffer);
  assert.equal(hash(buffer),defaultHashes.music,'The original soundtrack remains the Default theme');
  assert.ok(buffer.duration>20);assert.ok(buffer.duration<30);
  assert.ok(peak<.6&&peak>.1);assert.ok(rms>.015);
  assert.notDeepEqual(buffer.getChannelData(0),buffer.getChannelData(1));
  for(let channel=0;channel<2;channel++){
    const data=buffer.getChannelData(channel);
    assert.ok(Math.abs(data[0]-data.at(-1))<.025,'Loop boundary must not introduce an audible click');
  }
});

test('all six discovery tunes are distinct, audible, and fade to silence',()=>{
  const hashes=new Set();
  for(let id=0;id<6;id++){
    const buffer=makeTune(new AudioContext(),id),{peak,rms}=samples(buffer);
    assert.equal(hash(buffer),defaultHashes.tunes[id],'The original discovery melody is preserved');
    assert.ok(peak<.8&&peak>.1);assert.ok(rms>.02);
    for(let channel=0;channel<2;channel++){
      const data=buffer.getChannelData(channel);
      assert.equal(data[0],0);assert.ok(data.slice(-240).every(value=>Math.abs(value)<.0001));
    }
    hashes.add(createHash('sha256').update(Buffer.from(buffer.getChannelData(0).buffer)).digest('hex'));
  }
  assert.equal(hashes.size,6);
});

test('generated melodies and echoes follow the active chord through every bar and loop boundary',()=>{
  for(const theme of Object.keys(THEMES).filter(theme=>!THEMES[theme].harmony))for(let id=0;id<6;id++)for(const start of Array.from({length:68},(_,i)=>i*.5)){
    for(const n of discoveryScore(id,start,theme)){
      const absolute=start+n.beat,bar=Math.floor((absolute+1e-8)/4),chords=THEMES[theme].chords,chord=chords[bar%chords.length];
      assert.ok(chord.some(midi=>midi%12===n.midi%12),`Shape ${id}, beat ${absolute}: pitch ${n.midi} must belong to the active chord`);
      assert.ok(absolute+n.duration<=(bar+1)*4+1e-8,'Sustains retune at chord changes');
      const tick=n.beat*(THEMES[theme].subdivision||4);
      assert.ok(Math.abs(tick-Math.round(tick))<1e-8,'Each note and echo follows the theme\'s subdivision grid');
    }
  }
});

// Harmonic windows from the actual accompaniment, independent of the cue
// generator. Chopin's diminished chords occur inside the four-beat bars.
const pianoHarmony={
  bach:{period:16,changes:[[0,[0,4,7]],[4,[0,2,5,9]],[8,[2,5,7,11]],[12,[0,4,7]]]},
  chopin:{period:8,changes:[[0,[3,7,10]],[4/3,[2,5,8,11]],[2,[3,7,10]],[4,[0,4,7,10]],[6,[1,4,5,10]],[7,[0,5,8]]]}
};
function pianoChord(theme,beat){
  const {period,changes}=pianoHarmony[theme],phase=((beat%period)+period)%period;
  return changes.findLast(([start])=>phase>=start-1e-8)[1];
}

test('original piano phrases follow every accompaniment change, including within bars and across loops',()=>{
  for(const theme of ['bach','chopin'])for(let id=0;id<6;id++)for(let variant=0;variant<3;variant++){
    for(const start of Array.from({length:68},(_,i)=>i*.5)){
      const score=discoveryScore(id,start,theme,variant);
      assert.ok(score.length>=4&&score.length<=8,'Short phrases leave space for the background');
      for(const n of score){
        const absolute=start+n.beat,tick=n.beat*THEMES[theme].subdivision;
        assert.ok(Math.abs(tick-Math.round(tick))<1e-8,'Each phrase uses the shared rhythmic subdivision');
        assert.ok(n.midi>=55&&n.midi<=81,'Discoveries keep a restrained piano register');
        assert.ok(n.volume>0&&n.volume<.1,'The piano touch leaves room for the backing');
        assert.ok(n.duration>0);
        for(let t=absolute;t<absolute+n.duration-1e-8;t+=1/48){
          assert.ok(pianoChord(theme,t).includes(n.midi%12),`${theme}, shape ${id}, beat ${t}: held pitch ${n.midi} belongs to the current harmony`);
        }
        assert.ok(pianoChord(theme,absolute+n.duration-1e-7).includes(n.midi%12));
      }
    }
    assert.notDeepEqual(discoveryScore(id,0,theme,variant).map(n=>n.midi),discoveryScore(id,4,theme,variant).map(n=>n.midi),'The same object adapts its pitches to a different chord');
  }
});

test('piano variations keep each opening gesture and vary its answer, timing, and touch',()=>{
  const context=new AudioContext();
  for(const theme of ['bach','chopin'])for(let id=0;id<6;id++){
    const openings=[],phrases=new Set(),waveforms=new Set();
    for(let variant=0;variant<3;variant++){
      const score=discoveryScore(id,0,theme,variant);
      openings.push(score.slice(0,2).map(n=>[n.midi,n.beat]));
      phrases.add(JSON.stringify(score.map(n=>[n.midi,n.beat])));
      const buffer=makeTune(context,id,0,undefined,theme,variant),levels=samples(buffer);
      assert.ok(levels.rms>.015&&levels.peak<.2,'Variations are audible and remain gentle');
      for(let c=0;c<2;c++)assert.ok(buffer.getChannelData(c).slice(-240).every(n=>Math.abs(n)<.0001),'Piano releases finish before the buffer ends');
      waveforms.add(hash(buffer));
    }
    assert.deepEqual(openings[0],openings[1]);assert.deepEqual(openings[0],openings[2]);
    assert.equal(phrases.size,3);assert.equal(waveforms.size,3);
  }
});

test('Bach and Chopin use piano throughout their backing and all six discoveries',()=>{
  for(const theme of ['bach','chopin']){
    const backing=composerScore(theme);assert.ok(backing.length>100);
    assert.ok(backing.some(n=>n.midi<60),'The piano accompaniment includes a left hand');
    for(const n of [...backing,...Array.from({length:6},(_,id)=>discoveryScore(id,3.5,theme)).flat()]){
      assert.ok(['grand','feltPiano'].includes(n.voice),'Every pitched part is played on piano');
      assert.ok(n.beat>=0&&n.beat<32&&n.duration>0);
    }
  }
});

for(const theme of Object.keys(THEMES).filter(theme=>theme!=='default'))test(`${THEMES[theme].name} has audible stereo music and six distinct tunes that end cleanly`,()=>{
  const context=new AudioContext(),music=makeMusic(context,theme),levels=samples(music),hashes=new Set();
  assert.notEqual(hash(music),defaultHashes.music);assert.ok(levels.rms>.015&&levels.peak<.8);
  const preservedPiano={bach:'a4332bee7d897f17a6761c6cb0b29cecbcd092e335db163fec30729c4119b7d4',chopin:'11ad8c7f9c373a3bf5ad12e1e0d30a3bec99d00f90c714d4a61ef32b2b3c93f1'};
  if(preservedPiano[theme])assert.equal(hash(music),preservedPiano[theme],'The existing piano background is unchanged');
  assert.ok(Math.abs(music.duration-32*60/THEMES[theme].bpm)<1/music.sampleRate);
  assert.notDeepEqual(music.getChannelData(0),music.getChannelData(1));
  for(let channel=0;channel<2;channel++){
    const data=music.getChannelData(channel);assert.ok(Math.abs(data[0]-data.at(-1))<.025);
  }
  for(let id=0;id<6;id++){
    const buffer=makeTune(context,id,3.5,undefined,theme),{peak,rms}=samples(buffer);
    assert.ok(peak<.8&&rms>.015);assert.notEqual(hash(buffer),defaultHashes.tunes[id]);
    for(let channel=0;channel<2;channel++)assert.ok(buffer.getChannelData(channel).slice(-240).every(value=>Math.abs(value)<.0001));
    hashes.add(hash(buffer));
  }
  assert.equal(hashes.size,6);
});

test('the jazz groove swings every object on the same subdivision grid',()=>{
  for(const beat of [-.25,0,.25,.5,.75,1,3.5,31.5,32.5]){
    assert.ok(Math.abs(straightBeat(grooveBeat(beat,'jazz'),'jazz')-beat)<1e-10);
    assert.equal(grooveBeat(beat,'default'),beat);
  }
  assert.equal(grooveBeat(.5,'jazz'),.62);assert.equal(grooveBeat(.25,'jazz'),.31);
  assert.equal(grooveBeat(1.5,'jazz'),1.62);
});

function load(extra={}){
  const context=vm.createContext({AudioContext,...extra});
  vm.runInContext(fs.readFileSync(require.resolve('../audio.js'),'utf8'),context);
  return context.WonderAudio;
}

test('crowded discoveries stay bounded, reuse buffers, and disconnect ended sources',()=>{
  const {Soundtrack}=load(),sound=new Soundtrack();sound.unlock();
  for(let i=0;i<72;i++)sound.playDiscovery({id:i%6});
  assert.equal(sound.voices.size,48);assert.equal(sound.buffers.size,6);
  assert.equal(sound.music.loop,true);
  const source=sound.voices.keys().next().value,gain=sound.voices.get(source);
  source.onended();assert.equal(source.connections.length,0);assert.equal(gain.connections.length,0);
  assert.equal(sound.voices.size,47);
  sound.clearEffects();assert.equal(sound.voices.size,0);
});

test('repeated piano reveals and copies vary their answers while reusing a bounded cache',()=>{
  const {Soundtrack}=load();
  for(const theme of ['bach','chopin']){
    const sound=new Soundtrack();sound.setTheme(theme);
    sound.context.currentTime=sound.startedAt+.1;
    const play=event=>{
      const cue=sound.playDiscovery(event),source=Array.from(sound.voices.keys()).at(-1);
      assert.ok(cue);assert.equal(cue.theme,theme);
      return source.buffer;
    };
    const first=play({id:0,tokenId:1,cycle:1});
    assert.equal(play({id:0,tokenId:1,cycle:1}),first,'Rescheduling an entrance keeps its variation');
    const second=play({id:0,tokenId:1,cycle:2}),third=play({id:0,tokenId:1,cycle:3});
    assert.notEqual(second,first);assert.notEqual(third,first);assert.notEqual(second,third);
    assert.notEqual(play({id:0,tokenId:2,cycle:1}),first,'Different copies can answer differently');
    assert.equal(play({id:0,tokenId:1,cycle:4}),first,'The small variation set reuses prepared audio');
    sound.context.currentTime+=pianoHarmony[theme].period*sound.beatLength;
    assert.equal(play({id:0,tokenId:1,cycle:1}),first,'The harmonic loop reuses its matching variation');
    for(let i=0;i<60;i++){
      sound.context.currentTime+=sound.beatLength;
      play({id:i%6,tokenId:i+1,cycle:i+1});
    }
    assert.ok(sound.buffers.size<=24);assert.ok(sound.voices.size<=48);sound.clearEffects();
  }
});

test('reveal scheduling stays on the music clock after pauses and complete music loops',()=>{
  const {Soundtrack}=load(),sound=new Soundtrack();sound.unlock();
  for(const theme of Object.keys(THEMES)){
    sound.setTheme(theme);const origin=sound.startedAt;
    for(const elapsed of [.12,2.7,11.31,22.93,46.71]){
    const time=origin+elapsed;sound.context.currentTime=time;
    const cue=sound.playDiscovery({id:2});
    const beat=straightBeat((cue.when-sound.startedAt)/sound.beatLength,theme);
    const step=THEMES[theme].entranceBeats??.5,maxGap=THEMES[theme].entranceBeats??THEMES[theme].swing;
    assert.ok(Math.abs(beat/step-Math.round(beat/step))<1e-9);
    assert.ok(cue.when>=time+.008&&cue.when-time<sound.beatLength*maxGap+.041);
    if(theme==='chopin')assert.ok(Number.isInteger(cue.beat),'Chopin triplets enter on quarter beats with the piano accompaniment');
    sound.setPaused(true);sound.setPaused(false);
    assert.equal(sound.music.when,sound.startedAt,'Pausing preserves the music origin');
    }
  }
});

test('theme switches retire old music and cues, persist preferences, and respect mute and pause',()=>{
  const saved=new Map(),localStorage={getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)};
  const {Soundtrack}=load({localStorage}),sound=new Soundtrack();
  assert.equal(sound.theme,'default');sound.unlock();sound.playDiscovery({id:0});
  const music=sound.music,voice=sound.voices.keys().next().value;
  sound.setPaused(true);assert.equal(sound.setTheme('jazz'),true);
  assert.equal(sound.context.state,'suspended');assert.equal(music.stopped,true);assert.equal(voice.stopped,true);
  assert.equal(sound.buffers.size,0);assert.ok(Math.abs(sound.beatLength-60/104)<.00001);
  assert.equal(new Soundtrack().theme,'jazz','The next visit remembers the selected theme');
  const queued=sound.queueDiscovery({id:3});assert.ok(queued.when>=sound.startedAt);assert.equal(queued.theme,'jazz');
  sound.setMuted(true);sound.setTheme('default');assert.equal(sound.muted,true);assert.equal(sound.context.state,'suspended');
  assert.equal(sound.queueDiscovery({id:0}),undefined);assert.equal(sound.setTheme('__proto__'),false);
  const silent=new Soundtrack();assert.equal(silent.muted,true);silent.setTheme('jazz');assert.equal(silent.context,null);
});

test('a failed theme buffer allocation preserves the playing theme',()=>{
  const {Soundtrack}=load(),sound=new Soundtrack();sound.unlock();const music=sound.music;
  sound.context.createBuffer=()=>{throw Error('Allocation failed');};
  assert.equal(sound.setTheme('jazz'),false);assert.equal(sound.theme,'default');assert.equal(sound.music,music);assert.equal(music.stopped,false);
});

test('slow cue generation advances to a future swung beat with the correct chord',()=>{
  const {Soundtrack}=load(),sound=new Soundtrack();sound.setTheme('jazz');
  const context=sound.context,create=context.createBuffer.bind(context);
  context.currentTime=sound.startedAt+3.4*sound.beatLength;
  context.createBuffer=(...args)=>{context.currentTime+=.6;return create(...args);};
  const cue=sound.playDiscovery({id:0});
  assert.ok(cue.when>context.currentTime);assert.equal(cue.theme,'jazz');
  assert.ok(Math.abs(straightBeat((cue.when-sound.startedAt)/sound.beatLength,'jazz')-cue.beat)<1e-9);
  const key=`jazz:0:${Math.round(cue.beat*2)%64}`;
  assert.equal([...sound.voices.keys()][0].buffer,sound.buffers.get(key));
});

test('storage restrictions and rejected browser resumes do not break play',async()=>{
  const lockedStorage={getItem(){throw Error('Blocked');},setItem(){throw Error('Blocked');}};
  class BlockedContext extends AudioContext{resume(){return Promise.reject(Error('Gesture required'));}}
  const {Soundtrack}=load({localStorage:lockedStorage,AudioContext:BlockedContext});
  const sound=new Soundtrack();sound.unlock();sound.setMuted(true);sound.setMuted(false);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(sound.supported,true);assert.equal(sound.voices.size,0);
});

test('rapid pause changes settle to the latest state after pending browser operations',async()=>{
  class PendingContext extends AudioContext{
    constructor(){super();this.pending=[];}
    resume(){return new Promise(resolve=>this.pending.push(()=>{this.state='running';resolve();}));}
    suspend(){return new Promise(resolve=>this.pending.push(()=>{this.state='suspended';resolve();}));}
  }
  const {Soundtrack}=load({AudioContext:PendingContext}),sound=new Soundtrack();sound.unlock();
  sound.setPaused(true);
  sound.context.pending.shift()();await Promise.resolve();
  sound.context.pending.shift()();await Promise.resolve();
  assert.equal(sound.context.state,'suspended','A pending resume must not override pause');
  sound.setPaused(false);sound.context.pending.shift()();await Promise.resolve();
  sound.setPaused(true);sound.setPaused(false);
  sound.context.pending.shift()();await Promise.resolve();
  sound.context.pending.shift()();await Promise.resolve();
  assert.equal(sound.context.state,'running','A pending pause must not override resume');
});
