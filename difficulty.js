// Low-debt relief stays modest. The steeper recovery slope lets roughly a
// third of the offered material sustain a run instead of requiring most loot.
export const DIFFICULTIES=Object.freeze({
  regular:Object.freeze({label:'Regular',reliefBase:.82,reliefSlope:6,timeHold:1.75,pressureGain:1}),
  hard:Object.freeze({label:'Hard',reliefBase:.75,reliefSlope:4.8,timeHold:1.25,pressureGain:1.1})
});

export const isDifficulty=value=>typeof value==='string'&&Object.hasOwn(DIFFICULTIES,value);
