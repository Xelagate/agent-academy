// Fold the level into one file that opens from disk: demo/lost-cat-level.html
// The artifact host supplies a doctype, a small reset and the assets over HTTP;
// offline we have to carry all three ourselves.
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const locale = process.argv[2] === 'en' ? 'en' : null;
const pageFile = locale ? 'index.en.html' : 'index.html';
const outFile = locale ? 'lost-cat-level-en.html' : 'lost-cat-level.html';
const lang = locale ? 'en' : 'uk';

const page = fs.readFileSync(path.join(dir, pageFile), 'utf8');

const dataUris = {};
function dataUri(name) {
  if (!dataUris[name]) {
    const bytes = fs.readFileSync(path.join(dir, 'assets', name));
    const mime = name.endsWith('.woff2') ? 'font/woff2' : name.endsWith('.mp3') ? 'audio/mpeg' : 'image/webp';
    dataUris[name] = 'data:' + mime + ';base64,' + bytes.toString('base64');
  }
  return dataUris[name];
}

// Every external script is inlined where it was loaded, so the order stays the same.
const inlined = page
  .replace(/<script src="([^"]+)"><\/script>/g, (_, src) =>
    '<script>\n' + fs.readFileSync(path.join(dir, src), 'utf8') + '\n</script>')
  .replace(/assets\/([a-z-]+\.webp)/g, (_, name) => dataUri(name))
  .replace(/assets\/voice\/([\w.-]+\.mp3)/g, (_, name) => dataUri('voice/' + name))
  .replace(/assets\/fonts\/([\w.-]+\.woff2)/g, (_, name) => dataUri('fonts/' + name));

if (inlined.includes('assets/') || inlined.includes('<script src=')) {
  throw new Error('something is still referenced from outside the file');
}

// The host's reset goes first so the page's own styles keep overriding it.
const split = inlined.indexOf('<div class="wrap">');
const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<style>img { max-width: 100%; } [hidden] { display: none !important; }</style>
${inlined.slice(0, split)}</head>
<body>
${inlined.slice(split)}
</body>
</html>
`;

const out = path.join(dir, outFile);
fs.writeFileSync(out, html);
console.log('wrote ' + out + ' — ' + Math.round(html.length / 1024) + ' KB');
