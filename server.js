/**
 * Rancon PO Generator — Local Office Server
 * ------------------------------------------
 * Serves the app (Rancon_PO_Generator.html) to every computer on your
 * office WiFi, and stores all shared data (POs, requisitions, suppliers,
 * products, purchase requisitions, users) in a single file: data.json,
 * right next to this script.
 *
 * HOW TO RUN:
 *   1. Install Node.js once from https://nodejs.org (LTS version).
 *   2. Put this file and Rancon_PO_Generator.html in the same folder.
 *   3. Double-click start-server.bat (Windows) — or run: node server.js
 *   4. Find this PC's WiFi IP address (printed on screen when it starts,
 *      or run `ipconfig` and look for "IPv4 Address" under your WiFi adapter).
 *   5. Everyone on the same WiFi opens that address in their browser, e.g.
 *      http://192.168.1.23:3000
 *
 * No internet connection is required — this only works on your local
 * office WiFi network. Keep this PC turned on and this window open while
 * others are using the app.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const APP_FILE = path.join(__dirname, 'Rancon_PO_Generator.html');

// Simple write queue so two near-simultaneous saves never corrupt the file
let writeQueue = Promise.resolve();

function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    if (!raw.trim()) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function writeData(obj) {
  writeQueue = writeQueue.then(() => {
    return new Promise((resolve, reject) => {
      const tmpFile = DATA_FILE + '.tmp';
      fs.writeFile(tmpFile, JSON.stringify(obj, null, 2), (err) => {
        if (err) return reject(err);
        fs.rename(tmpFile, DATA_FILE, (err2) => {
          if (err2) return reject(err2);
          resolve();
        });
      });
    });
  });
  return writeQueue;
}

function sendJson(res, statusCode, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function serveStaticFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found. Make sure Rancon_PO_Generator.html is in the same folder as server.js.');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // ---- CORS: allow connecting from a file:// page or a different origin ----
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ---- API: shared data store ----
  if (url === '/api/data' && req.method === 'GET') {
    sendJson(res, 200, readData());
    return;
  }

  if (url === '/api/data' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        writeData(parsed).then(() => {
          sendJson(res, 200, { ok: true });
        }).catch(err => {
          sendJson(res, 500, { ok: false, error: err.message });
        });
      } catch (e) {
        sendJson(res, 400, { ok: false, error: 'Invalid JSON body' });
      }
    });
    return;
  }

  // ---- Static: the app itself ----
  if (url === '/' || url === '/index.html' || url === '/Rancon_PO_Generator.html') {
    serveStaticFile(res, APP_FILE, 'text/html; charset=utf-8');
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

function getLocalIPs() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results;
}

server.listen(PORT, () => {
  console.log('');
  console.log('========================================================');
  console.log('  Rancon PO Generator server is running.');
  console.log('  Keep this window open while your team is using the app.');
  console.log('========================================================');
  console.log('');
  console.log('  On THIS computer, open:');
  console.log('    http://localhost:' + PORT);
  console.log('');
  const ips = getLocalIPs();
  if (ips.length) {
    console.log('  On OTHER computers on the same WiFi, open:');
    ips.forEach(ip => console.log('    http://' + ip + ':' + PORT));
  } else {
    console.log('  Could not detect a WiFi IP address automatically.');
    console.log('  Run "ipconfig" in another Command Prompt window and look');
    console.log('  for "IPv4 Address" under your WiFi adapter.');
  }
  console.log('');
  console.log('  Data is stored in: ' + DATA_FILE);
  console.log('  Press Ctrl+C to stop the server.');
  console.log('');
});
