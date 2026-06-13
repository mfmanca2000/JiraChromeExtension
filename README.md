# Jira Chrome Extension

A Chrome extension for the Swisscom Jira instance that adds shortcuts for common ticket actions and SAP time logging.

---

## Features

- **Send Mail** - open a mailto with the current ticket URL and a selectable template body
- **Set Resolved** - transition the ticket to Resolved with a single click, including mandatory fields
- **Add Label** - apply a label via the workflow transition
- **Copy ID** - copy the ticket ID (with an optional comment suffix) to the clipboard
- **Log Time** - post a time entry directly to the SAP time tracker from within Jira

---

## Installation

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select this folder
4. Note your extension ID (32-character string shown under the extension name)

---

## Log Time - SAP Cookie Bridge

### Why the bridge exists

The SAP time-tracking site (`pmpgwd.apps.swisscom.com`) authenticates via **Kerberos**. Edge handles this automatically on the corporate network (Windows and macOS); Chrome cannot. The workaround is:

1. Let Edge authenticate and obtain the SAP session cookie
2. Pass that cookie to the Chrome extension so it can inject it into SAP requests

Because the session cookie (`SAP_SESSIONID_P3L_100`) expires roughly every 10 minutes, the bridge automates this transfer.

---

### How the flow works

```
Edge (SAP page)                     Bridge server              Chrome extension
──────────────────                  ─────────────              ────────────────
Kerberos auth ──► SAP sets          Node.js HTTP               popup.js clicks ↻
session cookie     cookie           server on                   │
        │                           127.0.0.1:27182             │
        ▼                                  │                    ▼
  Bookmarklet                      POST /set ◄────────  background.js
  reads cookie                             │             fetches GET /get
  from page                         stores in              │
  document.cookie                   memory                 │
                                           │               ▼
                                    GET /get ──────► session ID
                                    returns value    fills the field
```

1. **Bridge server** (`bridge/server.js`) runs locally on `127.0.0.1:27182`. It stores the latest session ID in memory and exposes two endpoints: `POST /set` and `GET /get`.

2. **Bookmarklet** - a JavaScript snippet saved in Edge's bookmarks bar. When clicked on any loaded SAP page, it reads `SAP_SESSIONID_P3L_100` from `document.cookie` and POSTs its value to the bridge server. If the cookie is `httpOnly` (not accessible via JS), the bridge page at `http://127.0.0.1:27182` offers a manual paste form as fallback.

3. **Chrome extension** - when you click `↻` in the Log Time popup, `background.js` does a plain `fetch('http://127.0.0.1:27182/get')` and populates the Session ID field with the value stored by the bookmarklet.

4. **Cookie injection** - when the time entry is submitted, `background.js` uses Chrome's `declarativeNetRequest` API to inject a `Cookie` header (containing the session ID) into the outgoing SAP request at the network layer, bypassing the browser's restriction on setting `Cookie` headers from JS.

---

### One-time setup

#### 1. Start the bridge at login (recommended)

**Windows** - Run `bridge/install-autostart.bat` (as administrator if prompted).

This creates a Windows Task Scheduler entry that launches the bridge silently at every login - no console window, no manual start needed.

To remove the auto-start later:
```
schtasks /delete /tn "SAP Cookie Bridge" /f
```

**macOS** - Run once in Terminal:
```sh
chmod +x bridge/start.sh bridge/install-autostart.sh
./bridge/install-autostart.sh
```

This registers a launchd user agent that starts the bridge automatically at every login. No admin rights required.

To remove the auto-start later:
```sh
launchctl unload ~/Library/LaunchAgents/com.sapbridge.server.plist
rm ~/Library/LaunchAgents/com.sapbridge.server.plist
```

> **macOS note:** Node.js must be in your PATH. Install it from [nodejs.org](https://nodejs.org) or via `nvm`. If you installed Node.js via nvm, run `install-autostart.sh` from a shell that has already sourced your nvm profile so the correct `node` path is captured.

#### 2. Get the bookmarklet

Open `http://127.0.0.1:27182` in **Edge** and drag the **"↻ Send SAP Cookie"** button to your bookmarks bar.

---

### Daily usage

1. Open a SAP page in Edge (it will load and authenticate automatically via Kerberos)
2. Click the **"↻ Send SAP Cookie"** bookmarklet in Edge - done, the bridge now holds the cookie
3. In Chrome, open the extension on a Jira ticket → **Log Time ›** → fill in the details → click **↻** to fetch the session ID → **Submit**

When the session expires (~10 min), just click the bookmarklet in Edge again and then **↻** in the extension.

---

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Bridge not running` | Bridge server not started | Windows: run `bridge/start.bat`, or re-run `bridge/install-autostart.bat`. macOS: run `./bridge/start.sh`, or re-run `./bridge/install-autostart.sh` |
| `No cookie stored yet` | Bookmarklet not clicked | Click the bookmarklet on the SAP page in Edge |
| `SAP_SESSIONID_P3L_100 not found (httpOnly)` | Cookie not accessible via JS | Open `http://127.0.0.1:27182` in Edge → paste the cookie value manually (F12 → Application → Storage → Cookies) |
| `HTTP 401` from SAP | Session expired | Click bookmarklet again (or paste fresh value), then click ↻ |
| Bridge already running on port 27182 | Second instance blocked | Normal - the previous instance is still active and healthy |

---

### Bridge files

| File | Purpose |
|---|---|
| `bridge/server.js` | HTTP bridge server - stores and serves the SAP session cookie |
| `bridge/start.bat` | **Windows** - starts the bridge manually (useful for testing) |
| `bridge/launcher.vbs` | **Windows** - launches the bridge with no console window (used by Task Scheduler) |
| `bridge/install-autostart.bat` | **Windows** - registers the bridge in Task Scheduler to run at login |
| `bridge/start.sh` | **macOS** - starts the bridge manually (useful for testing) |
| `bridge/install-autostart.sh` | **macOS** - registers the bridge as a launchd agent to run at login |
