// Original species and deterministic movement. Rendering and audio live elsewhere.
export const CREATURES=Object.freeze({
  drone:Object.freeze({name:'Union cleaner',w:55,h:42,hp:1}),
  jelly:Object.freeze({name:'Tenured jelly',w:52,h:48,hp:2}),
  mimic:Object.freeze({name:'Unsolicited parcel',w:54,h:42,hp:1}),
  auditor:Object.freeze({name:'Floating auditor',w:50,h:64,hp:2}),
  hopper:Object.freeze({name:'Escaped ration',w:58,h:40,hp:1}),
  manta:Object.freeze({name:'Three-eyed ray',w:76,h:34,hp:2}),
  spore:Object.freeze({name:'Coffee spore',w:48,h:52,hp:1}),
  crab:Object.freeze({name:'Scrap crab',w:70,h:44,hp:2})
});
export const CREATURE_ROSTERS=Object.freeze({
  ship:Object.freeze(['drone','auditor','hopper','mimic']),
  machine:Object.freeze(['auditor','drone','crab','mimic']),
  organic:Object.freeze(['hopper','spore','jelly','mimic']),
  void:Object.freeze(['manta','spore','drone','auditor']),
  aquarium:Object.freeze(['manta','jelly','spore','crab']),
  scrapyard:Object.freeze(['crab','mimic','hopper','drone'])
});
export const isCreature=type=>Object.hasOwn(CREATURES,type);
export function makeCreature(type,x,rng,playerY) {
  const spec=CREATURES[type],baseY=215+rng()*210;
  return {type,x,y:baseY,baseY,w:spec.w,h:spec.h,hp:spec.hp,maxHp:spec.hp,
    phase:rng()*Math.PI*2,age:0,variant:Math.floor(rng()*3),
    targetY:playerY,drift:rng()<.5?-32:32};
}
export function moveCreature(o,dt,move,top,bottom) {
  const phase=o.phase??0,age=o.age;
  if(o.paired) {
    // The two bodies stay in separate bands, leaving a readable middle lane.
    o.y=o.baseY+Math.sin(age*1.3+phase)*24;
  } else if(o.type==='hopper') {
    o.y=bottom-22-Math.abs(Math.sin(age*1.9+phase))*105;
    o.x-=move*.08;
  } else if(o.type==='crab') {
    o.y=bottom-26+Math.sin(age*8+phase)*3;
    o.x-=move*.15;
  } else if(o.type==='spore') {
    o.y+=o.drift*dt;
    if(o.y<top+50||o.y>bottom-50){o.y=Math.max(top+50,Math.min(bottom-50,o.y));o.drift*=-1;}
    o.x+=Math.cos(age*1.5+phase)*12*dt;
  } else if(o.type==='auditor') {
    if(age<1.15)o.y=o.baseY+Math.sin(age*3+phase)*7;
    else {
      // Scan once, then follow the captured lane, never chase the player.
      const target=Math.max(top+o.h/2,Math.min(bottom-o.h/2,o.targetY));
      o.y+=Math.max(-45*dt,Math.min(45*dt,target-o.y));o.x-=move*.25;
    }
  } else {
    const [rate,amplitude]=o.type==='drone'?[2.2,48]:o.type==='jelly'?[1.25,38]:o.type==='manta'?[.9,66]:[.9,22];
    o.y=o.baseY+Math.sin(age*rate+phase)*amplitude;
    if(o.type==='mimic')o.x-=move*.12;
    if(o.type==='manta')o.x-=move*.06;
  }
}
