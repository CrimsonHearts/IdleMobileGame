/* ===========================================================================
 * fracture.js — Round 13: Celestial Fracture Act I.
 *
 * The heavens themselves have cracked. Chaotic Void energy bleeds through
 * Celestial Rifts that open mid-battle. Cultivators who endure the chaos
 * absorb Stellar Shards — fragments of shattered Heaven — and spend them
 * on Fracture Resonance: four permanent upgrade paths that grow only as
 * you push deeper into the Rift-infested Trials.
 *
 * ── Systems ──────────────────────────────────────────────────────────────
 * Stellar Shards  — drops from zone 3+ combat; bosses drop more; Rift
 *                   events yield a windfall. Displayed in the resource bar.
 * Rift Events     — 15% chance on every boss clear in zone 5+. Sealing a
 *                   Rift logs the event, awards bonus Shards, and advances
 *                   the Act I quest counter.
 * Resonance Tree  — 4 paths × 3 tiers (12 nodes). Tiers unlock in order.
 *                   Bonuses: Void Combat (ATK), Stellar Qi (Qi), Fracture
 *                   Harvest (Loot + Shard gain), Fate Weave (all stats).
 * ========================================================================= */

// ── Resonance nodes ───────────────────────────────────────────────────────
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

const Fracture = {
  nodes:      FRACTURE_NODES,
  pathLabels: FRACTURE_PATH_LABELS,

  _s()        { return Game.state.fracture; },
  _resonance(){ return this._s().resonance; },

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

  // Aggregate bonus for a stat across all researched nodes.
  // 'all' bonus keys spread to qi, combat, loot, and shardGain.
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

  qiMult()      { return 1 + this._sum('qi'); },
  combatMult()  { return 1 + this._sum('combat'); },
  lootMult()    { return 1 + this._sum('loot'); },
  shardGainMult(){ return 1 + this._sum('shardGain'); },

  // -- Shard drops (called from combat._loot) --------------------------------
  // Returns shards awarded (also adds them to state).
  onMobKill(zone, boss) {
    if (zone < 3) return 0;
    const base = boss ? Math.round(zone * 3) : Math.round(zone * 0.6);
    const shards = Math.max(1, Math.round(base * this.shardGainMult()));
    Game.state.stellarShards = (Game.state.stellarShards || 0) + shards;
    return shards;
  },

  // -- Rift events (called from combat.advanceWaveOrZone after boss clear) ---
  // Returns shards from this rift (0 if no rift triggered).
  tryRiftEvent(zone) {
    if (zone < 5) return 0;
    if (Math.random() > 0.15) return 0;
    const shards = Math.max(5, Math.round(zone * 5 * this.shardGainMult()));
    Game.state.stellarShards = (Game.state.stellarShards || 0) + shards;
    this._s().riftsSealed = (this._s().riftsSealed || 0) + 1;
    Game.persist();
    return shards;
  },

  riftsSealed() { return this._s().riftsSealed || 0; },
};

window.Fracture = Fracture;
