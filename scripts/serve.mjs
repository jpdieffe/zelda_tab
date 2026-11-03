import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
export function serve(port = 4173, basePath = '/') {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (!url.pathname.startsWith(basePath)) throw new Error('Outside base path');
      const pathname = '/' + url.pathname.slice(basePath.length);
      const name = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
      const target = path.resolve(root, '.' + name);
      if (!target.startsWith(root)) throw new Error('Outside root');
      const body = await readFile(target);
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
      res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(body);
    } catch { res.writeHead(404); res.end('Not found'); }
  }).listen(port, '127.0.0.1');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  serve();
  console.log('Fairy Link: http://localhost:4173');
}
