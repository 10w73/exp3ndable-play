import {HEIGHT,CEILING,FLOOR,pendulumPoints} from './engine.js';
import {isCreature} from './creatures.js';
import {drawCreature} from './creature-art.js';
import {drawCrew,sectorFor,drawWorldWindow,drawSetDressing,drawRift,drawDimension,drawShuttle,drawAmbient,drawShot,drawGear,drawLoot} from './art.js';

/** Own Canvas rendering separately from input, DOM updates and fixed-step simulation. */
export function createRenderer(canvas) {
  const ctx=canvas.getContext('2d',{alpha:false});
  let W=1200,time=0,run;
  function rect(x,y,w,h,color,r=0) { ctx.fillStyle=color; ctx.beginPath(); if(r) ctx.roundRect(x,y,w,h,r); else ctx.rect(x,y,w,h); ctx.fill(); }
  function line(x,y,x2,y2,color,width=1) { ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke(); }
  function ellipse(x,y,rx,ry,color) { ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,Math.abs(rx),Math.abs(ry),0,0,Math.PI*2);ctx.fill(); }
  function text(value,x,y,size,color,align='left',font='monospace') {ctx.font=`${size}px ${font}`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(value,x,y);ctx.textAlign='left';}
  function bolt(x,y,scale=1,color='#d8f66f') {ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(3,-12);ctx.lineTo(-8,2);ctx.lineTo(0,2);ctx.lineTo(-3,13);ctx.lineTo(9,-3);ctx.lineTo(1,-3);ctx.closePath();ctx.fill();ctx.restore();}

  function stars(x,y,w,h,shift,color='#d3e6d8') {
    for(let i=0;i<34;i++) {
      const sx = ((i*139.7 + i*i*7.4 - shift*.14) % w + w) % w;
      const sy = ((i*93.7 + i*i*1.9) % h);
      const a=.3+((i*7)%10)/18; ctx.globalAlpha=a;
      rect(x+sx,y+sy,i%8===0?2:1,i%8===0?2:1,color);
    } ctx.globalAlpha=1;
  }
  function planet(x,y,r) {
    ctx.save();ctx.translate(x,y);ctx.rotate(-.28);
    ctx.strokeStyle='#9d9e79';ctx.lineWidth=r*.15;
    ctx.beginPath();ctx.ellipse(0,0,r*1.8,r*.38,0,Math.PI,Math.PI*2);ctx.stroke();
    ellipse(0,0,r,r,'#c6aa7d');
    ctx.save();ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.clip();
    for(let i=0;i<6;i++) rect(-r,-r+i*r*.39,r*2,r*.12,i%2?'#a98d6b':'#d6bb8b');
    ellipse(r*.65,-r*.03,r*.72,r*1.12,'#6c756b55');ctx.restore();
    ctx.strokeStyle='#beb395';ctx.lineWidth=r*.15;
    ctx.beginPath();ctx.ellipse(0,0,r*1.8,r*.38,0,0,Math.PI);ctx.stroke();ctx.restore();
  }
  function windowPanel(x,y,w,h,scroll,sector) {
    rect(x-10,y-10,w+20,h+20,'#101f29',26); rect(x-5,y-5,w+10,h+10,'#4c6a74',21);
    rect(x,y,w,h,'#0c202b',17);
    ctx.save();ctx.beginPath();ctx.roundRect(x+2,y+2,w-4,h-4,16);ctx.clip();
    const g=ctx.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,'#213a48');g.addColorStop(1,'#102431');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
    stars(x,y,w,h,scroll); if(!drawWorldWindow(ctx,x,y,w,h,sector,time))planet(x+w*.62,y+h*.43,h*.29);
    line(x+22,y+h-14,x+w-18,y+20,'#92c8c810',18);line(x+50,y+h,x+w+10,y+13,'#92c8c810',6);ctx.restore();
    rect(x+w*.48,y+1,7,h-2,'#304b59');rect(x,y+h*.7,w,5,'#304b59');
    for(const [bx,by] of [[x-5,y-4],[x+w+4,y-4],[x-5,y+h+4],[x+w+4,y+h+4]]) ellipse(bx,by,2,2,'#a5b6b4');
  }
  function background(scroll,sector) {
    if(drawDimension(ctx,W,scroll,sector,time))return;
    const g=ctx.createLinearGradient(0,0,0,HEIGHT);g.addColorStop(0,sector.color);g.addColorStop(.55,sector.color);g.addColorStop(1,'#172a35');ctx.fillStyle=g;ctx.fillRect(0,0,W,HEIGHT);
    const spacing=580, off=(scroll*.33)%spacing;
    for(let x=-off-80;x<W+spacing;x+=spacing) {
      rect(x,CEILING,2,FLOOR-CEILING,'#79969b15');
      windowPanel(x+100,162,310,235,scroll,sector);
      rect(x+442,203,92,124,'#142b35',6);rect(x+450,211,76,108,'#344c53',3);
      text('SAFETY',x+488,235,10,'#d4c78b','center');text('THIRD',x+488,249,10,'#d4c78b','center');
      ctx.strokeStyle='#e3bf6f';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+488,264);ctx.lineTo(x+472,289);ctx.lineTo(x+504,289);ctx.closePath();ctx.stroke();text('!',x+488,285,17,'#e3bf6f','center');
      rect(x+100,420,135,53,'#182c35',4);for(let i=0;i<9;i++)rect(x+109+i*14,429,6,32,'#344c53',2);
      rect(x+255,427,92,35,'#1a3039',4);text('O₂  21%',x+265,449,10,'#87a894');
      rect(x+385,433,140,31,'#d7d7b00c',2);text('AUTHORIZED PERSONNEL-ISH',x+392,451,7,'#7b969a');
      line(x+40,126,x+40,492,'#46636a',8);line(x+40,126,x+40,492,'#253d45',4);
      rect(x+26,322,28,42,'#536963',4);bolt(x+40,343,.6,'#b8c78e');
    }
    drawSetDressing(ctx,W,scroll,sector,time);
    // Structural ribs and ceiling utilities frame a clear flight lane.
    rect(0,0,W,CEILING,'#142630');rect(0,CEILING-17,W,17,'#425b60');rect(0,CEILING-8,W,4,'#829a8e');
    const topOff=(scroll*.65)%290;
    for(let x=-topOff;x<W+290;x+=290){rect(x+20,77,126,5,'#cdd9b4',2);rect(x+168,34,72,17,'#0d1c25',3);rect(x+175,39,10,6,'#c7b986',1);rect(x+191,39,35,6,'#365158',1);line(x+8,0,x+8,CEILING-17,'#263f47',12);}
    rect(0,FLOOR,W,HEIGHT-FLOOR,'#14252e');rect(0,FLOOR,W,9,'#65766a');rect(0,FLOOR+9,W,5,'#293c3f');
    const floorOff=scroll%70;
    for(let x=-floorOff;x<W+70;x+=70){ctx.fillStyle='#b4a965';ctx.beginPath();ctx.moveTo(x,FLOOR+1);ctx.lineTo(x+16,FLOOR+1);ctx.lineTo(x+5,FLOOR+8);ctx.lineTo(x-11,FLOOR+8);ctx.fill();line(x,FLOOR+19,x-15,HEIGHT,'#29404a',2);}
    const ribOff=(scroll*.72)%860;
    for(let x=-ribOff+650;x<W+150;x+=860){rect(x-9,CEILING,24,FLOOR-CEILING,'#10242b');rect(x-5,CEILING,9,FLOOR-CEILING,'#486268');rect(x+4,CEILING,6,FLOOR-CEILING,'#253f48');for(let y=130;y<FLOOR;y+=90)rect(x-4,y,8,3,'#8ba298');}
    const shade=ctx.createLinearGradient(0,0,0,HEIGHT);shade.addColorStop(0,'#0b1b2d55');shade.addColorStop(.45,'#071c2400');shade.addColorStop(1,'#0a1b2d66');ctx.fillStyle=shade;ctx.fillRect(0,0,W,HEIGHT);
  }

  function player(x,y,thrust,scale=1,vy=0) { drawCrew(ctx,x,y,thrust,scale,vy,time,run?run.weapon:'ion',!!run&&!thrust&&run.player.y>=FLOOR-22.5&&Math.abs(vy)<5,run?.scroll || 0); }
  function laser(o) {
    const horizontal=o.type==='horizontal';
    ctx.save();ctx.translate(o.x,o.y);if(horizontal)ctx.rotate(Math.PI/2);if(o.type==='spinner')ctx.rotate(o.angle-Math.PI/2);
    const h=horizontal?o.w:o.type==='spinner'?o.w:o.h;
    rect(-14,-h/2-6,28,h+12,'#fa806b10',6);
    rect(-7,-h/2,14,h,'#fa655366',5);rect(-3,-h/2,6,h,'#ff9a7b',2);rect(-1,-h/2,2,h,'#ffe1b2');
    for(const end of [-1,1]) {const y=end*h/2;rect(-17,y-9,34,18,'#192a32',5);rect(-12,y-7,24,14,'#647a79',3);if(o.hp!==undefined){for(let i=0;i<4;i++)rect(-10+i*6,y-3,4,6,i<o.hp?'#ff9b78':'#31454c');}else rect(-6,y-3,12,6,'#ff9b78',2);}
    if(o.type==='spinner'){ellipse(0,0,13,13,'#273f49');ellipse(0,0,7,7,'#f0ac80');}
    ctx.restore();
  }
  function drawObstacle(o,sector) {
    if(o.type==='pendulum') {
      const points=pendulumPoints(o),warning=o.warning>0;
      for(let i=0;i<2;i++) {
        const a=points[i],b=points[i+1];
        if(warning){ctx.setLineDash([7,8]);line(a.x,a.y,b.x,b.y,'#c29c8777',3);ctx.setLineDash([]);}
        else {line(a.x,a.y,b.x,b.y,'#f4806528',15);line(a.x,a.y,b.x,b.y,'#df806c',7);line(a.x,a.y,b.x,b.y,'#f0ccb0',2);}
      }
      for(const [i,p] of points.entries()){ellipse(p.x,p.y,i===0?12:10,i===0?12:10,'#203842');ellipse(p.x,p.y,6,6,warning?'#a3ab8c':'#d9947c');}
      for(let i=0;i<4;i++)rect(o.x-12+i*7,o.y-20,4,3,i<o.hp?'#d7a184':'#466163');
      return;
    }
    if(isCreature(o.type)){drawCreature(ctx,o,sector,time);return;}
    if(['laser','horizontal','spinner'].includes(o.type)) {laser(o);return;}
    if(o.type==='crusher') {
      const x=o.x-o.w/2,y=o.y-o.h/2;rect(x-4,y-3,o.w+8,o.h+6,'#11252c',5);rect(x,y,o.w,o.h,'#64716b',4);rect(x+8,y+5,o.w-16,o.h-10,'#354b4c',2);
      for(let i=0;i<6;i++) {rect(x+13,y+11+i*23,o.w-26,7,'#a99763',1);rect(x+13,y+18+i*23,o.w-26,3,'#1b343c');}
      rect(x+4,y+o.h/2-5,o.w-8,10,'#ec8a68',2);return;
    }
    if(o.type==='missile') {
      if(o.warning>0) {
        rect(W-42,o.y-18,30,36,'#633b3b',6);text('!',W-27,o.y+8,23,'#ff9879','center');line(W-80,o.y,W-52,o.y,'#ff826b88',2);return;
      }
      ctx.save();ctx.translate(o.x,o.y);ctx.fillStyle='#f39a6d';ctx.beginPath();ctx.moveTo(26,-7);ctx.lineTo(54+Math.sin(time*60)*7,0);ctx.lineTo(26,8);ctx.fill();rect(-22,-11,49,22,'#b1bbaa',6);ctx.fillStyle='#ff8d74';ctx.beginPath();ctx.moveTo(-38,0);ctx.lineTo(-16,-12);ctx.lineTo(-16,12);ctx.fill();rect(16,-17,7,34,'#6d8380',2);text('HR',-6,4,9,'#273f47','center');ctx.restore();
    }
  }
  function drawPortal(portal) {
    drawRift(ctx,portal.x,portal.y,'#acd1b3',portal.realm==='ship'?'Your ship':sectorFor({realm:portal.realm}).name,portal.realm,time);
    line(portal.x-22,portal.y,portal.x+22,portal.y,'#d8c6a966',1);
    text('↑',portal.x,portal.y-26,12,'#d2e4c5','center');
    text('×2',portal.x,portal.y+32,10,'#d6c4d9','center');
  }
  function attract() {
    const x=W>750?W*.7:W*.76, y=HEIGHT*.55+Math.sin(time*1.9)*13;
    for(let i=0;i<5;i++)drawLoot(ctx,{x:x+95+i*40,y:y-37-Math.sin(i*.65)*65,phase:i*.4,kind:i===3?'data':'salvage'},time);
    if(W>700)laser({type:'laser',x:W*.93,y:200,h:115});
    // A little shuttle through the distant viewport.
    player(x,y,true,W>700?1.85:1.3,Math.sin(time)*70);

  }
  return {
    /** Keep the original small pixel grid while viewport width changes. */
    resize(width) {
      W=width;canvas.height=360;canvas.width=Math.round(W*canvas.height/HEIGHT);
      ctx.setTransform(canvas.width/W,0,0,canvas.height/HEIGHT,0,0);
      ctx.imageSmoothingEnabled=false;
    },
    /** Draw one view of the current world; never mutate the simulation. */
    draw(state) {
      ({run,time}=state);
      const {mode,held,particles,fx,shake,flash}=state;

      ctx.save();
      if(shake>0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
      const scroll=run?run.scroll:time*45;
      const sector=sectorFor(run);
      background(scroll,sector);
      drawAmbient(ctx,W,scroll,sector,run?.elapsed ?? time);
      fx.drawBack(ctx);
      if(run) {
        for(const c of run.coins)drawLoot(ctx,c,time);
        for(const shot of run.shots)drawShot(ctx,shot);
        if(run.gear)drawGear(ctx,run.gear);
        if(run.medkit) {
          const {x,y}=run.medkit;
          rect(x-21,y-17,42,34,'#203a36',3);rect(x-18,y-14,36,28,'#b4c8ad',2);
          rect(x-4,y-10,8,20,'#476d58');rect(x-10,y-4,20,8,'#476d58');
          rect(x-8,y-22,16,5,'#8ca892',1);text('+1',x,y-30,10,'#bdd5a7','center');
        }
        if(run.vehiclePickup)drawShuttle(ctx,run.vehiclePickup.x,run.vehiclePickup.y,3,false,time,0,true);
        if(run.portal)drawPortal(run.portal);
        for(const o of run.obstacles)drawObstacle(o,sector);
        if(mode!=='dead') {
          const recovering = run.invulnerable > 0;
          if(recovering) {
            ellipse(run.player.x,run.player.y-7,run.vehicle?70:38,49,'#b9f6ef16');
            ctx.strokeStyle='#b9f6efaa';ctx.lineWidth=2;
            ctx.beginPath();ctx.ellipse(run.player.x,run.player.y-7,run.vehicle?70:38,49,0,0,Math.PI*2);ctx.stroke();
            ctx.globalAlpha = Math.sin(time*24)>0?.6:1;
          }
          if(run.vehicle)drawShuttle(ctx,run.player.x,run.player.y,run.vehicle.hull,held,time,run.player.vy,false,run.firingWeapon);
          else player(run.player.x,run.player.y,held,1,run.player.vy);ctx.globalAlpha=1;
        }
      } else attract();
      fx.drawFront(ctx);
      for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ellipse(p.x,p.y,p.r,p.r,p.color);}ctx.globalAlpha=1;
      if(flash>0)rect(0,0,W,HEIGHT,`rgba(229,246,193,${flash*.35})`);
      ctx.restore();

    }
  };
}
