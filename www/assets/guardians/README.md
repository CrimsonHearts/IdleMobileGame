# Rift Guardian art (drop-in painted art)

Place painted Guardian portraits here and the game uses them automatically in
Trials. If a file is missing, the built-in emoji icon (the same one every
other Trials mob uses) is shown instead — so the game always works, and
adding art is a pure drag-and-drop upgrade.

## File naming

`<guardianId>.jpg`, matching the `id` field in `www/js/combat.js`'s
`GUARDIANS` array:

| Guardian | id | file |
|---|---|---|
| The Ledger 📋 | `ledger` | `ledger.jpg` |
| The Hollow Choir 🎭 | `choir` | `choir.jpg` |
| Su Wan's Shadow 🕳️ | `shadow` | `shadow.jpg` |
| The Cartographer 🗺️ | `cartographer` | `cartographer.jpg` |
| The First Voice 🔮 | `firstvoice` | `firstvoice.jpg` |

## Generate them

```bash
node tools/gen-guardians.mjs --list     # see your ComfyUI models
node tools/gen-guardians.mjs            # generate all 5
node tools/gen-guardians.mjs --only=shadow,firstvoice
```

Same two backends as the character portraits (see `docs/CHARACTER-ART.md` and
`tools/README.md` for full setup):
- **Local ComfyUI** (free, private, needs a GPU) — the default.
- **Leonardo.Ai** (cloud) — `LEONARDO_API_KEY=... node tools/gen-guardians.mjs --backend=leonardo`.

## Image guidance
- Recommended size: **768×1024 to 832×1216** (3:4-ish portrait).
- The game crops to a circle from the top (`object-position: center top`), so
  keep the Guardian's face/focal point in the **upper-center**.
- `.jpg` keeps file size small for mobile.

Prompts (one per Guardian, matching their established lore from the Act
III/IV quest chain) live in `tools/gen-guardians.mjs` — tweak freely.
