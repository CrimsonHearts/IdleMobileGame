/* ===========================================================================
 * challenges.js — Weekly Cultivation Challenges.
 * A new challenge rotates every week. Its modifier applies automatically for
 * the whole week; claim your reward once to collect the week's bonus.
 * ========================================================================= */

const CHALLENGE_POOL = [
  { id: 'blood_frenzy',   name: 'Blood Frenzy',    icon: '🩸', desc: '2× Blood Essence from every kill.',           mod: 'bloodMult',       value: 2 },
  { id: 'spirit_surge',   name: 'Spirit Surge',    icon: '🌌', desc: '3× Spirit condensation from Qi gained.',      mod: 'spiritMult',      value: 3 },
  { id: 'stone_rush',     name: 'Stone Rush',      icon: '💠', desc: '2× Spirit Stones from Trials.',               mod: 'stoneMult',       value: 2 },
  { id: 'qi_flood',       name: 'Qi Flood',        icon: '🌊', desc: '2× Qi production from all generators.',       mod: 'qiMult',          value: 2 },
  { id: 'trial_hard',     name: 'Trial of Steel',  icon: '⚔️', desc: 'Mobs have 3× HP — but drop 4× loot.',        mod: 'trialHard',       value: 1 },
  { id: 'beast_bounty',   name: 'Beast Bounty',    icon: '🐉', desc: '5× Beast Egg drop chance in Trials.',         mod: 'eggMult',         value: 5 },
  { id: 'dao_insight',    name: 'Dao Insight',     icon: '☯️', desc: '2× Dao Comprehension from Tribulation.',      mod: 'daoMult',         value: 2 },
  { id: 'rune_resonance', name: 'Rune Resonance',  icon: '✨', desc: '50% off Enchanting costs this week.',         mod: 'enchantDiscount', value: 0.5 },
];

const CHALLENGE_REWARDS = { stones: 10000, eggs: 2, blood: 5000, spirit: 2000 };

const Challenges = {
  pool: CHALLENGE_POOL,
  REWARDS: CHALLENGE_REWARDS,

  weekId() { return Math.floor(TimeService.now() / (7 * 24 * 3600 * 1000)); },
  active() { return CHALLENGE_POOL[this.weekId() % CHALLENGE_POOL.length]; },

  hasClaimed() {
    const s = Game.state.weeklyChallenge;
    return !!(s && s.weekId === this.weekId() && s.claimed);
  },

  // -- Per-modifier accessors ------------------------------------------------
  bloodMult()       { return this.active().mod === 'bloodMult'       ? this.active().value : 1; },
  spiritMult()      { return this.active().mod === 'spiritMult'      ? this.active().value : 1; },
  stoneMult()       { return this.active().mod === 'stoneMult'       ? this.active().value : 1; },
  qiMult()          { return this.active().mod === 'qiMult'          ? this.active().value : 1; },
  eggMult()         { return this.active().mod === 'eggMult'         ? this.active().value : 1; },
  daoMult()         { return this.active().mod === 'daoMult'         ? this.active().value : 1; },
  trialHard()       { return this.active().mod === 'trialHard'; },
  enchantDiscount() { return this.active().mod === 'enchantDiscount' ? this.active().value : 0; },

  // -- Claim reward ----------------------------------------------------------
  claim() {
    if (this.hasClaimed() || !Game.combatUnlocked()) return false;
    Game.state.weeklyChallenge = { weekId: this.weekId(), claimed: true };
    Game.state.spiritStones += CHALLENGE_REWARDS.stones;
    Game.state.beastEggs    += CHALLENGE_REWARDS.eggs;
    if (Game.state.blood)  Game.state.blood.essence  += CHALLENGE_REWARDS.blood;
    if (Game.state.spirit) Game.state.spirit.essence += CHALLENGE_REWARDS.spirit;
    Game.persist();
    return true;
  },
};

window.Challenges = Challenges;
