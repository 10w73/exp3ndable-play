import {tr} from './language.js';
import {LESSONS} from './tutorial.js';
import {HEIGHT} from './engine.js';

/** Native, player-paced coaching outside the canvas, with no duplicated flight input. */
export class TutorialView {
  constructor(next,back,skip,leave) {
    this.card=document.getElementById('tutorial-card');
    this.next=document.getElementById('tutorial-next');
    this.next.addEventListener('click',next);
    document.getElementById('tutorial-back').addEventListener('click',back);
    document.getElementById('tutorial-skip').addEventListener('click',skip);
    document.getElementById('tutorial-leave').addEventListener('click',leave);
  }
  /** Highlight actual UI targets without moving their boxes or stealing their native actions. */
  show(tutorial,returning=false) {
    this.clear();
    const {lesson,index,phase,practicing}=tutorial;
    document.getElementById('game-frame').classList.add('tutorial-open');
    this.card.classList.toggle('practicing',practicing);
    if(lesson.target)for(const node of document.querySelectorAll(lesson.target))node.classList.add('tutorial-focus');
    document.getElementById('tutorial-progress').textContent=`${tr('Tutorial')} · ${index+1} / ${LESSONS.length}`;
    document.getElementById('tutorial-title').textContent=tr(phase==='retry'?'No harm done.':phase==='suspended'?'Take a break.':lesson.title);
    document.getElementById('tutorial-body').textContent=tr(phase==='retry'?lesson.retry:phase==='suspended'?'Your practice flight is stopped. Continue whenever you are ready.':lesson.body);
    document.getElementById('tutorial-detail').textContent=tr(returning&&lesson.id==='done'?'Your ordinary flight is still paused. Return to it whenever you are ready, or use Back to practise a lesson again.':lesson.detail);
    document.getElementById('tutorial-hint').textContent=tr(lesson.hint??'');
    this.next.textContent=tr(phase==='retry'?'Try again':phase==='suspended'?'Resume practice':lesson.id==='done'?returning?'Back to your run':'Play':lesson.action?'Try it':'Next');
    document.getElementById('tutorial-leave').textContent=tr(returning?'Back to your run':'Leave tutorial');
    this.next.hidden=practicing;
    document.getElementById('tutorial-back').hidden=practicing||index===0;
    document.getElementById('tutorial-skip').hidden=!practicing;
    document.getElementById('tutorial-skill-progress').hidden=!practicing||!['steer','aim','avoid'].includes(lesson.id);
    this.point(tutorial);this.update(tutorial);
    if(!practicing)this.next.focus({preventScroll:true});
  }
  /** Remove only tutorial-owned presentation when a lesson changes or practice ends. */
  clear() {
    document.getElementById('game-frame').classList.remove('tutorial-open');
    for(const node of document.querySelectorAll('.tutorial-focus'))node.classList.remove('tutorial-focus');
    document.getElementById('tutorial-marker').hidden=true;
    document.getElementById('tutorial-lane').hidden=true;
    document.getElementById('tutorial-skill-progress').hidden=true;
  }
  /** Refresh only practice feedback; normal play never calls this owner. */
  update(tutorial) {
    const meter=document.getElementById('tutorial-skill-progress');
    const value=Math.round(tutorial.progress*100);if(meter.value!==value)meter.value=value;
    if(tutorial.practicing&&tutorial.lesson.id==='aim')this.point(tutorial);
  }
  /** World-relative rings follow native resize geometry and never intercept a gesture. */
  point(tutorial) {
    const {run,lesson,practicing}=tutorial,marker=document.getElementById('tutorial-marker');
    const target=lesson.id==='aim'?run.obstacles[0]:lesson.id==='collect'?run.coins[0]:lesson.id==='avoid'?run.obstacles[0]:lesson.id==='equipment'?run.gear:lesson.id==='portal'?run.portal:null;
    const lane=document.getElementById('tutorial-lane'),band=tutorial.band;
    lane.hidden=!['steer','aim','avoid'].includes(lesson.id);
    const y=lesson.id==='aim'&&target?target.y:band.y,half=lesson.id==='aim'?28:band.halfHeight;
    lane.style.top=`${(y-half)/HEIGHT*100}%`;lane.style.height=`${half*2/HEIGHT*100}%`;
    marker.hidden=!target||(practicing&&lesson.id!=='aim');if(marker.hidden)return;
    const rx=lesson.id==='portal'?62:lesson.id==='avoid'?36:24,ry=lesson.id==='portal'?80:lesson.id==='avoid'?80:24;
    const left=Math.max(0,target.x-rx),right=Math.min(run.width,target.x+rx);
    marker.style.cssText=`left:${left/run.width*100}%;top:${(target.y-ry)/HEIGHT*100}%;width:${(right-left)/run.width*100}%;height:${ry*2/HEIGHT*100}%`;
  }
}
