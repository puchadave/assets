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

die() {
  echo "ERROR: $*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"
}

need pct
need pveam
need pvesh

[[ "$(id -u)" -eq 0 ]] || die "Run as root on the Proxmox host."

echo "[1/8] Updating Proxmox template index..."
pveam update >/dev/null

echo "[2/8] Finding Alpine template..."
TEMPLATE="$(pveam available --section system | awk -v ver="$ALPINE_VER" '
  $2 ~ "alpine-"ver"-default_.*amd64.*\\.tar\\." {print $2; exit}
')"

if [[ -z "${TEMPLATE}" ]]; then
  echo "WARN: Alpine ${ALPINE_VER} not found, falling back to newest Alpine amd64 template."
  TEMPLATE="$(pveam available --section system | awk '
    $2 ~ /alpine-[0-9.]+-default_.*amd64.*\.tar\./ {print $2}
  ' | sort -V | tail -n1)"
fi

[[ -n "${TEMPLATE}" ]] || die "No Alpine amd64 template found."

if ! pveam list "${TEMPLATE_STORAGE}" | awk '{print $1}' | grep -q "vztmpl/${TEMPLATE}$"; then
  echo "[3/8] Downloading template ${TEMPLATE} to ${TEMPLATE_STORAGE}..."
  pveam download "${TEMPLATE_STORAGE}" "${TEMPLATE}"
else
  echo "[3/8] Template already present: ${TEMPLATE}"
fi

TEMPLATE_REF="${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}"

if pct status "${CTID}" >/dev/null 2>&1; then
  die "CTID ${CTID} already exists. Set another one: CTID=181 bash $0"
fi

FEATURES="nesting=1,keyctl=1"
if [[ "${FUSE}" == "yes" ]]; then
  FEATURES="${FEATURES},fuse=1"
fi

echo "[4/8] Creating Alpine LXC ${CTID}..."
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
  echo "[4b] Adding /dev/net/tun passthrough..."
  cat >>"/etc/pve/lxc/${CTID}.conf" <<'TUNCONF'
lxc.cgroup2.devices.allow: c 10:200 rwm
lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file
TUNCONF
fi

if [[ "${GPU}" == "yes" ]]; then
  echo "WARN: var_gpu=yes ignored. A PXE/TFTP/web server does not need GPU passthrough."
fi

echo "[5/8] Starting container..."
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

echo "[container] Installing packages..."
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

echo "[container] Preparing webroot..."
mkdir -p "${WEBROOT}" /run/nginx
cd "${WEBROOT}"

echo "[container] Fetching netboot.xyz checksums..."
curl -fL --retry 5 --connect-timeout 20 \
  -o netboot.xyz-sha256-checksums.txt \
  "${BASE_URL}/netboot.xyz-sha256-checksums.txt"

verify_checksum() {
  entry="$(grep -E "^[0-9a-f]{64} \*$1\$" netboot.xyz-sha256-checksums.txt || true)"
  if [ -z "${entry}" ]; then
    echo "WARN: no published checksum for $1, skipping verification"
    return 0
  fi
  if ! printf '%s\n' "${entry}" | sha256sum -c - >/dev/null 2>&1; then
    rm -f "$1"
    echo "ERROR: checksum mismatch for $1, file removed" >&2
    return 1
  fi
}

echo "[container] Fetching netboot.xyz menus..."
curl -fL --retry 5 --connect-timeout 20 \
  -o menus.tar.gz \
  "${BASE_URL}/menus.tar.gz"

tar -xzf menus.tar.gz
rm -f menus.tar.gz

echo "[container] Fetching netboot.xyz boot files..."
for f in ${BOOT_FILES}; do
  echo "  -> ${f}"
  if curl -fL --retry 5 --connect-timeout 20 \
    -o "${f}" \
    "${BASE_URL}/${f}"; then
    verify_checksum "${f}"
  else
    echo "WARN: could not fetch ${f}"
  fi
done

echo "[container] Configuring nginx..."
cat >/etc/nginx/http.d/default.conf <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    index index.html;
    server_name _;

    location / {
        autoindex on;
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Headers "Content-Type";
    }

    location /ipxe/ {
        alias /var/www/html/;
        autoindex on;
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Headers "Content-Type";
    }
}
NGINX

echo "[container] Configuring TFTP..."
cat >/etc/conf.d/in.tftpd <<'TFTP'
INTFTPD_PATH="/var/www/html"
INTFTPD_USER="nobody"
INTFTPD_OPTS="-u ${INTFTPD_USER} -R 4096:32767 -s ${INTFTPD_PATH}"
TFTP

echo "[container] Enabling services..."
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

echo "[container] Done. HTTP: http://${IP}/"
INSTALL

echo "[6/8] Pushing installer into container..."
pct push "${CTID}" /tmp/netbootxyz-install-alpine.sh /root/netbootxyz-install-alpine.sh --perms 0755

echo "[7/8] Installing netboot.xyz inside Alpine..."
pct exec "${CTID}" -- /bin/sh /root/netbootxyz-install-alpine.sh

IP="$(pct exec "${CTID}" -- /bin/sh -lc "ip -4 addr show eth0 | awk '/inet / {print \$2}' | cut -d/ -f1 | head -n1" || true)"

echo "[8/8] Completed."
echo
echo "Container: ${CTID}"
echo "Hostname : ${HOSTNAME}"
echo "IP       : ${IP}"
echo "HTTP     : http://${IP}/"
echo "TFTP     : ${IP}:69"
echo
echo "DHCP/Technitium PXE settings:"
echo "  next-server / option 66 : ${IP}"
echo "  UEFI x64 filename       : netboot.xyz.efi"
echo "  UEFI SNP fallback       : netboot.xyz-snp.efi"
echo "  Legacy BIOS filename    : netboot.xyz.kpxe"
echo "  Legacy fallback         : netboot.xyz-undionly.kpxe"
echo
echo "Firewall, if enabled: allow TCP 80 and UDP 69."
