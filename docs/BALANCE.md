# ⚖️ Balance Notes

Measured with the headless full-loop simulator (a perfectly-greedy player; real
players are slower). Re-run anytime from `/tmp` style harnesses.

## Realm pacing (worst Spiritual Root, optimal play)
Progressive realm requirements (`gameData.realms[].reqQi`) use a **growing
ratio** — ×400 early ramping to ×1300 — so onboarding stays fast while the top
becomes a multi-day wall:

| Realm | Reached (sim) |
|-------|---------------|
| Qi Condensation | ~2 min |
| Foundation | ~17 min |
| Core Formation | ~32 min |
| Nascent Soul | ~52 min |
| Soul Formation | ~1.4 h |
| Void Refinement | ~5.5 h |
| Body Integration+ | days (not reached in a 48 h sim — stalls at Void Refinement stage 2/4) |

A best/rarer root and the deep multiplier stack make this faster; the upper
realms are intentionally gated for long-term + offline + generational play.

### Income/pill pass (2026-06-28)
Players reported Work pay, Qi generators, and Breakthrough Pill cost all felt
stingy in real (non-bot) play, even though the bot-optimal sim above showed
pills were never actually a blocking wall — the gap was a "bot vs. real
player" experience problem, not a literal pacing wall. Three independent
levers were nudged to soften the early/mid grind without touching the
late-game wall or the realm `reqQi` curve above:
- `generators[].baseProd` × 1.5 (all 10 generators).
- `life.js` `JOBS[].pay` × 2 (all 5 jobs).
- `realms[].pillCost` × 0.55 (~45% cheaper) for Foundation through Immortal
  Ascension; `reqQi` thresholds are untouched.

Re-running the 48 h sim after the change confirms Body Integration (reqQi
3.1e19) is still unreached — the bot-optimal player stalls at Void
Refinement stage 2/4 for the remaining ~43 simulated hours, so the back half
of the ladder is still a multi-day wall. Only the front half sped up.

## Multiplier stack (no double-counting)
Production = `generators × allMult × (root × stage × dao × sect × pet × talent ×
family × legacy)`. `allMult` folds in upgrades, meridians, heavenly perks,
reincarnation, **artifact Qi% + karma Qi**, and timed buffs.
`Game.globalMult()` must always equal the product of the named vectors.

Dominant levers (by design): **dao** (prestige), **talent** (study), **legacy**
(generations). Combat power = base(realm,stages) + pets + **artifact ATK/HP**,
all × sect × meridian × perk × **Dao-path/trait/karma/artifact-set** multipliers.

## Invariants (guarded by the balance regression test)
1. Realm reqs strictly increasing; ratios non-decreasing (progressive).
2. `globalMult()` == product of the 8 named vectors (catches double-counting).
3. All multipliers stay **finite** and no single named factor exceeds 1e6 even
   at a maxed Chaos-root, realm-9, fully-equipped state.

## Tuning knobs (in `gameData.js`)
- Slow/steepen the top → raise the upper `realms[].reqQi`.
- Prestige strength → `daoGainFor` exponent (0.22) / `daoBonusPerPoint` (0.02).
- Tribulation difficulty → `tribulation.baseChance` / pill `realms[].pillCost`.
- Money sink depth → `market.realmScale`, good `base` prices.
