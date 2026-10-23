const KEY = 'expendable.pilot';
const DEFAULT_NAME = 'CREW-07';
export function pilotName(value) {
  return [...String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').replace(/\s+/g, ' ').trim()].slice(0, 12).join('') || DEFAULT_NAME;
}
const validScore = score => score && typeof score.id === 'string' &&
  Number.isSafeInteger(score.distance) && score.distance >= 0 &&
  Number.isSafeInteger(score.salvage) && score.salvage >= 0;

// One browser, no account or network. Storage failure never blocks a shift.
export class PilotRecords {
  constructor(storage) {
    this.storage = storage; this.name = DEFAULT_NAME; this.scores = []; this.persistent = false;
    try {
      const saved = JSON.parse(storage?.getItem(KEY) || 'null');
      if (saved && typeof saved.name === 'string') this.name = pilotName(saved.name);
      if (Array.isArray(saved?.scores)) this.scores = saved.scores.slice(0, 100).filter(validScore)
        .map(score => ({ id: score.id.slice(0, 80), name: pilotName(score.name), distance: score.distance, salvage: score.salvage }));
    } catch {}
    this.rank();
  }
  rank() { this.scores.sort((a,b) => b.distance - a.distance || b.salvage - a.salvage); this.scores.length = Math.min(5, this.scores.length); }
  save() {
    try {
      if (!this.storage) throw new Error('Storage unavailable');
      this.storage.setItem(KEY, JSON.stringify({ name: this.name, scores: this.scores }));
      this.persistent = true;
    } catch { this.persistent = false; }
  }
  setName(value, recordId) {
    this.name = pilotName(value);
    const score = this.scores.find(score => score.id === recordId);
    if (score) score.name = this.name;
    this.save();
  }
  add(distance, salvage) {
    const score = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: this.name, distance, salvage };
    if (!validScore(score)) return null;
    this.scores.push(score); this.rank(); this.save(); return score.id;
  }
}
