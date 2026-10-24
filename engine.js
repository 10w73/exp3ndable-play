import {WEAPONS, PICKUP_WEAPONS} from './arsenal.js';

export const HEIGHT = 600;
export const CEILING = 105;
export const FLOOR = 541;
export const MAX_HEALTH = 3;
export const RECOVERY_SECONDS = 1.8;
export const SHUTTLE_HULL = 3;
export const PORTAL_RADIUS_Y = 72;
export const REALMS = Object.freeze(['ship','machine','organic','void','aquarium','scrapyard']);
const SHIP_ROOMS = ['crew','canteen','lab'];
// Projectiles only damage these hazards. Collectibles and portals are separate
// entities, and future object types are safe unless deliberately added here.
const SHOOTABLE = new Set(['laser','horizontal','drone','spinner','missile','pendulum','jelly','mimic']);

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
  o.warning=Math.max(0,o.warning-dt);
}
function hazardTouches(o,x,y,radius) {
  if(o.type==='pendulum') {const [a,b,c]=pendulumPoints(o);return circleSegment(x,y,radius+5,a,b)||circleSegment(x,y,radius+5,b,c);}
  if(o.type==='spinner') {const dx=x-o.x,dy=y-o.y;return circleRect(dx*Math.cos(o.angle)+dy*Math.sin(o.angle),-dx*Math.sin(o.angle)+dy*Math.cos(o.angle),radius,{x:0,y:0,w:o.w,h:o.h});}
  return circleRect(x,y,radius,o);
}

export class Run {
  constructor(width, rng = Math.random) {
    this.width = width;
    this.rng = rng;
    this.player = { x: Math.min(215, Math.max(85, width * .18)), y: 325, vy: 0, radius: 16 };
    this.distance = 0; this.salvage = 0; this.elapsed = 0; this.scroll = 0;
    this.alive = true; this.health = MAX_HEALTH; this.invulnerable = 0;
    this.obstacles = []; this.coins = []; this.events = [];
    this.lastCoinPattern = -1; this.coinBag=[]; this.weapon = 'ion'; this.ammo = null; this.shots = []; this.attacks = []; this.weaponBag = []; this.fireCooldown = 0; this.gear = null; this.nextGearAt = 90;
    this.spawnIn = 1.8; this.coinIn = .8; this.nextPortal = 260;
    this.portal = null; this.reality = null; this.realityTime = 0; this.combo = 0;
    this.realm='ship';this.shipRoom='crew';
    this.medkit=null;this.nextAidAt=Infinity;
    this.vehicle=null;this.vehiclePickup=null;this.nextVehicleAt=150;this.lastPendulumAt=-1000;
  }
  resize(width) {
    const offset = width - this.width;
    this.width = width;
    this.player.x = Math.min(215, Math.max(85, width * .18));
    for (const item of [...this.obstacles, ...this.coins]) item.x += Math.max(0, offset);
    if (this.portal && !this.portal.passed) this.portal.x += Math.max(0, offset);
    if (this.gear) this.gear.x += Math.max(0, offset);
    if (this.medkit) this.medkit.x += Math.max(0, offset);
    if (this.vehiclePickup) this.vehiclePickup.x += Math.max(0, offset);
  }
  get speed() {
    const base=Math.min(290,Math.max(185,this.width*.24));
    // Settle in first. The long-run increase approaches a fixed 26% ceiling.
    return base*(1+.26*(1-Math.exp(-Math.max(0,this.elapsed-20)/85)));
  }
  spawnMedkit() {
    this.medkit={x:this.width+55,y:Math.max(185,Math.min(465,this.player.y+(this.rng()-.5)*70))};
    // A recovery lane, with time to reach the packet before hazards resume.
    this.obstacles=this.obstacles.filter(o=>o.x<this.player.x-70);
    this.spawnIn=Math.max(this.spawnIn,(this.medkit.x-this.player.x)/this.speed+1.4);
  }
  spawnVehicle() {
    this.vehiclePickup={x:this.width+85,y:Math.max(200,Math.min(440,this.player.y-45))};
    this.obstacles=this.obstacles.filter(o=>o.x<this.player.x-80);
    this.spawnIn=Math.max(this.spawnIn,(this.vehiclePickup.x-this.player.x)/this.speed+1.5);
  }
  spawnObstacle() {
    const types = ['laser', 'horizontal', 'drone', 'crusher', 'spinner', 'missile'];
    if(['aquarium','organic'].includes(this.realm))types.push('jelly');
    if(['scrapyard','machine'].includes(this.realm))types.push('mimic');
    const type = types[Math.floor(this.rng() * (this.distance < 100 ? 3 : types.length))];
    if(this.distance>180 && this.distance-this.lastPendulumAt>220 && ['laser','spinner'].includes(type) && this.rng()<.35) {
      const item=makePendulum(this.width+165,255+this.rng()*45,this.rng);this.lastPendulumAt=this.distance;this.obstacles.push(item);return item;
    }
    let y = 165 + this.rng() * 305;
    const item = { type, x: this.width + 90, y, baseY: y, phase: this.rng() * Math.PI * 2, w: 24, h: 140, age: 0 };
    if (type === 'horizontal') { item.w = 113; item.h = 20; }
    if (type === 'drone') { item.w = 55; item.h = 42; item.baseY = 205 + this.rng() * 235; }
    if (type === 'jelly') { item.w=52; item.h=48; item.baseY=215+this.rng()*210; item.hp=2; }
    if (type === 'mimic') { item.w=54; item.h=42; item.baseY=205+this.rng()*235; }
    if (type === 'crusher') { item.w = 58; item.h = 150; item.y = this.rng() < .5 ? CEILING + 65 : FLOOR - 65; }
    if (type === 'spinner') { item.w = 130; item.h = 16; item.angle = item.phase; }
    if (type === 'missile') { item.w = 66; item.h = 24; item.baseY = Math.max(CEILING + 24, Math.min(FLOOR - 22, this.player.y)); item.y = item.baseY; item.warning = 1.25; this.events.push({type:'missile-warning'}); }
    this.obstacles.push(item);
    return item;
  }
  spawnCoins() {
    const patterns = [
      [[0,0],[38,-18],[76,-32],[114,-32],[152,-18],[190,0]],
      [[0,-25],[0,25],[58,-25],[58,25],[116,-25],[116,25]],
      [[0,0],[40,0],[80,0],[120,0],[160,0],[200,0]],
      [[0,-35],[38,-15],[76,5],[114,25],[152,5],[190,-15]],
      [[0,0],[34,-27],[34,27],[68,0],[102,-27],[102,27],[136,0]],
      [[0,30],[38,18],[76,6],[114,-6],[152,-18],[190,-30]]
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
    patterns[pattern].forEach(([dx,dy],i)=>this.coins.push({x:this.width+60+dx,y:y+dy,phase:i*.4}));
  }
  get firingWeapon() { return this.vehicle&&(!this.weapon||this.weapon==='ion')?'shuttle':this.weapon; }
  fire() {
    if(!this.alive || (!this.weapon&&!this.vehicle) || this.fireCooldown>0)return false;
    const kind=this.firingWeapon,weapon=WEAPONS[kind],upgraded=!!this.vehicle&&kind!=='shuttle';
    this.fireCooldown=weapon.cooldown;
    const x=this.player.x+(this.vehicle?54:35),y=this.player.y-9;
    if(kind==='fork'||kind==='tape')this.attacks.push({kind,x,y,upgraded,originX:this.player.x});
    else for(const offset of upgraded&&['pulse','moon'].includes(kind)?[-18,18]:[0]) {
      this.shots.push({x,y:y+offset,kind,vy:kind==='moon'?(offset<0?-140:120):0,hits:new Set(),age:0,upgraded});
    }
    if(kind!=='shuttle' && this.ammo!==null) {
      this.ammo--;
      if(this.ammo===0){this.weapon='ion';this.ammo=null;}
    }
    return true;
  }
  chooseWeapon() {
    let kind;
    do {
      if(!this.weaponBag.length) {
        this.weaponBag=[...PICKUP_WEAPONS];
        for(let i=this.weaponBag.length-1;i>0;i--) {
          const j=Math.floor(this.rng()*(i+1));
          [this.weaponBag[i],this.weaponBag[j]]=[this.weaponBag[j],this.weaponBag[i]];
        }
      }
      kind=this.weaponBag.pop();
    }while(kind===this.weapon);
    return kind;
  }
  damageHazard(o,damage,weapon) {
    o.hp=(o.hp??(['laser','horizontal','spinner','crusher'].includes(o.type)?4:1))-damage;
    if(o.hp<=0){o.spent=true;this.events.push({type:'destroy',x:o.x,y:o.y,hazard:o.type,weapon});}
  }
  resolveWeapons() {
    const targetable=o=>!o.spent && !(o.type==='missile'&&o.warning>0);
    for(const attack of this.attacks) {
      if(attack.kind==='tape') {
        for(const o of this.obstacles)if(targetable(o)&&o.x>attack.originX&&o.x<this.width+35&&hazardTouches(o,o.x,attack.y,attack.upgraded?192:96)) {
          this.damageHazard(o,Infinity,'tape');
        }
        this.events.push({type:'stamp',x:attack.x,y:attack.y,width:this.width-attack.x,upgraded:attack.upgraded});
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
        if(shot.kind==='pulse') {
          shot.spent=true;
          for(const other of this.obstacles)if(targetable(other)&&SHOOTABLE.has(other.type)&&hazardTouches(other,shot.x,shot.y,shot.upgraded?112:weapon.splash)) {
            this.damageHazard(other,shot.upgraded?3:weapon.damage,'pulse');
          }
          this.events.push({type:'grav-pop',x:shot.x,y:shot.y});
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
    this.events.length = 0;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.fireCooldown = Math.max(0,this.fireCooldown-dt);
    const low = this.reality === 'low';
    const accel = held ? (low ? -1250 : -1850) : (low ? 410 : 750);
    this.player.vy = Math.max(low ? -290 : -365, Math.min(low ? 245 : 315, this.player.vy + accel * dt));
    this.player.y += this.player.vy * dt;
    const upper=CEILING+(this.vehicle?36:24),lower=FLOOR-(this.vehicle?26:22);
    if (this.player.y < upper) { this.player.y = upper; this.player.vy = Math.max(0, this.player.vy); }
    if (this.player.y > lower) { this.player.y = lower; this.player.vy = Math.min(0, this.player.vy); }
    const move = this.speed * dt;
    this.scroll += move; this.distance += move / 13;
    if(this.health<MAX_HEALTH && !this.medkit && !this.portal && this.elapsed>=this.nextAidAt) this.spawnMedkit();
    if(this.medkit)this.medkit.x-=move;
    if(!this.vehicle && !this.vehiclePickup && !this.portal && !this.medkit && this.distance>=this.nextVehicleAt)this.spawnVehicle();
    if(this.vehiclePickup)this.vehiclePickup.x-=move;
    if(this.ammo===null && !this.gear && !this.portal && !this.medkit && !this.vehiclePickup && this.distance>=this.nextGearAt) {
      this.gear={x:this.width+55,y:320,kind:this.chooseWeapon()};
      this.nextGearAt=this.distance+85;
    }
    if(this.gear) {
      this.gear.x-=move;this.gear.y=320+Math.sin(this.elapsed*1.2)*75;
      if(this.gear.x < -45)this.gear=null;
    }
    if (this.realityTime > 0) {
      this.realityTime -= dt;
      if (this.realityTime <= 0) { this.reality = null; this.events.push({type:'normal'}); }
    }
    if (this.distance >= this.nextPortal && !this.portal) {
      const realms=REALMS.filter(realm=>realm!==this.realm);
      this.portal = { x: this.width + 100, y:260+this.rng()*120, realm:realms[Math.floor(this.rng()*realms.length)], passed:false };
      this.obstacles = this.obstacles.filter(o => o.x < this.player.x - 60);
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
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) { const spawned=this.spawnObstacle(); this.spawnIn = 2.3-.35*Math.min(1,this.elapsed/180)+this.rng()*.5+(spawned.type==='pendulum'?.7:0); }
    this.coinIn -= dt;
    if (this.coinIn <= 0) { this.spawnCoins(); this.coinIn = 2.1 + this.rng() * 1.3; }
    for (const o of this.obstacles) {
      o.age += dt;
      if (o.type === 'missile' && o.warning > 0) { o.warning -= dt; o.x = this.width + 80; continue; }
      o.x -= move * (o.type === 'missile' ? 1.65 : 1);
      if (o.type === 'drone') o.y = o.baseY + Math.sin(o.age * 2.2 + o.phase) * 48;
      if (o.type === 'jelly') o.y=o.baseY+Math.sin(o.age*1.25+o.phase)*38;
      if (o.type === 'mimic') {o.y=o.baseY+Math.sin(o.age*.9+o.phase)*22;o.x-=move*.12;}
      if (o.type === 'spinner') o.angle += dt * 1.4;
      if (o.type === 'pendulum') swing(o,dt);
    }
    this.resolveWeapons();
    for(const o of this.obstacles) {
      if(o.type==='missile'&&o.warning>0)continue;
      if(o.spent)continue;
      const hit=!(o.type==='pendulum'&&o.warning>0) && (this.vehicle?[-24,0,24].some(dx=>hazardTouches(o,this.player.x+dx,this.player.y-4,20)):hazardTouches(o,this.player.x,this.player.y,this.player.radius));
      if (hit && this.invulnerable === 0) {
        if(this.vehicle) {
          this.vehicle.hull--;o.spent=true;this.invulnerable=RECOVERY_SECONDS;
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
        o.spent = true;
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
      } else if(pickup.x < -100){this.vehiclePickup=null;this.nextVehicleAt=this.distance+150;}
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
      if (this.alive && !c.taken && (c.x - this.player.x) ** 2 + (c.y - this.player.y) ** 2 < 31 ** 2) {
        c.taken = true; this.salvage += this.reality === 'double' ? 2 : 1;
        this.events.push({type:'coin',x:c.x,y:c.y});
      }
    }
    this.obstacles = this.obstacles.filter(o => !o.spent && o.x > -150);
    this.coins = this.coins.filter(c => !c.taken && c.x > -40);
    for(const shot of this.shots) {
      shot.x+=WEAPONS[shot.kind].speed*dt;shot.y+=shot.vy*dt;if(shot.kind==='moon')shot.age+=dt;
      if(shot.kind==='moon') {
        shot.vy+=dt*200;
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
