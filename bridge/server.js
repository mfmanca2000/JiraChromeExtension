'use strict';
const http = require('node:http');

const PORT = 27182;
let stored = null;

const BOOKMARKLET = `javascript:(function(){var m=(document.cookie+';').match(/SAP_SESSIONID_P3L_100=([^;]+)/);if(!m){alert('SAP_SESSIONID_P3L_100 not found.\\nThe cookie may be httpOnly.\\nOpen http://127.0.0.1:${PORT} in Edge to paste manually.');return;}fetch('http://127.0.0.1:${PORT}/set',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:m[1]})}).then(function(r){return r.json();}).then(function(d){if(d.ok)console.log('SAP cookie sent to bridge');else alert('Bridge error: '+JSON.stringify(d));}).catch(function(){alert('Bridge not running!\\nStart bridge/start.bat first.');});})();`;

const INDEX_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SAP Cookie Bridge</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 580px; margin: 40px auto; padding: 0 20px; }
    h2 { color: #333; margin-bottom: 4px; }
    .subtitle { color: #888; font-size: 12px; margin-bottom: 24px; }
    .section { margin: 20px 0; padding: 16px; border: 1px solid #ddd; border-radius: 6px; }
    .section h3 { margin: 0 0 8px 0; font-size: 13px; color: #333; }
    .note { font-size: 12px; color: #666; margin: 4px 0; }
    .bookmarklet { display: inline-block; padding: 6px 14px; background: #1a73e8; color: #fff; border-radius: 4px; text-decoration: none; font-size: 13px; margin: 8px 0; cursor: grab; }
    .bookmarklet:hover { background: #1557b0; }
    input[type=text] { width: 100%; box-sizing: border-box; padding: 6px; font-size: 11px; font-family: monospace; border: 1px solid #ccc; border-radius: 3px; margin: 8px 0; }
    button { padding: 6px 16px; background: #0f9d58; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
    button:hover { background: #0b8043; }
    #status { margin-top: 8px; font-size: 12px; min-height: 16px; }
    code { background: #f5f5f5; padding: 1px 4px; border-radius: 3px; font-size: 11px; }
  </style>
</head>
<body>
  <h2>SAP Cookie Bridge</h2>
  <div class="subtitle">Running on port ${PORT} &mdash; keep this window open while using the extension</div>

  <div class="section">
    <h3>Option 1 &mdash; Bookmarklet (one click)</h3>
    <p class="note">Drag the button below to your Edge bookmarks bar. Then click it on any loaded SAP page to send the cookie automatically.</p>
    <a class="bookmarklet" href="${BOOKMARKLET}">&#8635; Send SAP Cookie</a>
    <p class="note">If you get &ldquo;not found (httpOnly)&rdquo;, use Option 2.</p>
  </div>

  <div class="section">
    <h3>Option 2 &mdash; Manual paste</h3>
    <p class="note">In Edge on the SAP page: <strong>F12 &rarr; Application &rarr; Storage &rarr; Cookies</strong> &rarr; copy the value of <code>SAP_SESSIONID_P3L_100</code></p>
    <input type="text" id="v" placeholder="Paste SAP_SESSIONID_P3L_100 value here&hellip;">
    <button onclick="send()">Send to Bridge</button>
    <div id="status"></div>
  </div>

  <script>
    function send() {
      var v = document.getElementById('v').value.trim();
      if (!v) return;
      fetch('/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: v })
      }).then(function(r) {
        return r.json();
      }).then(function(d) {
        var s = document.getElementById('status');
        if (d.ok) {
          s.style.color = 'green';
          s.textContent = 'Stored! Click ↻ in the Chrome extension now.';
        } else {
          s.style.color = 'red';
          s.textContent = 'Error: ' + JSON.stringify(d);
        }
      }).catch(function() {
        document.getElementById('status').textContent = 'Request failed';
      });
    }
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(INDEX_HTML);
    return;
  }

  if (req.method === 'POST' && req.url === '/set') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { sessionId } = JSON.parse(body);
        if (!sessionId || typeof sessionId !== 'string') throw new Error('missing sessionId');
        stored = { sessionId, ts: Date.now() };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        console.log(`[${new Date().toISOString()}] cookie stored (${sessionId.length} chars)`);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/get') {
    if (!stored) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No cookie stored yet. Click the bookmarklet on the SAP page in Edge, or paste manually at http://127.0.0.1:' + PORT }));
      return;
    }
    const ageMins = Math.round((Date.now() - stored.ts) / 60000);
    console.log(`[${new Date().toISOString()}] cookie fetched (age: ${ageMins}m)`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sessionId: stored.sessionId, ageMinutes: ageMins }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`SAP cookie bridge running on http://127.0.0.1:${PORT}`);
  console.log('Open that URL in Edge to get the bookmarklet or paste the cookie manually.');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. The bridge may already be running.`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});
