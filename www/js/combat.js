/* ===========================================================================
 * combat.js — Trials (历练): idle auto-battler.
 * Your cultivator + active spirit beasts fight waves of demonic beasts.
 * Kills drop Spirit Stones (灵石), Qi, and occasionally Beast Eggs (兽蛋).
 * Every 10th wave is a Boss. Clearing a boss unlocks the next Zone.
 * Combat advances in the main game loop (while the app is open).
 * ========================================================================= */

const MOB_NAMES = [
  { name: 'Demonic Wolf',   nameCN: '妖狼',   icon: 'ic-mob-wolf' },
  { name: 'Corpse Ghoul',   nameCN: '尸傀',   icon: 'ic-mob-ghoul' },
  { name: 'Venom Scorpion', nameCN: '毒蝎',   icon: 'ic-mob-scorpion' },
  { name: 'Blood Bat',      nameCN: '血蝠',   icon: 'ic-mob-wolf' },
];
const BOSS_NAMES = [
  { name: 'Demon General', nameCN: '魔将', icon: 'ic-mob-demon' },
  { name: 'Ghost King',    nameCN: '鬼王', icon: 'ic-mob-demon' },
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
  playerAtk() { return (this.baseAtk() + (window.Pets ? Pets.combatAtk() : 0)) * Sect.combatMult(); },
  playerHpMax() { return this.baseHp() + (window.Pets ? Pets.combatHp() : 0); },

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
    this._mob = { name: pick.name, nameCN: pick.nameCN, icon: pick.icon, maxHp: hp, hp, atk, boss };
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
    const lootMult = Sect.lootMult();
    const stones = Math.max(1, Math.round(mob.maxHp * 0.04 * lootMult));
    Game.state.spiritStones += stones;
    // A little Qi too.
    Game._addQi(mob.maxHp * 2);
    // Sect contribution from battle.
    Sect.addContribution(Math.round(mob.maxHp * 0.02));
    let egg = false;
    const eggChance = mob.boss ? 1 : 0.04;
    if (Math.random() < eggChance) { Game.state.beastEggs += 1; egg = true; }
    this._pushLog(`Slew ${mob.nameCN} ${mob.name} · +${GameNumbers.formatNumber(stones)} 灵石${egg ? ' · +1 兽蛋!' : ''}`);
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
    const pAtk = this.playerAtk();

    // Exchange damage over dt (1 "round" ≈ 1 second).
    mob.hp -= pAtk * dt;
    c.playerHp -= mob.atk * dt;

    if (mob.hp <= 0) {
      this._loot(mob);
      this.advanceWaveOrZone(mob.boss);
      // Heal a little on victory.
      c.playerHp = Math.min(this.playerHpMax(), c.playerHp + this.playerHpMax() * 0.25);
    } else if (c.playerHp <= 0) {
      // Defeat: fall back to wave 1 of the current zone, fully heal.
      this._pushLog(`✖ Defeated by ${mob.nameCN}. Retreating to Zone ${c.zone} Wave 1.`);
      c.wave = 1;
      c.playerHp = this.playerHpMax();
      this.spawnMob();
    }
  },
};

window.Combat = Combat;
