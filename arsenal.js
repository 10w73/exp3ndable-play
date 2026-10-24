// Distinct toys, one thumb. Regular weapons are unlimited; oddities are borrowed.
export const WEAPONS = Object.freeze({
  ion: Object.freeze({name:'Ion rifle', color:'#d4f3a5', cooldown:.18, damage:1, speed:780, radius:6, ammo:null}),
  torpedo: Object.freeze({name:'Photon spread', upgrade:'Photon broadside', color:'#edb28b', cooldown:.55, damage:2, speed:620, radius:10, splash:60, ammo:null}),
  beam: Object.freeze({name:'Amber lance', upgrade:'Amber cannon', color:'#efb45f', cooldown:.72, damage:3, radius:18, ammo:null}),
  fork: Object.freeze({name:'Arc fork', upgrade:'Storm fork', color:'#b8c9ed', cooldown:.46, damage:2, links:3, ammo:null}),
  moon: Object.freeze({name:'Pet Moon', upgrade:'Twin moons', color:'#e5d8ad', cooldown:.7, damage:4, speed:230, radius:32, ammo:12}),
  tape: Object.freeze({name:'Red Tape', upgrade:'Mass layoff', color:'#d89789', cooldown:.85, damage:Infinity, ammo:10}),
  shuttle: Object.freeze({name:'Shuttle emitter', color:'#b2ddd2', cooldown:.18, damage:1, speed:780, radius:6, ammo:null})
});
export const REGULAR_WEAPONS=Object.freeze(['torpedo','beam','fork']);
