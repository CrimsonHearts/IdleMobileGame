/* ===========================================================================
 * story.js — Light narrative layer: a mentor and a recurring corporate
 * antagonist comment on the player's progress at milestones that already
 * exist (story quests, realms reached). No new systems — every trigger
 * below reuses a condition Game/Family/Quests already expose.
 * ========================================================================= */

const STORY_BEATS = [
  {
    id: 'intro', speaker: 'mentor', name: 'Granny Su', icon: '🍵',
    trigger: () => Game.state.lifetimeQi > 0,
    lines: [
      "So. The Qi answers your call already. Not everyone's does — most modern folk forgot how to listen.",
      'Su Wan. Three centuries old, if you must know, and too stubborn to either ascend or die. Granny Su will do.',
      "I'll be watching your progress, Cultivator. The world up there isn't as quiet as your meditation app makes it feel.",
    ],
  },
  {
    id: 'first_tribulation', speaker: 'mentor', name: 'Granny Su', icon: '🍵',
    trigger: () => Game.state.realm >= 2,
    lines: [
      "You felt that, didn't you — the sky itself testing your resolve. That was no metaphor. The Heavens really do judge.",
      "Be proud, but don't get comfortable. Tribulations only get crueler from here, and someone out there is watching who clears them, and how fast.",
    ],
  },
  {
    id: 'first_job', speaker: 'mentor', name: 'Granny Su', icon: '🍵',
    trigger: () => !!(Game.state.life && Game.state.life.jobId),
    lines: [
      'A paycheck and a purpose — good. Half the cultivators I knew burned out chasing power with empty pockets.',
      'Careful who you work for, though. Nearly every good job in this city traces back to one conglomerate sooner or later.',
    ],
  },
  {
    id: 'core_formation_mentor', speaker: 'mentor', name: 'Granny Su', icon: '🍵',
    trigger: () => Game.state.realm >= 3,
    lines: [
      "A Golden Core, condensed by your own hand. I haven't seen one forged this clean in years.",
      'It won’t go unnoticed, child. Jiutian Holdings tracks every Core that forms outside their own academies — they call it "market research." I call it a leash.',
    ],
  },
  {
    id: 'core_formation_antagonist', speaker: 'antagonist', name: 'Lu Heng · Jiutian Holdings', icon: '🏢',
    trigger: () => Game.state.realm >= 3,
    lines: [
      'Another independent Core. How quaint.',
      '— relayed through channels you didn’t know existed —',
      '"Growth like yours tends to attract offers. Or corrections. I’d hope you’re sensible enough to wait for the first."',
    ],
  },
  {
    id: 'kindred_spirit', speaker: 'mentor', name: 'Granny Su', icon: '🍵',
    trigger: () => {
      const f = Game.state.family;
      return !!(f && (f.spouse || (f.candidates && f.candidates.some(c => c.affinity >= 50))));
    },
    lines: [
      "Someone's caught your eye. Good. Jiutian likes its cultivators alone and hungry — a bond like that is the one asset they can't buy.",
    ],
  },
  {
    id: 'married', speaker: 'mentor', name: 'Granny Su', icon: '🍵',
    trigger: () => !!(Game.state.family && Game.state.family.spouse),
    lines: [
      "A household, built on your own terms. I never got the chance, fighting people like Lu Heng. Don't make my mistake — let this one keep you human.",
    ],
  },
  {
    id: 'nascent_soul', speaker: 'antagonist', name: 'Lu Heng', icon: '🏢',
    trigger: () => Game.state.realm >= 4,
    lines: [
      "Nascent Soul. You're climbing faster than the actuaries predicted.",
      'Understand me: Jiutian didn’t corner the spirit-stone market for profit alone. Immortality unrationed is immortality unmanaged — and unmanaged things get out of hand.',
      "I'm not your enemy. I'm just the one who decided someone should hold the gate. Better me than chaos.",
    ],
  },
  {
    id: 'ascension', speaker: 'mentor', name: 'Granny Su', icon: '🍵',
    trigger: () => Game.state.realm >= 9,
    lines: [
      "Immortal Ascension. I watched a hundred prodigies reach for this and stop short — and not always by choice.",
      "You didn’t buy your way past a single gate Lu Heng built. That’s the part he can’t stand: the proof that the path was never his to own.",
      'Go on. Climb past Heaven itself if you can. I’ll be here, kettle on, when you decide to come back down and start the next life.',
    ],
  },
];

const Story = {
  defs: STORY_BEATS,

  s() { this.init(); return Game.state.story; },
  fresh() { return { seen: {} }; },
  init() { if (!Game.state.story) Game.state.story = this.fresh(); },

  /** Run all triggers; returns array of newly-triggered beats (defs order). */
  checkAll() {
    const newly = [];
    this.defs.forEach(b => {
      if (this.s().seen[b.id]) return;
      try { if (b.trigger()) { this.s().seen[b.id] = true; newly.push(b); } }
      catch (_) {}
    });
    if (newly.length) Game.persist();
    return newly;
  },
};

window.Story = Story;
