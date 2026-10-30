import {Run} from './engine.js';
import {makeCreature} from './creatures.js';

/** Player-paced explanations followed by the actual steering and aiming skills. */
export const LESSONS=Object.freeze([
  {id:'controls',title:'Take your time.',body:'This is a practice flight with no score to lose. You can leave or repeat a step whenever you like.',detail:'The highlighted buttons control sound, pause and fullscreen when available.',target:'.hud-actions'},
  {id:'stats',title:'Your shift, at a glance.',body:'Stay alive and fly as far as you can. Meters show your distance; the three small bars are your health.',detail:'Collect Stillmatter to lower Time debt. As that meter fills, the world speeds up.',target:'.distance,.salvage'},
  {id:'steer',title:'Find your rhythm.',body:'Press Fly, the game screen or Space to rise. Release to sink.',detail:'Alternate presses and releases to stay in the marked band. Keep holding and you will reach the ceiling.',hint:'Stay in the marked band by pressing and releasing.',action:true,target:'.thumb-deck'},
  {id:'aim',title:'Your height is your aim.',body:'Your shots travel straight ahead from your height. Line up with the marked enemy.',detail:'A new press fires a shot. To keep firing, release and press again; that rhythm also controls your height.',hint:'Hit both targets. Adjust your height and press again to fire.',retry:'Line up with the target, then press again to shoot. You can try as often as you like.',action:true},
  {id:'collect',title:'Collect as you fly.',body:'Fly through the gold Stillmatter to collect it. Use your press-and-release rhythm to follow the trail.',detail:'Your shots cannot damage loot, repair packets, weapons, shuttles or portals. There is no need to stop shooting near them.',hint:'Follow the gold trail. Shooting will not damage it.',action:true},
  {id:'avoid',title:'Avoid the wall.',body:'Climb above this wall, then release and adjust your height again. You do not have to stay at the ceiling.',detail:'Your rifle cannot break this wall, so steer around it. A practice collision simply lets you retry.',hint:'Fly above the wall, then return to the marked band.',retry:'Climb a little earlier, then use presses and releases to come back down.',action:true},
  {id:'equipment',title:'Borrowed equipment.',body:'A hit can knock away your rifle. Fly into another weapon to rearm, or into repairs and shuttles to collect them.',detail:'Shuttle hull protects you first, with the same controls. Empty specials switch back to the rifle or shuttle emitter.',target:'.vitals,#gear-status'},
  {id:'portal',title:'Portals are optional.',body:'Fly through a portal to change location. Upper half: low gravity. Lower half: double Stillmatter. Each bonus lasts ten seconds.',detail:'Fly above or below the opening to stay here. Pause near a portal to read its destination.'},
  {id:'done',title:'Ready when you are.',body:'Use presses and releases to choose your height. Line up your shots, collect Stillmatter and make room for hazards.',detail:'Play starts a normal shift. Back repeats a lesson. You can open the tutorial from the start or pause menu.'}
]);

/** A separate authored flight. Only normal simulation results can complete a skill. */
export class FlightTutorial {
  constructor(width,difficulty='regular') {
    this.width=width;this.difficulty=difficulty;this.index=0;
    this.prepare();
  }
  get lesson(){return LESSONS[this.index];}
  get practicing(){return this.phase==='practice';}
  get suspended(){return this.phase==='suspended';}
  /** Retry at the current viewport width, with no inherited damage or assistance flags. */
  prepare(targetsHit=0) {
    this.width=this.run?.width??this.width;
    this.run=new Run(this.width,Math.random,this.difficulty);
    this.phase='explain';this.previousHeld=false;this.presses=0;this.releases=0;
    this.steadyTime=0;this.targetsHit=targetsHit;this.clearedWall=false;
    this.run.player.y=430;
    if(this.lesson.id==='aim')this.placeTarget();
    if(this.lesson.id==='collect'){this.run.entropy=30;this.placeCoins();}
    if(this.lesson.id==='avoid')this.run.obstacles=[{type:'crusher',x:this.run.player.x+Math.min(280,this.width-this.run.player.x-40),y:476,baseY:476,w:58,h:150,age:0,phase:0}];
    if(this.lesson.id==='equipment') {
      this.run.vehicle={hull:3};
      this.run.gear={x:this.run.player.x+100,y:430,kind:'beam'};
      this.run.medkit={x:this.run.player.x+175,y:430};
    }
    if(this.lesson.id==='portal')this.run.portal={x:this.run.player.x+120,y:420,realm:'aquarium',passed:false};
  }
  /** A wide middle/lower band leaves the ordinary ceiling and floor outside the goal. */
  get band(){return {y:380,halfHeight:50};}
  /** Progress reports a sustained flight skill or real projectile kills, never elapsed waiting. */
  get progress(){return this.lesson.id==='aim'?this.targetsHit/2:Math.min(1,this.steadyTime/(this.lesson.id==='avoid'?.6:1.2));}
  /** Use separated hit windows: neither enemy movement nor projectile radius can make one firing height hit both. */
  placeTarget() {
    const target=makeCreature('mimic',this.run.width-45,()=>.5,this.run.player.y);
    target.y=target.baseY=this.targetsHit===0?335:455;
    this.run.obstacles=[target];
  }
  /** Keep missed loot bounded and reachable without changing collection or shooting rules. */
  placeCoins() {
    this.run.coins=Array.from({length:3},(_,i)=>({x:this.run.player.x+110+i*38,y:430,phase:i*.4,kind:'salvage'}));
  }
  /** Only explicit Next/Resume begins practice; repeated or hidden actions cannot advance it. */
  next() {
    if(this.practicing)return;
    if(this.suspended){this.phase='practice';return;}
    if(this.lesson.action){if(this.phase==='retry')this.prepare(this.targetsHit);this.phase='practice';}
    else this.skip();
  }
  /** Skip remains available, without claiming that a skill was demonstrated. */
  skip(){if(this.index<LESSONS.length-1){this.index++;this.prepare();}}
  /** Back recreates the previous lesson and its explanation. */
  back(){if(this.index>0){this.index--;this.prepare();}}
  /** Interruptions release input; suspended time cannot count toward stable flight. */
  suspend(){if(this.practicing){this.phase='suspended';this.steadyTime=0;this.previousHeld=false;}}
  /** Inspect each real 120 Hz step; a constant hold, idle waiting or body collision cannot pass aiming. */
  observe(held,dt=1/120) {
    if(!this.practicing)return false;
    const r=this.run,id=this.lesson.id;
    if(held&&!this.previousHeld)this.presses++;
    if(!held&&this.previousHeld)this.releases++;
    this.previousHeld=held;
    if(r.events.some(event=>event.type==='hit')){this.phase='retry';return true;}
    const inBand=Math.abs(r.player.y-this.band.y)<=this.band.halfHeight;
    this.steadyTime=inBand?this.steadyTime+dt:0;
    if(id==='aim') {
      this.targetsHit+=r.events.filter(event=>event.type==='destroy'&&event.weapon==='ion').length;
      if(this.targetsHit<2&&(!r.obstacles.length||r.obstacles[0].x<r.player.x-70))this.placeTarget();
    }
    if(id==='avoid'&&r.obstacles[0]?.x<r.player.x-65)this.clearedWall=true;
    const success=id==='steer'?this.steadyTime>=1.2&&this.presses>=2&&this.releases>=2:
      id==='aim'?this.targetsHit>=2:id==='collect'?r.collectedSalvage>=3:
      this.clearedWall&&this.steadyTime>=.6;
    if(success){this.skip();return true;}
    if(id==='collect'&&!r.coins.length)this.placeCoins();
    return false;
  }
}
