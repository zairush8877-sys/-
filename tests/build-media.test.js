const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const P = require('../prepared-media');
const ROOT = path.resolve(__dirname, '..');

test('real entrypoints build post, full carousel and Reel into the sender contract without changing the editorial queue', { skip: !process.env.MEDIA_BUILD_TEST, timeout: 600000 }, () => {
  const out = path.join(ROOT, 'outputs/build-integration-2026-09-11');
  fs.mkdirSync(out, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(out, 'run-'));
  const queuePath = path.join(ROOT, 'content/queue.json');
  const realBefore = fs.readFileSync(queuePath);
  const storiesBefore = fs.readFileSync(path.join(ROOT, 'content/stories.json'));
  const queue = JSON.parse(realBefore);
  const select = [
    ['integration-post', queue.posts.find(p => p.id === '2026-08-08-netslov')],
    ['integration-carousel', queue.posts.find(p => p.id === '2026-09-06-slova-smenili-znachenie')],
    ['integration-reel', queue.posts.find(p => p.id === '2026-09-10-amfiboliya')],
  ];
  const posts = select.map(([id, source]) => {
    assert.ok(source, id);
    const p = structuredClone(source);
    p.id = id; p.status = 'approved'; p.date = '2000-01-01';
    delete p.publishedMediaId; delete p.publishedAt; delete p.storyRepost;
    for (const field of P.MEDIA_FIELDS) delete p[field];
    return p;
  });
  const isolated = { account: queue.account, account_id: 'offline-test-only', posts };
  const isolatedFile = path.join(fixture, 'queue.json');
  fs.writeFileSync(isolatedFile, JSON.stringify(isolated, null, 2));
  const isolatedBefore = fs.readFileSync(isolatedFile);
  const env = { ...process.env, MEDIA_CONTENT_DIR: fixture, IG_ACCESS_TOKEN: '', IG_USER_ID: '', GITHUB_REPOSITORY: 'zairush8877-sys/repetitor' };
  delete env.MEDIA_BUILD_INTERNAL;
  const run = (args, expected = 0) => {
    const r = spawnSync(process.execPath, args, { cwd: ROOT, env, encoding: 'utf8', timeout: 300000, maxBuffer: 4 * 1024 * 1024 });
    assert.equal(r.status, expected, `${args.join(' ')}\n${r.error || ''}\n${r.stderr}\n${r.stdout}`);
    return r.stdout;
  };
  run(['render.js', 'integration-post']);
  run(['build-media.js', 'integration-carousel']);
  run(['render-reels.js', 'integration-reel']);
  const verified = JSON.parse(run(['publish.js', '--validate-prepared']));
  assert.deepEqual(verified.map(p => p.storyFrames), [1, 8, 1]);
  const dryRun = run(['publish.js', '--dry-run']);
  assert.equal((dryRun.match(/Файлы и метаданные проверены локально/g) || []).length, 3);
  assert.deepEqual(fs.readFileSync(isolatedFile), isolatedBefore);
  const ready = P.validate(posts[2], { contentDir: fixture });
  assert.ok(ready.post.videoUrl.endsWith('/content/reels/integration-reel.mp4'));
  assert.ok(ready.post.coverOffsetMs > 0);
  assert.ok(ready.post.music.attribution.includes('CC BY 4.0'));
  const ffmpeg = require('ffmpeg-static');
  const video = spawnSync(ffmpeg, ['-i', path.join(fixture, 'reels/integration-reel.mp4'), '-f', 'null', '-'], { encoding: 'utf8' });
  assert.equal(video.status, 0, video.stderr);
  assert.match(video.stderr, /1080x1920/); assert.match(video.stderr, /Audio:/);
  // A corrupt Story must block the whole publication in the real dry-run entrypoint.
  const story = path.join(fixture, 'reposts/integration-carousel-8.jpg');
  const bytes = fs.readFileSync(story); fs.appendFileSync(story, 'tamper');
  run(['publish.js', '--dry-run', 'integration-carousel'], 1);
  fs.writeFileSync(story, bytes);
  const missing = path.join(fixture, 'reels/integration-reel-frame.jpg');
  fs.renameSync(missing, missing + '.held');
  try { run(['publish.js', '--validate-prepared', 'integration-reel'], 1); } finally { fs.renameSync(missing + '.held', missing); }
  assert.throws(() => P.validate({ ...posts[0], caption: 'changed after build' }, { contentDir: fixture }), /нет актуальной сборки/);
  const pending = { ...posts[0], status: 'pending' };
  assert.equal(P.validate(pending, { contentDir: fixture }).post.status, 'pending');
  const pendingQueue = { ...isolated, posts: [pending] };
  fs.writeFileSync(isolatedFile, JSON.stringify(pendingQueue));
  run(['publish.js', '--dry-run', pending.id], 1);
  fs.writeFileSync(isolatedFile, isolatedBefore);
  assert.deepEqual(fs.readFileSync(queuePath), realBefore);
  assert.deepEqual(fs.readFileSync(path.join(ROOT, 'content/stories.json')), storiesBefore);
  const report = { checkedAt: new Date().toISOString(), fixture, entrypoints: ['render.js', 'build-media.js', 'render-reels.js'], verified, dryRun, negativeChecks: ['corrupt eighth Story blocks sender', 'missing Reel frame blocks validation', 'changed editorial content invalidates metadata', 'pending content cannot publish'], queueUnchanged: true, realQueuesUnchanged: true, reelVideoAndAudioDecoded: true, noInstagramCalls: true };
  fs.writeFileSync(path.join(out, 'integration-result.json'), JSON.stringify(report, null, 2));
});
