#!/usr/bin/env node
/* ===========================================================================
 * gen-portraits.mjs — End-to-end painted character art generator.
 *
 * Generates xianxia splash-art portraits for every gender × spiritual root and
 * saves them to www/assets/portraits/<gender>-<root>.jpg, which the game loads
 * automatically (vector art is the fallback until the files exist).
 *
 * Backends:
 *   • Local ComfyUI (recommended) — needs ComfyUI running (COMFY_URL, :8188).
 *       Auto-detects your installed checkpoint; override with --ckpt=Name.
 *   • Leonardo.Ai (cloud)         — needs LEONARDO_API_KEY.
 *
 * Examples:
 *   node tools/gen-portraits.mjs --list                      # show ComfyUI models
 *   node tools/gen-portraits.mjs                             # all 10, auto model
 *   node tools/gen-portraits.mjs --only=female-chaos         # just one
 *   node tools/gen-portraits.mjs --gender=female             # female leads only
 *   node tools/gen-portraits.mjs --ckpt="animagineXL.safetensors"
 *   LEONARDO_API_KEY=xxx node tools/gen-portraits.mjs --backend=leonardo
 * No API keys are stored in the repo — they are read from the environment.
 * ========================================================================= */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../www/assets/portraits');
fs.mkdirSync(OUT_DIR, { recursive: true });

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true];
}));
const BACKEND = args.backend || (process.env.LEONARDO_API_KEY && !args.list ? 'leonardo' : 'comfy');
const ONLY = args.only ? String(args.only).split(',') : null;
const GENDER = args.gender ? [args.gender] : ['female', 'male'];
const STEPS = parseInt(args.steps || '35', 10);
const CFG = parseFloat(args.cfg || '7.5');
const W = 832, H = 1216; // SDXL portrait; the game crops to a circle
const COMFY = process.env.COMFY_URL || 'http://127.0.0.1:8188';
// LoRAs applied to every generation (weight can be overridden with --lora-weight)
const LORA_WEIGHT = parseFloat(args['lora-weight'] || '0.75');
const LORAS = [
  { name: 'girl_20.safetensors',      weight: LORA_WEIGHT },       // guofeng v4 style
  { name: 'Xianxia_Style.safetensors', weight: LORA_WEIGHT * 0.8 }, // xianxia art overlay
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

// -- Prompts ----------------------------------------------------------------
const STYLE = 'semi-realistic anime CG painting, Chinese xianxia guofeng splash art, ' +
  'exquisitely detailed face, large luminous eyes, flowing silk hanfu, intricate gold ' +
  'filigree hairpins, long flowing hair, soft cinematic lighting, glowing spirit particles, ' +
  'ethereal, elegant graceful pose, highly detailed, masterpiece, best quality, 8k';
const NEG = 'text, watermark, signature, logo, lowres, blurry, jpeg artifacts, extra fingers, ' +
  'deformed hands, bad anatomy, modern clothes, nsfw, ugly, distorted';
const ELEMENTS = {
  mortal: { female: 'simple flowing teal-blue hanfu, calm gentle expression, pale azure background, soft mist',
            male:   'simple teal-blue hanfu robes, calm composed expression, pale azure background, soft mist' },
  true:   { female: 'emerald-green silk hanfu, white lily flowers, a white nine-tailed fox spirit curling around her, lush jade-green tones',
            male:   'emerald-green hanfu robes, bamboo grove, a white fox spirit nearby, lush jade-green tones' },
  heaven: { female: 'translucent sapphire-blue gossamer robes, huge full moon behind, willow branches, glowing blue butterflies, moonlit night',
            male:   'midnight-blue flowing robes, huge full moon behind, willow branches, glowing butterflies, moonlit night' },
  saint:  { female: 'white-and-silver robes with gold trim, holding a slender elegant longsword, golden phoenix crown, jade and ice crystals, holy mist, divine aura',
            male:   'white-and-silver robes with gold trim, holding an elegant longsword, golden crown, jade and ice crystals, holy mist, divine aura' },
  chaos:  { female: 'crimson-and-orange phoenix-feather gown, a phoenix of living fire soaring behind her, embers and sparks, warm pink background, fierce beauty',
            male:   'crimson-and-black robes, a phoenix of living fire soaring behind him, embers and sparks, warm background, fierce' },
};
const SUBJECT = { female: 'beautiful young immortal woman, ',
                  male: "handsome young male cultivator, men's hanfu, hair in a topknot with a jade crown, refined heroic face, " };
const promptFor = (g, r) => SUBJECT[g] + ELEMENTS[r][g] + ', ' + STYLE;

/* ── EXTRA PORTRAITS (Round 32) ───────────────────────────────────────────
 * The 10 gender × root portraits above are the DEFAULTS a new character can
 * roll. Since the player can now pick any portrait in Settings > Appearance,
 * the art is no longer capped at those 10 — add freeform entries here and
 * they generate alongside the rest.
 *
 * TO ADD ONE:
 *   1. Add `'<file-stem>': 'your prompt here',` below.
 *   2. Run `node tools/gen-portraits.mjs --only=<file-stem>`.
 *   3. Add a matching line to GameData.portraitCatalog in www/js/gameData.js
 *      so the picker offers it: { id, file:'<file-stem>.jpg', name, gender, root }
 *      (gender/root may be null for art not tied to a spirit root).
 * Keep the shared STYLE block on the end so new art matches the existing set.
 */
const EXTRA_PORTRAITS = {
  // 'female-frost': 'immortal woman in pale frost-white robes, snow and ice crystals, frozen lake, aurora light',
  // 'male-thunder': 'male cultivator wreathed in crackling golden lightning, storm clouds, thunder god aura',
};

// -- ComfyUI ----------------------------------------------------------------
async function comfyInfo() {
  const r = await fetch(COMFY + '/object_info/CheckpointLoaderSimple');
  if (!r.ok) throw new Error('object_info ' + r.status);
  const j = await r.json();
  return j.CheckpointLoaderSimple.input.required.ckpt_name[0]; // array of checkpoint names
}
async function preflightComfy() {
  try {
    const cks = await comfyInfo();
    if (!cks.length) throw new Error('no checkpoints found in ComfyUI/models/checkpoints');
    const ckpt = args.ckpt || process.env.COMFY_CKPT || cks[0];
    if (!cks.includes(ckpt)) throw new Error(`checkpoint "${ckpt}" not found. Available: ${cks.join(', ')}`);
    return ckpt;
  } catch (e) {
    if (e.cause && e.cause.code) throw new Error(`Cannot reach ComfyUI at ${COMFY}. Start it (python main.py) then retry. (${e.cause.code})`);
    throw e;
  }
}
function comfyGraph(prompt, ckpt, seed) {
  const graph = {};

  // 1. Load checkpoint
  graph['1'] = { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } };

  // 2. Chain LoRAs onto the model + clip outputs from node '1'
  // Each LoRA node takes (model, clip) from the previous node and outputs (model, clip).
  let prevModel = ['1', 0];
  let prevClip  = ['1', 1];
  LORAS.forEach((lora, i) => {
    const id = String(20 + i);
    graph[id] = {
      class_type: 'LoraLoader',
      inputs: {
        lora_name:     lora.name,
        strength_model: lora.weight,
        strength_clip:  lora.weight,
        model: prevModel,
        clip:  prevClip,
      },
    };
    prevModel = [id, 0];
    prevClip  = [id, 1];
  });

  // 3. Encode prompts using the LoRA-patched clip
  graph['6'] = { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: prevClip } };
  graph['7'] = { class_type: 'CLIPTextEncode', inputs: { text: NEG,    clip: prevClip } };

  // 4. Latent canvas
  graph['5'] = { class_type: 'EmptyLatentImage', inputs: { width: W, height: H, batch_size: 1 } };

  // 5. Sample
  graph['3'] = {
    class_type: 'KSampler',
    inputs: {
      seed, steps: STEPS, cfg: CFG,
      sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1,
      model: prevModel,
      positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0],
    },
  };

  // 6. Decode + save
  graph['8'] = { class_type: 'VAEDecode',  inputs: { samples: ['3', 0], vae: ['1', 2] } };
  graph['9'] = { class_type: 'SaveImage',  inputs: { filename_prefix: 'portrait', images: ['8', 0] } };

  return graph;
}
async function genComfy(prompt, ckpt) {
  const seed = Math.floor(Math.random() * 1e15);
  const post = await fetch(COMFY + '/prompt', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: comfyGraph(prompt, ckpt, seed) }) });
  if (!post.ok) throw new Error('/prompt ' + post.status + ' ' + await post.text());
  const pid = (await post.json()).prompt_id;
  for (let i = 0; i < 180; i++) {
    await sleep(2000);
    const entry = (await (await fetch(COMFY + '/history/' + pid)).json())[pid];
    if (entry && entry.outputs) {
      for (const node of Object.values(entry.outputs)) if (node.images?.length) {
        const im = node.images[0];
        const u = `${COMFY}/view?filename=${encodeURIComponent(im.filename)}&subfolder=${encodeURIComponent(im.subfolder||'')}&type=${im.type||'output'}`;
        return Buffer.from(await (await fetch(u)).arrayBuffer());
      }
    }
  }
  throw new Error('timed out waiting for ComfyUI render');
}

// -- Leonardo ---------------------------------------------------------------
async function genLeonardo(prompt) {
  const key = process.env.LEONARDO_API_KEY;
  if (!key) throw new Error('Set LEONARDO_API_KEY.');
  const modelId = process.env.LEONARDO_MODEL || 'e71a1c2f-4f80-4800-934f-2c68979d8cc8';
  const headers = { authorization: `Bearer ${key}`, 'content-type': 'application/json', accept: 'application/json' };
  const c = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', { method: 'POST', headers,
    body: JSON.stringify({ prompt, negative_prompt: NEG, modelId, width: W, height: H, num_images: 1, public: false }) });
  if (!c.ok) throw new Error('Leonardo create ' + c.status + ' ' + await c.text());
  const id = (await c.json()).sdGenerationJob.generationId;
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const g = (await (await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${id}`, { headers })).json()).generations_by_pk;
    if (g?.status === 'COMPLETE' && g.generated_images?.length) return Buffer.from(await (await fetch(g.generated_images[0].url)).arrayBuffer());
    if (g?.status === 'FAILED') throw new Error('Leonardo FAILED');
  }
  throw new Error('Leonardo timed out');
}

// -- Run --------------------------------------------------------------------
const roots = ['mortal', 'true', 'heaven', 'saint', 'chaos'];

if (args.list) {
  try { const cks = await comfyInfo(); console.log('ComfyUI checkpoints at ' + COMFY + ':\n  ' + (cks.join('\n  ') || '(none)')); }
  catch (e) { console.log('Could not list ComfyUI models: ' + e.message); }
  process.exit(0);
}

let ckpt = null;
if (BACKEND === 'comfy') {
  try { ckpt = await preflightComfy(); console.log(`ComfyUI OK · model: ${ckpt}`); }
  catch (e) { console.error('✖ ' + e.message); process.exit(1); }
}

const jobs = [];
for (const g of GENDER) for (const r of roots) {
  const name = `${g}-${r}`;
  if (!ONLY || ONLY.includes(name)) jobs.push({ name, prompt: promptFor(g, r) });
}
// Freeform extras (Round 32) — only when explicitly requested via --only,
// or when generating everything with no gender filter.
const wantAllExtras = !ONLY && !args.gender;
for (const [name, body] of Object.entries(EXTRA_PORTRAITS)) {
  if (wantAllExtras || (ONLY && ONLY.includes(name))) jobs.push({ name, prompt: `${body}, ${STYLE}` });
}
const unknownOnly = (ONLY || []).filter(n => !jobs.some(j => j.name === n));
if (unknownOnly.length) console.log(`(ignoring unknown --only names: ${unknownOnly.join(', ')})`);
console.log(`Backend: ${BACKEND} · ${jobs.length} portrait(s) → ${OUT_DIR}\n`);

for (const job of jobs) {
  const prompt = job.prompt;
  process.stdout.write(`• ${job.name} … `);
  try {
    const buf = BACKEND === 'comfy' ? await genComfy(prompt, ckpt) : await genLeonardo(prompt);
    fs.writeFileSync(path.join(OUT_DIR, job.name + '.jpg'), buf);
    console.log(`saved (${(buf.length / 1024).toFixed(0)} KB)`);
  } catch (e) { console.log('FAILED: ' + e.message); }
}
console.log('\nDone. Reload the game (npm run serve) — painted leads appear per Spiritual Root.');
