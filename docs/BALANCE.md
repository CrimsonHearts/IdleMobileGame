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
| Foundation | ~28 min |
| Core Formation | ~50 min |
| Nascent Soul | ~1.3 h |
| Soul Formation | ~2 h |
| Void Refinement | ~8 h |
| Body Integration+ | days (not reached in a 48 h sim) |

A best/rarer root and the deep multiplier stack make this faster; the upper
realms are intentionally gated for long-term + offline + generational play.

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
