#!/usr/bin/env node
// Локальный просмотр сборки так, как её отдаст GitHub Pages:
//   node tools/serve.mjs [--dir dist] [--port 8080] [--base /stankin-science/]
// Затем откройте http://localhost:8080/stankin-science/

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));
const dir = path.resolve(args.dir ?? 'dist');
const port = Number(args.port ?? 8080);
const base = (args.base ?? '/stankin-science/').replace(/\/?$/, '/');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

async function resolveFile(urlPath) {
  if (!urlPath.startsWith(base)) return null;
  const rel = decodeURIComponent(urlPath.slice(base.length));
  const full = path.join(dir, rel);
  if (!full.startsWith(dir)) return null;
  try {
    const s = await stat(full);
    if (s.isDirectory()) {
      if (!urlPath.endsWith('/')) return { redirect: `${urlPath}/` };
      return { file: path.join(full, 'index.html') };
    }
    return { file: full };
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/' || url.pathname === base.slice(0, -1)) {
    res.writeHead(302, { Location: base });
    res.end();
    return;
  }
  const found = await resolveFile(url.pathname);
  if (found?.redirect) {
    res.writeHead(301, { Location: found.redirect });
    res.end();
    return;
  }
  try {
    const file = found?.file;
    if (!file) throw new Error('not found');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    const body = await readFile(path.join(dir, '404.html')).catch(() => 'Not found');
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(body);
  }
}).listen(port, () => console.log(`Сайт: http://localhost:${port}${base}  (каталог ${dir})`));
