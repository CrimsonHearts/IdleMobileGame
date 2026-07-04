/* ===========================================================================
 * sectguild.js — Round 12: Sect Guild System.
 * Expands the basic Sect membership into a deep progression layer.
 *
 * Research Tree  — spend Contribution to unlock permanent passive bonuses
 *                  (Qi, Combat, Pet, Loot, Offline, Boss Dmg, Stone drops).
 *                  Each sect has 2 branches × 3 tiers; tiers are sequential.
 * Contribution Store — buy items (eggs, stones, pills, artifacts) with Contribution.
 * Offerings      — donate Spirit Stones or Blood Essence for Contribution.
 * ========================================================================= */

const SECT_RESEARCH = {
  sword: [
    // Branch A — Combat Mastery
    { id:'sw_a1', branch:'a', tier:1, name:'Sword Will',        desc:'+12% Combat ATK',               cost:600,   bonus:{ combat:0.12 } },
    { id:'sw_a2', branch:'a', tier:2, name:'Flying Sword Dao',  desc:'+20% Combat ATK',               cost:8000,  bonus:{ combat:0.20 } },
    { id:'sw_a3', branch:'a', tier:3, name:'Sword Domain',      desc:'+30% Combat ATK',               cost:80000, bonus:{ combat:0.30 } },
    // Branch B — Sword Qi
    { id:'sw_b1', branch:'b', tier:1, name:'Sword Qi Tempering',desc:'+10% Qi production',            cost:400,   bonus:{ qi:0.10 } },
    { id:'sw_b2', branch:'b', tier:2, name:'Heart of the Sword',desc:'+16% Qi production',            cost:5000,  bonus:{ qi:0.16 } },
    { id:'sw_b3', branch:'b', tier:3, name:'Immortal Sword Qi', desc:'+25% Qi · +15% Boss Damage',    cost:50000, bonus:{ qi:0.25, bossDmg:0.15 } },
  ],
  pill: [
    { id:'pi_a1', branch:'a', tier:1, name:'Purifying Flame',   desc:'+12% Qi production',            cost:600,   bonus:{ qi:0.12 } },
    { id:'pi_a2', branch:'a', tier:2, name:'Golden Core Pill',  desc:'+20% Qi production',            cost:8000,  bonus:{ qi:0.20 } },
    { id:'pi_a3', branch:'a', tier:3, name:'Immortal Elixir',   desc:'+30% Qi production',            cost:80000, bonus:{ qi:0.30 } },
    { id:'pi_b1', branch:'b', tier:1, name:'Night Watch',       desc:'+18% Offline efficiency',       cost:400,   bonus:{ offline:0.18 } },
    { id:'pi_b2', branch:'b', tier:2, name:'Dreamless Slumber', desc:'+28% Offline efficiency',       cost:5000,  bonus:{ offline:0.28 } },
    { id:'pi_b3', branch:'b', tier:3, name:'Eternal Vigil',     desc:'+40% Offline · +10% Qi',        cost:50000, bonus:{ offline:0.40, qi:0.10 } },
  ],
  beast: [
    { id:'be_a1', branch:'a', tier:1, name:'Beast Affinity',    desc:'+15% Spirit Beast bonuses',     cost:600,   bonus:{ pet:0.15 } },
    { id:'be_a2', branch:'a', tier:2, name:'Soul Bond',         desc:'+25% Spirit Beast bonuses',     cost:8000,  bonus:{ pet:0.25 } },
    { id:'be_a3', branch:'a', tier:3, name:'Ancient Pact',      desc:'+40% Spirit Beast bonuses',     cost:80000, bonus:{ pet:0.40 } },
    { id:'be_b1', branch:'b', tier:1, name:"Hunter's Instinct", desc:'+12% Loot from Trials',         cost:400,   bonus:{ loot:0.12 } },
    { id:'be_b2', branch:'b', tier:2, name:'Predator Path',     desc:'+22% Loot from Trials',         cost:5000,  bonus:{ loot:0.22 } },
    { id:'be_b3', branch:'b', tier:3, name:'King of Beasts',    desc:'+35% Loot · +15% Pet',          cost:50000, bonus:{ loot:0.35, pet:0.15 } },
  ],
  talisman: [
    { id:'ta_a1', branch:'a', tier:1, name:'Basic Inscription', desc:'+12% Qi production',            cost:600,   bonus:{ qi:0.12 } },
    { id:'ta_a2', branch:'a', tier:2, name:'Spirit Script',     desc:'+20% Qi production',            cost:8000,  bonus:{ qi:0.20 } },
    { id:'ta_a3', branch:'a', tier:3, name:'Heaven Decree',     desc:'+30% Qi production',            cost:80000, bonus:{ qi:0.30 } },
    { id:'ta_b1', branch:'b', tier:1, name:'Warding Seal',      desc:'+8% all stats',                 cost:400,   bonus:{ all:0.08 } },
    { id:'ta_b2', branch:'b', tier:2, name:'Grand Seal',        desc:'+12% all stats',                cost:5000,  bonus:{ all:0.12 } },
    { id:'ta_b3', branch:'b', tier:3, name:'Void Inscription',  desc:'+18% all stats · +15% Offline', cost:50000, bonus:{ all:0.18, offline:0.15 } },
  ],
  demon: [
    { id:'de_a1', branch:'a', tier:1, name:'Slaughter Intent',  desc:'+18% Combat ATK',               cost:600,   bonus:{ combat:0.18 } },
    { id:'de_a2', branch:'a', tier:2, name:'Demon Path',        desc:'+28% Combat ATK',               cost:8000,  bonus:{ combat:0.28 } },
    { id:'de_a3', branch:'a', tier:3, name:'Blood Massacre',    desc:'+40% Combat ATK',               cost:80000, bonus:{ combat:0.40 } },
    { id:'de_b1', branch:'b', tier:1, name:'Blood Nourishment', desc:'+20% Spirit Stone drops',       cost:400,   bonus:{ stones:0.20 } },
    { id:'de_b2', branch:'b', tier:2, name:'Crimson Harvest',   desc:'+30% Spirit Stone drops',       cost:5000,  bonus:{ stones:0.30 } },
    { id:'de_b3', branch:'b', tier:3, name:'Demonic Reaping',   desc:'+40% Stones · +15% ATK',        cost:50000, bonus:{ stones:0.40, combat:0.15 } },
  ],
};

const SECT_STORE_ITEMS = [
  { id:'egg',       icon:'🥚', name:'Beast Egg',        desc:'Tame a Spirit Beast',                         cost:500,  apply(s){ s.beastEggs += 1; } },
  { id:'stones_sm', icon:'💠', name:'1,000 Stones',     desc:'Small Spirit Stone pack',                     cost:200,  apply(s){ s.spiritStones += 1000; } },
  { id:'stones_lg', icon:'💎', name:'5,000 Stones',     desc:'Large Spirit Stone pack',                     cost:800,  apply(s){ s.spiritStones += 5000; } },
  { id:'pill_qi',   icon:'💊', name:'Sect Qi Pill',      desc:'2× Qi production for 30 minutes',             cost:1500, apply(s){ if (!s.buffs) s.buffs=[]; s.buffs.push({ buff:'qi', mult:2, endsAt: TimeService.now() + 30*60*1000 }); } },
  { id:'artifact',  icon:'⚜️', name:'Mystery Artifact', desc:'Random artifact roll (realm+1 tier)',          cost:5000, apply(s){ if (window.Artifacts) Artifacts.add(Artifacts.roll((s.realm||0)+1)); } },
];

const OFFERING_TYPES = [
  { id:'stones', icon:'💠', name:'Spirit Stones', cost:1000, gain:80 },
  { id:'blood',  icon:'🩸', name:'Blood Essence', cost:50,   gain:80 },
];

const SectGuild = {
  data:      SECT_RESEARCH,
  store:     SECT_STORE_ITEMS,
  offerings: OFFERING_TYPES,

  _s()       { return Game.state.sectGuild; },
  _research(){ return this._s().research; },

  nodesFor(sectId)  { return SECT_RESEARCH[sectId] || []; },
  researched(nodeId){ return !!this._research()[nodeId]; },

  _prereqMet(sectId, node) {
    if (node.tier === 1) return true;
    const prev = this.nodesFor(sectId).find(n => n.branch === node.branch && n.tier === node.tier - 1);
    return prev ? this.researched(prev.id) : false;
  },

  canResearch(nodeId) {
    const sectId = Game.state.sect && Game.state.sect.id;
    if (!sectId) return false;
    const node = this.nodesFor(sectId).find(n => n.id === nodeId);
    if (!node || this.researched(nodeId)) return false;
    if (!this._prereqMet(sectId, node)) return false;
    return Sect.contribution() >= node.cost;
  },

  research(nodeId) {
    if (!this.canResearch(nodeId)) return false;
    const sectId = Game.state.sect.id;
    const node   = this.nodesFor(sectId).find(n => n.id === nodeId);
    Game.state.sect.contribution -= node.cost;
    this._research()[nodeId] = true;
    Game.persist();
    return true;
  },

  // Aggregate bonus for a named stat across all researched nodes of the
  // current sect. 'all' bonus keys count toward all primary stats (qi, combat,
  // pet, loot) but not toward offline or bossDmg.
  _sum(stat) {
    const sectId = Game.state.sect && Game.state.sect.id;
    if (!sectId) return 0;
    const spreadAll = (stat === 'qi' || stat === 'combat' || stat === 'pet' || stat === 'loot' || stat === 'stones');
    let total = 0;
    for (const n of this.nodesFor(sectId)) {
      if (!this.researched(n.id)) continue;
      if (n.bonus[stat])              total += n.bonus[stat];
      if (spreadAll && n.bonus.all)   total += n.bonus.all;
    }
    return total;
  },

  qiMult()     { return 1 + this._sum('qi'); },
  combatMult() { return 1 + this._sum('combat'); },
  petMult()    { return 1 + this._sum('pet'); },
  lootMult()   { return 1 + this._sum('loot'); },
  offlineBonus(){ return this._sum('offline'); },
  stonesMult() { return 1 + this._sum('stones'); },
  bossDmgMult(){ return 1 + this._sum('bossDmg'); },

  // -- Contribution Store ---------------------------------------------------
  canBuy(itemId) {
    if (!Game.state.sect) return false;
    const item = SECT_STORE_ITEMS.find(i => i.id === itemId);
    return !!(item && Sect.contribution() >= item.cost);
  },

  buy(itemId) {
    if (!this.canBuy(itemId)) return false;
    const item = SECT_STORE_ITEMS.find(i => i.id === itemId);
    Game.state.sect.contribution -= item.cost;
    item.apply(Game.state);
    Game.persist();
    return true;
  },

  // -- Offerings ------------------------------------------------------------
  canOffer(typeId) {
    if (!Game.state.sect) return false;
    const t = OFFERING_TYPES.find(o => o.id === typeId);
    if (!t) return false;
    if (t.id === 'stones') return Game.state.spiritStones >= t.cost;
    if (t.id === 'blood')  return !!(Game.state.blood && Game.state.blood.essence >= t.cost);
    return false;
  },

  offer(typeId) {
    if (!this.canOffer(typeId)) return false;
    const t = OFFERING_TYPES.find(o => o.id === typeId);
    if (t.id === 'stones') Game.state.spiritStones    -= t.cost;
    if (t.id === 'blood')  Game.state.blood.essence   -= t.cost;
    Sect.addContribution(t.gain);
    Game.persist();
    return t.gain;
  },
};

window.SectGuild = SectGuild;
