# webOwie AI — Subbrand Logo System

`webOwie AI` is the AI product subbrand of the webOwie brand system. It is intended for OmniRoute, AI gateway, agent infrastructure, inference routing, local-model orchestration, automation and related product surfaces.

## Corporate design anchors

This set follows the canonical webOwie parent-brand definition:

- Obsidian Black `#000000`
- Signal White `#F5F5F5`
- Node Cyan `#5DD9E8`
- restrained structural greys (`#2B3138`, `#BFC3C7`)
- geometric hexagonal network mark
- system/Inter-style sans-serif typography
- no gradients, bevels, glow or decorative 3D effects in canonical assets

The existing parent symbol is not redrawn into an unrelated AI symbol. The `AI` designation remains subordinate and uses Node Cyan as its identifying signal.

## Canonical assets

- `logo-horizontal-dark.svg` — primary lockup for dark interfaces
- `logo-horizontal-light.svg` — primary lockup for light surfaces
- `logo-stacked-dark.svg` — stacked layout for dark surfaces
- `logo-stacked-light.svg` — stacked layout for light surfaces
- `logo-mono-white.svg` — one-colour white variant
- `icon-app.svg` — app/PWA/OmniRoute icon
- `favicon.svg` — small-size simplified mark
- `github-social-preview.svg` — 1280×640 GitHub/social preview
- `brand.json` — machine-readable subbrand definition

## Usage hierarchy

1. Use the horizontal lockup by default.
2. Use the stacked variant only when horizontal space is insufficient.
3. Use `icon-app.svg` for app launchers and PWA surfaces.
4. Use `favicon.svg` below 48 px instead of shrinking the complete wordmark.
5. Use monochrome only where production constraints require one colour.

## Clear space

Keep free space around the complete lockup at least equal to the diameter of the central cyan node. For headers, banners and social previews, use at least twice that amount.

## Minimum size

- horizontal logo: 220 px wide
- stacked logo: 180 px wide
- app icon: 48 px
- favicon: 16 px

## Do not

- recolour the parent geometry with arbitrary product colours
- replace the cyan central node
- merge `AI` into the parent geometry
- stretch, skew or rotate the mark
- add purple/blue gradients to canonical logos
- use glow, chrome, glass or 3D rendering in the source-of-truth SVGs
- promote `AI` visually above `webOwie`

## Naming

Preferred:

- `webOwie AI`
- `webOwie AI Gateway`
- `webOwie AI · OmniRoute`

The SVG files in this directory are the source of truth. PNG, ICO and raster exports should be generated from them and must not replace them.
