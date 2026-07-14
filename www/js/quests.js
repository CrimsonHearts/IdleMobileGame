/* ===========================================================================
 * quests.js — Story quests, achievements, and hidden mechanic discoveries.
 *
 * Quest types:
 *   'story'       — ordered chain that guides the new player through systems
 *   'achievement' — standalone milestones, any order
 *   'hidden'      — description is '???' until the condition is first triggered
 *
 * Rewards: qi · dao · money · charm · shards · permanentBonus (fraction added to allMult)
 *
 * Some story-chain quests carry an optional `dialogue` — mentor/antagonist
 * flavor lines shown as a lightweight banner (UI.showDialogue) right when
 * the quest completes, so the narrative rides the same trigger/reward path
 * instead of a parallel tracking system.
 * =========================================================================*/

const QUEST_DEFS = [

  // ── STORY CHAIN ──────────────────────────────────────────────────────────
  {
    id: 'first_breath', category: 'story', order: 1, icon: '🌱',
    title: 'First Breath',
    desc:  'Tap Meditate for the first time to begin your cultivation journey.',
    hint:  'Tap the glowing circle on the Cultivate tab.',
    check: () => Game.state.lifetimeQi > 0,
    reward: { qi: 100 },
    rewardText: '+100 Qi',
    dialogue: [
      { speaker: 'mentor', name: 'Granny Su', icon: '🍵', lines: [
        "So. The Qi answers your call already. Not everyone's does — most modern folk forgot how to listen.",
        'Su Wan. Three centuries old, if you must know, and too stubborn to either ascend or die. Granny Su will do.',
        "I'll be watching your progress, Cultivator. The world up there isn't as quiet as your meditation app makes it feel.",
      ] },
    ],
  },
  {
    id: 'qi_seeker', category: 'story', order: 2, icon: '☯',
    title: 'Qi Seeker',
    desc:  'Accumulate 500 lifetime Qi.',
    hint:  'Keep meditating and buy your first generator.',
    check: () => Game.state.lifetimeQi >= 500,
    reward: { qi: 250 },
    rewardText: '+250 Qi',
  },
  {
    id: 'first_generator', category: 'story', order: 3, icon: '🧘',
    title: 'Cultivation Grounds',
    desc:  'Purchase your first Meditation App.',
    hint:  'Buy a generator from the Cultivate tab.',
    check: () => (Game.state.owned['mat'] || 0) >= 1,
    reward: { qi: 500 },
    rewardText: '+500 Qi',
  },
  {
    id: 'first_stage', category: 'story', order: 4, icon: '⬆',
    title: 'A Step Forward',
    desc:  'Advance your first minor cultivation stage.',
    hint:  'Accumulate enough run-Qi then tap the green Breakthrough button.',
    check: () => Game.state.stagesCleared >= 1,
    reward: { dao: 1 },
    rewardText: '+1 Dao Comprehension',
  },
  {
    id: 'first_tribulation', category: 'story', order: 5, icon: '⚡',
    title: 'Baptism of Thunder',
    desc:  'Survive your first Heavenly Tribulation and ascend to Qi Condensation.',
    hint:  'Complete all stages in the Mortal realm then face the Tribulation.',
    check: () => Game.state.realm >= 1,
    reward: { dao: 3, qi: 2000 },
    rewardText: '+3 Dao & +2,000 Qi',
    dialogue: [
      { speaker: 'mentor', name: 'Granny Su', icon: '🍵', lines: [
        "You felt that, didn't you — the sky itself testing your resolve. That was no metaphor. The Heavens really do judge.",
        "Be proud, but don't get comfortable. Tribulations only get crueler from here, and someone out there is watching who clears them, and how fast.",
      ] },
    ],
  },
  {
    id: 'scholar', category: 'story', order: 6, icon: '📚',
    title: "The Scholar's Path",
    desc:  'Enroll in your first Academy course.',
    hint:  'Visit the Study tab and tap Enroll.',
    check: () => Game.state.life && Game.state.life.education >= 1,
    reward: { money: 500 },
    rewardText: '+¥500',
  },
  {
    id: 'first_job', category: 'story', order: 7, icon: '💼',
    title: 'Earning Your Keep',
    desc:  'Take your first job and start earning money.',
    hint:  'Visit the Work tab and tap Take on any available job.',
    check: () => Game.state.life && Game.state.life.jobId !== null,
    reward: { money: 1000 },
    rewardText: '+¥1,000',
    dialogue: [
      { speaker: 'mentor', name: 'Granny Su', icon: '🍵', lines: [
        'A paycheck and a purpose — good. Half the cultivators I knew burned out chasing power with empty pockets.',
        'Careful who you work for, though. Nearly every good job in this city traces back to one conglomerate sooner or later.',
      ] },
    ],
  },
  {
    id: 'kindred_spirit', category: 'story', order: 8, icon: '💕',
    title: 'A Kindred Spirit',
    desc:  'Reach 50 Affinity with a romantic candidate.',
    hint:  'Visit the Life tab and chat or go on dates. Charm helps!',
    check: () => {
      const f = Game.state.family;
      if (!f) return false;
      if (f.spouse) return true;
      return f.candidates && f.candidates.some(c => c.affinity >= 50);
    },
    reward: { charm: 5 },
    rewardText: '+5 Charm',
    dialogue: [
      { speaker: 'mentor', name: 'Granny Su', icon: '🍵', lines: [
        "Someone's caught your eye. Good. Jiutian likes its cultivators alone and hungry — a bond like that is the one asset they can't buy.",
      ] },
    ],
  },
  {
    id: 'married', category: 'story', order: 9, icon: '💍',
    title: 'Two Become One',
    desc:  'Marry your chosen partner and build a household.',
    hint:  'Reach 100 Affinity with a candidate, then Propose.',
    check: () => Game.state.family && !!Game.state.family.spouse,
    reward: { dao: 2, qi: 5000 },
    rewardText: '+2 Dao & +5,000 Qi',
    dialogue: [
      { speaker: 'mentor', name: 'Granny Su', icon: '🍵', lines: [
        "A household, built on your own terms. I never got the chance, fighting people like Lu Heng. Don't make my mistake — let this one keep you human.",
      ] },
    ],
  },
  {
    id: 'core_formation', category: 'story', order: 10, icon: '💎',
    title: 'Core Condensed',
    desc:  'Forge your Golden Core — reach the Core Formation realm.',
    hint:  'Keep breaking through realms: Qi Condensation → Foundation → Core.',
    check: () => Game.state.realm >= 3,
    reward: { dao: 5, permanentBonus: 0.05 },
    rewardText: '+5 Dao & permanent +5% production',
    dialogue: [
      { speaker: 'mentor', name: 'Granny Su', icon: '🍵', lines: [
        "A Golden Core, condensed by your own hand. I haven't seen one forged this clean in years.",
        'It won’t go unnoticed, child. Jiutian Holdings tracks every Core that forms outside their own academies — they call it "market research." I call it a leash.',
      ] },
      { speaker: 'antagonist', name: 'Lu Heng · Jiutian Holdings', icon: '🏢', lines: [
        'Another independent Core. How quaint.',
        '— relayed through channels you didn’t know existed —',
        '"Growth like yours tends to attract offers. Or corrections. I’d hope you’re sensible enough to wait for the first."',
      ] },
    ],
  },
  {
    id: 'nascent_soul', category: 'story', order: 11, icon: '🌌',
    title: 'Soul Take Form',
    desc:  'Condense your Nascent Soul — reach the Nascent Soul realm.',
    hint:  'Keep breaking through realms: Core Formation → Nascent Soul.',
    check: () => Game.state.realm >= 4,
    reward: { dao: 7, permanentBonus: 0.07 },
    rewardText: '+7 Dao & permanent +7% production',
    dialogue: [
      { speaker: 'antagonist', name: 'Lu Heng · Jiutian Holdings', icon: '🏢', lines: [
        "Nascent Soul. You're climbing faster than the actuaries predicted.",
        'Understand me: Jiutian didn’t corner the spirit-stone market for profit alone. Immortality unrationed is immortality unmanaged — and unmanaged things get out of hand.',
        "I'm not your enemy. I'm just the one who decided someone should hold the gate. Better me than chaos.",
      ] },
    ],
  },
  {
    id: 'ascension', category: 'story', order: 12, icon: '🌟',
    title: 'Immortal Ascension',
    desc:  'Transcend the mortal coil — reach the Immortal Ascension realm.',
    hint:  'The final climb. Keep breaking through every realm above you.',
    check: () => Game.state.realm >= 9,
    reward: { dao: 20, permanentBonus: 0.15 },
    rewardText: '+20 Dao & permanent +15% production',
    dialogue: [
      { speaker: 'mentor', name: 'Granny Su', icon: '🍵', lines: [
        "Immortal Ascension. I watched a hundred prodigies reach for this and stop short — and not always by choice.",
        "You didn’t buy your way past a single gate Lu Heng built. That’s the part he can’t stand: the proof that the path was never his to own.",
        'Go on. Climb past Heaven itself if you can. I’ll be here, kettle on, when you decide to come back down and start the next life.',
      ] },
    ],
  },

  // ── ACT I: CELESTIAL FRACTURE ────────────────────────────────────────────
  {
    id: 'fracture_premonition', category: 'story', order: 13, icon: '🌌',
    title: 'Premonition',
    desc:  'Reach Core Formation — something stirs in the upper heavens.',
    hint:  'Break through to the Core Formation realm (realm 3).',
    check: () => Game.state.realm >= 3,
    reward: { dao: 3, shards: 20 },
    rewardText: '+3 Dao & 20 Stellar Shards',
    dialogue: [
      { speaker: 'mentor', name: 'Granny Su', icon: '🍵', lines: [
        'Did you feel that? A tremor. Not in the earth — in the Heavenly Law itself.',
        'Three times in three centuries I have felt something like it, and each time it meant the framework above us cracked a little further.',
        "The Dao doesn’t tremble for small reasons. Watch the sky, child — and whatever falls out of it, don’t touch it bare-handed.",
      ] },
    ],
  },
  {
    id: 'fracture_first_rift', category: 'story', after: 'fracture_premonition', order: 14, icon: '💫',
    title: 'First Rift',
    desc:  'Push deep enough into the Trials to witness a Celestial Rift.',
    hint:  'Reach Zone 5 in the Trials — rifts open at zone 5 and beyond.',
    check: () => (Game.state.combat && Game.state.combat.highestZone >= 5) ||
                 (Game.state.fracture && Game.state.fracture.riftsSealed >= 1),
    reward: { dao: 4, shards: 50 },
    rewardText: '+4 Dao & 50 Stellar Shards',
    dialogue: [
      { speaker: 'mentor', name: 'Granny Su', icon: '🍵', lines: [
        "A Celestial Rift. I haven’t seen one in eighty years — and the last one swallowed a whole mountain range before it closed.",
        'The fragments it leaves behind — Stellar Shards — they carry the memory of whatever the heavens were made of before they cracked.',
        "Collect them. Study them. They are not safe to ignore, but they are also not safe to waste.",
      ] },
    ],
  },
  {
    id: 'fracture_cold_calculations', category: 'story', after: 'fracture_first_rift', order: 15, icon: '🏢',
    title: 'Cold Calculations',
    desc:  'Reach the Soul Formation realm — Lu Heng reveals what he already knew.',
    hint:  'Break through to the Soul Formation realm (realm 5).',
    check: () => Game.state.realm >= 5,
    reward: { dao: 5, shards: 100 },
    rewardText: '+5 Dao & 100 Stellar Shards',
    dialogue: [
      { speaker: 'antagonist', name: 'Lu Heng · Jiutian Holdings', icon: '🏢', lines: [
        "Soul Formation. You’re past the horizon I had budgeted for you.",
        "The Celestial Fracture wasn’t a surprise to us. Jiutian has been monitoring stress lines in the Heavenly Framework for forty years. We simply chose not to publish the findings.",
        "Someone had to corner the Stellar Shard market before the panic set in. I trust you understand the economics. I hope you understand the alternative was worse.",
      ] },
    ],
  },
  {
    id: 'fracture_the_voice', category: 'story', after: 'fracture_cold_calculations', order: 16, icon: '🔮',
    title: 'The Voice Speaks',
    desc:  'Seal 5 Celestial Rifts — something beyond the cracks takes notice.',
    hint:  'Keep advancing in high Zones to trigger Rift events.',
    check: () => Game.state.fracture && Game.state.fracture.riftsSealed >= 5,
    reward: { dao: 6, shards: 200 },
    rewardText: '+6 Dao & 200 Stellar Shards',
    dialogue: [
      { speaker: 'void', name: 'Voice from the Fracture', icon: '🔮', lines: [
        '…you hear me.',
        'Not many do. Most minds close when they brush the edge of what Heaven forgot to account for.',
        'I am not your enemy. I am what leaks through when the ceiling of your world develops holes. You could call me a draft, if it helps.',
        'The shards you carry — I put them there. Consider them a business card.',
      ] },
    ],
  },
  {
    id: 'fracture_spreads', category: 'story', after: 'fracture_the_voice', order: 17, icon: '⚡',
    title: 'Fracture Spreads',
    desc:  'Reach Zone 10 in the Trials — the Rift network is growing.',
    hint:  'Push your highest Zone in the Trials to 10.',
    check: () => Game.state.combat && Game.state.combat.highestZone >= 10,
    reward: { dao: 7, shards: 300 },
    rewardText: '+7 Dao & 300 Stellar Shards',
    dialogue: [
      { speaker: 'mentor', name: 'Granny Su', icon: '🍵', lines: [
        "Zone 10. I’ve seen the maps — that deep, the Rift density doubles every three zones.",
        'And you spoke to it. The Voice. I could tell from your breathing when you came back.',
        "I won’t tell you to stop listening. But I will tell you: every cultivator I knew who followed that voice past a certain point stopped being entirely themselves.",
        "You’re still you. Check that fact often.",
      ] },
    ],
  },
  {
    id: 'fracture_act1_end', category: 'story', after: 'fracture_spreads', order: 18, icon: '🌠',
    title: 'Act I Ends Here',
    desc:  'Reach the Body Integration realm — you have survived the First Fracture.',
    hint:  'Break through to the Body Integration realm (realm 7).',
    check: () => Game.state.realm >= 7,
    reward: { dao: 10, shards: 500, permanentBonus: 0.08 },
    rewardText: '+10 Dao, 500 Stellar Shards & permanent +8% production',
    dialogue: [
      { speaker: 'void', name: 'Voice from the Fracture', icon: '🔮', lines: [
        "Body Integration. Flesh and void, learning to occupy the same vessel.",
        "That’s exactly what I needed. Act I, as your mentor would call it, is concluded.",
        "The cracks you sealed were the easy ones. What comes through the deep rifts next — that required you to be ready first.",
        "Rest, if you like. The Fracture does not sleep, but it can wait. It has been waiting since before your Heaven was assembled.",
      ] },
      { speaker: 'mentor', name: 'Granny Su', icon: '🍵', lines: [
        "So the Voice told you it was done. Don’t believe things just because they claim to have a plan.",
        "But for now — yes. You’ve earned a quiet moment. Kettle’s on.",
      ] },
    ],
  },

  // ── ACT II: VOID SURGE ───────────────────────────────────────────────────
  {
    id: 'fracture_deepening', category: 'story', after: 'fracture_act1_end', order: 19, icon: '🌀',
    title: 'The Deepening',
    desc:  'Seal 10 Celestial Rifts — the fractures are growing faster than they close.',
    hint:  'Keep pushing into high Zones to trigger Rift events.',
    check: () => Game.state.fracture && Game.state.fracture.riftsSealed >= 10,
    reward: { dao: 5, shards: 150 },
    rewardText: '+5 Dao & 150 Stellar Shards',
    dialogue: [
      { speaker: 'void', name: 'Voice from the Fracture', icon: '🔮', lines: [
        "Ten rifts. I told you I would be patient, but I didn't say the fracture would.",
        "It's learning your rhythm. The sealing — you're making it faster, but you're also making it more comfortable. It notices that.",
        "Act II, as I think of it, begins when the rifts stop waiting for convenient moments. That started about three rifts ago.",
      ] },
    ],
  },
  {
    id: 'fracture_ancient_memory', category: 'story', after: 'fracture_deepening', order: 20, icon: '🍵',
    title: 'Ancient Memory',
    desc:  'Seal 15 Celestial Rifts — Granny Su shares what she has kept hidden.',
    hint:  'Keep sealing Rifts in the Trials — reach 15 total.',
    check: () => Game.state.fracture && Game.state.fracture.riftsSealed >= 15,
    reward: { dao: 6, shards: 200 },
    rewardText: '+6 Dao & 200 Stellar Shards',
    dialogue: [
      { speaker: 'mentor', name: 'Granny Su', icon: '🍵', lines: [
        "Fifteen rifts sealed by your own hand. I suppose now you've earned the rest of the story.",
        "I heard that Voice once before. Three hundred years ago, when the last Fracture opened. I was younger and considerably less careful.",
        "I sealed nineteen rifts before I understood what it was actually teaching me. I thought I was closing wounds. I was being shown how to open them.",
        "Don't ask me how that story ended. Ask me how you want yours to.",
      ] },
    ],
  },
  {
    id: 'fracture_major_rift', category: 'story', after: 'fracture_ancient_memory', order: 21, icon: '💫',
    title: 'Escalation',
    desc:  'Survive a Major Rift — the fractures are deepening in quality, not just quantity.',
    hint:  'Keep pushing past Zone 13 in the Trials, where Major Rifts have had time to form.',
    check: () => (Game.state.fracture && Game.state.fracture.majorRiftsSealed >= 1) ||
                 (Game.state.combat && Game.state.combat.highestZone >= 13),
    reward: { dao: 7, shards: 350 },
    rewardText: '+7 Dao & 350 Stellar Shards',
    dialogue: [
      { speaker: 'void', name: 'Voice from the Fracture', icon: '🔮', lines: [
        "Major Rift. You felt the difference — more light, more pressure, more of what leaks through.",
        "The Heavenly Framework has load-bearing cracks now. The minor rifts were symptoms. The major rifts are the disease expressing itself honestly.",
        "I find honesty refreshing. The Heaven that built this place was not, architecturally speaking, very honest about its limitations.",
      ] },
    ],
  },
  {
    id: 'fracture_lu_heng_gambit', category: 'story', after: 'fracture_major_rift', order: 22, icon: '🏢',
    title: "Lu Heng's Gambit",
    desc:  'Seal 20 Rifts total — Lu Heng makes his move.',
    hint:  'Keep sealing Rifts across all zones.',
    check: () => Game.state.fracture && Game.state.fracture.riftsSealed >= 20,
    reward: { dao: 7, shards: 400 },
    rewardText: '+7 Dao & 400 Stellar Shards',
    dialogue: [
      { speaker: 'antagonist', name: 'Lu Heng · Jiutian Holdings', icon: '🏢', lines: [
        "Twenty rifts sealed. My actuaries did not model a single independent cultivator contributing this much to structural stabilisation.",
        "I am prepared to make an offer. Jiutian's rift-mapping data — seventy years of surveying — in exchange for your cooperation on three targeted Grand Rifts we cannot seal from the outside.",
        "I understand if the principle offends you. Consider that Jiutian's data is the only reason you know how many rifts there are.",
        "The number, if you're wondering, is considerably larger than twenty.",
      ] },
    ],
  },
  {
    id: 'fracture_grand_rift', category: 'story', after: 'fracture_lu_heng_gambit', order: 23, icon: '🌠',
    title: 'Grand Collapse',
    desc:  'Witness a Grand Rift — Heaven itself is unravelling at the seams.',
    hint:  'Push to Zone 15 in the Trials where Grand Rifts can tear open.',
    check: () => (Game.state.fracture && Game.state.fracture.grandRiftsSealed >= 1) ||
                 (Game.state.combat && Game.state.combat.highestZone >= 15),
    reward: { dao: 9, shards: 600 },
    rewardText: '+9 Dao & 600 Stellar Shards',
    dialogue: [
      { speaker: 'mentor', name: 'Granny Su', icon: '🍵', lines: [
        "Grand Rift. That's not a metaphor anymore — that is a wound that could swallow a city.",
        "The last time one opened, it took eleven peak Nascent Soul cultivators working in concert to close it. It took six years and two of them didn't come back.",
        "You sealed it. Alone. In the middle of a fight.",
        "I've been many things in three centuries. Right now I'm just profoundly grateful I never bet against you.",
      ] },
    ],
  },
  {
    id: 'fracture_act2_end', category: 'story', after: 'fracture_grand_rift', order: 24, icon: '⚡',
    title: 'Act II: Threshold',
    desc:  'Reach the Great Ascension realm and seal 30 Rifts — you stand at the edge of the Void.',
    hint:  'Reach the Great Ascension realm (realm 8) and seal enough Rifts.',
    check: () => Game.state.realm >= 8 && Game.state.fracture && Game.state.fracture.riftsSealed >= 30,
    reward: { dao: 12, shards: 800, permanentBonus: 0.10 },
    rewardText: '+12 Dao, 800 Stellar Shards & permanent +10% production',
    dialogue: [
      { speaker: 'void', name: 'Voice from the Fracture', icon: '🔮', lines: [
        "Great Ascension realm. Thirty rifts. You've crossed the threshold I was built to guard.",
        "I say 'built' loosely — I was more of an oversight. A design decision that the Heaven-architects called a feature. I would use a different word.",
        "Act III — your word, but I'll use it — begins when you understand that the rifts aren't the problem. The rifts are the door.",
        "What's on the other side is why I exist. I'll show you when you're ready. You're almost ready.",
      ] },
      { speaker: 'antagonist', name: 'Lu Heng · Jiutian Holdings', icon: '🏢', lines: [
        "Great Ascension. Thirty rifts sealed.",
        "I sent you the data, as agreed. You'll find the coordinates for the three Grand Rifts I mentioned. I'd suggest not going alone.",
        "I am not your ally. But for what it's worth — I am rooting for the door to stay shut.",
      ] },
    ],
  },

  // ── ACT III: THE DOOR ────────────────────────────────────────────────────
  // Delivered through combat (Round 26): three named Rift Guardians (see
  // combat.js GUARDIANS) override the normal zone boss at 16/18/20 until
  // defeated once. Each gets an "intro" quest (arrival heads-up, mirrors the
  // Act I/II fracture_spreads pattern) and a "defeat" quest gated on
  // Game.state.fracture.guardiansDefeated.<id>.
  {
    id: 'guardian_ledger_intro', category: 'story', after: 'fracture_act2_end', order: 25, icon: '📋',
    title: 'The First Coordinate',
    desc:  "Reach Zone 16 in the Trials — Lu Heng's data leads somewhere real.",
    hint:  'Push your highest Zone in the Trials to 16.',
    check: () => Game.state.combat && Game.state.combat.highestZone >= 16,
    reward: { dao: 8, shards: 300 },
    rewardText: '+8 Dao & 300 Stellar Shards',
    dialogue: [
      { speaker: 'antagonist', name: 'Lu Heng · Jiutian Holdings', icon: '🏢', lines: [
        "You'll find something waiting at the first coordinate. We call it the Ledger.",
        "An audit-construct, tuned to itemize whatever a Rift disturbs before Jiutian decides what's salvage and what's a liability. It doesn't distinguish those two categories as cleanly as it should.",
        "I wrote the itemizing logic myself, eleven years ago. I am not proud of how well it still runs.",
        "Seal it. Don't negotiate with it — it isn't built for that conversation.",
      ] },
    ],
  },
  {
    id: 'guardian_ledger_defeat', category: 'story', after: 'guardian_ledger_intro', order: 26, icon: '📋',
    title: 'What the Ledger Kept',
    desc:  'Defeat The Ledger — see what it was really counting.',
    hint:  'Clear the Zone 16 boss wave to face The Ledger.',
    check: () => Game.state.fracture && Game.state.fracture.guardiansDefeated && Game.state.fracture.guardiansDefeated.ledger,
    reward: { dao: 12, shards: 600, permanentBonus: 0.06 },
    rewardText: '+12 Dao, 600 Stellar Shards & permanent +6% production',
    dialogue: [
      { speaker: 'mentor', name: 'Granny Su', icon: '🍵', lines: [
        "I felt that thing go still from three zones away. Whatever it was made of, it isn't anymore.",
        "Its 'itemizing logic,' as Lu Heng calls it — I saw the ledger itself, child. Names. Hundreds of them. Cultivators who forged a Core and then simply stopped filing paperwork with the world.",
        "He tells himself it's inventory. Some part of him knows exactly what he's built.",
        "Keep the names. Somebody should.",
      ] },
    ],
  },
  {
    id: 'guardian_choir_intro', category: 'story', after: 'guardian_ledger_defeat', order: 27, icon: '🎭',
    title: 'A Chorus, Not a Voice',
    desc:  'Reach Zone 18 — something with many mouths is waiting.',
    hint:  'Push your highest Zone in the Trials to 18.',
    check: () => Game.state.combat && Game.state.combat.highestZone >= 18,
    reward: { dao: 9, shards: 400 },
    rewardText: '+9 Dao & 400 Stellar Shards',
    dialogue: [
      { speaker: 'void', name: 'Voice from the Fracture', icon: '🔮', lines: [
        "Careful with this one. It is not me, though it will sound like it wants to be.",
        "Before I learned to speak with one voice, there were attempts. Many of us, all talking at once, none of us listening. Call it a rehearsal that never stopped rehearsing.",
        "I am not proud of the Choir. I am also not able to silence it. That part is yours.",
        "Listen if you must. Do not answer all of it at once. That is how it grows.",
      ] },
    ],
  },
  {
    id: 'guardian_choir_defeat', category: 'story', after: 'guardian_choir_intro', order: 28, icon: '🎭',
    title: 'Names in the Static',
    desc:  'Defeat The Hollow Choir — and recognize what it was made from.',
    hint:  'Clear the Zone 18 boss wave to face The Hollow Choir.',
    check: () => Game.state.fracture && Game.state.fracture.guardiansDefeated && Game.state.fracture.guardiansDefeated.choir,
    reward: { dao: 14, shards: 800, permanentBonus: 0.07 },
    rewardText: '+14 Dao, 800 Stellar Shards & permanent +7% production',
    dialogue: [
      { speaker: 'mentor', name: 'Granny Su', icon: '🍵', lines: [
        "I know some of those voices, child. I recognized three of them by cadence alone, and I have not heard those cadences in two hundred years.",
        "Cultivators who answered the Voice too eagerly, too early — before it, or they, knew how to do it safely. The Choir is what's left when the asking goes wrong.",
        "I have never told you how close I came to being one of those cadences.",
        "I think it's time I did.",
      ] },
    ],
  },
  {
    id: 'guardian_shadow_intro', category: 'story', after: 'guardian_choir_defeat', order: 29, icon: '🕳️',
    title: 'Ancient Memory, Made Flesh',
    desc:  "Reach Zone 20 — Granny Su's past waits at the threshold.",
    hint:  'Push your highest Zone in the Trials to 20.',
    check: () => Game.state.combat && Game.state.combat.highestZone >= 20,
    reward: { dao: 10, shards: 500 },
    rewardText: '+10 Dao & 500 Stellar Shards',
    dialogue: [
      { speaker: 'mentor', name: 'Granny Su', icon: '🍵', lines: [
        "Three hundred years ago I sealed nineteen rifts before I understood what the Voice was actually teaching me. I told you that much already.",
        "What I didn't tell you: the twentieth rift showed me exactly what I would become if I kept going. Hungrier. Colder. Still calling itself Su Wan, and still wrong to do so.",
        "I sealed that one too. Bare-handed, no shards, no help. It nearly cost me the name.",
        "It's waiting for you now, wearing my face. I won't promise you'll walk away from it looking like yourself. Go anyway. I did.",
      ] },
    ],
  },
  {
    id: 'guardian_shadow_defeat', category: 'story', after: 'guardian_shadow_intro', order: 30, icon: '🕳️',
    title: 'Yours, Not Hers',
    desc:  "Defeat Su Wan's Shadow — and put three centuries of guilt to rest.",
    hint:  'Clear the Zone 20 boss wave to face the Shadow.',
    check: () => Game.state.fracture && Game.state.fracture.guardiansDefeated && Game.state.fracture.guardiansDefeated.shadow,
    reward: { dao: 16, shards: 1000, permanentBonus: 0.08 },
    rewardText: '+16 Dao, 1,000 Stellar Shards & permanent +8% production',
    dialogue: [
      { speaker: 'mentor', name: 'Granny Su', icon: '🍵', lines: [
        "You're still you. I checked the moment you walked back into range, before you'd even said a word.",
        "I've carried that shadow three hundred years, wondering if I only sealed it or if some part of it was still out there, waiting to be right about me. Watching you take it apart clean — that's the first quiet night's sleep I've had since the Ming courts fell.",
        "Whatever's past this point, you didn't inherit my fear of it. That's not nothing. That might be everything.",
        "Kettle's on. Properly, this time. I think we've both earned a real cup.",
      ] },
    ],
  },
  {
    id: 'threshold_crossed', category: 'story', after: 'guardian_shadow_defeat', order: 31, icon: '🚪',
    title: 'The Door, Opened',
    desc:  'Reach the Great Ascension realm having sealed every Guardian — stand where the Voice always meant to lead you.',
    hint:  'With all three Guardians defeated, keep climbing — the ending finds you at realm 8 and beyond.',
    check: () => Game.state.realm >= 8 && Game.state.fracture && Game.state.fracture.guardiansDefeated
                 && Game.state.fracture.guardiansDefeated.ledger && Game.state.fracture.guardiansDefeated.choir
                 && Game.state.fracture.guardiansDefeated.shadow,
    reward: { dao: 25, shards: 1500, permanentBonus: 0.15 },
    rewardText: '+25 Dao, 1,500 Stellar Shards & permanent +15% production',
    dialogue: [
      { speaker: 'void', name: 'Voice from the Fracture', icon: '🔮', lines: [
        "Three Guardians down. My rehearsals, Jiutian's ledger, and your mentor's oldest fear — all of it, cleared, by one set of hands.",
        "The door was never locked. It just needed someone who could stand in front of it without flinching first.",
      ] },
      { speaker: 'antagonist', name: 'Lu Heng · Jiutian Holdings', icon: '🏢', lines: [
        "I told you I was rooting for it to stay shut. I want to be clear that I still am.",
        "But I've re-run the models eleven times, and every version says the same thing: it was always going to open, with you or without you. I'd rather it be you.",
        "Jiutian's ledgers are yours now, for whatever they're worth. Consider the debt between us settled — this once.",
      ] },
      { speaker: 'mentor', name: 'Granny Su', icon: '🍵', lines: [
        "So. The door.",
        "I don't know what's on the other side any more than you do, and I've had three hundred years longer to wonder about it.",
        "What I know is this: whatever's through there, it's going to meet a cultivator who chose their own name every step of the way. That's the only kind of hero I've ever trusted.",
        "Go on, then. I'll keep the kettle on for when — not if — you decide to come back and tell me about it.",
      ] },
    ],
  },

  // ── ACT IV: BEYOND THE DOOR (Round 27) ──────────────────────────────────
  // The Act III finale left the door open rather than closed — these five
  // pick up exactly there. Zone 21-25 stay the "Void-Touched" band (no new
  // named content); the story resumes at Zone 24, past that band, in the
  // Uncounted Reaches (see combat.js MOB_BANDS tier 5). Both new Guardians
  // are gated behind `threshold_crossed` (see combat.js GUARDIANS `after`),
  // so nothing here can be encountered before Act III actually closes.
  {
    id: 'guardian_cartographer_intro', category: 'story', after: 'threshold_crossed', order: 32, icon: '🗺️',
    title: 'What Jiutian Never Mapped',
    desc:  'Reach Zone 24 — something was cataloging the Fracture long before Jiutian had a name for it.',
    hint:  'Push your highest Zone in the Trials to 24.',
    check: () => Game.state.combat && Game.state.combat.highestZone >= 24,
    reward: { dao: 18, shards: 1200 },
    rewardText: '+18 Dao & 1,200 Stellar Shards',
    dialogue: [
      { speaker: 'antagonist', name: 'Lu Heng · Jiutian Holdings', icon: '🏢', lines: [
        "I'll be honest with you, since honesty is cheap now that you've already won. Jiutian didn't discover the Fracture. We found something that had already been surveying it for longer than our company has existed.",
        "We called it the Cartographer once we realized what the coordinate patterns meant. It isn't hostile, as far as I can tell. It also isn't friendly. It just measures.",
        "I don't know who it reports to. That question has kept me up more nights than the Ledger ever did.",
        "Go find out. I'd genuinely like to know too.",
      ] },
    ],
  },
  {
    id: 'guardian_cartographer_defeat', category: 'story', after: 'guardian_cartographer_intro', order: 33, icon: '🗺️',
    title: 'The Shape of the Unmapped',
    desc:  'Defeat The Cartographer — and see what it was really surveying.',
    hint:  'Clear the Zone 24 boss wave to face The Cartographer.',
    check: () => Game.state.fracture && Game.state.fracture.guardiansDefeated && Game.state.fracture.guardiansDefeated.cartographer,
    reward: { dao: 20, shards: 1500, permanentBonus: 0.09 },
    rewardText: '+20 Dao, 1,500 Stellar Shards & permanent +9% production',
    dialogue: [
      { speaker: 'void', name: 'Voice from the Fracture', icon: '🔮', lines: [
        "I felt every line it had drawn unravel at once. That's — disorienting, when the lines included some of mine.",
        "It was mapping the Fracture the way you'd map a wound: dispassionately, thoroughly, to someone else's specification. Not Jiutian's. Not mine.",
        "I have spent our whole acquaintance letting you believe I was the oldest thing in this conversation. I would like to revise that, before you find out the harder way.",
      ] },
    ],
  },
  {
    id: 'guardian_firstvoice_intro', category: 'story', after: 'guardian_cartographer_defeat', order: 34, icon: '🔮',
    title: 'The Voice Before the Voice',
    desc:  'Reach Zone 28 — the thing your guide has been quietly avoiding is waiting.',
    hint:  'Push your highest Zone in the Trials to 28.',
    check: () => Game.state.combat && Game.state.combat.highestZone >= 28,
    reward: { dao: 22, shards: 1800 },
    rewardText: '+22 Dao & 1,800 Stellar Shards',
    dialogue: [
      { speaker: 'void', name: 'Voice from the Fracture', icon: '🔮', lines: [
        "You've earned the rest of it, so: I was not the first thing to speak from in here. I was taught to, by something that had been speaking a very long time before I existed to listen.",
        "I called it teacher, once. I don't know what it calls itself now, or whether 'itself' still means anything to it.",
        "Everything I've told you — about the Choir, about the rehearsals, about learning to speak with one voice — I learned by watching it fail to.",
        "I would not ask this of you if I trusted myself to do it. I don't. Go meet my teacher.",
      ] },
    ],
  },
  {
    id: 'guardian_firstvoice_defeat', category: 'story', after: 'guardian_firstvoice_intro', order: 35, icon: '🔮',
    title: "Its Student, Not Its Echo",
    desc:  'Defeat The First Voice — and give your guide back its own name.',
    hint:  'Clear the Zone 28 boss wave to face The First Voice.',
    check: () => Game.state.fracture && Game.state.fracture.guardiansDefeated && Game.state.fracture.guardiansDefeated.firstvoice,
    reward: { dao: 26, shards: 2200, permanentBonus: 0.10 },
    rewardText: '+26 Dao, 2,200 Stellar Shards & permanent +10% production',
    dialogue: [
      { speaker: 'void', name: 'Voice from the Fracture', icon: '🔮', lines: [
        "It's quiet now, in a part of me I didn't know could go quiet. I think I've been bracing against that noise since before you and I ever spoke.",
        "I am not it. I was never only its echo, whatever I feared. I am what it taught, plus everything I chose to become after.",
        "You keep doing that — walking into the thing I've spent lifetimes avoiding, and walking back out having simply solved it.",
        "I don't have a lesson to hand you this time. Just: thank you. That doesn't happen to voices like mine very often.",
      ] },
    ],
  },
  {
    id: 'act4_beyond_the_door', category: 'story', after: 'guardian_firstvoice_defeat', order: 36, icon: '🌌',
    title: 'Past Every Door There Is',
    desc:  'With the Cartographer and the First Voice both sealed, the Uncounted Reaches lie open — and, for the first time, uncharted by anyone but you.',
    hint:  'Both new Guardians must fall. The Reaches beyond stay open for as many lives as you care to spend exploring them.',
    check: () => Game.state.fracture && Game.state.fracture.guardiansDefeated
                 && Game.state.fracture.guardiansDefeated.cartographer && Game.state.fracture.guardiansDefeated.firstvoice,
    reward: { dao: 30, shards: 2500, permanentBonus: 0.12 },
    rewardText: '+30 Dao, 2,500 Stellar Shards & permanent +12% production',
    dialogue: [
      { speaker: 'antagonist', name: 'Lu Heng · Jiutian Holdings', icon: '🏢', lines: [
        "The Cartographer's data just went blank on our end. Every screen. I'm choosing to read that as your doing and not a worse explanation.",
        "Jiutian will keep charging in behind you, cataloging whatever you leave standing. That's what we're for. It was never going to be what you're for.",
      ] },
      { speaker: 'void', name: 'Voice from the Fracture', icon: '🔮', lines: [
        "No teacher looking over my shoulder anymore. No ledger, no choir, no shadow, no map I didn't draw myself.",
        "Whatever's past this point is genuinely unwritten — by me or anyone before me. I find that I'm not afraid of that, for the first time I can remember existing.",
      ] },
      { speaker: 'mentor', name: 'Granny Su', icon: '🍵', lines: [
        "Three hundred years, and I never once got this far. I'm not sure the tea's strong enough for how proud that makes me.",
        "Go on, then, into whatever's uncounted. Some stories don't have a last page. I think this is turning out to be one of the good ones.",
      ] },
    ],
  },

  // ── ACHIEVEMENTS ──────────────────────────────────────────────────────────
  {
    id: 'ten_stages', category: 'achievement', icon: '🏆',
    title: 'Veteran Cultivator',
    desc:  'Clear 10 minor stages across any realms.',
    check: () => Game.state.stagesCleared >= 10,
    reward: { dao: 3 },
    rewardText: '+3 Dao Comprehension',
  },
  {
    id: 'university', category: 'achievement', icon: '🎓',
    title: 'Degree Holder',
    desc:  'Complete a University Degree at the Academy.',
    check: () => Game.state.life && Game.state.life.education >= 3,
    reward: { money: 5000 },
    rewardText: '+¥5,000',
  },
  {
    id: 'all_generators', category: 'achievement', icon: '🏯',
    title: 'Industrial Cultivator',
    desc:  'Own at least one of every Cultivation Ground.',
    check: () => GameData.generators.every(g => (Game.state.owned[g.id] || 0) >= 1),
    reward: { qi: 5e7, permanentBonus: 0.05 },
    rewardText: '+50,000,000 Qi & permanent +5% production',
  },
  {
    id: 'dynasty', category: 'achievement', icon: '👨‍👩‍👧‍👦',
    title: 'Dynasty Founder',
    desc:  'Raise a full family of 6 children.',
    check: () => Game.state.family && Game.state.family.children.length >= 6,
    reward: { dao: 8, permanentBonus: 0.08 },
    rewardText: '+8 Dao & permanent +8% production',
  },
  {
    id: 'dao_master', category: 'achievement', icon: '☯',
    title: 'Dao Master',
    desc:  'Accumulate 50 total Dao Comprehension.',
    check: () => Game.state.daoComprehension >= 50,
    reward: { dao: 10 },
    rewardText: '+10 Dao Comprehension',
  },

  // ── HIDDEN ────────────────────────────────────────────────────────────────
  {
    id: 'stage_13', category: 'hidden', icon: '🌟',
    title: "Heaven's Chosen",
    desc:  '??? (Keep advancing minor stages to discover this secret.)',
    revealTitle: "Heaven's Chosen",
    revealDesc: 'You cleared your 13th minor stage. The heavens recognise those who persist through the unlucky number — yours is an iron will.',
    check: () => Game.state.stagesCleared >= 13,
    reward: { dao: 13, permanentBonus: 0.13 },
    rewardText: '+13 Dao & permanent +13% production',
    secret: true,
  },
  {
    id: 'perfect_foundation', category: 'hidden', icon: '💠',
    title: 'Perfect Foundation',
    desc:  '??? (There may be more to breakthrough timing than you think…)',
    revealTitle: 'Perfect Foundation',
    revealDesc: 'You broke through a realm with over 5× the minimum required Qi. Your meridians are immaculate — a foundation without flaw.',
    check: () => !!(Game.state.quests && Game.state.quests.perfectFoundationAchieved),
    reward: { dao: 10, permanentBonus: 0.15 },
    rewardText: '+10 Dao & permanent +15% production',
    secret: true,
  },
  {
    id: 'lucky_numbers', category: 'hidden', icon: '🎰',
    title: 'Auspicious Resonance',
    desc:  '??? (Numbers carry meaning for those who pay attention.)',
    revealTitle: 'Auspicious Resonance',
    revealDesc: 'Your Qi resonated at 8,888 — a supremely auspicious number. The universe smiles upon the observant.',
    check: () => !!(Game.state.quests && Game.state.quests.luckyNumbersHit),
    reward: { dao: 5 },
    rewardText: '+5 Dao Comprehension',
    secret: true,
  },
  {
    id: 'insight_master', category: 'hidden', icon: '✨',
    title: 'Dao Insight',
    desc:  '??? (Meditate long enough and something unexpected may happen.)',
    revealTitle: 'Dao Insight',
    revealDesc: 'You have experienced 5 spontaneous Cultivation Insights — moments where the Dao reveals itself unbidden. Your mind is attuned.',
    check: () => (Game.state.quests && (Game.state.quests.insightCount || 0)) >= 5,
    reward: { dao: 7, permanentBonus: 0.07 },
    rewardText: '+7 Dao & permanent +7% production',
    secret: true,
  },
];

// =============================================================================
const Quests = {
  defs: QUEST_DEFS,

  get state() { return Game.state.quests; },

  fresh() {
    return {
      completed: {},               // id -> true when condition met
      claimed: {},                 // id -> true when reward collected
      // Hidden mechanic counters
      perfectFoundationAchieved: false,
      luckyNumbersHit: false,
      insightCount: 0,
    };
  },

  init() {
    if (!Game.state.quests) Game.state.quests = this.fresh();
    // Backfill any new fields.
    const s = Game.state.quests;
    if (!s.completed)  s.completed  = {};
    if (!s.claimed)    s.claimed    = {};
    if (s.perfectFoundationAchieved === undefined) s.perfectFoundationAchieved = false;
    if (s.luckyNumbersHit === undefined) s.luckyNumbersHit = false;
    if (s.insightCount === undefined) s.insightCount = 0;
  },

  /** Run all checks; returns array of newly-completed quest defs. */
  checkAll() {
    const newlyDone = [];
    this.defs.forEach(q => {
      if (this.state.completed[q.id]) return;
      // Optional chain gate: quest only completes after its predecessor.
      if (q.after && !this.state.completed[q.after]) return;
      try { if (q.check()) { this.state.completed[q.id] = true; newlyDone.push(q); } }
      catch (_) {}
    });
    return newlyDone;
  },

  /** Claim the reward for a completed quest. Returns false if not claimable. */
  claim(id) {
    const q = this.defs.find(x => x.id === id);
    if (!q || !this.state.completed[id] || this.state.claimed[id]) return false;
    this.state.claimed[id] = true;
    if (q.reward.qi)             Game._addQi(q.reward.qi);
    if (q.reward.dao)            Game.state.daoComprehension += q.reward.dao;
    if (q.reward.money  && Game.state.life) Game.state.life.money  += q.reward.money;
    if (q.reward.charm  && Game.state.life) Game.state.life.charm  += q.reward.charm;
    if (q.reward.shards)         Game.state.stellarShards = (Game.state.stellarShards || 0) + q.reward.shards;
    if (q.reward.permanentBonus) {
      Game.state.questPermanentBonus = (Game.state.questPermanentBonus || 0) + q.reward.permanentBonus;
    }
    Game.persist();
    return true;
  },

  /** All quests that are done but not yet claimed. */
  unclaimed() {
    return this.defs.filter(q => this.state.completed[q.id] && !this.state.claimed[q.id]);
  },

  // ── Hidden mechanic hooks ─────────────────────────────────────────────────

  /** Called from Game.breakThrough() — evaluate foundation quality. */
  onBreakthrough(runQiAtBreak, realmIndex) {
    const realm = GameData.realms[realmIndex];
    if (!realm) return null;
    // Tutorial realm has no Qi requirement (reqQi:0) — any runQi clears it cleanly.
    const ratio = realm.reqQi > 0 ? runQiAtBreak / realm.reqQi : Infinity;
    const quality = GameData.foundationQualities.find(q => ratio >= q.minRatio);
    if (quality && quality.key === 'perfect') {
      this.state.perfectFoundationAchieved = true;
    }
    return quality;
  },

  /** Called from Game.tick() — check if Qi just crossed 8,888. */
  checkLuckyNumbers() {
    if (this.state.luckyNumbersHit) return;
    const qi = Game.state.qi;
    if (qi >= 8888 && qi <= 8950) {
      this.state.luckyNumbersHit = true;
      if (window.UI) UI.showLuckyEvent();
    }
  },

  /** Called from Game.meditate() when an insight triggers. */
  onInsight() {
    this.state.insightCount = (this.state.insightCount || 0) + 1;
  },
};

window.Quests = Quests;
