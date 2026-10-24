import {Run, REALMS, MAX_HEALTH, SHUTTLE_HULL} from './engine.js';
import {WEAPONS} from './arsenal.js';
import {CREATURES} from './creatures.js';
import {isDifficulty} from './difficulty.js';

const KEY='exp3ndable.active-run', VERSION=1, MAX_BYTES=250_000;
const omitted=new Set(['rng','profile','events']);
const weapons=Object.keys(WEAPONS).filter(kind=>kind!=='shuttle');
const creatures=Object.keys(CREATURES), fixtures=['laser','horizontal','spinner','missile','crusher','pendulum'];
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const number=value=>typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1e12;
const validWidth=value=>number(value)&&value>=400&&value<=100_000;
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const oneOf=(value,choices)=>choices.includes(value);
const list=(value,max,valid)=>Array.isArray(value)&&value.length<=max&&value.every(valid);

/** Validate entity fields before any simulation, drawing or property assignment. */
function body(value,required,optional=[],flags=[],labels={},extra=[]) {
  if(!object(value))return false;
  const allowed=new Set([...required,...optional,...flags,...Object.keys(labels),...extra]);
  return Object.keys(value).every(key=>allowed.has(key))&&required.every(key=>number(value[key]))&&
    optional.every(key=>value[key]===undefined||number(value[key]))&&
    flags.every(key=>value[key]===undefined||typeof value[key]==='boolean')&&
    Object.entries(labels).every(([key,choices])=>oneOf(value[key],choices));
}
function obstacle(value) {
  if(!object(value)||!oneOf(value.type,[...fixtures,...creatures]))return false;
  if(value.type==='pendulum')return body(value,['x','y','age','l1','l2','a1','a2','v1','v2','hp','warning'],[],['spent'],{type:['pendulum']})&&value.l1>0&&value.l2>0;
  const required=['x','y','age','w','h'];
  if(creatures.includes(value.type))required.push('baseY','hp','maxHp','phase','variant','targetY','drift');
  if(value.type==='spinner')required.push('angle');
  if(value.type==='missile')required.push('warning');
  return body(value,required,['baseY','phase','hp','angle','warning'],['spent','paired'],{type:[...fixtures,...creatures]})&&value.w>0&&value.h>0;
}

/** Validate a complete schema; constructor fields define the versioned root contract. */
function validState(state,template) {
  if(!object(state))return false;
  const keys=Object.keys(template).filter(key=>!omitted.has(key));
  if(Object.keys(state).length!==keys.length||!keys.every(key=>Object.hasOwn(state,key)))return false;
  for(const key of keys) {
    const initial=template[key],value=state[key];
    if(typeof initial==='number'&&!(key==='nextAidAt'&&value===null)&&!number(value))return false;
    if(typeof initial==='boolean'&&typeof value!=='boolean')return false;
  }
  if(!body(state.player,['x','y','vy','radius'])||state.player.radius<=0)return false;
  if(!state.alive||!integer(state.health,1,MAX_HEALTH)||!integer(state.salvage,0,1e12)||
    !integer(state.collectedSalvage,0,1e12)||!integer(state.nextCheerAt,50,1e12)||
    !validWidth(state.width)||state.distance<0||state.elapsed<0||state.scroll<0||
    state.entropy<0||state.entropy>100||state.speedMultiplier<1||state.speedMultiplier>2.401||
    state.timeHold<0||state.invulnerable<0||state.fireCooldown<0)return false;
  if(!isDifficulty(state.difficulty)||!oneOf(state.realm,REALMS)||!oneOf(state.creatureRealm,REALMS)||
    !oneOf(state.shipRoom,['crew','canteen','lab'])||!oneOf(state.reality,[null,'low','double'])||
    !oneOf(state.weapon,[null,...weapons])||!oneOf(state.nextOddity,['moon','tape'])||
    !oneOf(state.lastCreature,[null,...creatures])||!oneOf(state.lastEncounter,[null,'creature','fixture','wall']))return false;
  const supply=state.weapon&&WEAPONS[state.weapon].ammo;
  if(supply? !integer(state.ammo,1,supply):state.ammo!==null)return false;
  if(!integer(state.lastCoinPattern,-1,11)||!integer(state.gearOffers,0,1e12)||!integer(state.creatureEncounters,0,1e12))return false;
  if(!list(state.coinBag,12,value=>integer(value,0,11))||!list(state.weaponBag,3,value=>oneOf(value,['torpedo','beam','fork']))||
    !list(state.creatureBag,4,value=>oneOf(value,creatures))||!list(state.encounterBag,6,value=>oneOf(value,['creature','fixture','wall'])))return false;
  if(!list(state.obstacles,128,obstacle)||!list(state.coins,256,value=>body(value,['x','y'],['phase'],['taken'],{kind:['salvage','cell','data','relic']})))return false;
  if(!list(state.shots,256,value=>body(value,['x','y','vy','age'],[],['spent','upgraded'],{kind:['ion','shuttle','torpedo','moon']},['hits'])&&
    list(value.hits,8,index=>integer(index,-1,state.obstacles.length-1))))return false;
  if(!list(state.attacks,16,value=>body(value,['x','y','originX'],[],['upgraded'],{kind:['beam','fork','tape']})))return false;
  if(state.portal!==null&&!body(state.portal,['x','y'],[],['passed'],{realm:REALMS}))return false;
  if(state.gear!==null&&!body(state.gear,['x','y'],['age'],[],{kind:weapons}))return false;
  if(state.medkit!==null&&!body(state.medkit,['x','y']))return false;
  if(state.vehiclePickup!==null&&!body(state.vehiclePickup,['x','y']))return false;
  return state.vehicle===null||(body(state.vehicle,['hull'])&&integer(state.vehicle.hull,1,SHUTTLE_HULL));
}

/** Serialize simulation state only; pending events and audiovisual tails never replay. */
export function encodeRun(run) {
  const state=Object.fromEntries(Object.entries(run).filter(([key])=>!omitted.has(key)));
  // JSON has no Infinity. Only the dormant medical schedule uses this sentinel.
  state.nextAidAt=run.nextAidAt===Infinity?null:run.nextAidAt;
  // Moon hits reference live obstacles; -1 retains already-removed bite history.
  state.shots=run.shots.map(shot=>({...shot,hits:[...shot.hits].map(hit=>run.obstacles.indexOf(hit))}));
  return JSON.stringify({version:VERSION,state});
}

/** Restore an isolated paused candidate, resizing relative distances without advancing time. */
export function restoreRun(saved,width,rng=Math.random) {
  try {
    if(typeof saved!=='string'||saved.length>MAX_BYTES||!validWidth(width))return null;
    const data=JSON.parse(saved),template=new Run(400,rng);
    if(!object(data)||data.version!==VERSION||!validState(data.state,template))return null;
    const run=new Run(data.state.width,rng,data.state.difficulty);
    for(const key of Object.keys(data.state))run[key]=data.state[key];
    run.nextAidAt=run.nextAidAt===null?Infinity:run.nextAidAt;
    for(const shot of run.shots)shot.hits=new Set(shot.hits.map(index=>index<0?{}:run.obstacles[index]));
    run.resize(width);
    return run;
  } catch {return null;}
}

/** Store one active run separately from permanent records; denied/full storage stays playable. */
export class RunCheckpoint {
  constructor(storage){this.storage=storage;}
  /** Read once on startup; discard corrupt/incompatible data without touching pilot records. */
  load(width) {
    // Invalid layout is not evidence that the stored simulation is corrupt.
    if(!validWidth(width))return null;
    try {
      const saved=this.storage?.getItem(KEY);
      if(!saved)return null;
      const run=restoreRun(saved,width);
      if(!run)this.clear();
      return run;
    } catch {return null;}
  }
  /** Write at lifecycle boundaries and a bounded flight cadence, never every frame. */
  save(run) {
    try {
      if(!run.alive){this.clear();return false;}
      const saved=encodeRun(run);
      if(saved.length>MAX_BYTES)return false;
      this.storage.setItem(KEY,saved);
      return true;
    } catch {return false;}
  }
  /** Death or deliberate abandonment must not resurrect an older checkpoint. */
  clear(){try{this.storage.removeItem(KEY);return true;}catch{return false;}}
}
