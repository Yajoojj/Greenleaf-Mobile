// Gera prints reais do app (docs/prints) dirigindo um Chrome/Edge headless via DevTools Protocol.
// Uso: npm run build && npm run preview  (em outro terminal)  →  node scripts/screenshots.mjs [url]
// Sem dependências: usa o WebSocket nativo do Node 22.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const OUT = resolve('docs/prints');
const BROWSERS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const exe = BROWSERS.find((p) => existsSync(p));
if (!exe) throw new Error('Chrome/Edge não encontrado. Defina CHROME_PATH.');

mkdirSync(OUT, { recursive: true });
const port = 9333;
const profile = mkdtempSync(join(tmpdir(), 'gl-shots-'));
const browser = spawn(exe, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--hide-scrollbars',
  '--lang=pt-BR',
  'about:blank',
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* ainda subindo */
    }
    await sleep(200);
  }
  throw new Error('DevTools não respondeu');
}

const ws = new WebSocket(await target());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;

async function viewport(width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile });
}

async function go(path, wait = 1200) {
  await send('Page.navigate', { url: BASE + path });
  await sleep(wait);
}

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log('✓', name);
}

const settings = (s) => `localStorage.setItem('gl.settings', JSON.stringify(${JSON.stringify({ locale: 'pt-BR', onboardingDone: true, authSeen: true, demoMode: false, ...s })}))`;
const clickText = (text) => `[...document.querySelectorAll('button,a')].find(b => b.textContent.includes(${JSON.stringify(text)}))?.click()`;
const scrollTo = (sel) => `document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({block:'start'}); window.scrollBy(0,-72)`;

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await viewport(390, 844, true);

  await go('/');
  await evaluate('localStorage.clear(); indexedDB.deleteDatabase("greenleaf")');
  await go('/', 1500);
  await shot('01-boas-vindas');
  await go('/entrar');
  await shot('02-entrar');

  await evaluate(settings({}));
  await go('/inicio', 1800);
  await shot('03-inicio');

  await evaluate(settings({ demoMode: true }));
  await go('/analisar', 1500);
  await shot('04-captura-demonstracao');

  await evaluate(`[...document.querySelectorAll('.gl-demo-tile')][3].click()`);
  await sleep(650);
  await shot('05-processando');
  await sleep(3000);
  await evaluate('window.scrollTo(0,0)');
  await shot('06-diagnostico-grave');
  await evaluate(scrollTo('.gl-image-compare'));
  await sleep(300);
  await shot('07-diagnostico-area-destacada');
  await evaluate(scrollTo('#dx-meaning'));
  await sleep(300);
  await shot('08-diagnostico-o-que-fazer');
  await evaluate(clickText('Salvar no histórico'));
  await sleep(600);

  for (const [i, label] of [[0, 'sadia'], [1, 'leve'], [2, 'moderada']]) {
    await go('/analisar', 1200);
    await evaluate(`[...document.querySelectorAll('.gl-demo-tile')][${i}].click()`);
    await sleep(3500);
    if (label === 'sadia') {
      await evaluate('window.scrollTo(0,0)');
      await shot('09-diagnostico-sadia');
    }
    await evaluate(clickText('Salvar no histórico'));
    await sleep(600);
  }

  await go('/historico', 1500);
  await shot('10-historico');
  await go('/saiba-mais', 1200);
  await shot('11-saiba-mais');
  await go('/perfil', 1500);
  await shot('12-perfil');
  await go('/suporte', 1200);
  await shot('13-suporte');

  await viewport(1280, 860, false);
  await go('/historico', 1200);
  await evaluate(`document.querySelector('a.gl-history-item').click()`);
  await sleep(1200);
  await shot('14-desktop-diagnostico');
} finally {
  ws.close();
  browser.kill();
}
