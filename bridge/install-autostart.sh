#!/bin/sh
# Registers the SAP Cookie Bridge as a launchd user agent so it starts at login.
# Run once; no admin rights required.

LABEL="com.sapbridge.server"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER="$SCRIPT_DIR/server.js"
LOG="$SCRIPT_DIR/bridge.log"

# Resolve the node executable (works with nvm, fnm, or system node)
NODE="$(command -v node)"
if [ -z "$NODE" ]; then
  echo "ERROR: 'node' not found in PATH. Install Node.js first (e.g. via https://nodejs.org or nvm)."
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE}</string>
    <string>${SERVER}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${LOG}</string>
  <key>StandardErrorPath</key>
  <string>${LOG}</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null
launchctl load "$PLIST"

if [ $? -eq 0 ]; then
  echo ""
  echo "SUCCESS. The bridge will start automatically at every login."
  echo "It is also running right now on http://127.0.0.1:27182"
  echo "Logs: $LOG"
  echo ""
  echo "To remove the auto-start:"
  echo "  launchctl unload \"$PLIST\" && rm \"$PLIST\""
else
  echo ""
  echo "FAILED. Check that Node.js is installed and try again."
fi
