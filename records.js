import {isDifficulty} from './difficulty.js';

const KEY = 'expendable.pilot';
const DEFAULT_NAME = 'CREW-07';
/** Normalize and bound a display name while rejecting control characters. */
export function pilotName(value) {
  return [...String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').replace(/\s+/g, ' ').trim()].slice(0, 12).join('') || DEFAULT_NAME;
}
const validScore = score => score && typeof score.id === 'string' &&
  Number.isSafeInteger(score.distance) && score.distance >= 0 &&
  Number.isSafeInteger(score.salvage) && score.salvage >= 0;

// One browser, no account or network. Storage failure never blocks a shift.
export class PilotRecords {
  /** Load remembered mode and separate score boards, tolerating unavailable storage. */
  constructor(storage) {
    this.storage = storage; this.name = DEFAULT_NAME; this.scores = []; this.persistent = false;
    this.difficulty='regular';this.bests={regular:0,hard:0};
    try {
      const saved = JSON.parse(storage?.getItem(KEY) || 'null');
      if (saved && typeof saved.name === 'string') this.name = pilotName(saved.name);
      if(isDifficulty(saved?.difficulty))this.difficulty=saved.difficulty;
      for(const difficulty of ['regular','hard'])if(Number.isSafeInteger(saved?.bests?.[difficulty])&&saved.bests[difficulty]>=0)this.bests[difficulty]=saved.bests[difficulty];
      if (Array.isArray(saved?.scores)) this.scores = saved.scores.slice(0, 100).filter(score=>validScore(score)&&(score.difficulty===undefined||isDifficulty(score.difficulty)))
        .map(score => ({ id: score.id.slice(0, 80), name: pilotName(score.name), distance: score.distance, salvage: score.salvage,difficulty:score.difficulty??'hard' }));
    } catch {}
    try {const previous=Number(storage?.getItem('expendable.best'));if(Number.isSafeInteger(previous)&&previous>=0)this.bests.hard=Math.max(this.bests.hard,previous);}catch{}
    for(const score of this.scores)this.bests[score.difficulty]=Math.max(this.bests[score.difficulty],score.distance);
    this.rank();
  }
  rank() {
    const counts={regular:0,hard:0};
    this.scores.sort((a,b) => b.distance - a.distance || b.salvage - a.salvage);
    this.scores=this.scores.filter(score=>++counts[score.difficulty]<=5);
  }
  /** Return a mode-specific board without exposing the other mode's ranking. */
  scoresFor(difficulty){return this.scores.filter(score=>score.difficulty===difficulty);}
  /** Read the selected mode's best distance with a safe invalid-mode fallback. */
  best(difficulty){return isDifficulty(difficulty)?this.bests[difficulty]:0;}
  /** Persist the next-run choice without changing an active run. */
  setDifficulty(difficulty){if(!isDifficulty(difficulty))return;this.difficulty=difficulty;this.save();}
  /** Persist session records; report storage failure without interrupting play. */
  save() {
    try {
      if (!this.storage) throw new Error('Storage unavailable');
      this.storage.setItem(KEY, JSON.stringify({ name: this.name, scores: this.scores,difficulty:this.difficulty,bests:this.bests }));
      this.persistent = true;
    } catch { this.persistent = false; }
  }
  /** Rename the pilot and optionally the current report, preserving older names. */
  setName(value, recordId) {
    this.name = pilotName(value);
    const score = this.scores.find(score => score.id === recordId);
    if (score) score.name = this.name;
    this.save();
  }
  /** Record one completed run and retain five ranked entries per mode. */
  add(distance, salvage, difficulty=this.difficulty) {
    const score = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: this.name, distance, salvage,difficulty };
    if (!validScore(score)||!isDifficulty(difficulty)) return null;
    this.bests[difficulty]=Math.max(this.bests[difficulty],distance);
    this.scores.push(score); this.rank(); this.save(); return score.id;
  }
}
