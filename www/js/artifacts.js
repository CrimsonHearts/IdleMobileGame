/* ===========================================================================
 * artifacts.js — Equipment & loadout (Round 6 depth).
 * Trials / Secret Realm drop artifacts across 4 slots and 5 rarities. Equipping
 * them adds ATK / HP / Qi, and matching SET pieces grant escalating bonuses —
 * turning combat loot into build decisions instead of flat numbers.
 * ========================================================================= */
const Artifacts = {
  data: () => GameData.artifacts,
  s() { return Game.state.artifacts; },

  // -- Generation -----------------------------------------------------------
  _rollRarity() {
    const rs = GameData.artifacts.rarities;
    const total = rs.reduce((s, r) => s + r.weight, 0);
    let n = Math.random() * total;
    for (const r of rs) { if ((n -= r.weight) <= 0) return r; }
    return rs[0];
  },
  /** Roll a fresh artifact. `tier` scales raw stats (zone/floor power). */
  roll(tier) {
    const A = GameData.artifacts;
    const slot = A.slots[Math.floor(Math.random() * A.slots.length)];
    const rar = this._rollRarity();
    const set = A.sets[Math.floor(Math.random() * A.sets.length)];
    const mag = Math.max(1, tier) * rar.statMult;
    const w = A.slotWeights[slot.id];
    const v = (base) => Math.round(base * mag * (0.8 + Math.random() * 0.4));
    return {
      id: 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      slot: slot.id, rarity: rar.id, set: set.id,
      atk: v(w.atk * 10), hp: v(w.hp * 20),
      qi: +(w.qi * mag * 0.01 * (0.8 + Math.random() * 0.4)).toFixed(3), // fraction
    };
  },

  // -- Inventory ------------------------------------------------------------
  add(artifact) {
    const s = this.s();
    s.inventory.push(artifact);
    this._trimToCap();
    return artifact;
  },
  /** Auto-salvage the weakest pieces if the bag is over the cap. */
  _trimToCap() {
    const s = this.s();
    if (s.inventory.length > GameData.artifacts.invCap) {
      s.inventory.sort((a, b) => this.score(b) - this.score(a));
      const dumped = s.inventory.splice(GameData.artifacts.invCap);
      dumped.forEach(a => {
        Game.state.spiritStones += this.salvageValue(a);
        if (window.Enchanting) Enchanting.clearHeirloomArtifact(a.id);
      });
    }
  },
  score(a) { return a.atk + a.hp * 0.5 + a.qi * 5000; },
  salvageValue(a) { return Math.max(1, Math.round(this.score(a) * 0.2)); },
  salvage(id) {
    const s = this.s();
    const i = s.inventory.findIndex(a => a.id === id);
    if (i < 0) return false;
    Game.state.spiritStones += this.salvageValue(s.inventory[i]);
    s.inventory.splice(i, 1);
    if (window.Enchanting) Enchanting.clearHeirloomArtifact(id);
    Game.persist();
    return true;
  },
  equipped() { return this.s().equipped; },
  equippedList() { return Object.values(this.s().equipped).filter(Boolean); },

  equip(id) {
    const s = this.s();
    const i = s.inventory.findIndex(a => a.id === id);
    if (i < 0) return false;
    const art = s.inventory[i];
    const prev = s.equipped[art.slot];
    s.equipped[art.slot] = art;
    s.inventory.splice(i, 1);
    if (prev) s.inventory.push(prev); // swap the old piece back to the bag
    this._trimToCap();
    Game.persist();
    return true;
  },
  unequip(slot) {
    const s = this.s();
    if (!s.equipped[slot]) return false;
    s.inventory.push(s.equipped[slot]);
    s.equipped[slot] = null;
    this._trimToCap();
    Game.persist();
    return true;
  },

  // -- Aggregate bonuses (read by Game/Combat) -----------------------------
  atk()  { return this.equippedList().reduce((t, a) => t + (a.atk || 0), 0); },
  hp()   { return this.equippedList().reduce((t, a) => t + (a.hp || 0), 0); },
  /** Set counts among equipped pieces. */
  setCounts() {
    const c = {};
    this.equippedList().forEach(a => { c[a.set] = (c[a.set] || 0) + 1; });
    return c;
  },
  /** Bonus from completed set tiers (2-piece and 4-piece). */
  setBonus() {
    const out = { combat: 0, qi: 0 };
    const counts = this.setCounts();
    const B = GameData.artifacts.setBonus;
    for (const id in counts) {
      if (counts[id] >= 4) { out.combat += B.four.combat; out.qi += B.four.qi; }
      else if (counts[id] >= 2) { out.combat += B.two.combat; out.qi += B.two.qi; }
    }
    return out;
  },
  combatMult() { return 1 + this.setBonus().combat; },
  qiPct() { return this.equippedList().reduce((t, a) => t + (a.qi || 0), 0) + this.setBonus().qi; },

  // -- Loot drop hook (called by Combat) -----------------------------------
  rollDrop(tier, boss) {
    const base = boss ? GameData.artifacts.bossDropChance : GameData.artifacts.dropChance;
    const chance = base * (window.Spirit ? Spirit.luckMult() : 1) * (window.Boosters ? Boosters.luckMult() : 1);
    if (Math.random() < chance) return this.add(this.roll(tier));
    return null;
  },
};
window.Artifacts = Artifacts;
