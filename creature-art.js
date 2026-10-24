import {CREATURES} from './creatures.js';

// Pixel silhouettes, expressive faces and harmless props; no simulation state.
const block=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
function eye(c,x,y,size,time) {
  block(c,x-size,y-size,size*2,size*2,'#e8ddbd');
  const blink=Math.sin(time*1.1+x*.13)>.995;
  block(c,x-size+1,y-(blink?1:size-1),size*2-2,blink?2:size*2-2,'#273d42');
  if(!blink)block(c,x-size+1,y-size+1,Math.max(2,size-2),Math.max(2,size-2),'#bac7ae');
}
function mug(c,x,y,color) {
  block(c,x,y,9,11,color);block(c,x+8,y+2,4,6,color);block(c,x+1,y-2,7,3,'#4d4940');
}
/** Draw an original species, pose and health indicator without mutating its state. */
export function drawCreature(c,o,sector,time) {
  const v=o.variant??0,t=o.age??time,accent=({machine:'#9ab88c',organic:'#d99d9e',void:'#b9a9d1',aquarium:'#8fbfbd',scrapyard:'#c3a281'})[sector.id]??'#b1c3ad';
  c.save();c.translate(Math.round(o.x),Math.round(o.y));
  if(o.type==='hopper'){const squash=1+Math.cos(t*3.8+(o.phase??0)*2)*.07;c.scale(1/squash,squash);}
  if(o.type==='auditor') {
    // Brain in a floating specimen jar, doing entirely unnecessary paperwork.
    block(c,-26,-32,52,6,'#3f5c60');block(c,-24,-26,48,37,'#6da3a966');
    block(c,-19,-22,38,27,'#c694a1');block(c,-14,-27,28,8,'#c694a1');
    for(let i=0;i<4;i++)block(c,-15+i*8,-20,3,11,'#926e87');
    block(c,-24,10,48,12,'#405b60');block(c,-18,22,36,5,accent);
    const scanning=t<1.15;
    eye(c,-9,-8,6,time);eye(c,9,-8,6,time+1);
    block(c,-14,-17,28,3,scanning?'#d5a67c':'#566765');
    block(c,-24,27,48,4,'#9ec5ae55');
    block(c,-38,5,22,29,'#c3b58e');block(c,-35,10,15,2,'#765e59');block(c,-35,17,11,2,'#765e59');
    block(c,-35,24,14,4,scanning?'#d58b7d':'#8b9f81');
    if(v===1){block(c,-5,-41,10,8,'#b19673');block(c,-14,-34,28,3,'#b19673');}
    if(v===2)mug(c,23,7,'#c0b194');
    if(scanning){block(c,-35,-4,9,2,'#dfb28a');block(c,-37,-7,2,8,'#dfb28a');}
  } else if(o.type==='hopper') {
    // Lunch has escaped. The garnish remains optimistic.
    block(c,-29,-13,58,28,'#9eab72');block(c,-22,-21,44,13,'#b3ba85');
    block(c,-23,15,17,5,'#8b9865');block(c,8,15,17,5,'#8b9865');
    eye(c,-12,-9,6,time);eye(c,12,-9,6,time+1);
    block(c,-19,2,38,11,'#3d4244');
    for(let i=0;i<4;i++)block(c,-15+i*9,2,5,5,'#e2d4aa');
    if(v===1)block(c,-3,8,14,9,'#c38a8b');
    else if(v===2){block(c,-21,-23,43,4,'#bc9966');block(c,-12,-27,24,4,'#e0c592');}
    else {block(c,-4,-29,4,11,'#7b9b6c');block(c,0,-29,9,4,'#9ab681');}
    block(c,-31,5,5,4,'#b5b889');block(c,27,5,5,4,'#b5b889');
  } else if(o.type==='manta') {
    const flap=Math.sin(t*3.3+o.phase)*8;
    c.fillStyle=accent;c.beginPath();c.moveTo(-38,3);c.lineTo(-13,-17-flap);c.lineTo(10,-10);c.lineTo(38,3);c.lineTo(15,17+flap);c.lineTo(-15,13);c.fill();
    block(c,-25,-10,48,23,'#6d8c9b');
    for(let i=0;i<3;i++)eye(c,-17+i*14,-3,5,time+i);
    block(c,-8,9,17,3,'#324f59');block(c,25,2,17,3,accent);
    if(v===0){block(c,-3,13,7,11,'#c18c83');block(c,-1,21,3,7,'#c18c83');}
    if(v===1){block(c,-25,-13,48,3,'#d0b785');block(c,-25,-13,3,13,'#d0b785');}
    if(v===2){block(c,-8,-23,18,12,'#a5b6b177');block(c,-10,-24,22,3,'#c0c3a6');}
  } else if(o.type==='spore') {
    const breathe=Math.sin(t*2.3+o.phase)*3;
    block(c,-19-breathe,-21,38+breathe*2,41,'#aa91b0');block(c,-24,-12,48,23,'#aa91b0');
    for(const [x,y] of [[-13,-19],[8,-23],[20,7],[-18,14]])block(c,x,y,7,6,'#c0acbc');
    eye(c,-8,-6,6,time);eye(c,9,-5,5,time+2);block(c,-4,8,9,5,'#554961');
    for(let i=0;i<3;i++)block(c,-16+i*13,20,4,10+Math.sin(t*3+i)*4,'#8c809f');
    if(v===0){block(c,22,5,12,3,'#a6a29e');mug(c,29,0,'#c3b796');}
    if(v===1){block(c,-3,-35,4,15,'#7d9a88');block(c,-8,-36,14,6,'#d2ad8c');}
    if(v===2){block(c,-23,12,46,5,'#bd9c83');block(c,-23,17,8,6,'#bd9c83');block(c,15,17,8,6,'#bd9c83');}
  } else if(o.type==='crab') {
    for(const side of [-1,1])for(let i=0;i<3;i++) {
      const step=Math.sin(t*10+i*2+side)*5;
      block(c,side*20+(side<0?-13:0),8+i*3,14,4,'#9f9f87');
      block(c,side*31-2,12+i*2,5,10+step,'#9f9f87');
    }
    block(c,-32,-17,64,34,'#9c8872');block(c,-25,-23,50,12,'#b2a087');
    block(c,-28,-11,56,21,'#495e5c');
    for(const x of [-14,14]){block(c,x-2,-28,4,20,'#a5ad92');eye(c,x,-27,5,time+x);}
    block(c,-18,3,36,6,'#233f43');for(let i=0;i<5;i++)block(c,-16+i*7,3,4,3,'#dad0ae');
    if(v===0){block(c,-11,-28,22,8,'#a6b5ae');block(c,-15,-21,30,3,'#a6b5ae');}
    if(v===1){block(c,-10,-26,20,10,'#b77f70');block(c,-6,-24,12,2,'#d5bb8c');}
    if(v===2)for(let i=0;i<5;i++)block(c,-23+i*10,-14,7,4,'#b5b09a');
    block(c,-38,-4,10,10,'#b2a087');block(c,-39,-2,5,5,'#3d5457');
  } else if(o.type==='jelly') {
    block(c,-26,-14,52,29,accent);block(c,-19,-23,38,12,accent);
    block(c,-22,-12,44,22,'#547c86');eye(c,0,-4,9,time);
    for(let i=0;i<4;i++)block(c,-21+i*13,15,5,10+Math.sin(t*2+i)*3,accent);
    if(v===1){block(c,-18,-29,36,5,'#c9b589');block(c,-12,-33,24,5,'#c9b589');}
    if(v===2)mug(c,23,9,'#b8bc9b');
  } else if(o.type==='mimic') {
    block(c,-27,-21,54,42,'#b48e6d');block(c,-24,-18,48,36,'#786454');
    block(c,-3,-21,6,12,'#c2b390');eye(c,-11,-3,6,time);eye(c,12,-3,6,time+1);
    block(c,-15,9,30,7,'#293d43');for(let i=0;i<(v===1?4:2);i++)block(c,-11+i*(v===1?7:20),9,4,4,'#ded5b5');
    for(const side of [-1,1])block(c,side*19-3,21,6,6+Math.sin(t*4+side)*3,'#b98c76');
    if(v===0){block(c,12,-18,10,7,'#b4b795');block(c,15,-16,4,3,'#755e57');}
    if(v===2){block(c,-34,-5,8,17,'#b48e6d');block(c,26,0,10,17,'#b48e6d');}
  } else {
    // Cleaners have local uniforms; their angry little rotors remain familiar.
    const body=sector.id==='machine'?'#66836e':sector.id==='void'?'#9a91b2':'#b1b9a8';
    block(c,-27,-20,54,39,'#324c53');block(c,-23,-17,46,32,body);
    block(c,-19,-9,38,14,'#344f58');eye(c,-9,-2,4,time);eye(c,9,-2,4,time+1);
    for(const side of [-1,1]){block(c,side*29-2,-20,4,19,'#8ca69d');block(c,side*29-13,-23,26+Math.sin(t*38)*5,3,accent);}
    block(c,-11,18,22,4,'#526d70');
    if(v===0){block(c,-2,-30,4,11,'#b7c4ac');block(c,-4,-34,8,5,'#c78d7d');}
    if(v===1)block(c,-19,-26,38,6,'#ba9d7c');
    if(v===2){block(c,-3,6,6,15,'#c08a7e');block(c,-1,17,3,8,'#c08a7e');}
  }
  // Health belongs to the creature, rather than a decorative four-bar fixture.
  const max=o.maxHp??CREATURES[o.type].hp;
  if(max>1)for(let i=0;i<max;i++)block(c,-max*5+i*10,-CREATURES[o.type].h/2-8,6,3,i<(o.hp??max)?'#dfc39b':'#425b5c');
  c.restore();
}
