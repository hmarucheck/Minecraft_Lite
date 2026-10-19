// Headless screenshot helper: node tools/shot.mjs "<query>" out.png [waitMs]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
import http from 'http';
import fs from 'fs';
import path from 'path';

const root = path.resolve(process.cwd());
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(root, u === '/' ? 'index.html' : u);
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  const ext = path.extname(f);
  res.writeHead(200, { 'Content-Type': ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
const query = process.argv[2] || '';
const out = process.argv[3] || 'shot.png';
const wait = Number(process.argv[4] || 20000);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 960), height: Number(process.env.H || 540) } });
const logs = [];
page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + '\n' + e.stack));
const t0 = Date.now();
await page.goto(`http://localhost:${port}/index.html?${query}`);
const script = process.env.SCRIPT;
try {
  await page.waitForFunction(() => window.__state && window.__state.done, null, { timeout: wait });
} catch { logs.push('timeout waiting for done'); }
if (script) { await page.evaluate(script); await page.waitForTimeout(Number(process.env.AFTER || 1500)); }
await page.waitForTimeout(Number(process.env.SETTLE || 800));
await page.screenshot({ path: out });
const st = await page.evaluate(() => JSON.stringify(window.__state || {}));
console.log('elapsed', Date.now() - t0, 'ms', st.slice(0, 400));
console.log(logs.slice(0, 40).join('\n'));
await browser.close();
server.close();
