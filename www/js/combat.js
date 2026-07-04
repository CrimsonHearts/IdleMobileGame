/* ===========================================================================
 * combat.js — Trials: idle auto-battler.
 * Your cultivator + active spirit beasts fight waves of demonic beasts.
 * Kills drop Spirit Stones, Qi, and occasionally Beast Eggs.
 * Every 10th wave is a Boss. Clearing a boss unlocks the next Zone.
 * Combat advances in the main game loop (while the app is open).
 * ========================================================================= */

const MOB_NAMES = [
  { name: 'Demonic Wolf',   icon: 'ic-mob-wolf' },
  { name: 'Corpse Ghoul',   icon: 'ic-mob-ghoul' },
  { name: 'Venom Scorpion', icon: 'ic-mob-scorpion' },
  { name: 'Blood Bat',      icon: 'ic-mob-wolf' },
];
const BOSS_NAMES = [
  { name: 'Demon General', icon: 'ic-mob-demon' },
  { name: 'Ghost King',    icon: 'ic-mob-demon' },
];

const Combat = {
  log: [],            // recent loot/event lines (UI reads this)
  _mob: null,         // { name, icon, hp, maxHp, atk, boss }
  _accum: 0,          // sub-second damage accumulator

  // -- Player combat power --------------------------------------------------
  baseAtk() {
    // Grows with realm + minor stages cleared.
    const realm = Game.state.realm, cb = 1 + Game.state.stagesCleared * 0.05;
    return (8 + realm * realm * 6) * cb;
  },
  baseHp() {
    const realm = Game.state.realm, cb = 1 + Game.state.stagesCleared * 0.05;
    return (60 + realm * realm * 40) * cb;
  },
  playerAtk() {
    const meridian = (window.Game && Game.meridianMult) ? (1 + Game.meridianMult('combat')) : 1;
    const perk = (window.Game && Game.perkBonus) ? (1 + Game.perkBonus('combat')) : 1;
    const pill = (window.Game && Game.buffMult) ? Game.buffMult('combat') : 1;
    const path = (window.Game && Game.combatExternalMult) ? Game.combatExternalMult() : 1; // Dao Path + traits + duel buff + artifact sets
    const gear = (window.Game && Game.gearAtk) ? Game.gearAtk() : 0;
    const boost = window.Boosters ? Boosters.combatMult() : 1; // Cultivation Boosters: Battle Fury (Round 9)
    return (this.baseAtk() + (window.Pets ? Pets.combatAtk() : 0) + gear) * Sect.combatMult() * meridian * perk * pill * path * boost;
  },
  playerHpMax() {
    const hpMult = (window.Game && Game.hpExternalMult) ? Game.hpExternalMult() : 1;
    return (this.baseHp() + (window.Pets ? Pets.combatHp() : 0) + (window.Game && Game.gearHp ? Game.gearHp() : 0)) * hpMult;
  },

  // -- Mob scaling ----------------------------------------------------------
  isBossWave(wave) { return wave % 10 === 0; },

  spawnMob() {
    const z = Game.state.combat.zone, w = Game.state.combat.wave;
    const boss = this.isBossWave(w);
    const tier = MOB_NAMES.length;
    const pick = boss ? BOSS_NAMES[(z - 1) % BOSS_NAMES.length] : MOB_NAMES[(w - 1) % tier];
    let hp  = 40 * z * Math.pow(1.22, w);
    let atk = 6  * z * (1 + 0.12 * w);
    if (boss) { hp *= 6; atk *= 2.2; }
    const baseHp = hp; // capture before Trial of Steel inflation so loot is based on base power
    if (window.Challenges && Challenges.trialHard()) hp *= 3;
    this._mob = { name: pick.name, icon: pick.icon, baseHp, maxHp: hp, hp, atk, boss };
    return this._mob;
  },

  mob() { if (!this._mob) this.spawnMob(); return this._mob; },

  ensurePlayerHp() {
    const c = Game.state.combat;
    if (c.playerHp === undefined || c.playerHp === null || c.playerHp > this.playerHpMax()) {
      c.playerHp = this.playerHpMax();
    }
  },

  // -- Loot -----------------------------------------------------------------
  _loot(mob) {
    const c = Game.state.combat;
    const trialMult = (window.Challenges && Challenges.trialHard()) ? 4 : 1;
    const lootMult = Sect.lootMult() * ((window.Game && Game.karmaLootMult) ? Game.karmaLootMult() : 1)
                   * (window.Enchanting ? (1 + Enchanting.lootMult()) : 1)
                   * (window.Boosters ? Boosters.lootMult() : 1); // Cultivation Boosters: Loot Rush (Round 9)
    // Use baseHp (pre-trialHard) so trialMult is a clean 4× on base loot, not 12× (3×hp × 4).
    const baseHp = mob.baseHp !== undefined ? mob.baseHp : mob.maxHp;
    const stones = Math.max(1, Math.round(baseHp * 0.04 * lootMult
                   * (window.Challenges ? Challenges.stoneMult() : 1) * trialMult));
    Game.state.spiritStones += stones;
    // A little Qi too.
    Game._addQi(mob.maxHp * 2);
    // Blood Essence: tempering currency drawn from battle itself.
    const blood = Math.max(1, Math.round(baseHp * 0.01 * (window.Challenges ? Challenges.bloodMult() : 1) * trialMult
                   * (window.Boosters ? Boosters.lootMult() : 1)));
    if (window.Blood) Blood.gain(blood);
    // Sect contribution from battle.
    Sect.addContribution(Math.round(mob.maxHp * 0.02));
    let egg = false;
    const luck = (window.Spirit ? Spirit.luckMult() : 1) * (window.Challenges ? Challenges.eggMult() : 1)
               * (window.Boosters ? Boosters.luckMult() : 1); // Cultivation Boosters: Lucky Star (Round 9)
    const eggChance = (mob.boss ? 1 : 0.04) * luck;
    if (Math.random() < eggChance) { Game.state.beastEggs += 1; egg = true; }
    // Artifact drop (zone-scaled). Suppressed log during offline batch sim.
    let art = null;
    if (window.Artifacts) art = Artifacts.rollDrop(c.zone, mob.boss);
    this._pushLog(`Defeated ${mob.name} · +${GameNumbers.formatNumber(stones)} Stones${egg ? ' · +1 Beast Egg!' : ''}${art ? ' · ✦ Artifact!' : ''}`);
  },

  _pushLog(line) {
    this.log.unshift(line);
    if (this.log.length > 6) this.log.pop();
  },

  // -- Zone navigation ------------------------------------------------------
  advanceWaveOrZone(clearedBoss) {
    const c = Game.state.combat;
    if (clearedBoss) {
      c.highestZone = Math.max(c.highestZone || 1, c.zone + 1);
      c.zone += 1; c.wave = 1;
      this._pushLog(`⛰ Entered Zone ${c.zone}!`);
    } else {
      c.wave += 1;
    }
    this.spawnMob();
  },

  retreatZone() {
    const c = Game.state.combat;
    if (c.zone > 1) { c.zone -= 1; c.wave = 1; this.ensurePlayerHp(); this.spawnMob(); this._pushLog(`Retreated to Zone ${c.zone}.`); }
  },
  pushZone() {
    const c = Game.state.combat;
    if ((c.highestZone || 1) > c.zone) { c.zone += 1; c.wave = 1; this.ensurePlayerHp(); this.spawnMob(); this._pushLog(`Advanced to Zone ${c.zone}.`); }
  },

  // -- Tick (called each frame from Game.tick) ------------------------------
  tick(dt) {
    if (Game.state.combat.paused) return;
    this.ensurePlayerHp();
    const c = Game.state.combat;
    const mob = this.mob();
    let pAtk = this.playerAtk();
    if (mob.boss && window.Techniques) pAtk *= Techniques.bossDmgMult();
    if (mob.boss && window.Enchanting) pAtk *= Enchanting.bossDmgMult();

    // Exchange damage over dt (1 "round" ≈ 1 second).
    const dmgDealt = pAtk * dt;
    mob.hp -= dmgDealt;
    if (window.Techniques) c.playerHp = Math.min(this.playerHpMax(), c.playerHp + dmgDealt * Techniques.lifestealFrac());
    let dmgTaken = mob.atk * dt;
    if (window.Techniques) dmgTaken *= (1 - Techniques.mitigationFrac());
    c.playerHp -= dmgTaken;

    if (mob.hp <= 0) {
      this._loot(mob);
      this.advanceWaveOrZone(mob.boss);
      // Heal a little on victory.
      const healBonus = window.Blood ? Blood.healBonus() : 0;
      c.playerHp = Math.min(this.playerHpMax(), c.playerHp + this.playerHpMax() * 0.25 * (1 + healBonus));
    } else if (c.playerHp <= 0) {
      // Defeat: fall back to wave 1 of the current zone, fully heal.
      this._pushLog(`✖ Defeated by ${mob.name}. Retreating to Zone ${c.zone} Wave 1.`);
      c.wave = 1;
      c.playerHp = this.playerHpMax();
      this.spawnMob();
    }
  },
};

window.Combat = Combat;
