# Trials mob art (drop-in painted art)

Painted art for the 22 **regular** Trials mobs and bosses. The 5 named Rift
Guardians live in `../guardians/` instead. If a file here is missing, the
combat stage shows that mob's emoji icon — so the game always works and
adding art is a pure drag-and-drop upgrade.

## File naming

`<key>.jpg`, where `<key>` is the mob's `icon` id in `www/js/combat.js`
minus its `ic-mob-` prefix:

| combat.js icon | file |
|---|---|
| `ic-mob-wolf` | `wolf.jpg` |
| `ic-mob-wraith` | `wraith.jpg` |
| `ic-mob-enforcer` | `enforcer.jpg` |
| …and so on | |

Full list (22): wolf, ghoul, scorpion, bat, demon, hound, wraith, voidling,
corrupted, warden, sentinel, colossus, enforcer, reaver, abomination, wisp,
sovereign, echo, remnant, cartograph, surveyor, uncounted.

Several mobs deliberately share an icon (e.g. both "Demon General" and
"Ghost King" use `ic-mob-demon`), so 22 files cover all 27 roster entries.

## Generate them

```bash
node tools/gen-mobs.mjs --list           # see your ComfyUI models
node tools/gen-mobs.mjs                  # all 22
node tools/gen-mobs.mjs --only=wolf,wraith
```

## Image guidance
- These render at only **46–58px** in the combat stage, cropped to a circle
  from the top — so the generator defaults to **768×768 square**, not the
  832×1216 used for character portraits. Detail beyond that is discarded by
  the crop. Override with `--size=N` if you want larger source files.
- Keep the subject **centered** with a plain dark background; corners are
  cropped away.
- `.jpg` keeps the APK small — 22 files at portrait resolution would add
  ~30MB to the bundle, which is why square/smaller is the default here.

Prompts live in `tools/gen-mobs.mjs` — tweak freely.
