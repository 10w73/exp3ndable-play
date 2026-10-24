// Original crew. Quiet comms, with time to read each reply.
export const CREW = {
  pip: { name: 'Pip', color: '#d3b18c' },
  siv: { name: 'Siv', color: '#aec4c6' },
  moss: { name: 'Moss', color: '#b5c796' }
};
const line = (speaker, text) => ({speaker, text});
const pip = text => line('pip', text), siv = text => line('siv', text), moss = text => line('moss', text);
const exchanges = {
  start: [
    [pip('Why is the corridor speeding up?'), siv('Collect the Stillmatter. Time is getting ideas.')],
    [pip('I booked the quiet shift.'), siv('This is the quiet shift.')],
    [pip('Should I log the explosion?'), siv('It has logged itself.')],
    [moss('Little errand. Grab the rifle. Ignore the second moon.'), pip('We had one moon when I clocked in.')]
  ],
  crew: [
    [pip('If we save the ship, does this count toward promotion?'), siv('You are holding a stolen jetpack.')],
    [pip('I rehearsed the evacuation. There were fewer teeth.'), siv('An outdated simulation.')],
    [moss('The reactor grew a conscience. I pulled the cable.'), pip('Was that the screaming cable?')],
    [pip('I brought the emergency binder.'), moss('Good. Throw it at something expensive.')],
    [moss('Shit. Did we leave the universe on?'), siv('It appears to be running.')],
    [pip('The captain said to show initiative.'), siv('Try showing it toward the exit.')],
    [moss('The coffee machine learned particle physics.'), siv('Its coffee remains inadequate.')],
    [pip('I think I just shot my performance review.'), siv('Your strongest work this quarter.')]
  ],
  machine: [
    [pip('The cube wants my employee number.'), siv('Give it your resignation.')],
    [moss('Fuck the map. The map works for the cube.'), pip('I laminated that map.')],
    [pip('It says resistance is inefficient.'), siv('So is this meeting.')],
    [moss('That thing assimilated a printer. Now it needs toner.'), siv('A devastating tactical error.')]
  ],
  organic: [
    [pip('Is that a door or a mouth?'), siv('Both. Knock once.')],
    [moss('Do not eat the locals. I owe three of them money.'), pip('Why would that be my first instinct?')],
    [pip('The floor is breathing.'), siv('Match its pace. It seems calm.')],
    [moss('That gland is a customs office. No eye contact.'), pip('Which eye? There are nine.')]
  ],
  void: [
    [moss('That tiny planet is my garage. Do not land on it.'), pip('It has weather.')],
    [pip('I can see the back of my own head.'), siv('Your collar is crooked.')],
    [moss('Space is a cheap trick. Corners are where they get you.'), siv('We will proceed diagonally.')],
    [pip('Is that another me?'), moss('Nope. Yours has a pension. Keep moving.')]
  ],
  aquarium: [
    [pip('That jellyfish has an office.'), siv('It has tenure. Avoid discussing funding.')],
    [moss('Fish invented bureaucracy. We just added shoes.'), pip('Then why is it holding my appraisal?')],
    [pip('The tank says do not promote the fish.'), siv('A policy written from experience.')]
  ],
  scrapyard: [
    [pip('That crate is following me.'), moss('Warranty collection. Do not let it smell the receipt.')],
    [moss('Whole moon is spare parts. Fucking paradise.'), siv('Your shuttle was assembled here. That explains much.')],
    [pip('The crane is rescuing a spoon.'), siv('An essential member of the crew.')]
  ],
  hit: [
    [pip('Okay. Okay. Still here.'), siv('Yes. Continue being here.')],
    [moss('You are fine. Mostly. I am rounding up.'), pip('Please stop doing medical maths.')],
    [pip('That took the rifle.'), moss('Cheap bastard. We will steal another.')]
  ],
  gear: [
    [moss('New toy. Safety is a state of mind.'), siv('Keep it pointed away from your organs.')],
    [pip('This one has a warranty.'), siv('It is written on tape.')],
    [pip('The ammunition is looking at me.'), moss('Emotional support moon. Do not get attached. It eats engines.')],
    [moss('Ten shots of pure bureaucracy. Fucking weaponised middle management.'), siv('At last. A practical application.')]
  ],
  warning: [
    [moss('Top half: floaty. Bottom half: money. Miss it: same shit.'), pip('I would like the same shit, please.')],
    [moss('I opened a shortcut. It is only technically a wound.'), siv('You can also fly around it. An underused option.')]
  ],
  enterMachine: [[moss('Oh, this smug fucking box again.'), siv('It has rearranged the furniture.')]],
  enterOrganic: [[pip('I do not think this place is up to code.'), moss('It ate the code. And the inspector.')]],
  enterAquarium: [[moss('The annex. Do not fuck with the faculty.'), pip('The faculty have tentacles.')]],
  enterScrapyard: [[pip('Is that our old shuttle?'), moss('Bits of it. Depends how sentimental you get about bolts.')]],
  vehicleBoard: [[moss('Found you a shuttle. It is mostly shuttle.'), pip('Why does it have a kitchen sink?')]],
  vehicleBreak: [[moss('That was the escape function.'), siv('A bold interpretation of disassembly.')]],
  backShip: [[pip('Our ship. Our ordinary, awful ship.'), siv('Your coffee is probably still warm.')]],
  enterVoid: [[moss('Beautiful. Physics has left the room.'), pip('I would like to follow it.')]],
  normal: [
    [siv('Gravity has returned.'), moss('Clingy little force, isn’t it?')],
    [pip('Back on the ship. Good. I understand ship problems.'), siv('The lunch has escaped again.')]
  ],
  end: [
    [pip('Can we leave that part out of the report?'), siv('I have already used a smaller font.')],
    [moss('Right. Bad corridor. Excellent data.'), pip('You owe me a new everything.')]
  ]
};

export class CrewRadio {
  constructor(random = Math.random) { this.random = random; this.bags = new Map(); this.last = new Map(); this.pending = []; }
  start(key) {
    const options = exchanges[key] || exchanges.crew;
    let bag = this.bags.get(key);
    if (!bag?.length) {
      bag = options.map((_,i)=>i);
      for(let i=bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
      if(bag.length>1 && bag.at(-1)===this.last.get(key)) [bag[0],bag[bag.length-1]]=[bag.at(-1),bag[0]];
      this.bags.set(key,bag);
    }
    const index=bag.pop();this.last.set(key,index);
    const [first,...rest]=options[index];this.pending=rest;return first;
  }
  reply() { return this.pending.shift() || null; }
  get hasReply() { return this.pending.length>0; }
}
