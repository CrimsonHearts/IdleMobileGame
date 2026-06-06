#!/usr/bin/env node
/* ===========================================================================
 * gen-portraits.mjs — End-to-end painted character art generator.
 *
 * Generates xianxia splash-art portraits for every gender × spiritual root and
 * saves them to www/assets/portraits/<gender>-<root>.jpg, which the game loads
 * automatically.
 *
 * Two backends:
 *   • Leonardo.Ai (cloud)   — needs LEONARDO_API_KEY
 *   • Local ComfyUI (Mac)   — needs ComfyUI running (COMFY_URL, default :8188)
 *
 * Usage:
 *   LEONARDO_API_KEY=xxx node tools/gen-portraits.mjs --backend=leonardo
 *   node tools/gen-portraits.mjs --backend=comfy --ckpt="guofengXL.safetensors"
 *   ...add  --only=female-chaos,male-saint   to generate specific ones
 *   ...add  --gender=female                  to do one gender
 * No API keys are stored in the repo — they are read from the environment.
 * ========================================================================= */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../www/assets/portraits');
fs.mkdirSync(OUT_DIR, { recursive: true });

// -- CLI args ---------------------------------------------------------------
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true];
}));
const BACKEND = args.backend || (process.env.LEONARDO_API_KEY ? 'leonardo' : 'comfy');
const ONLY = args.only ? String(args.only).split(',') : null;
const GENDER = args.gender ? [args.gender] : ['female', 'male'];
const W = 832, H = 1216; // SDXL portrait; the game crops to a circle

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
                  male: 'handsome young male cultivator, men\'s hanfu, hair in a topknot with a jade crown, refined heroic face, ' };

function promptFor(gender, root) { return SUBJECT[gender] + ELEMENTS[root][gender] + ', ' + STYLE; }

// -- Backends ---------------------------------------------------------------
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function genLeonardo(prompt) {
  const key = process.env.LEONARDO_API_KEY;
  if (!key) throw new Error('Set LEONARDO_API_KEY in your environment.');
  const modelId = process.env.LEONARDO_MODEL || 'e71a1c2f-4f80-4800-934f-2c68979d8cc8'; // Leonardo Anime XL (override as needed)
  const headers = { 'authorization': `Bearer ${key}`, 'content-type': 'application/json', 'accept': 'application/json' };
  const create = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
    method: 'POST', headers,
    body: JSON.stringify({ prompt, negative_prompt: NEG, modelId, width: W, height: H, num_images: 1, public: false }),
  });
  if (!create.ok) throw new Error('Leonardo create failed: ' + create.status + ' ' + await create.text());
  const id = (await create.json()).sdGenerationJob.generationId;
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const r = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${id}`, { headers });
    const g = (await r.json()).generations_by_pk;
    if (g && g.status === 'COMPLETE' && g.generated_images?.length) {
      const url = g.generated_images[0].url;
      return Buffer.from(await (await fetch(url)).arrayBuffer());
    }
    if (g && g.status === 'FAILED') throw new Error('Leonardo generation FAILED');
  }
  throw new Error('Leonardo timed out');
}

function comfyGraph(prompt, ckpt, seed) {
  return {
    '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
    '5': { class_type: 'EmptyLatentImage', inputs: { width: W, height: H, batch_size: 1 } },
    '6': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['4', 1] } },
    '7': { class_type: 'CLIPTextEncode', inputs: { text: NEG, clip: ['4', 1] } },
    '3': { class_type: 'KSampler', inputs: { seed, steps: 32, cfg: 7, sampler_name: 'dpmpp_2m', scheduler: 'karras',
            denoise: 1, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] } },
    '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
    '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'portrait', images: ['8', 0] } },
  };
}

async function genComfy(prompt) {
  const base = process.env.COMFY_URL || 'http://127.0.0.1:8188';
  const ckpt = args.ckpt || process.env.COMFY_CKPT || 'sd_xl_base_1.0.safetensors';
  const seed = Math.floor(Math.random() * 1e15);
  const post = await fetch(base + '/prompt', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: comfyGraph(prompt, ckpt, seed) }),
  });
  if (!post.ok) throw new Error('ComfyUI /prompt failed: ' + post.status + ' ' + await post.text());
  const pid = (await post.json()).prompt_id;
  for (let i = 0; i < 120; i++) {
    await sleep(2000);
    const h = await (await fetch(base + '/history/' + pid)).json();
    const entry = h[pid];
    if (entry && entry.outputs) {
      for (const node of Object.values(entry.outputs)) {
        if (node.images?.length) {
          const im = node.images[0];
          const u = `${base}/view?filename=${encodeURIComponent(im.filename)}&subfolder=${encodeURIComponent(im.subfolder||'')}&type=${im.type||'output'}`;
          return Buffer.from(await (await fetch(u)).arrayBuffer());
        }
      }
    }
  }
  throw new Error('ComfyUI timed out (is a checkpoint loaded? try --ckpt=...)');
}

const generate = BACKEND === 'leonardo' ? genLeonardo : genComfy;

// -- Run --------------------------------------------------------------------
const roots = ['mortal', 'true', 'heaven', 'saint', 'chaos'];
const jobs = [];
for (const g of GENDER) for (const r of roots) {
  const name = `${g}-${r}`;
  if (ONLY && !ONLY.includes(name)) continue;
  jobs.push({ name, gender: g, root: r });
}

console.log(`Backend: ${BACKEND} · generating ${jobs.length} portrait(s) → ${OUT_DIR}\n`);
for (const job of jobs) {
  const prompt = promptFor(job.gender, job.root);
  process.stdout.write(`• ${job.name} … `);
  try {
    const buf = await generate(prompt);
    fs.writeFileSync(path.join(OUT_DIR, job.name + '.jpg'), buf);
    console.log(`saved (${(buf.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.log('FAILED: ' + e.message);
  }
}
console.log('\nDone. Reload the game — painted leads appear per Spiritual Root.');
