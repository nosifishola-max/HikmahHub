// Zero-dependency local preview server: node dev-server.js  (or: npm run dev)
// Serves the static site with single-page-app fallback. Picks the next free port if the default is busy,
// so it never clashes with anything else you have running. Set PORT=xxxx to choose your own start port.
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = __dirname, TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(ROOT, p === '/' ? 'index.html' : p);
  if (!file.startsWith(ROOT) || p.startsWith('/api/')) { res.writeHead(404); return res.end('Not found'); }
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) file = path.join(ROOT, path.extname(p) ? '__missing__' : 'index.html'); // app routes -> index.html
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(buf);
    });
  });
});
let port = Number(process.env.PORT) || 5173;
server.on('error', e => { if (e.code === 'EADDRINUSE' && port < 5273) { port++; server.listen(port); } else throw e; });
server.on('listening', () => console.log(`\nHikmahHub preview running at  http://localhost:${port}\nPress Ctrl+C to stop.\n`));
server.listen(port);
