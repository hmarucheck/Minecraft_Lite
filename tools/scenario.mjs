// Run a scripted browser scenario against the game: node tools/scenario.mjs <scenario.mjs> [outDir]
// The scenario module default-exports async (page, { shot, log, sleep }) => {}.
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const root = path.resolve(process.cwd());
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(root, u === '/' ? 'index.html' : u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
const scenario = (await import(pathToFileURL(path.resolve(process.argv[2])).href)).default;
const outDir = process.argv[3] || '.';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 960), height: Number(process.env.H || 540) } });
const logs = [];
page.on('console', (m) => { const t = m.type() + ': ' + m.text(); logs.push(t); if (m.type() === 'error') console.log(t); });
page.on('pageerror', (e) => { const t = 'PAGEERROR: ' + e.message + '\n' + e.stack; logs.push(t); console.log(t); });
const t0 = Date.now();
await page.goto(`http://localhost:${port}/index.html`);
const helpers = {
  shot: async (name) => { const f = path.join(outDir, name + '.png'); await page.screenshot({ path: f }); console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] shot ${f}`); },
  log: (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a),
  sleep: (ms) => page.waitForTimeout(ms),
};
try { await scenario(page, helpers); } catch (e) { console.log('SCENARIO ERROR', e.message); }
fs.writeFileSync(path.join(outDir, 'console.log'), logs.join('\n')); console.log('--- console (first 40 non-repeated) ---\n' + [...new Set(logs)].slice(0, 40).join('\n'));
await browser.close();
server.close();
