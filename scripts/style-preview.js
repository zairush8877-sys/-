const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const LIGHT = require('../light-style');
const RENDER = require('../render');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'outputs/style-review-2026-09-11');
const deliver = path.resolve(process.env.STYLE_DELIVERY_DIR || path.join(root, 'outputs/style-gallery-2026-09-11'));
const uri = file => `data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}`;
(async () => {
  fs.mkdirSync(output, { recursive: true });
  fs.mkdirSync(deliver, { recursive: true });
  const queue = JSON.parse(fs.readFileSync(path.join(root, 'content/queue.json')));
  const post = queue.posts.find(p => p.id === '2026-09-06-slova-smenili-znachenie');
  const browser = await chromium.launch(LIGHT.browserOptions());
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  const geometries = [];
  for (let i = 0; i < post.slides.length; i++) {
    await page.setContent(RENDER.slideHtml(post.slides[i], i, post.slides.length, queue.account, post.id));
    geometries.push({ slide: i + 1, ...await LIGHT.fitContent(page) });
    await page.screenshot({ path: path.join(output, `post-after-${i + 1}.jpg`), type: 'jpeg', quality: 94 });
  }
  const before = path.join(output, 'post-before.jpg');
  fs.copyFileSync(path.join(root, `content/images/${post.id}-1.jpg`), before);
  await page.setViewportSize({ width: 1460, height: 1210 });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${require('../fonts').fontFaceCss()}*{box-sizing:border-box}body{margin:0;padding:48px 60px;background:#eeeFE9;color:#243b35;font-family:'Golos Text',Arial}h1{font-size:42px;margin:0 0 12px}p{font-size:23px;margin:0 0 32px;color:#5c6c62}.grid{display:grid;grid-template-columns:1fr 1fr;gap:44px}.label{font-size:24px;margin-bottom:16px;font-weight:600}.grid img{width:100%;height:800px;object-fit:contain;object-position:top;border-radius:12px;background:#fff}.note{font-size:22px;line-height:1.4;margin-top:16px}</style><h1>Больше света. Тот же смысл.</h1><p>Один и тот же текст — две версии оформления · @mairova_a_a</p><div class="grid"><section><div class="label">Было · существующая обложка</div><img src="${uri(before)}"><div class="note">Фото во весь фон, тяжёлая карточка<br>и приглушённые оттенки.</div></section><section><div class="label">Предлагаю · светлый рабочий стол</div><img src="${uri(path.join(output, 'post-after-1.jpg'))}"><div class="note">Естественное фото целиком, без затемнения.<br>Текст отдельно, на светлой бумаге.</div></section></div>`);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async()=>Promise.all([...document.images].map(i=>i.decode())));
  await page.screenshot({path:path.join(output,'01-style-comparison.jpg'),type:'jpeg',quality:94});
  fs.writeFileSync(path.join(output, 'layout-checks.json'), JSON.stringify(geometries, null, 2));
  for (const file of ['01-style-comparison.jpg','post-before.jpg','post-after-1.jpg']) fs.copyFileSync(path.join(output,file),path.join(deliver,file));
  // Превью репоста использует тот же contain-рендер, что и будущая публикация.
  const { renderContain } = require('../render-reposts');
  const storyGeometry = await renderContain(path.join(output,'post-after-1.jpg'), path.join(output,'story-after.jpg'), { page, label: 'Карусель · все слайды по порядку', index:1, total:8 });
  fs.copyFileSync(path.join(output,'story-after.jpg'),path.join(deliver,'story-after.jpg'));
  fs.writeFileSync(path.join(output,'story-geometry.json'),JSON.stringify(storyGeometry,null,2));
  await browser.close();
  console.log(JSON.stringify({output, deliver, geometries}, null, 2));
})().catch(e=>{console.error(e);process.exitCode=1});
