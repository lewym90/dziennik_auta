"""Generuje ikony PNG aplikacji Dziennik Auta (wymaga Pillow).
Uruchom:  python3 tools/gen_icons.py
"""
from PIL import Image, ImageDraw, ImageFilter
import math, os

OUT = os.path.join(os.path.dirname(__file__), "..", "icons")
os.makedirs(OUT, exist_ok=True)

C1 = (124, 92, 255)   # fiolet
C2 = (34, 211, 238)   # cyjan


def gradient(size):
    """Przekątny gradient fiolet -> cyjan + miękkie światło."""
    base = Image.new("RGB", (size, size))
    px = base.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = tuple(int(C1[i] + (C2[i] - C1[i]) * t) for i in range(3))
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    r = int(size * 0.55)
    gd.ellipse((-r // 2, -r // 2, r + r // 2, r + r // 2), fill=(255, 255, 255, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.12))
    base = base.convert("RGBA")
    base.alpha_composite(glow)
    return base


def draw_mark(img, scale):
    """Rysuje zegar (licznik) w układzie 120x120 przeskalowany do obrazu."""
    S = img.size[0]
    k = S / 120 * scale
    ox = S / 2 - 60 * k
    oy = S / 2 - 60 * k
    d = ImageDraw.Draw(img)

    def P(x, y):
        return (ox + x * k, oy + y * k)

    cx, cy, r = 60, 66, 36
    w = 9 * k
    # cień pod znakiem
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    for dx, dy in ((0, 3),):
        bb = [P(cx - r, cy - r + dy), P(cx + r, cy + r + dy)]
        sd.arc([bb[0][0], bb[0][1], bb[1][0], bb[1][1]], 153.4, 386.6, fill=(20, 10, 60, 110), width=int(w))
        sd.line([P(60, 66 + dy), P(78, 44 + dy)], fill=(20, 10, 60, 110), width=int(8 * k))
    sh = sh.filter(ImageFilter.GaussianBlur(3 * k))
    img.alpha_composite(sh)

    bb = [P(cx - r, cy - r), P(cx + r, cy + r)]
    d.arc([bb[0][0], bb[0][1], bb[1][0], bb[1][1]], 153.4, 386.6, fill=(255, 255, 255, 255), width=int(w))
    for ang in (153.4, 26.6):
        a = math.radians(ang)
        ex, ey = cx + r * math.cos(a), cy + r * math.sin(a)
        p = P(ex, ey)
        rr = w / 2
        d.ellipse((p[0] - rr, p[1] - rr, p[0] + rr, p[1] + rr), fill=(255, 255, 255, 255))
    # kreski podziałki
    for ang in (200, 235, 270, 305, 340):
        a = math.radians(ang)
        p1 = P(cx + (r - 13) * math.cos(a), cy + (r - 13) * math.sin(a))
        p2 = P(cx + (r - 19) * math.cos(a), cy + (r - 19) * math.sin(a))
        d.line([p1, p2], fill=(255, 255, 255, 190), width=max(1, int(3 * k)))
    # wskazówka
    a, b = P(60, 66), P(78, 44)
    d.line([a, b], fill=(255, 255, 255, 255), width=int(8 * k))
    rr = 4 * k
    d.ellipse((b[0] - rr, b[1] - rr, b[0] + rr, b[1] + rr), fill=(255, 255, 255, 255))
    rr = 9 * k
    d.ellipse((a[0] - rr, a[1] - rr, a[0] + rr, a[1] + rr), fill=(255, 255, 255, 255))
    rr = 3.6 * k
    d.ellipse((a[0] - rr, a[1] - rr, a[0] + rr, a[1] + rr), fill=(109, 100, 245, 255))
    # drobny „samochód”: dwa reflektory pod licznikiem
    for hx in (44, 76):
        p = P(hx, 96)
        rr = 4.2 * k
        d.ellipse((p[0] - rr, p[1] - rr, p[0] + rr, p[1] + rr), fill=(255, 255, 255, 235))
    d.rounded_rectangle([*P(50, 93.5), *P(70, 98.5)], radius=2.5 * k, fill=(255, 255, 255, 235))


def make(size, scale=1.0, rounded=False, ss=3):
    big = size * ss
    img = gradient(big)
    draw_mark(img, scale)
    if rounded:
        mask = Image.new("L", (big, big), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, big - 1, big - 1), radius=int(big * 0.23), fill=255)
        out = Image.new("RGBA", (big, big), (0, 0, 0, 0))
        out.paste(img, (0, 0), mask)
        img = out
    return img.resize((size, size), Image.LANCZOS)


make(192, 1.0).save(os.path.join(OUT, "icon-192.png"))
make(512, 1.0).save(os.path.join(OUT, "icon-512.png"))
make(512, 0.72).save(os.path.join(OUT, "icon-maskable-512.png"))   # strefa bezpieczna
make(180, 1.0).convert("RGB").save(os.path.join(OUT, "apple-touch-icon.png"))
make(32, 1.0, rounded=True).save(os.path.join(OUT, "favicon-32.png"))

svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs><rect width="120" height="120" rx="28" fill="url(#g)"/><path d="M28 82a36 36 0 1 1 64 0" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/><path d="M60 66 78 44" stroke="#fff" stroke-width="8" stroke-linecap="round"/><circle cx="60" cy="66" r="9" fill="#fff"/><circle cx="60" cy="66" r="3.6" fill="#6d64f5"/><circle cx="44" cy="96" r="4.2" fill="#fff"/><circle cx="76" cy="96" r="4.2" fill="#fff"/><rect x="50" y="93.5" width="20" height="5" rx="2.5" fill="#fff"/></svg>"""
open(os.path.join(OUT, "favicon.svg"), "w").write(svg)
print("OK")
