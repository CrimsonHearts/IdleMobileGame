/* ===========================================================================
 * achievements.js — Cultivation Milestones (Round 11).
 * 32 achievements across 6 categories. Checking is periodic (every 5 s in
 * Game.tick). Claiming delivers Spirit Stone / Beast Egg rewards.
 * ========================================================================= */

const ACHIEVEMENT_DEFS = [

  // ── CULTIVATION ────────────────────────────────────────────────────────────
  { id: 'realm_1',      cat: 'cultivation', icon: '🌱', name: 'First Step',
    desc: 'Reach the Qi Condensation realm.',
    check: s => s.realm >= 1,
    reward: { stones: 500 } },
  { id: 'realm_3',      cat: 'cultivation', icon: '🔥', name: 'Core Formation',
    desc: 'Form your Core — the third great realm.',
    check: s => s.realm >= 3,
    reward: { stones: 3000 } },
  { id: 'realm_5',      cat: 'cultivation', icon: '👁', name: 'Nascent Soul',
    desc: 'Condense a Nascent Soul.',
    check: s => s.realm >= 5,
    reward: { stones: 15000, eggs: 1 } },
  { id: 'realm_7',      cat: 'cultivation', icon: '🌌', name: 'Void Refinement',
    desc: 'Refine your spirit through the Void.',
    check: s => s.realm >= 7,
    reward: { stones: 50000, eggs: 2 } },
  { id: 'realm_9',      cat: 'cultivation', icon: '⚡', name: 'Immortal Ascension',
    desc: 'Shatter the mortal boundary and ascend.',
    check: s => s.realm >= 9,
    reward: { stones: 200000, eggs: 3 } },
  { id: 'stages_10',    cat: 'cultivation', icon: '💪', name: 'Minor Breakthroughs',
    desc: 'Clear 10 minor cultivation stages.',
    check: s => s.stagesCleared >= 10,
    progress: s => ({ cur: Math.min(s.stagesCleared, 10), max: 10 }),
    reward: { stones: 2000 } },
  { id: 'stages_50',    cat: 'cultivation', icon: '⚙️', name: 'Tempering the Body',
    desc: 'Clear 50 minor cultivation stages.',
    check: s => s.stagesCleared >= 50,
    progress: s => ({ cur: Math.min(s.stagesCleared, 50), max: 50 }),
    reward: { stones: 10000 } },
  { id: 'reborn',       cat: 'cultivation', icon: '♾️', name: 'Second Life',
    desc: 'Reincarnate for the first time.',
    check: s => (s.reincarnations || 0) >= 1,
    reward: { stones: 5000 } },

  // ── COMBAT ─────────────────────────────────────────────────────────────────
  { id: 'first_kill',   cat: 'combat', icon: '⚔️', name: 'Blood on Stone',
    desc: 'Defeat your first enemy in Trials.',
    check: s => (s.lifetimeKills || 0) >= 1,
    reward: { stones: 100 } },
  { id: 'kills_100',    cat: 'combat', icon: '🗡️', name: 'Slaughter Path',
    desc: 'Defeat 100 enemies.',
    check: s => (s.lifetimeKills || 0) >= 100,
    progress: s => ({ cur: Math.min(s.lifetimeKills || 0, 100), max: 100 }),
    reward: { stones: 1000 } },
  { id: 'kills_1000',   cat: 'combat', icon: '💀', name: 'Demon Bane',
    desc: 'Defeat 1,000 enemies.',
    check: s => (s.lifetimeKills || 0) >= 1000,
    progress: s => ({ cur: Math.min(s.lifetimeKills || 0, 1000), max: 1000 }),
    reward: { stones: 10000 } },
  { id: 'kills_10000',  cat: 'combat', icon: '☠️', name: 'War God',
    desc: 'Defeat 10,000 enemies.',
    check: s => (s.lifetimeKills || 0) >= 10000,
    progress: s => ({ cur: Math.min(s.lifetimeKills || 0, 10000), max: 10000 }),
    reward: { stones: 50000, eggs: 2 } },
  { id: 'first_boss',   cat: 'combat', icon: '👹', name: 'Slayer of Generals',
    desc: 'Defeat your first Trial boss.',
    check: s => (s.lifetimeBossKills || 0) >= 1,
    reward: { stones: 500 } },
  { id: 'zone_5',       cat: 'combat', icon: '🏔️', name: 'Deep Wilderness',
    desc: 'Reach Zone 5 in Trials.',
    check: s => (s.combat && s.combat.highestZone || 1) >= 5,
    reward: { stones: 5000 } },

  // ── SPIRIT STONES ──────────────────────────────────────────────────────────
  { id: 'stones_1k',    cat: 'loot', icon: '💎', name: 'First Fortune',
    desc: 'Earn 1,000 Spirit Stones total.',
    check: s => (s.lifetimeStones || 0) >= 1000,
    progress: s => ({ cur: Math.min(s.lifetimeStones || 0, 1000), max: 1000 }),
    reward: { stones: 200 } },
  { id: 'stones_10k',   cat: 'loot', icon: '💰', name: 'Stone Hoarder',
    desc: 'Earn 10,000 Spirit Stones total.',
    check: s => (s.lifetimeStones || 0) >= 10000,
    progress: s => ({ cur: Math.min(s.lifetimeStones || 0, 10000), max: 10000 }),
    reward: { stones: 2000 } },
  { id: 'stones_100k',  cat: 'loot', icon: '🏦', name: 'Stone Magnate',
    desc: 'Earn 100,000 Spirit Stones total.',
    check: s => (s.lifetimeStones || 0) >= 100000,
    progress: s => ({ cur: Math.min(s.lifetimeStones || 0, 100000), max: 100000 }),
    reward: { stones: 20000 } },
  { id: 'stones_1m',    cat: 'loot', icon: '👑', name: 'Wealth Beyond Heaven',
    desc: 'Earn 1,000,000 Spirit Stones total.',
    check: s => (s.lifetimeStones || 0) >= 1000000,
    progress: s => ({ cur: Math.min(s.lifetimeStones || 0, 1000000), max: 1000000 }),
    reward: { eggs: 3 } },

  // ── SPIRIT BEASTS ──────────────────────────────────────────────────────────
  { id: 'first_pet',    cat: 'collection', icon: '🐾', name: 'Spirit Tamer',
    desc: 'Tame your first Spirit Beast.',
    check: s => Object.keys(s.pets.owned).length >= 1,
    reward: { stones: 500 } },
  { id: 'pet_lvl_max',  cat: 'collection', icon: '⭐', name: 'Perfect Bond',
    desc: 'Reach max level (Lv.30) with any Spirit Beast.',
    check: s => Object.values(s.pets.owned).some(p => p.level >= 30),
    reward: { stones: 10000 } },
  { id: 'pet_evolved',  cat: 'collection', icon: '✨', name: 'Ascended Beast',
    desc: 'Evolve a Spirit Beast to 2 Stars.',
    check: s => Object.values(s.pets.owned).some(p => (p.star || 1) >= 2),
    reward: { stones: 20000 } },
  { id: 'collector_4',  cat: 'collection', icon: '🦊', name: 'Beast Warden',
    desc: 'Own 4 different Spirit Beasts.',
    check: s => Object.keys(s.pets.owned).length >= 4,
    progress: s => ({ cur: Math.min(Object.keys(s.pets.owned).length, 4), max: 4 }),
    reward: { stones: 5000, eggs: 1 } },
  { id: 'collector_all',cat: 'collection', icon: '🐉', name: 'Sovereign of Beasts',
    desc: 'Own all 8 Spirit Beasts.',
    check: s => Object.keys(s.pets.owned).length >= 8,
    progress: s => ({ cur: Math.min(Object.keys(s.pets.owned).length, 8), max: 8 }),
    reward: { stones: 50000, eggs: 3 } },

  // ── CRAFTING / ARTIFACTS ───────────────────────────────────────────────────
  { id: 'first_artifact',cat: 'crafting', icon: '⚜️', name: 'Equipped for War',
    desc: 'Obtain your first artifact.',
    check: s => Object.values(s.artifacts.equipped).some(a => a !== null) || s.artifacts.inventory.length > 0,
    reward: { stones: 500 } },
  { id: 'first_enchant', cat: 'crafting', icon: '🔮', name: 'Rune Carver',
    desc: 'Enchant an artifact with a rune.',
    check: s => {
      const hasRune = a => a && a.runes && a.runes.length > 0;
      return Object.values(s.artifacts.equipped).some(hasRune) || s.artifacts.inventory.some(hasRune);
    },
    reward: { stones: 2000 } },
  { id: 'heirloom_max',  cat: 'crafting', icon: '🏺', name: 'Ancestral Heritage',
    desc: 'Reach 5 Inheritance Stacks on your Heirloom.',
    check: s => s.heirloom && s.heirloom.stacks >= 5,
    progress: s => ({ cur: Math.min(s.heirloom ? s.heirloom.stacks : 0, 5), max: 5 }),
    reward: { stones: 30000 } },

  // ── ENGAGEMENT ─────────────────────────────────────────────────────────────
  { id: 'first_quest',   cat: 'engagement', icon: '📜', name: 'Disciple',
    desc: 'Claim a quest reward for the first time.',
    check: s => s.quests && Object.keys(s.quests.claimed || {}).length >= 1,
    reward: { stones: 500 } },
  { id: 'all_quests',    cat: 'engagement', icon: '📖', name: 'Chronicler',
    desc: 'Claim rewards for all 12 main story quests.',
    check: s => s.quests && Object.keys(s.quests.claimed || {}).length >= 12,
    progress: s => ({ cur: Math.min(Object.keys((s.quests && s.quests.claimed) || {}).length, 12), max: 12 }),
    reward: { stones: 50000, eggs: 2 } },
  { id: 'first_booster', cat: 'engagement', icon: '⚡', name: 'Power Surge',
    desc: 'Activate your first Cultivation Booster.',
    check: s => (s.lifetimeBoosterActivations || 0) >= 1,
    reward: { stones: 200 } },
  { id: 'daily_done',    cat: 'engagement', icon: '📋', name: 'Diligent Cultivator',
    desc: 'Complete a full daily mission board.',
    check: s => s.dailies && (s.dailies.streak || 0) >= 1,
    reward: { stones: 1000 } },
  { id: 'challenge_done',cat: 'engagement', icon: '🏆', name: 'Steel Tested',
    desc: 'Claim a Weekly Challenge reward.',
    check: s => s.weeklyChallenge && s.weeklyChallenge.claimed,
    reward: { stones: 2000 } },
];

const Achievements = {
  defs: ACHIEVEMENT_DEFS,
  CAT_LABELS: {
    cultivation: 'Cultivation',
    combat:      'Combat',
    loot:        'Spirit Stones',
    collection:  'Spirit Beasts',
    crafting:    'Artifacts',
    engagement:  'Engagement',
  },
  CAT_ORDER: ['cultivation', 'combat', 'loot', 'collection', 'crafting', 'engagement'],

  _s()           { return Game.state.achievements; },
  isUnlocked(id) { const e = this._s()[id]; return !!(e && e.unlocked); },
  isClaimed(id)  { const e = this._s()[id]; return !!(e && e.claimed); },

  /** Scan all defs; unlock any whose condition is newly met. Returns newly-unlocked defs. */
  checkAll() {
    const s = Game.state;
    const newUnlocks = [];
    for (const def of ACHIEVEMENT_DEFS) {
      if (this.isUnlocked(def.id)) continue;
      try {
        if (def.check(s)) {
          if (!s.achievements[def.id]) s.achievements[def.id] = {};
          s.achievements[def.id].unlocked = true;
          newUnlocks.push(def);
        }
      } catch (_) {}
    }
    if (newUnlocks.length) Game.persist();
    return newUnlocks;
  },

  claim(id) {
    if (!this.isUnlocked(id) || this.isClaimed(id)) return false;
    const def = ACHIEVEMENT_DEFS.find(d => d.id === id);
    if (!def) return false;
    const r = def.reward || {};
    if (r.stones) Game.state.spiritStones += r.stones;
    if (r.eggs)   Game.state.beastEggs   += r.eggs;
    Game.state.achievements[id].claimed = true;
    Game.persist();
    return true;
  },

  progress(id) {
    const def = ACHIEVEMENT_DEFS.find(d => d.id === id);
    if (!def || !def.progress) return null;
    try { return def.progress(Game.state); } catch (_) { return null; }
  },

  unclaimedCount() {
    return ACHIEVEMENT_DEFS.filter(d => this.isUnlocked(d.id) && !this.isClaimed(d.id)).length;
  },

  stats() {
    const total    = ACHIEVEMENT_DEFS.length;
    const unlocked = ACHIEVEMENT_DEFS.filter(d => this.isUnlocked(d.id)).length;
    const claimed  = ACHIEVEMENT_DEFS.filter(d => this.isClaimed(d.id)).length;
    return { total, unlocked, claimed };
  },
};
window.Achievements = Achievements;
