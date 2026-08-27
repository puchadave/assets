import importlib.util
import io
import json
import sys
from pathlib import Path
from types import ModuleType

import pytest
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("build_assets", ROOT / "scripts" / "build-assets.py")
build_assets = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(build_assets)


def test_fnt_returns_truetype_and_variants_differ():
    if not Path(build_assets.FONT_REG).exists() or not Path(build_assets.FONT_BOLD).exists():
        pytest.skip("DejaVu fonts are unavailable")
    regular = build_assets.fnt(24)
    bold = build_assets.fnt(24, True)
    assert isinstance(regular, ImageFont.FreeTypeFont)
    assert isinstance(bold, ImageFont.FreeTypeFont)
    regular_image = Image.new("L", (180, 40))
    bold_image = Image.new("L", (180, 40))
    ImageDraw.Draw(regular_image).text((0, 0), "webOwie", font=regular, fill=255)
    ImageDraw.Draw(bold_image).text((0, 0), "webOwie", font=bold, fill=255)
    assert regular_image.tobytes() != bold_image.tobytes()


def test_contain_size_mode_padding_centering():
    source = Image.new("RGBA", (20, 10), (255, 0, 0, 255))
    result = build_assets.contain(source, (100, 80), padding=10, bg=(1, 2, 3, 0))
    assert result.size == (100, 80)
    assert result.mode == "RGBA"
    assert result.getpixel((0, 0)) == (1, 2, 3, 0)
    bbox = result.getchannel("A").getbbox()
    assert bbox == (40, 35, 60, 45)
    assert bbox[0] >= 10 and bbox[1] >= 10
    assert bbox[2] <= 90 and bbox[3] <= 70


@pytest.mark.parametrize("background, expected", [((1, 2, 3, 255), (1, 2, 3, 255)), ("#000000", (0, 0, 0, 255))])
def test_contain_applies_tuple_and_hex_background(background, expected):
    result = build_assets.contain(Image.new("RGBA", (1, 1)), (20, 20), bg=background)
    assert result.getpixel((0, 0)) == expected


def test_contain_handles_padding_larger_than_canvas():
    source = Image.new("RGBA", (10, 10), (12, 34, 56, 255))
    result = build_assets.contain(source, (20, 12), padding=100, bg=(0, 0, 0, 0))
    assert result.size == (20, 12)
    assert result.getchannel("A").getbbox() is not None


def test_favicon_creates_parent_and_is_reopenable(tmp_path):
    output = tmp_path / "nested" / "icons" / "favicon.ico"
    build_assets.favicon(Image.new("RGBA", (32, 32), (1, 2, 3, 255)), output)
    assert output.exists()
    with Image.open(output) as image:
        image.load()
        assert image.format == "ICO"
        assert image.size[0] >= 16


def test_grid_dimensions_mode_background_and_accent_alpha():
    result = build_assets.grid((40, 40), "#123456")
    assert result.size == (40, 40)
    assert result.mode == "RGBA"
    assert result.getpixel((0, 20)) == (18, 52, 86, 255)
    assert result.getpixel((10, 20)) == (18, 52, 86, 70)
    assert result.getpixel((20, 0)) == (35, 38, 42, 90)


def test_banner_defaults_accent_and_accepts_domain_and_labels():
    logo = Image.new("RGBA", (100, 50), (255, 255, 255, 255))
    without_domain = {"brand": "Test Brand", "tagline": "TAGLINE"}
    with_domain = {**without_domain, "domain": "example.test", "accent": "#123456"}
    first = build_assets.banner(logo, without_domain, (320, 120), "banner")
    second = build_assets.banner(logo, with_domain, (320, 120), "social")
    assert first.mode == "RGB"
    assert first.size == (320, 120)
    assert first.getpixel((0, 20)) == (93, 217, 232)
    assert second.mode == "RGB"
    assert second.size == (320, 120)
    assert second.getpixel((0, 20)) == (18, 52, 86)


def test_render_svg_forwards_width_and_returns_rgba(monkeypatch):
    source = Image.new("RGB", (3, 2), (10, 20, 30))
    encoded = io.BytesIO()
    source.save(encoded, format="PNG")
    calls = {}

    fake_cairosvg = ModuleType("cairosvg")

    def svg2png(**kwargs):
        calls.update(kwargs)
        return encoded.getvalue()

    fake_cairosvg.svg2png = svg2png
    monkeypatch.setitem(sys.modules, "cairosvg", fake_cairosvg)
    result = build_assets.render_svg(ROOT / "logo.svg", width=777)
    assert calls == {"url": str(ROOT / "logo.svg"), "output_width": 777}
    assert result.mode == "RGBA"
    assert result.size == (3, 2)


def test_brands_table_integrity():
    for rel, logo_name, icon_name, _accent in build_assets.BRANDS:
        base = build_assets.ASSETS / rel
        assert (base / "brand.json").is_file()
        json.loads((base / "brand.json").read_text())
        assert (base / "logos/svg" / logo_name).is_file()
        assert (base / "logos/svg" / icon_name).is_file()


def _fake_render_svg(_path, width=1600):
    return Image.new("RGBA", (max(2, width // 100), max(2, width // 200)), (255, 255, 255, 255))


def _assert_generated_set(base):
    expected = [
        "logos/png/logo-primary.png",
        "logos/png/logo-primary-dark.png",
        "favicons/favicon.ico",
        *(f"favicons/favicon-{size}x{size}.png" for size in [16, 32, 48, 64, 96, 128, 256, 512]),
        "app-icons/apple-touch-icon.png",
        "app-icons/android-chrome-192x192.png",
        "app-icons/android-chrome-512x512.png",
        "app-icons/pwa-maskable-512x512.png",
        "banners/banner-1920x480.png",
        "banners/banner-1920x640.png",
        "banners/banner-1200x300.png",
        "social/og-image-1200x630.png",
        "social/github-social-preview-1280x640.png",
        "social/x-cover-1500x500.png",
        "social/linkedin-cover-1584x396.png",
        "social/facebook-cover-1640x624.png",
        "social/youtube-banner-2560x1440.png",
    ]
    for relative in expected:
        assert (base / relative).is_file(), relative


def test_build_brand_generates_complete_set_without_cairosvg(tmp_path, monkeypatch):
    rel = Path("synthetic") / "corporate"
    base = tmp_path / rel
    (base / "logos/svg").mkdir(parents=True)
    (base / "logos/svg" / "logo.svg").write_text("<svg/>")
    (base / "logos/svg" / "icon.svg").write_text("<svg/>")
    (base / "brand.json").write_text(json.dumps({"brand": "Synthetic", "tagline": "TEST"}))
    monkeypatch.setattr(build_assets, "render_svg", _fake_render_svg)
    build_assets.build_brand(str(rel), "logo.svg", "icon.svg", "#123456", tmp_path)
    _assert_generated_set(base)


def test_main_generates_complete_set_for_configured_brand(tmp_path, monkeypatch, capsys):
    rel = Path("synthetic") / "corporate"
    base = tmp_path / rel
    (base / "logos/svg").mkdir(parents=True)
    (base / "logos/svg" / "logo.svg").write_text("<svg/>")
    (base / "logos/svg" / "icon.svg").write_text("<svg/>")
    (base / "brand.json").write_text(json.dumps({"brand": "Synthetic", "tagline": "TEST"}))
    monkeypatch.setattr(build_assets, "BRANDS", [(str(rel), "logo.svg", "icon.svg", "#123456")])
    monkeypatch.setattr(build_assets, "render_svg", _fake_render_svg)
    monkeypatch.setattr(build_assets, "build_proxmox", lambda assets_root: None)
    build_assets.main(tmp_path)
    _assert_generated_set(base)
    assert "Generated complete brand asset sets and Proxmox exports." in capsys.readouterr().out


def test_build_proxmox_generates_complete_set(tmp_path, monkeypatch):
    base = tmp_path / "webOwie" / "corporate"
    svgdir = base / "logos" / "svg"
    svgdir.mkdir(parents=True)
    logo_source = svgdir / "webOwie_horizontal_transparent.svg"
    icon_source = svgdir / "webOwie_icon.svg"
    logo_source.write_text("<svg>logo</svg>")
    icon_source.write_text("<svg>icon</svg>")
    monkeypatch.setattr(build_assets, "render_svg", _fake_render_svg)

    build_assets.build_proxmox(tmp_path)

    output = base / "proxmox"
    for relative in [
        "proxmox_logo.png",
        "logo-128.png",
        "dd_logo.png",
        "favicon.ico",
        "proxmox_logo.svg",
        "pve-background-1920x1080.png",
    ]:
        assert (output / relative).is_file(), relative
    assert (output / "proxmox_logo.svg").read_text() == logo_source.read_text()
    with Image.open(output / "pve-background-1920x1080.png") as background:
        assert background.mode == "RGB"
        assert background.size == (1920, 1080)
