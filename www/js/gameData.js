/* ===========================================================================
 * gameData.js — All game balance & theme content in one place.
 * Theme: Chinese cultivation (xianxia / 修仙). Edit values here to re-balance
 * without touching game logic.
 * ========================================================================= */

const GameData = {
  // -- Meta -----------------------------------------------------------------
  theme: {
    title: '仙途 · Path to Immortality',
    currencyName: 'Qi',
    currencyNameCN: '气',
    currencyIcon: '☯',
    tapVerb: 'Meditate',
    tapVerbCN: '打坐',
    prestigeCurrencyName: 'Dao Comprehension',
    prestigeCurrencyNameCN: '道韵',
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
    { id: 'mat',     name: 'Meditation Cushion', nameCN: '蒲团',   icon: '🧘', baseCost: 15,           costGrowth: 1.15, baseProd: 0.1,
      desc: 'A humble cushion where a mortal first senses the spiritual energy of the world.' },
    { id: 'herb',    name: 'Spirit Herb Field',  nameCN: '灵草田', icon: '🌿', baseCost: 100,          costGrowth: 1.15, baseProd: 1,
      desc: 'Rows of glowing spirit herbs that exhale faint Qi into the dawn mist.' },
    { id: 'stone',   name: 'Spirit Stone Vein',  nameCN: '灵石脉', icon: '💎', baseCost: 1100,         costGrowth: 1.15, baseProd: 8,
      desc: 'A vein of crystallized Qi running deep beneath the mountain.' },
    { id: 'furnace', name: 'Alchemy Furnace',    nameCN: '丹炉',   icon: '⚗️', baseCost: 12000,        costGrowth: 1.15, baseProd: 47,
      desc: 'An ancient cauldron refining herbs into Qi-rich pills.' },
    { id: 'library', name: 'Scripture Pavilion', nameCN: '藏经阁', icon: '📜', baseCost: 130000,       costGrowth: 1.15, baseProd: 260,
      desc: 'Shelves of forbidden manuals whispering the secrets of the Dao.' },
    { id: 'sword',   name: 'Sword Pavilion',     nameCN: '剑阁',   icon: '🗡️', baseCost: 1400000,      costGrowth: 1.15, baseProd: 1400,
      desc: 'Disciples temper flying swords, their sword-intent humming with Qi.' },
    { id: 'array',   name: 'Qi-Gathering Array',  nameCN: '聚灵阵', icon: '🏯', baseCost: 20000000,     costGrowth: 1.15, baseProd: 7800,
      desc: 'A grand formation that pulls spiritual energy from the heavens.' },
    { id: 'dragon',  name: 'Dragon Ley Line',    nameCN: '龙脉',   icon: '🐉', baseCost: 330000000,    costGrowth: 1.15, baseProd: 44000,
      desc: 'A slumbering earth-dragon whose breath floods the land with Qi.' },
    { id: 'star',    name: 'Star-Plucking Altar', nameCN: '摘星台', icon: '🌌', baseCost: 5100000000,  costGrowth: 1.15, baseProd: 260000,
      desc: 'An altar that draws upon the light of distant stars.' },
    { id: 'heaven',  name: 'Heavenly Dao Lotus', nameCN: '天道莲', icon: '🪷', baseCost: 75000000000, costGrowth: 1.15, baseProd: 1600000,
      desc: 'A lotus blooming at the edge of the Heavenly Dao itself.' },
  ],

  /* -- Cultivation Realms (the prestige ladder) ----------------------------
   * To "Break Through" to the next realm you must reach reqQi LIFETIME Qi in
   * the current life. Breaking through resets Qi & generators but grants
   * Dao Comprehension (permanent global multiplier).
   */
  realms: (() => {
    // Stage-name sets reused across realms.
    const NINE = ['1st Layer','2nd Layer','3rd Layer','4th Layer','5th Layer','6th Layer','7th Layer','8th Layer','9th Layer'];
    const NINE_CN = ['一层','二层','三层','四层','五层','六层','七层','八层','九层'];
    const QUAD = ['Early Stage','Middle Stage','Late Stage','Great Perfection'];
    const QUAD_CN = ['初期','中期','后期','大圆满'];
    return [
      { name: 'Mortal',                   nameCN: '凡人',     reqQi: 0,    stages: ['Mortal Body','Qi Sensing'], stagesCN: ['凡体','感气'] },
      { name: 'Qi Condensation',          nameCN: '炼气期',   reqQi: 1e3,  stages: NINE, stagesCN: NINE_CN },
      { name: 'Foundation Establishment', nameCN: '筑基期',   reqQi: 1e5,  stages: QUAD, stagesCN: QUAD_CN },
      { name: 'Core Formation',           nameCN: '金丹期',   reqQi: 1e7,  stages: QUAD, stagesCN: QUAD_CN },
      { name: 'Nascent Soul',             nameCN: '元婴期',   reqQi: 1e9,  stages: QUAD, stagesCN: QUAD_CN },
      { name: 'Soul Formation',           nameCN: '化神期',   reqQi: 1e11, stages: QUAD, stagesCN: QUAD_CN },
      { name: 'Void Refinement',          nameCN: '炼虚期',   reqQi: 1e13, stages: QUAD, stagesCN: QUAD_CN },
      { name: 'Body Integration',         nameCN: '合体期',   reqQi: 1e15, stages: QUAD, stagesCN: QUAD_CN },
      { name: 'Great Ascension',          nameCN: '大乘期',   reqQi: 1e17, stages: QUAD, stagesCN: QUAD_CN },
      { name: 'Immortal Ascension',       nameCN: '渡劫飞升', reqQi: 1e19, stages: ['Tribulation','Half-Immortal','True Immortal','Golden Immortal'], stagesCN: ['渡劫','半仙','真仙','金仙'] },
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
    male:   { key: 'male',   label: 'Male',   labelCN: '男', emblem: 'assets/cultivator.svg',        honorific: 'Daoist',  honorificCN: '道友' },
    female: { key: 'female', label: 'Female', labelCN: '女', emblem: 'assets/cultivator-female.svg', honorific: 'Fairy',   honorificCN: '仙子' },
  },

  /* Spiritual Root (灵根): your birth talent — a permanent global multiplier.
   * Rolled (weighted) at character creation; the player may re-divine freely.
   */
  spiritualRoots: [
    { key: 'mortal', name: 'Mortal Spirit Root',   nameCN: '凡灵根',   mult: 1.0, weight: 50, color: '#9c9488', desc: 'Common roots. The road is long, but diligence overcomes talent.' },
    { key: 'true',   name: 'True Spirit Root',      nameCN: '真灵根',   mult: 1.6, weight: 28, color: '#6fb594', desc: 'Pure single-element roots — a solid foundation for cultivation.' },
    { key: 'heaven', name: 'Heavenly Spirit Root',  nameCN: '天灵根',   mult: 2.6, weight: 14, color: '#5aa9e6', desc: 'A rare gift of the heavens; Qi flows to you with ease.' },
    { key: 'saint',  name: 'Saint Spirit Root',     nameCN: '圣灵根',   mult: 4.5, weight: 6,  color: '#e7c878', desc: 'The mark of a born sage — destined for greatness.' },
    { key: 'chaos',  name: 'Chaos Spirit Root',     nameCN: '混沌灵根', mult: 8.0, weight: 2,  color: '#c8503f', desc: 'A legendary root said to appear once in ten thousand years.' },
  ],

  rollSpiritualRoot() {
    const total = this.spiritualRoots.reduce((s, r) => s + r.weight, 0);
    let n = Math.random() * total;
    for (const r of this.spiritualRoots) { if ((n -= r.weight) <= 0) return r; }
    return this.spiritualRoots[0];
  },

  // +5% permanent global production per minor stage ever cleared (Cultivation Base 修为).
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
    { id: 'tap1',  name: 'Heart Sutra',       nameCN: '心法',   icon: '📖', cost: 250,    currency: 'qi',
      desc: 'Doubles Qi gained from meditating.', effect: m => { m.tapMult *= 2; } },
    { id: 'tap2',  name: 'Breathing Art',     nameCN: '吐纳术', icon: '🌬️', cost: 50000,  currency: 'qi',
      desc: 'Triples Qi gained from meditating.', effect: m => { m.tapMult *= 3; } },
    { id: 'all1',  name: 'Spirit Root Awakening', nameCN: '灵根觉醒', icon: '✨', cost: 10000, currency: 'qi',
      desc: 'All generators produce 50% more Qi.', effect: m => { m.allMult *= 1.5; } },
    { id: 'all2',  name: 'Dao Heart',         nameCN: '道心',   icon: '💗', cost: 2500000, currency: 'qi',
      desc: 'All generators produce double Qi.',  effect: m => { m.allMult *= 2; } },
    { id: 'offline1', name: 'Dream Cultivation', nameCN: '梦中修炼', icon: '🌙', cost: 5, currency: 'dao',
      desc: 'Offline cultivation efficiency +25% (cap raised to 75%).', effect: m => { m.offlineBonus += 0.25; } },
  ],

  saveVersion: 1,
  saveKey: 'xianxia_idle_save_v1',
};

window.GameData = GameData;
