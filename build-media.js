#!/usr/bin/env node
// Build media and metadata together, without editing the editorial queue.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const LIGHT = require('./light-style');
const P = require('./prepared-media');
const { renderPost } = require('./render-reposts');
async function main(args = process.argv.slice(2)) {
  const ids = args.filter(Boolean);
  if (ids.some(id => !/^[a-zA-Z0-9_-]+$/.test(id))) throw new Error('Укажите только конкретные ID постов, без флагов.');
  const queuePath = path.join(P.CONTENT, 'queue.json');
  const original = fs.readFileSync(queuePath);
  const queue = JSON.parse(original);
  const targets = ids.length ? ids.map(id => { const p = queue.posts.find(p => p.id === id); if (!p) throw new Error(`Пост не найден: ${id}`); return p; })
    : queue.posts.filter(p => ['pending', 'approved'].includes(p.status));
  if (!targets.length) { console.log('Нет материалов для сборки.'); return []; }
  for (const p of targets) {
    if (!/^[a-zA-Z0-9_-]+$/.test(p.id) || p.status === 'published' || p.publishedMediaId || p.storyRepost?.items?.length) throw new Error(`${p.id}: начатый/опубликованный материал не пересобирается автоматически`);
    if (p.format === 'Reels' ? !p.rows?.length : !p.slides?.length) throw new Error(`${p.id}: неподдерживаемый или пустой материал`);
  }
  const lock = path.join(P.CONTENT, '.publish.lock');
  const lockFd = fs.openSync(lock, 'wx'); fs.closeSync(lockFd);
  let stage, browser;
  const stageParent = path.resolve(os.tmpdir());
  try {
    stage = fs.mkdtempSync(path.join(stageParent, 'mama-media-build-'));
    fs.writeFileSync(path.join(stage, 'queue.json'), JSON.stringify({ ...queue, posts: targets }));
    for (const dir of ['images', 'reels', 'reposts', 'prepared']) fs.mkdirSync(path.join(stage, dir));
    const env = { ...process.env, MEDIA_CONTENT_DIR: stage, MEDIA_BUILD_INTERNAL: '1' };
    for (const p of targets) {
      execFileSync(process.execPath, [path.join(__dirname, p.format === 'Reels' ? 'render-reels.js' : 'render.js'), p.id], { env, stdio: 'inherit' });
    }
    const rendered = JSON.parse(fs.readFileSync(path.join(stage, 'queue.json')));
    const repo = process.env.GITHUB_REPOSITORY || 'zairush8877-sys/repetitor';
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Некорректное имя репозитория');
    const raw = rel => `https://raw.githubusercontent.com/${repo}/main/content/${rel}`;
    const prepared = P.readIndex(P.CONTENT);
    const manifestPath = path.join(P.CONTENT, 'reposts/index.json');
    const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath)) : { version: 1, posts: {} };
    browser = await chromium.launch(LIGHT.browserOptions());
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    const results = [];
    for (const source of targets) {
      const p = rendered.posts.find(p => p.id === source.id);
      if (p.format === 'Reels') {
        p.videoUrl = raw(`reels/${p.id}.mp4`); delete p.imageUrls; delete p.videoUrls;
      } else {
        delete p.videoUrl;
        p.imageUrls = p.slides.map((_, i) => raw(`images/${p.id}-${i + 1}.jpg`));
        if (/карусель/i.test(p.format)) p.videoUrls = p.slides.map((_, i) => raw(`images/${p.id}-${i + 1}.mp4`));
        else { delete p.videoUrls; delete p.music; }
      }
      manifest.posts[p.id] = await renderPost(p, { page, contentDir: stage, outDir: path.join(stage, 'reposts'), rawBase: raw('reposts') });
      const urls = [...(p.imageUrls || []), ...(p.videoUrls || []), ...(p.videoUrl ? [p.videoUrl, p.videoUrl.replace(/\.mp4$/, '-frame.jpg')] : [])];
      const entry = { version: 1, draftKey: P.draftKey(source), builtAt: new Date().toISOString(), media: Object.fromEntries(P.MEDIA_FIELDS.filter(k => p[k] !== undefined).map(k => [k, p[k]])), files: [...new Set(urls)].map(url => {
        const relative = P.relativeUrl(url); const bytes = fs.readFileSync(P.localFile(relative, stage));
        return { relative, url, size: bytes.length, sha256: P.sha(bytes) };
      }) };
      prepared.posts[p.id] = entry;
      results.push(P.validate(source, { contentDir: stage, entry, manifest }).summary);
    }
    // Validate every target before replacing any live prepared assets.
    for (const dir of ['images', 'reels', 'reposts']) {
      fs.mkdirSync(path.join(P.CONTENT, dir), { recursive: true });
      for (const file of fs.readdirSync(path.join(stage, dir))) fs.copyFileSync(path.join(stage, dir, file), path.join(P.CONTENT, dir, file));
    }
    fs.mkdirSync(path.join(P.CONTENT, 'prepared'), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    const preparedPath = path.join(P.CONTENT, 'prepared/index.json');
    fs.writeFileSync(preparedPath + '.tmp', JSON.stringify(prepared, null, 2) + '\n'); fs.renameSync(preparedPath + '.tmp', preparedPath);
    const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    fs.writeFileSync(path.join(P.CONTENT, 'preview.html'), `<!doctype html><meta charset="utf-8"><title>Подготовленные материалы</title><style>body{font:18px system-ui;background:#fcfbf7;padding:30px}img,video{width:240px;vertical-align:top;margin:8px}section{margin-bottom:40px}</style><h1>Подготовленные материалы</h1><p>Сборка не меняет одобрения и даты.</p>${targets.map(p => {
      const media = prepared.posts[p.id].media;
      return `<section><h2>${esc(p.id)} · ${esc(p.status)}</h2>${media.videoUrl ? `<video controls src="${esc(P.relativeUrl(media.videoUrl))}"></video>` : media.imageUrls.map(u=>`<img src="${esc(P.relativeUrl(u))}" alt="Слайд">`).join('')}<h3>Stories</h3>${manifest.posts[p.id].assets.map(a=>`<img src="reposts/${esc(a.file)}" alt="Полный кадр Stories">`).join('')}</section>`;
    }).join('')}`);
    if (!original.equals(fs.readFileSync(queuePath))) throw new Error('Очередь изменилась во время сборки; требуется сверка.');
    for (const p of targets) P.validate(p);
    console.log(JSON.stringify({ prepared: results, queueUnchanged: true }, null, 2));
    return results;
  } finally {
    if (browser) await browser.close();
    if (stage) {
      const resolved = path.resolve(stage);
      if (path.dirname(resolved) !== stageParent || !path.basename(resolved).startsWith('mama-media-build-')) throw new Error('Unsafe temporary cleanup path');
      fs.rmSync(resolved, { recursive: true, force: true });
    }
    fs.unlinkSync(lock);
  }
}
module.exports = { main };
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
