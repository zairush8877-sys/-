// Local review package: render remaining slide layouts, copy previews, build gallery.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const LIGHT = require('../light-style');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'outputs/style-review-2026-09-11');
const DELIVER = path.resolve(process.env.STYLE_DELIVERY_DIR || path.join(ROOT, 'outputs/style-gallery-2026-09-11'));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
(async () => {
  const queue = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/queue.json')));
  const browser = await chromium.launch(LIGHT.browserOptions());
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  const checks = [];
  for (const layout of ['pair', 'photo']) {
    const post = queue.posts.find(p => p.id === (layout === 'pair' ? '2026-09-05-slova-obmanki' : '2026-09-30-proba-foto'));
    for (const [i, slide] of post.slides.entries()) {
      if (slide.layout !== layout) continue;
      await page.setContent(LIGHT.slideHtml(slide, i, post.slides.length, queue.account, post.id));
      checks.push({ id: post.id, layout, slide: i + 1, ...await LIGHT.fitContent(page) });
      await page.screenshot({ path: path.join(OUT, `${layout}-${i + 1}-after.jpg`), type: 'jpeg', quality: 93 });
    }
  }
  fs.writeFileSync(path.join(OUT, 'additional-layout-checks.json'), JSON.stringify(checks, null, 2));
  fs.mkdirSync(DELIVER, { recursive: true });
  for (const f of fs.readdirSync(OUT)) {
    if (/\.(jpg|mp4|json|txt)$/.test(f)) fs.copyFileSync(path.join(OUT, f), path.join(DELIVER, f));
  }
  for (const f of ['light-carefree.mp3', 'light-easy-lemon.mp3']) fs.copyFileSync(path.join(ROOT, 'content/music', f), path.join(DELIVER, f));
  for (const f of ['PIPELINE_PLAN.md', 'STYLE_RESEARCH_2026-09-11.md', 'REPOST_AUDIT.md', 'STYLE_UPDATE_2026-09-11.md', 'BUILD_PIPELINE.md', 'REFERENCE_FORMATS_2026-09-11.md']) fs.copyFileSync(path.join(ROOT, 'docs', f), path.join(DELIVER, f));
  const tracks = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/music/index.json'))).tracks.filter(t => t.active !== false);
  fs.writeFileSync(path.join(DELIVER, 'MUSIC_CREDITS.txt'), tracks.map(t => `${t.attribution}\nИсточник: ${t.source}`).join('\n\n') + '\n');
  const gallery = `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Новая подача · Анна Маирова</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f7f7f2;color:#263f35;font:17px/1.6 system-ui,sans-serif}main{max-width:1180px;margin:auto;padding:44px 24px 70px}h1{font-size:clamp(30px,5vw,52px);line-height:1.1;margin:14px 0}h2{font-size:28px;margin:42px 0 16px}p{max-width:850px}a{color:#25664f}img{display:block;width:100%;height:auto;border-radius:12px}.wide{max-width:1050px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:22px}.grid img{height:520px;object-fit:contain;background:#eef1e9}figure{margin:0}figcaption{font-size:15px;margin-top:9px}video{width:100%;max-height:660px;background:#eef1e9;border-radius:12px}audio{width:100%}.tag{font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#617267}.note{padding:16px 20px;border:1px solid #dce4d9;border-radius:12px;background:white}.credits{font-size:13px;word-break:break-word}.slides{display:flex;overflow:auto;gap:16px;padding-bottom:20px}.slides img{width:260px;flex-shrink:0}button{font:inherit}footer{margin-top:42px;border-top:1px solid #dce4d9;padding-top:20px;font-size:14px}</style><main>
  <div class="tag">11 сентября 2026 · локальный просмотр</div><h1>Светлее, спокойнее, понятнее</h1><p>Естественные фотографии рабочего стола, отдельное поле для текста и лёгкая музыка. Языковые тексты взяты из существующих материалов для сравнения оформления.</p>
  <img class="wide" src="01-style-comparison.jpg" alt="Один и тот же текст: прежняя обложка и светлое оформление">
  <h2>Пост и Stories</h2><div class="grid"><figure><img src="post-after-1.jpg" alt="Светлый пост"><figcaption>Пост 1080 × 1350.</figcaption></figure><figure><img src="story-after.jpg" alt="Пост целиком в Stories с полями"><figcaption>Тот же пост целиком в Stories. Пропорции сохранены.</figcaption></figure><figure><img src="st-01-1-after.jpg" alt="Вопрос в Stories"><figcaption>Отдельная Stories с языковой задачей.</figcaption></figure></div>
  <h2>Карусель: все восемь слайдов</h2><div class="slides">${Array.from({length:8},(_,i)=>`<img src="post-after-${i+1}.jpg" alt="Слайд ${i+1} из восьми">`).join('')}</div>
  <h2>Reels с лёгкой музыкой</h2><div class="grid"><figure><video controls preload="metadata" poster="2026-09-10-amfiboliya-after.jpg" src="reel-light-music.mp4"></video><figcaption>Пример со звуком · Carefree, Kevin MacLeod. Локальное превью 15 кадров/с.</figcaption></figure><figure><img src="reel-story-after.jpg" alt="Полный кадр Reels в Stories"><figcaption>В Stories размещается финальный кадр. Это анонс; он не переносит всё видео и не является кликабельным стикером.</figcaption></figure></div>
  <p class="credits">${esc(tracks.find(t=>t.piece==='Carefree').attribution)}</p>
  <h2>Два варианта музыки</h2><p>Это проверенные записи с лицензией CC BY 4.0. Их трендовость и доступность в музыкальной библиотеке аккаунта не подтверждены.</p><div class="grid">${tracks.map(t=>`<figure><audio controls preload="metadata" src="${esc(t.file)}"></audio><figcaption>${esc(t.piece)} · ${t.bpm} BPM<br><a href="${esc(t.source)}">Страница записи</a> · <a href="${esc(t.licenseUrl)}">Лицензия</a></figcaption></figure>`).join('')}</div>
  <h2>Что изменилось в репостах</h2><p>Пост вписывается целиком; карусель разбивается на последовательные Stories; каждый кадр получает собственный статус и подтверждённый ID после отправки. Повтор пропускает уже подтверждённые кадры. Неизвестный результат требует сверки.</p><p class="note">Публикации и расписание Instagram не менялись. Изменения конвейера пока локальные. У старых 32 публикаций нет сохранённых ID Stories: найдена одна ошибка попытки, один успешный результат в журнале, для остальных нет сопоставленного подтверждения. Автоматического повтора старой очереди нет.</p>
  <h2>План и источники</h2><p><a href="PIPELINE_PLAN.md">Обновлённый план</a> · <a href="STYLE_UPDATE_2026-09-11.md">Отчёт о выполнении</a> · <a href="STYLE_RESEARCH_2026-09-11.md">Исследование форматов, фото и музыки</a> · <a href="REPOST_AUDIT.md">Проверка репостов</a> · <a href="MUSIC_CREDITS.txt">Музыкальные кредиты</a></p>
  <footer>Фото: JESHOOTS.COM и Clay Banks / Unsplash License. Это стоковые снимки, не фотографии Анны или её учеников. Примеры показывают оформление; перед выпуском конкретной партии проверяются тексты, источники и даты.</footer></main></html>`;
  const extraLinks = '<h2>Новые референсы и сборка</h2><p><a href="REFERENCE_FORMATS_2026-09-11.md">Разбор присланных форматов</a> · <a href="BUILD_PIPELINE.md">Готовая локальная связка сборки</a></p>';
  fs.writeFileSync(path.join(DELIVER, 'index.html'), gallery.replace('<h2>План и источники</h2>', extraLinks + '<h2>План и источники</h2>'));
  await page.setViewportSize({width:1280,height:950});
  await page.goto('file:///' + path.join(DELIVER,'index.html').replace(/\\/g,'/'));
  await page.evaluate(async()=>Promise.all([...document.images].map(i=>i.decode())));
  const media = await page.evaluate(()=>({imageCount:document.images.length,allLoaded:[...document.images].every(i=>i.naturalWidth>0),overflow:document.documentElement.scrollWidth>innerWidth}));
  if (!media.allLoaded || media.overflow) throw new Error('Gallery assets or layout invalid');
  await page.screenshot({path:path.join(DELIVER,'gallery-preview.jpg'),type:'jpeg',quality:92});
  await browser.close();
  console.log(JSON.stringify({additionalLayouts:checks.length,deliver:DELIVER,gallery:media},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
