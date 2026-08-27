#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# netboot.xyz Alpine LXC for Proxmox VE
# Emergency standalone builder for a minimal PXE rescue server.
# Run this on the Proxmox VE host, not inside a container.
# ============================================================

APP="netboot.xyz"
CTID="${CTID:-$(pvesh get /cluster/nextid 2>/dev/null || echo 180)}"
HOSTNAME="${HOSTNAME:-netboot-xyz}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"
ROOTFS_STORAGE="${ROOTFS_STORAGE:-local-lvm}"
ALPINE_VER="${ALPINE_VER:-3.22}"

CORES="${var_cpu:-${CORES:-1}}"
RAM="${var_ram:-${RAM:-512}}"
DISK="${var_disk:-${DISK:-2}}"

BRIDGE="${BRIDGE:-vmbr0}"
IPCONFIG="${IPCONFIG:-ip=dhcp}"
UNPRIVILEGED="${var_unprivileged:-1}"

FUSE="${var_fuse:-yes}"
TUN="${var_tun:-no}"
GPU="${var_gpu:-no}"

TOTAL_STEPS=8

log() {
  echo "$*"
}

warn() {
  log "WARN: $*"
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

step() {
  local number="$1"
  shift
  log "[${number}/${TOTAL_STEPS}] $*"
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"
}

alpine_templates() {
  pveam available --section system
}

container_ip() {
  pct exec "$1" -- /bin/sh -lc "ip -4 addr show eth0 | awk '/inet / {print \$2}' | cut -d/ -f1 | head -n1" || true
}

kv() {
  printf '%-25s: %s\n' "$1" "$2"
}

need pct
need pveam
need pvesh

[[ "$(id -u)" -eq 0 ]] || die "Run as root on the Proxmox host."

step 1 "Updating Proxmox template index..."
pveam update >/dev/null

step 2 "Finding Alpine template..."
TEMPLATE="$(alpine_templates | awk -v ver="$ALPINE_VER" '
  $2 ~ "alpine-"ver"-default_.*amd64.*\\.tar\\." {print $2; exit}
')"

if [[ -z "${TEMPLATE}" ]]; then
  warn "Alpine ${ALPINE_VER} not found, falling back to newest Alpine amd64 template."
  TEMPLATE="$(alpine_templates | awk '
    $2 ~ /alpine-[0-9.]+-default_.*amd64.*\.tar\./ {print $2}
  ' | sort -V | tail -n1)"
fi

[[ -n "${TEMPLATE}" ]] || die "No Alpine amd64 template found."

if ! pveam list "${TEMPLATE_STORAGE}" | awk '{print $1}' | grep -q "vztmpl/${TEMPLATE}$"; then
  step 3 "Downloading template ${TEMPLATE} to ${TEMPLATE_STORAGE}..."
  pveam download "${TEMPLATE_STORAGE}" "${TEMPLATE}"
else
  step 3 "Template already present: ${TEMPLATE}"
fi

TEMPLATE_REF="${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}"

if pct status "${CTID}" >/dev/null 2>&1; then
  die "CTID ${CTID} already exists. Set another one: CTID=181 bash $0"
fi

FEATURES="nesting=1,keyctl=1"
if [[ "${FUSE}" == "yes" ]]; then
  FEATURES="${FEATURES},fuse=1"
fi

step 4 "Creating Alpine LXC ${CTID}..."
pct create "${CTID}" "${TEMPLATE_REF}" \
  --hostname "${HOSTNAME}" \
  --ostype alpine \
  --unprivileged "${UNPRIVILEGED}" \
  --cores "${CORES}" \
  --memory "${RAM}" \
  --swap 0 \
  --rootfs "${ROOTFS_STORAGE}:${DISK}" \
  --net0 "name=eth0,bridge=${BRIDGE},${IPCONFIG},firewall=1" \
  --features "${FEATURES}" \
  --onboot 1 \
  --start 0

if [[ "${TUN}" == "yes" ]]; then
  log "[4b] Adding /dev/net/tun passthrough..."
  cat >>"/etc/pve/lxc/${CTID}.conf" <<'TUNCONF'
lxc.cgroup2.devices.allow: c 10:200 rwm
lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file
TUNCONF
fi

if [[ "${GPU}" == "yes" ]]; then
  warn "var_gpu=yes ignored. A PXE/TFTP/web server does not need GPU passthrough."
fi

step 5 "Starting container..."
pct start "${CTID}"
sleep 5

cat >/tmp/netbootxyz-install-alpine.sh <<'INSTALL'
#!/bin/sh
set -eu

WEBROOT="/var/www/html"
BASE_URL="https://github.com/netbootxyz/netboot.xyz/releases/latest/download"

BOOT_FILES="
netboot.xyz.efi
netboot.xyz.efi.dsk
netboot.xyz-snp.efi
netboot.xyz-snp.efi.dsk
netboot.xyz-snponly.efi
netboot.xyz-metal.efi
netboot.xyz-metal.efi.dsk
netboot.xyz-metal-snp.efi
netboot.xyz-metal-snp.dsk
netboot.xyz-metal-snp.efi.dsk
netboot.xyz-metal-snponly.efi
netboot.xyz.kpxe
netboot.xyz-undionly.kpxe
netboot.xyz-metal.kpxe
netboot.xyz.lkrn
netboot.xyz-linux.bin
netboot.xyz.dsk
netboot.xyz.pdsk
netboot.xyz-arm64.efi
netboot.xyz-arm64-snp.efi
netboot.xyz-arm64-snponly.efi
netboot.xyz-metal-arm64.efi
netboot.xyz-metal-arm64-snp.efi
netboot.xyz-metal-arm64-snponly.efi
netboot.xyz.iso
netboot.xyz.img
netboot.xyz-arm64.iso
netboot.xyz-arm64.img
netboot.xyz-multiarch.iso
netboot.xyz-multiarch.img
netboot.xyz-sha256-checksums.txt
"

log() {
  echo "[container] $*"
}

fetch() {
  curl -fL --retry 5 --connect-timeout 20 -o "$1" "${BASE_URL}/$1"
}

log "Installing packages..."
apk update
apk add --no-cache \
  bash \
  curl \
  ca-certificates \
  tar \
  nginx \
  tftp-hpa \
  tftp-hpa-openrc

update-ca-certificates || true

log "Preparing webroot..."
mkdir -p "${WEBROOT}" /run/nginx
cd "${WEBROOT}"

log "Fetching netboot.xyz menus..."
fetch menus.tar.gz

tar -xzf menus.tar.gz
rm -f menus.tar.gz

log "Fetching netboot.xyz boot files..."
for f in ${BOOT_FILES}; do
  echo "  -> ${f}"
  fetch "${f}" || echo "WARN: could not fetch ${f}"
done

log "Configuring nginx..."
cat >/etc/nginx/http.d/default.conf <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    index index.html;
    server_name _;

    autoindex on;
    add_header Access-Control-Allow-Origin "*";
    add_header Access-Control-Allow-Headers "Content-Type";

    location /ipxe/ {
        alias /var/www/html/;
    }
}
NGINX

log "Configuring TFTP..."
cat >/etc/conf.d/in.tftpd <<'TFTP'
INTFTPD_PATH="/var/www/html"
INTFTPD_USER="nobody"
INTFTPD_OPTS="-u ${INTFTPD_USER} -R 4096:32767 -s ${INTFTPD_PATH}"
TFTP

log "Enabling services..."
rc-update add nginx default
rc-update add in.tftpd default

rc-service nginx restart
rc-service in.tftpd restart

touch /root/.netboot-xyz

IP="$(ip -4 addr show eth0 | awk '/inet / {print $2}' | cut -d/ -f1 | head -n1 || true)"

cat >/etc/motd <<MOTD

netboot.xyz Alpine LXC

HTTP: http://${IP}/
TFTP root: /var/www/html

DHCP/PXE:
  next-server / option 66: ${IP}

Legacy BIOS:
  filename: netboot.xyz.kpxe
  fallback: netboot.xyz-undionly.kpxe

UEFI x64:
  filename: netboot.xyz.efi
  fallback: netboot.xyz-snp.efi

MOTD

log "Done. HTTP: http://${IP}/"
INSTALL

step 6 "Pushing installer into container..."
pct push "${CTID}" /tmp/netbootxyz-install-alpine.sh /root/netbootxyz-install-alpine.sh --perms 0755

step 7 "Installing netboot.xyz inside Alpine..."
pct exec "${CTID}" -- /bin/sh /root/netbootxyz-install-alpine.sh

IP="$(container_ip "${CTID}")"

step 8 "Completed."
log
kv "Container" "${CTID}"
kv "Hostname" "${HOSTNAME}"
kv "IP" "${IP}"
kv "HTTP" "http://${IP}/"
kv "TFTP" "${IP}:69"
log
log "DHCP/Technitium PXE settings:"
kv "  next-server / option 66" "${IP}"
kv "  UEFI x64 filename" "netboot.xyz.efi"
kv "  UEFI SNP fallback" "netboot.xyz-snp.efi"
kv "  Legacy BIOS filename" "netboot.xyz.kpxe"
kv "  Legacy fallback" "netboot.xyz-undionly.kpxe"
log
log "Firewall, if enabled: allow TCP 80 and UDP 69."
