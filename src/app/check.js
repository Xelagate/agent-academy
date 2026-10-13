// Browser checks for the composed Seeker page.
// Usage: node app/build.js app/dist && NODE_PATH=$(npm root -g) node app/check.js
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'dist');
const FILE_PAGE = 'file://' + path.join(DIST, 'index.html');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

function check(ok, message) {
  if (!ok) throw new Error(message);
}

function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html');
    const file = path.join(DIST, rel);
    if (!file.startsWith(DIST) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// The wallet gate exists only on a Seeker; the default Playwright Chrome stands in for any other phone.
const SEEKER_UA = 'Mozilla/5.0 (Linux; Android 15; Seeker) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

async function open(browser, url, initScript, userAgent) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent });
  if (initScript) await context.addInitScript(initScript);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  return { context, page, errors };
}

async function composed(browser) {
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  check(html.includes('rel="manifest"'), 'manifest link missing');
  check(html.includes("serviceWorker.register('sw.js')"), 'service worker registration missing');
  check(!fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8').includes('__CACHE__'), 'cache name not stamped');
  const { context, errors } = await open(browser, FILE_PAGE);
  check(errors.length === 0, 'page errors: ' + errors.join(' | '));
  await context.close();
}

async function offline(browser) {
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/`;
  const { context, page } = await open(browser, url);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // the SW controls the page from here on
  await context.setOffline(true);
  await page.reload();
  check(await page.locator('#scene-course').count() === 1, 'game did not render offline');
  await context.close();
  server.close();
}

const KEY = 'agentAcademy.parent';
const ADDRESS = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const gate = (page) => page.locator('#aa-gate');

async function firstLaunch(browser) {
  const { context, page, errors } = await open(browser, FILE_PAGE, null, SEEKER_UA);
  await gate(page).waitFor();
  check(await page.locator('.wrap').evaluate((e) => e.inert), 'game reachable behind the gate');
  const parents = page.locator('#aa-parents');
  check(!(await parents.isVisible()) || (await parents.evaluate((e) => e.inert)), 'Parents button escapes the gate');
  await page.getByRole('button', { name: 'Just look around' }).click();
  await gate(page).waitFor({ state: 'detached' });
  check(!(await page.locator('.wrap').evaluate((e) => e.inert)), 'game still inert after looking around');
  check(await page.locator('#aa-parents').isVisible(), 'Parents button missing on the course map');
  await page.reload();
  await gate(page).waitFor({ timeout: 5000 }); // looking around must not remember a parent
  check(errors.length === 0, 'page errors: ' + errors.join(' | '));
  await context.close();
}

async function returningParent(browser) {
  const seed = ([k, v]) => localStorage.setItem(k, v);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: SEEKER_UA });
  await context.addInitScript(seed, [KEY, ADDRESS]);
  await context.addInitScript(() => localStorage.setItem('agent-creatures-progress',
    JSON.stringify({ jar: [{ id: 'waterWet', text: 'Why is water wet?', line: 'cardWhy' }] })));
  const page = await context.newPage();
  await page.goto(FILE_PAGE);
  check(await gate(page).count() === 0, 'gate shown to a signed-in parent');
  await page.locator('#aa-parents').click();
  check((await page.locator('#aa-address').textContent()) === '7xKX…gAsU', 'address not shortened');
  check(await page.locator('#aa-sheet').getByText('Why is water wet?').isVisible(), 'jar question missing in the parent area');
  await page.getByRole('button', { name: 'Disconnect' }).click();
  await gate(page).waitFor({ timeout: 5000 }); // Disconnect brings the gate back
  check(await page.evaluate((k) => localStorage.getItem(k), KEY) === null, 'Disconnect left the address stored');
  await context.close();
}

// Passes the Seeker check but has no "Android", so Mobile Wallet Adapter registers no wallet:
// the sign-in error path without a real wallet app.
const SEEKER_NO_WALLET_UA = 'Mozilla/5.0 (X11; Linux x86_64; Seeker) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

async function noWallet(browser) {
  const { context, page } = await open(browser, FILE_PAGE, null, SEEKER_NO_WALLET_UA);
  await page.locator('#aa-connect').click();
  await page.locator('#aa-gate-error').waitFor({ state: 'visible', timeout: 10000 });
  check(await page.locator('#aa-connect').isEnabled(), 'Connect stays disabled after a failure');
  check((await page.locator('#aa-connect').textContent()).trim() === 'Try again', 'no Try again after a failure');
  await page.getByRole('button', { name: 'Just look around' }).click();
  await gate(page).waitFor({ state: 'detached' });
  await context.close();
}

async function otherPhone(browser) {
  const { context, page, errors } = await open(browser, FILE_PAGE, () => localStorage.setItem('agent-creatures-progress',
    JSON.stringify({ jar: [{ id: 'waterWet', text: 'Why is water wet?', line: 'cardWhy' }] })));
  await page.locator('#scene-course').waitFor({ state: 'attached' });
  await page.waitForTimeout(500); // the Seeker check is async; give a wrong gate time to appear
  check(await gate(page).count() === 0, 'wallet gate shown on a phone without a wallet');
  check(!(await page.locator('.wrap').evaluate((e) => e.inert)), 'game inert on a phone without a wallet');
  await page.locator('#aa-parents').click();
  check(await page.locator('#aa-sheet').getByText('Why is water wet?').isVisible(), 'jar question missing in the parent area');
  check(!(await page.locator('#aa-account').isVisible()), 'wallet button shown on a phone without a wallet');
  check(!(await page.locator('.aa-sheet__wallet').isVisible()), 'wallet line shown on a phone without a wallet');
  check(errors.length === 0, 'page errors: ' + errors.join(' | '));
  await context.close();
}

const CHECKS = { composed, firstLaunch, returningParent, noWallet, otherPhone, offline };

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [name, run] of Object.entries(CHECKS)) {
      await run(browser);
      console.log('PASS ' + name);
    }
    console.log('APP CHECK PASS');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('APP CHECK FAIL:', e.message); process.exit(1); });
