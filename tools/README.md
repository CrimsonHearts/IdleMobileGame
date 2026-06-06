# Character art generator — `gen-portraits.mjs`

Generates painted xianxia portraits for every gender × Spiritual Root and saves
them to `www/assets/portraits/<gender>-<root>.jpg` (10 images). The game loads
them automatically; vector art is the fallback until they exist.

No API keys live in the repo — they're read from your environment.
For the overall local workflow (running the game, Docker), see
**[../docs/LOCAL-SETUP.md](../docs/LOCAL-SETUP.md)**.

> **Run ComfyUI natively, not in Docker** — Docker can't use the Mac's GPU, so a
> containerized ComfyUI would be CPU-only and very slow. The game container
> reaches your native ComfyUI via `host.docker.internal:8188`.

---

## Option A — Local (your MacBook Pro M4, free & private) ⭐ recommended

Uses **ComfyUI**'s built-in API. 24 GB unified memory runs SDXL comfortably.

1. **Install ComfyUI**
   ```bash
   git clone https://github.com/comfyanonymous/ComfyUI && cd ComfyUI
   python3 -m venv venv && source venv/bin/activate
   pip install -r requirements.txt
   ```
2. **Get a model** for the painted xianxia look — download a checkpoint from
   [Civitai](https://civitai.com) (search **“guofeng”**, **“xianxia”**, or
   **“Animagine XL”**) and drop the `.safetensors` into
   `ComfyUI/models/checkpoints/`.
3. **Run ComfyUI** (Apple Silicon):
   ```bash
   python main.py
   ```
   It serves the API at `http://127.0.0.1:8188`.
4. **Generate** (from this repo, in another terminal):
   ```bash
   node tools/gen-portraits.mjs --list        # auto-detects your installed models
   node tools/gen-portraits.mjs               # all 10 (auto-picks a checkpoint)
   # …or from the game container instead of natively:
   docker compose run --rm game node tools/gen-portraits.mjs --gender=female
   ```
   Use `--only=female-chaos,female-saint` for specific ones, `--gender=female`
   for one gender, or `--ckpt="YourCheckpoint.safetensors"` to choose the model.

> Prefer a GUI? **Draw Things** (free Mac App Store app) is the easiest way to
> generate these by hand — then just save them with the right filenames into
> `www/assets/portraits/`. ComfyUI is the option this script automates.

## Option B — Leonardo.Ai (cloud, uses your key)

```bash
export LEONARDO_API_KEY=sk-...          # never commit this
node tools/gen-portraits.mjs --backend=leonardo
# optional: export LEONARDO_MODEL=<modelId>   (pick an anime/guofeng SDXL model)
```

> **Kling** is a video API — not used here. Use your **Leonardo** key.

---

## After generating
Reload the game. The avatar, Meditate button, and character-creation screen now
show the painted lead matching that character's Spiritual Root (Azure / Verdant /
Lunar / Radiant / Phoenix). Commit the images to keep them.

Prompts live in `gen-portraits.mjs` (and `docs/CHARACTER-ART.md`) — tweak freely.
