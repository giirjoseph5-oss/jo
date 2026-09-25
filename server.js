// Deriv WebSocket relay
//
// Purpose: some networks silently block direct browser connections to
// ws.derivws.com / *.binaryws.com (handshake completes, then the connection
// is killed a few seconds in, with no error frame — a classic DPI/geo-block
// signature). This relay runs on a host with clean network access (Render,
// Railway, Fly.io, a VPS, etc.), holds the real connection to Deriv, and
// re-broadcasts every message verbatim to any browser that connects to THIS
// server instead. The browser only ever talks to this relay over a plain
// WebSocket, which is the kind of connection your network already proved
// it can make.
//
// It forwards Deriv's messages unchanged, so any client built against the
// real Deriv API (like the V10 Signal Scanner dashboard) works by just
// pointing its WebSocket URL at this relay instead of at Deriv directly.

const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 3000;
const APP_ID = process.env.DERIV_APP_ID || 1089;
const DERIV_URL = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`;

// Symbols this relay keeps a live subscription open for. Add more here if
// you want the relay itself to always stream several markets at once.
const SYMBOLS = (process.env.SYMBOLS || 'R_10').split(',').map(s => s.trim());

const clients = new Set();
let derivWs = null;
let reconnectDelay = 2000;

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function broadcast(raw) {
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(raw);
    }
  }
}

function connectDeriv() {
  log('Connecting to Deriv at', DERIV_URL);
  derivWs = new WebSocket(DERIV_URL);

  derivWs.on('open', () => {
    log('Connected to Deriv. Subscribing to:', SYMBOLS.join(', '));
    reconnectDelay = 2000; // reset backoff on success
    for (const symbol of SYMBOLS) {
      derivWs.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    }
  });

  derivWs.on('message', (data) => {
    // Forward the raw message unchanged — clients parse it exactly as if
    // they were talking to Deriv directly.
    broadcast(data.toString());
  });

  derivWs.on('close', (code) => {
    log('Deriv connection closed, code', code, '— reconnecting in', reconnectDelay, 'ms');
    setTimeout(connectDeriv, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
  });

  derivWs.on('error', (err) => {
    log('Deriv connection error:', err.message);
  });
}

connectDeriv();

// Periodic keepalive so the upstream Deriv connection and any idle proxies
// in between don't time it out.
setInterval(() => {
  if (derivWs && derivWs.readyState === WebSocket.OPEN) {
    derivWs.send(JSON.stringify({ ping: 1 }));
  }
}, 30000);

const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(
    'Deriv relay is running.\n' +
    'Connected clients: ' + clients.size + '\n' +
    'Streaming symbols: ' + SYMBOLS.join(', ') + '\n' +
    'Connect a browser via WebSocket to this same URL (wss://).\n'
  );
});

const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', (ws) => {
  clients.add(ws);
  log('Client connected. Total clients:', clients.size);

  ws.on('message', () => {
    // Client subscribe/ping messages are accepted but ignored — the relay
    // already maintains its own subscription to every symbol in SYMBOLS.
  });

  ws.on('close', () => {
    clients.delete(ws);
    log('Client disconnected. Total clients:', clients.size);
  });
});

httpServer.listen(PORT, () => {
  log('Relay listening on port', PORT);
});
