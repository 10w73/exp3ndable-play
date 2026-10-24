import {WEAPONS, REGULAR_WEAPONS} from './arsenal.js';
import {CREATURES, CREATURE_ROSTERS, isCreature, makeCreature, moveCreature} from './creatures.js';
import {DIFFICULTIES,isDifficulty} from './difficulty.js';

export const HEIGHT = 600;
export const CEILING = 105;
export const FLOOR = 541;
export const MAX_HEALTH = 3;
export const RECOVERY_SECONDS = 1.8;
export const SHUTTLE_HULL = 3;
export const PORTAL_RADIUS_Y = 72;
export const REALMS = Object.freeze(['ship','machine','organic','void','aquarium','scrapyard']);
export const WORLD_GRAVITY=Object.freeze({ship:1,machine:1.1,organic:.9,void:.76,aquarium:.82,scrapyard:1.16});
export const LOOT=Object.freeze({salvage:{value:1,color:'#e6b65f'},cell:{value:2,color:'#b7ce8c'},data:{value:3,color:'#8dc8ce'},relic:{value:5,color:'#bea0d0'}});
const SHIP_ROOMS = ['crew','canteen','lab'];
// Projectiles only damage these hazards. Collectibles and portals are separate
// entities, and future object types are safe unless deliberately added here.
const SHOOTABLE = new Set(['laser','horizontal','spinner','missile','pendulum',...Object.keys(CREATURES)]);

export function sectorId(run) {
  return run?.realm && run.realm !== 'ship' ? run.realm : run?.shipRoom ?? 'crew';
}

export function circleRect(px, py, radius, box) {
  const x = Math.max(box.x - box.w / 2, Math.min(px, box.x + box.w / 2));
  const y = Math.max(box.y - box.h / 2, Math.min(py, box.y + box.h / 2));
  return (px - x) ** 2 + (py - y) ** 2 < radius ** 2;
}

export function circleSegment(x,y,r,a,b) {
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/length)):0;
  return (x-a.x-t*dx)**2+(y-a.y-t*dy)**2<r*r;
}
export function pendulumPoints(o) {
  const pivot={x:o.x,y:o.y},joint={x:o.x+Math.sin(o.a1)*o.l1,y:o.y+Math.cos(o.a1)*o.l1};
  return [pivot,joint,{x:joint.x+Math.sin(o.a2)*o.l2,y:joint.y+Math.cos(o.a2)*o.l2}];
}
export function makePendulum(x,y,rng=Math.random) {
  return {type:'pendulum',x,y,l1:64,l2:62,a1:1.5+rng()*.5,a2:-1-rng(),v1:.2,v2:.6,hp:4,warning:.95,age:0};
}
function swing(o,dt) {
  // Equal-mass double-pendulum equations. Small substeps and mild damping keep
  // the coupled motion stable; angular speed is capped for a readable hazard.
  const count=Math.ceil(dt*240),h=dt/count,g=240;
  for(let i=0;i<count;i++) {
    const d=o.a1-o.a2,s=Math.sin(d),co=Math.cos(d),den=3-Math.cos(2*d);
    const a=(-3*g*Math.sin(o.a1)-g*Math.sin(o.a1-2*o.a2)-2*s*(o.v2**2*o.l2+o.v1**2*o.l1*co))/(o.l1*den);
    const b=2*s*(2*o.v1**2*o.l1+2*g*Math.cos(o.a1)+o.v2**2*o.l2*co)/(o.l2*den);
    o.v1=Math.max(-4.5,Math.min(4.5,(o.v1+a*h)*Math.exp(-.02*h)));
    o.v2=Math.max(-4.5,Math.min(4.5,(o.v2+b*h)*Math.exp(-.02*h)));
    o.a1+=o.v1*h;o.a2+=o.v2*h;
  }
}
function hazardTouches(o,x,y,radius) {
  if(o.type==='pendulum') {const [a,b,c]=pendulumPoints(o);return circleSegment(x,y,radius+5,a,b)||circleSegment(x,y,radius+5,b,c);}
  if(o.type==='spinner') {const dx=x-o.x,dy=y-o.y;return circleRect(dx*Math.cos(o.angle)+dy*Math.sin(o.angle),-dx*Math.sin(o.angle)+dy*Math.cos(o.angle),radius,{x:0,y:0,w:o.w,h:o.h});}
  return circleRect(x,y,radius,o);
}

export class Run {
  constructor(width, rng = Math.random, difficulty = 'regular') {
    this.width = width;
    this.rng = rng;
    this.difficulty=isDifficulty(difficulty)?difficulty:'regular';
    this.profile=DIFFICULTIES[this.difficulty];
    this.player = { x: Math.min(215, Math.max(85, width * .18)), y: 325, vy: 0, radius: 16 };
    this.distance = 0; this.salvage = 0; this.elapsed = 0; this.scroll = 0;
    this.entropy=0;this.speedMultiplier=1;this.timeHold=0;
    this.collectedSalvage=0;this.nextCheerAt=50;
    this.alive = true; this.health = MAX_HEALTH; this.invulnerable = 0;
    this.obstacles = []; this.coins = []; this.events = [];
    this.lastCoinPattern = -1; this.coinBag=[]; this.weapon = 'ion'; this.ammo = null; this.shots = []; this.attacks = []; this.weaponBag = []; this.gearOffers=0;this.nextOddity='moon'; this.fireCooldown = 0; this.gear = null; this.nextGearAt = 90;
    this.spawnIn = 1.8; this.coinIn = .8; this.nextPortal = 260;
    this.portal = null; this.reality = null; this.realityTime = 0;
    this.realm='ship';this.shipRoom='crew';
    this.creatureBag=[];this.creatureRealm='ship';this.lastCreature=null;this.creatureEncounters=0;
    this.encounterBag=[];this.lastEncounter=null;this.nextWallFloor=true;
    this.medkit=null;this.nextAidAt=Infinity;
    this.vehicle=null;this.vehiclePickup=null;this.nextVehicleAt=150;this.lastPendulumAt=-1000;
  }
  resize(width) {
    const previousX=this.player.x;
    this.width=width;this.player.x=Math.min(215,Math.max(85,width*.18));
    const offset=this.player.x-previousX;
    for(const item of [...this.obstacles,...this.coins,...this.shots,...this.attacks,this.portal,this.gear,this.medkit,this.vehiclePickup].filter(Boolean)) {
      item.x+=offset;if(item.originX!==undefined)item.originX+=offset;
    }
  }
  get gravity(){return (WORLD_GRAVITY[this.realm]??1)*(this.reality==='low'?410/750:1);}
  get speed() {
    const base=Math.min(290,Math.max(185,this.width*.24));
    // Stillmatter controls time debt; both cruise drift and pressure stay bounded.
    return base*this.speedMultiplier;
  }
  get approachClear(){return this.obstacles.every(o=>o.spent||o.x+(o.type==='pendulum'?o.l1+o.l2:Math.max(o.w??0,o.h??0)/2)<this.player.x-70);}
  spawnMedkit() {
    this.medkit={x:this.width+55,y:Math.max(185,Math.min(465,this.player.y+(this.rng()-.5)*70))};
    // A recovery lane, with time to reach the packet before hazards resume.
    this.spawnIn=Math.max(this.spawnIn,(this.medkit.x-this.player.x)/this.speed+1.4);
  }
  spawnVehicle() {
    this.vehiclePickup={x:this.width+85,y:Math.max(200,Math.min(440,this.player.y-45))};
    this.spawnIn=Math.max(this.spawnIn,(this.vehiclePickup.x-this.player.x)/this.speed+1.5);
  }
  chooseCreature() {
    if(this.creatureRealm!==this.realm){this.creatureBag=[];this.creatureRealm=this.realm;}
    if(!this.creatureBag.length) {
      this.creatureBag=[...CREATURE_ROSTERS[this.realm]];
      for(let i=this.creatureBag.length-1;i>0;i--){const j=Math.floor(this.rng()*(i+1));[this.creatureBag[i],this.creatureBag[j]]=[this.creatureBag[j],this.creatureBag[i]];}
      const last=this.creatureBag.length-1;
      if(this.creatureBag[last]===this.lastCreature)[this.creatureBag[0],this.creatureBag[last]]=[this.creatureBag[last],this.creatureBag[0]];
    }
    this.lastCreature=this.creatureBag.pop();return this.lastCreature;
  }
  spawnObstacle() {
    // Keep the creature majority, but prevent long lotteries without a wall.
    if(!this.encounterBag.length) {
      this.encounterBag=['creature','creature','creature','creature','fixture','wall'];
      for(let i=this.encounterBag.length-1;i>0;i--) {
        const j=Math.floor(this.rng()*(i+1));
        [this.encounterBag[i],this.encounterBag[j]]=[this.encounterBag[j],this.encounterBag[i]];
      }
      const last=this.encounterBag.length-1;
      if(this.lastEncounter==='wall'&&this.encounterBag[last]==='wall') {
        [this.encounterBag[0],this.encounterBag[last]]=[this.encounterBag[last],this.encounterBag[0]];
      }
    }
    const encounter=this.encounterBag.pop();
    this.lastEncounter=encounter;
    if(encounter==='creature') {
      const type=this.chooseCreature(),item=makeCreature(type,this.width+90,this.rng,this.player.y);
      this.creatureEncounters++;
      if(this.elapsed>25&&this.creatureEncounters%4===0&&!['hopper','crab'].includes(type)) {
        item.paired=true;item.y=item.baseY=225;
        const partner=makeCreature(type,this.width+200,this.rng,this.player.y);
        partner.paired=true;partner.y=partner.baseY=425;partner.variant=(item.variant+1)%3;
        this.obstacles.push(partner);
      }
      this.obstacles.push(item);return item;
    }
    const types=this.distance<100?['laser','horizontal']:['laser','horizontal','spinner','missile'];
    const type=encounter==='wall'?'crusher':types[Math.floor(this.rng()*types.length)];
    if(this.distance>180 && this.distance-this.lastPendulumAt>220 && ['laser','spinner'].includes(type) && this.rng()<.35) {
      const item=makePendulum(this.width+165,255+this.rng()*45,this.rng);this.lastPendulumAt=this.distance;this.obstacles.push(item);return item;
    }
    let y = 165 + this.rng() * 305;
    const item = { type, x: this.width + 90, y, baseY: y, phase: this.rng() * Math.PI * 2, w: 24, h: 140, age: 0 };
    if (type === 'horizontal') { item.w = 113; item.h = 20; }
    if (type === 'crusher') {
      item.w = 58; item.h = 150; item.y = this.nextWallFloor ? FLOOR - 65 : CEILING + 65;
      this.nextWallFloor=!this.nextWallFloor;
    }
    if (type === 'spinner') { item.w = 130; item.h = 16; item.angle = item.phase; }
    if (type === 'missile') { item.w = 66; item.h = 24; item.baseY = Math.max(CEILING + 24, Math.min(FLOOR - 22, this.player.y)); item.y = item.baseY; item.warning = 1.25; this.events.push({type:'missile-warning'}); }
    this.obstacles.push(item);
    return item;
  }
  spawnCoins() {
    const patterns = [
      [[0,0],[38,-18],[76,-32],[114,-32],[152,-18],[190,0]],
      [[0,-24],[38,-12],[76,0],[114,12],[152,24],[190,12]],
      [[0,0],[40,0],[80,0],[120,0],[160,0],[200,0]],
      [[0,-30],[38,-15],[76,0],[114,15],[152,0],[190,-15]],
      [[0,0],[36,-16],[72,-24],[108,-16],[144,0],[180,16],[216,24]],
      [[0,30],[38,18],[76,6],[114,-6],[152,-18],[190,-30]],
      [[0,0],[36,-16],[72,-32],[108,-16],[144,0],[180,16],[216,32],[252,16]],
      [[0,0],[35,25],[70,0],[105,-25],[140,0],[175,25],[210,0]],
      [[0,-24],[36,0],[72,24],[108,0],[144,-24],[180,0],[216,24]],
      [[0,-30],[36,-15],[72,0],[108,15],[144,30],[180,15],[216,0]],
      [[0,0],[36,-18],[72,0],[108,18],[144,0],[180,-18],[216,0],[252,18]],
      [[0,-50],[32,-30],[64,-10],[96,10],[128,30],[160,50],[192,30],[224,10]]
    ];
    if(!this.coinBag.length) {
      this.coinBag=patterns.map((_,i)=>i);
      for(let i=this.coinBag.length-1;i>0;i--){const j=Math.floor(this.rng()*(i+1));[this.coinBag[i],this.coinBag[j]]=[this.coinBag[j],this.coinBag[i]];}
      const end=this.coinBag.length-1;
      if(this.coinBag[end]===this.lastCoinPattern)[this.coinBag[0],this.coinBag[end]]=[this.coinBag[end],this.coinBag[0]];
    }
    const pattern = this.coinBag.pop();
    this.lastCoinPattern = pattern;
    const y = 195 + this.rng() * 245;
    const valuable=Math.floor(this.rng()*patterns[pattern].length),roll=this.rng();
    const kind=roll<.5?'cell':roll<.88?'data':'relic';
    patterns[pattern].forEach(([dx,dy],i)=>this.coins.push({x:this.width+60+dx,y:y+dy,phase:i*.4,kind:i===valuable?kind:'salvage'}));
  }
  get firingWeapon() { return this.vehicle&&(!this.weapon||this.weapon==='ion')?'shuttle':this.weapon; }
  fire() {
    if(!this.alive || (!this.weapon&&!this.vehicle) || this.fireCooldown>0)return false;
    const kind=this.firingWeapon,weapon=WEAPONS[kind],upgraded=!!this.vehicle&&kind!=='shuttle';
    this.fireCooldown=weapon.cooldown;
    const x=this.player.x+(this.vehicle?54:35),y=this.player.y-9;
    if(['fork','tape','beam'].includes(kind))this.attacks.push({kind,x,y,upgraded,originX:this.player.x});
    else if(kind==='torpedo') {
      const count=upgraded?5:3;
      for(let i=0;i<count;i++)this.shots.push({x,y,kind,vy:(i-(count-1)/2)*(upgraded?85:105),hits:new Set(),age:0,upgraded});
    } else for(const offset of upgraded&&kind==='moon'?[-18,18]:[0]) {
      this.shots.push({x,y:y+offset,kind,vy:kind==='moon'?(offset<0?-140:120):0,hits:new Set(),age:0,upgraded});
    }
    if(kind!=='shuttle' && this.ammo!==null) {
      this.ammo--;
      if(this.ammo===0){
        this.weapon='ion';this.ammo=null;
        this.nextGearAt=Math.max(this.nextGearAt,this.distance+240);
      }
    }
    return true;
  }
  chooseWeapon() {
    this.gearOffers++;
    if(this.gearOffers%8===0){const kind=this.nextOddity;this.nextOddity=kind==='moon'?'tape':'moon';return kind;}
    let kind;
    do {
      if(!this.weaponBag.length) {
        this.weaponBag=[...REGULAR_WEAPONS];
        for(let i=this.weaponBag.length-1;i>0;i--) {
          const j=Math.floor(this.rng()*(i+1));
          [this.weaponBag[i],this.weaponBag[j]]=[this.weaponBag[j],this.weaponBag[i]];
        }
      }
      kind=this.weaponBag.pop();
    }while(kind===this.weapon);
    return kind;
  }
  breakOnContact(o){
    if(o.type==='crusher')return;
    o.spent=true;this.events.push({type:'destroy',x:o.x,y:o.y,hazard:o.type,weapon:'collision'});
  }
  damageHazard(o,damage,weapon) {
    o.hp=(o.hp??(['laser','horizontal','spinner','crusher'].includes(o.type)?4:1))-damage;
    if(o.hp<=0){o.spent=true;this.events.push({type:'destroy',x:o.x,y:o.y,hazard:o.type,weapon});}
  }
  resolveWeapons() {
    const targetable=o=>!o.spent && !(o.type==='missile'&&o.warning>0);
    for(const attack of this.attacks) {
      if(attack.kind==='tape'||attack.kind==='beam') {
        const beam=attack.kind==='beam',radius=beam?(attack.upgraded?30:18):(attack.upgraded?192:96);
        for(const o of this.obstacles)if(targetable(o)&&o.x>attack.originX&&o.x<this.width+35&&hazardTouches(o,o.x,attack.y,radius)) {
          this.damageHazard(o,beam?(attack.upgraded?5:3):Infinity,attack.kind);
        }
        this.events.push({type:beam?'beam':'stamp',x:attack.x,y:attack.y,width:this.width-attack.x,upgraded:attack.upgraded});
      } else {
        const points=[{x:attack.x,y:attack.y}],hit=new Set();
        for(let i=0;i<(attack.upgraded?5:WEAPONS.fork.links);i++) {
          const origin=points.at(-1);
          const choices=this.obstacles.filter(o=>targetable(o)&&SHOOTABLE.has(o.type)&&!hit.has(o)&&
            o.x>attack.originX&&o.x<Math.min(this.width+25,attack.x+(attack.upgraded?660:480))&&
            (i?Math.hypot(o.x-origin.x,o.y-origin.y)<190:Math.abs(o.y-origin.y)<(attack.upgraded?145:100)));
          choices.sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y));
          const o=choices[0];if(!o)break;
          hit.add(o);points.push({x:o.x,y:o.y});this.damageHazard(o,attack.upgraded?4:WEAPONS.fork.damage,'fork');
        }
        if(points.length===1)points.push({x:Math.min(this.width+10,attack.x+330),y:attack.y});
        this.events.push({type:'arc',points});
      }
    }
    this.attacks.length=0;
    for(const shot of this.shots) {
      const weapon=WEAPONS[shot.kind];
      for(const o of this.obstacles) {
        if(shot.spent||!targetable(o)||(!SHOOTABLE.has(o.type)&&shot.kind!=='moon'))continue;
        if((shot.kind==='moon'&&shot.hits.has(o))||!hazardTouches(o,shot.x,shot.y,weapon.radius*(shot.upgraded?1.25:1)))continue;
        if(shot.kind==='torpedo') {
          shot.spent=true;
          for(const other of this.obstacles)if(targetable(other)&&SHOOTABLE.has(other.type)&&hazardTouches(other,shot.x,shot.y,shot.upgraded?82:weapon.splash)) {
            this.damageHazard(other,shot.upgraded?3:weapon.damage,'torpedo');
          }
          this.events.push({type:'torpedo-burst',x:shot.x,y:shot.y});
        } else {
          this.damageHazard(o,weapon.damage*(shot.upgraded?1.5:1),shot.kind);
          if(shot.kind==='moon') {
            shot.hits.add(o);shot.spent=shot.hits.size>=(shot.upgraded?8:6);
            this.events.push({type:'moon-chomp',x:shot.x,y:shot.y});
          } else {shot.spent=true;this.events.push({type:'impact',x:shot.x,y:shot.y});}
        }
      }
    }
  }
  update(dt, held) {
    if (!this.alive) return;
    const previousY = this.player.y;
    this.elapsed += dt;
    const heldTime=Math.min(this.timeHold,dt);this.timeHold=Math.max(0,this.timeHold-dt);
    if(this.elapsed>8)this.entropy=Math.min(100,this.entropy+4*(dt-heldTime));
    const cruise=.3*(1-Math.exp(-Math.max(0,this.elapsed-12)/75));
    const targetPace=1+cruise+this.profile.pressureGain*(this.entropy/100)**1.1;
    this.speedMultiplier+=(targetPace-this.speedMultiplier)*(1-Math.exp(-dt/.9));
    const flightTime=dt*this.speedMultiplier;
    this.events.length = 0;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.fireCooldown = Math.max(0,this.fireCooldown-flightTime);
    const low = this.reality === 'low';
    const gravity=this.gravity,weight=this.vehicle?.87:1;
    const accel=750*gravity-(held?(low?1660:2600)*weight:0);
    const rise=(low?290:365)*(this.vehicle?.9:1),fall=(low?245:315)*Math.sqrt(WORLD_GRAVITY[this.realm]??1)*(this.vehicle?1.08:1);
    this.player.vy=Math.max(-rise,Math.min(fall,this.player.vy+accel*flightTime));
    this.player.y += this.player.vy * flightTime;
    const upper=CEILING+(this.vehicle?36:24),lower=FLOOR-(this.vehicle?26:22);
    if (this.player.y < upper) { this.player.y = upper; this.player.vy = Math.max(0, this.player.vy); }
    if (this.player.y > lower) { this.player.y = lower; this.player.vy = Math.min(0, this.player.vy); }
    const move = this.speed * dt;
    this.scroll += move; this.distance += move / 13;
    const aidDue=this.health<MAX_HEALTH&&!this.medkit&&!this.portal&&this.elapsed>=this.nextAidAt;
    const portalDue=this.distance>=this.nextPortal&&!this.portal;
    const vehicleDue=!this.vehicle&&!this.vehiclePickup&&!this.portal&&!this.medkit&&this.distance>=this.nextVehicleAt;
    const waiting=(aidDue||portalDue||vehicleDue)&&!this.approachClear;
    if(waiting)this.spawnIn=Math.max(this.spawnIn,.1);
    if(aidDue&&!waiting)this.spawnMedkit();
    if(this.medkit)this.medkit.x-=move;
    if(vehicleDue&&!waiting&&!this.medkit&&!portalDue)this.spawnVehicle();
    if(this.vehiclePickup)this.vehiclePickup.x-=move;
    if(this.ammo===null && !this.gear && !this.portal && !this.medkit && !this.vehiclePickup && this.distance>=this.nextGearAt) {
      this.gear={x:this.width+55,y:320,kind:this.chooseWeapon()};
      this.nextGearAt=this.distance+85;
    }
    if(this.gear) {
      this.gear.age=(this.gear.age??0)+flightTime;this.gear.x-=move;this.gear.y=320+Math.sin(this.elapsed*1.2)*75;
      if(this.gear.x < -45)this.gear=null;
    }
    if (this.realityTime > 0) {
      this.realityTime -= dt;
      if (this.realityTime <= 0) { this.reality = null; this.events.push({type:'normal'}); }
    }
    if(portalDue&&!waiting&&!this.medkit&&!this.vehiclePickup) {
      const realms=REALMS.filter(realm=>realm!==this.realm);
      this.portal = { x: this.width + 100, y:260+this.rng()*120, realm:realms[Math.floor(this.rng()*realms.length)], passed:false };
      this.nextPortal += 420;
      this.spawnIn = (this.width + 100 - this.player.x) / this.speed + 1.6;
      this.events.push({type:'portal-warning'});
    }
    if (this.portal) {
      const before = this.portal.x;
      this.portal.x -= move;
      if (move > 0 && !this.portal.passed && before >= this.player.x && this.portal.x <= this.player.x) {
        this.portal.passed = true;
        const fraction = (before-this.player.x)/move;
        const crossingY = previousY+(this.player.y-previousY)*fraction;
        if (Math.abs(crossingY-this.portal.y) <= PORTAL_RADIUS_Y) {
          this.reality = crossingY < this.portal.y ? 'low' : 'double'; this.realityTime = 10;
          // Worlds change at the portal crossing; only its physics/reward expires.
          this.realm=this.portal.realm;
          // Only the traveller and carried equipment cross. Projectiles, queued
          // attacks, hazards and uncollected objects belong to the world left behind.
          this.shots=[];this.attacks=[];this.obstacles=[];this.coins=[];
          this.gear=null;this.medkit=null;this.vehiclePickup=null;
          this.events.length=0;
          this.spawnIn=Math.max(this.spawnIn,1.6);this.coinIn=.35;
          if(this.realm==='ship')this.shipRoom=SHIP_ROOMS[(SHIP_ROOMS.indexOf(this.shipRoom)+1)%SHIP_ROOMS.length];
          this.events.push({type:'portal', reality:this.reality,realm:this.realm}); this.portal = null;
        }
      }
      if(this.portal && this.portal.x < -60)this.portal=null;
    }
    // Recompute protected approach time as the player stabilizes/slows the world.
    for(const [item,grace] of [[this.portal&&!this.portal.passed?this.portal:null,1.6],[this.medkit,1.4],[this.vehiclePickup,1.5]]) {
      if(item&&item.x>this.player.x)this.spawnIn=Math.max(this.spawnIn,(item.x-this.player.x)/this.speed+grace);
    }
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) { const spawned=this.spawnObstacle(); this.spawnIn = 2.25-.25*Math.min(1,this.elapsed/180)+this.rng()*.35+(spawned.type==='pendulum'?.7:spawned.paired?.55:0); }
    this.coinIn -= dt;
    if (this.coinIn <= 0) { this.spawnCoins(); this.coinIn = 2.25 + this.rng() * 1.3; }
    for (const o of this.obstacles) {
      o.age += flightTime;
      if (o.type === 'missile' && o.warning > 0) { o.warning -= dt; o.x = this.width + 80; continue; }
      o.x -= move * (o.type === 'missile' ? 1.65 : 1);
      if(isCreature(o.type))moveCreature(o,flightTime,move,CEILING,FLOOR);
      if (o.type === 'spinner') o.angle += flightTime * 1.4;
      if(o.type==='pendulum'){swing(o,flightTime);o.warning=Math.max(0,o.warning-dt);}
    }
    this.resolveWeapons();
    for(const o of this.obstacles) {
      if(o.type==='missile'&&o.warning>0)continue;
      if(o.spent)continue;
      const hit=!(o.type==='pendulum'&&o.warning>0) && (this.vehicle?[-24,0,24].some(dx=>hazardTouches(o,this.player.x+dx,this.player.y-4,20)):hazardTouches(o,this.player.x,this.player.y,this.player.radius));
      if (hit && this.invulnerable === 0) {
        if(this.vehicle) {
          this.vehicle.hull--;this.breakOnContact(o);this.invulnerable=RECOVERY_SECONDS;
          this.events.push({type:'vehicle-hit',hull:this.vehicle.hull,x:this.player.x,y:this.player.y});
          if(this.vehicle.hull===0) {
            this.vehicle=null;this.invulnerable=2.4;this.player.vy=Math.min(0,this.player.vy)-80;this.nextVehicleAt=this.distance+320;
            this.events.push({type:'vehicle-break',x:this.player.x,y:this.player.y});
          }
          continue;
        }
        this.health--;
        if(this.nextAidAt===Infinity)this.nextAidAt=this.elapsed+12;
        const lost = Math.min(this.salvage, Math.ceil(this.salvage * .25));
        this.salvage -= lost;
        this.invulnerable = RECOVERY_SECONDS;
        const lostWeapon=!!this.weapon;
        this.weapon=null;this.ammo=null;this.nextGearAt=this.distance+55;
        this.breakOnContact(o);
        this.events.push({type:'hit', hazard:o.type, health:this.health, lost, lostWeapon});
        if (this.health === 0) {
          this.alive = false;
          this.events.push({type:'crash', hazard:o.type});
          break;
        }
      }
    }
    if(this.alive && this.gear && (this.gear.x-this.player.x)**2+(this.gear.y-this.player.y)**2<65**2) {
      this.weapon=this.gear.kind;this.ammo=WEAPONS[this.weapon].ammo;this.gear=null;this.nextGearAt=this.distance+135;
      this.events.push({type:'gear',weapon:this.weapon});
    }
    if(this.alive && this.vehiclePickup) {
      const pickup=this.vehiclePickup;
      if((pickup.x-this.player.x)**2+(pickup.y-this.player.y)**2<62**2) {
        this.vehicle={hull:SHUTTLE_HULL};this.vehiclePickup=null;this.nextVehicleAt=this.distance+650;
        this.invulnerable=Math.max(this.invulnerable,1.2);this.player.y=Math.min(FLOOR-26,Math.max(CEILING+36,this.player.y));
        this.events.push({type:'vehicle-board'});
      } else if(pickup.x < -100){this.vehiclePickup=null;this.nextVehicleAt=this.distance+650;}
    }
    // Damage resolves first: a fatal hit cannot collect a packet or revive.
    if(this.alive && this.medkit) {
      const kit=this.medkit;
      if((kit.x-this.player.x)**2+(kit.y-this.player.y)**2<48**2) {
        const restored=this.health<MAX_HEALTH;
        this.health=Math.min(MAX_HEALTH,this.health+1);this.medkit=null;
        this.nextAidAt=this.health<MAX_HEALTH?this.elapsed+22+this.rng()*8:Infinity;
        if(restored){this.invulnerable=Math.max(this.invulnerable,.8);this.events.push({type:'heal',health:this.health,x:kit.x,y:kit.y});}
      } else if(kit.x < -45) {this.medkit=null;this.nextAidAt=this.elapsed+12;}
    }
    for (const c of this.coins) {
      c.x -= move;
      if (this.alive && !c.taken && (c.x - this.player.x) ** 2 + (c.y - this.player.y) ** 2 < (this.vehicle?64:43) ** 2) {
        c.taken=true;const kind=c.kind??'salvage',value=LOOT[kind].value*(this.reality==='double'?2:1);
        this.salvage+=value;this.collectedSalvage+=value;
        // Stillmatter works harder in an unstable corridor. Normal collection
        // leaves pressure; concentrated collection can recover high debt.
        const stabilization=LOOT[kind].value*(this.profile.reliefBase+this.profile.reliefSlope*this.entropy/100);
        this.entropy=Math.max(0,this.entropy-stabilization);
        this.events.push({type:'coin',x:c.x,y:c.y,kind,value});
        let effect;
        if(kind==='cell'){this.invulnerable=Math.max(this.invulnerable,1.6);effect='Shield';}
        if(kind==='data'){this.timeHold=this.profile.timeHold;effect='Time held';}
        if(kind==='relic'){
          if(this.vehicle&&this.vehicle.hull<SHUTTLE_HULL){this.vehicle.hull++;effect='Hull +1';}
          else if(this.health<MAX_HEALTH){this.health++;if(this.health===MAX_HEALTH)this.nextAidAt=Infinity;effect='Health +1';}
          else {this.invulnerable=Math.max(this.invulnerable,3);effect='Shield';}
        }
        if(effect)this.events.push({type:'loot-effect',x:c.x,y:c.y,effect});
        if(this.collectedSalvage>=this.nextCheerAt){this.events.push({type:'cheer'});this.nextCheerAt+=50;}
      }
    }
    this.obstacles = this.obstacles.filter(o => !o.spent && o.x > -150);
    this.coins = this.coins.filter(c => !c.taken && c.x > -40);
    for(const shot of this.shots) {
      shot.x+=WEAPONS[shot.kind].speed*flightTime;shot.y+=shot.vy*flightTime;if(shot.kind==='moon')shot.age+=flightTime;
      if(shot.kind==='moon') {
        shot.vy+=flightTime*200*this.gravity;
        const radius=shot.upgraded?40:32,top=CEILING+radius,bottom=FLOOR-radius;
        if(shot.y<top||shot.y>bottom) {
          shot.y=Math.max(top,Math.min(bottom,shot.y));shot.vy=shot.y===bottom?-245:Math.abs(shot.vy);
          this.events.push({type:'moon-bounce',x:shot.x,y:shot.y});
        }
      }
    }
    this.shots=this.shots.filter(shot=>!shot.spent&&shot.x<this.width+65&&(shot.kind!=='moon'||shot.age<5)&&(shot.kind==='moon'||shot.y>CEILING&&shot.y<FLOOR));
  }
}
