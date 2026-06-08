#!/usr/bin/env python3
"""Generate Path to Immortality app icon — xianxia cultivation theme."""

import math, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SIZE = 1024
OUT  = os.path.join(os.path.dirname(__file__), '..', 'www', 'assets', 'icon-1024.png')

def lerp_color(a, b, t):
    return tuple(int(a[i] + (b[i]-a[i])*t) for i in range(len(a)))

def make_radial_gradient(size, center, r_stops):
    """r_stops: list of (radius_frac, (R,G,B,A))"""
    img = Image.new('RGBA', (size, size), (0,0,0,0))
    px  = img.load()
    cx, cy = center
    max_r = math.sqrt(cx**2 + cy**2) * 1.6
    for y in range(size):
        for x in range(size):
            d = math.sqrt((x-cx)**2 + (y-cy)**2) / max_r
            d = min(d, 1.0)
            col = r_stops[0][1]
            for i in range(len(r_stops)-1):
                t0,c0 = r_stops[i]
                t1,c1 = r_stops[i+1]
                if t0 <= d <= t1:
                    tt = (d-t0)/(t1-t0)
                    col = lerp_color(c0, c1, tt)
                    break
                elif d > t1:
                    col = c1
            px[x,y] = col
    return img

img = Image.new('RGBA', (SIZE, SIZE), (0,0,0,255))
draw = ImageDraw.Draw(img)

# ── BACKGROUND: deep cosmic dark ──────────────────────────────────────────
for y in range(SIZE):
    t = y / SIZE
    r = int(12 + 8*t)
    g = int(6  + 4*t)
    b = int(30 + 10*t)
    draw.line([(0,y),(SIZE,y)], fill=(r,g,b,255))

# Radial lighter centre
for y in range(SIZE):
    for x in range(SIZE):
        dx = (x - SIZE*0.5) / (SIZE*0.5)
        dy = (y - SIZE*0.42) / (SIZE*0.5)
        d  = math.sqrt(dx*dx + dy*dy)
        glow = max(0, 1 - d) * 0.18
        px = img.getpixel((x,y))
        img.putpixel((x,y),(
            min(255, int(px[0] + glow*40)),
            min(255, int(px[1] + glow*20)),
            min(255, int(px[2] + glow*60)),
            255))

# ── STARS ─────────────────────────────────────────────────────────────────
import random
random.seed(42)
for _ in range(120):
    sx = random.randint(0, SIZE)
    sy = random.randint(0, int(SIZE*0.72))
    sr = random.uniform(0.8, 2.5)
    sa = random.randint(140, 255)
    sc = random.choice([(255,255,255),(200,235,255),(255,245,200)])
    draw.ellipse([sx-sr, sy-sr, sx+sr, sy+sr], fill=(*sc, sa))

# ── MOUNTAIN SILHOUETTE ───────────────────────────────────────────────────
mountains = [
    [(0,820),(160,440),(320,820)],
    [(100,820),(300,360),(500,820)],
    [(320,820),(512,300),(704,820)],
    [(530,820),(720,400),(920,820)],
    [(750,820),(950,450),(1024,700),(1024,820)],
]
for i, pts in enumerate(mountains):
    alpha = 38 + i*8
    col = (20+i*5, 10+i*3, 55+i*8, alpha)
    draw.polygon(pts, fill=col)

# ── HELPER: draw a glowing circle layer ───────────────────────────────────
def glow_circle(base, cx, cy, r, color, layers=6, spread=1.5):
    for i in range(layers, 0, -1):
        alpha = int(color[3] * (i/layers)**2 * 0.4)
        rr = r + int(spread * i * r * 0.08)
        base_layer = Image.new('RGBA', (SIZE,SIZE), (0,0,0,0))
        d2 = ImageDraw.Draw(base_layer)
        d2.ellipse([cx-rr,cy-rr,cx+rr,cy+rr], fill=(*color[:3], alpha))
        base = Image.alpha_composite(base, base_layer)
    return base

img = img.convert('RGBA')

# ── JADE ORB GLOW ─────────────────────────────────────────────────────────
CX, CY, R = 512, 490, 210

for layer in range(8, 0, -1):
    alpha = int(18 * (layer/8)**1.5)
    rr    = R + layer * 28
    lo = Image.new('RGBA',(SIZE,SIZE),(0,0,0,0))
    ImageDraw.Draw(lo).ellipse([CX-rr,CY-rr,CX+rr,CY+rr], fill=(22,212,160,alpha))
    img = Image.alpha_composite(img, lo)

# Main orb: radial gradient from aqua-white centre to deep teal edge
orb = Image.new('RGBA',(SIZE,SIZE),(0,0,0,0))
odraw = ImageDraw.Draw(orb)
for step in range(200, 0, -1):
    frac = step / 200
    rr   = int(R * frac)
    if frac < 0.25:
        c = lerp_color((210,255,245,255),(100,230,200,255), frac/0.25)
    elif frac < 0.6:
        c = lerp_color((100,230,200,255),(22,182,140,255), (frac-0.25)/0.35)
    else:
        c = lerp_color((22,182,140,255),(8,60,44,255), (frac-0.6)/0.4)
    odraw.ellipse([CX-rr,CY-rr,CX+rr,CY+rr], fill=c)
img = Image.alpha_composite(img, orb)

# Specular highlight
hi = Image.new('RGBA',(SIZE,SIZE),(0,0,0,0))
ImageDraw.Draw(hi).ellipse([CX-115,CY-145,CX+10,CY-30], fill=(255,255,255,55))
ImageDraw.Draw(hi).ellipse([CX-88,CY-128,CX-20,CY-75], fill=(255,255,255,80))
hi = hi.filter(ImageFilter.GaussianBlur(12))
img = Image.alpha_composite(img, hi)

# ── YIN-YANG INSIDE ORB ───────────────────────────────────────────────────
yy_r = 92
yy_cx, yy_cy = CX, CY

def draw_yinyang(base, cx, cy, r):
    layer = Image.new('RGBA',(SIZE,SIZE),(0,0,0,0))
    d = ImageDraw.Draw(layer)
    # Full dark circle
    d.ellipse([cx-r,cy-r,cx+r,cy+r], fill=(15,40,30,235))
    # Top-half light (S-curve approximation with two semicircles)
    # Right half circle (light)
    d.pieslice([cx-r,cy-r,cx+r,cy+r], start=270, end=90, fill=(240,255,248,235))
    # Upper small circle (light)
    sr = r//2
    d.ellipse([cx-sr,cy-r,cx+sr,cy], fill=(240,255,248,235))
    # Lower small circle (dark)
    d.ellipse([cx-sr,cy,cx+sr,cy+r], fill=(15,40,30,235))
    # Tiny dots
    dot = r//6
    d.ellipse([cx-dot,cy-r//2-dot,cx+dot,cy-r//2+dot], fill=(150,255,220,235))
    d.ellipse([cx-dot,cy+r//2-dot,cx+dot,cy+r//2+dot], fill=(15,40,30,235))
    # Gold ring
    d.ellipse([cx-r,cy-r,cx+r,cy+r], outline=(240,192,64,200), width=5)
    return Image.alpha_composite(base, layer)

img = draw_yinyang(img, yy_cx, yy_cy, yy_r)

# ── MEDITATING FIGURE ─────────────────────────────────────────────────────
fig = Image.new('RGBA',(SIZE,SIZE),(0,0,0,0))
fd  = ImageDraw.Draw(fig)

GOLD  = (240,192,64,245)
LGOLD = (255,240,160,230)
fbase_y = 340

# Crossed legs platform
fd.ellipse([CX-72,fbase_y+8,CX+72,fbase_y+52], fill=GOLD)
# Legs detail
fd.polygon([(CX-72,fbase_y+30),(CX-45,fbase_y+60),(CX-10,fbase_y+50),(CX,fbase_y+30)], fill=GOLD)
fd.polygon([(CX+72,fbase_y+30),(CX+45,fbase_y+60),(CX+10,fbase_y+50),(CX,fbase_y+30)], fill=GOLD)

# Torso
fd.polygon([(CX-42,fbase_y+10),(CX-36,fbase_y-88),(CX+36,fbase_y-88),(CX+42,fbase_y+10)], fill=GOLD)

# Arms resting on knees
fd.line([(CX-42,fbase_y-30),(CX-68,fbase_y+22)], fill=GOLD, width=16)
fd.line([(CX+42,fbase_y-30),(CX+68,fbase_y+22)], fill=GOLD, width=16)
# Hands
fd.ellipse([CX-76,fbase_y+14,CX-56,fbase_y+30], fill=LGOLD)
fd.ellipse([CX+56,fbase_y+14,CX+76,fbase_y+30], fill=LGOLD)

# Head
head_y = fbase_y - 118
fd.ellipse([CX-36,head_y-36,CX+36,head_y+36], fill=GOLD)
# Face highlight
fd.ellipse([CX-18,head_y-18,CX+2,head_y+2], fill=(255,248,200,80))
# Hair bun / topknot
fd.ellipse([CX-12,head_y-52,CX+12,head_y-20], fill=LGOLD)
fd.ellipse([CX-8, head_y-62,CX+8, head_y-44], fill=(255,250,220,220))

# Halo
fd.ellipse([CX-56,head_y-56,CX+56,head_y+56], outline=(240,192,64,160), width=3)
fd.ellipse([CX-64,head_y-64,CX+64,head_y+64], outline=(240,192,64,80),  width=2)

# Glow the whole figure
fig_blurred = fig.filter(ImageFilter.GaussianBlur(14))
img = Image.alpha_composite(img, fig_blurred)
img = Image.alpha_composite(img, fig)

# ── FLOATING ENERGY PARTICLES ─────────────────────────────────────────────
particles = [
    (460,195,5,(170,255,230,200)),(492,155,4,(240,192,64,220)),
    (540,170,6,(170,255,230,180)),(563,205,4,(240,192,64,200)),
    (436,240,3,(170,255,230,160)),(587,235,3,(170,255,230,160)),
    (508,135,3,(255,240,180,180)),(475,120,2,(170,255,230,140)),
    (550,125,2,(255,240,180,140)),(412,180,2,(170,255,230,120)),
    (614,195,2,(170,255,230,120)),
]
pl = Image.new('RGBA',(SIZE,SIZE),(0,0,0,0))
pd = ImageDraw.Draw(pl)
for px2,py2,pr,pc in particles:
    pd.ellipse([px2-pr,py2-pr,px2+pr,py2+pr], fill=pc)
pl_blur = pl.filter(ImageFilter.GaussianBlur(4))
img = Image.alpha_composite(img, pl_blur)
img = Image.alpha_composite(img, pl)

# ── OUTER GOLD DECORATIVE RING ─────────────────────────────────────────────
ring = Image.new('RGBA',(SIZE,SIZE),(0,0,0,0))
rd = ImageDraw.Draw(ring)
rd.ellipse([CX-410,CY-410,CX+410,CY+410], outline=(240,192,64,110), width=3)
rd.ellipse([CX-390,CY-390,CX+390,CY+390], outline=(240,192,64,70),  width=2)
# Tick marks every 30 degrees
for deg in range(0,360,30):
    rad = math.radians(deg)
    r1,r2 = 385, 370 if deg%90==0 else 376
    x1 = CX + r1*math.cos(rad); y1 = CY + r1*math.sin(rad)
    x2 = CX + r2*math.cos(rad); y2 = CY + r2*math.sin(rad)
    rd.line([(x1,y1),(x2,y2)], fill=(240,192,64,140), width=3)
img = Image.alpha_composite(img, ring)

# ── BOTTOM TEXT BANNER ─────────────────────────────────────────────────────
banner = Image.new('RGBA',(SIZE,SIZE),(0,0,0,0))
bd = ImageDraw.Draw(banner)
# Banner background
bx1,by1,bx2,by2 = 80, 800, 944, 960
bd.rounded_rectangle([bx1,by1,bx2,by2], radius=20, fill=(8,5,20,185))
bd.rounded_rectangle([bx1,by1,bx2,by2], radius=20, outline=(200,160,40,140), width=2)

# Try to load a serif font, fall back to default
def load_font(size):
    candidates = [
        '/System/Library/Fonts/Supplemental/Georgia.ttf',
        '/System/Library/Fonts/Supplemental/Times New Roman.ttf',
        '/System/Library/Fonts/NewYork.ttf',
        '/System/Library/Fonts/Helvetica.ttc',
        '/Library/Fonts/Arial.ttf',
    ]
    for path in candidates:
        if os.path.exists(path):
            try: return ImageFont.truetype(path, size)
            except: pass
    return ImageFont.load_default()

font_title = load_font(72)
font_sub   = load_font(52)

# "PATH TO"
text1 = "PATH TO"
bbox1 = bd.textbbox((0,0), text1, font=font_title)
tw1 = bbox1[2]-bbox1[0]
bd.text(((SIZE-tw1)//2, 820), text1, font=font_title, fill=(240,192,64,240))

# "IMMORTALITY"
text2 = "IMMORTALITY"
bbox2 = bd.textbbox((0,0), text2, font=font_sub)
tw2 = bbox2[2]-bbox2[0]
bd.text(((SIZE-tw2)//2, 898), text2, font=font_sub, fill=(170,255,230,230))

img = Image.alpha_composite(img, banner)

# ── VIGNETTE ──────────────────────────────────────────────────────────────
vig = Image.new('RGBA',(SIZE,SIZE),(0,0,0,0))
vd  = ImageDraw.Draw(vig)
for step in range(30):
    frac = step/30
    r_v  = int(SIZE*0.52 + SIZE*0.38*frac)
    a    = int(frac**2 * 160)
    vd.ellipse([SIZE//2-r_v,SIZE//2-r_v,SIZE//2+r_v,SIZE//2+r_v],
               outline=(0,0,0,a), width=SIZE//30)
img = Image.alpha_composite(img, vig)

# ── ROUNDED SQUARE CLIP (Android adaptive icon style) ──────────────────────
mask = Image.new('L',(SIZE,SIZE),0)
ImageDraw.Draw(mask).rounded_rectangle([0,0,SIZE,SIZE], radius=int(SIZE*0.2), fill=255)
img.putalpha(mask)

# ── SAVE ──────────────────────────────────────────────────────────────────
img.save(OUT, 'PNG', optimize=False)
print(f"Saved {SIZE}x{SIZE} icon → {OUT}")

# Generate all needed sizes
sizes = {
    'icon-512.png':   512,
    'icon-192.png':   192,
    'icon-144.png':   144,
    'icon-96.png':     96,
    'icon-72.png':     72,
    'icon-48.png':     48,
}
assets_dir = os.path.dirname(OUT)
for name, sz in sizes.items():
    out_path = os.path.join(assets_dir, name)
    img.resize((sz,sz), Image.LANCZOS).save(out_path, 'PNG')
    print(f"  → {name} ({sz}x{sz})")
