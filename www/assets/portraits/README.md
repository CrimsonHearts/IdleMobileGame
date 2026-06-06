# Character portraits (drop-in painted art)

Place painted character images here and the game uses them automatically.
If a file is missing, the built-in vector portrait is shown instead — so the
game always works, and adding art is a pure drag-and-drop upgrade.

## File naming

`<gender>-<rootKey>.jpg`

| Spiritual Root | element  | female file          | male file          |
|----------------|----------|----------------------|--------------------|
| Mortal         | Azure    | `female-mortal.jpg`  | `male-mortal.jpg`  |
| True           | Verdant  | `female-true.jpg`    | `male-true.jpg`    |
| Heavenly       | Lunar    | `female-heaven.jpg`  | `male-heaven.jpg`  |
| Saint          | Radiant  | `female-saint.jpg`   | `male-saint.jpg`   |
| Chaos          | Phoenix  | `female-chaos.jpg`   | `male-chaos.jpg`   |

## Image guidance
- Recommended size: **768×1024** (3:4) or **1024×1024**.
- The face should sit in the **upper-center** — slots crop to a circle from the
  top (`object-position: center top`).
- `.jpg` keeps file size small for mobile. (To use PNG, change the extension in
  `GameData.portraitSrc` in `js/game.js`.)

See **`docs/CHARACTER-ART.md`** for generation prompts that match the desired
painted xianxia style.
