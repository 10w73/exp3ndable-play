// Equipment keeps the same one-thumb controls; only the shot pattern changes.
export const WEAPONS = Object.freeze({
  ion: Object.freeze({name:'Ion rifle', color:'#d4f3a5', cooldown:.18, damage:1, spread:0}),
  pulse: Object.freeze({name:'Pulse driver', color:'#edc393', cooldown:.32, damage:2, spread:0}),
  fork: Object.freeze({name:'Fork emitter', color:'#b8c9ed', cooldown:.28, damage:1, spread:42}),
  shuttle: Object.freeze({name:'Shuttle emitter', color:'#b2ddd2', cooldown:.18, damage:1, spread:0})
});
export const PICKUP_WEAPONS = Object.freeze(['ion','pulse','fork']);
