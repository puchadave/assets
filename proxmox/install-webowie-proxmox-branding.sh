#!/usr/bin/env bash
set -Eeuo pipefail
BRANCH="${WEBOWIE_ASSETS_BRANCH:-main}"
RAW="https://raw.githubusercontent.com/puchadave/assets/${BRANCH}/assets/img/webOwie/corporate/proxmox"
BACKUP_ROOT="/var/backups/webowie-pve-branding"
PVE_IMAGES="/usr/share/pve-manager/images"
WTK_IMAGES="/usr/share/javascript/proxmox-widget-toolkit/images"
PVE_INDEX="/usr/share/pve-manager/index.html.tpl"
INSTALL="/usr/local/share/webowie-branding"
log(){ printf '\033[38;2;93;217;232m[webOwie]\033[0m %s\n' "$*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || die "Run as root."
command -v pveversion >/dev/null || die "Proxmox VE not detected."
command -v curl >/dev/null || die "curl is required."
case "${1:---install}" in
  --install)
    stamp="$(date +%Y%m%d-%H%M%S)"; backup="$BACKUP_ROOT/$stamp"; mkdir -p "$backup" "$INSTALL"
    for f in "$PVE_IMAGES/proxmox_logo.png" "$PVE_IMAGES/logo-128.png" "$PVE_IMAGES/favicon.ico" "$PVE_IMAGES/dd_logo.png" "$WTK_IMAGES/proxmox_logo.svg" "$PVE_INDEX"; do [[ -f "$f" ]] || continue; mkdir -p "$backup$(dirname "$f")"; cp -a "$f" "$backup$f"; done
    printf '%s\n' "$backup" >"$BACKUP_ROOT/.last"
    for f in proxmox_logo.png logo-128.png dd_logo.png favicon.ico proxmox_logo.svg pve-background-1920x1080.png; do curl -fsSL "$RAW/$f" -o "$INSTALL/$f"; done
    install -m0644 "$INSTALL/proxmox_logo.png" "$PVE_IMAGES/proxmox_logo.png"
    install -m0644 "$INSTALL/logo-128.png" "$PVE_IMAGES/logo-128.png"
    install -m0644 "$INSTALL/favicon.ico" "$PVE_IMAGES/favicon.ico"
    [[ -e "$PVE_IMAGES/dd_logo.png" ]] && install -m0644 "$INSTALL/dd_logo.png" "$PVE_IMAGES/dd_logo.png"
    [[ -e "$WTK_IMAGES/proxmox_logo.svg" ]] && install -m0644 "$INSTALL/proxmox_logo.svg" "$WTK_IMAGES/proxmox_logo.svg"
    install -m0644 "$INSTALL/pve-background-1920x1080.png" "$PVE_IMAGES/webowie-background.png"
    if [[ -f "$PVE_INDEX" ]]; then
      sed -i '/<!-- WEBOWIE-BRANDING-BEGIN -->/,/<!-- WEBOWIE-BRANDING-END -->/d' "$PVE_INDEX"
      sed -i -E 's#<title>[^<]*</title>#<title>webOwie Infrastructure Control Plane · puchalla.it.com</title>#' "$PVE_INDEX"
      sed -i '/<\/head>/i\
<!-- WEBOWIE-BRANDING-BEGIN -->\
<meta name="theme-color" content="#000000">\
<style id="webowie-branding">body:after{content:"webOwie · puchalla.it.com · Powered by Proxmox VE";position:fixed;right:14px;bottom:8px;z-index:2147483647;pointer-events:none;font:11px Arial,sans-serif;letter-spacing:.7px;color:#5DD9E8;opacity:.48}</style>\
<!-- WEBOWIE-BRANDING-END -->' "$PVE_INDEX"
    fi
    install -m0755 "$0" /usr/local/sbin/webowie-pve-branding
    cat >/etc/apt/apt.conf.d/99-webowie-branding <<'EOF'
DPkg::Post-Invoke { "if [ -x /usr/local/sbin/webowie-pve-branding ]; then /usr/local/sbin/webowie-pve-branding --reapply >/dev/null 2>&1 || true; fi"; };
EOF
    systemctl restart pveproxy.service; log "Installed. Backup: $backup" ;;
  --reapply)
    [[ -d "$INSTALL" ]] || die "Brand assets are not installed."
    install -m0644 "$INSTALL/proxmox_logo.png" "$PVE_IMAGES/proxmox_logo.png"; install -m0644 "$INSTALL/logo-128.png" "$PVE_IMAGES/logo-128.png"; install -m0644 "$INSTALL/favicon.ico" "$PVE_IMAGES/favicon.ico"
    [[ -e "$PVE_IMAGES/dd_logo.png" ]] && install -m0644 "$INSTALL/dd_logo.png" "$PVE_IMAGES/dd_logo.png"
    [[ -e "$WTK_IMAGES/proxmox_logo.svg" ]] && install -m0644 "$INSTALL/proxmox_logo.svg" "$WTK_IMAGES/proxmox_logo.svg" ;;
  --restore)
    backup="$(cat "$BACKUP_ROOT/.last" 2>/dev/null || true)"; [[ -d "$backup" ]] || die "No backup found."
    while IFS= read -r -d '' src; do dst="${src#$backup}"; mkdir -p "$(dirname "$dst")"; cp -a "$src" "$dst"; done < <(find "$backup" -type f -print0)
    rm -f /etc/apt/apt.conf.d/99-webowie-branding; systemctl restart pveproxy.service; log "Restored $backup" ;;
  --status) echo "webOwie PVE Branding"; echo "Asset branch: $BRANCH"; echo "Source: $RAW"; pveversion | head -1 ;;
  *) die "Usage: $0 [--install|--reapply|--restore|--status]" ;;
esac
