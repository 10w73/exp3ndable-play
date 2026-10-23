import { Run, HEIGHT, CEILING, FLOOR, MAX_HEALTH, pendulumPoints } from './engine.js';
import { GameAudio } from './audio.js';
import { WEAPONS } from './arsenal.js';
import { CombatFX } from './fx.js';
import { PilotRecords } from './records.js';
import { CrewRadio, CREW } from './dialogue.js';
import {drawCrew,sectorFor,drawWorldWindow,drawSetDressing,drawRift,drawRealmDrone,drawDimension,drawRadioPortrait,drawShuttle,drawAmbient,drawShot,drawGear} from './art.js';

const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d', { alpha:false });
const frame = $('game-frame');
const thrust = $('thrust');
function fitViewport() { document.documentElement.style.setProperty('--app-height',`${Math.round(window.visualViewport?.height || innerHeight)}px`); }
fitViewport(); window.visualViewport?.addEventListener('resize',fitViewport); window.addEventListener('resize',fitViewport);
let W = 1200, mode = 'ready', run, held = false, keys = new Set(), pointers = new Set(), touches = new Set();
let time = 0, last = 0, accumulator = 0, shake = 0, flash = 0, particles = [], damageTime = 0;
const fx = new CombatFX();
let best = 0, sound = false, soundState = 'off';
try { best = Number(localStorage.getItem('expendable.best') || 0); sound = localStorage.getItem('expendable.sound') === '1'; } catch {}
if (!Number.isFinite(best)) best = 0;
$('best').textContent = `${best} m`;
let pilotStorage;
try { pilotStorage = localStorage; } catch {}
const pilot = new PilotRecords(pilotStorage);
let lastScoreId = null;
$('pilot-tag').textContent = pilot.name;

const radio = new CrewRadio();
let lastRadioKey = 'start', lastRadioAt = 0;
const deaths = {
  laser:['Well, shit.', 'Pip would like a corridor with fewer lasers.'],
  horizontal:['Nearly.', 'Siv has made a note of the obvious design flaw.'],
  drone:['Swept up.', 'The cleaner has wildly exceeded its remit.'],
  crusher:['Tight squeeze.', 'Moss insists this looked wider in his universe.'],
  spinner:['That bit spins.', 'Useful information. Slightly late.'],
  missile:['Signed for.', 'Nobody remembers ordering a missile.'],
  pendulum:['Complicated swing.', 'Moss insists the maths was fine.'],
  jelly:['Peer reviewed.', 'The senior gill officer has some notes.'],
  mimic:['Not a parcel.', 'Siv has cancelled the return label.']
};

function crewChat(host, key) {
  const first=radio.start(key),reply=radio.reply();
  $(host).replaceChildren();
  for(const line of [first,reply].filter(Boolean)) {
    const row=document.createElement('div');row.className='crew-line';
    const face=document.createElement('canvas');face.width=24;face.height=24;face.setAttribute('aria-hidden','true');
    drawRadioPortrait(face.getContext('2d'),line.speaker);
    const name=document.createElement('span');name.textContent=CREW[line.speaker].name;name.style.color=CREW[line.speaker].color;
    const words=document.createElement('p');words.textContent=line.text;
    row.append(face,name,words);$(host).append(row);
  }
}
function speak(key) {
  lastRadioKey=key;lastRadioAt=run?.elapsed || 0;
  if(mode==='ready')crewChat('intro-chat',key);
  else if(mode==='dead')crewChat('end-chat',key);
  else if(mode==='paused')crewChat('pause-chat',key);
}
speak('start');
function resize() {
  const box = canvas.getBoundingClientRect();
  W = Math.max(400, HEIGHT * box.width / box.height);
  // Render to a small pixel grid, then scale with nearest-neighbor sampling.
  canvas.height = 360; canvas.width = Math.round(W * canvas.height / HEIGHT);
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / HEIGHT, 0, 0);
  ctx.imageSmoothingEnabled = false;
  if (run) run.resize(W);
}
new ResizeObserver(resize).observe($('flight-deck'));

const audio = new GameAudio(state => { soundState = state; updateSound(); });
function initAudio(confirm = false) {
  if (!sound) return;
  audio.setMode(mode);
  // enable() begins resume inside the input event; schedule the confirmation
  // after it resolves, rather than losing a short beep in a suspended context.
  audio.enable().then(running => { if (running && confirm) audio.cue(mode==='playing'?'start':'confirm'); });
}
function fireRifle() { if(mode==='playing' && run?.fire())audio.weapon(run.vehicle?'shuttle':run.weapon); }
function updateSound() {
  const on = sound && soundState === 'on';
  const label = on ? 'Turn music and sound off' : 'Enable music and sound';
  $('sound').innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 5-6 4H2v6h3l6 4V5${on ? 'm5 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14' : 'm5 4 6 6m0-6-6 6'}"/></svg>`;
  $('sound').setAttribute('aria-label',label); $('sound').title=label;
  $('sound').setAttribute('aria-pressed',String(on));
  $('audio-status').textContent = on ? 'SOUND ON' : soundState === 'starting' ? 'STARTING…' : sound ? 'TAP FOR SOUND' : 'SOUND OFF';
}
updateSound();
$('sound').addEventListener('click', () => {
  if (audio.running) { sound = false; audio.disable(); }
  else { sound = true; initAudio(true); }
  updateSound(); try { localStorage.setItem('expendable.sound', sound ? '1' : '0'); } catch {}
});

function syncHeld() { held = keys.size > 0 || pointers.size > 0 || touches.size > 0; }
function release() { held = false; keys.clear(); pointers.clear(); touches.clear(); audio.setThrust(false); }
function setOverlay(which) {
  $('overlay').hidden = !which;
  frame.classList.toggle('show-records', which === 'records-card');
  for (const name of ['intro','end-card','pause-card','records-card']) $(name).hidden = name !== which;
}
function updateHealth() {
  const health = run ? run.health : MAX_HEALTH;
  const hud = $('health');
  if (hud.dataset.value === String(health)) return;
  hud.dataset.value = String(health);
  hud.setAttribute('aria-label',`Health: ${health} of ${MAX_HEALTH}`);
  hud.innerHTML = '<span class="sr-only">Health</span>' + Array.from({length:MAX_HEALTH},(_,i)=>`<b class="health-pip${i < health ? '' : ' empty'}" aria-hidden="true"></b>`).join('');
}
let shownHull;
function updateHull() {
  const hull=run?.vehicle?.hull || 0;
  if(shownHull===hull)return;shownHull=hull;
  frame.classList.toggle('vehicle-active',hull>0);$('hull-status').hidden=!hull;
  $('hull-status').setAttribute('aria-label',`Shuttle hull: ${hull} of 3`);
  $('hull-status').innerHTML='<span>Hull</span>'+Array.from({length:3},(_,i)=>`<i class="${i<hull?'':'empty'}" aria-hidden="true"></i>`).join('');
}
function start() {
  lastScoreId = null; release(); run = new Run(W); mode = 'playing'; particles = []; fx.clear(); audio.setRealm('ship'); shake = 0; flash = 0; accumulator = 0; damageTime = 0;
  updateHealth(); $('hit-feedback').hidden = true;
  setOverlay(null); $('pause').disabled = false; setPauseIcon(false);
  $('distance').textContent = '0000'; $('salvage').textContent = '00'; $('flight-hint').hidden = false;
  $('sector').textContent = 'Personnel deck';
  speak('start');
  if (sound) initAudio(true);
  canvas.tabIndex = 0; canvas.focus({preventScroll:true});
}
function setPauseIcon(paused) {
  $('pause').innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paused ? 'm8 5 11 7-11 7V5' : 'M8 5v14M16 5v14'}"/></svg>`;
  $('pause').setAttribute('aria-label',paused?'Resume game':'Pause game'); $('pause').title=paused?'Resume game':'Pause game';
}
function pause() {
  if (mode === 'playing') { mode = 'paused'; release(); speak(run.elapsed-lastRadioAt<12?lastRadioKey:(run.realm || 'crew')); setOverlay('pause-card'); setPauseIcon(true); $('resume').focus({preventScroll:true}); }
  else if (mode === 'paused') { mode = 'playing'; setOverlay(null); setPauseIcon(false); accumulator = 0; if(sound)initAudio(); canvas.focus({preventScroll:true}); }
  audio.setMode(mode);
}
function finish(hazard) {
  mode = 'dead'; release(); shake = 13; flash = .4;
  const distance = Math.floor(run.distance), record = distance > best;
  lastScoreId = pilot.add(distance, run.salvage);
  best = Math.max(best, distance);
  try { localStorage.setItem('expendable.best', String(best)); } catch {}
  const [title,message] = deaths[hazard] || deaths.laser;
  $('end-title').textContent = title; $('end-message').textContent = message;
  $('end-label').textContent = record ? 'Personal best' : 'Shift ended';
  $('result-distance').innerHTML = `${distance}<small>m</small>`;
  $('result-salvage').textContent = run.salvage;
  $('result-best').innerHTML = `${best}<small>m</small>`; $('best').textContent = `${best} m`;
  $('pause').disabled = true; $('flight-hint').hidden = true;
  for(let i = 0; i < 32; i++) burst(run.player.x,run.player.y, i % 2 ? '#ff826b':'#f7d190',1.8);
  audio.cue('death');
  setOverlay('end-card'); $('restart').focus({preventScroll:true});
  speak('end');
}
function takeHit(event) {
  shake = 7; flash = .22; damageTime = 2.3;
  $('hit-feedback').classList.remove('recovered');
  $('hit-feedback').textContent = `−1 health${event.lost ? ` · −${event.lost} salvage` : ''}${event.lostWeapon?' · Weapon lost':''}`;
  speak('hit');
  for(let i=0;i<14;i++)burst(run.player.x,run.player.y,i%2?'#f2c771':'#ff826b',1.2);
  fx.impact(run.player.x,run.player.y);audio.cue('hit');
}
$('start').addEventListener('click',start); $('restart').addEventListener('click',start);
$('pause').addEventListener('click',pause); $('resume').addEventListener('click',pause);
$('back').addEventListener('click',() => { mode = 'ready'; run = null; release(); particles = []; fx.clear(); audio.setRealm('ship'); setOverlay('intro'); $('distance').textContent = '0000'; $('salvage').textContent = '00'; $('sector').textContent = 'Personnel deck'; speak('start'); $('start').focus({preventScroll:true}); });
function renderRecords() {
  $('pilot-tag').textContent = pilot.name;
  $('score-list').replaceChildren();
  for (const [index, score] of pilot.scores.entries()) {
    const row = document.createElement('li');
    row.classList.toggle('current-score', score.id === lastScoreId);
    for (const value of [`${index + 1}. ${score.name}`, `${score.distance} m`, String(score.salvage)]) {
      const cell = document.createElement('span'); cell.textContent = value; row.append(cell);
    }
    $('score-list').append(row);
  }
  $('no-scores').hidden = pilot.scores.length > 0;
}
function openRecords() {
  if (mode === 'playing') pause();
  release(); renderRecords(); $('pilot-name').value = pilot.name;
  $('pilot-saved').textContent = '';
  $('records-close').firstChild.textContent = 'Back ';
  setOverlay('records-card'); $('records-close').focus({preventScroll:true});
}
function closeRecords() {
  $('pilot-name').blur(); $('records-card').classList.remove('editing');
  const which = mode === 'dead' ? 'end-card' : mode === 'paused' ? 'pause-card' : 'intro';
  setOverlay(which);
  $(mode === 'dead' ? 'restart' : mode === 'paused' ? 'resume' : 'start').focus({preventScroll:true});
}
for (const id of ['pilot-open','scores-open','paused-scores']) $(id).addEventListener('click',openRecords);
$('records-close').addEventListener('click',closeRecords);
$('pilot-form').addEventListener('submit', e => {
  e.preventDefault(); pilot.setName($('pilot-name').value, mode === 'dead' ? lastScoreId : null);
  $('pilot-name').value = pilot.name; $('pilot-name').blur(); renderRecords();
  $('pilot-saved').textContent = pilot.persistent ? 'Saved' : 'Could not save on this device.';
});
$('pilot-name').addEventListener('focus', () => $('records-card').classList.add('editing'));
$('pilot-name').addEventListener('blur', () => $('records-card').classList.remove('editing'));
$('fullscreen').addEventListener('click',async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (frame.requestFullscreen) await frame.requestFullscreen(); } catch {} });
if (!frame.requestFullscreen) $('fullscreen').hidden = true;

const isControl = target => target instanceof Element && target.closest('button, a, input, select, textarea');
const isThrust = target => target instanceof Element && target.closest('#thrust');
function clearSelection() { const selection = window.getSelection(); if(selection?.rangeCount)selection.removeAllRanges(); }
frame.addEventListener('pointerdown', e => {
  if ((isControl(e.target) && !isThrust(e.target)) || mode !== 'playing') return;
  if(e.cancelable)e.preventDefault(); clearSelection(); pointers.add(e.pointerId); syncHeld();
  fireRifle();
  try { (isThrust(e.target) ? thrust : canvas).setPointerCapture(e.pointerId); } catch {}
  if(sound && !audio.running) initAudio();
}, { passive:false });
const pointerRelease = e => { pointers.delete(e.pointerId); syncHeld(); };
window.addEventListener('pointerup',pointerRelease); window.addEventListener('pointercancel',pointerRelease);
canvas.addEventListener('lostpointercapture',pointerRelease);
thrust.addEventListener('lostpointercapture',pointerRelease);
// Explicit non-passive touch handling covers Safari callouts and browsers that
// deliver touch events differently from Pointer Events. Buttons keep native taps.
frame.addEventListener('touchstart', e => {
  if ((isControl(e.target) && !isThrust(e.target)) || mode !== 'playing') return;
  if(e.cancelable)e.preventDefault(); clearSelection();
  for(const touch of e.changedTouches)touches.add(touch.identifier);
  fireRifle();
  syncHeld(); if(sound && !audio.running)initAudio();
}, { passive:false });
frame.addEventListener('touchmove', e => { if(touches.size && e.cancelable)e.preventDefault(); }, { passive:false });
function touchRelease(e) {
  const active = [...e.changedTouches].some(touch => touches.has(touch.identifier));
  if(active && e.cancelable)e.preventDefault();
  for(const touch of e.changedTouches)touches.delete(touch.identifier);
  syncHeld();
}
window.addEventListener('touchend',touchRelease,{ passive:false });
window.addEventListener('touchcancel',touchRelease,{ passive:false });
const isEditing = target => target instanceof Element && target.closest('input, textarea, [contenteditable=true]');
for(const event of ['contextmenu','selectstart','dragstart'])frame.addEventListener(event,e=>{if(!isEditing(e.target))e.preventDefault();});
thrust.addEventListener('keydown',e=>{if(mode==='playing' && ['Space','Enter'].includes(e.code)){e.preventDefault();if(!e.repeat)fireRifle();keys.add(e.code);syncHeld();if(sound&&!audio.running)initAudio();}});
thrust.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();keys.delete(e.code);syncHeld();}});
window.addEventListener('keydown', e => {
  if (isEditing(e.target)) return;
  if (frame.classList.contains('show-records')) { if (e.code === 'Escape') closeRecords(); return; }
  if (['Space','ArrowUp','KeyW'].includes(e.code)) {
    // The game's flight binding wins over a previously focused HUD button.
    // Editable fields and the records menu retain ordinary keyboard behavior.
    e.preventDefault(); e.stopPropagation(); if(e.repeat) return;
    if (mode === 'ready' || mode === 'dead') start();
    else if(mode === 'paused') pause();
    if(mode === 'playing') { keys.add(e.code); syncHeld(); fireRifle(); if(sound && !audio.running) initAudio(); }
    return;
  }
  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) pause();
  if(e.code==='KeyX' && !e.repeat){e.preventDefault();fireRifle();}
}, {capture:true});
window.addEventListener('keyup', e => {
  if (!isEditing(e.target) && !frame.classList.contains('show-records') && ['Space','ArrowUp','KeyW'].includes(e.code)) {e.preventDefault();e.stopPropagation();}
  keys.delete(e.code); syncHeld();
}, {capture:true});
window.addEventListener('blur',() => { release(); if(mode === 'playing') pause(); });
document.addEventListener('visibilitychange',() => { if(document.hidden && mode === 'playing') pause(); release(); audio.setMode(document.hidden ? 'paused' : mode); });

function burst(x,y,color,power=1) { if(particles.length > 180) return; particles.push({x,y,vx:(Math.random()-.5)*230*power,vy:(Math.random()-.5)*230*power,life:.45+Math.random()*.45,max:.9,color,r:2+Math.random()*4}); }
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
function planet(x,y,r,alien) {
  ctx.save();ctx.translate(x,y);ctx.rotate(-.28);
  ctx.strokeStyle=alien?'#b8a5bd':'#9d9e79';ctx.lineWidth=r*.15;
  ctx.beginPath();ctx.ellipse(0,0,r*1.8,r*.38,0,Math.PI,Math.PI*2);ctx.stroke();
  ellipse(0,0,r,r,alien?'#8674a3':'#c6aa7d');
  ctx.save();ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.clip();
  for(let i=0;i<6;i++) rect(-r,-r+i*r*.39,r*2,r*.12,i%2?'#a98d6b':'#d6bb8b');
  ellipse(r*.65,-r*.03,r*.72,r*1.12,alien?'#62597766':'#6c756b55');ctx.restore();
  ctx.strokeStyle=alien?'#b8a5bd':'#beb395';ctx.lineWidth=r*.15;
  ctx.beginPath();ctx.ellipse(0,0,r*1.8,r*.38,0,0,Math.PI);ctx.stroke();ctx.restore();
}
function windowPanel(x,y,w,h,scroll,alien,sector) {
  rect(x-10,y-10,w+20,h+20,'#101f29',26); rect(x-5,y-5,w+10,h+10,'#4c6a74',21);
  rect(x,y,w,h,'#0c202b',17);
  ctx.save();ctx.beginPath();ctx.roundRect(x+2,y+2,w-4,h-4,16);ctx.clip();
  const g=ctx.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,alien?'#332d49':'#213a48');g.addColorStop(1,'#102431');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
  stars(x,y,w,h,scroll); if(!drawWorldWindow(ctx,x,y,w,h,sector,time))planet(x+w*.62,y+h*.43,h*.29,alien);
  line(x+22,y+h-14,x+w-18,y+20,'#92c8c810',18);line(x+50,y+h,x+w+10,y+13,'#92c8c810',6);ctx.restore();
  rect(x+w*.48,y+1,7,h-2,'#304b59');rect(x,y+h*.7,w,5,'#304b59');
  for(const [bx,by] of [[x-5,y-4],[x+w+4,y-4],[x-5,y+h+4],[x+w+4,y+h+4]]) ellipse(bx,by,2,2,'#a5b6b4');
}
function background(scroll,sector) {
  if(drawDimension(ctx,W,scroll,sector,time))return;
  const alien=sector.id==='organic'||sector.id==='void';
  const g=ctx.createLinearGradient(0,0,0,HEIGHT);g.addColorStop(0,sector.color);g.addColorStop(.55,sector.color);g.addColorStop(1,'#172a35');ctx.fillStyle=g;ctx.fillRect(0,0,W,HEIGHT);
  const spacing=580, off=(scroll*.33)%spacing;
  for(let x=-off-80;x<W+spacing;x+=spacing) {
    rect(x,CEILING,2,FLOOR-CEILING,'#79969b15');
    windowPanel(x+100,162,310,235,scroll,alien,sector);
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
  for(let x=-topOff;x<W+290;x+=290){rect(x+20,77,126,5,alien?'#ae94ca':'#cdd9b4',2);rect(x+168,34,72,17,'#0d1c25',3);rect(x+175,39,10,6,'#c7b986',1);rect(x+191,39,35,6,'#365158',1);line(x+8,0,x+8,CEILING-17,'#263f47',12);}
  rect(0,FLOOR,W,HEIGHT-FLOOR,'#14252e');rect(0,FLOOR,W,9,'#65766a');rect(0,FLOOR+9,W,5,'#293c3f');
  const floorOff=scroll%70;
  for(let x=-floorOff;x<W+70;x+=70){ctx.fillStyle='#b4a965';ctx.beginPath();ctx.moveTo(x,FLOOR+1);ctx.lineTo(x+16,FLOOR+1);ctx.lineTo(x+5,FLOOR+8);ctx.lineTo(x-11,FLOOR+8);ctx.fill();line(x,FLOOR+19,x-15,HEIGHT,'#29404a',2);}
  const ribOff=(scroll*.72)%860;
  for(let x=-ribOff+650;x<W+150;x+=860){rect(x-9,CEILING,24,FLOOR-CEILING,'#10242b');rect(x-5,CEILING,9,FLOOR-CEILING,'#486268');rect(x+4,CEILING,6,FLOOR-CEILING,'#253f48');for(let y=130;y<FLOOR;y+=90)rect(x-4,y,8,3,'#8ba298');}
  const shade=ctx.createLinearGradient(0,0,0,HEIGHT);shade.addColorStop(0,'#0b1b2d55');shade.addColorStop(.45,'#071c2400');shade.addColorStop(1,'#0a1b2d66');ctx.fillStyle=shade;ctx.fillRect(0,0,W,HEIGHT);
}
function drawCoin(c) {
  const pulse = 1 + Math.sin(time*3+c.phase)*.08;
  ctx.save();ctx.translate(c.x,c.y);ctx.scale(pulse,pulse);
  ellipse(0,0,17,17,'#f4c96c12');
  ctx.fillStyle='#e6b65f';ctx.strokeStyle='#ffde8c';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/6;const x=Math.cos(a)*10,y=Math.sin(a)*10;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();bolt(0,0,.48,'#594a30');ctx.restore();
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
  if(['drone','jelly','mimic'].includes(o.type) && drawRealmDrone(ctx,o,sector,time))return;
  if(['laser','horizontal','spinner'].includes(o.type)) {laser(o);return;}
  if(o.type==='drone') {
    ctx.save();ctx.translate(o.x,o.y);ellipse(0,24,33,5,'#061c2322');rect(-29,-16,58,34,'#172a34',12);rect(-24,-13,48,28,'#b6bbb0',10);rect(-20,-7,40,13,'#344f58',5);ellipse(-9,-1,4,4,'#ff836c');ellipse(9,-1,4,4,'#ff836c');rect(-13,17,26,5,'#526d70',2);line(0,-16,0,-25,'#b7c4ac',3);ellipse(0,-27,4,4,'#ff8168');
    const rotor=Math.sin(time*38)*9;line(-30,-15,-30,-5,'#8ca69d',3);line(30,-15,30,-5,'#8ca69d',3);line(-43,-16,-17+rotor,-16,'#c4d1b6',3);line(17-rotor,-16,43,-16,'#c4d1b6',3);ctx.restore();return;
  }
  if(o.type==='crusher') {
    const x=o.x-o.w/2,y=o.y-o.h/2;rect(x-4,y-3,o.w+8,o.h+6,'#11252c',5);rect(x,y,o.w,o.h,'#64716b',4);rect(x+8,y+5,o.w-16,o.h-10,'#354b4c',2);
    for(let i=0;i<6;i++) {rect(x+13,y+11+i*23,o.w-26,7,'#a99763',1);rect(x+13,y+18+i*23,o.w-26,3,'#1b343c');}
    rect(x+4,y+o.h/2-5,o.w-8,10,'#ec8a68',2);return;
  }
  if(o.type==='missile') {
    if(o.warning>0) {
      if(Math.sin(time*16)>-.4){rect(W-42,o.y-18,30,36,'#633b3b',6);text('!',W-27,o.y+8,23,'#ff9879','center');line(W-80,o.y,W-52,o.y,'#ff826b88',2);}return;
    }
    ctx.save();ctx.translate(o.x,o.y);ctx.fillStyle='#f39a6d';ctx.beginPath();ctx.moveTo(26,-7);ctx.lineTo(54+Math.sin(time*60)*7,0);ctx.lineTo(26,8);ctx.fill();rect(-22,-11,49,22,'#b1bbaa',6);ctx.fillStyle='#ff8d74';ctx.beginPath();ctx.moveTo(-38,0);ctx.lineTo(-16,-12);ctx.lineTo(-16,12);ctx.fill();rect(16,-17,7,34,'#6d8380',2);text('HR',-6,4,9,'#273f47','center');ctx.restore();
  }
}
function drawPortal(portal) {
  drawRift(ctx,portal.x,portal.y,'#acd1b3',sectorFor({realm:portal.realm}).name,portal.realm,time);
  line(portal.x-22,portal.y,portal.x+22,portal.y,'#d8c6a966',1);
  text('Float',portal.x,portal.y-26,9,'#d2e4c5','center');
  text('Salvage ×2',portal.x,portal.y+32,8,'#d6c4d9','center');
}
function attract() {
  const x=W>750?W*.7:W*.76, y=HEIGHT*.55+Math.sin(time*1.9)*13;
  for(let i=0;i<5;i++) drawCoin({x:x+95+i*40,y:y-37-Math.sin(i*.65)*65,phase:i*.4});
  if(W>700)laser({type:'laser',x:W*.93,y:200,h:115});
  // A little shuttle through the distant viewport.
  player(x,y,true,W>700?1.85:1.3,Math.sin(time)*70);

}
function tick(dt) {
  time+=dt; shake=Math.max(0,shake-dt*25);flash=Math.max(0,flash-dt*1.4);
  for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=100*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);
  if(mode!=='paused')fx.update(dt,mode==='playing'?run.speed:0);
  if(mode==='playing') {
    damageTime = Math.max(0, damageTime - dt);
    accumulator+=dt;
    while(accumulator>=1/120 && mode==='playing') {
      run.update(1/120,held);accumulator-=1/120;
      for(const event of run.events) {
        if(event.type==='coin') {for(let i=0;i<4;i++)burst(event.x,event.y,'#e9ce7e',.6);audio.cue('coin',run.salvage);}
        if(event.type==='hit' && event.health>0)takeHit(event);
        if(event.type==='heal') {
          damageTime=2; $('hit-feedback').textContent='+1 health'; $('hit-feedback').classList.add('recovered');
          for(let i=0;i<5;i++)burst(event.x,event.y,'#b9d5a1',.4);
          audio.cue('heal');
        }
        if(event.type==='vehicle-board') {
          damageTime=2;$('hit-feedback').textContent='Shuttle boarded';$('hit-feedback').classList.add('recovered');
          speak('vehicleBoard');audio.cue('board');
        }
        if(event.type==='vehicle-hit') {
          shake=4;damageTime=1.6;$('hit-feedback').textContent=`Hull ${event.hull}/3`;$('hit-feedback').classList.remove('recovered');
          fx.impact(event.x+20,event.y);if(event.hull>0)audio.cue('hull-hit');
        }
        if(event.type==='vehicle-break') {
          shake=11;fx.explode(event.x,event.y,'shuttle');audio.explosion('shuttle');
          damageTime=2;$('hit-feedback').textContent='Still here.';$('hit-feedback').classList.add('recovered');
          speak('vehicleBreak');
        }
        if(event.type==='impact'){fx.impact(event.x,event.y);audio.cue('impact');}
        if(event.type==='destroy'){
          fx.explode(event.x,event.y,event.hazard);audio.explosion(event.hazard);
          shake=Math.max(shake,event.hazard==='missile'?5:3);
        }
        if(event.type==='missile-warning')audio.cue('missile-warning');
        if(event.type==='gear'){speak('gear');audio.cue('gear');}
        if(event.type==='crash') finish(event.hazard);
        if(event.type==='portal-warning') {speak('warning');audio.cue('portal-warning');}
        if(event.type==='portal') {flash=.18;shake=3;audio.setRealm(run.realm);audio.portal();speak({machine:'enterMachine',organic:'enterOrganic',void:'enterVoid',aquarium:'enterAquarium',scrapyard:'enterScrapyard',ship:'backShip'}[run.realm]);}
        if(event.type==='normal') {speak('normal');audio.cue('normal');}
      }
    }
    $('distance').textContent=String(Math.floor(run.distance)).padStart(4,'0');$('salvage').textContent=String(run.salvage).padStart(2,'0');
    updateHealth();
    $('flight-hint').hidden=run.elapsed>5;
    const destination=sectorFor(run);
    $('sector').textContent = run.reality ? `${run.reality==='low'?'Low gravity':'Double salvage'} · ${Math.ceil(run.realityTime)}s` : destination.name.toLowerCase();
    if(held && Math.random()>.25) {const p=run.player;particles.push({x:p.x-14,y:p.y+24,vx:-60-Math.random()*110,vy:65+Math.random()*50,life:.3,max:.4,color:Math.random()>.5?'#f9d88c':'#f7916f',r:2+Math.random()*3});}
  }
  $('hit-feedback').hidden = mode !== 'playing' || damageTime <= 0;
  if(!run)updateHealth();
  updateHull();
  audio.setMode(mode); audio.setThrust(mode==='playing' && held);
  updateThumb();
}
let thumbMode, thumbHeld, thumbWeapon, thumbVehicle;
function updateThumb() {
  const active = mode === 'playing' && held;
  const vehicle=!!run?.vehicle,weapon=vehicle?'shuttle':run?run.weapon:'ion';
  if(thumbMode === mode && thumbHeld === active && thumbWeapon===weapon && thumbVehicle===vehicle)return;
  thumbMode = mode; thumbHeld = active; thumbWeapon=weapon;thumbVehicle=vehicle;
  frame.dataset.mode = mode;
  thrust.disabled = mode !== 'playing';
  thrust.classList.toggle('held',active); thrust.setAttribute('aria-pressed',String(active));
  $('thumb-instruction').textContent = mode==='playing' ? active?'Release to fall':'Hold to rise' : mode==='paused'?'On a break' : mode==='dead'?'Another go?':'Hold to rise';
  $('thrust-detail').textContent=weapon?'Tap to fire':'Release to fall';
  $('gear-status').textContent=weapon?WEAPONS[weapon].name:'Unarmed';
  thrust.setAttribute('aria-label',weapon?'Hold to fly. Tap to fire. Release to fall.':'Hold to fly. Release to fall.');
}
function render() {
  ctx.save();
  if(shake>0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
  const scroll=run?run.scroll:time*45;
  const sector=sectorFor(run);
  background(scroll,sector);
  drawAmbient(ctx,W,scroll,sector,run?.elapsed ?? time);
  fx.drawBack(ctx);
  if(run) {
    for(const c of run.coins)drawCoin(c);
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
      if(run.vehicle)drawShuttle(ctx,run.player.x,run.player.y,run.vehicle.hull,held,time,run.player.vy);
      else player(run.player.x,run.player.y,held,1,run.player.vy);ctx.globalAlpha=1;
    }
  } else attract();
  fx.drawFront(ctx);
  for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ellipse(p.x,p.y,p.r,p.r,p.color);}ctx.globalAlpha=1;
  if(flash>0)rect(0,0,W,HEIGHT,`rgba(229,246,193,${flash*.35})`);
  ctx.restore();
}
function loop(ms) {const dt=Math.min(.05,(ms-last)/1000||0);last=ms;tick(dt);render();requestAnimationFrame(loop);}
resize();requestAnimationFrame(loop);
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{}));
