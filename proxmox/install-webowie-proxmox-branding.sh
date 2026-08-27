#!/usr/bin/env bash
set -Eeuo pipefail
BRANCH="${WEBOWIE_ASSETS_BRANCH:-main}"
RAW="https://raw.githubusercontent.com/puchadave/assets/${BRANCH}/assets/img/webOwie/corporate/proxmox"
BACKUP_ROOT="/var/backups/webowie-pve-branding"
PVE_IMAGES="/usr/share/pve-manager/images"
WTK_IMAGES="/usr/share/javascript/proxmox-widget-toolkit/images"
PVE_INDEX="/usr/share/pve-manager/index.html.tpl"
INSTALL="/usr/local/share/webowie-branding"
LOG_FILE="/var/log/webowie-pve-branding.log"
ASSETS=(proxmox_logo.png logo-128.png dd_logo.png favicon.ico proxmox_logo.svg pve-background-1920x1080.png)
log(){ printf '\033[38;2;93;217;232m[webOwie]\033[0m %s\n' "$*"; }
warn(){ echo "WARN: $*" >&2; }
die(){ echo "ERROR: $*" >&2; exit 1; }
trap 'echo "ERROR: ${BASH_SOURCE[0]}: aborted with status $? at line $LINENO: ${BASH_COMMAND}" >&2' ERR
[[ $EUID -eq 0 ]] || die "Run as root."
command -v pveversion >/dev/null || die "Proxmox VE not detected."
command -v curl >/dev/null || die "curl is required."

fetch_assets(){
  local stage="$1" f
  for f in "${ASSETS[@]}"; do
    curl -fsSL --retry 3 --connect-timeout 20 "$RAW/$f" -o "$stage/$f" \
      || die "Could not download $RAW/$f (branch '$BRANCH'). Existing branding was left untouched."
    [[ -s "$stage/$f" ]] || die "Downloaded asset is empty: $RAW/$f"
  done
}

apply_assets(){
  local f
  for f in "${ASSETS[@]}"; do
    [[ -s "$INSTALL/$f" ]] || die "Brand asset missing or empty: $INSTALL/$f. Run '$0 --install' again."
  done
  install -m0644 "$INSTALL/proxmox_logo.png" "$PVE_IMAGES/proxmox_logo.png"
  install -m0644 "$INSTALL/logo-128.png" "$PVE_IMAGES/logo-128.png"
  install -m0644 "$INSTALL/favicon.ico" "$PVE_IMAGES/favicon.ico"
  if [[ -e "$PVE_IMAGES/dd_logo.png" ]]; then install -m0644 "$INSTALL/dd_logo.png" "$PVE_IMAGES/dd_logo.png"; fi
  if [[ -e "$WTK_IMAGES/proxmox_logo.svg" ]]; then
    install -m0644 "$INSTALL/proxmox_logo.svg" "$WTK_IMAGES/proxmox_logo.svg"
  else
    warn "Widget-toolkit logo not found at $WTK_IMAGES/proxmox_logo.svg; skipping that override."
  fi
}

brand_index(){
  [[ -f "$PVE_INDEX" ]] || { warn "$PVE_INDEX not found; skipping HTML branding."; return 0; }
  grep -q '</head>' "$PVE_INDEX" || die "No </head> found in $PVE_INDEX; HTML branding cannot be injected."
  sed -i '/<!-- WEBOWIE-BRANDING-BEGIN -->/,/<!-- WEBOWIE-BRANDING-END -->/d' "$PVE_INDEX"
  sed -i -E 's#<title>[^<]*</title>#<title>webOwie Infrastructure Control Plane · puchalla.it.com</title>#' "$PVE_INDEX"
  sed -i '/<\/head>/i\
<!-- WEBOWIE-BRANDING-BEGIN -->\
<meta name="theme-color" content="#000000">\
<style id="webowie-branding">body:after{content:"webOwie · puchalla.it.com · Powered by Proxmox VE";position:fixed;right:14px;bottom:8px;z-index:2147483647;pointer-events:none;font:11px Arial,sans-serif;letter-spacing:.7px;color:#5DD9E8;opacity:.48}</style>\
<!-- WEBOWIE-BRANDING-END -->' "$PVE_INDEX"
  grep -q 'WEBOWIE-BRANDING-BEGIN' "$PVE_INDEX" || die "HTML branding block was not written to $PVE_INDEX."
}

case "${1:---install}" in
  --install)
    [[ -f "$0" && -r "$0" ]] || die "Cannot self-install: run the script from a file, not from a pipe (curl -fsSL ... -o install.sh && bash install.sh)."
    stamp="$(date +%Y%m%d-%H%M%S)"; backup="$BACKUP_ROOT/$stamp"; mkdir -p "$backup" "$INSTALL"
    for f in "$PVE_IMAGES/proxmox_logo.png" "$PVE_IMAGES/logo-128.png" "$PVE_IMAGES/favicon.ico" "$PVE_IMAGES/dd_logo.png" "$WTK_IMAGES/proxmox_logo.svg" "$PVE_INDEX"; do [[ -f "$f" ]] || continue; mkdir -p "$backup$(dirname "$f")"; cp -a "$f" "$backup$f"; done
    printf '%s\n' "$backup" >"$BACKUP_ROOT/.last"
    stage="$(mktemp -d)"; trap 'rm -rf "$stage"' EXIT
    fetch_assets "$stage"
    for f in "${ASSETS[@]}"; do install -m0644 "$stage/$f" "$INSTALL/$f"; done
    apply_assets
    install -m0644 "$INSTALL/pve-background-1920x1080.png" "$PVE_IMAGES/webowie-background.png"
    brand_index
    install -m0755 "$0" /usr/local/sbin/webowie-pve-branding
    cat >/etc/apt/apt.conf.d/99-webowie-branding <<EOF
DPkg::Post-Invoke { "if [ -x /usr/local/sbin/webowie-pve-branding ]; then /usr/local/sbin/webowie-pve-branding --reapply >>${LOG_FILE} 2>&1 || echo \"\$(date -Is) webowie-pve-branding --reapply failed\" >>${LOG_FILE}; fi"; };
EOF
    systemctl restart pveproxy.service || die "Branding installed, but restarting pveproxy.service failed. Check 'systemctl status pveproxy.service'."
    log "Installed. Backup: $backup" ;;
  --reapply)
    [[ -d "$INSTALL" ]] || die "Brand assets are not installed."
    apply_assets ;;
  --restore)
    backup="$(cat "$BACKUP_ROOT/.last" 2>/dev/null || true)"
    [[ -n "$backup" ]] || die "No backup marker at $BACKUP_ROOT/.last."
    [[ -d "$backup" ]] || die "Recorded backup directory is missing: $backup"
    restored=0
    while IFS= read -r -d '' src; do dst="${src#"$backup"}"; mkdir -p "$(dirname "$dst")"; cp -a "$src" "$dst"; restored=$((restored+1)); done < <(find "$backup" -type f -print0)
    [[ $restored -gt 0 ]] || die "Backup $backup contains no files; nothing was restored."
    rm -f /etc/apt/apt.conf.d/99-webowie-branding
    systemctl restart pveproxy.service || die "Files restored from $backup, but restarting pveproxy.service failed."
    log "Restored $backup ($restored files)" ;;
  --status)
    echo "webOwie PVE Branding"; echo "Asset branch: $BRANCH"; echo "Source: $RAW"
    if [[ -d "$INSTALL" ]]; then echo "Local assets: $INSTALL"; else echo "Local assets: not installed"; fi
    version="$(pveversion || true)"
    [[ -n "$version" ]] || die "pveversion returned no output."
    printf '%s\n' "$version" | head -n1 ;;
  *) die "Usage: $0 [--install|--reapply|--restore|--status]" ;;
esac
