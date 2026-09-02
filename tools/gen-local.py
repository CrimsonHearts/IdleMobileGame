#!/usr/bin/env python3
"""
gen-local.py — CPU-friendly art generator (diffusers), for machines with no GPU.

The ComfyUI generators (gen-portraits/gen-guardians/gen-mobs .mjs) are the
preferred path when you have a GPU. This is the fallback: a single-file
Stable Diffusion checkpoint run through diffusers on CPU.

It does NOT redefine any prompts — it shells out to the .mjs generators'
`--dump-prompts` flag so both runners stay in sync from one source of truth.

Why an LCM checkpoint is the default suggestion: LCM (Latent Consistency)
models converge in 4-8 steps instead of 25-30, which is the difference
between ~1 minute and ~5 minutes per image on a typical CPU.

Size note: SD 1.5 is trained at 512x512 and degrades badly above ~640 (it
starts duplicating heads/limbs), so this deliberately IGNORES the .mjs
832x1216 portrait size and uses CPU/SD1.5-appropriate defaults instead.
Mob icons render at 46-58px behind a circular crop, so 512 is ample.

Usage:
  python3 tools/gen-local.py --model path/to/model.safetensors --set mobs
  python3 tools/gen-local.py --model ... --set guardians --steps 8
  python3 tools/gen-local.py --model ... --set mobs --only wolf,ghoul
"""
import argparse, json, os, subprocess, sys, time

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SETS = {
    # name -> (generator script, output subdir, default WxH for SD1.5 on CPU)
    'mobs':      ('tools/gen-mobs.mjs',      'www/assets/mobs',      (512, 512)),
    'guardians': ('tools/gen-guardians.mjs', 'www/assets/guardians', (512, 768)),
}


def load_prompts(script):
    """Ask the .mjs generator for its resolved prompts (single source of truth)."""
    out = subprocess.run(['node', script, '--dump-prompts'],
                         cwd=REPO, capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f'✖ could not read prompts from {script}:\n{out.stderr}')
    return json.loads(out.stdout)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True, help='path to a .safetensors checkpoint')
    ap.add_argument('--set', default='mobs', choices=sorted(SETS), help='which art set to generate')
    ap.add_argument('--only', default=None, help='comma-separated keys to generate')
    ap.add_argument('--steps', type=int, default=None, help='inference steps (default: 6 LCM / 22 normal)')
    ap.add_argument('--cfg', type=float, default=None, help='guidance scale (default: 1.5 LCM / 7.0 normal)')
    ap.add_argument('--size', default=None, help='WxH override, e.g. 512x512')
    ap.add_argument('--seed', type=int, default=1234)
    ap.add_argument('--lcm', dest='lcm', action='store_true', default=None, help='force LCM scheduler')
    ap.add_argument('--no-lcm', dest='lcm', action='store_false', help='force normal scheduler')
    args = ap.parse_args()

    script, outdir, (dw, dh) = SETS[args.set]
    if args.size:
        dw, dh = (int(x) for x in args.size.lower().split('x'))

    # Auto-detect LCM from the filename unless told otherwise.
    is_lcm = args.lcm if args.lcm is not None else ('lcm' in os.path.basename(args.model).lower())
    steps = args.steps if args.steps is not None else (6 if is_lcm else 22)
    cfg = args.cfg if args.cfg is not None else (1.5 if is_lcm else 7.0)

    data = load_prompts(script)
    prompts = data['prompts']
    negative = data['negative']
    if args.only:
        want = [k.strip() for k in args.only.split(',')]
        unknown = [k for k in want if k not in prompts]
        if unknown:
            print(f'(ignoring unknown --only keys: {", ".join(unknown)})')
        prompts = {k: v for k, v in prompts.items() if k in want}

    out_path = os.path.join(REPO, outdir)
    os.makedirs(out_path, exist_ok=True)

    print(f'Loading {os.path.basename(args.model)} on CPU '
          f'({"LCM" if is_lcm else "standard"}, {steps} steps, cfg {cfg}, {dw}x{dh})…')
    t0 = time.time()
    import torch
    from diffusers import StableDiffusionPipeline, LCMScheduler, DPMSolverMultistepScheduler

    pipe = StableDiffusionPipeline.from_single_file(
        args.model, torch_dtype=torch.float32, safety_checker=None, requires_safety_checker=False)
    pipe.scheduler = (LCMScheduler.from_config(pipe.scheduler.config) if is_lcm
                      else DPMSolverMultistepScheduler.from_config(pipe.scheduler.config,
                                                                   algorithm_type='dpmsolver++',
                                                                   use_karras_sigmas=True))
    pipe.to('cpu')
    pipe.set_progress_bar_config(disable=True)
    torch.set_num_threads(os.cpu_count() or 4)
    print(f'  model ready in {time.time()-t0:.0f}s · {len(prompts)} image(s) → {outdir}\n')

    ok = 0
    for i, (key, prompt) in enumerate(prompts.items(), 1):
        t = time.time()
        print(f'• [{i}/{len(prompts)}] {key} … ', end='', flush=True)
        try:
            img = pipe(prompt=prompt, negative_prompt=negative,
                       num_inference_steps=steps, guidance_scale=cfg,
                       width=dw, height=dh,
                       generator=torch.Generator('cpu').manual_seed(args.seed + i)).images[0]
            dest = os.path.join(out_path, key + '.jpg')
            img.convert('RGB').save(dest, 'JPEG', quality=88, optimize=True)
            ok += 1
            print(f'saved ({os.path.getsize(dest)//1024} KB, {time.time()-t:.0f}s)')
        except Exception as e:  # keep going — one bad prompt shouldn't kill the batch
            print(f'FAILED: {e}')

    print(f'\nDone. {ok}/{len(prompts)} generated in {(time.time()-t0)/60:.1f} min.')
    print('Reload the game — painted art appears automatically (emoji is the fallback).')


if __name__ == '__main__':
    main()
