/* ===========================================================================
 * fracture.js — Celestial Fracture (Acts I & II).
 *
 * Act I  (Round 13): Stellar Shards resource, Resonance Tree (4 paths ×
 *                    3 tiers), Minor Rift events in zone 5+.
 * Act II (Round 14): Tiered Rifts (Minor / Major / Grand), Path Mastery
 *                    bonuses for completing a full path, Shard Investments —
 *                    one-time permanent boosts purchased with Shards.
 * =========================================================================*/

// ── Resonance nodes ──────────────────────────────────────────────────────────
const FRACTURE_NODES = [
  // Path A — Void Combat
  { id:'fc_a1', path:'a', tier:1, name:'Void Strike',        desc:'+15% Combat ATK',               cost:50,   bonus:{ combat:0.15 } },
  { id:'fc_a2', path:'a', tier:2, name:'Fracture Blade',     desc:'+25% Combat ATK',               cost:250,  bonus:{ combat:0.25 } },
  { id:'fc_a3', path:'a', tier:3, name:'Stellar Collapse',   desc:'+40% Combat ATK',               cost:1000, bonus:{ combat:0.40 } },
  // Path B — Stellar Qi
  { id:'fc_b1', path:'b', tier:1, name:'Resonant Qi',        desc:'+15% Qi production',            cost:50,   bonus:{ qi:0.15 } },
  { id:'fc_b2', path:'b', tier:2, name:'Void Harmony',       desc:'+25% Qi production',            cost:250,  bonus:{ qi:0.25 } },
  { id:'fc_b3', path:'b', tier:3, name:'Celestial Flow',     desc:'+40% Qi production',            cost:1000, bonus:{ qi:0.40 } },
  // Path C — Fracture Harvest
  { id:'fc_c1', path:'c', tier:1, name:'Shard Sense',        desc:'+20% Loot · +25% Shard gain',  cost:50,   bonus:{ loot:0.20, shardGain:0.25 } },
  { id:'fc_c2', path:'c', tier:2, name:'Fracture Harvest',   desc:'+30% Loot · +40% Shard gain',  cost:250,  bonus:{ loot:0.30, shardGain:0.40 } },
  { id:'fc_c3', path:'c', tier:3, name:'Void Reaping',       desc:'+40% Loot · +60% Shard gain',  cost:1000, bonus:{ loot:0.40, shardGain:0.60 } },
  // Path D — Fate Weave
  { id:'fc_d1', path:'d', tier:1, name:'Fate Reading',       desc:'+8% all stats',                 cost:80,   bonus:{ all:0.08 } },
  { id:'fc_d2', path:'d', tier:2, name:'Celestial Weave',    desc:'+14% all stats',                cost:400,  bonus:{ all:0.14 } },
  { id:'fc_d3', path:'d', tier:3, name:'Fracture Singularity',desc:'+22% all stats',               cost:1500, bonus:{ all:0.22 } },
];

const FRACTURE_PATH_LABELS = {
  a: 'Void Combat',
  b: 'Stellar Qi',
  c: 'Fracture Harvest',
  d: 'Fate Weave',
};

// ── Rift Tiers (Act II) ──────────────────────────────────────────────────────
// Sorted highest zone first so find() returns the most specific match.
const RIFT_TIERS = [
  { key:'grand', name:'Grand Rift',  icon:'🌠', minZone:15, prob:0.10, shardMult:3.5 },
  { key:'major', name:'Major Rift',  icon:'💫', minZone:10, prob:0.12, shardMult:2.0 },
  { key:'minor', name:'Minor Rift',  icon:'🌌', minZone:5,  prob:0.15, shardMult:1.0 },
];

// ── Path Mastery (Act II) ────────────────────────────────────────────────────
// Each mastery activates when all 3 tiers of the path are researched.
const FRACTURE_MASTERY = {
  a: { name:'Void Blade Mastery',   desc:'+20% Combat ATK (path mastered)',              bonus:{ combat:0.20 } },
  b: { name:'Stellar Torrent',      desc:'+20% Qi production (path mastered)',           bonus:{ qi:0.20 } },
  c: { name:'Shard Cascade',        desc:'+20% Loot · +30% Shard gain (path mastered)', bonus:{ loot:0.20, shardGain:0.30 } },
  d: { name:'Fracture Convergence', desc:'+15% all stats (path mastered)',               bonus:{ all:0.15 } },
};

// ── Shard Investments (Act II) ───────────────────────────────────────────────
// One-time purchases for permanent global bonuses; ordered by cost.
const SHARD_INVESTMENTS = [
  { id:'si_qi',     name:'Void Crystal Seed',       icon:'🔮', cost:500,  desc:'+8% Qi production (permanent)',         bonus:{ qi:0.08 } },
  { id:'si_combat', name:'Shattered Heaven Shard',  icon:'⚔️', cost:1200, desc:'+12% Combat ATK (permanent)',           bonus:{ combat:0.12 } },
  { id:'si_loot',   name:'Rift Essence Vial',        icon:'💧', cost:2500, desc:'+10% Loot · +15% Shard gain (permanent)', bonus:{ loot:0.10, shardGain:0.15 } },
  { id:'si_all',    name:'Primordial Fracture Core', icon:'🌌', cost:6000, desc:'+12% all stats (permanent)',            bonus:{ all:0.12 } },
];

// =============================================================================
const Fracture = {
  nodes:       FRACTURE_NODES,
  pathLabels:  FRACTURE_PATH_LABELS,
  riftTiers:   RIFT_TIERS,
  mastery:     FRACTURE_MASTERY,
  investments: SHARD_INVESTMENTS,

  _s()         { return Game.state.fracture; },
  _resonance() { return this._s().resonance; },
  _invs()      { if (!this._s().investments) this._s().investments = {}; return this._s().investments; },

  // ── Resonance research ────────────────────────────────────────────────────
  researched(nodeId) { return !!this._resonance()[nodeId]; },

  _prereqMet(node) {
    if (node.tier === 1) return true;
    const prev = FRACTURE_NODES.find(n => n.path === node.path && n.tier === node.tier - 1);
    return prev ? this.researched(prev.id) : false;
  },

  canResearch(nodeId) {
    const node = FRACTURE_NODES.find(n => n.id === nodeId);
    if (!node || this.researched(nodeId)) return false;
    if (!this._prereqMet(node)) return false;
    return (Game.state.stellarShards || 0) >= node.cost;
  },

  research(nodeId) {
    if (!this.canResearch(nodeId)) return false;
    const node = FRACTURE_NODES.find(n => n.id === nodeId);
    Game.state.stellarShards -= node.cost;
    this._resonance()[nodeId] = true;
    Game.persist();
    return true;
  },

  // ── Path Mastery ──────────────────────────────────────────────────────────
  pathMastered(path) {
    return FRACTURE_NODES.filter(n => n.path === path).every(n => this.researched(n.id));
  },

  // ── Shard Investments ─────────────────────────────────────────────────────
  invested(id)   { return !!this._invs()[id]; },

  canInvest(id) {
    const inv = SHARD_INVESTMENTS.find(i => i.id === id);
    if (!inv || this.invested(id)) return false;
    return (Game.state.stellarShards || 0) >= inv.cost;
  },

  invest(id) {
    if (!this.canInvest(id)) return false;
    const inv = SHARD_INVESTMENTS.find(i => i.id === id);
    Game.state.stellarShards -= inv.cost;
    this._invs()[id] = true;
    Game.persist();
    return true;
  },

  // ── Bonus aggregation ─────────────────────────────────────────────────────
  // 'all' keys spread to qi / combat / loot / shardGain but not to other stats.
  _sum(stat) {
    const spreadAll = (stat === 'qi' || stat === 'combat' || stat === 'loot' || stat === 'shardGain');
    let total = 0;
    for (const n of FRACTURE_NODES) {
      if (!this.researched(n.id)) continue;
      if (n.bonus[stat])            total += n.bonus[stat];
      if (spreadAll && n.bonus.all) total += n.bonus.all;
    }
    return total;
  },

  _masterySum(stat) {
    const spreadAll = (stat === 'qi' || stat === 'combat' || stat === 'loot' || stat === 'shardGain');
    let total = 0;
    for (const [path, m] of Object.entries(FRACTURE_MASTERY)) {
      if (!this.pathMastered(path)) continue;
      if (m.bonus[stat])            total += m.bonus[stat];
      if (spreadAll && m.bonus.all) total += m.bonus.all;
    }
    return total;
  },

  _investSum(stat) {
    const spreadAll = (stat === 'qi' || stat === 'combat' || stat === 'loot' || stat === 'shardGain');
    let total = 0;
    for (const inv of SHARD_INVESTMENTS) {
      if (!this.invested(inv.id)) continue;
      if (inv.bonus[stat])            total += inv.bonus[stat];
      if (spreadAll && inv.bonus.all) total += inv.bonus.all;
    }
    return total;
  },

  qiMult()       { return 1 + this._sum('qi')        + this._masterySum('qi')        + this._investSum('qi'); },
  combatMult()   { return 1 + this._sum('combat')    + this._masterySum('combat')    + this._investSum('combat'); },
  lootMult()     { return 1 + this._sum('loot')      + this._masterySum('loot')      + this._investSum('loot'); },
  shardGainMult(){ return 1 + this._sum('shardGain') + this._masterySum('shardGain') + this._investSum('shardGain'); },

  // ── Shard drops (called from combat._loot) ────────────────────────────────
  onMobKill(zone, boss) {
    if (zone < 3) return 0;
    const base = boss ? Math.round(zone * 3) : Math.round(zone * 0.6);
    const shards = Math.max(1, Math.round(base * this.shardGainMult()));
    Game.state.stellarShards = (Game.state.stellarShards || 0) + shards;
    return shards;
  },

  // ── Rift events (called from combat.advanceWaveOrZone after boss clear) ───
  // Returns shard count awarded (0 if no rift triggered).
  // Also stores the triggered tier key in state for the combat log.
  _riftTierForZone(zone) {
    return RIFT_TIERS.find(t => zone >= t.minZone) || null;
  },

  tryRiftEvent(zone) {
    if (zone < 5) return 0;
    const tier = this._riftTierForZone(zone);
    if (!tier || Math.random() > tier.prob) return 0;
    const shards = Math.max(5, Math.round(zone * 5 * tier.shardMult * this.shardGainMult()));
    Game.state.stellarShards = (Game.state.stellarShards || 0) + shards;
    const s = this._s();
    s.riftsSealed     = (s.riftsSealed     || 0) + 1;
    if (tier.key === 'major') s.majorRiftsSealed = (s.majorRiftsSealed || 0) + 1;
    if (tier.key === 'grand') s.grandRiftsSealed = (s.grandRiftsSealed || 0) + 1;
    s.lastRiftTierKey = tier.key;
    Game.persist();
    return shards;
  },

  riftsSealed()      { return this._s().riftsSealed      || 0; },
  majorRiftsSealed() { return this._s().majorRiftsSealed || 0; },
  grandRiftsSealed() { return this._s().grandRiftsSealed || 0; },

  lastRiftIcon() {
    const t = RIFT_TIERS.find(t => t.key === (this._s().lastRiftTierKey || 'minor'));
    return t ? t.icon : '🌌';
  },
  lastRiftName() {
    const t = RIFT_TIERS.find(t => t.key === (this._s().lastRiftTierKey || 'minor'));
    return t ? t.name : 'Celestial Rift';
  },
};

window.Fracture = Fracture;
