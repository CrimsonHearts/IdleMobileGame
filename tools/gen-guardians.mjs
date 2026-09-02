#!/usr/bin/env node
/* ===========================================================================
 * gen-guardians.mjs — Painted Rift Guardian art generator.
 *
 * Generates one painted "boss splash art" portrait per Rift Guardian (the 5
 * named, one-time story bosses in combat.js — Round 26/27) and saves them to
 * www/assets/guardians/<id>.jpg, which the game loads automatically (the
 * existing emoji icon is the fallback until a file exists — same pattern as
 * tools/gen-portraits.mjs for character leads).
 *
 * Backends (identical to gen-portraits.mjs — see that file/docs for setup):
 *   • Local ComfyUI (recommended) — needs ComfyUI running (COMFY_URL, :8188).
 *       Auto-detects your installed checkpoint; override with --ckpt=Name.
 *   • Leonardo.Ai (cloud)         — needs LEONARDO_API_KEY.
 *
 * Examples:
 *   node tools/gen-guardians.mjs --list                # show ComfyUI models
 *   node tools/gen-guardians.mjs                        # all 5, auto model
 *   node tools/gen-guardians.mjs --only=shadow,firstvoice
 *   node tools/gen-guardians.mjs --ckpt="animagineXL.safetensors"
 *   LEONARDO_API_KEY=xxx node tools/gen-guardians.mjs --backend=leonardo
 * No API keys are stored in the repo — they are read from the environment.
 * ========================================================================= */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../www/assets/guardians');
fs.mkdirSync(OUT_DIR, { recursive: true });

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true];
}));
const BACKEND = args.backend || (process.env.LEONARDO_API_KEY && !args.list ? 'leonardo' : 'comfy');
const ONLY = args.only ? String(args.only).split(',') : null;
const STEPS = parseInt(args.steps || '35', 10);
const CFG = parseFloat(args.cfg || '7.5');
const W = 832, H = 1216; // SDXL portrait; matches gen-portraits.mjs's canvas
const COMFY = process.env.COMFY_URL || 'http://127.0.0.1:8188';
const LORA_WEIGHT = parseFloat(args['lora-weight'] || '0.75');
const LORAS = [
  { name: 'girl_20.safetensors',       weight: LORA_WEIGHT },       // guofeng v4 style
  { name: 'Xianxia_Style.safetensors', weight: LORA_WEIGHT * 0.8 }, // xianxia art overlay
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

// -- Prompts ------------------------------------------------------------
/* Emblem style, matching gen-mobs.mjs — and for the same measured reason.
 * These read as story showpieces, but they only ever RENDER in the combat
 * stage at ~67px (.fighter.enemy.guardian .fighter-ico is 58px, and the
 * art is 1.15em of that). That is barely larger than a regular mob, so the
 * painted style originally specified here would mush out at display size
 * exactly as the painted mob art did. Guardians keep a richer, more
 * ornate prompt than the mobs so they still feel like a step up, but the
 * flat high-contrast fundamentals are shared.
 *
 * Keep STYLE short — CLIP truncates prompt + style at 77 tokens together
 * (see the same note in gen-mobs.mjs). */
const STYLE = 'bold flat vector emblem, ornate heraldic crest, game boss icon, ' +
  'high contrast, thick clean shapes, centered, crisp silhouette, ' +
  'glowing accents, mid-tone background';
const NEG = 'photorealistic, painterly, blurry, soft focus, realistic texture, text, ' +
  'watermark, low contrast, dark on dark, cluttered, tiny subject, empty space, ' +
  'multiple subjects, cute, deformed, bad anatomy, border, frame';

// Prompts keyed to each Guardian's established lore (combat.js GUARDIANS /
// quests.js order 25-35) — tweak freely, these are just a starting point.
/* Kept deliberately tight (~25 tokens each): name + prompt + STYLE must
 * fit CLIP's 77-token window. The original prose versions ran 87-96 tokens
 * and were being silently truncated, so the style terms never reached the
 * model at all. Each keeps one strong iconic hook plus its colour identity
 * — which is all that survives at emblem scale anyway. */
const GUARDIANS = {
  ledger: {
    name: 'The Ledger',
    prompt: 'a faceless brass audit-golem of floating ledger pages and abacus beads, ' +
      'glowing gold numerals, cold and clerical',
  },
  choir: {
    name: 'The Hollow Choir',
    prompt: 'many overlapping ghostly mouths and reaching hands fused into one ' +
      'spectral figure, pale blue-white glow, mournful',
  },
  shadow: {
    name: "Su Wan's Shadow",
    prompt: "an elderly woman's silhouette fraying into black smoke, hollow void-black " +
      'eyes, jade hairpin, deep indigo, tragic',
  },
  cartographer: {
    name: 'The Cartographer',
    prompt: 'a robed figure of unfurling star-charts, halo of floating map fragments, ' +
      'gold and teal constellation glyphs',
  },
  firstvoice: {
    name: 'The First Voice',
    prompt: 'a featureless humanoid of white-gold light, radiant cracks, concentric ' +
      'sound waves, radial burst, primordial',
  },
};

const promptFor = id => `${GUARDIANS[id].name}, ${GUARDIANS[id].prompt}, ${STYLE}`;

// -- ComfyUI (identical wiring to gen-portraits.mjs) ---------------------
async function comfyInfo() {
  const r = await fetch(COMFY + '/object_info/CheckpointLoaderSimple');
  if (!r.ok) throw new Error('object_info ' + r.status);
  const j = await r.json();
  return j.CheckpointLoaderSimple.input.required.ckpt_name[0];
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
  graph['1'] = { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } };
  let prevModel = ['1', 0];
  let prevClip  = ['1', 1];
  LORAS.forEach((lora, i) => {
    const id = String(20 + i);
    graph[id] = {
      class_type: 'LoraLoader',
      inputs: { lora_name: lora.name, strength_model: lora.weight, strength_clip: lora.weight, model: prevModel, clip: prevClip },
    };
    prevModel = [id, 0];
    prevClip  = [id, 1];
  });
  graph['6'] = { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: prevClip } };
  graph['7'] = { class_type: 'CLIPTextEncode', inputs: { text: NEG,    clip: prevClip } };
  graph['5'] = { class_type: 'EmptyLatentImage', inputs: { width: W, height: H, batch_size: 1 } };
  graph['3'] = {
    class_type: 'KSampler',
    inputs: {
      seed, steps: STEPS, cfg: CFG, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1,
      model: prevModel, positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0],
    },
  };
  graph['8'] = { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['1', 2] } };
  graph['9'] = { class_type: 'SaveImage', inputs: { filename_prefix: 'guardian', images: ['8', 0] } };
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

// -- Leonardo (identical wiring to gen-portraits.mjs) --------------------
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

// -- Run ------------------------------------------------------------------
/* Emit resolved prompts as JSON and exit — see the same flag in
 * gen-mobs.mjs. Keeps prompts single-sourced across runners. */
if (args['dump-prompts']) {
  const prompts = {};
  for (const id of Object.keys(GUARDIANS)) prompts[id] = promptFor(id);
  console.log(JSON.stringify({ negative: NEG, width: W, height: H, outDir: OUT_DIR, prompts }, null, 2));
  process.exit(0);
}

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

const ids = Object.keys(GUARDIANS).filter(id => !ONLY || ONLY.includes(id));
console.log(`Backend: ${BACKEND} · ${ids.length} guardian(s) → ${OUT_DIR}\n`);

for (const id of ids) {
  const prompt = promptFor(id);
  process.stdout.write(`• ${id} (${GUARDIANS[id].name}) … `);
  try {
    const buf = BACKEND === 'comfy' ? await genComfy(prompt, ckpt) : await genLeonardo(prompt);
    fs.writeFileSync(path.join(OUT_DIR, id + '.jpg'), buf);
    console.log(`saved (${(buf.length / 1024).toFixed(0)} KB)`);
  } catch (e) { console.log('FAILED: ' + e.message); }
}
console.log('\nDone. Reload the game (npm run serve) — painted Guardians appear in Trials at their zone.');
