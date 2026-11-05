// Isolated real-browser component checks. Synthetic bars only; no app auth, env files or provider HTTP.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.RADAR_OUTPUT_DIR || path.join(root, 'outputs/market-data-chart');
await fs.mkdir(output, { recursive: true });
const source = `import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CandleChart} from './components/candle-chart';
const interval=900000,stamp=Date.parse('2026-11-01T05:30:00Z');
const seed=Array.from({length:96},(_,i)=>({time:stamp+i*interval,open:100+i*.1,high:101+i*.1,low:99+i*.1,close:100.5+i*.1,volume:100+i}));
function Test(){const [points,setPoints]=useState(seed),[timezone,setTimezone]=useState('UTC'),[intervalMs,setInterval]=useState(interval);
useEffect(()=>{window.chartTest={points,setTimezone,setInterval,replace:setPoints,flags:flags=>setPoints(old=>old.map(p=>({...p,confirmed:undefined,windowEnded:undefined,...flags}))),append:roll=>setPoints(old=>{const last=old.at(-1),next={...last,time:last.time+interval};return [...(roll?old.slice(1):old),next]})};},[points,timezone,intervalMs]);
return <main><h1>合成图表交互验证</h1><CandleChart points={points} currency="USDT" timezone={timezone} intervalMs={intervalMs}/></main>}
createRoot(document.getElementById('root')).render(<Test/>);`;
const result = await build({ stdin: { contents: source, resolveDir: root, loader: 'tsx', sourcefile: 'chart-fixture.tsx' }, alias: { '@': root }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
const css = (await Promise.all(['mono.css', 'mobile.css'].map(name => fs.readFile(path.join(root, 'app', name), 'utf8')))).join('\n');
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n*{box-sizing:border-box}body{margin:0;background:#111;color:#ddd;font:14px system-ui}main{padding:12px;max-width:1100px;margin:auto}h1{font-size:16px}.candlestick-panel{width:100%}button{font:inherit}</style><div id="root"></div><script src="/chart.js"></script></html>`;
const server = http.createServer((request, response) => {
  if (request.url === '/chart.js') { response.writeHead(200, { 'Content-Type': 'text/javascript' }); response.end(result.outputFiles[0].text); }
  else if (request.url === '/') { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(html); }
  else { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const report = { synthetic: true, browser: browser.version(), providerRequests: 0, checks: [], viewports: [], errors: [], external: [] };
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const snapshot = page => page.locator('.candle-canvas').evaluate(el => ({ start: Number(el.dataset.viewStart), count: Number(el.dataset.viewCount), selected: Number(el.dataset.selectedTime), first: Number(el.dataset.firstTime), follow: el.dataset.followLatest }));
const rightEdge = page => page.locator('.candle-canvas').evaluate(el => {
  const index = Number(el.dataset.viewStart) + Number(el.dataset.viewCount) - 1, lower = Math.floor(index), points = window.chartTest.points, fraction = index - lower;
  return points[lower].time + (fraction && points[lower + 1] ? fraction * (points[lower + 1].time - points[lower].time) : 0);
});
try {
  for (const [name, width, height] of [['desktop', 1440, 1000], ['tablet', 768, 1024], ['mobile', 390, 844], ['narrow', 320, 740], ['landscape', 844, 390]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', timezoneId: 'America/New_York' });
    await context.route('**/*', route => { if (new URL(route.request().url()).origin === base) return route.continue(); report.external.push(route.request().url()); return route.abort(); });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) report.providerRequests++; });
    await page.goto(base); await page.locator('.candle-canvas').waitFor(); await settle(page);
    const canvas = page.locator('.candle-canvas');
    assert.equal(await page.locator('.candle-confirmation').getAttribute('data-candle-confirmation'), 'unknown');
    await canvas.focus(); await page.keyboard.press('ArrowLeft'); await settle(page);
    const chosen = await snapshot(page);
    await page.evaluate(() => window.chartTest.append(true)); await settle(page);
    assert.equal((await snapshot(page)).selected, chosen.selected, `${name}: selected candle remains the same instant after rolloff`);
    const beforeZone = await snapshot(page), beforeText = await page.locator('.candle-readout strong').innerText();
    await page.evaluate(() => window.chartTest.setTimezone('Asia/Shanghai')); await settle(page);
    assert.deepEqual(await snapshot(page), beforeZone, `${name}: timezone does not reset view or selection`);
    assert.notEqual(await page.locator('.candle-readout strong').innerText(), beforeText);
    assert.match(await page.locator('.candle-readout strong').innerText(), /UTC\+08:00/);
    await page.keyboard.press('Home'); await settle(page); assert.equal((await snapshot(page)).start, 0);
    await page.keyboard.press('End'); await settle(page); assert.equal((await snapshot(page)).follow, 'true');
    const prior = await snapshot(page); await page.evaluate(() => window.chartTest.append(false)); await settle(page);
    assert.equal((await snapshot(page)).start, prior.start + 1, `${name}: latest follows appended bars`);
    await page.getByRole('button', { name: '放大 K 线', exact: true }).click(); await settle(page);
    assert.equal((await snapshot(page)).count, prior.count - 16);
    await page.getByRole('button', { name: '重置图表', exact: true }).click(); await settle(page);
    await page.evaluate(() => window.chartTest.flags({ windowEnded: true })); await settle(page);
    assert.match(await page.locator('.candle-confirmation').innerText(), /周期已结束.*收盘未确认/);
    await page.evaluate(() => window.chartTest.flags({ confirmed: false })); await settle(page);
    assert.equal(await page.locator('.candle-confirmation').getAttribute('data-candle-confirmation'), 'current');
    await page.evaluate(() => window.chartTest.flags({ confirmed: true })); await settle(page);
    assert.equal(await page.locator('.candle-confirmation').getAttribute('data-candle-confirmation'), 'confirmed');
    if (name === 'desktop') {
      await canvas.focus(); await page.keyboard.press('Shift+ArrowLeft'); await settle(page);
      const box = await canvas.boundingBox(), x = box.x + box.width * .45, y = box.y + box.height * .4;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 30, y); await settle(page);
      const beforeRoll = await rightEdge(page);
      await page.evaluate(() => window.chartTest.append(true)); await settle(page);
      assert.ok(Math.abs(await rightEdge(page) - beforeRoll) < .1);
      const count = (await snapshot(page)).count;
      const plotWidth = await canvas.evaluate(el => el.getBoundingClientRect().width * Number(el.querySelector('clipPath rect').getAttribute('width')) / el.viewBox.baseVal.width);
      await page.mouse.move(x + 31, y); await settle(page);
      assert.ok(Math.abs((await rightEdge(page)) - (beforeRoll - count * 900000 / plotWidth)) < 1, 'drag movement does not jump by a bar after source rolloff');
      await page.mouse.up();
      report.checks.push('actual held drag + rolling window update preserves the absolute time anchor');
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: horizontal containment`);
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
    report.viewports.push({ name, width, height });
    report.checks.push(`${name}: selection by time, zone change preserves view, follow latest, Home/End/zoom/reset, tri-state confirmation, no overflow`);
    await context.close();
  }
  assert.deepEqual(report.external, []);
  assert.equal(report.providerRequests, 0);
  assert.deepEqual(report.errors, []);
  await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
