import {blastKind} from './fx.js';
import {WEAPONS} from './arsenal.js';
import {isCreature} from './creatures.js';
const midi = note => 440 * 2 ** ((note - 69) / 12);
const ROOTS = [50, 50, 53, 53, 48, 48, 55, 57];
const RIFF = [12, null, 7, 10, 12, 15, 10, 7];
const THEMES={
  ship:{shift:0,riff:RIFF,lead:'triangle',leadGain:.12,bass:'square',bassGain:.065,kick:.17,hat:1},
  machine:{shift:-5,riff:[12,null,7,null,10,7,null,3],lead:'triangle',leadGain:.13,bass:'triangle',bassGain:.13,kick:.15,hat:.8},
  organic:{shift:-2,riff:[12,15,10,null,7,10,5,null],lead:'sine',leadGain:.14,bass:'triangle',bassGain:.11,kick:.14,hat:.55},
  void:{shift:5,riff:[19,null,12,null,7,15,null,10],lead:'triangle',leadGain:.13,bass:'sine',bassGain:.13,kick:.13,hat:.4},
  aquarium:{shift:2,riff:[19,14,null,12,7,null,10,14],lead:'sine',leadGain:.15,bass:'sine',bassGain:.12,kick:.13,hat:.35},
  scrapyard:{shift:-3,riff:[7,null,12,10,null,7,3,10],lead:'triangle',leadGain:.14,bass:'triangle',bassGain:.1,kick:.16,hat:.65}
};

// All audio is synthesized locally. Resume from a real gesture before scheduling
// anything: mobile browsers may otherwise consume short sounds while suspended.
export class GameAudio {
  constructor(onState = () => {}) {
    this.onState = onState;
    this.enabled = false;
    this.mode = 'ready';
    this.voices = new Set();
    this.step = 0;
    this.thrust = false;
    this.realm = 'ship';this.cueTimes=new Map();
  }
  create() {
    const AudioClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioClass) throw new Error('Audio is unavailable');
    // Use the playback session on supporting iOS versions, including devices
    // whose hardware switch otherwise silences Web Audio's ambient session.
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    this.context = new AudioClass({ latencyHint: 'interactive' });
    const c = this.context;this.cueTimes.clear();
    this.master = c.createGain(); this.master.gain.value = 0;
    this.music = c.createGain(); this.music.gain.value = .65;
    this.themeBuses={};this.musicDestinations=new Set([this.music]);
    for(const realm of Object.keys(THEMES)) {
      const bus=c.createGain();bus.gain.value=realm===this.realm?1:0;bus.connect(this.music);
      this.themeBuses[realm]=bus;this.musicDestinations.add(bus);
    }
    this.effects = c.createGain();
    this.blasts=c.createGain();this.blasts.gain.value=.85;this.blasts.connect(this.effects);
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -12; limiter.ratio.value = 4;
    limiter.knee.value = 30; limiter.attack.value = .003; limiter.release.value = .25;
    // An emergency ceiling stays exactly linear throughout the normal mix.
    // It only softens exceptional stacked effects, leaving the music's dynamics.
    const guard = c.createWaveShaper(), curve = new Float32Array(8193);
    for(let i=0;i<curve.length;i++) {
      const x=i*2/(curve.length-1)-1, a=Math.abs(x);
      curve[i]=Math.sign(x)*(a<=.8 ? a : .8+.1*(1-Math.exp(-(a-.8)/.1)));
    }
    guard.curve=curve; guard.oversample='2x';
    this.music.connect(this.master); this.effects.connect(this.master);
    this.master.connect(limiter); limiter.connect(guard); guard.connect(c.destination);
    // Steady filtered air, with no pitched combustion harmonics or revving.
    this.engine = c.createBufferSource();
    this.engine.buffer = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
    const air = this.engine.buffer.getChannelData(0);
    for (let i = 0; i < air.length; i++) air[i] = Math.random() * 2 - 1;
    this.engine.loop = true;
    const filter = c.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 1100; filter.Q.value = .5;
    const soften = c.createBiquadFilter(); soften.type = 'lowpass'; soften.frequency.value = 2400; soften.Q.value = .5;
    this.engineGain = c.createGain(); this.engineGain.gain.value = 0;
    this.engine.connect(filter).connect(soften).connect(this.engineGain).connect(this.effects); this.engine.start();
    // Weapons bypass the general effect boost. Keep this bus below the air jet.
    this.weapons = c.createGain(); this.weapons.gain.value = .55; this.weapons.connect(this.effects);
    this.noise = c.createBuffer(1, Math.ceil(c.sampleRate * .065), c.sampleRate);
    const noise = this.noise.getChannelData(0);
    for (let i = 0; i < noise.length; i++) noise[i] = (Math.random() * 2 - 1) * (1 - i / noise.length);
    this.blastNoise=c.createBuffer(1,Math.ceil(c.sampleRate*1.2),c.sampleRate);
    const boom=this.blastNoise.getChannelData(0);let low=0;
    for(let i=0;i<boom.length;i++){const white=Math.random()*2-1;low=.97*low+.03*white;boom[i]=white*.55+low*1.35;}
    c.onstatechange = () => this.sync();
  }
  get running() { return this.enabled && this.context?.state === 'running'; }
  async enable() {
    this.enabled = true;
    this.onState('starting');
    try {
      if (!this.context || this.context.state === 'closed') this.create();
      // Call resume synchronously in this gesture, then await its result.
      if (this.context.state !== 'running') await this.context.resume();
      this.sync();
      return this.running;
    } catch {
      if (this.enabled) this.onState('blocked');
      return false;
    }
  }
  disable() {
    this.enabled = false;
    if (this.context) {
      const t = this.context.currentTime;
      this.master.gain.cancelAndHoldAtTime(t); this.master.gain.linearRampToValueAtTime(0, t+.02);
      this.engineGain.gain.cancelAndHoldAtTime(t); this.engineGain.gain.linearRampToValueAtTime(0, t+.02);
    }
    this.stopMusic();this.stopEffects(); this.onState('off');
  }
  sync() {
    if (!this.context) return;
    const t = this.context.currentTime;
    this.master.gain.setTargetAtTime(this.running && this.mode !== 'paused' ? .85 : 0, t, .015);
    if (this.running && this.mode !== 'paused') this.startMusic();
    else {this.stopMusic();this.stopEffects();}
    this.engineGain.gain.setTargetAtTime(this.running && this.mode === 'playing' && this.thrust ? .16 : 0, t, .06);
    this.onState(!this.enabled ? 'off' : this.running ? 'on' : 'blocked');
  }
  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    if (!this.context) return;
    this.music.gain.setTargetAtTime(mode === 'playing' ? .8 : .48, this.context.currentTime, .1);
    this.sync();
  }
  setThrust(active) {
    if (this.thrust === active) return;
    this.thrust = active;
    if (!this.context) return;
    const t = this.context.currentTime;
    this.engineGain.gain.setTargetAtTime(this.running && this.mode === 'playing' && active ? .16 : 0, t, .06);
  }
  setRealm(realm) {
    realm=THEMES[realm]?realm:'ship';
    if(this.realm===realm)return;
    this.realm=realm;
    if(!this.context)return;
    const t=this.context.currentTime;
    for(const [name,bus] of Object.entries(this.themeBuses)) {
      bus.gain.cancelAndHoldAtTime(t);bus.gain.linearRampToValueAtTime(name===realm?1:0,t+.55);
    }
  }
  tone(freq, duration, type, volume, at, destination, end) {
    const c = this.context, osc = c.createOscillator(), gain = c.createGain();
    gain.gain.value=0;
    osc.type = type; osc.frequency.setValueAtTime(freq, at);
    if (end) osc.frequency.exponentialRampToValueAtTime(end, at + duration);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    osc.connect(gain).connect(destination);
    const voice = { source: osc, gain, music: this.musicDestinations.has(destination), explosion:destination===this.blasts };
    this.voices.add(voice);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); this.voices.delete(voice); };
    osc.start(at); osc.stop(at + duration + .015);
  }
  effect(freq, duration = .1, type = 'sine', volume = .045, end) {
    if (!this.running || this.mode === 'paused') return;
    this.tone(freq, duration, type, Math.min(.28, volume * 2.8), this.context.currentTime + .01, this.effects, end);
  }
  weapon(kind = 'ion', upgraded = false) {
    if (!this.running || this.mode === 'paused' || !WEAPONS[kind]) return false;
    const at=this.context.currentTime+.005;
    const tone=(f,d,w,v,end,delay=0)=>this.tone(f,d,w,v,at+delay,this.weapons,end);
    const noise=(d,v,from,to,delay=0)=>this.noiseBurst(at+delay,d,v,from,to,this.weapons);
    if(upgraded)tone(kind==='fork'?440:620,.18,'triangle',.035,kind==='fork'?880:310,.02);
    if(kind==='ion') {tone(1160,.14,'triangle',.27,680);noise(.025,.035,3800,1700);}
    if(kind==='shuttle'){tone(920,.15,'triangle',.24,460);tone(1840,.06,'sine',.035,920,.015);}
    if(kind==='pulse') {
      tone(340,.28,'triangle',.13,95);tone(820,.15,'sine',.095,1350,.015);
      noise(.09,.08,1100,280);
    }
    if(kind==='fork') {
      noise(.14,.24,4600,1400);tone(880,.14,'triangle',.17,2300);
      tone(1660,.07,'triangle',.07,740,.045);
    }
    if(kind==='moon') {
      tone(190,.24,'triangle',.105,365);tone(310,.19,'sine',.06,155,.065);
      tone(760,.16,'sine',.085,1100,.015);tone(580,.1,'triangle',.04,400,.14);
    }
    if(kind==='tape') {
      noise(.045,.3,3700,800);tone(140,.11,'triangle',.17,80);
      tone(880,.11,'triangle',.17,440);tone(210,.08,'triangle',.065,120,.065);
    }
    return true;
  }
  noiseBurst(at,duration,volume,from,to,destination=this.blasts) {
    const c=this.context,source=c.createBufferSource(),filter=c.createBiquadFilter(),cut=c.createBiquadFilter(),gain=c.createGain();
    gain.gain.value=0;
    source.buffer=this.blastNoise;filter.type='lowpass';filter.Q.value=.55;
    filter.frequency.setValueAtTime(from,at);filter.frequency.exponentialRampToValueAtTime(to,at+duration);
    cut.type='highpass';cut.frequency.value=85;cut.Q.value=.5;
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.006);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume*.45),at+duration*.24);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    source.connect(filter).connect(cut).connect(gain).connect(destination);
    const voice={source,gain,music:false,explosion:destination===this.blasts};this.voices.add(voice);
    source.onended=()=>{source.disconnect();filter.disconnect();cut.disconnect();gain.disconnect();this.voices.delete(voice);};
    source.start(at);source.stop(at+duration+.02);
  }
  destruction(hazard,weapon) {
    if(!this.running||this.mode==='paused')return false;
    const t=this.context.currentTime,key=`destroy:${weapon}`,last=this.cueTimes.get(key)??-Infinity;
    // One audible breakup represents a simultaneous chain/splash cluster.
    // Future hits still get their own cue; gun voices never share this gate.
    if(t-last<.045)return false;
    this.cueTimes.set(key,t);
    if(weapon==='tape')return this.cue('paperwork');
    if(weapon==='fork')this.cue('arc-hit');
    if(isCreature(hazard)) {
      const [from,to]=({auditor:[1420,720],hopper:[430,110],manta:[880,540],spore:[260,630],crab:[770,270],jelly:[610,410],mimic:[980,250],drone:[1100,480]})[hazard];
      this.tone(from,.17,'triangle',.085,t+.006,this.effects,to);
      if(hazard==='crab')this.tone(1130,.07,'sine',.045,t+.04,this.effects,370);
    }
    return this.explosion(hazard,undefined,['pulse','fork','moon'].includes(weapon)?.6:1);
  }
  explosion(kind,at,level=1) {
    if(!this.running||this.mode==='paused')return false;
    if([...this.voices].filter(v=>v.explosion).length>48)return false;
    kind=blastKind(kind);at ??= this.context.currentTime+.006;
    const tone=(f,d,w,v,end,delay=0)=>this.tone(f,d,w,v*level,at+delay,this.blasts,end);
    const noise=(delay,d,v,from,to)=>this.noiseBurst(at+delay,d,v*level,from,to);
    if(kind==='shuttle') {
      noise(0,.62,.72,2200,210);tone(135,.45,'sine',.38,48);tone(210,.23,'triangle',.13,70);
      noise(.1,.27,.4,2700,350);noise(.23,.23,.32,1800,180);
      tone(930,.09,'triangle',.055,270,.14);tone(650,.11,'sine',.055,180,.29);tone(880,.15,'sine',.04,220,.46);
    } else if(kind==='missile') {
      noise(0,.36,.58,3400,220);tone(155,.25,'sine',.27,47);tone(270,.12,'triangle',.08,80);
      noise(.06,.2,.2,1600,250);
    } else if(kind==='energy') {
      noise(0,.22,.64,4100,700);tone(720,.19,'triangle',.25,150);tone(1380,.12,'sine',.10,390,.035);
      noise(.065,.15,.24,2600,600);
    } else {
      noise(0,.3,.64,2600,260);tone(220,.21,'triangle',.3,65);
      tone(1850,.075,'sine',.055,680,.055);tone(970,.085,'triangle',.055,370,.13);
    }
    return true;
  }
  cheer() {
    if(!this.running||this.mode==='paused')return false;
    const t=this.context.currentTime,last=this.cueTimes.get('cheer')??-Infinity;
    if(t-last<.8)return false;
    this.cueTimes.set('cheer',t);
    const c=this.context,source=c.createOscillator(),gain=c.createGain(),low=c.createBiquadFilter(),high=c.createBiquadFilter();
    source.type='sawtooth';source.frequency.setValueAtTime(180,t);source.frequency.exponentialRampToValueAtTime(285,t+.11);
    source.frequency.setValueAtTime(225,t+.19);source.frequency.exponentialRampToValueAtTime(400,t+.35);
    low.type=high.type='bandpass';low.frequency.value=350;low.Q.value=3;high.frequency.value=850;high.Q.value=4;
    gain.gain.value=0;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.075,t+.018);
    gain.gain.exponentialRampToValueAtTime(.001,t+.15);gain.gain.linearRampToValueAtTime(.075,t+.21);gain.gain.exponentialRampToValueAtTime(.0001,t+.39);
    source.connect(low).connect(gain);source.connect(high).connect(gain);gain.connect(this.effects);
    const voice={source,gain,music:false};this.voices.add(voice);
    source.onended=()=>{source.disconnect();low.disconnect();high.disconnect();gain.disconnect();this.voices.delete(voice);};
    this.noiseBurst(t+.17,.045,.045,1900,700,this.effects);
    source.start(t);source.stop(t+.4);return true;
  }
  portal() {
    if(!this.running||this.mode==='paused')return false;
    this.stopEffects();this.cueTimes.clear();
    const t=this.context.currentTime+.006;
    this.noiseBurst(t,.47,.42,450,3900,this.effects);
    this.tone(300,.38,'sine',.15,t,this.effects,1100);this.tone(720,.32,'triangle',.085,t+.06,this.effects,230);
    this.tone(midi(ROOTS[0]+THEMES[this.realm].shift+12),.32,'sine',.075,t+.15,this.effects);
    return true;
  }
  cue(kind,value=0) {
    if(!this.running||this.mode==='paused')return false;
    const t=this.context.currentTime+.005,last=this.cueTimes.get(kind)??-Infinity;
    if(t-last<(kind==='coin'?.065:kind==='impact'?.055:['moon-bounce','moon-chomp','arc-hit'].includes(kind)?.14:0))return false;
    this.cueTimes.set(kind,t);
    const tone=(f,d,w,v,end,delay=0)=>this.tone(f,d,w,v,t+delay,this.effects,end);
    if(kind==='moon-bounce'){tone(170,.15,'sine',.07,290);tone(340,.09,'sine',.025,230,.04);}
    else if(kind==='moon-chomp'){tone(640,.105,'triangle',.09,260);this.noiseBurst(t,.045,.12,2400,900,this.effects);}
    else if(kind==='arc-hit'){this.noiseBurst(t,.1,.16,3400,1100,this.effects);tone(970,.095,'triangle',.08,390);}
    else if(kind==='grav-pop'){tone(680,.14,'triangle',.09,220);tone(115,.23,'sine',.09,48);this.noiseBurst(t,.14,.13,900,170,this.effects);}
    else if(kind==='paperwork'){this.noiseBurst(t,.16,.22,3900,1200,this.effects);tone(760,.095,'triangle',.105,380);tone(1140,.07,'sine',.055,570,.055);}
    else if(kind==='weapon-empty')tone(310,.12,'triangle',.045,180);
    else if(kind==='loot-cell'){tone(470,.1,'triangle',.05,700);tone(940,.1,'sine',.035,null,.04);}
    else if(kind==='loot-data'){tone(980,.09,'sine',.05,1280);tone(1470,.12,'sine',.04,null,.05);}
    else if(kind==='loot-relic'){tone(620,.19,'triangle',.055,940);tone(1240,.2,'sine',.04,1880,.07);}
    else if(kind==='coin')tone(760+(value%4)*100,.09,'sine',.045,620+(value%4)*100);
    else if(kind==='heal'){tone(540,.16,'sine',.08);tone(810,.22,'sine',.07,null,.075);}
    else if(kind==='gear'){tone(610,.12,'triangle',.075);tone(960,.16,'sine',.065,null,.06);}
    else if(kind==='board'){tone(220,.26,'triangle',.13,580);tone(880,.14,'sine',.06,null,.14);}
    else if(kind==='hit'){tone(185,.22,'sine',.2,65);this.noiseBurst(t,.12,.24,1400,250,this.effects);}
    else if(kind==='hull-hit'){tone(290,.16,'triangle',.17,95);tone(920,.09,'sine',.055,320,.025);}
    else if(kind==='impact')this.noiseBurst(t,.045,.11,2600,1200,this.effects);
    else if(kind==='portal-warning'){tone(380,.13,'sine',.06,570);tone(570,.14,'sine',.045,null,.13);}
    else if(kind==='missile-warning'){tone(820,.09,'sine',.06);tone(820,.09,'sine',.06,null,.16);}
    else if(kind==='normal')tone(490,.18,'sine',.055,310);
    else if(kind==='death'){tone(196,.4,'triangle',.2,65);tone(130,.3,'sine',.11,48,.07);}
    else if(kind==='start'){tone(330,.14,'sine',.07);tone(495,.17,'triangle',.07,null,.06);}
    else tone(660,.14,'sine',.065,820);
    return true;
  }
  stopEffects() {
    if(!this.context)return;const t=this.context.currentTime;
    for(const voice of this.voices)if(!voice.music){try{voice.gain.gain.cancelAndHoldAtTime(t);voice.gain.gain.linearRampToValueAtTime(0,t+.015);voice.source.stop(t+.02);}catch{}}
  }
  hat(at,destination=this.music,level=1) {
    const c = this.context, source = c.createBufferSource(), gain = c.createGain(), filter = c.createBiquadFilter(), smooth = c.createBiquadFilter();
    gain.gain.value=0;
    source.buffer = this.noise; filter.type = 'highpass'; filter.frequency.value = 5500; filter.Q.value=.5;
    smooth.type='lowpass'; smooth.frequency.value=9500; smooth.Q.value=.5;
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.028*level,at+.004); gain.gain.exponentialRampToValueAtTime(.0001, at + .06);
    source.connect(filter).connect(smooth).connect(gain).connect(destination);
    const voice = { source, gain, music: true }; this.voices.add(voice);
    source.onended = () => { source.disconnect(); filter.disconnect(); smooth.disconnect(); gain.disconnect(); this.voices.delete(voice); };
    source.start(at); source.stop(at + .065);
  }
  startMusic() {
    if (this.timer || !this.running || this.mode === 'paused') return;
    this.nextNote = this.context.currentTime + .035;
    const schedule = () => {
      if (!this.running || this.mode === 'paused') return;
      const now = this.context.currentTime;
      if (this.nextNote < now - .2) this.nextNote = now + .035;
      while (this.nextNote < now + .18) {
        this.musicStep(this.step % 64,this.nextNote);
        this.nextNote += 60 / 126 / 2; this.step++;
      }
    };
    schedule(); this.timer = setInterval(schedule, 40);
  }
  musicStep(step,at) {
    const p=THEMES[this.realm],root=ROOTS[Math.floor(step/8)%ROOTS.length]+p.shift,note=p.riff[step%8],dest=this.themeBuses[this.realm];
    if(note!==null)this.tone(midi(root+note),this.realm==='machine'?.1:.15,p.lead,p.leadGain,at,dest);
    if(step%(this.realm==='void'?4:2)===0)this.tone(midi(root-12),this.realm==='organic'?.25:.19,p.bass,p.bassGain,at,dest);
    if(step%4===0)this.tone(this.realm==='organic'?115:145,.13,'sine',p.kick,at,dest,46);
    if(step%2===1&&(this.realm!=='void'||step%4===3))this.hat(at,dest,p.hat);
    if(this.realm==='machine'&&step%8===6)this.tone(midi(root+24),.045,'sine',.035,at,dest);
    if(this.realm==='organic'&&step%8===0){this.tone(midi(root+12),.65,'sine',.035,at,dest);this.tone(midi(root+19),.6,'sine',.025,at,dest);}
    if(this.realm==='void'&&step%8===0){this.tone(midi(root+24),.7,'sine',.04,at,dest);this.tone(midi(root+31),.7,'sine',.025,at+.15,dest);}
    if(this.realm==='aquarium'&&step%8===2)this.tone(midi(root+31),.45,'sine',.035,at,dest);
    if(this.realm==='scrapyard'&&step%8===6)this.tone(midi(root+19),.12,'triangle',.04,at,dest, midi(root+12));
  }
  stopMusic() {
    clearInterval(this.timer); this.timer = null;
    if(!this.context)return;
    const t=this.context.currentTime;
    for (const voice of this.voices) if (voice.music) {
      try {voice.gain.gain.cancelAndHoldAtTime(t);voice.gain.gain.linearRampToValueAtTime(0,t+.015);voice.source.stop(t+.02);} catch {}
    }
  }
}
