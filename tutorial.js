import {Run} from './engine.js';

/** Ordered, replayable lessons; copy is translated by the native tutorial view. */
export const LESSONS=Object.freeze([
  {id:'controls',title:'Take your time.',body:'This is a safe practice flight, with no scores. You can leave at any time.',detail:'Highlighted: sound, pause and fullscreen (when available). Use pause for a break.',target:'.hud-actions'},
  {id:'stats',title:'Your shift, at a glance.',body:'Meters show your distance. The three small bars are your health.',detail:'Collect Stillmatter to lower Time debt. A fuller meter makes the world move faster.',target:'.distance,.salvage'},
  {id:'rise',title:'Hold to rise.',body:'Hold Fly or an empty part of the game screen to rise. Keep holding; you do not need repeated taps.',detail:'Keyboard: hold Space. Mouse: hold the button on the game.',hint:'Keep holding to rise a little.',action:true,target:'.thumb-deck'},
  {id:'fall',title:'Let go to fall.',body:'Hold briefly again, then release your finger, mouse button or Space. Gravity brings you down.',detail:'Alternate holding and releasing to choose your height. You do not need to tap constantly.',hint:'Hold briefly, then let go to fall.',action:true,target:'.thumb-deck'},
  {id:'collect',title:'Good things are safe.',body:'Fly through gold to collect it. Each new press also fires one shot; holding does not repeat shots.',detail:'Shooting is safe: loot, repairs, weapons, shuttles and portals cannot be damaged.',hint:'Fly through three pieces of gold. Shooting them is safe.',action:true},
  {id:'avoid',title:'Avoid the wall.',body:'Hold to fly above this wall, then release when clear.',detail:'Many hazards can be shot. Fly around this wall. A practice bump just lets you retry.',hint:'Hold to fly above the bulkhead.',action:true},
  {id:'equipment',title:'Borrowed equipment.',body:'Fly into weapons, repair packets or a shuttle to collect them.',detail:'Shuttle hull bars protect you first. Special weapons have limited shots; your rifle returns when they run out.',target:'.vitals,#gear-status'},
  {id:'portal',title:'Portals are optional.',body:'Portals change the place. Upper half: low gravity. Lower half: double Stillmatter. Both last ten seconds.',detail:'Fly outside the opening to stay here. Pause to read the destination.'},
  {id:'done',title:'Ready when you are.',body:'Hold to rise. Release to fall. Fly through the good things and give hazards some room.',detail:'Play starts a normal shift. Back repeats a lesson. The Tutorial button always lets you practise again.'}
]);

/** An ephemeral authored flight: ordinary physics, no random population or saved progress. */
export class FlightTutorial {
  constructor(width,difficulty='regular') {
    this.width=width;this.difficulty=difficulty;this.index=0;this.phase='explain';
    this.prepare();
  }
  get lesson(){return LESSONS[this.index];}
  get practicing(){return this.phase==='practice';}
  get suspended(){return this.phase==='suspended';}
  /** Build only the current lesson's bounded scene; retries do not inherit damage or pressure. */
  prepare() {
    this.width=this.run?.width??this.width;
    this.run=new Run(this.width,Math.random,this.difficulty);
    this.phase='explain';this.baseline=430;this.sawHold=false;
    this.run.player.y=430;
    if(this.lesson.id==='fall')this.run.player.y=this.baseline=300;
    if(this.lesson.id==='collect') {this.run.entropy=30;this.placeCoins();}
    if(this.lesson.id==='avoid')this.run.obstacles=[{type:'crusher',x:this.run.player.x+Math.min(280,this.width-this.run.player.x-40),y:476,baseY:476,w:58,h:150,age:0,phase:0}];
    if(this.lesson.id==='equipment') {
      this.run.vehicle={hull:3};
      this.run.gear={x:this.run.player.x+100,y:430,kind:'beam'};
      this.run.medkit={x:this.run.player.x+175,y:430};
    }
    if(this.lesson.id==='portal')this.run.portal={x:this.run.player.x+120,y:420,realm:'aquarium',passed:false};
  }
  /** Keep a small reachable trail available even when a learner misses every piece. */
  placeCoins() {
    this.run.coins=Array.from({length:3},(_,i)=>({x:this.run.player.x+110+i*38,y:430,phase:i*.4,kind:'salvage'}));
  }
  /** Explicit native Next starts practice or advances a reading-only lesson. */
  next() {
    if(this.practicing)return;
    if(this.suspended){this.phase='practice';return;}
    if(this.lesson.action){if(this.phase==='retry')this.prepare();this.phase='practice';this.baseline=this.run.player.y;}
    else this.skip();
  }
  /** Skip is always available; completion remains a separate explicit Play action. */
  skip(){if(this.index<LESSONS.length-1){this.index++;this.prepare();}}
  /** Replay the previous lesson, including its original explanation and safe scene. */
  back(){if(this.index>0){this.index--;this.prepare();}}
  /** Lifecycle/rotation pauses require an explicit Resume practice action. */
  suspend(){if(this.practicing)this.phase='suspended';}
  /** Inspect actual simulation results, then freeze before another step can move the world. */
  observe(held) {
    if(!this.practicing)return false;
    const r=this.run,id=this.lesson.id;
    if(id==='fall'&&held){this.sawHold=true;this.baseline=r.player.y;}
    if(r.events.some(event=>event.type==='hit')){this.phase='retry';return true;}
    const success=id==='rise'?held&&r.player.y<=this.baseline-55:
      id==='fall'?this.sawHold&&!held&&r.player.y>=this.baseline+55:
      id==='collect'?r.collectedSalvage>=3:
      r.obstacles[0].x<r.player.x-65;
    if(success){this.skip();return true;}
    if(id==='collect'&&!r.coins.length)this.placeCoins();
    return false;
  }
}
