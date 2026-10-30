import {tr,getLanguage,setLanguage,translateShell} from './language.js';
import { Run, HEIGHT, MAX_HEALTH, LOOT } from './engine.js';
import { GameAudio } from './audio.js';
import { WEAPONS } from './arsenal.js';
import { CombatFX } from './fx.js';
import { PilotRecords } from './records.js';
import {DIFFICULTIES} from './difficulty.js';
import { CrewRadio, CREW, shiftReport } from './dialogue.js';
import {sectorFor,drawRadioPortrait} from './art.js';
import {createRenderer} from './renderer.js';
import {RunCheckpoint} from './checkpoint.js';

const nodes=new Map();
const $=id=>{if(!nodes.has(id))nodes.set(id,document.getElementById(id));return nodes.get(id);};
/** Avoid DOM mutations for unchanged HUD values; IDs belong to the static shell. */
function write(id,property,value){const node=$(id);if(node[property]!==value)node[property]=value;}
const canvas = $('game'), renderer=createRenderer(canvas);
const frame = $('game-frame');
const thrust = $('thrust'), restartDialog=$('restart-dialog');
// Native percentage layout owns game geometry. VisualViewport is used only to
// keep the name form inside the on-screen keyboard's visible rectangle.
/** Keep the name editor within VisualViewport; without sizing or transforming the game root. */
function fitKeyboard() {
  const viewport=window.visualViewport;if(!viewport)return;
  document.documentElement.style.setProperty('--keyboard-height',`${Math.round(viewport.height)}px`);
  document.documentElement.style.setProperty('--keyboard-top',`${Math.round(viewport.offsetTop)}px`);
}
fitKeyboard();window.visualViewport?.addEventListener('resize',fitKeyboard);window.visualViewport?.addEventListener('scroll',fitKeyboard);
let W = 1200, mode = 'ready', run, held = false, keys = new Set(), pointers = new Map();
let time = 0, last = 0, accumulator = 0, shake = 0, flash = 0, particles = [];
const fx = new CombatFX();
let best = 0, sound = true, soundState = 'off';
try { sound = localStorage.getItem('expendable.sound') !== '0'; } catch {}
let pilotStorage;
try { pilotStorage = localStorage; } catch {}
const pilot = new PilotRecords(pilotStorage), checkpoint=new RunCheckpoint(pilotStorage);
let checkpointElapsed=0;
let selectedDifficulty=pilot.difficulty,scoreDifficulty=selectedDifficulty;
best=pilot.best(selectedDifficulty);write('best','textContent',`${best} m`);
write('run-mode','textContent',`· ${tr(DIFFICULTIES[selectedDifficulty].label)}`);
document.querySelector(`#difficulty-choice input[value="${selectedDifficulty}"]`).checked=true;
document.querySelectorAll('#difficulty-choice input').forEach(input=>input.addEventListener('change',()=>{
  if(mode!=='ready'||!input.checked)return;
  selectedDifficulty=input.value;pilot.setDifficulty(selectedDifficulty);best=pilot.best(selectedDifficulty);
  write('best','textContent',`${best} m`);write('run-mode','textContent',`· ${tr(DIFFICULTIES[selectedDifficulty].label)}`);
}));
document.querySelectorAll('#score-difficulty input').forEach(input=>input.addEventListener('change',()=>{scoreDifficulty=input.value;renderRecords();}));
let lastScoreId = null;
write('pilot-tag','textContent',pilot.name);

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
  mimic:['Not a parcel.', 'Siv has cancelled the return label.'],
  auditor:['Audited.', 'Your molecules have failed the paperwork.'],
  hopper:['Lunch break.', 'The lunch has declined to be eaten.'],
  manta:['Ray of hope.', 'That was a very misleading name.'],
  spore:['Coffee spill.', 'It was carrying that for someone.'],
  crab:['Reclaimed.', 'Your warranty expired during impact.']
};

/** Keep full conversations on menus so flight never competes with reading. */
function crewChat(host, key) {
  const first=radio.start(key),reply=radio.reply();
  $(host).replaceChildren();
  for(const line of [first,reply].filter(Boolean)) {
    const row=document.createElement('div');row.className='crew-line';
    const face=document.createElement('canvas');face.width=24;face.height=24;face.setAttribute('aria-hidden','true');
    drawRadioPortrait(face.getContext('2d'),line.speaker);
    const name=document.createElement('span');name.textContent=CREW[line.speaker].name;name.style.color=CREW[line.speaker].color;
    const words=document.createElement('p');words.textContent=tr(line.text);
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
/** Derive world width from the visible canvas while preserving relative entity distances. */
function resize() {
  const box = canvas.getBoundingClientRect();
  // Standalone restoration can precede layout; retain geometry until it is measurable.
  if(!(box.width>0&&box.height>0))return;
  W = Math.max(400, HEIGHT * box.width / box.height);
  // Render to a small pixel grid, then scale with nearest-neighbor sampling.
  renderer.resize(W);
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
/** Start flight immediately; discard delayed shot audio after a pause, restart or crossing. */
function fireWeapon() {
  if(mode!=='playing'||!run)return;
  const kind=run.firingWeapon,upgraded=!!run.vehicle&&kind!=='shuttle';
  if(!run.fire())return;
  const firedRun=run,firedRealm=run.realm,empty=run.firingWeapon!==kind;
  const play=()=>{
    if(mode!=='playing'||run!==firedRun||run.realm!==firedRealm||!sound)return;
    audio.weapon(kind,upgraded);if(empty)audio.cue('weapon-empty');
  };
  // Flight/shooting stays immediate; don't lose the onset while mobile audio resumes.
  if(sound&&!audio.running){audio.setMode(mode);audio.enable().then(ready=>{if(ready)play();});}
  else play();
}
function updateSound() {
  const on = sound && soundState === 'on';
  const label = tr(on ? 'Turn music and sound off' : 'Enable music and sound');
  $('sound').innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 5-6 4H2v6h3l6 4V5${on ? 'm5 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14' : 'm5 4 6 6m0-6-6 6'}"/></svg>`;
  $('sound').setAttribute('aria-label',label); write('sound','title',label);
  $('sound').setAttribute('aria-pressed',String(on));
  write('audio-status','textContent',tr(on ? 'SOUND ON' : soundState === 'starting' ? 'STARTING…' : sound ? 'TAP FOR SOUND' : 'SOUND OFF'));
}
updateSound();
$('sound').addEventListener('click', () => {
  if (audio.running) { sound = false; audio.disable(); }
  else { sound = true; initAudio(true); }
  updateSound(); try { localStorage.setItem('expendable.sound', sound ? '1' : '0'); } catch {}
});

function syncHeld() { held = keys.size > 0 || pointers.size > 0; }
/** End owned gestures before a menu/viewport transition; capture must not steal later UI taps. */
function release() {
  keys.clear();
  for(const [id,target]of pointers)if(target.hasPointerCapture(id))target.releasePointerCapture(id);
  pointers.clear();held=false;audio.setThrust(false);
}
function setOverlay(which) {
  write('overlay','hidden',!which);
  frame.classList.toggle('show-records', which === 'records-card');
  for (const name of ['intro','end-card','pause-card','records-card']) $(name).hidden = name !== which;
  // Native controls change in the same transaction as menus, not a later animation frame.
  updateThumb();
}
function updateHealth() {
  const health = run ? run.health : MAX_HEALTH;
  const hud = $('health');
  if (hud.dataset.value === String(health)) return;
  hud.dataset.value = String(health);
  hud.setAttribute('aria-label',getLanguage()==='de'?`Leben: ${health} von ${MAX_HEALTH}`:`Health: ${health} of ${MAX_HEALTH}`);
  hud.innerHTML = `<span class="sr-only">${tr('Health')}</span>` + Array.from({length:MAX_HEALTH},(_,i)=>`<b class="health-pip${i < health ? '' : ' empty'}" aria-hidden="true"></b>`).join('');
}
let shownHull;
function updateHull() {
  const hull=run?.vehicle?.hull || 0;
  if(shownHull===hull)return;shownHull=hull;
  frame.classList.toggle('vehicle-active',hull>0);write('hull-status','hidden',!hull);
  $('hull-status').setAttribute('aria-label',getLanguage()==='de'?`Shuttle-Hülle: ${hull} von 3`:`Shuttle hull: ${hull} of 3`);
  $('hull-status').innerHTML=`<span>${tr('Hull')}</span>`+Array.from({length:3},(_,i)=>`<i class="${i<hull?'':'empty'}" aria-hidden="true"></i>`).join('');
}
/** Start a fresh fixed-mode run while retaining pilot, scores and sound preference. */
function start() {
  checkpoint.clear(); // Abandon the old shift even if saving the fresh one fails.
  lastScoreId = null; release(); run = new Run(W,Math.random,selectedDifficulty); mode = 'playing'; particles = []; fx.clear(); audio.setRealm('ship'); shake = 0; flash = 0; accumulator = 0;
  updateHealth();
  setOverlay(null); $('pause').disabled = false; setPauseIcon(false);
  write('distance','textContent','0000'); write('salvage','textContent','00');
  write('sector','textContent',tr('Personnel deck'));
  speak('start'); checkpoint.save(run); checkpointElapsed=0;
  if (sound) initAudio(true);
  canvas.tabIndex = 0; canvas.focus({preventScroll:true});
}
function setPauseIcon(paused) {
  $('pause').innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paused ? 'm8 5 11 7-11 7V5' : 'M8 5v14M16 5v14'}"/></svg>`;
  $('pause').setAttribute('aria-label',tr(paused?'Resume game':'Pause game')); write('pause','title',tr(paused?'Resume game':'Pause game'));
}
/** Pause is idempotent; Resume never starts, replaces or toggles a run. */
function pause() {
  if(mode!=='playing')return;
  mode='paused';release();checkpoint.save(run);checkpointElapsed=0;
  speak(run.elapsed-lastRadioAt<12?lastRadioKey:(run.realm||'crew'));
  // Reading belongs to a deliberate pause, with no deadline or competing banter.
  const portal=run.portal&&!run.portal.passed?run.portal:null;
  write('portal-guide','hidden',!portal);write('pause-chat','hidden',!!portal);
  if(portal)write('portal-destination','textContent',`Portal → ${portal.realm==='ship'?tr('Your ship'):sectorFor({realm:portal.realm}).name}`);
  setOverlay('pause-card');setPauseIcon(true);audio.setMode(mode);$('resume').focus({preventScroll:true});
}
/** Continue the exact active run only after an explicit native action. */
function resume() {
  if(mode!=='paused'||restartDialog.open||frame.classList.contains('show-records'))return;
  release();mode='playing';setOverlay(null);setPauseIcon(false);accumulator=0;
  audio.setMode(mode);if(sound)initAudio();canvas.focus({preventScroll:true});
}
function togglePause(){if(mode==='paused')resume();else pause();}
function finish(hazard) {
  mode = 'dead'; release(); checkpoint.clear(); shake = 13; flash = .4;
  const distance = Math.floor(run.distance), record = distance > best;
  lastScoreId = pilot.add(distance, run.salvage,run.difficulty);
  best = pilot.best(run.difficulty);
  const [title,message] = deaths[hazard] || deaths.laser;
  write('end-title','textContent',tr(title)); write('end-message','textContent',tr(message));
  write('shift-report','textContent',shiftReport(run,sectorFor(run).name));
  write('end-label','textContent',tr(record ? 'Personal best' : 'Shift ended'));
  $('result-distance').innerHTML = `${distance}<small>m</small>`;
  write('result-salvage','textContent',run.salvage);
  $('result-best').innerHTML = `${best}<small>m</small>`; write('best','textContent',`${best} m`);
  $('pause').disabled = true;
  for(let i = 0; i < 32; i++) burst(run.player.x,run.player.y, i % 2 ? '#ff826b':'#f7d190',1.8);
  audio.cue('death');
  setOverlay('end-card'); $('restart').focus({preventScroll:true});
  speak('end');
}
function takeHit(event) {
  shake = 7; flash = .22;
  speak('hit');
  for(let i=0;i<14;i++)burst(run.player.x,run.player.y,i%2?'#f2c771':'#ff826b',1.2);
  fx.impact(run.player.x,run.player.y);audio.cue('hit');
  if(event.health===1)audio.scream();
}
// Each command owns one legal transition; hidden/stale controls cannot reset a live shift.
for(const [id,expected]of [['start','ready'],['restart','dead']])$(id).addEventListener('click',()=>{if(mode===expected)start();});
$('pause-restart').addEventListener('click',()=>{if(mode==='paused'&&!restartDialog.open){restartDialog.returnValue='cancel';restartDialog.showModal();}});
restartDialog.querySelector('form').addEventListener('submit',e=>{e.preventDefault();const confirmed=e.submitter?.value==='restart';restartDialog.close();if(confirmed&&mode==='paused')start();});
restartDialog.addEventListener('close',()=>{if(mode==='paused')$('resume').focus({preventScroll:true});});
$('pause').addEventListener('click',togglePause);$('resume').addEventListener('click',resume);
$('back').addEventListener('click',() => { if(mode!=='dead')return; checkpoint.clear(); mode = 'ready'; run = null; release(); particles = []; fx.clear(); audio.setRealm('ship'); setOverlay('intro'); write('distance','textContent','0000'); write('salvage','textContent','00'); write('sector','textContent',tr('Personnel deck')); speak('start'); $('start').focus({preventScroll:true}); });
function renderRecords() {
  write('pilot-tag','textContent',pilot.name);
  $('score-list').replaceChildren();
  const scores=pilot.scoresFor(scoreDifficulty);
  for (const [index, score] of scores.entries()) {
    const row = document.createElement('li');
    row.classList.toggle('current-score', score.id === lastScoreId);
    for (const value of [`${index + 1}. ${score.name}`, `${score.distance} m`, String(score.salvage)]) {
      const cell = document.createElement('span'); cell.textContent = value; row.append(cell);
    }
    $('score-list').append(row);
  }
  write('no-scores','hidden',scores.length > 0);
}
/** Pause a live run before editing records; browsing modes must not change its profile. */
function openRecords() {
  if (mode === 'playing') pause();
  scoreDifficulty=run?.difficulty??selectedDifficulty;
  document.querySelector(`#score-difficulty input[value="${scoreDifficulty}"]`).checked=true;
  release(); renderRecords(); write('pilot-name','value',pilot.name);
  write('pilot-saved','textContent','');
  $('records-close').firstChild.textContent = tr('Back')+' ';
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
  write('pilot-name','value',pilot.name); $('pilot-name').blur(); renderRecords();
  write('pilot-saved','textContent',tr(pilot.persistent ? 'Saved' : 'Could not save on this device.'));
});
$('pilot-name').addEventListener('focus', () => $('records-card').classList.add('editing'));
$('pilot-name').addEventListener('blur', () => $('records-card').classList.remove('editing'));
$('fullscreen').addEventListener('click',async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (frame.requestFullscreen) await frame.requestFullscreen(); } catch {} });
if (!frame.requestFullscreen) write('fullscreen','hidden',true);

/** Flight owns only canvas/pad pointer streams; native menu buttons never bubble into flight. */
function pointerDown(e) {
  if(mode!=='playing'||e.button!==0)return;
  e.preventDefault();
  const selection=window.getSelection();if(selection?.rangeCount)selection.removeAllRanges();
  pointers.set(e.pointerId,e.currentTarget);e.currentTarget.setPointerCapture(e.pointerId);
  syncHeld();fireWeapon();if(sound&&!audio.running)initAudio();
}
const pointerRelease=e=>{pointers.delete(e.pointerId);syncHeld();};
for(const surface of [canvas,thrust]) {
  surface.addEventListener('pointerdown',pointerDown);
  surface.addEventListener('lostpointercapture',pointerRelease);
}
window.addEventListener('pointerup',pointerRelease);window.addEventListener('pointercancel',pointerRelease);
// A changed layout orientation invalidates an in-progress gesture, never the run.
matchMedia('(orientation:portrait)').addEventListener('change',()=>{release();pause();});
const isEditing = target => target instanceof Element && target.closest('input, textarea, [contenteditable=true]');
// Non-interactive copy and flight share native-default suppression. Buttons and
// form controls retain native clicks, focus and editing; this never drives flight.
document.addEventListener('touchstart',e=>{
  const nativeAction=e.target instanceof Element&&e.target.closest('button,a[href],input,select,textarea,[contenteditable=true]');
  if(e.target instanceof Element&&(e.target.closest('#game,#thrust')||!nativeAction))e.preventDefault();
},{capture:true,passive:false});
// Browser selection/callout defaults are app-wide; editing keeps native controls.
for(const type of ['contextmenu','selectstart','dragstart'])document.addEventListener(type,e=>{if(!isEditing(e.target))e.preventDefault();},{capture:true});
thrust.addEventListener('keydown',e=>{if(mode==='playing' && ['Space','Enter'].includes(e.code)){e.preventDefault();if(!e.repeat)fireWeapon();keys.add(e.code);syncHeld();if(sound&&!audio.running)initAudio();}});
thrust.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();keys.delete(e.code);syncHeld();}});
window.addEventListener('keydown', e => {
  if (isEditing(e.target)||restartDialog.open) return;
  if (frame.classList.contains('show-records')) { if (e.code === 'Escape') closeRecords(); return; }
  if (['Space','ArrowUp','KeyW'].includes(e.code)) {
    // Space matches touch/click; Up/W give lift only, and X gives fire only.
    // The game's flight binding wins over a previously focused HUD button.
    // Editable fields and the records menu retain ordinary keyboard behavior.
    e.preventDefault(); e.stopPropagation(); if(e.repeat) return;
    if (mode === 'ready' || mode === 'dead') start();
    else if(mode === 'paused') resume();
    if(mode === 'playing') { keys.add(e.code); syncHeld(); if(e.code==='Space')fireWeapon(); if(sound && !audio.running) initAudio(); }
    return;
  }
  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) togglePause();
  if(e.code==='KeyX' && !e.repeat){e.preventDefault();fireWeapon();}
}, {capture:true});
window.addEventListener('keyup', e => {
  if (!isEditing(e.target) && !frame.classList.contains('show-records') && ['Space','ArrowUp','KeyW'].includes(e.code)) {e.preventDefault();e.stopPropagation();}
  keys.delete(e.code); syncHeld();
}, {capture:true});
window.addEventListener('blur',() => { release(); if(mode === 'playing') pause(); });
document.addEventListener('visibilitychange',() => { if(document.hidden)saveAndPause(); release(); audio.setMode(document.hidden ? 'paused' : mode); });
/** iOS may discard the process without unload; hidden/pagehide are durable save boundaries. */
function saveAndPause() {
  if(mode==='playing')pause();
  else if(mode==='paused')checkpoint.save(run);
}
window.addEventListener('pagehide',saveAndPause);

function burst(x,y,color,power=1) { if(particles.length > 180) return; particles.push({x,y,vx:(Math.random()-.5)*230*power,vy:(Math.random()-.5)*230*power,life:.45+Math.random()*.45,max:.9,color,r:2+Math.random()*4}); }
/** Consume fixed 120 Hz simulation steps and render UI only when values change. */
function tick(dt) {
  time+=dt; shake=Math.max(0,shake-dt*25);flash=Math.max(0,flash-dt*1.4);
  for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=100*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);
  if(mode!=='paused')fx.update(dt,mode==='playing'?run.speed:0);
  if(mode==='playing') {
    accumulator+=dt;
    while(accumulator>=1/120 && mode==='playing') {
      run.update(1/120,held);accumulator-=1/120;
      for(const event of run.events) {
        if(event.type==='coin') {for(let i=0;i<4;i++)burst(event.x,event.y,LOOT[event.kind].color,.6);audio.cue(event.kind==='salvage'?'coin':'loot-'+event.kind,run.salvage);}
        if(event.type==='loot-effect')fx.pickup(event.x,event.y);
        if(event.type==='cheer'){audio.cheer();fx.cheer(run.player.x,run.player.y);}
        if(event.type==='hit' && event.health>0)takeHit(event);
        if(event.type==='heal') {
          for(let i=0;i<5;i++)burst(event.x,event.y,'#b9d5a1',.4);
          audio.cue('heal');
        }
        if(event.type==='vehicle-board') {
          speak('vehicleBoard');audio.cue('board');
        }
        if(event.type==='vehicle-hit') {
          shake=4;
          fx.impact(event.x+20,event.y);if(event.hull>0)audio.cue('hull-hit');
        }
        if(event.type==='vehicle-break') {
          shake=11;fx.explode(event.x,event.y,'shuttle');audio.explosion('shuttle');audio.scream();
          speak('vehicleBreak');
        }
        if(event.type==='impact'){fx.impact(event.x,event.y);audio.cue('impact');}
        if(event.type==='destroy'){
          if(event.weapon==='tape')fx.paperwork(event.x,event.y);
          else fx.explode(event.x,event.y,['beam','fork'].includes(event.weapon)?'energy':event.hazard);
          audio.destruction(event.hazard,event.weapon);
          shake=Math.max(shake,event.hazard==='missile'?5:3);
        }
        if(event.type==='arc')fx.arc(event.points);
        if(event.type==='stamp'){fx.stamp(event.x,event.y,event.width,event.upgraded);shake=Math.max(shake,3);}
        if(event.type==='torpedo-burst'){fx.impact(event.x,event.y);audio.cue('torpedo-burst');}
        if(event.type==='beam')fx.beam(event.x,event.y,event.width,event.upgraded);
        if(event.type==='moon-bounce'||event.type==='moon-chomp'){fx.moon(event.x,event.y,event.type==='moon-bounce');audio.cue(event.type);}
        if(event.type==='missile-warning')audio.cue('missile-warning');
        if(event.type==='gear'){speak('gear');audio.cue('gear');}
        if(event.type==='crash') finish(event.hazard);
        if(event.type==='portal-warning') {speak('warning');audio.cue('portal-warning');}
        if(event.type==='portal') {fx.clear();particles=[];flash=.18;shake=3;audio.setRealm(run.realm);audio.portal();speak({machine:'enterMachine',organic:'enterOrganic',void:'enterVoid',aquarium:'enterAquarium',scrapyard:'enterScrapyard',ship:'backShip'}[run.realm]);}
        if(event.type==='normal') {speak('normal');audio.cue('normal');}
      }
    }
    updateRunHud();
    checkpointElapsed+=dt;
    if(mode==='playing'&&checkpointElapsed>=3){checkpoint.save(run);checkpointElapsed=0;}
    if(held && Math.random()>.25) {const p=run.player;particles.push({x:p.x-14,y:p.y+24,vx:-60-Math.random()*110,vy:65+Math.random()*50,life:.3,max:.4,color:Math.random()>.5?'#f9d88c':'#f7916f',r:2+Math.random()*3});}
  }
  const debt=Math.round(run?.entropy??0);
  if(Number($('time-debt').value)!==debt)write('time-debt','value',debt);
  if(!run)updateHealth();
  updateHull();
  audio.setMode(mode); audio.setThrust(mode==='playing' && held);
  updateThumb();
}
/** Refresh both live and recovered HUDs from the same simulation values. */
function updateRunHud() {
  write('distance','textContent',String(Math.floor(run.distance)).padStart(4,'0'));write('salvage','textContent',String(run.salvage).padStart(2,'0'));
  updateHealth();
  const destination=sectorFor(run);
  write('sector','textContent',destination.name.toLowerCase());
}
let thumbMode, thumbHeld, thumbWeapon, thumbVehicle, thumbAmmo;
function updateThumb() {
  const active = mode === 'playing' && held;
  const vehicle=!!run?.vehicle,weapon=run?run.firingWeapon:'ion';
  const ammo=weapon==='shuttle'?null:run?.ammo ?? null;
  if(thumbAmmo===ammo && thumbMode === mode && thumbHeld === active && thumbWeapon===weapon && thumbVehicle===vehicle)return;
  thumbAmmo=ammo;thumbMode = mode; thumbHeld = active; thumbWeapon=weapon;thumbVehicle=vehicle;
  frame.dataset.mode = mode;
  thrust.disabled = mode !== 'playing';
  thrust.classList.toggle('held',active); thrust.setAttribute('aria-pressed',String(active));
  write('thumb-instruction','textContent',tr(mode==='playing' ? active?'Release to fall':'Hold to rise' : mode==='paused'?'On a break' : mode==='dead'?'Another go?':'Hold to rise'));
  write('thrust-detail','textContent',weapon?'Tap to fire':'Release to fall');
  write('gear-status','textContent',weapon?(tr(vehicle&&weapon!=='shuttle'?WEAPONS[weapon].upgrade:WEAPONS[weapon].name))+(ammo!==null?` · ${ammo}`:''):tr('Unarmed'));
  thrust.setAttribute('aria-label',tr(weapon?'Hold to fly. Tap to fire. Release to fall.':'Hold to fly. Release to fall.'));
}
function loop(ms) {const dt=Math.min(.05,(ms-last)/1000||0);last=ms;tick(dt);renderer.draw({run,mode,held,time,particles,fx,shake,flash});requestAnimationFrame(loop);}
resize();
const recovered=checkpoint.load(W);
if(recovered) {
  run=recovered;selectedDifficulty=run.difficulty;best=pilot.best(selectedDifficulty);
  document.querySelector(`#difficulty-choice input[value="${selectedDifficulty}"]`).checked=true;
  write('run-mode','textContent',`· ${tr(DIFFICULTIES[selectedDifficulty].label)}`);write('best','textContent',`${best} m`);
  updateRunHud();audio.setRealm(run.realm);mode='playing';$('pause').disabled=false;canvas.tabIndex=0;pause();
}
document.querySelectorAll('.language-choice input').forEach(input=>{input.checked=input.value===getLanguage();});
translateShell();
document.querySelectorAll('.language-choice input').forEach(input=>input.addEventListener('change',()=>{
  if(!input.checked)return;setLanguage(input.value);
  document.querySelectorAll('.language-choice input').forEach(choice=>{choice.checked=choice.value===getLanguage();});
  translateShell();write('run-mode','textContent',`· ${tr(DIFFICULTIES[selectedDifficulty].label)}`);
  $('health').dataset.value='';shownHull=undefined;thumbMode=undefined;
  updateHealth();updateHull();updateSound();updateThumb();setPauseIcon(mode==='paused');
  if(run)updateRunHud();
  if(mode==='ready')crewChat('intro-chat','start');
  if(mode==='paused'){
    crewChat('pause-chat',lastRadioKey);
    if(run.portal&&!run.portal.passed)write('portal-destination','textContent',`Portal → ${run.portal.realm==='ship'?tr('Your ship'):sectorFor({realm:run.portal.realm}).name}`);
  }
}));
requestAnimationFrame(loop);
if('serviceWorker' in navigator) window.addEventListener('load',()=>{
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(registration=>{
    // Revalidate on launch, return to the app, reconnection and long active sessions.
    const check=()=>registration.update().catch(()=>{});
    check();window.addEventListener('online',check);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
    setInterval(()=>{if(!document.hidden)check();},60000);
  }).catch(()=>{});
});
