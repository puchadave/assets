#!/usr/bin/env python3
"""Build all generated webOwie brand assets from canonical SVG sources.

Dependencies:
    python -m pip install pillow cairosvg

Outputs for every brand:
    logos/png/
    favicons/
    app-icons/
    banners/
    social/

Additionally for webOwie:
    assets/img/webOwie/corporate/proxmox/

Shared rendering helpers live in scripts/brandkit.py.
"""
import json
import shutil

from PIL import ImageDraw

from brandkit import (
    ASSETS,
    BANNER_SIZES,
    BLACK,
    DEFAULT_ACCENT,
    ICON_WIDTH,
    LOGO_WIDTH,
    SOCIAL_SIZES,
    TEXT_PRIMARY,
    TEXT_SECONDARY,
    TRANSPARENT,
    app_icon_set,
    banner_set,
    contain,
    ensure_dir,
    favicon,
    favicon_set,
    fnt,
    grid,
    render_svg,
    save_contain,
)

WEBOWIE_LOGO_SVG = "webOwie_horizontal_transparent.svg"
WEBOWIE_ICON_SVG = "webOwie_icon.svg"

BRANDS = [
 ("webOwie/corporate", WEBOWIE_LOGO_SVG, WEBOWIE_ICON_SVG, DEFAULT_ACCENT),
 ("webOwie/subbrands/nodeOS", "webOwie_nodeOS_horizontal_fixed.svg", "webOwie_nodeOS_icon.svg", DEFAULT_ACCENT),
 ("webOwie/subbrands/search", "search_webOwie_horizontal.svg", "search_webOwie_icon.svg", "#FF2A2A"),
 ("puchalla.pro/corporate", "puchalla.pro_horizontal.svg", "puchalla.pro_icon.svg", "#F5F5F5"),
 ("bnd.zone/corporate", "bnd.zone_horizontal.svg", "bnd.zone_icon.svg", "#F5F5F5"),
 ("bnd.zone/subbrands/cybersicherheit", "bnd.zone_cybersicherheit_horizontal.svg", "bnd.zone_cybersicherheit_icon.svg", "#001A44"),
]


def build_brand(rel, logo_name, icon_name, accent):
    base = ASSETS / rel
    cfg = json.loads((base / "brand.json").read_text())
    cfg["accent"] = accent
    svgdir = base / "logos/svg"
    logo = render_svg(svgdir / logo_name, LOGO_WIDTH)
    icon = render_svg(svgdir / icon_name, ICON_WIDTH)

    out_logo = ensure_dir(base / "logos/png")
    logo.save(out_logo / "logo-primary.png")
    save_contain(logo, out_logo / "logo-primary-dark.png", (2048, 600), 72, BLACK)

    favicon_set(icon, ensure_dir(base / "favicons"))
    app_icon_set(icon, ensure_dir(base / "app-icons"))
    banner_set(logo, cfg, base / "banners", BANNER_SIZES, "banner")
    banner_set(logo, cfg, base / "social", SOCIAL_SIZES, "social")


def build_proxmox():
    web = ASSETS / "webOwie/corporate"
    svgdir = web / "logos/svg"
    pve = ensure_dir(web / "proxmox")
    logo = render_svg(svgdir / WEBOWIE_LOGO_SVG, LOGO_WIDTH)
    icon = render_svg(svgdir / WEBOWIE_ICON_SVG, ICON_WIDTH)

    save_contain(logo, pve / "proxmox_logo.png", (209, 30), 1, TRANSPARENT)
    for name in ("logo-128.png", "dd_logo.png"):
        save_contain(icon, pve / name, (128, 128), 18, BLACK)
    favicon(icon, pve / "favicon.ico")
    shutil.copy2(svgdir / WEBOWIE_LOGO_SVG, pve / "proxmox_logo.svg")

    bg = grid((1920, 1080), DEFAULT_ACCENT)
    wm = contain(icon, (620, 620), 80, TRANSPARENT)
    wm.putalpha(wm.getchannel("A").point(lambda a: int(a * .11)))
    bg.alpha_composite(wm, (1200, 310))
    d = ImageDraw.Draw(bg)
    d.text((90, 900), "webOwie  //  INFRASTRUCTURE CONTROL PLANE", font=fnt(34, True), fill=TEXT_PRIMARY)
    d.text((90, 955), "puchalla.it.com   ·   Powered by Proxmox VE", font=fnt(22), fill=TEXT_SECONDARY)
    bg.convert("RGB").save(pve / "pve-background-1920x1080.png")


def main():
    for brand in BRANDS:
        build_brand(*brand)
    build_proxmox()
    print("Generated complete brand asset sets and Proxmox exports.")


if __name__ == "__main__":
    main()
