// Removes the flat lavender backdrop from generated art by flood fill from the frame edges.
// Usage: NODE_PATH=$(npm root -g) node keyout.js <in.png> <out.png> <edges>
//   edges "tlrb" = full-body creature (also clears the contact shadow and enclosed pockets),
//   edges "tlr"  = portrait (clothes touch the bottom edge, so it is never seeded).
const { chromium } = require('playwright');
const fs = require('fs');
const [inp, out, edges = 'tlrb'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const src = 'data:image/png;base64,' + fs.readFileSync(inp).toString('base64');
  const png = await p.evaluate(async ({ src, edges }) => {
    const img = new Image(); img.src = src; await img.decode();
    const W = img.width, H = img.height;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, W, H), a = d.data;
    // Lavender backdrop and its darker contact shadow share one hue: blue well above red,
    // green only slightly above red. Blue clothes/feathers have green far above red.
    const bg = i => { const r = a[i], g = a[i+1], bl = a[i+2], u = bl - r, v = g - r;
      const loose = edges.includes('b');
      return bl >= (loose ? 80 : 150) && u >= 45 && u <= 100 && v >= (loose ? -25 : -6) && v <= 15; };
    const seen = new Uint8Array(W * H), q = [];
    const push = (px, py) => { const k = py * W + px; if (!seen[k] && bg(k * 4)) { seen[k] = 1; q.push(k); } };
    for (let i = 0; i < W; i++) { if (edges.includes('t')) push(i, 0); if (edges.includes('b')) push(i, H - 1); }
    // Portraits: side edges are seeded only down to the first non-backdrop pixel, because
    // clothes that reach the frame edge below can be almost backdrop-coloured (light plaid).
    const run = !edges.includes('b');
    for (const [e, px] of [['l', 0], ['r', W - 1]]) { if (!edges.includes(e)) continue;
      for (let j = 0; j < H; j++) { if (run && !bg((j * W + px) * 4)) break; push(px, j); } }
    // Enclosed pockets (between tail and feet) are seeded by an exact backdrop match.
    const r0 = a[0], g0 = a[1], b0 = a[2];
    if (edges.includes("b")) for (let k = 0; k < W * H; k++) { const i = k * 4;
      if (Math.abs(a[i]-r0) + Math.abs(a[i+1]-g0) + Math.abs(a[i+2]-b0) < 24) push(k % W, (k - k % W) / W); }
    while (q.length) { const k = q.pop(), px = k % W, py = (k - px) / W;
      if (px > 0) push(px - 1, py); if (px < W - 1) push(px + 1, py);
      if (py > 0) push(px, py - 1); if (py < H - 1) push(px, py + 1); }
    for (let k = 0; k < W * H; k++) if (seen[k]) a[k * 4 + 3] = 0;
    // Rim matting: fur edges are part backdrop over several pixels. In a band next to the
    // removed area, alpha comes from the distance to the backdrop colour, and the backdrop
    // share is subtracted back out of the colour (C = a*F + (1-a)*B).
    let ring = seen.slice();
    for (let r = 1; r <= 8; r++) {
      const next = ring.slice();
      for (let k = 0; k < W * H; k++) { if (ring[k]) continue; const px = k % W;
        if (!((px > 0 && ring[k-1]) || (px < W-1 && ring[k+1]) || ring[k-W] || ring[k+W])) continue;
        next[k] = 1; const i = k * 4;
        const dist = Math.hypot(a[i] - r0, a[i+1] - g0, a[i+2] - b0);
        const al = Math.min(1, Math.max(0, (dist - 15) / 90));
        if (al >= 1) continue;
        a[i + 3] = Math.round(al * 255);
        if (al > 0) [r0, g0, b0].forEach((B, j) =>
          { a[i+j] = Math.min(255, Math.max(0, (a[i+j] - (1 - al) * B) / al)); }); }
      ring = next; }
    x.putImageData(d, 0, 0);
    return c.toDataURL('image/png');
  }, { src, edges });
  fs.writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'));
  await b.close();
})();
