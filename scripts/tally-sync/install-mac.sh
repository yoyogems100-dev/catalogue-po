#!/bin/bash
# Keep the Tally live sync running on this Mac: starts at login, restarts if it stops.
# Run `node tally-sync.mjs setup` first (it saves the website address and sync key).
#   bash install-mac.sh            install / update
#   bash install-mac.sh remove     stop and remove
set -euo pipefail
LABEL="in.yoyogems.tally-sync"
DIR="$HOME/yoyo-tally-sync"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
if [ "${1:-}" = "remove" ]; then rm -f "$PLIST"; echo "Tally sync removed."; exit 0; fi

[ -f "$HOME/.yoyo-tally-sync.json" ] || { echo "Run 'node tally-sync.mjs setup' first."; exit 1; }
NODE="$(command -v node)" || { echo "Node.js is not installed."; exit 1; }
mkdir -p "$DIR" "$HOME/Library/LaunchAgents"
cp "$(dirname "$0")/tally-sync.mjs" "$DIR/tally-sync.mjs"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>$DIR/tally-sync.mjs</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>60</integer>
  <key>StandardOutPath</key><string>$DIR/sync.log</string>
  <key>StandardErrorPath</key><string>$DIR/sync.log</string>
</dict></plist>
EOF
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Tally sync is running in the background. Log: $DIR/sync.log"
