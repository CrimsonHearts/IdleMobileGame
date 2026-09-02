#!/usr/bin/env node
/* ===========================================================================
 * gen-mobs.mjs — Painted art for the regular Trials mobs and bosses.
 *
 * Companion to gen-portraits.mjs (player leads) and gen-guardians.mjs (the 5
 * named Rift Guardians). This covers the 22 REGULAR mob/boss icons, saving
 * to www/assets/mobs/<key>.jpg where <key> is the mob's icon id minus its
 * "ic-mob-" prefix (combat.js 'ic-mob-wolf' -> assets/mobs/wolf.jpg).
 * Missing files fall back to the emoji, so this is always optional.
 *
 * NOTE ON SIZE: these render at ~46-58px in the combat stage, so unlike the
 * 832x1216 character portraits these are generated SQUARE at 768x768 —
 * roughly 4x faster per image, and detail beyond that is thrown away by the
 * circular crop anyway. Override with --size=N if you want bigger.
 *
 * Backends (same as the other generators — see tools/README.md):
 *   • Local ComfyUI (recommended) — needs ComfyUI running (COMFY_URL, :8188).
 *   • Leonardo.Ai (cloud)         — needs LEONARDO_API_KEY.
 *
 * Examples:
 *   node tools/gen-mobs.mjs --list                # show ComfyUI models
 *   node tools/gen-mobs.mjs                       # all 22
 *   node tools/gen-mobs.mjs --only=wolf,wraith    # just these
 *   node tools/gen-mobs.mjs --ckpt="4Guofeng4XL_v12.safetensors"
 * No API keys are stored in the repo — they are read from the environment.
 * ========================================================================= */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../www/assets/mobs');
fs.mkdirSync(OUT_DIR, { recursive: true });

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true];
}));
const BACKEND = args.backend || (process.env.LEONARDO_API_KEY && !args.list ? 'leonardo' : 'comfy');
const ONLY = args.only ? String(args.only).split(',') : null;
const STEPS = parseInt(args.steps || '30', 10);
const CFG = parseFloat(args.cfg || '7.5');
const SIZE = parseInt(args.size || '768', 10); // square — these are icons
const W = SIZE, H = SIZE;
const COMFY = process.env.COMFY_URL || 'http://127.0.0.1:8188';
const LORA_WEIGHT = parseFloat(args['lora-weight'] || '0.7');
// Only the style LoRA here — the character LoRA (girl_20) pulls every
// subject toward a human figure, which is wrong for beasts/constructs.
const LORAS = [
  { name: 'Xianxia_Style.safetensors', weight: LORA_WEIGHT },
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

// -- Prompts ----------------------------------------------------------------
// Centered single subject on a plain dark backdrop: the combat stage crops
// these to a circle, so anything in the corners is thrown away.
const STYLE = 'Chinese xianxia dark fantasy creature art, semi-realistic painted CG, ' +
  'single centered subject, plain dark misty background, dramatic rim lighting, ' +
  'glowing spirit particles, menacing, highly detailed, masterpiece';
const NEG = 'text, watermark, signature, logo, lowres, blurry, jpeg artifacts, ' +
  'multiple subjects, full body crowd scene, cute, chibi, modern clothes, nsfw, ' +
  'deformed, extra limbs, bad anatomy, cluttered background, border, frame';

/* Keys match combat.js icon ids minus "ic-mob-". Prompts follow each mob's
 * name and its zone band's flavour (early beasts -> demonic corruption ->
 * Jiutian machine-constructs -> void/unmapped horrors). */
const MOBS = {
  // Zone band 1 — feral demonic beasts
  wolf:      'a snarling demonic wolf with burning red eyes and shadowy black fur, bared fangs',
  ghoul:     'a gaunt undead corpse ghoul in tattered grave wrappings, sunken glowing eyes',
  scorpion:  'a giant armoured venom scorpion, chitin plates glistening, dripping green venom, raised stinger',
  bat:       'a huge blood bat with membranous wings spread, crimson eyes, fangs bared',
  demon:     'a towering horned demon general in black spiked armour, glowing molten cracks, imposing',

  // Zone band 2 — rift corruption
  hound:     'a rift-touched hound, its body fracturing into floating shards of violet light, twin heads',
  wraith:    'a fractured spectral wraith, translucent tattered robes dissolving into mist, hollow glowing eye sockets',
  voidling:  'a swirling swarm of small void creatures merging into one dark writhing mass, purple void energy',
  corrupted: 'a corrupted cultivator in torn dark robes, black corruption veins spreading across the face, glowing violet eyes',
  warden:    'an armoured rift warden construct, floating stone plates bound by chains of violet light',

  // Zone band 3 — Jiutian machine-constructs
  sentinel:  'a hollow stone sentinel statue animated by pale light, cracked granite body, empty glowing eye sockets',
  colossus:  'a colossal cracked stone titan looming, moss and gold veins in the fractures, immense scale',
  enforcer:  'a sleek black corporate enforcer drone, hovering, red optical sensor, Jiutian Holdings insignia, cold machine menace',

  // Zone band 4 — void horrors
  reaver:    'a void reaver, a bladed humanoid silhouette of pure darkness, edges tearing reality, starless void',
  abomination: 'a writhing fracture abomination of fused limbs and tentacles, reality distorting around it, deeply unsettling',
  wisp:      'a heaven-eater wisp, a small brilliant orb of devouring white-gold light with a black core, eclipse-like',
  sovereign: 'a void sovereign, a crowned regal figure of living darkness on a throne of collapsed stars, cosmic authority',

  // Zone band 5 — the unmapped
  echo:      "a cartographer's echo, a translucent ghostly surveyor made of glowing map lines and constellation charts",
  remnant:   'a threshold remnant, a broken doorway-shaped entity of floating stone fragments and pale light',
  cartograph:'a silent living cartograph, an unfurling scroll-creature covered in shifting glowing star charts',
  surveyor:  'a boundless surveyor, a tall faceless robed figure holding a glowing astrolabe, ancient and measuring',
  uncounted: 'the uncounted, an endless recursive swarm of identical faceless silhouettes fading into infinity',
};

const promptFor = key => `${MOBS[key]}, ${STYLE}`;

// -- ComfyUI ----------------------------------------------------------------
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
  graph['9'] = { class_type: 'SaveImage', inputs: { filename_prefix: 'mob', images: ['8', 0] } };
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
/* Emit the resolved prompts as JSON and exit. Lets another runner (e.g. the
 * CPU/diffusers fallback in tools/gen-local.py) reuse these exact prompts
 * instead of duplicating them, so there is one source of truth. */
if (args['dump-prompts']) {
  const prompts = {};
  for (const k of Object.keys(MOBS)) prompts[k] = promptFor(k);
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

const keys = Object.keys(MOBS).filter(k => !ONLY || ONLY.includes(k));
const unknown = (ONLY || []).filter(k => !MOBS[k]);
if (unknown.length) console.log(`(ignoring unknown --only keys: ${unknown.join(', ')})`);
console.log(`Backend: ${BACKEND} · ${keys.length} mob(s) at ${W}x${H} → ${OUT_DIR}\n`);

for (const key of keys) {
  process.stdout.write(`• ${key} … `);
  try {
    const buf = BACKEND === 'comfy' ? await genComfy(promptFor(key), ckpt) : await genLeonardo(promptFor(key));
    fs.writeFileSync(path.join(OUT_DIR, key + '.jpg'), buf);
    console.log(`saved (${(buf.length / 1024).toFixed(0)} KB)`);
  } catch (e) { console.log('FAILED: ' + e.message); }
}
console.log('\nDone. Reload the game — painted mobs appear in Trials at their zones.');
