// Local, bounded pixel effects. No hitboxes, timers, or gameplay side effects.
export const blastKind = kind => kind==='shuttle'?'shuttle':kind==='missile'?'missile':['laser','horizontal','spinner','pendulum','energy'].includes(kind)?'energy':'drone';
const WARM=['#a84d43','#ee8250','#f6b45d','#ffe3a0'];
const COOL=['#3c777f','#6db8b5','#b1e4ca','#eef3b9'];
const disc=(c,x,y,r,color)=>{
  x=Math.round(x/2)*2;y=Math.round(y/2)*2;r=Math.max(2,Math.round(r/2)*2);c.fillStyle=color;
  c.fillRect(x-r*.6,y-r,r*1.2,r*2);c.fillRect(x-r,y-r*.6,r*2,r*1.2);
};
export class CombatFX {
  constructor(random=Math.random){this.random=random;this.clear();}
  clear(){this.blasts=[];this.particles=[];}
  impact(x,y){
    this.blasts.push({x,y,size:13,duration:.11,age:0,seed:this.random()*6,palette:COOL,drift:.6});
    this.sparks(x,y,5,COOL,100);this.trim();
  }
  explode(x,y,type){
    const kind=blastKind(type),big=kind==='shuttle',energy=kind==='energy',palette=energy?COOL:WARM;
    const size=big?95:kind==='missile'?54:energy?43:42;
    const add=(dx,dy,scale,delay)=>this.blasts.push({x:x+dx,y:y+dy,size:size*scale,duration:big?.72:.47,age:-delay,seed:this.random()*6,palette,drift:big?.24:.6});
    if(big){add(-22,5,.7,0);add(17,-4,1,.1);add(-32,-13,.53,.23);}
    else {add(0,0,1,0);if(energy)add(13,-10,.45,.07);}
    this.sparks(x,y,big?28:14,palette,big?280:210);
    for(let i=0;i<(big?12:5);i++) {
      const a=i*2.4+this.random(),d=big?38:20;
      this.particles.push({kind:'smoke',x:x+Math.cos(a)*d,y:y+Math.sin(a)*d,age:-(i%3)*.035,life:big?1.15:.7,vx:Math.cos(a)*28,vy:-20-this.random()*30,r:(big?14:8)+this.random()*9,color:i%2?'#697467':'#394e50'});
    }
    for(let i=0;i<(big?13:energy?5:8);i++) {
      const angle=i*2.4,body=big?['mug','seat','nacelle','canopy','hull'][Math.min(i,4)]:kind==='drone'&&i===0?'lens':'hull';
      this.particles.push({kind:body,x:x+Math.cos(angle)*(big?28:9),y:y+Math.sin(angle)*12,age:0,life:big?1.45:.8,
        vx:i===0?150:i===1?-110:Math.cos(angle)*(100+this.random()*190),vy:-70-Math.abs(Math.sin(angle))*170,
        angle:this.random()*3,spin:(this.random()-.5)*10,w:(big?18:9)+this.random()*16,h:7+this.random()*10,color:i%2?'#a6b7a5':'#a78169'});
    }
    this.trim();
  }
  sparks(x,y,count,palette,speed){
    for(let i=0;i<count;i++){
      const a=i*2.4+this.random()*.5,v=speed*(.4+this.random()*.8);
      this.particles.push({kind:'spark',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,age:0,life:.22+this.random()*.35,color:palette[1+i%3]});
    }
  }
  trim(){if(this.blasts.length>20)this.blasts.splice(0,this.blasts.length-20);if(this.particles.length>220)this.particles.splice(0,this.particles.length-220);}
  update(dt,speed=0){
    for(const b of this.blasts){b.age+=dt;b.x-=speed*dt*b.drift;}
    this.blasts=this.blasts.filter(b=>b.age<b.duration);
    for(const p of this.particles){
      p.age+=dt;if(p.age<0)continue;
      p.x+=(p.vx-speed*(p.kind==='smoke'?.4:.25))*dt;p.y+=p.vy*dt;
      if(p.kind==='smoke'){p.r+=dt*18;p.vx*=Math.exp(-dt);}
      else {p.vy+=dt*(p.kind==='spark'?100:190);if(p.spin)p.angle+=p.spin*dt;}
    }
    this.particles=this.particles.filter(p=>p.age<p.life);
  }
  drawBack(c){
    c.save();
    for(const p of this.particles)if(p.kind==='smoke'&&p.age>=0){c.globalAlpha=.44*Math.sin(Math.PI*Math.min(1,p.age/p.life));disc(c,p.x,p.y,p.r,p.color);}
    for(const b of this.blasts){
      if(b.age<0)continue;
      const p=b.age/b.duration,grow=1-Math.exp(-b.age*30),r=b.size*(.2+.8*grow)*(1-p*.15),fade=Math.min(1,(1-p)*2.2);
      c.globalAlpha=fade;
      // Chunky fire lobes grow into one hot cloud, then leave smoke behind.
      for(let i=0;i<7;i++){
        const a=i*Math.PI*2/7+b.seed,d=r*.56,lr=r*(.38+Math.sin(i*3.7)*.06);
        const x=b.x+Math.cos(a)*d,y=b.y+Math.sin(a)*d-p*16;
        disc(c,x,y,lr,b.palette[0]);disc(c,x-1,y-2,lr*.77,b.palette[1]);
      }
      disc(c,b.x,b.y-p*12,r*.62,b.palette[2]);
      if(p<.55)disc(c,b.x+3,b.y-4,r*.38*(1-p),b.palette[3]);
      c.globalAlpha=(1-p)*.7;c.strokeStyle=b.palette[2];c.lineWidth=b.size>70?4:2;
      const ring=8+p*b.size*1.8;c.beginPath();
      for(let i=0;i<9;i++){const a=i*Math.PI/4,x=b.x+Math.cos(a)*ring,y=b.y+Math.sin(a)*ring*.76;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
    }
    c.restore();
  }
  drawFront(c){
    c.save();
    for(const p of this.particles){
      if(p.age<0||p.kind==='smoke')continue;
      c.globalAlpha=Math.min(1,(1-p.age/p.life)*2);
      if(p.kind==='spark'){
        c.strokeStyle=p.color;c.lineWidth=2;c.beginPath();c.moveTo(Math.round(p.x),Math.round(p.y));c.lineTo(Math.round(p.x-p.vx*.025),Math.round(p.y-p.vy*.025));c.stroke();continue;
      }
      c.save();c.translate(Math.round(p.x),Math.round(p.y));c.rotate(p.angle);
      if(p.kind==='mug'){c.fillStyle='#eee0b2';c.fillRect(-5,-7,10,14);c.fillRect(5,-4,5,7);c.fillStyle='#725d49';c.fillRect(-4,-8,8,3);}
      else if(p.kind==='seat'){c.fillStyle='#7b9f9a';c.fillRect(-7,-15,14,22);c.fillStyle='#b8b092';c.fillRect(-13,4,26,6);c.fillStyle='#9eada0';c.fillRect(-2,10,4,14);c.fillRect(-12,23,24,3);}
      else if(p.kind==='canopy'){c.fillStyle='#83bec677';c.fillRect(-13,-10,26,18);c.strokeStyle='#c0d9ce';c.lineWidth=2;c.strokeRect(-13,-10,26,18);c.beginPath();c.moveTo(-4,-10);c.lineTo(2,0);c.lineTo(-1,8);c.stroke();}
      else if(p.kind==='nacelle'){c.fillStyle='#63898c';c.fillRect(-19,-6,38,12);c.fillStyle='#b9ddc5';c.fillRect(-19,-5,7,10);c.fillStyle='#d18a6d';c.fillRect(9,-3,9,5);}
      else if(p.kind==='lens'){c.fillStyle='#405b61';c.fillRect(-10,-7,20,14);c.fillStyle='#f1a080';c.fillRect(-5,-4,10,8);}
      else {c.fillStyle=p.color;c.fillRect(-p.w/2,-p.h/2,p.w,p.h);c.fillStyle='#d9ceaf';c.fillRect(-p.w/2,-p.h/2,p.w,2);c.fillStyle='#b75d59';c.fillRect(-p.w/2,1,p.w,3);}
      c.restore();
    }
    c.restore();
  }
}
