// One-off: render the launcher icons from the beaver art. Usage: NODE_PATH=$(npm root -g) node app/make-icons.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const art = 'data:image/webp;base64,' +
  fs.readFileSync(path.join(__dirname, '..', 'demo', 'assets', 'creature-beaver.webp')).toString('base64');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  fs.mkdirSync(path.join(__dirname, 'icons'), { recursive: true });
  for (const size of [192, 512]) {
    const png = await page.evaluate(async ({ art, size }) => {
      const img = new Image();
      img.src = art;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      g.fillStyle = '#ffd34e';
      g.fillRect(0, 0, size, size);
      // Trim the art's transparent margin, then fit the beaver into the maskable safe zone
      // (the APK's webshell insets the icon again, so the launcher shows this whole square).
      const t = document.createElement('canvas');
      t.width = img.width; t.height = img.height;
      const tg = t.getContext('2d');
      tg.drawImage(img, 0, 0);
      const { data } = tg.getImageData(0, 0, img.width, img.height);
      let x0 = img.width, y0 = img.height, x1 = 0, y1 = 0;
      for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
        if (data[(y * img.width + x) * 4 + 3] > 16) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      }
      const aw = x1 - x0 + 1, ah = y1 - y0 + 1;
      const box = size * 0.78;
      const scale = Math.min(box / aw, box / ah);
      const w = aw * scale, h = ah * scale;
      g.drawImage(img, x0, y0, aw, ah, (size - w) / 2, (size - h) / 2, w, h);
      return c.toDataURL('image/png').split(',')[1];
    }, { art, size });
    fs.writeFileSync(path.join(__dirname, 'icons', `icon-${size}.png`), Buffer.from(png, 'base64'));
  }
  await browser.close();
})();
