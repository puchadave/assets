# webOwie Assets

Zentrale, dauerhaft referenzierbare Asset-Quelle für das webOwie-Ökosystem und kommende Forks.

## Marken

- `assets/img/webOwie/corporate/` — webOwie Parent Brand
- `assets/img/webOwie/subbrands/nodeOS/` — nodeOS (`nodeOS.webOwie.live`)
- `assets/img/webOwie/subbrands/search/` — search webOwie
- `assets/img/puchalla.pro/corporate/` — puchalla.pro
- `assets/img/bnd.zone/corporate/` — bnd.zone
- `assets/img/bnd.zone/subbrands/cybersicherheit/` — bnd.zone Cybersicherheit

## Nutzung in Forks

Die kanonischen Logos liegen als SVG vor und können über `raw.githubusercontent.com` direkt referenziert werden.

Raster-/Favicon-/Banner-/Social-Sets werden reproduzierbar aus den SVG-Quellen erzeugt:

```bash
python3 -m pip install pillow cairosvg
python3 scripts/build-assets.py
```

## Proxmox

Self-contained One-Click-Installer:

```bash
bash proxmox/install-webowie-proxmox-branding.sh
```

Der Installer enthält die benötigten Proxmox-Bilder bereits eingebettet.

## Struktur

```text
assets/img/
├── webOwie/
│   ├── corporate/
│   └── subbrands/
│       ├── nodeOS/
│       └── search/
├── puchalla.pro/
│   └── corporate/
└── bnd.zone/
    ├── corporate/
    └── subbrands/
        └── cybersicherheit/
```

`assets/img/manifest.json` ist die maschinenlesbare Brand-Registry.
