const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url'),{execFileSync}=require('child_process');
const {chromium}=require('playwright'),LIGHT=require('../light-style');
const root=path.resolve(__dirname,'..'),out=path.join(root,'outputs/pilot-2026-09-12');
(async()=>{
  const ffprobe=process.env.FFPROBE_BIN || (process.platform==='win32' && process.env.FFMPEG_BIN
    ? path.join(path.dirname(process.env.FFMPEG_BIN),'ffprobe.exe') : 'ffprobe');
  const q=require(path.join(out,'content/queue.json'));
  const result={queuePending:q.posts.every(p=>p.status==='pending'&&!p.date),videos:[]};
  for(const p of q.posts){
    const files=p.format==='Reels'?[`reels/${p.id}.mp4`]:p.slides.map((_,i)=>`images/${p.id}-${i+1}.mp4`);
    for(const file of files){
      const info=JSON.parse(execFileSync(ffprobe,['-v','error','-show_streams','-show_format','-of','json',path.join(out,'content',file)],{encoding:'utf8'}));
      const video=info.streams.find(s=>s.codec_type==='video'),audio=info.streams.find(s=>s.codec_type==='audio');
      if(!audio||!video||video.width!==1080||video.height!==(p.format==='Reels'?1920:1350))throw new Error(`Invalid media ${file}`);
      const duration=Number(info.format.duration),expected=p.format==='Reels'?14.6:6;
      if(Math.abs(duration-expected)>.1)throw new Error(`Wrong duration ${file}`);
      result.videos.push({file,width:video.width,height:video.height,duration,audio:audio.codec_name});
    }
  }
  const browser=await chromium.launch(LIGHT.browserOptions());
  try{
    const page=await browser.newPage({viewport:{width:1200,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.join(out,'index.html')).href);
    await page.locator('#carousel img').first().waitFor();
    await page.evaluate(async()=>Promise.all([...document.querySelectorAll('#carousel img')].map(i=>i.decode())));
    await page.screenshot({path:path.join(out,'gallery-desktop.jpg'),type:'jpeg',quality:90});
    await page.getByRole('tab',{name:'Reels · 14,6 с'}).click();
    const player=await page.locator('video').evaluate(async v=>{if(v.readyState<1)await new Promise((resolve,reject)=>{v.addEventListener('loadedmetadata',resolve,{once:true});v.addEventListener('error',reject,{once:true})});v.currentTime=13.5;await new Promise(resolve=>v.addEventListener('seeked',resolve,{once:true}));return {duration:v.duration,width:v.videoWidth,height:v.videoHeight,error:v.error?.message||null}});
    if(player.error||Math.abs(player.duration-14.6)>.1)throw new Error(JSON.stringify(player));
    await page.locator('video').screenshot({path:path.join(out,'decoded-final-frame.jpg'),type:'jpeg',quality:95});
    result.player=player;
    await page.setViewportSize({width:390,height:844});
    for(const id of ['carousel','reel','stories','sources']){
      await page.locator(`#t-${id}`).click();
      const fits=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
      if(!fits)throw new Error(`Mobile overflow: ${id}`);
    }
    await page.locator('#t-carousel').click();
    await page.screenshot({path:path.join(out,'gallery-mobile.jpg'),type:'jpeg',quality:90});
    const localLinks=await page.locator('a').evaluateAll(ns=>ns.map(n=>n.getAttribute('href')).filter(h=>h&&!/^(https?:|#)/.test(h)));
    for(const link of localLinks)if(!fs.existsSync(path.resolve(out,link)))throw new Error(`Broken local link: ${link}`);
    if(errors.length)throw new Error(errors.join('\n'));
    result.gallery={tabs:4,localLinks:localLinks.length,mobileWidth:390,overflow:false,jsErrors:errors};
    fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
