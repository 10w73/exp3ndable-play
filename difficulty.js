export const DIFFICULTIES=Object.freeze({
  regular:Object.freeze({label:'Regular',reliefBase:.82,reliefSlope:1.5,timeHold:1.75,pressureGain:1}),
  hard:Object.freeze({label:'Hard',reliefBase:.75,reliefSlope:1.25,timeHold:1.25,pressureGain:1.1})
});

export const isDifficulty=value=>typeof value==='string'&&Object.hasOwn(DIFFICULTIES,value);
