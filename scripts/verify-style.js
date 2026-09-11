// Offline render verification. Does not modify queues or upload/publish anything.
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { chromium } = require('playwright');
const LIGHT = require('../light-style');
const REELS = require('../render-reels');
const STORIES = require('../render-stories');
const { renderContain } = require('../render-reposts');
const ROTATION = require('../rotation');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'outputs/style-review-2026-09-11');
async function geom(page) {
  return page.evaluate(() => Object.fromEntries(['.kicker','.title','.card','.foot','.photo','.audio-credit'].map(s => {
    const e = document.querySelector(s); const r = e?.getBoundingClientRect();
    return [s, r ? {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom} : null];
  })));
}
async function reelGeometry(page) {
  await page.evaluate(() => {
    const card = document.querySelector('.card'); const top = card.getBoundingClientRect().top;
    const padding = parseFloat(getComputedStyle(card).paddingBottom)||0;
    window.__geom={headBottom:document.querySelector('.head').getBoundingClientRect().bottom-top+padding,rows:[...document.querySelectorAll('.row')].map(r=>r.getBoundingClientRect().bottom-top+padding)};
  });
}
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const q=JSON.parse(fs.readFileSync(path.join(ROOT,'content/queue.json')));
  const bank=JSON.parse(fs.readFileSync(path.join(ROOT,'content/stories.json')));
  const before=fs.readFileSync(path.join(ROOT,'content/queue.json'));
  const browser=await chromium.launch(LIGHT.browserOptions());
  const page=await browser.newPage({viewport:{width:1080,height:1920}});
  const checks=[];
  for(const p of q.posts.filter(p=>p.status==='approved'&&p.rows)){
    await page.setContent(REELS.pageHtml(p,q.account));await LIGHT.fitReelContent(page);await reelGeometry(page);
    const total=REELS.INTRO+p.rows.length*REELS.ROW_STEP+REELS.OUTRO;
    await page.evaluate(([t,i,s])=>window.seek(t,i,s),[total-.05,REELS.INTRO,REELS.ROW_STEP]);
    const g=await geom(page);checks.push({kind:'reel',id:p.id,geometry:g});
    const contained = await page.evaluate(() => {
      const card = document.querySelector('.card').getBoundingClientRect();
      return [...document.querySelectorAll('.row')].every(row => row.getBoundingClientRect().bottom <= card.bottom + 1 && row.scrollWidth <= row.clientWidth + 1);
    });
    if (!contained) throw new Error(`${p.id}: a table row is clipped`);
    await page.screenshot({path:path.join(OUT,`${p.id}-after.jpg`),type:'jpeg',quality:94});
    if(g['.card'].bottom>g['.photo'].y-12||g['.kicker'].y<298) throw new Error(`${p.id}: card/photo overlap or unsafe top`);
  }
  const examples=[bank.stories.find(s=>s.type==='vopros'),bank.stories.find(s=>s.type!=='vopros')].filter(Boolean);
  for(const s of examples){
    for(const [i,html] of STORIES.framesFor(s).entries()){
      await page.setContent(html);await LIGHT.fitContent(page);
      const g=await geom(page);checks.push({kind:'story',id:s.id,frame:i+1,geometry:g});
      await page.screenshot({path:path.join(OUT,`${s.id}-${i+1}-after.jpg`),type:'jpeg',quality:94});
      if(g['.card'].y<298||g['.card'].bottom>g['.photo'].y-12)throw new Error(`${s.id}: unsafe story card`);
    }
  }
  const p=q.posts.find(p=>p.id==='2026-09-10-amfiboliya');
  await page.setContent(REELS.pageHtml(p,q.account));await LIGHT.fitReelContent(page);await reelGeometry(page);
  const tmp=path.join(OUT,'video-frames');fs.mkdirSync(tmp,{recursive:true});
  const total=REELS.INTRO+p.rows.length*REELS.ROW_STEP+REELS.OUTRO;
  const fps=15;
  for(let f=0;f<Math.ceil(total*fps);f++){
    await page.evaluate(([t,i,s])=>window.seek(t,i,s),[f/fps,REELS.INTRO,REELS.ROW_STEP]);
    await page.screenshot({path:path.join(tmp,`f${String(f).padStart(4,'0')}.jpg`),type:'jpeg',quality:90});
  }
  const track=ROTATION.chooseTrack(p.id);
  if(!track)throw new Error('No active licensed light track');
  const ffmpeg=require('ffmpeg-static');
  const video=path.join(OUT,'reel-light-music.mp4');
  execFileSync(ffmpeg,['-y','-framerate',String(fps),'-i',path.join(tmp,'f%04d.jpg'),'-i',path.join(ROOT,'content/music',track.file),'-t',String(total),'-af',`afade=t=out:st=${total-1.2}:d=1.2`,'-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',video],{stdio:['ignore','ignore','pipe']});
  const audio=spawnSync(ffmpeg,['-i',video,'-af','volumedetect','-f','null','-'],{encoding:'utf8'});
  if(audio.status!==0||!/Audio:/.test(audio.stderr)||/mean_volume: -inf/.test(audio.stderr))throw new Error('Audio verification failed');
  checks.push({kind:'audio',file:path.basename(video),track:track.piece,credit:track.attribution,meanVolume:/mean_volume: ([^\r\n]+)/.exec(audio.stderr)?.[1],maxVolume:/max_volume: ([^\r\n]+)/.exec(audio.stderr)?.[1]});
  await renderContain(path.join(OUT,`${p.id}-after.jpg`),path.join(OUT,'reel-story-after.jpg'),{page,label:'Кадр из Reels'});
  fs.writeFileSync(path.join(OUT,'render-verification.json'),JSON.stringify(checks,null,2));
  fs.writeFileSync(path.join(OUT,'MUSIC_CREDITS.txt'),track.attribution+'\nФото: JESHOOTS.COM, Clay Banks / Unsplash License.\n');
  if(!before.equals(fs.readFileSync(path.join(ROOT,'content/queue.json'))))throw new Error('Queue changed during preview');
  await browser.close();
  console.log(JSON.stringify({checks:checks.length,video,track:track.piece},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
