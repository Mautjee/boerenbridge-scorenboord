import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

export function startStaticServer(outDir, options = {}) {
  const root = path.resolve(outDir);
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    let file;
    if (url.pathname === '/' || url.pathname === '/index.html') {
      file = path.join(root, 'index.html');
    } else if (url.pathname.startsWith('/static/')) {
      file = path.join(root, url.pathname.slice('/static/'.length));
    } else {
      file = path.join(root, url.pathname.replace(/^\/+/, ''));
    }
    if (!file.startsWith(root)) {
      response.writeHead(403).end('verboden');
      return;
    }
    try {
      const body = await readFile(file);
      const headers = {
        'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': url.pathname.startsWith('/static/icons/') ? 'public, max-age=3600' : 'no-cache',
      };
      if (url.pathname === '/static/sw.js') {
        headers['Service-Worker-Allowed'] = '/';
      }
      if (options.headers !== undefined) {
        for (const [key, value] of Object.entries(options.headers)) {
          headers[key] = value;
        }
      }
      response.writeHead(200, headers);
      response.end(body);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><html lang="nl"><body><h1>Niet gevonden</h1></body></html>');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` });
    });
  });
}
