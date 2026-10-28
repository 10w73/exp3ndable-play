import {drawColleague} from './art.js';

// Background workplaces use large silhouettes and slow physical jokes, never
// instructions, pickups or collision bodies. All positions are world coordinates.
const BAY=720;
function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);}
function stroke(c,x,y,x2,y2,color,width=3){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();}
function disc(c,x,y,r,color){c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
function paper(c,x,y,angle=0){
  c.save();c.translate(x,y);c.rotate(angle);rect(c,-12,-16,24,32,'#a9b5a5');
  rect(c,-7,-9,14,3,'#586e6c');rect(c,-7,-2,10,3,'#586e6c');c.restore();
}
function mug(c,x,y,size=1){
  rect(c,x,y,24*size,29*size,'#9ea997');rect(c,x+23*size,y+5*size,12*size,17*size,'#9ea997');
  rect(c,x+24*size,y+9*size,6*size,9*size,'#334b50');rect(c,x+3*size,y,18*size,5*size,'#4c5146');
}
function worker(c,x,y,time,variant=0){
  c.save();c.translate(x,y);c.scale(1.2,1.2);
  drawColleague(c,['pip','siv','moss'][variant%3],0,0,time);c.restore();
}
function counter(c,x,y,width=240){
  rect(c,x,y,width,13,'#91a18f');rect(c,x+12,y+13,10,64,'#4e696a');rect(c,x+width-22,y+13,10,64,'#4e696a');
}
function conveyor(c,x,y,width,time){
  rect(c,x,y,width,15,'#405b5e');
  for(let i=0;i<width;i+=28){disc(c,x+i+9,y+7,5,'#80918a');}
  const shift=(time*15)%28;
  for(let i=-28;i<width;i+=28)rect(c,x+Math.max(0,i+shift),y-4,Math.min(10,width-Math.max(0,i+shift)),3,'#92a08e');
}
function stampMachine(c,x,y,time,variant){
  const down=Math.max(0,Math.sin(time*.8))*24;
  rect(c,x-63,y-100,126,17,'#718581');rect(c,x-63,y-100,13,124,'#718581');rect(c,x+50,y-100,13,124,'#718581');
  rect(c,x-7,y-84,14,52+down,'#8c9e8e');rect(c,x-34,y-36+down,68,19,'#a39180');
  counter(c,x-78,y+25,160);paper(c,x,y+10);
  // A large stamp handles one tiny sheet; its rejected output circles back in.
  const phase=(time*.11+variant*.3)%1;
  paper(c,x+90+Math.sin(phase*Math.PI*2)*38,y-10-Math.cos(phase*Math.PI*2)*38,phase*.4);
  stroke(c,x+83,y+36,x+143,y+36,'#68837d',5);stroke(c,x+143,y+36,x+143,y-83,'#68837d',5);
}
function coffeeDesk(c,x,y,time,variant){
  counter(c,x-95,y+23,240);worker(c,x-48,y-12,time,variant);
  // The cup is bigger than its attendant. A tiny tap drips beside it, not into it.
  mug(c,x+27,y-83,3);rect(c,x+6,y-111,104,10,'#6a8582');rect(c,x+6,y-111,10,62,'#6a8582');
  const drip=(time*22)%62;rect(c,x+2,y-41+drip,5,8,'#9aab9e');
  mug(c,x-11,y-7,.65);paper(c,x-83,y+4,-.12);
}
function cleaningDesk(c,x,y,time,variant){
  // One worker pushes a mop while the machine faithfully makes another puddle.
  const step=Math.sin(time*.35)*24;
  worker(c,x-60+step,y-9,time,variant);stroke(c,x-37+step,y-34,x+6+step,y+39,'#9aa48d',5);
  rect(c,x-5+step,y+35,39,7,'#7b9990');rect(c,x+24,y+37,62,7,'#6e8c85');
  rect(c,x+56,y-38,62,64,'#587778');rect(c,x+62,y-32,49,24,'#8c9e8d');
  rect(c,x+76,y+26,10,8,'#9aab9e');rect(c,x+72,y+34+(time*12)%8,6,5,'#9aab9e');
}
function ship(c,x,y,time,variant,room){
  if(room==='canteen') {
    coffeeDesk(c,x,y,time,variant);
    if(variant===1){worker(c,x+188,y+1,time,1);mug(c,x+205,y-48,1.1);}
    else {rect(c,x-211,y-104,68,136,'#536d66');mug(c,x-196,y-77,1.5);rect(c,x-220,y+35,96,9,'#889a85');}
  } else if(room==='lab') {
    counter(c,x-154,y+25,320);worker(c,x-122,y-10,time,variant);
    // A toaster levitates an entire filing cabinet, connected by a loose cable.
    rect(c,x-38,y-17,70,42,'#8c9b86');rect(c,x-29,y-21,51,7,'#344b4c');
    const bob=Math.sin(time*.5)*9;
    rect(c,x+74,y-133+bob,79,130,'#718981');
    for(let i=0;i<3;i++){rect(c,x+81,y-124+bob+i*39,65,32,'#87998b');rect(c,x+105,y-113+bob+i*39,18,4,'#425e60');}
    stroke(c,x+30,y+14,x+63,y+43,'#7c8c7a',3);stroke(c,x+63,y+43,x+102,y+10,'#7c8c7a',3);
    paper(c,x+112,y-159+bob,.2);
  } else if(variant===0){stampMachine(c,x,y,time,variant);worker(c,x-125,y-4,time,variant);}
  else if(variant===1)coffeeDesk(c,x,y,time,variant);
  else cleaningDesk(c,x,y,time,variant);
}
function machine(c,x,y,time,variant){
  stampMachine(c,x,y,time,variant);worker(c,x-145,y+1,time,variant);
  // The queue turns back into the same hatch. No flashing alerts or tiny copy.
  for(let i=0;i<3;i++){paper(c,x-195+i*38,y-38-i*8,-.12);}
  rect(c,x+181,y-134,53,178,'#56736b');rect(c,x+189,y-125,37,23,'#91a18c');
  rect(c,x+188,y+22,40,8,'#263e42');
}
function organic(c,x,y,time,variant){
  counter(c,x-130,y+25,270);worker(c,x-97,y-9,time,variant);
  // Lunch is serving the employee: a large soft mouth offers a cup on a tray.
  const breath=Math.sin(time*.45)*5;
  disc(c,x+83,y-40,64+breath,'#977a87');disc(c,x+83,y-35,43,'#594650');
  rect(c,x+57,y-48,13,13,'#c2b6a1');rect(c,x+93,y-48,13,13,'#c2b6a1');
  stroke(c,x+104,y+5,x+162,y-13,'#a28c99',12);rect(c,x+140,y-20,63,7,'#a7ad99');mug(c,x+161,y-46,.85);
}
function voidOffice(c,x,y,time,variant){
  // The desk remains bolted down; the employee and office supplies drift overhead.
  counter(c,x-140,y+30,280);rect(c,x-8,y+43,16,49,'#819087');
  const bob=Math.sin(time*.45+variant)*18;
  c.save();c.translate(x,y-61+bob);c.rotate(Math.sin(time*.2)*.18);
  worker(c,0,0,time,variant);paper(c,84,-22,.3);mug(c,-74,-5);c.restore();
  stroke(c,x-13,y+30,x-13,y-7+bob,'#7e9190',2);
}
function aquarium(c,x,y,time,variant){
  counter(c,x-110,y+28,250);worker(c,x-85,y-7,time,variant);
  // The fish has the office chair; the human waits outside the tank with forms.
  rect(c,x+15,y-142,140,153,'#678b8c');rect(c,x+23,y-134,124,137,'#355e68');
  const swim=Math.sin(time*.35)*14;
  c.fillStyle='#91aaa0';c.beginPath();c.ellipse(x+84+swim,y-76,39,23,0,0,Math.PI*2);c.fill();
  rect(c,x+42+swim,y-86,12,23,'#91aaa0');rect(c,x+104+swim,y-81,5,5,'#314e57');
  rect(c,x+84,y-50,10,20,'#8e817b');rect(c,x+40,y-22,81,7,'#809c98');paper(c,x-39,y+7,-.1);
}
function scrapyard(c,x,y,time,variant){
  const sway=Math.sin(time*.25)*17;
  rect(c,x-145,y-154,15,213,'#829087');rect(c,x-145,y-154,310,15,'#829087');
  stroke(c,x+109,y-139,x+109+sway,y-47,'#99a18f',3);
  // An enormous crane carefully carries a tiny spoon over an unattended desk.
  rect(c,x+105+sway,y-43,8,26,'#b4b6a1');disc(c,x+109+sway,y-47,8,'#b4b6a1');
  counter(c,x+3,y+32,207);worker(c,x-58,y+1,time,variant);paper(c,x+48,y+12);
}

/** Draw spatially stable, text-independent workplaces behind the clear flight lane. */
export function drawWorkplaces(c,width,scroll,sector,time){
  const travel=scroll*.28,first=Math.floor(travel/BAY)-1;
  c.save();c.beginPath();c.rect(0,145,width,375);c.clip();c.globalAlpha=.75;
  for(let bay=first;bay*BAY-travel<width;bay++){
    const x=bay*BAY-travel,variant=((bay%3)+3)%3;
    // The void keeps long empty stretches with one occasional floating office.
    if(sector.id==='void'){if(variant===0)voidOffice(c,x+360,397,time,variant);continue;}
    // Connected utility runs and recessed doors make adjacent bays one place.
    rect(c,x+56,478,BAY-112,5,'#526e70');rect(c,x+58,203,8,275,'#486568');
    rect(c,x+88,307,67,168,'#344f56');rect(c,x+94,314,55,153,'#466269');rect(c,x+134,381,5,15,'#81948b');
    rect(c,x+152,224,465,249,'#203942');rect(c,x+158,230,453,237,'#2c4851');
    conveyor(c,x+174,468,420,time+variant*3);
    const center=x+360,y=397;
    if(['crew','canteen','lab'].includes(sector.id))ship(c,center,y,time,variant,sector.id);
    else if(sector.id==='machine')machine(c,center,y,time,variant);
    else if(sector.id==='organic')organic(c,center,y,time,variant);
    else if(sector.id==='aquarium')aquarium(c,center,y,time,variant);
    else scrapyard(c,center,y,time,variant);
    // Glass edge and a low-contrast reflection keep all activity behind the player.
    rect(c,x+149,223,471,7,'#5d797a');rect(c,x+149,223,7,253,'#5d797a');rect(c,x+613,223,7,253,'#5d797a');
    stroke(c,x+172,244,x+254,453,'#7d9b991a',13);
  }
  c.restore();
}
