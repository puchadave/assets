"""Shared rendering utilities for the webOwie brand asset pipeline.

Canonical helpers for turning SVG sources into the raster deliverables
(logos, favicons, app icons, banners, social covers) plus the size tables
that define those deliverables.
"""
from functools import lru_cache
from pathlib import Path

import cairosvg
import io

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "img"

FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

BLACK = "#000000"
TRANSPARENT = (0, 0, 0, 0)
TEXT_PRIMARY = "#F5F5F5"
TEXT_SECONDARY = "#BFC3C7"
TEXT_MUTED = "#8E949A"
DEFAULT_ACCENT = "#5DD9E8"

LOGO_WIDTH = 1800
ICON_WIDTH = 1024

FAVICON_SIZES = [16, 32, 48, 64, 96, 128, 256, 512]
FAVICON_ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

# name -> (size, padding, background)
APP_ICONS = {
    "apple-touch-icon.png": ((180, 180), 24, BLACK),
    "android-chrome-192x192.png": ((192, 192), 26, BLACK),
    "android-chrome-512x512.png": ((512, 512), 66, BLACK),
    "pwa-maskable-512x512.png": ((512, 512), 62, TRANSPARENT),
}

BANNER_SIZES = {
    "banner-1920x480.png": (1920, 480),
    "banner-1920x640.png": (1920, 640),
    "banner-1200x300.png": (1200, 300),
}

SOCIAL_SIZES = {
    "og-image-1200x630.png": (1200, 630),
    "github-social-preview-1280x640.png": (1280, 640),
    "x-cover-1500x500.png": (1500, 500),
    "linkedin-cover-1584x396.png": (1584, 396),
    "facebook-cover-1640x624.png": (1640, 624),
    "youtube-banner-2560x1440.png": (2560, 1440),
}


def fnt(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


def hex_to_rgb(value):
    return tuple(int(value[i:i + 2], 16) for i in (1, 3, 5))


def ensure_dir(path):
    path.mkdir(parents=True, exist_ok=True)
    return path


@lru_cache(maxsize=None)
def render_svg(path, width=1600):
    data = cairosvg.svg2png(url=str(path), output_width=width)
    return Image.open(io.BytesIO(data)).convert("RGBA")


def contain(img, size, padding=0, bg=TRANSPARENT):
    c = Image.new("RGBA", size, bg)
    x = img.copy().convert("RGBA")
    x.thumbnail((max(1, size[0] - 2 * padding), max(1, size[1] - 2 * padding)), Image.Resampling.LANCZOS)
    c.alpha_composite(x, ((size[0] - x.width) // 2, (size[1] - x.height) // 2))
    return c


def save_contain(img, out, size, padding=0, bg=TRANSPARENT):
    ensure_dir(out.parent)
    contain(img, size, padding, bg).save(out)


def favicon(icon, out):
    ensure_dir(out.parent)
    base = contain(icon, (512, 512), 72, BLACK)
    base.save(out, format="ICO", sizes=FAVICON_ICO_SIZES)


def favicon_set(icon, out_dir):
    """favicon.ico plus the full square PNG ladder."""
    favicon(icon, out_dir / "favicon.ico")
    for n in FAVICON_SIZES:
        save_contain(icon, out_dir / f"favicon-{n}x{n}.png", (n, n), max(1, int(n * .16)), BLACK)


def app_icon_set(icon, out_dir):
    for name, (size, padding, bg) in APP_ICONS.items():
        save_contain(icon, out_dir / name, size, padding, bg)


def grid(size, accent):
    w, h = size
    im = Image.new("RGBA", size, BLACK)
    d = ImageDraw.Draw(im)
    for x in range(0, w, 80):
        d.line((x, 0, x, h), fill=(35, 38, 42, 90))
    for y in range(0, h, 80):
        d.line((0, y, w, y), fill=(35, 38, 42, 90))
    rgb = hex_to_rgb(accent)
    d.rectangle((0, 0, 10, h), fill=rgb + (255,))
    d.rectangle((10, 0, 18, h), fill=rgb + (70,))
    return im


def banner(logo, cfg, size, label):
    w, h = size
    accent = cfg.get("accent", DEFAULT_ACCENT)
    bg = grid(size, accent)
    lg = logo.copy()
    lg.thumbnail((int(w * .48), int(h * .55)), Image.Resampling.LANCZOS)
    bg.alpha_composite(lg, (int(w * .05), int(h * .18)))
    d = ImageDraw.Draw(bg)
    x = int(w * .58)
    y = int(h * .24)
    brand_size = max(28, int(h * .07))
    tagline_size = max(14, int(h * .035))
    d.text((x, y), cfg["brand"], font=fnt(brand_size, True), fill=TEXT_PRIMARY)
    d.text((x, y + brand_size + 12), cfg["tagline"], font=fnt(tagline_size), fill=accent)
    if cfg.get("domain"):
        d.text((x, y + brand_size + tagline_size + 44), cfg["domain"], font=fnt(max(14, int(h * .028))), fill=TEXT_SECONDARY)
    d.text((int(w * .05), h - int(h * .09)), f"{label.upper()} · OFFICIAL BRAND ASSET", font=fnt(max(11, int(h * .021))), fill=TEXT_MUTED)
    return bg.convert("RGB")


def banner_set(logo, cfg, out_dir, sizes, label):
    ensure_dir(out_dir)
    for name, size in sizes.items():
        banner(logo, cfg, size, label).save(out_dir / name)
