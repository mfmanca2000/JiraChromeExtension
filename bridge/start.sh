#!/bin/sh
echo "SAP Cookie Bridge"
echo "================="
echo "Starting on http://127.0.0.1:27182"
echo ""
echo "Keep this window open while logging time."
echo "Open http://127.0.0.1:27182 in your browser to get the bookmarklet."
echo ""
node "$(dirname "$0")/server.js"
