/* ===========================================================================
 * sect.js — Sects. Join one of the great cultivation orders for a
 * permanent bonus, earn Contribution, and rise through the ranks.
 *
 * ── Online architecture ──────────────────────────────────────────────────
 * Cross-player sects (real users joining the same sect) require a backend.
 * All data access goes through SectBackend so the UI/logic never change:
 *   • LocalBackend  — ships now, runs offline, uses preset sects + NPC rosters.
 *   • CloudBackend  — stub for Firebase/Supabase; fill in keys to enable real
 *     player-created sects, membership, and leaderboards. See docs/SECT-ONLINE.md.
 * ========================================================================= */

const SECTS_DATA = [
  { id: 'sword',   name: 'Azure Cloud Sword Sect', seal: 'S', color: '#6fb594', align: 'orthodox',
    desc: 'Disciples temper flying swords and sword-intent. Masters of combat.',
    bonusDesc: '+30% combat power, +10% Qi production',
    qiMult: 1.10, combatMult: 1.30, petMult: 1.0, offlineBonus: 0 },
  { id: 'pill',    name: 'Cinnabar Pill Sect',     seal: 'P', color: '#e7c878', align: 'orthodox',
    desc: 'Alchemists who refine Qi into pills. Renowned for steady cultivation.',
    bonusDesc: '+15% Qi production, +25% offline efficiency',
    qiMult: 1.15, combatMult: 1.0, petMult: 1.0, offlineBonus: 0.25 },
  { id: 'beast',   name: 'Myriad Beast Sect',      seal: 'B', color: '#5aa9e6', align: 'neutral',
    desc: 'Beast-tamers who bond with spirit beasts. Their companions are peerless.',
    bonusDesc: '+35% spirit-beast bonuses, +15% combat power',
    qiMult: 1.0, combatMult: 1.15, petMult: 1.35, offlineBonus: 0 },
  { id: 'talisman',name: 'Grand Void Talisman Sect', seal: 'T', color: '#b48ee0', align: 'orthodox',
    desc: 'Scholars who inscribe the Dao onto talismans. Balanced and wise.',
    bonusDesc: '+25% Qi production',
    qiMult: 1.25, combatMult: 1.0, petMult: 1.0, offlineBonus: 0 },
  { id: 'demon',   name: 'Blood Demon Sect',       seal: 'D', color: '#c8503f', align: 'demonic',
    desc: 'A heterodox path of slaughter. Immense power at a price.',
    bonusDesc: '+50% combat power, +30% Spirit Stone drops, −10% Qi production',
    qiMult: 0.90, combatMult: 1.50, petMult: 1.0, offlineBonus: 0, lootMult: 1.30 },
];

// Contribution thresholds → rank.
const SECT_RANKS = [
  { name: 'Outer Disciple', req: 0 },
  { name: 'Inner Disciple', req: 1e3 },
  { name: 'Core Disciple',  req: 1e4 },
  { name: 'True Disciple',  req: 1e5 },
  { name: 'Elder',          req: 1e6 },
  { name: 'Sect Master',    req: 1e7 },
];

const SECT_RANK_BONUS = 0.03; // +3% global Qi per rank index

/* ── Backend abstraction ──────────────────────────────────────────────── */
const LocalBackend = {
  online: false,
  async listSects() { return SECTS_DATA; },
  // NPC member rosters for flavour (replaced by real members when online).
  async members(sectId) {
    const surnames = ['Li','Wang','Zhang','Han','Mu','Bai','Ye','Su','Lin','Chu','Yun','Xiao'];
    const givens   = ['Tian','Yu','Chen','Feng','Xue','Qing','Hong','Lan','Jian','Mo','Xing','Yao'];
    const titles   = SECT_RANKS.slice().reverse();
    const rng = (n) => Math.floor(Math.random() * n);
    const list = [];
    for (let i = 0; i < 8; i++) {
      list.push({
        name: surnames[rng(surnames.length)] + ' ' + givens[rng(givens.length)],
        rank: titles[Math.min(i, titles.length - 1)],
        realm: GameData.realms[Math.max(1, 9 - i)] || GameData.realms[1],
        npc: true,
      });
    }
    return list;
  },
  async join(sectId) { return { ok: true }; },
  async leave() { return { ok: true }; },
};

// Cloud stub — see docs/SECT-ONLINE.md. Activates when configured.
const CloudBackend = {
  online: true,
  _cfg: null,
  configure(cfg) { this._cfg = cfg; }, // { provider, projectUrl, apiKey, ... }
  async listSects() { /* fetch from backend */ return SECTS_DATA; },
  async members(sectId) { /* fetch real members */ return []; },
  async join(sectId) { /* write membership */ return { ok: true }; },
  async leave() { return { ok: true }; },
  async createSect(def) { /* player-founded sect */ return { ok: true, id: def.id }; },
  async leaderboard() { return []; },
};

const Sect = {
  data: SECTS_DATA,
  ranks: SECT_RANKS,
  backend: LocalBackend,        // swap to CloudBackend once configured

  /** Enable real online sects. Called from main.js if config is present. */
  goOnline(cfg) { CloudBackend.configure(cfg); this.backend = CloudBackend; },
  isOnline() { return !!this.backend.online; },

  current() { const id = Game.state.sect && Game.state.sect.id; return id ? SECTS_DATA.find(s => s.id === id) : null; },
  contribution() { return Game.state.sect ? Game.state.sect.contribution : 0; },

  rankIndex() {
    const c = this.contribution();
    let idx = 0;
    SECT_RANKS.forEach((r, i) => { if (c >= r.req) idx = i; });
    return idx;
  },
  rank() { return SECT_RANKS[this.rankIndex()]; },
  nextRank() { return SECT_RANKS[this.rankIndex() + 1] || null; },

  // -- Bonuses (read by Game.multipliers / Combat) -------------------------
  // Round 12: SectGuild research bonuses are folded in here so every
  // consumer (combat, pets, offline, etc.) picks them up automatically.
  qiMult() {
    const s = this.current();
    if (!s) return 1;
    const research = window.SectGuild ? SectGuild.qiMult() : 1;
    return s.qiMult * (1 + this.rankIndex() * SECT_RANK_BONUS) * research;
  },
  combatMult()  {
    const s = this.current();
    const research = window.SectGuild ? SectGuild.combatMult() : 1;
    return s ? s.combatMult * research : 1;
  },
  petBonusMult(){
    const s = this.current();
    const research = window.SectGuild ? SectGuild.petMult() : 1;
    return s ? (s.petMult || 1) * research : 1;
  },
  offlineBonus(){
    const s = this.current();
    const research = window.SectGuild ? SectGuild.offlineBonus() : 0;
    return (s ? (s.offlineBonus || 0) : 0) + research;
  },
  lootMult()    {
    const s = this.current();
    const research = window.SectGuild ? SectGuild.lootMult() : 1;
    return s ? (s.lootMult || 1) * research : 1;
  },

  // -- Membership ----------------------------------------------------------
  /** Karma gate: orthodox sects reject the demonic; the Blood Demon Sect
   *  rejects the righteous. Returns { ok, reason }. */
  joinRequirement(sectId) {
    const s = SECTS_DATA.find(x => x.id === sectId);
    if (!s) return { ok: false, reason: 'Unknown sect.' };
    const tier = (window.Game && Game.karmaTier) ? Game.karmaTier() : 'neutral';
    if (s.align === 'orthodox' && tier === 'demonic')
      return { ok: false, reason: 'Orthodox sects will not accept one walking the Demonic path. Redeem your karma first.' };
    if (s.align === 'demonic' && tier === 'righteous')
      return { ok: false, reason: 'The Blood Demon Sect scorns the righteous. Your karma is too pure.' };
    return { ok: true };
  },
  canJoin(sectId) { return this.joinRequirement(sectId).ok; },

  async join(sectId) {
    if (Game.state.sect && Game.state.sect.id === sectId) return { ok: true };
    if (!this.canJoin(sectId)) return { ok: false };
    await this.backend.join(sectId);
    // Switching sects forfeits contribution (defection penalty).
    Game.state.sect = { id: sectId, contribution: 0, joinedAt: TimeService.now() };
    Game.persist();
    return { ok: true };
  },
  async leave() {
    await this.backend.leave();
    Game.state.sect = null;
    Game.persist();
  },

  /** Passive contribution gain, called from the game tick. */
  addContribution(amount) {
    if (Game.state.sect && amount > 0) Game.state.sect.contribution += amount;
  },
};

window.Sect = Sect;
window.SectBackends = { LocalBackend, CloudBackend };
