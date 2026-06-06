# 🎨 Painted Character Art — generation guide

The desired look (your reference) is **semi-realistic xianxia CG splash art**
(Genshin / Chinese-MMO style). That can't be hand-drawn in code — generate it
with an image model, then drop the files into `www/assets/portraits/` using the
names below and the game wires them in automatically (vector art is the
fallback until then).

> Don't copy the watermarked reference images directly (they're artists' work).
> The prompts below produce **original** art in the same style.

## Recommended: generate locally with ComfyUI ⭐
Run the bundled generator against your **local ComfyUI** (GPU) — it writes the
files straight into `www/assets/portraits/` with the right names:
```bash
node tools/gen-portraits.mjs --list     # see your models
node tools/gen-portraits.mjs            # generate all 10
```
Use a **guofeng / xianxia** or **Animagine XL** SDXL checkpoint for this style.
Setup steps: **[../docs/LOCAL-SETUP.md](LOCAL-SETUP.md)** and **[../tools/README.md](../tools/README.md)**.

The prompts below are what the script uses — tweak them in `tools/gen-portraits.mjs`,
or paste into any other tool (NijiJourney / Midjourney / SDXL) if you prefer.

## File names → see `www/assets/portraits/README.md`
`female-<root>.jpg` / `male-<root>.jpg` for roots: mortal, true, heaven, saint, chaos.
Target **768×1024 (3:4)**, face in the upper-center.

---

## Shared style block (append to every prompt)
```
semi-realistic anime CG painting, Chinese xianxia / guofeng splash art,
beautiful detailed face, large luminous eyes, flowing silk hanfu, intricate gold
filigree hairpins, long flowing hair, soft cinematic lighting, glowing spirit
particles, ethereal, elegant graceful pose, highly detailed, masterpiece, 8k
--ar 3:4 --style raw
```
**Negative (SDXL):** `text, watermark, signature, lowres, blurry, extra fingers, deformed hands, bad anatomy, modern clothes`

---

## Female leads (one per Spiritual Root)

**Azure — `female-mortal.jpg`**
```
serene young immortal woman in simple flowing teal-blue hanfu, calm gentle
expression, pale azure background, soft mist, modest elegant
```

**Verdant — `female-true.jpg`**
```
immortal woman in emerald-green silk hanfu, white lily flowers, a white
nine-tailed fox spirit curling around her, lush jade-green tones, springtime glow
```

**Lunar — `female-heaven.jpg`**
```
immortal woman in translucent sapphire-blue gossamer robes seated gracefully,
huge full moon behind her, willow branches, glowing blue butterflies, moonlit night
```

**Radiant — `female-saint.jpg`**
```
regal immortal swordswoman in white-and-silver robes with gold trim, holding an
elegant slender longsword, golden phoenix crown, jade and ice crystals, holy mist, divine
```

**Phoenix — `female-chaos.jpg`**
```
powerful immortal woman in crimson-and-orange phoenix-feather gown, a phoenix of
living fire soaring behind her, embers and sparks, warm pink background, fierce beauty
```

## Male leads (same roots, handsome young male cultivator)
Swap the subject for: `handsome young male cultivator, men's hanfu robes,
long hair in a topknot with a jade crown, refined heroic face` and keep the
element styling (e.g. **Phoenix male** = red/black robes with a fire phoenix).
Save as `male-<root>.jpg`.

---

## After generating
1. Export each at 768×1024, name it exactly (e.g. `female-chaos.jpg`).
2. Copy into `www/assets/portraits/`.
3. Reload — the avatar, Meditate button and creation screen now show the
   painted lead matching that character's Spiritual Root. No code changes needed.
