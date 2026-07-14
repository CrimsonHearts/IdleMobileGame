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
// Same painted-CG house style as gen-portraits.mjs, but boss/antagonist
// framing (menacing, dramatic) instead of the character-lead framing —
// these are the game's story bosses, not player-facing spirit roots.
const STYLE = 'semi-realistic anime CG painting, Chinese xianxia guofeng dark fantasy boss art, ' +
  'dramatic ominous lighting, intricate detail, glowing spirit particles, ' +
  'imposing menacing presence, highly detailed, masterpiece, best quality, 8k';
const NEG = 'text, watermark, signature, logo, lowres, blurry, jpeg artifacts, extra fingers, ' +
  'deformed hands, bad anatomy, cute, friendly, modern clothes, nsfw, ugly, distorted';

// Prompts keyed to each Guardian's established lore (combat.js GUARDIANS /
// quests.js order 25-35) — tweak freely, these are just a starting point.
const GUARDIANS = {
  ledger: {
    name: 'The Ledger',
    prompt: 'a towering audit-construct made of floating brass ledger-pages and abacus beads, ' +
      'a faceless scholar-golem wrapped in tally-marked silk ribbons, cold clinical presence, ' +
      'gold ink numerals glowing across its surface, corporate-bureaucratic dread, dim archive lighting',
  },
  choir: {
    name: 'The Hollow Choir',
    prompt: 'a writhing mass of translucent spectral figures all speaking at once, many overlapping ' +
      'ghostly mouths and reaching hands fused into one silhouette, discordant chorus, pale blue-white glow, ' +
      'unsettling and mournful, void mist',
  },
  shadow: {
    name: "Su Wan's Shadow",
    prompt: 'a corrupted doppelganger of an elegant elderly female cultivator, her form fraying into black ' +
      'smoke and cracked shadow at the edges, wearing the same simple robes and hairpin as a beloved mentor ' +
      'but with hollow void-black eyes, tragic and eerie, deep indigo tones',
  },
  cartographer: {
    name: 'The Cartographer',
    prompt: 'an ancient robed surveyor-entity composed of unfurling star-charts and glowing constellation ' +
      'lines, a compass-like halo of floating map fragments orbiting its head, vast and ancient, ' +
      'cartographic gold-and-teal glyphs across dark robes, cosmic surveying instrument aura',
  },
  firstvoice: {
    name: 'The First Voice',
    prompt: 'a primordial entity of pure resonant light and sound-waves given humanoid form, cracks of ' +
      'brilliant white-gold radiance across a featureless silhouette, ancient beyond comprehension, ' +
      'origin-point of all spoken magic, overwhelming serene power, radial light burst background',
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
