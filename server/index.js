require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { WebSocketServer } = require('ws');
const { handleMessage } = require('./glados');
const { createSession, destroySession } = require('./session');

const PORT = process.env.PORT || 3025;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const CLIENT_DIR = path.join(__dirname, '..', 'client');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  // POST /auth — token verification
  if (req.method === 'POST' && req.url === '/auth') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { token } = JSON.parse(body);
        if (token && token === ACCESS_TOKEN) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false }));
        }
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid request' }));
      }
    });
    return;
  }

  // Static file serving
  let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  filePath = path.join(CLIENT_DIR, filePath);

  // Prevent directory traversal
  if (!filePath.startsWith(CLIENT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  // Verify access token from query string
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token || token !== ACCESS_TOKEN) {
    console.log('[WS] Rejected connection — invalid token');
    ws.close(4401, 'Invalid access token');
    return;
  }

  const session = createSession();
  console.log(`[WS] Client connected, session ${session.id}`);

  ws.on('message', async (data, isBinary) => {
    try {
      if (isBinary) {
        // Binary data = audio from microphone
        await handleMessage(ws, session, { type: 'audio', data });
      } else {
        const msg = JSON.parse(data.toString());
        await handleMessage(ws, session, msg);
      }
    } catch (err) {
      console.error('[WS] Error handling message:', err);
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  });

  ws.on('close', () => {
    console.log(`[WS] Client disconnected, session ${session.id}`);
    destroySession(session.id);
  });

  ws.on('error', (err) => {
    console.error(`[WS] Error on session ${session.id}:`, err);
  });

  // Send ready signal
  ws.send(JSON.stringify({ type: 'ready', sessionId: session.id }));
});

server.listen(PORT, () => {
  console.log(`[Aperture] Server running on http://localhost:${PORT}`);
});
