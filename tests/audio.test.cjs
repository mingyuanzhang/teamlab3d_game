const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const {AudioContext}=require('./helpers/audio.cjs');
const {makeMusic,makeTune,discoveryScore,CHORDS}=require('../audio.js');

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
    assert.ok(peak<.8&&peak>.1);assert.ok(rms>.02);
    for(let channel=0;channel<2;channel++){
      const data=buffer.getChannelData(channel);
      assert.equal(data[0],0);assert.ok(data.slice(-240).every(value=>Math.abs(value)<.0001));
    }
    hashes.add(createHash('sha256').update(Buffer.from(buffer.getChannelData(0).buffer)).digest('hex'));
  }
  assert.equal(hashes.size,6);
});

test('all melodies and echoes follow the active chord through every bar and loop boundary',()=>{
  for(let id=0;id<6;id++)for(const start of [0,.5,3.5,4,7.5,8,11.5,12,15.5,31.5,32.5]){
    for(const n of discoveryScore(id,start)){
      const absolute=start+n.beat,bar=Math.floor((absolute+1e-8)/4),chord=CHORDS[bar%4];
      assert.ok(chord.some(midi=>midi%12===n.midi%12),`Shape ${id}, beat ${absolute}: pitch ${n.midi} must belong to the active chord`);
      assert.ok(absolute+n.duration<=(bar+1)*4+1e-8,'Sustains retune at chord changes');
      assert.equal(n.beat*4,Math.round(n.beat*4),'Each note and echo follows the sixteenth-note grid');
    }
  }
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

test('reveal scheduling stays on the music clock after pauses and complete music loops',()=>{
  const {Soundtrack}=load(),sound=new Soundtrack();sound.unlock();
  for(const time of [.12,2.7,11.31,22.93,46.71]){
    sound.context.currentTime=time;
    const cue=sound.playDiscovery({id:2});
    const beat=(cue.when-sound.startedAt)/sound.beatLength;
    assert.ok(Math.abs(beat*2-Math.round(beat*2))<1e-9);
    assert.ok(cue.when>=time+.008&&cue.when-time<sound.beatLength/2+.041);
    sound.setPaused(true);sound.setPaused(false);
    assert.equal(sound.music.when,sound.startedAt,'Pausing preserves the music origin');
  }
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
