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
   * Rolled during the gacha at character creation.
   * weight = free-roll odds | paidWeight = premium-roll odds
   */
  spiritualRoots: [
    { key: 'mortal', name: 'Mortal Spirit Root',   element: 'Azure',   mult: 1.0, weight: 50, paidWeight: 15, color: '#7f94a8', desc: 'Common roots. The road is long, but diligence overcomes talent.' },
    { key: 'true',   name: 'True Spirit Root',      element: 'Verdant', mult: 1.6, weight: 28, paidWeight: 35, color: '#6fb594', desc: 'Pure single-element roots — a solid foundation for cultivation.' },
    { key: 'heaven', name: 'Heavenly Spirit Root',  element: 'Lunar',   mult: 2.6, weight: 14, paidWeight: 28, color: '#5aa9e6', desc: 'A rare gift of the heavens; Qi flows to you with ease.' },
    { key: 'saint',  name: 'Saint Spirit Root',     element: 'Radiant', mult: 4.5, weight: 6,  paidWeight: 16, color: '#e7c878', desc: 'The mark of a born sage — destined for greatness.' },
    { key: 'chaos',  name: 'Chaos Spirit Root',     element: 'Phoenix', mult: 8.0, weight: 2,  paidWeight: 6,  color: '#c8503f', desc: 'A legendary root said to appear once in ten thousand years.' },
  ],

  // Painted character portraits drop in here as <gender>-<rootKey>.jpg (see
  // docs/CHARACTER-ART.md). If a file is missing, the vector emblem is used.
  portraitDir: 'assets/portraits/',

  /**
   * Roll a Spiritual Root.
   * mode: 'free'        — standard weights (default)
   *       'paid'        — improved weights, no Mortal weighting advantage
   *       'min_true'    — True/Heaven/Saint/Chaos only
   *       'min_heaven'  — Heaven/Saint/Chaos only
   *       'min_saint'   — Saint/Chaos only
   *       'chaos'       — guaranteed Chaos
   *       'saint'       — guaranteed Saint
   *       'heaven'      — guaranteed Heaven
   */
  rollSpiritualRoot(mode = 'free') {
    const all = this.spiritualRoots;
    if (mode === 'chaos')  return all.find(r => r.key === 'chaos');
    if (mode === 'saint')  return all.find(r => r.key === 'saint');
    if (mode === 'heaven') return all.find(r => r.key === 'heaven');

    let pool;
    if      (mode === 'min_saint')  pool = all.filter(r => ['saint','chaos'].includes(r.key));
    else if (mode === 'min_heaven') pool = all.filter(r => ['heaven','saint','chaos'].includes(r.key));
    else if (mode === 'min_true')   pool = all.filter(r => r.key !== 'mortal');
    else                            pool = all;

    const wKey = (mode === 'paid' || mode === 'min_true' || mode === 'min_heaven' || mode === 'min_saint')
                 ? 'paidWeight' : 'weight';
    const total = pool.reduce((s, r) => s + (r[wKey] || r.weight), 0);
    let n = Math.random() * total;
    for (const r of pool) { if ((n -= (r[wKey] || r.weight)) <= 0) return r; }
    return pool[pool.length - 1];
  },

  /* -- Spirit Root Gacha Packs (IAP) ----------------------------------------
   * Displayed in character creation after free rolls are exhausted (or any time).
   * guaranteedRoot: always gives this root.
   * minRoot: rolls within that tier and above.
   */
  spiritRootPacks: [
    {
      id: 'wanderer', productId: 'spirit_pack_wanderer', price: '$2.99',
      icon: '🌿', color: '#6fb594',
      name: "Wanderer's Fate",
      tagline: '50 Premium Rolls — min. True Root',
      desc: 'Roll 50 times with greatly improved odds. Mortal Root removed from pool.',
      rollMode: 'min_true', extraRolls: 50,
      bonusQi: 2000, bonusDao: 0, bonusMoney: 500,
    },
    {
      id: 'seeker', productId: 'spirit_pack_seeker', price: '$4.99',
      icon: '💙', color: '#5aa9e6',
      name: "Heaven Seeker's Pack",
      tagline: 'Guaranteed Heavenly Root ×2.6',
      desc: 'Directly receive a Heavenly Spirit Root with a generous starting gift.',
      guaranteedRoot: 'heaven',
      bonusQi: 5000, bonusDao: 3, bonusMoney: 2000,
    },
    {
      id: 'radiant', productId: 'spirit_pack_radiant', price: '$5.99',
      icon: '⭐', color: '#e0a840',
      name: "Radiant Aspirant",
      tagline: '20 Rolls within Saint/Chaos only',
      desc: 'Every roll guaranteed Saint or Chaos tier. Includes powerful starting bonuses.',
      rollMode: 'min_saint', extraRolls: 20,
      bonusQi: 10000, bonusDao: 5, bonusMoney: 3000, productionBonus: 0.20,
    },
    {
      id: 'saint', productId: 'spirit_pack_saint', price: '$10.99',
      icon: '🌟', color: '#e7c878',
      name: "Saint's Eternal Blessing",
      tagline: 'Guaranteed Saint Root ×4.5 + 300% bonus',
      desc: 'The mark of a sage. Saint Spirit Root guaranteed with maximum starting blessings.',
      guaranteedRoot: 'saint',
      bonusQi: 20000, bonusDao: 10, bonusMoney: 5000, productionBonus: 0.30,
    },
    {
      id: 'chaos', productId: 'spirit_pack_chaos', price: '$19.99',
      icon: '🔥', color: '#c8503f',
      name: 'Chaos Incarnate',
      tagline: 'Chaos Root ×8.0 — the rarest in legend',
      desc: 'A root said to appear once in ten thousand years. Maximum blessings beyond measure.',
      guaranteedRoot: 'chaos',
      bonusQi: 50000, bonusDao: 20, bonusMoney: 10000, productionBonus: 0.50,
    },
  ],

  /* -- Stage Milestone Bonuses -----------------------------------------------
   * Hidden events that fire when stagesCleared hits specific culturally
   * significant numbers. Each fires exactly once and is permanently stored.
   */
  stageMilestones: [
    { at:  3,  icon:'🏛', name:'Three Pillars',      bonus:0.03, dao:0,  desc:'The trinity complete — stability of Heaven, Earth and Man manifests in your Dao.' },
    { at:  7,  icon:'🍀', name:'Seven Celestials',   bonus:0.07, dao:1,  desc:'Seven is the number of celestial harmony. The Heavens acknowledge your path.' },
    { at:  9,  icon:'☯',  name:'Nine Turns',         bonus:0.09, dao:2,  desc:'The nine-turn golden elixir — your cultivation cycle approaches perfection.' },
    { at: 13,  icon:'🌟', name:"Heaven's Chosen",    bonus:0.13, dao:3,  desc:'Thirteen — the number the superstitious avoid. You did not. The Heavens take notice.' },
    { at: 18,  icon:'🥋', name:'Eighteen Arhats',    bonus:0.06, dao:2,  desc:'The eighteen guardian Arhats recognise your perseverance and lend their strength.' },
    { at: 27,  icon:'💎', name:'Three Perfections',  bonus:0.08, dao:3,  desc:'Three times nine: mind, body, and spirit all reach a point of rare equilibrium.' },
    { at: 36,  icon:'📜', name:'Thirty-Six Stratagems', bonus:0.10, dao:4, desc:'The thirty-six stratagems of heaven are now inscribed in your Dao heart.' },
    { at: 49,  icon:'⭐', name:'Great Divination',   bonus:0.14, dao:5,  desc:'Forty-nine: the supreme divination number. Your fate is writ in the stars.' },
    { at: 72,  icon:'🐒', name:'Seventy-Two Arts',   bonus:0.18, dao:7,  desc:'The Great Sage mastered 72 transformations. You have forged 72 paths of your own.' },
    { at: 81,  icon:'🔥', name:'Nine-Nine Return',   bonus:0.20, dao:9,  desc:'Eighty-one tribulations — the complete journey. You have walked every trial.' },
    { at: 99,  icon:'🌙', name:'Near the Veil',      bonus:0.25, dao:12, desc:'Ninety-nine — one step from a hundred, one breath from the immortal veil.' },
    { at: 108, icon:'✨', name:'Stars of Destiny',   bonus:0.30, dao:15, desc:'One hundred and eight — the number of fated stars. Your destiny is no longer hidden.' },
  ],

  /* -- Extra Breakthrough Conditions ----------------------------------------
   * Checked when breaking through a MAJOR realm (Tribulation).
   * Each can fire at most once per breakthrough event.
   */
  breakthroughConditions: [
    {
      id: 'prodigy',
      name: 'Prodigy Breakthrough',
      icon: '🌱',
      color: '#6fb594',
      desc: 'You faced the Tribulation before age 25. Youth\'s fire burns brightest.',
      bonus: 0.10,
      check: (state) => state.life && state.life.age <= 25,
    },
    {
      id: 'hermit',
      name: 'Pure Cultivation',
      icon: '🧘',
      color: '#5aa9e6',
      desc: 'You broke through with no generators — relying on yourself alone. Rare purity.',
      bonus: 0.15,
      check: (state) => GameData.generators.every(g => (state.owned[g.id] || 0) === 0),
    },
    {
      id: 'dao_rich',
      name: 'Dao-Enriched Meridians',
      icon: '☯',
      color: '#e7c878',
      desc: 'High Dao Comprehension at the moment of Tribulation strengthened your core.',
      bonus: 0.08,
      check: (state) => state.daoComprehension >= 10,
    },
    {
      id: 'swift',
      name: 'Lightning Enlightenment',
      icon: '⚡',
      color: '#c8503f',
      desc: 'You broke through in the same run you descended from the last realm — lightning speed.',
      bonus: 0.12,
      check: (state) => state.runQi > 0 && state.realm >= 1 && (state.breakthroughConditions || []).filter(c => c.condId === 'swift').length === 0,
    },
  ],

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
    // -- Meditation (tap power) ------------------------------------------------
    { id: 'tap1',  name: 'Heart Sutra',        icon: '📖', cost: 250,     currency: 'qi',
      desc: 'Doubles Qi gained from meditating.', effect: m => { m.tapMult *= 2; } },
    { id: 'tap2',  name: 'Breathing Art',      icon: '🌬️', cost: 50000,   currency: 'qi',
      desc: 'Triples Qi gained from meditating.', effect: m => { m.tapMult *= 3; } },
    { id: 'tap3',  name: 'Golden Bell Focus',  icon: '🔔', cost: 5e6,     currency: 'qi',
      desc: 'Triples Qi gained from meditating.', effect: m => { m.tapMult *= 3; } },
    { id: 'tap4',  name: 'Thunderclap Palm',   icon: '👊', cost: 2e9,     currency: 'qi',
      desc: 'Quadruples Qi gained from meditating.', effect: m => { m.tapMult *= 4; } },
    { id: 'tap5',  name: 'Primordial Breath',  icon: '🐲', cost: 12, currency: 'dao',
      desc: 'Quintuples Qi gained from meditating.', effect: m => { m.tapMult *= 5; } },

    // -- Production (all generators) ------------------------------------------
    { id: 'all1',  name: 'Spirit Root Awakening', icon: '✨', cost: 10000,  currency: 'qi',
      desc: 'All generators produce 50% more Qi.', effect: m => { m.allMult *= 1.5; } },
    { id: 'all2',  name: 'Dao Heart',          icon: '💗', cost: 2.5e6,   currency: 'qi',
      desc: 'All generators produce double Qi.',  effect: m => { m.allMult *= 2; } },
    { id: 'all3',  name: 'Five Elements Harmony', icon: '🌀', cost: 5e8,   currency: 'qi',
      desc: 'All generators produce double Qi.',  effect: m => { m.allMult *= 2; } },
    { id: 'all4',  name: 'Celestial Meridian Map', icon: '🗺️', cost: 1e12, currency: 'qi',
      desc: 'All generators produce 150% more Qi.', effect: m => { m.allMult *= 2.5; } },
    { id: 'all5',  name: 'Grand Dao Codex',    icon: '📜', cost: 1e15,    currency: 'qi',
      desc: 'All generators produce triple Qi.',  effect: m => { m.allMult *= 3; } },
    { id: 'all6',  name: 'Heaven & Earth Furnace', icon: '⚱️', cost: 25, currency: 'dao',
      desc: 'All generators produce double Qi.',  effect: m => { m.allMult *= 2; } },
    { id: 'all7',  name: 'Primordial Chaos Scripture', icon: '☯', cost: 120, currency: 'dao',
      desc: 'All generators produce triple Qi.',  effect: m => { m.allMult *= 3; } },

    // -- Offline cultivation --------------------------------------------------
    { id: 'offline1', name: 'Dream Cultivation', icon: '🌙', cost: 5,  currency: 'dao',
      desc: 'Offline cultivation efficiency +25%.', effect: m => { m.offlineBonus += 0.25; } },
    { id: 'offline2', name: 'Time Dilation Array', icon: '⏳', cost: 35, currency: 'dao',
      desc: 'Offline cultivation efficiency +25%.', effect: m => { m.offlineBonus += 0.25; } },
    { id: 'offline3', name: 'Stasis Meditation', icon: '🧊', cost: 90, currency: 'dao',
      desc: 'Offline cultivation efficiency +25% (toward 100%).', effect: m => { m.offlineBonus += 0.25; } },
  ],

  /* -- Foundation Quality -------------------------------------------------
   * When breaking through a major realm, the ratio (runQi / realm.reqQi)
   * determines how "clean" the foundation is. Higher = permanent bonus.
   * This mechanic is intentionally undiscovered until the player finds it.
   */
  foundationQualities: [
    { minRatio: 5.0, key: 'perfect',  name: 'Perfect Foundation',  color: '#e7c878',
      bonus: 0.20, desc: 'Flawless meridians forged at the absolute peak — a once-in-a-millennium foundation.' },
    { minRatio: 2.5, key: 'flawless', name: 'Flawless Foundation', color: '#5aa9e6',
      bonus: 0.12, desc: 'Clear and unobstructed — few cultivators achieve this level of purity.' },
    { minRatio: 1.5, key: 'solid',    name: 'Solid Foundation',    color: '#6fb594',
      bonus: 0.06, desc: 'Strong and dependable — the mark of a patient cultivator.' },
    { minRatio: 0,   key: 'cracked',  name: 'Cracked Foundation',  color: '#aab2bd',
      bonus: 0.00, desc: 'Rushed through — minor fractures in your meridians. Consider cultivating longer next time.' },
  ],

  /* -- Generator ownership milestones --------------------------------------
   * Each time a generator's owned count crosses one of these thresholds, that
   * generator's output is multiplied by genMilestoneMult (compounding). This
   * rewards going deep on a generator, not just buying the next tier.
   */
  genMilestones: [10, 25, 50, 100, 150, 200, 300, 400, 500],
  genMilestoneMult: 2,

  /* Synergy: owning many distinct generators at a "mastered" depth grants a
   * compounding global production bonus. */
  synergyThreshold: 25,        // a generator is "mastered" at this many owned
  synergyBonusPer: 0.12,       // +12% global production per mastered generator

  /** Multiplier on a single generator from its ownership milestones. */
  genMilestoneMultiplier(owned) {
    let reached = 0;
    for (const t of this.genMilestones) { if (owned >= t) reached++; else break; }
    return Math.pow(this.genMilestoneMult, reached);
  },
  /** The next milestone threshold above `owned`, or null if maxed. */
  nextGenMilestone(owned) {
    for (const t of this.genMilestones) { if (owned < t) return t; }
    return null;
  },

  /* -- Meridian Tree -------------------------------------------------------
   * Spend Dao Comprehension to open meridian nodes along three paths. Nodes
   * require their predecessor in the same path. Fully refundable (respec).
   *   effect keys: qi, tap, offline, combat, pet, daoGain, crit (all fractions)
   */
  meridianPaths: [
    { key: 'verdant', name: 'Verdant Mind',  icon: '🌿', color: '#16b67a', desc: 'Qi production' },
    { key: 'azure',   name: 'Azure Body',    icon: '🛡', color: '#5aa9e6', desc: 'Combat & endurance' },
    { key: 'radiant', name: 'Radiant Soul',  icon: '✨', color: '#e7b94e', desc: 'Meditation & fortune' },
  ],
  meridians: [
    // Verdant Mind — Qi production
    { id:'vd1', path:'verdant', tier:1, name:'Opening Meridian',  icon:'🌱', cost:3,  effect:{qi:0.10}, requires:null,  desc:'+10% Qi production.' },
    { id:'vd2', path:'verdant', tier:2, name:'Flowing Channels',  icon:'🌿', cost:8,  effect:{qi:0.15}, requires:'vd1', desc:'+15% Qi production.' },
    { id:'vd3', path:'verdant', tier:3, name:'Verdant Core',      icon:'☘️', cost:18, effect:{qi:0.25}, requires:'vd2', desc:'+25% Qi production.' },
    { id:'vd4', path:'verdant', tier:4, name:'Boundless Spring',  icon:'🌳', cost:40, effect:{qi:0.40}, requires:'vd3', desc:'+40% Qi production.' },
    { id:'vd5', path:'verdant', tier:5, name:'World Tree Dao',    icon:'🌲', cost:80, effect:{qi:0.75}, requires:'vd4', desc:'+75% Qi production.' },
    // Azure Body — combat, offline, beasts
    { id:'az1', path:'azure', tier:1, name:'Iron Skin',        icon:'🪨', cost:3,  effect:{combat:0.15}, requires:null,  desc:'+15% combat power.' },
    { id:'az2', path:'azure', tier:2, name:'Tireless Body',    icon:'🌙', cost:8,  effect:{offline:0.25}, requires:'az1', desc:'+25% offline efficiency.' },
    { id:'az3', path:'azure', tier:3, name:'Diamond Sinews',   icon:'💠', cost:18, effect:{combat:0.30}, requires:'az2', desc:'+30% combat power.' },
    { id:'az4', path:'azure', tier:4, name:'Beast Kinship',    icon:'🐾', cost:40, effect:{pet:0.25},    requires:'az3', desc:'+25% spirit-beast bonuses.' },
    { id:'az5', path:'azure', tier:5, name:'Indestructible',   icon:'🛡', cost:80, effect:{combat:0.50, offline:0.15}, requires:'az4', desc:'+50% combat power, +15% offline.' },
    // Radiant Soul — tap, crit, dao
    { id:'rd1', path:'radiant', tier:1, name:'Clear Heart',     icon:'📖', cost:3,  effect:{tap:0.50}, requires:null,  desc:'+50% Qi per meditate tap.' },
    { id:'rd2', path:'radiant', tier:2, name:'Sudden Insight',  icon:'⚡', cost:8,  effect:{crit:0.05}, requires:'rd1', desc:'+5% chance for a meditate tap to crit (×10).' },
    { id:'rd3', path:'radiant', tier:3, name:'Enlightened Palm',icon:'🖐', cost:18, effect:{tap:1.00}, requires:'rd2', desc:'+100% Qi per meditate tap.' },
    { id:'rd4', path:'radiant', tier:4, name:'Dao Resonance',   icon:'☯', cost:40, effect:{daoGain:0.15}, requires:'rd3', desc:'+15% Dao Comprehension gained from Tribulation.' },
    { id:'rd5', path:'radiant', tier:5, name:'Heaven\'s Favour',icon:'🌟', cost:80, effect:{crit:0.10, tap:0.50}, requires:'rd4', desc:'+10% crit chance, +50% tap.' },
  ],
  meridianCritMult: 10,   // a critical meditate tap yields ×10

  /* -- Reincarnation / Heavenly Dao (2nd prestige, Round 3) ----------------
   * Once you reach the peak realm you may reincarnate: a full cultivation
   * reset that grants Heavenly Merit (a meta-currency) + a permanent per-life
   * production bonus. Heavenly Merit buys perks that persist across ALL lives.
   */
  reincarnationRealmReq: 9,      // must reach realm index 9 (Immortal Ascension)
  reincarnationBonusPer: 0.10,   // +10% global production per past life (stacks forever)

  /** Heavenly Merit a reincarnation would grant for the given state.
   * BALANCE: tuned so a first peak reincarnation yields ~270 Merit and grows
   * with past lives. Maxing every Heavenly Perk (~9,500 Merit) then takes a
   * satisfying ~20-30 reincarnations, instead of the old formula which handed
   * out ~60,000 in a single run (enough to buy everything at once). */
  heavenlyMeritFor(state) {
    const fromDao = Math.pow(state.daoComprehension || 0, 0.42) * 0.6;
    const veteran = 1 + (state.reincarnations || 0) * 0.1; // veterans earn more
    return Math.max(10, Math.floor(fromDao * veteran));
  },

  /* Permanent perks bought with Heavenly Merit. Each is leveled.
   * effect keys: qi, daoGain, combat, merit (fractions, summed × level);
   *              startStages / startStones (per-life head-start, × level). */
  heavenlyPerks: [
    { id:'soul_memory',        name:'Soul Memory',        icon:'🧠', baseCost:5,  costGrowth:1.9, maxLevel:10, effect:'qi',         per:0.25, desc:'+25% Qi production.' },
    { id:'heaven_insight',     name:"Heaven's Insight",   icon:'☯', baseCost:12, costGrowth:1.9, maxLevel:8,  effect:'daoGain',     per:0.20, desc:'+20% Dao from Tribulation.' },
    { id:'immortal_body',      name:'Immortal Body',      icon:'🛡', baseCost:10, costGrowth:1.9, maxLevel:8,  effect:'combat',      per:0.30, desc:'+30% combat power.' },
    { id:'eternal_foundation', name:'Eternal Foundation', icon:'🏛', baseCost:10, costGrowth:2.2, maxLevel:5,  effect:'startStages', per:5,    desc:'Begin each new life with +5 stages already cleared.' },
    { id:'karmic_wealth',      name:'Karmic Wealth',      icon:'💰', baseCost:8,  costGrowth:2.0, maxLevel:5,  effect:'startStones', per:1000, desc:'Begin each new life with +1,000 Spirit Stones.' },
    { id:'swift_samsara',      name:'Swift Samsara',      icon:'🌀', baseCost:20, costGrowth:2.5, maxLevel:5,  effect:'merit',       per:0.20, desc:'+20% Heavenly Merit from reincarnation.' },
  ],

  /* -- Daily login rewards (7-day streak cycle) ---------------------------- */
  dailyRewards: [
    { day:1, icon:'☯',  label:'Qi Surge (2h)',        grant:{ qiHours:2 } },
    { day:2, icon:'💠', label:'500 Spirit Stones',     grant:{ stones:500 } },
    { day:3, icon:'💵', label:'¥2,000',                grant:{ money:2000 } },
    { day:4, icon:'🥚', label:'2 Beast Eggs',          grant:{ eggs:2 } },
    { day:5, icon:'☯',  label:'Qi Flood (6h)',         grant:{ qiHours:6 } },
    { day:6, icon:'💠', label:'2,000 Spirit Stones',   grant:{ stones:2000 } },
    { day:7, icon:'🌟', label:'Heavenly Merit ×3 + Qi',grant:{ merit:3, qiHours:12 } },
  ],

  /* -- Pill Alchemy (Round 4) ----------------------------------------------
   * Brew pills from Spirit Stones. 'buff' pills grant a timed multiplier;
   * 'instant' pills fire an immediate effect.
   *   buff keys: qi, combat  (applied multiplicatively while active)
   *   instant:   eggs (gain Beast Eggs) | runqi (advance toward next stage)
   */
  pills: [
    { id:'qi_pill',         name:'Spirit Gathering Pill', icon:'🟢', cost:200,  type:'buff',    buff:'qi',     mult:2, durationSec:600, desc:'2× Qi production for 10 minutes.' },
    { id:'insight_pill',    name:'Enlightenment Pill',    icon:'🔵', cost:600,  type:'buff',    buff:'qi',     mult:3, durationSec:300, desc:'3× Qi production for 5 minutes.' },
    { id:'berserk_pill',    name:'Berserk Pill',          icon:'🔴', cost:300,  type:'buff',    buff:'combat', mult:2, durationSec:600, desc:'2× combat power for 10 minutes — brew before a Secret Realm run!' },
    { id:'fortune_pill',    name:'Fortune Pill',          icon:'🟡', cost:400,  type:'instant', instant:'eggs',  amount:1, desc:'Instantly gain 1 Beast Egg.' },
    { id:'foundation_pill', name:'Foundation Pill',       icon:'🟣', cost:1000, type:'instant', instant:'runqi', frac:0.25, desc:'Instantly add 25% of your next stage requirement as cultivation.' },
  ],

  /* -- Secret Realm (Round 4) ----------------------------------------------
   * A once-daily combat expedition. Your combat rating determines the deepest
   * floor you clear; rewards scale with floors cleared and milestone depths.
   */
  secretRealm: {
    floorBaseReq: 50,    // combat rating required to clear floor 1
    floorGrowth: 1.32,   // requirement multiplier per floor
    stoneBase: 20,       // spirit stones from floor 1 (balance: daily should feel worthwhile)
    stoneGrowth: 1.28,
    eggEvery: 5,         // +1 beast egg every N floors
    meritEvery: 10,      // +1 heavenly merit every N floors (a slow alt Merit source)
  },

  saveVersion: 4,
  saveKey: 'xianxia_idle_save_v1',
};

window.GameData = GameData;
