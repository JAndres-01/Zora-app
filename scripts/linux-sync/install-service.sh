#!/usr/bin/env bash

set -e

mkdir -p "$HOME/.config/systemd/user"
mkdir -p "$HOME/.local/bin"

ln -sf "$HOME/Documentos/antigravity/Synapse/scripts/linux-sync/synapse-sync.js" "$HOME/.local/bin/synapse-sync"
chmod +x "$HOME/Documentos/antigravity/Synapse/scripts/linux-sync/synapse-sync.js"

# Asegurar que node esté en ~/.local/bin si usa fnm
if [ ! -f "$HOME/.local/bin/node" ]; then
  FNM_NODE=$(find "$HOME/.local/share/fnm" -name node -type f 2>/dev/null | sort -V | tail -n 1)
  if [ -n "$FNM_NODE" ]; then
    ln -sf "$FNM_NODE" "$HOME/.local/bin/node"
  fi
fi

cat << 'EOF' > "$HOME/.config/systemd/user/synapse-sync.service"
[Unit]
Description=Synapse Linux Sync Daemon
After=network.target

[Service]
Type=simple
Environment=PATH=%h/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=%h/.local/bin/node %h/Documentos/antigravity/Synapse/scripts/linux-sync/synapse-sync.js --daemon
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user restart synapse-sync.service

echo "[Synapse] Servicio instalado y ejecutándose en segundo plano."
