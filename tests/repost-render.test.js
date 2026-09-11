const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { renderContain } = require('../render-reposts');

test('browser export upscales a small square and keeps four source corners inside the Story', { skip: !process.env.REPOST_RENDER_TEST }, async () => {
  const { chromium } = require('playwright');
  const b = await chromium.launch({ headless: true, ...(process.env.REPOST_BROWSER_CHANNEL ? { channel: process.env.REPOST_BROWSER_CHANNEL } : {}) });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repost-render-'));
  try {
    const page = await b.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 });
    await page.setContent('<style>body{margin:0;background:white}i{position:absolute;width:100px;height:100px}</style><i style="left:0;top:0;background:#f00"></i><i style="right:0;top:0;background:#0f0"></i><i style="left:0;bottom:0;background:#00f"></i><i style="right:0;bottom:0;background:#ff0"></i>');
    const source = path.join(dir, 'small.png'), out = path.join(dir, 'story.jpg');
    await page.screenshot({ path: source });
    const geometry = await renderContain(source, out, { page });
    assert.equal(geometry.width, 960); assert.equal(geometry.height, 960);
    const result = await page.evaluate(async ({ data, geometry }) => {
      const img = new Image(); img.src = data; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
      const { x, y, width: w, height: h } = geometry;
      return { width: img.width, height: img.height, pixels: [[x + 20, y + 20], [x + w - 20, y + 20], [x + 20, y + h - 20], [x + w - 20, y + h - 20]].map(([a, b]) => [...ctx.getImageData(a, b, 1, 1).data].slice(0, 3)) };
    }, { data: `data:image/jpeg;base64,${fs.readFileSync(out).toString('base64')}`, geometry });
    assert.equal(result.width, 1080); assert.equal(result.height, 1920);
    [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]].forEach((rgb, i) => rgb.forEach((v, channel) => assert.ok(Math.abs(result.pixels[i][channel] - v) < 12)));
  } finally {
    await b.close();
    // Explicit files only; no recursive deletion or computed directory removal.
    for (const name of ['small.png', 'story.jpg']) {
      const file = path.join(dir, name); if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
});
