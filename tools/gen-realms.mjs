#!/usr/bin/env node
/* ===========================================================================
 * gen-realms.mjs — Painted realm-vista backdrops (one per cultivation realm).
 *
 * Generates atmospheric xianxia LANDSCAPE scenes (no people) for each of the
 * 10 realms and saves them to www/assets/realms/realm-<index>.jpg. The game
 * layers them faintly behind the per-realm gradient backdrop.
 *
 * Uses the same local ComfyUI + checkpoint as the portraits, but only the
 * Xianxia_Style LoRA (the character LoRA is dropped so no faces appear).
 *
 *   node tools/gen-realms.mjs            # all 10 realms, auto checkpoint
 *   node tools/gen-realms.mjs --only=4   # just Nascent Soul
 * ========================================================================= */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../www/assets/realms');
fs.mkdirSync(OUT_DIR, { recursive: true });

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true];
}));
const ONLY = args.only ? String(args.only).split(',') : null;
const STEPS = parseInt(args.steps || '34', 10);
const CFG = parseFloat(args.cfg || '7', 10);
const W = 832, H = 1216;               // portrait, matches a phone backdrop
const COMFY = process.env.COMFY_URL || 'http://127.0.0.1:8188';
const LORAS = [{ name: 'Xianxia_Style.safetensors', weight: 0.75 }]; // scenery aesthetic only
const sleep = ms => new Promise(r => setTimeout(r, ms));

const STYLE = 'Chinese xianxia fantasy landscape, cinematic concept art blended with ink-wash, ' +
  'vast ethereal scenery, glowing spirit energy and floating motes, volumetric god rays, ' +
  'dramatic atmosphere, depth and scale, no people, no characters, empty landscape, ' +
  'masterpiece, highly detailed, intricate, 8k, wallpaper';
const NEG = 'people, person, human, character, face, portrait, crowd, text, watermark, signature, ' +
  'logo, lowres, blurry, jpeg artifacts, ugly, distorted, cropped, frame, border';

// One vista per realm index (0..9), themed to that realm's colour identity.
const REALMS = [
  { i:0, name:'Mortal',                  p:'a misty ancient-futuristic mortal city at grey dawn, tiled rooftops and distant towers, muted blue-grey fog, humble quiet mood' },
  { i:1, name:'Qi Condensation',         p:'a serene jade-green bamboo forest valley, soft green qi mist drifting between stalks, a small stone shrine, gentle morning light' },
  { i:2, name:'Foundation Establishment',p:'a teal mountain monastery with carved stone platforms and waterfalls, cyan mist, distant cliffs, tranquil' },
  { i:3, name:'Core Formation',          p:'sacred golden peaks at sunrise, warm amber clouds rolling between mountains, a glowing golden core of light in the sky' },
  { i:4, name:'Nascent Soul',            p:'mystic violet twilight realm, floating rock islands amid a purple nebula, glowing lavender lotus pools, dreamlike' },
  { i:5, name:'Soul Formation',          p:'a still mirror lake under a deep indigo starfield, drifting blue spirit lights, silhouetted distant pagoda, cosmic calm' },
  { i:6, name:'Void Refinement',         p:'a cosmic void of shattered space and floating shards, swirling dark nebula with bright white stars, eerie boundless emptiness' },
  { i:7, name:'Body Integration',        p:'crimson volcanic mountain range, rivers of glowing lava, ember-filled red sky, ash clouds, fierce primal power' },
  { i:8, name:'Great Ascension',         p:'a radiant golden heavenly palace floating above a sea of luminous clouds, sweeping jade staircases, brilliant gold light' },
  { i:9, name:'Immortal Ascension',      p:'a celestial white-and-gold immortal realm, a vast staircase of light ascending into the heavens, divine sun-burst, sacred and transcendent' },
];

async function comfyInfo() {
  const r = await fetch(COMFY + '/object_info/CheckpointLoaderSimple');
  if (!r.ok) throw new Error('object_info ' + r.status);
  const j = await r.json();
  return j.CheckpointLoaderSimple.input.required.ckpt_name[0];
}
function graph(prompt, ckpt, seed) {
  const g = {};
  g['1'] = { class_type:'CheckpointLoaderSimple', inputs:{ ckpt_name:ckpt } };
  let m = ['1',0], c = ['1',1];
  LORAS.forEach((l, idx) => {
    const id = String(20+idx);
    g[id] = { class_type:'LoraLoader', inputs:{ lora_name:l.name, strength_model:l.weight, strength_clip:l.weight, model:m, clip:c } };
    m = [id,0]; c = [id,1];
  });
  g['6'] = { class_type:'CLIPTextEncode', inputs:{ text:prompt, clip:c } };
  g['7'] = { class_type:'CLIPTextEncode', inputs:{ text:NEG,    clip:c } };
  g['5'] = { class_type:'EmptyLatentImage', inputs:{ width:W, height:H, batch_size:1 } };
  g['3'] = { class_type:'KSampler', inputs:{ seed, steps:STEPS, cfg:CFG, sampler_name:'dpmpp_2m', scheduler:'karras', denoise:1, model:m, positive:['6',0], negative:['7',0], latent_image:['5',0] } };
  g['8'] = { class_type:'VAEDecode', inputs:{ samples:['3',0], vae:['1',2] } };
  g['9'] = { class_type:'SaveImage', inputs:{ filename_prefix:'realm', images:['8',0] } };
  return g;
}
async function gen(prompt, ckpt) {
  const seed = Math.floor(Math.random() * 1e15);
  const post = await fetch(COMFY + '/prompt', { method:'POST', headers:{ 'content-type':'application/json' },
    body: JSON.stringify({ prompt: graph(prompt, ckpt, seed) }) });
  if (!post.ok) throw new Error('/prompt ' + post.status + ' ' + await post.text());
  const pid = (await post.json()).prompt_id;
  for (let i = 0; i < 240; i++) {
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
  throw new Error('timed out');
}

let ckpt;
try {
  const cks = await comfyInfo();
  // Prefer an SDXL checkpoint for clean landscapes; GuoFeng3 (SD1.5) is character-biased.
  const preferred = cks.find(c => /xl/i.test(c)) || cks[0];
  ckpt = args.ckpt || process.env.COMFY_CKPT || preferred;
  if (!cks.includes(ckpt)) throw new Error(`checkpoint "${ckpt}" not found. Available: ${cks.join(', ')}`);
  console.log(`ComfyUI OK · model: ${ckpt} · LoRA: Xianxia_Style`); }
catch (e) { console.error('✖ ' + e.message); process.exit(1); }

const jobs = REALMS.filter(r => !ONLY || ONLY.includes(String(r.i)));
console.log(`Generating ${jobs.length} realm vista(s) @ ${W}×${H} → ${OUT_DIR}\n`);
for (const r of jobs) {
  process.stdout.write(`• realm ${r.i} (${r.name}) … `);
  try {
    const buf = await gen(r.p + ', ' + STYLE, ckpt);
    fs.writeFileSync(path.join(OUT_DIR, `realm-${r.i}.jpg`), buf);
    console.log(`saved (${(buf.length/1024).toFixed(0)} KB)`);
  } catch (e) { console.log('FAILED: ' + e.message); }
}
console.log('\nDone. Reload the game — realm vistas layer behind the atmospheric backdrop.');
