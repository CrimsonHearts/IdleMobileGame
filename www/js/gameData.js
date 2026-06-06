/* ===========================================================================
 * gameData.js — All game balance & theme content in one place.
 * Theme: Chinese cultivation (xianxia). Edit values here to re-balance
 * without touching game logic.
 * ========================================================================= */

const GameData = {
  // -- Meta -----------------------------------------------------------------
  theme: {
    title: 'Path to Immortality',
    currencyName: 'Qi',
    currencyIcon: '☯',
    tapVerb: 'Meditate',
    prestigeCurrencyName: 'Dao Comprehension',
    prestigeIcon: '☯',
  },

  // -- Offline / anti-cheat tuning -----------------------------------------
  offline: {
    maxSeconds: 8 * 3600,   // cap offline earnings at 8 hours
    efficiency: 0.5,        // earn 50% of active rate while away (rest claimable via rewarded ad later)
    minSecondsToShow: 30,   // don't show the "welcome back" popup for trivial gaps
  },

  // -- Manual tap -----------------------------------------------------------
  tap: {
    baseGain: 1,            // Qi per meditate tap (before multipliers)
  },

  /* -- Generators ----------------------------------------------------------
   * Each generator produces Qi/sec. Cost grows by costGrowth^owned.
   * baseProd is the Qi/sec PER unit owned (before global multipliers).
   */
  generators: [
    { id: 'mat',     name: 'Meditation App',        icon: '🧘', baseCost: 15,           costGrowth: 1.15, baseProd: 0.1,
      desc: 'A smartphone app that guides your breathing and trickles in ambient Qi.' },
    { id: 'herb',    name: 'Hydroponic Spirit Garden', icon: '🌿', baseCost: 100,       costGrowth: 1.15, baseProd: 1,
      desc: 'A smart-glass greenhouse growing gene-edited spirit herbs around the clock.' },
    { id: 'stone',   name: 'Spirit Crystal Rig',    icon: '💎', baseCost: 1100,         costGrowth: 1.15, baseProd: 8,
      desc: 'A mining rig that refines raw spirit crystals into usable Qi.' },
    { id: 'furnace', name: 'Auto-Alchemy Lab',       icon: '⚗️', baseCost: 12000,        costGrowth: 1.15, baseProd: 47,
      desc: 'A robotic pill furnace that synthesises Qi-dense compounds.' },
    { id: 'library', name: 'Cloud Scripture Server',  icon: '📜', baseCost: 130000,      costGrowth: 1.15, baseProd: 260,
      desc: 'A datacenter streaming the collected Dao to your neural link.' },
    { id: 'sword',   name: 'Sword-Drone Bay',         icon: '🗡️', baseCost: 1400000,     costGrowth: 1.15, baseProd: 1400,
      desc: 'A hangar of autonomous flying swords humming with sword-intent.' },
    { id: 'array',   name: 'Qi Fusion Reactor',       icon: '🏯', baseCost: 20000000,    costGrowth: 1.15, baseProd: 7800,
      desc: 'A city-scale reactor condensing spiritual energy from the grid.' },
    { id: 'dragon',  name: 'Dragon-Vein Power Plant', icon: '🐉', baseCost: 330000000,   costGrowth: 1.15, baseProd: 44000,
      desc: 'Tapped directly into the earth-dragon ley lines beneath the metropolis.' },
    { id: 'star',    name: 'Orbital Star Collector',   icon: '🌌', baseCost: 5100000000, costGrowth: 1.15, baseProd: 260000,
      desc: 'A satellite array harvesting starlight Qi from low orbit.' },
    { id: 'heaven',  name: 'Dao Quantum Core',         icon: '🪷', baseCost: 75000000000, costGrowth: 1.15, baseProd: 1600000,
      desc: 'A quantum computer that simulates the Heavenly Dao itself.' },
  ],

  /* -- Cultivation Realms (the prestige ladder) ----------------------------
   * To "Break Through" to the next realm you must reach reqQi LIFETIME Qi in
   * the current life. Breaking through resets Qi & generators but grants
   * Dao Comprehension (permanent global multiplier).
   */
  realms: (() => {
    // Stage-name sets reused across realms.
    const NINE = ['1st Layer','2nd Layer','3rd Layer','4th Layer','5th Layer','6th Layer','7th Layer','8th Layer','9th Layer'];
    const QUAD = ['Early Stage','Middle Stage','Late Stage','Great Perfection'];
    return [
      { name: 'Mortal',                   reqQi: 0,    stages: ['Mortal Body','Qi Sensing'] },
      { name: 'Qi Condensation',          reqQi: 1e3,  stages: NINE },
      { name: 'Foundation Establishment', reqQi: 1e5,  stages: QUAD },
      { name: 'Core Formation',           reqQi: 1e7,  stages: QUAD },
      { name: 'Nascent Soul',             reqQi: 1e9,  stages: QUAD },
      { name: 'Soul Formation',           reqQi: 1e11, stages: QUAD },
      { name: 'Void Refinement',          reqQi: 1e13, stages: QUAD },
      { name: 'Body Integration',         reqQi: 1e15, stages: QUAD },
      { name: 'Great Ascension',          reqQi: 1e17, stages: QUAD },
      { name: 'Immortal Ascension',       reqQi: 1e19, stages: ['Tribulation','Half-Immortal','True Immortal','Golden Immortal'] },
    ];
  })(),

  /* RunQi (Qi earned this life) required to reach a given minor stage.
   * Stages are spread geometrically between this realm's anchor and the next
   * realm's requirement; the major Tribulation becomes available once every
   * minor stage of the realm is cleared.
   */
  stageReq(realmIndex, stageIndex) {
    const realms = this.realms;
    const realm = realms[realmIndex];
    const next = realms[realmIndex + 1];
    const start = realm.reqQi > 0 ? realm.reqQi : (next ? next.reqQi / 1000 : 100);
    const end = next ? next.reqQi : start * 1e6;
    const S = realm.stages.length;
    return start * Math.pow(end / start, (stageIndex + 1) / (S + 1));
  },

  // -- Character creation ---------------------------------------------------
  genders: {
    male:   { key: 'male',   label: 'Male',   emblem: 'assets/cultivator.svg',        honorific: 'Daoist' },
    female: { key: 'female', label: 'Female', emblem: 'assets/cultivator-female.svg', honorific: 'Fairy' },
  },

  /* Spiritual Root: your birth talent — a permanent global multiplier.
   * Rolled (weighted) at character creation; the player may re-divine freely.
   */
  spiritualRoots: [
    { key: 'mortal', name: 'Mortal Spirit Root',   element: 'Azure',   mult: 1.0, weight: 50, color: '#7f94a8', desc: 'Common roots. The road is long, but diligence overcomes talent.' },
    { key: 'true',   name: 'True Spirit Root',      element: 'Verdant', mult: 1.6, weight: 28, color: '#6fb594', desc: 'Pure single-element roots — a solid foundation for cultivation.' },
    { key: 'heaven', name: 'Heavenly Spirit Root',  element: 'Lunar',   mult: 2.6, weight: 14, color: '#5aa9e6', desc: 'A rare gift of the heavens; Qi flows to you with ease.' },
    { key: 'saint',  name: 'Saint Spirit Root',     element: 'Radiant', mult: 4.5, weight: 6,  color: '#e7c878', desc: 'The mark of a born sage — destined for greatness.' },
    { key: 'chaos',  name: 'Chaos Spirit Root',     element: 'Phoenix', mult: 8.0, weight: 2,  color: '#c8503f', desc: 'A legendary root said to appear once in ten thousand years.' },
  ],

  // Painted character portraits drop in here as <gender>-<rootKey>.jpg (see
  // docs/CHARACTER-ART.md). If a file is missing, the vector emblem is used.
  portraitDir: 'assets/portraits/',

  rollSpiritualRoot() {
    const total = this.spiritualRoots.reduce((s, r) => s + r.weight, 0);
    let n = Math.random() * total;
    for (const r of this.spiritualRoots) { if ((n -= r.weight) <= 0) return r; }
    return this.spiritualRoots[0];
  },

  // +5% permanent global production per minor stage ever cleared (Cultivation Base).
  stageBonusPerStage: 0.05,

  // Each point of Dao Comprehension grants this fractional global bonus.
  // Total multiplier = 1 + (daoComprehension * daoBonusPerPoint).
  daoBonusPerPoint: 0.02, // +2% global production per point

  /* Dao Comprehension earned when breaking through, based on lifetime Qi this
   * run. Tuned so each realm yields a meaningful jump.
   */
  daoGainFor(lifetimeQiThisRun) {
    if (lifetimeQiThisRun < 1e3) return 0;
    return Math.floor(Math.pow(lifetimeQiThisRun / 1e3, 0.4));
  },

  /* -- Upgrades ------------------------------------------------------------
   * One-time purchases. effect() mutates a multipliers object at runtime.
   * 'cost' is in Qi unless 'currency' is 'dao'.
   */
  upgrades: [
    { id: 'tap1',  name: 'Heart Sutra',       icon: '📖', cost: 250,    currency: 'qi',
      desc: 'Doubles Qi gained from meditating.', effect: m => { m.tapMult *= 2; } },
    { id: 'tap2',  name: 'Breathing Art',     icon: '🌬️', cost: 50000,  currency: 'qi',
      desc: 'Triples Qi gained from meditating.', effect: m => { m.tapMult *= 3; } },
    { id: 'all1',  name: 'Spirit Root Awakening', icon: '✨', cost: 10000, currency: 'qi',
      desc: 'All generators produce 50% more Qi.', effect: m => { m.allMult *= 1.5; } },
    { id: 'all2',  name: 'Dao Heart',         icon: '💗', cost: 2500000, currency: 'qi',
      desc: 'All generators produce double Qi.',  effect: m => { m.allMult *= 2; } },
    { id: 'offline1', name: 'Dream Cultivation', icon: '🌙', cost: 5, currency: 'dao',
      desc: 'Offline cultivation efficiency +25% (cap raised to 75%).', effect: m => { m.offlineBonus += 0.25; } },
  ],

  saveVersion: 1,
  saveKey: 'xianxia_idle_save_v1',
};

window.GameData = GameData;
