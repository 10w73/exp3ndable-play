import {tr} from './language.js';
import {LESSONS} from './tutorial.js';

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
  show(tutorial) {
    this.clear();
    const {lesson,index,phase,practicing}=tutorial;
    document.getElementById('game-frame').classList.add('tutorial-open');
    this.card.classList.toggle('practicing',practicing);
    for(const node of document.querySelectorAll(lesson.target??'#game'))node.classList.add('tutorial-focus');
    document.getElementById('tutorial-progress').textContent=`${tr('Tutorial')} · ${index+1} / ${LESSONS.length}`;
    document.getElementById('tutorial-title').textContent=tr(phase==='retry'?'No harm done.':phase==='suspended'?'Take a break.':lesson.title);
    document.getElementById('tutorial-body').textContent=tr(phase==='retry'?'That was only practice. Try holding a little earlier to get above the bulkhead.':phase==='suspended'?'Your practice flight is stopped. Continue whenever you are ready.':lesson.body);
    document.getElementById('tutorial-detail').textContent=tr(lesson.detail);
    document.getElementById('tutorial-hint').textContent=tr(lesson.hint??'');
    this.next.textContent=tr(phase==='retry'?'Try again':phase==='suspended'?'Resume practice':lesson.id==='done'?'Play':lesson.action?'Try it':'Next');
    this.next.hidden=practicing;
    document.getElementById('tutorial-back').hidden=practicing||index===0;
    document.getElementById('tutorial-skip').hidden=!practicing;
    this.point(tutorial);
    if(!practicing)this.next.focus({preventScroll:true});
  }
  /** Remove only tutorial-owned presentation when a lesson changes or practice ends. */
  clear() {
    document.getElementById('game-frame').classList.remove('tutorial-open');
    for(const node of document.querySelectorAll('.tutorial-focus'))node.classList.remove('tutorial-focus');
    document.getElementById('tutorial-marker').hidden=true;
  }
  /** World-relative rings follow native resize geometry and never intercept a gesture. */
  point(tutorial) {
    const {run,lesson,practicing}=tutorial,marker=document.getElementById('tutorial-marker');
    const target=lesson.id==='collect'?run.coins[0]:lesson.id==='avoid'?run.obstacles[0]:lesson.id==='equipment'?run.gear:lesson.id==='portal'?run.portal:null;
    marker.hidden=practicing||!target;if(marker.hidden)return;
    const rx=lesson.id==='portal'?62:lesson.id==='avoid'?36:24,ry=lesson.id==='portal'?80:lesson.id==='avoid'?80:24;
    const left=Math.max(0,target.x-rx),right=Math.min(run.width,target.x+rx);
    marker.style.cssText=`left:${left/run.width*100}%;top:${(target.y-ry)/600*100}%;width:${(right-left)/run.width*100}%;height:${ry*2/600*100}%`;
  }
}
