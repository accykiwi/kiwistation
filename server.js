const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8889;
const rootDir = __dirname;
const brainPath = path.join(rootDir, 'kiwi-brain.json');

const mimeTypes = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

// Helper: read brain
function readBrain() {
  try {
    return JSON.parse(fs.readFileSync(brainPath, 'utf8'));
  } catch (e) {
    console.error('Error reading brain:', e.message);
    return null;
  }
}

// Helper: write brain
function writeBrain(data) {
  try {
    fs.writeFileSync(brainPath, JSON.stringify(data, null, 2) + '\n');
    return true;
  } catch (e) {
    console.error('Error writing brain:', e.message);
    return false;
  }
}

// Helper: parse request body
function getBody(req, callback) {
  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', () => callback(body));
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // API: Add memory entry
  if (pathname === '/api/memory' && req.method === 'POST') {
    getBody(req, (body) => {
      try {
        const entry = JSON.parse(body);
        const brain = readBrain();
        if (!brain) throw new Error('Brain not readable');

        if (!brain.memory_log) brain.memory_log = [];

        // Validate entry
        if (!entry.date || !entry.type || !entry.note) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required fields: date, type, note' }));
          return;
        }

        // Add entry
        brain.memory_log.push(entry);

        if (writeBrain(brain)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, entry }));
          console.log(`✓ Added memory entry: ${entry.date} [${entry.type}]`);
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to write brain' }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // API: Get recent memory entries
  if (pathname === '/api/memory' && req.method === 'GET') {
    const brain = readBrain();
    const entries = brain?.memory_log || [];
    const recent = entries.slice(-10).reverse(); // Last 10, newest first
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(recent));
    return;
  }

  // API: Get full brain
  if (pathname === '/api/brain' && req.method === 'GET') {
    const brain = readBrain();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(brain));
    return;
  }

  // API: Update brain (for editor)
  if (pathname === '/api/brain' && req.method === 'POST') {
    getBody(req, (body) => {
      try {
        const newBrain = JSON.parse(body);
        if (writeBrain(newBrain)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          console.log('✓ Brain updated via API');
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to write brain' }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Static file serving
  let filePath = path.join(rootDir, pathname === '/' ? 'index.html' : pathname);

  // Security: prevent directory traversal
  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Kiwi Station running at http://localhost:${PORT}`);
  console.log(`   Open in browser → http://localhost:${PORT}`);
  console.log(`   Press Ctrl+C to stop`);
});
