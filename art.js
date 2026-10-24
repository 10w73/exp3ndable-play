import { sectorId, PORTAL_RADIUS_Y, LOOT } from './engine.js';
import { WEAPONS } from './arsenal.js';

// Original low-resolution crew, props, and modular dimensions. World coordinates
// remain independent of the canvas pixel grid and the simulation hitboxes.
// A uniformed junior officer: open face, division-red jacket, dark yoke,
// angled pale piping, high collar and a small original bar-and-ring badge.
const crewFrames = new Map();
const portraits = new Map();
function portrait(speaker) {
  if(portraits.has(speaker))return portraits.get(speaker);
  const image=typeof OffscreenCanvas==='function'?new OffscreenCanvas(24,24):document.createElement('canvas');
  image.width=24;image.height=24;const c=image.getContext('2d');
  r(c,0,0,24,24,'#192c32');
  if(speaker==='siv') {
    r(c,5,3,15,18,'#303545');r(c,7,6,11,13,'#aac3c1');r(c,4,10,3,5,'#aac3c1');
    r(c,7,4,12,4,'#303545');r(c,16,6,4,16,'#303545');r(c,8,10,3,1,'#263d45');r(c,13,10,3,1,'#263d45');
    r(c,9,12,2,1,'#203742');r(c,14,12,2,1,'#203742');r(c,11,16,4,1,'#627d80');r(c,5,21,13,3,'#5b8d99');r(c,5,21,13,1,'#263747');r(c,15,22,2,2,'#d6ba71');
  } else if(speaker==='moss') {
    r(c,6,4,13,15,'#a77758');r(c,4,8,17,3,'#364f4d');r(c,6,8,5,5,'#c3ae75');r(c,13,8,5,5,'#c3ae75');
    r(c,7,9,3,2,'#e2c98d');r(c,14,9,3,2,'#e2c98d');r(c,11,15,6,1,'#463e3e');
    r(c,6,19,14,5,'#697b64');r(c,14,20,3,4,'#c3ae75');r(c,3,4,2,6,'#6f9c91');r(c,19,3,3,5,'#6f9c91');
  } else {
    r(c,6,5,12,14,'#d4ab83');r(c,5,3,14,5,'#3d5a9b');r(c,4,6,4,5,'#3d5a9b');r(c,9,2,8,3,'#6086c4');r(c,8,0,3,4,'#3d5a9b');r(c,13,0,2,4,'#3d5a9b');
    r(c,8,9,3,1,'#735342');r(c,14,8,3,1,'#735342');r(c,8,11,3,3,'#e5dfca');r(c,14,11,3,3,'#e5dfca');
    r(c,9,12,1,2,'#263b43');r(c,15,12,1,2,'#263b43');r(c,11,16,3,2,'#895f53');r(c,19,9,1,3,'#98bdb9');
    r(c,5,20,14,4,'#b75159');r(c,5,20,14,1,'#263747');r(c,11,20,3,2,'#182e3b');r(c,16,22,2,2,'#d6ba71');
  }
  portraits.set(speaker,image);return image;
}
export function drawRadioPortrait(c,speaker) {c.clearRect(0,0,24,24);c.imageSmoothingEnabled=false;c.drawImage(portrait(speaker),0,0);}
function crewmate(c,speaker,x,y,time) {
  // Colleagues stay in the scenery, outside the readable hazard silhouettes.
  const coat=speaker==='siv'?'#5b8d99':speaker==='moss'?'#70836b':'#b75159';
  r(c,x-9,y-20,19,24,coat);if(speaker!=='moss'){r(c,x-9,y-20,19,4,'#263747');r(c,x-8,y-15,9,1,'#dfdeca');r(c,x+1,y-14,8,1,'#dfdeca');r(c,x+4,y-18,3,3,'#d6ba71');}r(c,x-11,y+4,8,14,'#263c49');r(c,x+4,y+4,8,14,'#31474b');
  c.drawImage(portrait(speaker),x-12,y-44,24,24);
  if(speaker==='pip'){r(c,x+8,y-18,14,18,'#c5b88b');r(c,x+10,y-15,8,2,'#718177');r(c,x+10,y-10,8,2,'#718177');}
  if(speaker==='siv'){r(c,x+7,y-9,17,3,'#aac3c1');r(c,x+19,y-16,4,8,'#aac3c1');}
  if(speaker==='moss'){r(c,x+8,y-12,21,4,'#9f8e64');r(c,x+25,y-17+Math.sin(time)*2,4,14,'#aac2a3');}
}
function crewBitmap(grounded,frame,weapon) {
  const key=`${grounded}-${frame}-${weapon}`;
  if(crewFrames.has(key))return crewFrames.get(key);
  const image=typeof OffscreenCanvas==='function'?new OffscreenCanvas(80,88):document.createElement('canvas');
  image.width=80;image.height=88;const c=image.getContext('2d');c.translate(36,64);
  const phase=frame*Math.PI/4,bob=grounded?Math.round(Math.abs(Math.sin(phase))*2):0;
  const poses=grounded ? [
    {hip:-6,foot:-6+Math.round(Math.sin(phase)*10),lift:Math.round(Math.max(0,-Math.cos(phase))*6)},
    {hip:5,foot:5-Math.round(Math.sin(phase)*10),lift:Math.round(Math.max(0,Math.cos(phase))*6)}
  ] : [{hip:-6,foot:-15,lift:7},{hip:5,foot:6,lift:3}];
  for(const [i,leg] of poses.entries()) {
    const knee=leg.hip+Math.round((leg.foot-leg.hip)*.45),ky=10-leg.lift*.4;
    limb(c,leg.hip,-1-bob,knee,ky,6,i?'#293d4c':'#162b38');
    limb(c,knee,ky,leg.foot,18-leg.lift,5,i?'#334b58':'#1c3341');
    r(c,leg.foot-4,17-leg.lift,12,5,'#1b2a35');r(c,leg.foot-4,21-leg.lift,14,2,'#a5b6b1');
  }
  c.save();c.translate(0,-bob);
  // Compact borrowed jetpack behind a clearly readable uniform silhouette.
  r(c,-24,-28,12,30,'#142b35');r(c,-22,-25,8,25,'#6f9995');r(c,-21,-22,6,7,'#a9c4b2');r(c,-21,-4,7,10,'#314e58');
  const arm=grounded?Math.round(Math.sin(phase)*5):2;
  limb(c,-12,-24,-15-arm,-10,6,'#9c454c');limb(c,-15-arm,-10,-11-arm*1.5,0,5,'#b55c5c');r(c,-14-arm*1.5,-1,6,6,'#dcac85');
  // Charcoal shoulder yoke and high collar over the division-coloured body.
  r(c,-12,-29,25,29,'#172b39');r(c,-10,-21,21,20,'#b75159');r(c,-8,-17,17,15,'#c46768');
  r(c,-13,-29,27,8,'#233747');r(c,-7,-34,13,7,'#162a38');r(c,-3,-32,7,4,'#d6a67f');
  r(c,-11,-22,8,2,'#e3e3cd');r(c,-3,-20,8,2,'#e3e3cd');r(c,5,-18,8,2,'#e3e3cd');
  r(c,5,-24,5,5,'#d6ba71');r(c,6,-23,3,3,'#344956');r(c,7,-27,2,4,'#d6ba71');
  r(c,-11,-3,23,5,'#152c3b');r(c,2,-2,5,3,'#879c9c');r(c,-16,-9,5,2,'#d8dbcb');
  // Unhelmeted, slightly worried face. Hair and profile remain original.
  r(c,-10,-53,20,5,'#3d5a9b');r(c,-13,-49,27,7,'#3d5a9b');r(c,-12,-43,24,12,'#d8a981');
  r(c,-10,-35,22,5,'#d8a981');r(c,-7,-30,15,3,'#d8a981');r(c,11,-41,5,5,'#e0b18a');
  r(c,-13,-46,5,10,'#3d5a9b');r(c,-9,-54,11,3,'#6086c4');r(c,-7,-57,5,4,'#3d5a9b');r(c,0,-58,4,5,'#3d5a9b');r(c,6,-55,5,4,'#3d5a9b');r(c,-10,-48,24,4,'#6086c4');
  r(c,-5,-42,6,2,'#704b42');r(c,5,-44,6,2,'#704b42');r(c,-5,-39,6,5,'#f1e6cb');r(c,5,-39,6,5,'#f1e6cb');
  r(c,-1,-38,2,4,'#203646');r(c,9,-38,2,4,'#203646');r(c,4,-31,5,2,'#885c50');r(c,-13,-37,3,5,'#c39373');
  if(!weapon){limb(c,11,-24,14+arm,-12,6,'#b75159');limb(c,14+arm,-12,11+arm*1.5,0,5,'#c46768');r(c,10+arm*1.5,0,6,5,'#dcac85');}
  c.restore();crewFrames.set(key,image);return image;
}
function limb(c,x,y,x2,y2,width,color) {
  const steps=Math.ceil(Math.max(Math.abs(x2-x),Math.abs(y2-y)));
  for(let i=0;i<=steps;i++){const t=steps?i/steps:0;r(c,x+(x2-x)*t-width/2,y+(y2-y)*t,width,width,color);}
}
function r(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);}
function txt(c,value,x,y,size,color){c.fillStyle=color;c.font=`${size}px monospace`;c.fillText(value,x,y);}
function eye(c,x,y,size=1,color='#c7dc97',t=0){r(c,x-12*size,y-8*size,24*size,16*size,color);r(c,x-8*size,y-12*size,16*size,24*size,color);r(c,x-6*size,y-6*size,12*size,12*size,'#eff0ba');r(c,x+Math.sin(t)*2*size,y-5*size,5*size,10*size,'#192e38');}
export function sectorFor(run){
  const id=sectorId(run);
  const data={crew:['PERSONNEL DECK','UNPAID EVACUATION','#29434c'],canteen:['MESS HALL','LUNCH HAS ESCAPED','#39483f'],lab:['BIO LAB','ETHICS PENDING','#263f43'],machine:['COMPLIANCE CORE','INDIVIDUALITY ARCHIVED','#18332e'],organic:['GUT TRANSIT','MIND THE SALIVA','#433447'],void:['POCKET DIMENSION','GEOMETRY OPTIONAL','#2c344c'],aquarium:['PELAGIC ANNEX','THE FISH HAVE TENURE','#233e49'],scrapyard:['WARRANTY MOON','ALL SALES FINAL','#443b36']}[id];
  return {id,name:data[0],caption:data[1],color:data[2]};
}
export function drawCrew(c,x,y,thrust,scale,vy,time,weapon='ion',grounded=false,travel=0){
  c.save();c.translate(Math.round(x),Math.round(y));c.scale(scale,scale);
  if(!grounded)c.rotate(Math.max(-.09,Math.min(.1,vy*.00025)));
  if(thrust){const length=18+Math.floor(Math.sin(time*24)*3)*3;r(c,-22,3,7,length,'#d58f70');r(c,-20,5,3,length+9,'#eacb92');}
  c.imageSmoothingEnabled=false;
  // Eight distinct poses; feet reach the same deck line as the collision floor.
  const frame=grounded?Math.floor(travel/11)%8:0;
  c.drawImage(crewBitmap(grounded,frame,!!weapon),-36,-64);
  if(weapon){
    r(c,8,-12,32,8,'#172e3d');r(c,18,-15,16,4,'#829d9b');r(c,20,-11,21,3,'#b5cbb7');r(c,39,-10,6,5,'#6b9296');
    r(c,10,-6,5,8,'#304b58');r(c,7,-9,8,7,'#deb08a');r(c,1,-14,9,5,'#b75159');r(c,28,-7,7,4,'#deb08a');
    if(weapon==='torpedo'){r(c,13,-24,30,27,'#685e53');for(let i=0;i<3;i++){r(c,20,-21+i*9,26,6,WEAPONS.torpedo.color);r(c,42,-20+i*9,5,4,'#f2dfb5');}}
    if(weapon==='beam'){r(c,12,-18,29,17,'#766a57');r(c,37,-22,11,25,WEAPONS.beam.color);r(c,46,-15,6,12,'#f5d793');}
    if(weapon==='fork'){r(c,18,-20,8,20,'#637b88');r(c,26,-21,22,5,WEAPONS.fork.color);r(c,26,0,22,5,WEAPONS.fork.color);}
    if(weapon==='moon')moonFace(c,34,-10,13,0,time);
    if(weapon==='tape'){r(c,15,-24,10,18,'#af9d7b');r(c,6,-9,42,13,'#b7776c');r(c,5,3,44,4,'#dfb29a');}
  }
  c.restore();
}
export function drawShuttle(c,x,y,hull=3,thrust=false,time=0,vy=0,pickup=false,weapon='shuttle') {
  c.save();c.translate(Math.round(x),Math.round(y));c.rotate(Math.max(-.06,Math.min(.06,vy*.00015)));
  if(thrust){for(const dx of [-29,24]){const l=12+Math.sin(time*22+dx)*4;r(c,dx,23,7,l,'#b2c9a0');r(c,dx+2,25,3,l+5,'#e4d0a0');}}
  // Fleet shuttle cabin, junk-saucer belly, mismatched nacelles and taped repairs.
  c.fillStyle='#152b34';c.beginPath();c.ellipse(0,13,59,13,0,0,Math.PI*2);c.fill();
  c.fillStyle='#9eaaa0';c.beginPath();c.ellipse(0,10,56,11,0,0,Math.PI*2);c.fill();
  r(c,-42,12,85,7,'#607d7d');r(c,-25,17,46,6,'#465e66');r(c,-16,19,12,3,'#b98c6b');
  c.fillStyle='#b1b7a3';c.beginPath();c.moveTo(-35,-22);c.lineTo(26,-22);c.lineTo(44,-7);c.lineTo(42,8);c.lineTo(-35,8);c.closePath();c.fill();
  r(c,-35,-18,15,22,'#7d9490');r(c,-29,-14,7,11,'#526d72');r(c,-14,-15,50,3,'#b75159');r(c,4,-9,35,12,'#78928d');
  c.fillStyle='#223e4b';c.beginPath();c.ellipse(5,-19,24,17,0,Math.PI,Math.PI*2);c.fill();
  c.fillStyle='#6f9fa3';c.beginPath();c.ellipse(5,-19,21,14,0,Math.PI,Math.PI*2);c.fill();
  r(c,-16,-22,43,7,'#274d58');r(c,-12,-28,3,10,'#b2c5b3');r(c,19,-29,3,11,'#b2c5b3');
  if(!pickup){r(c,3,-31,10,5,'#3d5a9b');r(c,5,-26,10,7,'#d9ae89');r(c,11,-25,2,2,'#233744');r(c,1,-20,14,4,'#b75159');}
  r(c,-44,0,12,4,'#a7b4a5');r(c,-57,-8,27,12,'#5d797e');r(c,-56,-7,7,10,'#b9c9ae');r(c,-49,-5,14,3,'#83b6bc');
  r(c,-46,16,21,8,'#35515e');r(c,-45,16,6,7,'#93b7b4');r(c,36,-5,17,6,'#1c3b49');r(c,47,-4,7,4,'#bdd7b0');
  r(c,-23,5,16,5,'#ae876a');r(c,-19,3,3,10,'#d4c79e');r(c,15,9,14,5,'#b3a17b');r(c,25,9,3,5,'#d0c6a3');
  for(let i=0;i<3;i++)r(c,-25+i*8,-27,5,4,i<hull?'#bfd99b':'#40585c');
  r(c,-5,-6,12,5,'#d9d4b5');r(c,-3,-5,2,3,'#4e6b6d');r(c,2,-5,2,3,'#4e6b6d');
  if(hull<3){r(c,10,-29,2,8,'#d6d4bc');r(c,12,-25,4,2,'#d6d4bc');r(c,-32,8,7,4,'#564f45');}
  if(hull<2){r(c,-14,-8,10,7,'#596c68');r(c,-11,-7,2,5,'#c5966c');r(c,-39,23,3,8,'#ad9475');}
  if(!pickup&&weapon!=='shuttle'){
    const color=WEAPONS[weapon].color;
    for(const side of [-1,1]){r(c,side*30-10,-7,20,7,color);r(c,side*30-8,-12,16,5,'#66838b');}
    if(weapon==='moon')moonFace(c,32,-8,15,0,time);
    if(weapon==='tape'){r(c,34,-18,10,18,'#b39d7f');r(c,22,-3,34,8,color);}
    if(weapon==='fork'){r(c,35,-19,21,4,color);r(c,35,1,21,4,color);}
    if(weapon==='torpedo')for(let i=0;i<3;i++){r(c,30,-21+i*10,25,6,color);r(c,50,-20+i*10,7,4,'#f1d8a4');}
    if(weapon==='beam'){r(c,28,-15,25,17,'#8c8169');r(c,49,-22,13,29,color);r(c,60,-15,7,15,'#f7d68d');}
  }
  if(pickup){
    c.strokeStyle='#a9c997';c.lineWidth=2;c.beginPath();
    for(const side of [-1,1]){c.moveTo(side*65,-25);c.lineTo(side*65,-37);c.lineTo(side*51,-37);c.moveTo(side*65,19);c.lineTo(side*65,31);c.lineTo(side*51,31);}
    c.moveTo(-5,-47);c.lineTo(0,-42);c.lineTo(5,-47);c.stroke();
  }
  c.restore();
}
export function drawWorldWindow(c,x,y,w,h,sector,time){
  if(['crew','canteen'].includes(sector.id))return false;
  r(c,x,y,w,h,sector.id==='machine'?'#112b25':sector.id==='organic'?'#35243d':sector.id==='void'?'#1c233e':'#18392f');
  if(sector.id==='machine'){
    for(let a=0;a<7;a++)for(let b=0;b<5;b++){r(c,x+8+a*45,y+8+b*45,34,34,'#234536');r(c,x+12+a*45,y+12+b*45,26,3,'#71805c');r(c,x+14+a*45,y+22+b*45,4,9,(a+b)%3?'#3d6550':'#99c67b');}
    for(let i=0;i<4;i++){const px=x+42+i*68,py=y+85+Math.sin(time+i)*10;r(c,px-18,py-15,36,30,'#152a2a');r(c,px-13,py-10,26,20,'#426d58');r(c,px-8,py-2,16,4,'#b9d79b');}
  } else if(sector.id==='organic'){
    for(let i=0;i<8;i++){const px=x+28+i*39,py=y+50+Math.sin(time*.6+i)*17;r(c,px-15,y,30,h,'#5d3b59');eye(c,px,py,1.2,i%2?'#bd9ac4':'#bad392',time+i);r(c,px-3,py+22,6,57,'#91808e');}
    txt(c,'NEXT CUSTOMER: ALL OF YOU',x+24,y+h-24,9,'#d8c096');
  } else if(sector.id==='void'){
    for(let i=0;i<10;i++){const px=x+16+(i*71)%w,py=y+30+(i*47)%h+Math.sin(time*.5+i)*12;r(c,px,py,23,8,'#7e8293');r(c,px+4,py+8,15,5,'#d3b6b3');r(c,px+8,py+13,7,6,'#446b76');}
    eye(c,x+w*.57,y+h*.43,3,'#c2b0c5',time*.4);
  } else {
    for(let i=0;i<3;i++){const px=x+24+i*99;r(c,px,y+16,71,h-37,'#577968');r(c,px+5,y+22,61,h-49,'#284e41');r(c,px+7,y+h-44,57,16,'#83b981');eye(c,px+36,y+89+Math.sin(time+i)*9,1.5,'#b5c98c',time+i);r(c,px+26,y+108,20,33,'#749d81');r(c,px+15,y+146,40,5,'#749d81');}
  }
  return true;
}
export function drawSetDressing(c,W,scroll,sector,time){
  const off=(scroll*.33)%580;
  for(let x=-off-80;x<W+580;x+=580){
    if(sector.id==='crew'){
      // A junior crew member behind a service hatch, still refusing to clock out.
      r(c,x+426,355,107,95,'#152a32');r(c,x+433,362,93,81,'#38565a');r(c,x+443,423,73,20,'#899e8d');
      crewmate(c,'pip',x+458,409,time);crewmate(c,'siv',x+500,409,time);r(c,x+435,428,89,4,'#31474f');
      r(c,x+270,126,137,23,'#c9bd8b');txt(c,'DECK 07 / TEMP STAFF',x+277,141,8,'#3b4941');
      r(c,x+299,476,65,27,'#40534e');r(c,x+310,464,40,14,'#d6c19a');txt(c,'FORMS',x+308,493,7,'#b8c0a7');
    }else if(sector.id==='canteen'){
      r(c,x+431,355,94,130,'#263d3e');r(c,x+438,363,80,95,'#b1a67b');txt(c,'LUNCH?',x+453,379,9,'#293e3e');
      eye(c,x+476,416,1.45,'#b4c278',time);r(c,x+451,457,55,17,'#142b31');
      r(c,x+272,473,75,9,'#ba9f77');r(c,x+282,481,8,45,'#6b8577');r(c,x+330,481,8,45,'#6b8577');
      r(c,x+286,454,13,18,'#d1cfa5');r(c,x+299,459,6,7,'#d1cfa5');r(c,x+288,451,10,4,'#abc786');
    }else if(sector.id==='lab'){
      for(let i=0;i<3;i++){r(c,x+437+i*28,386,19,67,'#54786b');r(c,x+440+i*28,391,13,54,'#acbd83');eye(c,x+447+i*28,416,.45,'#d8cb9c',time);}
      r(c,x+430,451,98,16,'#2f4546');txt(c,'ETHICS: PENDING',x+431,483,9,'#c4b67f');
      // An improvised reality engine, assembled from a toaster and bad judgement.
      crewmate(c,'moss',x+283,429,time);r(c,x+306,427,98,7,'#a6997a');r(c,x+314,434,6,61,'#53716a');r(c,x+391,434,6,61,'#53716a');
      r(c,x+335,397,49,29,'#8e9c81');r(c,x+342,392,35,5,'#334d4b');r(c,x+341,406,15,3,'#c0be93');r(c,x+374,409,5,8,'#bfd694');
      const bob=Math.sin(time*.6)*4;eye(c,x+361,371+bob,.65,'#b7c693',time*.4);r(c,x+351,383+bob,20,3,'#819e8d');
      txt(c,'DO NOT FEED IT TIME',x+284,480,7,'#b6b695');
    }else if(sector.id==='machine'){
      for(let i=0;i<5;i++){r(c,x+432,355+i*28,95,22,'#2c4a3c');r(c,x+439,362+i*28,5,8,'#a9c984');r(c,x+453,363+i*28,63,3,'#658369');}
      txt(c,'YOU ARE A RESOURCE',x+266,485,9,'#9cba81');
    }else if(sector.id==='organic'){
      for(let i=0;i<4;i++){const px=x+438+i*25,py=430+Math.sin(time+i)*8;eye(c,px,py,.7,i%2?'#b7c284':'#a896bb',time);r(c,px-5,py+11,4,27,'#a986a5');r(c,px+6,py+11,4,24,'#a986a5');}
      txt(c,'NO BITING IN THE QUEUE',x+257,485,8,'#d7bdab');
    }else{
      r(c,x+448,390+Math.sin(time)*9,69,12,'#9e94a5');r(c,x+467,365+Math.sin(time)*9,22,24,'#bec59e');txt(c,'LOST & UNFOUND',x+268,484,9,'#b9adc8');
    }
    // Small exposed circuits and taped-up repairs tie every room together.
    r(c,x+69,115,8,91,'#b9aa77');r(c,x+65,163,16,8,'#637f75');r(c,x+69,201,24,5,'#b9aa77');
  }
}
export function drawRift(c,x,y,color,label,realm,time){
  c.save();c.translate(Math.round(x),Math.round(y));
  c.fillStyle={organic:'#57334e',machine:'#214d39',aquarium:'#285969',scrapyard:'#65513f'}[realm] || '#343b69';c.beginPath();c.ellipse(0,0,29,PORTAL_RADIUS_Y-4,0,0,Math.PI*2);c.fill();
  for(let i=0;i<40;i++){
    const a=i*Math.PI/20,drift=Math.sin(i*1.7+time*2)*3;
    const px=Math.cos(a)*(30+drift),py=Math.sin(a)*(PORTAL_RADIUS_Y-1+drift);
    r(c,px-5,py-5,10,10,'#1b2b39');r(c,px-3,py-3,6,6,color);
    if(i%5===0)r(c,px*1.2-2,py*1.12-2,4,4,color+'88');
  }
  for(let i=0;i<6;i++){const py=((i*27+time*15)%125)-62;r(c,-17+Math.sin(i+time)*5,py,24,3,color+'35');}
  if(realm==='organic')eye(c,0,0,.8,'#c0b48e',time);else{r(c,-9,-21,18,42,'#c4df9e22');for(let i=0;i<3;i++)r(c,-6,-15+i*14,12,3,color+'99');}
  c.textAlign='center';txt(c,label,0,-91,8,color);c.textAlign='left';c.restore();
}
export function drawDimension(c,W,scroll,sector,time){
  if(!['machine','organic','void','aquarium','scrapyard'].includes(sector.id))return false;
  r(c,0,0,W,600,sector.color);
  if(sector.id==='machine') {
    const off=scroll*.25%64;
    for(let x=-off;x<W+64;x+=64)for(let y=112;y<537;y+=64){
      r(c,x+2,y+2,59,59,'#112c28');r(c,x+7,y+7,49,7,'#5b7450');r(c,x+7,y+21,25,31,'#25473b');r(c,x+39,y+23,10,24,'#4c6d49');r(c,x+12,y+28,4,4,'#a0ba78');
    }
    const off2=scroll*.4%350;
    for(let x=-off2;x<W+350;x+=350){r(c,x+65,195,160,116,'#102a26');r(c,x+72,202,146,102,'#38533d');txt(c,'INDIVIDUALITY',x+82,228,11,'#c0c99a');txt(c,'ARCHIVED.',x+82,247,14,'#c0c99a');for(let i=0;i<4;i++){r(c,x+81+i*32,267,24,24,'#19362f');r(c,x+86+i*32,274,14,5,'#839966');}r(c,x+247,110,12,429,'#69815b');r(c,x+252,150,22,8,'#8da46a');}
  }else if(sector.id==='organic') {
    const off=scroll*.27%285;
    for(let x=-off-80;x<W+285;x+=285){
      r(c,x,111,61,430,'#65445b');r(c,x+9,112,42,426,'#80546c');r(c,x+19,122,19,410,'#966b80');
      for(let y=148;y<510;y+=66){r(c,x+8,y,46,12,'#aa7d8c');r(c,x+15,y+12,33,8,'#493449');}
      eye(c,x+131,215,2.6,'#acbc84',time*.4);eye(c,x+204,290,1.7,'#bea6c2',time*.4+1);
      r(c,x+73,358,157,23,'#b7a795');txt(c,'GUT TRANSIT AUTHORITY',x+79,374,8,'#443d49');
      for(let i=0;i<5;i++){const px=x+84+i*30;eye(c,px,438+Math.sin(time*.7+i)*4,.8,i%2?'#b9be87':'#a69fbb',time);r(c,px-6,450,13,31,'#83778c');r(c,px-9,478,8,18,'#b09aa7');r(c,px+5,478,8,18,'#b09aa7');}
      r(c,x+70,497,172,8,'#a59092');r(c,x+85,505,7,31,'#a59092');r(c,x+219,505,7,31,'#a59092');
    }
  }else if(sector.id==='void') {
    r(c,0,104,W,439,'#202a43');
    for(let i=0;i<70;i++){const x=((i*113-scroll*.09)%W+W)%W,y=122+(i*71)%395;r(c,x,y,i%5?2:4,i%5?2:4,i%3?'#87979f':'#d1baad');}
    const off=scroll*.18%480;
    for(let x=-off;x<W+480;x+=480){
      eye(c,x+240,270,4.7,'#b7a1b8',time*.2);
      for(let i=0;i<6;i++){const px=x+55+i*53,py=160+(i*67)%330+Math.sin(time*.5+i)*10;r(c,px,py,44,11,'#a196a0');r(c,px+5,py+11,32,7,'#526c7e');r(c,px+12,py-13,12,13,'#b2c19f');}
      txt(c,'DEPARTMENT OF IMPOSSIBLE GEOMETRY',x+50,495,8,'#b5a9bd');
    }
  }else if(sector.id==='aquarium') {
    drawAnnex(c,W,scroll,time);
  }else {
    drawScrapyard(c,W,scroll,time);
  }
  r(c,0,0,W,104,'#12232b');r(c,0,98,W,6,'#9dba87');
  r(c,0,541,W,59,'#15262e');r(c,0,541,W,6,sector.id==='organic'?'#ba8e91':'#8ba77b');
  for(let x=-(scroll%74);x<W+74;x+=74)r(c,x,547,27,3,'#6b7e6d');
  return true;
}

function moonFace(c,x,y,radius,bites,age=0){
  c.save();c.translate(Math.round(x),Math.round(y));c.scale(radius/16,radius/16);
  r(c,-18,-12,36,24,'#57656b');r(c,-12,-18,24,36,'#57656b');
  r(c,-16,-11,32,22,'#e0d4b1');r(c,-11,-16,22,32,'#e0d4b1');
  r(c,-12,-9,6,5,'#aaa58e');r(c,7,-11,5,4,'#b9b499');r(c,5,8,7,4,'#b4ad94');
  const mood=Math.floor(age*1.7)%3,blink=age%2.3>2.13;
  const look=Math.round(Math.sin(age*3)*1.5);
  for(const px of [-9,4]){
    r(c,px,-5,5,blink?2:6,'#f2ecd0');
    if(!blink)r(c,px+2+look,-4,2,4,'#334751');
  }
  if(mood===1){r(c,-10,-10,6,2,'#7b806f');r(c,-6,-8,3,2,'#7b806f');r(c,4,-8,3,2,'#7b806f');r(c,7,-10,4,2,'#7b806f');}
  else {r(c,-11,-10-mood,7,2,'#7b806f');r(c,4,-10+Math.round(Math.sin(age*4)),7,2,'#7b806f');}
  if(bites||mood===1){r(c,-6,4,12,7,'#59615d');for(let i=0;i<3;i++)r(c,-5+i*4,4,2,2,'#f3ebce');}
  else if(mood===0){r(c,-3,4,6,8,'#59615d');r(c,-1,6,2,4,'#323f42');}
  else {r(c,-6,5,4,2,'#59615d');r(c,-2,3,4,2,'#59615d');r(c,2,5,4,2,'#59615d');}
  c.restore();
}
export function drawShot(c,shot){
  const color=WEAPONS[shot.kind].color;
  if(shot.kind==='moon'){
    c.save();c.globalAlpha=Math.min(1,(5-shot.age)*2);c.translate(shot.x,shot.y);c.rotate(shot.vy*.0015);
    moonFace(c,0,0,shot.upgraded?40:32,shot.hits.size,shot.age);c.restore();return;
  }
  if(shot.kind==='torpedo'){
    c.save();c.translate(shot.x,shot.y);c.rotate(Math.atan2(shot.vy,WEAPONS.torpedo.speed));
    r(c,-67,-4,49,8,'#d5854b33');r(c,-47,-2,29,4,'#f6c17b');
    r(c,-19,-7,31,14,'#b16d55');r(c,-15,-5,29,10,'#f4bd82');r(c,11,-3,9,6,'#fff0ba');
    r(c,-23,-12,9,24,'#809e9d');r(c,-24,-3,11,6,'#ffe7a1');c.restore();
  }else{r(c,shot.x-11,shot.y-2,17,4,color);r(c,shot.x-18,shot.y-1,8,2,'#8ebaaa');}
}
export function drawGear(c,gear){
  const {x,y,kind}=gear,weapon=WEAPONS[kind],color=weapon.color;
  r(c,x-27,y-23,54,46,'#172f3a');r(c,x-25,y-21,50,42,weapon.ammo?'#6a6960':'#42616b');
  if(kind==='moon')moonFace(c,x,y,19,0,gear.age??0);
  else if(kind==='tape'){
    r(c,x-7,y-18,14,19,'#c1a985');r(c,x-21,y,42,13,'#bc7f72');r(c,x-23,y+13,46,4,'#e5b59a');
  }else if(kind==='fork'){
    r(c,x-9,y-14,8,29,'#8295a0');r(c,x-1,y-15,23,5,color);r(c,x-1,y+11,23,5,color);
  }else if(kind==='torpedo'){
    for(let i=0;i<3;i++){r(c,x-17,y-13+i*10,31,6,'#d5a17e');r(c,x+12,y-11+i*10,7,2,'#f5deaa');}
  }else if(kind==='beam'){
    r(c,x-20,y-8,33,16,'#7d7565');r(c,x+12,y-13,9,26,color);r(c,x+21,y-5,5,10,'#f8e4b1');
  }else{r(c,x-15,y-5,30,7,color);r(c,x-8,y+2,5,8,'#a7c19c');}
  c.textAlign='center';txt(c,weapon.name+(weapon.ammo?` · ${weapon.ammo}`:''),x,y-33,10,color);c.textAlign='left';
}

function drawAnnex(c,W,scroll,time){
  r(c,0,104,W,437,'#193641');
  const off=scroll*.2%420;
  for(let x=-off-80;x<W+420;x+=420){
    r(c,x+12,125,388,368,'#345c63');r(c,x+20,134,372,350,'#244b57');
    for(let i=0;i<5;i++){
      const px=x+46+i*71,py=162+(i*63)%260;
      r(c,px,py,2,130,'#5c858355');
      for(let b=0;b<3;b++){const by=475-((time*13+i*47+b*89)%315);r(c,px+10+Math.sin(time+i)*4,by,3,3,'#80aea078');}
    }
    const bob=Math.sin(time*.55)*10;
    // A tenured specimen. Its tie is completely unnecessary.
    eye(c,x+226,246+bob,3.4,'#749c99',time*.3);
    for(let i=0;i<5;i++)r(c,x+168+i*25,285+bob,7,66+Math.sin(time+i)*13,'#698e96');
    r(c,x+218,294+bob,13,31,'#a6857b');r(c,x+214,288+bob,21,8,'#b3b6a1');
    r(c,x+42,425,134,23,'#859e94');txt(c,'DO NOT PROMOTE THE FISH',x+48,440,8,'#283f48');
    r(c,x+12,494,388,14,'#54757a');r(c,x+28,505,8,34,'#314c58');r(c,x+380,505,8,34,'#314c58');
    r(c,x+4,115,8,425,'#6b8784');
  }
}
function drawScrapyard(c,W,scroll,time){
  r(c,0,104,W,437,'#34383f');
  // A moon piled with abandoned fleet hardware; the air lane stays clear.
  r(c,W*.72-34,150,68,68,'#8b8d7b');r(c,W*.72-10,159,23,14,'#777b70');
  for(let i=0;i<23;i++){const x=((i*127-scroll*.06)%W+W)%W;r(c,x,125+(i*61)%260,2,2,'#b6ac9388');}
  const off=scroll*.22%470;
  for(let x=-off-80;x<W+470;x+=470){
    for(let i=0;i<8;i++){
      const px=x+i*61,py=457+(i%3)*16;
      r(c,px,py,72,535-py,i%2?'#626661':'#6e685c');r(c,px+9,py+8,40,8,'#8f8b71');r(c,px+16,py+23,19,12,'#31434a');
    }
    r(c,x+60,160,9,329,'#8b8972');r(c,x+60,161,200,9,'#8b8972');
    r(c,x+250,170,3,120,'#a59c7a');const sway=Math.sin(time*.6)*9;
    limb(c,x+251,290,x+241+sway,308,4,'#9e987e');limb(c,x+251,290,x+265+sway,307,4,'#9e987e');
    // The scrapyard crane carefully salvages one disposable spoon.
    r(c,x+250+sway,307,3,20,'#c4b59a');r(c,x+247+sway,305,9,7,'#c4b59a');
    r(c,x+295,365,137,27,'#b29f7c');txt(c,'NO REFUNDS. NO PLANET.',x+301,382,8,'#3d4444');
  }
}

// Deterministic vignettes are part of scenery, never simulation entities.
// The tile identity varies with travel; animation never swaps the current room.
export function drawAmbient(c,W,scroll,sector,time){
  const travel=scroll*.28,first=Math.floor(travel/620)-1;
  c.save();c.beginPath();c.rect(0,125,W,401);c.clip();c.globalAlpha=.58;
  for(let tile=first;tile*620-travel<W;tile++){
    const x=tile*620-travel+150,variant=((tile%4)+4)%4;
    const phase=(time*.17+variant*.23)%1;
    const y=variant%2?461:407;
    if(['crew','canteen','lab'].includes(sector.id)){
      r(c,x-38,y-49,124,93,'#1a3039');r(c,x-32,y-43,112,81,'#314b53');
      if(variant===0){
        crewmate(c,'pip',x+8,y+14,time);const mugX=x+40+Math.sin(time)*8;
        r(c,mugX,y-5,12,14,'#c1bea0');r(c,mugX+12,y-2,5,6,'#c1bea0');
        r(c,x-25,y+29,94,5,'#8c9e8e');txt(c,'ZERO-G COFFEE',x-27,y-32,7,'#b0b8a2');
      }else if(variant===1){
        crewmate(c,'siv',x+42,y+13,time);r(c,x-23,y-4,31,22,'#849a8a');eye(c,x-8,y+1,.55,'#b3c09a',time);
        const paper=phase*20;r(c,x-8+paper,y-18-paper,13,7,'#c0bfa1');txt(c,'FORM EATS FORM',x-27,y-32,7,'#b0b8a2');
      }else if(variant===2){
        crewmate(c,'moss',x+10,y+14,time);eye(c,x+51,y-8,1,'#aab68e',time);
        r(c,x+45,y+3,12,25,'#7d9a81');r(c,x+34,y+16,34,4,'#7d9a81');txt(c,'INTERN OF THE MONTH',x-27,y-32,7,'#b0b8a2');
      }else{
        const bot=x-18+phase*58;r(c,bot,y+15,32,17,'#8a9b91');r(c,bot+6,y+19,5,4,'#b7bfa1');
        for(let i=0;i<3;i++)r(c,x+43+Math.sin(time+i)*13,y-13+i*10,13,6,'#b3b49b');txt(c,'PAPERLESS BY FRIDAY',x-27,y-32,7,'#b0b8a2');
      }
    }else if(sector.id==='machine'){
      r(c,x-32,y-53,126,88,'#254337');crewmate(c,'siv',x+48,y+12,time);
      const paperY=y-19+phase*32;r(c,x-18,paperY,16,9,'#9fae89');r(c,x-25,y+13,45,24,'#668269');
      txt(c,variant%2?'PLEASE WAIT FOREVER':'WE ASSIMILATE TONER',x-25,y-33,7,'#a5b390');
    }else if(sector.id==='organic'){
      eye(c,x+15,y-12,1.8,'#a5b98b',time*.6);r(c,x+1,y+10,28,24,'#997c90');
      r(c,x+34,y-2,21,5,'#afa18e');r(c,x+46,y-12,8,10,'#bfb59a');txt(c,'LUNCH BREAK',x-22,y-45,7,'#c6b19f');
    }else if(sector.id==='void'){
      c.save();c.translate(x+15,y-6);c.rotate(Math.sin(time*.3)*.5);
      r(c,-23,-17,46,34,'#75828b');r(c,-18,-12,36,24,'#334c5b');txt(c,'OUT',-10,3,10,'#bbb3b9');c.restore();
      r(c,x-28,y+34,89,5,'#8b8a98');txt(c,'EXIT CURRENTLY AWAY',x-26,y-43,7,'#b7aabf');
    }else if(sector.id==='aquarium'){
      const bob=Math.sin(time+variant)*5;eye(c,x+15,y-16+bob,1.2,'#92b4a4',time);
      r(c,x-8,y+3+bob,44,3,'#a9baaa');r(c,x+32,y-1+bob,12,9,'#c9b397');
      txt(c,variant%2?'PEER REVIEW: BLUB':'SENIOR GILL OFFICER',x-34,y-47,7,'#b6c6b2');
    }else{
      r(c,x-25,y-18,63,38,'#7e7969');r(c,x-16,y-12,45,19,'#3d5257');
      eye(c,x+6,y-3,.6,'#b6b992',time);r(c,x-21,y+20,7,12,'#aca081');r(c,x+25,y+20,7,12,'#aca081');
      r(c,x+42,y-12,24,26,'#a49676');txt(c,variant%2?'RETIRED. STILL WORKING.':'CERTIFIED PRE-EXPLODED',x-35,y-40,7,'#bfb391');
    }
  }
  c.restore();
}

export function drawLoot(c,loot,time) {
  const kind=loot.kind??'salvage',color=LOOT[kind].color;
  c.save();c.translate(loot.x,loot.y);c.scale(1+Math.sin(time*3+loot.phase)*.06,1+Math.sin(time*3+loot.phase)*.06);
  if(kind==='cell') {
    r(c,-7,-13,14,26,'#526862');r(c,-5,-10,10,20,color);r(c,-3,-16,6,4,'#c6d5a7');r(c,-2,-6,4,12,'#e8e0a8');
  }else if(kind==='data') {
    c.fillStyle=color;c.beginPath();c.moveTo(0,-14);c.lineTo(13,-7);c.lineTo(13,8);c.lineTo(0,15);c.lineTo(-13,8);c.lineTo(-13,-7);c.closePath();c.fill();
    r(c,-9,-4,18,12,'#486b78');r(c,-6,-2,4,8,'#c2e4cc');r(c,3,-2,4,8,'#c2e4cc');r(c,-1,-13,2,8,'#d0e3c8');
  }else if(kind==='relic') {
    for(let i=0;i<4;i++){const a=i*Math.PI/2+time*.5;r(c,Math.cos(a)*11-3,Math.sin(a)*11-3,6,6,color);}
    r(c,-7,-10,14,20,color);r(c,-11,-5,22,10,color);r(c,-4,-3,3,3,'#473e5c');r(c,3,-3,3,3,'#473e5c');r(c,-2,4,5,2,'#e5d5ba');r(c,-1,-13,3,8,'#e6d2c2');r(c,-4,-10,9,3,'#e6d2c2');
  }else {
    c.fillStyle=color;c.strokeStyle='#f3d18a';c.lineWidth=2;c.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/6;i?c.lineTo(Math.cos(a)*10,Math.sin(a)*10):c.moveTo(Math.cos(a)*10,Math.sin(a)*10);}c.closePath();c.fill();c.stroke();
    r(c,-1,-6,3,5,'#725d3b');r(c,-3,-2,6,3,'#725d3b');r(c,-1,0,3,6,'#725d3b');
  }
  c.restore();
}
