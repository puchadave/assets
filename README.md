# webOwie Assets

Zentrale, versionsstabile Asset-Bibliothek für webOwie, Subbrands und Partner-/Security-Brands.

Dieses Repository wird als öffentliche Quelle für Logos, Favicons, App-Icons, Banner, Social-Assets und Proxmox-Branding genutzt.

## Public Brand Portal

Das Repository enthält zusätzlich ein öffentliches Corporate-Design-Portal mit Markenarchitektur, Logo-Verwendung, Gestaltungsprinzipien, Asset-Index und Nutzungsrichtlinien.

- Portal-Quellcode: `index.html`, `brand.css`, `brand.js`
- Maschinenlesbarer Brand-Index: `assets/img/manifest.json`
- Pages-Branch: `gh-pages`
- Vorgesehene GitHub-Pages-URL: `https://puchadave.github.io/assets/`

GitHub Pages muss einmalig in den Repository-Einstellungen auf **Deploy from a branch → `gh-pages` → `/ (root)`** gestellt werden. Danach kann die Seite direkt unter der oben genannten URL ausgeliefert werden.

## Pfade

- `assets/img/webOwie/corporate/`
- `assets/img/webOwie/subbrands/AI/`
- `assets/img/webOwie/subbrands/nodeOS/`
- `assets/img/webOwie/subbrands/search/`
- `assets/img/puchalla.pro/corporate/`
- `assets/img/bnd.zone/corporate/`
- `assets/img/bnd.zone/subbrands/cybersicherheit/`
- `proxmox/`

### webOwie AI

Der Subbrand `webOwie AI` verwendet die webOwie-Dachmarke unverändert und kennzeichnet den AI-Produktbereich ausschließlich über das untergeordnete Node-Cyan-Modul. Das kanonische Set liegt unter `assets/img/webOwie/subbrands/AI/` und enthält Dark-/Light-Lockups, Stacked-Varianten, Monochrom, App-Icon, Favicon, GitHub-Social-Preview und `brand.json`.

Maschinenlesbarer Index: `assets/img/manifest.json`

## Tests

Die Python- und JavaScript-Suiten werden getrennt ausgeführt. Für die Python-Tests
werden die Entwicklungsabhängigkeiten installiert:

```sh
python3 -m pip install -r requirements-dev.txt
python3 -m pytest --cov=scripts --cov-report=term-missing
```

Für die Tests des Brand-Portals:

```sh
npm ci
npm run test:coverage
```

## Asset-Prinzip

SVG und ausdrücklich bereitgestellte Originaldateien sind die visuelle Quelle der Wahrheit. Abgeleitete PNG/JPG-Dateien dürfen automatisiert erzeugt werden, sollen die Originale aber nicht ersetzen. Bestehende Pfade sollten möglichst stabil bleiben, damit Websites, Installer, Forks und Automatisierungen nicht durch Umbenennungen brechen.
