/* ===========================================================================
 * combat.js — Trials: idle auto-battler.
 * Your cultivator + active spirit beasts fight waves of demonic beasts.
 * Kills drop Spirit Stones, Qi, and occasionally Beast Eggs.
 * Every 10th wave is a Boss. Clearing a boss unlocks the next Zone.
 * Combat advances in the main game loop (while the app is open).
 * ========================================================================= */

// Zone bands (Round 26): each band of the Trials has its own mob/boss roster
// so pushing deeper actually looks different, instead of the same 4 mobs / 2
// bosses cycling forever. Bands are thematically keyed to the Fracture's own
// zone thresholds (rifts open at 5+, Major at 10+, Grand at 15+ — see
// fracture.js RIFT_TIERS) so the enemies escalate in lockstep with the plot.
const MOB_BANDS = [
  { // Zone 1-4 — Mortal Wilds
    maxZone: 4,
    mobs: [
      { name: 'Demonic Wolf',   icon: 'ic-mob-wolf' },
      { name: 'Corpse Ghoul',   icon: 'ic-mob-ghoul' },
      { name: 'Venom Scorpion', icon: 'ic-mob-scorpion' },
      { name: 'Blood Bat',      icon: 'ic-mob-bat' },
    ],
    bosses: [
      { name: 'Demon General', icon: 'ic-mob-demon' },
      { name: 'Ghost King',    icon: 'ic-mob-demon' },
    ],
  },
  { // Zone 5-9 — Rift-Touched (Minor Rifts begin opening here)
    maxZone: 9,
    mobs: [
      { name: 'Rift-Touched Hound', icon: 'ic-mob-hound' },
      { name: 'Fractured Wraith',   icon: 'ic-mob-wraith' },
      { name: 'Voidling Swarm',     icon: 'ic-mob-voidling' },
      { name: 'Corrupted Cultivator', icon: 'ic-mob-corrupted' },
    ],
    bosses: [
      { name: 'Rift Warden',     icon: 'ic-mob-warden' },
      { name: 'Corrupted Elder', icon: 'ic-mob-corrupted' },
    ],
  },
  { // Zone 10-14 — Deep Rift (Major Rifts begin opening here)
    maxZone: 14,
    mobs: [
      { name: 'Hollow Sentinel',     icon: 'ic-mob-sentinel' },
      { name: 'Cracked Colossus',    icon: 'ic-mob-colossus' },
      { name: 'Whispering Shade',    icon: 'ic-mob-wraith' },
      { name: 'Jiutian Enforcer Drone', icon: 'ic-mob-enforcer' },
    ],
    bosses: [
      { name: 'Jiutian Enforcer Captain', icon: 'ic-mob-enforcer' },
      { name: 'Colossus Prime',           icon: 'ic-mob-colossus' },
    ],
  },
  { // Zone 15+ — Void-Touched (Grand Rifts begin opening here)
    maxZone: Infinity,
    mobs: [
      { name: 'Void Reaver',        icon: 'ic-mob-reaver' },
      { name: 'Starless Wraith',    icon: 'ic-mob-wraith' },
      { name: 'Fracture Abomination', icon: 'ic-mob-abomination' },
      { name: 'Heaven-Eater Wisp',  icon: 'ic-mob-wisp' },
    ],
    bosses: [
      { name: 'Void Sovereign',   icon: 'ic-mob-sovereign' },
      { name: 'The Unraveling',   icon: 'ic-mob-abomination' },
    ],
  },
];

function bandForZone(zone) {
  return MOB_BANDS.find(b => zone <= b.maxZone) || MOB_BANDS[MOB_BANDS.length - 1];
}

// Rift Guardians (Round 26, Act III): named one-time story bosses. Each
// overrides the normal boss spawn at its exact zone, on every boss wave,
// until defeated once — no RNG gate, since this is the vehicle for the
// game's main quest chain and shouldn't be luck-gated. See quests.js
// order 25-31 for the dialogue this ties into.
const GUARDIANS = [
  { id: 'ledger', zone: 16, name: 'The Ledger',        icon: 'ic-mob-ledger', hpMult: 2.5, atkMult: 1.4 },
  { id: 'choir',  zone: 18, name: 'The Hollow Choir',   icon: 'ic-mob-choir',  hpMult: 3.0, atkMult: 1.6 },
  { id: 'shadow', zone: 20, name: "Su Wan's Shadow",    icon: 'ic-mob-shadow', hpMult: 3.5, atkMult: 1.8 },
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
    const fracture = window.Fracture ? Fracture.combatMult() : 1;
    const family = window.Family ? (1 + Family.combatBonus()) : 1; // Martial-path children (Round 15)
    return (this.baseAtk() + (window.Pets ? Pets.combatAtk() : 0) + gear) * Sect.combatMult() * meridian * perk * pill * path * boost * fracture * family;
  },
  playerHpMax() {
    const hpMult = (window.Game && Game.hpExternalMult) ? Game.hpExternalMult() : 1;
    return (this.baseHp() + (window.Pets ? Pets.combatHp() : 0) + (window.Game && Game.gearHp ? Game.gearHp() : 0)) * hpMult;
  },

  // -- Mob scaling ----------------------------------------------------------
  isBossWave(wave) { return wave % 10 === 0; },

  /** Returns the Guardian def pending at this zone, or null if none / already defeated. */
  _guardianForZone(zone) {
    const g = GUARDIANS.find(g => g.zone === zone);
    if (!g) return null;
    const defeated = Game.state.fracture && Game.state.fracture.guardiansDefeated;
    return (defeated && defeated[g.id]) ? null : g;
  },

  spawnMob() {
    const z = Game.state.combat.zone, w = Game.state.combat.wave;
    const boss = this.isBossWave(w);
    const guardian = boss ? this._guardianForZone(z) : null;
    let pick;
    if (guardian) {
      pick = guardian;
    } else {
      const band = bandForZone(z);
      pick = boss ? band.bosses[(z - 1) % band.bosses.length] : band.mobs[(w - 1) % band.mobs.length];
    }
    let hp  = 40 * z * Math.pow(1.22, w);
    let atk = 6  * z * (1 + 0.12 * w);
    if (boss) { hp *= 6; atk *= 2.2; }
    if (guardian) { hp *= guardian.hpMult; atk *= guardian.atkMult; }
    const baseHp = hp; // capture before Trial of Steel inflation so loot is based on base power
    if (window.Challenges && Challenges.trialHard()) hp *= 3;
    this._mob = { name: pick.name, icon: pick.icon, baseHp, maxHp: hp, hp, atk, boss, guardianId: guardian ? guardian.id : null };
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
                   * (window.Boosters ? Boosters.lootMult() : 1) // Cultivation Boosters: Loot Rush (Round 9)
                   * (window.Fracture ? Fracture.lootMult() : 1); // Fracture Harvest path (Round 13)
    // Use baseHp (pre-trialHard) so trialMult is a clean 4× on base loot, not 12× (3×hp × 4).
    const baseHp = mob.baseHp !== undefined ? mob.baseHp : mob.maxHp;
    // SectGuild research: Demon sect stone-drop bonus (Round 12).
    const sectStonesMult = window.SectGuild ? SectGuild.stonesMult() : 1;
    const stones = Math.max(1, Math.round(baseHp * 0.04 * lootMult
                   * (window.Challenges ? Challenges.stoneMult() : 1) * trialMult * sectStonesMult));
    Game.state.spiritStones += stones;
    // Lifetime + daily tracking (Round 11).
    Game.state.lifetimeStones = (Game.state.lifetimeStones || 0) + stones;
    if (mob.boss) {
      Game.state.lifetimeBossKills = (Game.state.lifetimeBossKills || 0) + 1;
      if (window.Dailies) Dailies.onBossKill();
    } else {
      Game.state.lifetimeKills = (Game.state.lifetimeKills || 0) + 1;
      if (window.Dailies) Dailies.onKill();
    }
    if (window.Dailies) Dailies.onStonesGained(stones);
    // Stellar Shards drop (zone 3+): Fracture Harvest (Round 13).
    if (window.Fracture) {
      const shards = Fracture.onMobKill(c.zone, mob.boss);
      if (shards > 0) this._pushLog(`✦ +${shards} Stellar Shards`);
    }
    // A little Qi too. Use baseHp (pre-trialHard) — same reasoning as stones above.
    Game._addQi(baseHp * 2);
    // Blood Essence: tempering currency drawn from battle itself.
    const blood = Math.max(1, Math.round(baseHp * 0.01 * (window.Challenges ? Challenges.bloodMult() : 1) * trialMult
                   * (window.Boosters ? Boosters.lootMult() : 1)));
    if (window.Blood) Blood.gain(blood);
    // Sect contribution from battle. Use baseHp — same reasoning as stones above.
    Sect.addContribution(Math.round(baseHp * 0.02));
    let egg = false;
    const luck = (window.Spirit ? Spirit.luckMult() : 1) * (window.Challenges ? Challenges.eggMult() : 1)
               * (window.Boosters ? Boosters.luckMult() : 1); // Cultivation Boosters: Lucky Star (Round 9)
    const eggChance = (mob.boss ? 1 : 0.04) * luck;
    if (Math.random() < eggChance) { Game.state.beastEggs += 1; egg = true; }
    // Artifact drop (zone-scaled). Suppressed log during offline batch sim.
    let art = null;
    if (window.Artifacts) art = Artifacts.rollDrop(c.zone, mob.boss);
    // Rift Guardian defeated (Round 26, Act III) — flag it permanently so it
    // never respawns, then let quests.js' normal polling pick up the story
    // beat (see quests.js order 25-31).
    if (mob.guardianId && this._s()) {
      const gs = this._s();
      if (!gs.guardiansDefeated) gs.guardiansDefeated = {};
      if (!gs.guardiansDefeated[mob.guardianId]) {
        gs.guardiansDefeated[mob.guardianId] = true;
        this._pushLog(`✦✦ ${mob.name} has fallen. The rift stills.`);
      }
    }
    this._pushLog(`Defeated ${mob.name} · +${GameNumbers.formatNumber(stones)} Stones${egg ? ' · +1 Beast Egg!' : ''}${art ? ' · ✦ Artifact!' : ''}`);
  },

  _s() { return Game.state.fracture; },

  _pushLog(line) {
    this.log.unshift(line);
    if (this.log.length > 6) this.log.pop();
  },

  // -- Zone navigation ------------------------------------------------------
  advanceWaveOrZone(clearedBoss) {
    const c = Game.state.combat;
    if (clearedBoss) {
      const clearedZone = c.zone;
      c.highestZone = Math.max(c.highestZone || 1, c.zone + 1);
      c.zone += 1; c.wave = 1;
      this._pushLog(`⛰ Entered Zone ${c.zone}!`);
      // Celestial Rift event (Round 13/14): tiered on the depth of the cleared zone.
      if (window.Fracture) {
        const riftShards = Fracture.tryRiftEvent(clearedZone);
        if (riftShards > 0) this._pushLog(`${Fracture.lastRiftIcon()} ${Fracture.lastRiftName()} sealed! +${riftShards} Stellar Shards`);
      }
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
    if (mob.boss && window.Techniques)  pAtk *= Techniques.bossDmgMult();
    if (mob.boss && window.Enchanting)  pAtk *= Enchanting.bossDmgMult();
    if (mob.boss && window.SectGuild)   pAtk *= SectGuild.bossDmgMult();

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
