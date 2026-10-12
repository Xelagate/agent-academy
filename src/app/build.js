// Compose the Seeker page: the standalone English level + parent gate + offline shell.
// Usage: node app/build.js <out-dir>   (the out dir is usually the agent-academy checkout)
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const out = process.argv[2];
if (!out) throw new Error('usage: node app/build.js <out-dir>');
const app = __dirname;
const demo = path.join(app, '..', 'demo');

execFileSync('node', [path.join(demo, 'build-standalone.js'), 'en'], { stdio: 'inherit' });
const level = fs.readFileSync(path.join(demo, 'lost-cat-level-en.html'), 'utf8');

const js = esbuild.buildSync({
  entryPoints: [path.join(app, 'parent.js')],
  bundle: true, format: 'iife', minify: true, target: 'es2020', write: false,
}).outputFiles[0].text;
if (js.includes('</script')) throw new Error('bundle would close its own <script> tag');
const css = fs.readFileSync(path.join(app, 'parent.css'), 'utf8');

const head = '<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#286b10">\n' +
  `<style>\n${css}\n</style>\n`;
const tail = `<script>\n${js}\n</script>\n` +
  "<script>if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js');</script>\n";

// Function replacers: the minified bundle contains `$&`-style sequences that string replacement would expand.
const page = level.replace('</head>', () => head + '</head>').replace('</body>', () => tail + '</body>');
if (page === level || !page.includes(tail)) throw new Error('could not find </head> or </body> in the level');

const cache = 'agent-academy-' + crypto.createHash('sha256').update(page).digest('hex').slice(0, 12);

fs.mkdirSync(path.join(out, 'icons'), { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), page);
fs.writeFileSync(path.join(out, 'sw.js'), fs.readFileSync(path.join(app, 'sw.js'), 'utf8').replace('__CACHE__', cache));
fs.copyFileSync(path.join(app, 'manifest.webmanifest'), path.join(out, 'manifest.webmanifest'));
for (const icon of ['icon-192.png', 'icon-512.png']) {
  fs.copyFileSync(path.join(app, 'icons', icon), path.join(out, 'icons', icon));
}
fs.cpSync(path.join(app, 'public'), out, { recursive: true });
console.log(`wrote ${out} — ${Math.round(page.length / 1024)} KB, cache ${cache}`);
