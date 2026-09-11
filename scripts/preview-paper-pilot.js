// Local design verification before encoding. No live queue edits or API calls.
const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
const dir=path.join(ROOT,'outputs/pilot-2026-09-12');
const queue=require(path.join(dir,'content/queue.json'));
const LIGHT=require('../light-style'), COLLAGE=require('../paper-collage');
const REELS=require('../render-reels');
(async()=>{
  const browser=await chromium.launch(LIGHT.browserOptions());
  try {
    const page=await browser.newPage({viewport:{width:1080,height:1350}});
    fs.mkdirSync(path.join(dir,'design'),{recursive:true});
    const evidence=[];
    for(const [i,s] of queue.posts[0].slides.entries()){
      await page.setContent(COLLAGE.slideHtml(s,i,6,queue.account));
      await LIGHT.fitContent(page);
      const check=await page.evaluate(()=>{
        const footer=document.querySelector('footer').getBoundingClientRect();
        const nodes=[...document.querySelectorAll('h1,h2,p,.eyebrow')];
        const violations=nodes.filter(n=>{const r=n.getBoundingClientRect();return r.x<55||r.right>1025||r.bottom>footer.top-10||n.scrollWidth>n.clientWidth+2;}).map(n=>n.textContent);
        return {violations,fontsReady:document.fonts.status,text:document.body.innerText};
      });
      if(check.violations.length)throw new Error(`Slide ${i+1}: ${check.violations.join(' / ')}`);
      await page.screenshot({path:path.join(dir,'design',`slide-${i+1}.jpg`),type:'jpeg',quality:93});
      evidence.push({slide:i+1,...check});
    }
    await page.setViewportSize({width:1080,height:1920});
    await page.setContent(REELS.pageHtml(queue.posts[1],queue.account));
    const fitting=await LIGHT.fitReelContent(page);
    await page.evaluate(()=>window.seek(100,1.2,2.8));
    const reelBounds=await page.evaluate(()=>{
      const card=document.querySelector('.card').getBoundingClientRect(),foot=document.querySelector('.foot').getBoundingClientRect(),photo=document.querySelector('.photo').getBoundingClientRect();
      const text=[...document.querySelectorAll('.row,.title,.kicker,.foot')].map(n=>({text:n.innerText,rect:n.getBoundingClientRect().toJSON()}));
      return {overlap:foot.top<card.bottom||foot.top<photo.bottom,unsafe:text.filter(n=>n.rect.x<60||n.rect.right>1020||n.rect.y<350||n.rect.bottom>1660),text};
    });
    if(reelBounds.overlap||reelBounds.unsafe.length)throw new Error(JSON.stringify(reelBounds));
    await page.screenshot({path:path.join(dir,'design','reel.jpg'),type:'jpeg',quality:93});
    evidence.push({reel:fitting,bounds:reelBounds});
    fs.writeFileSync(path.join(dir,'design/layout-check.json'),JSON.stringify(evidence,null,2));
    const sources=queue.posts[0].slides.map((_,i)=>`<img src="data:image/jpeg;base64,${fs.readFileSync(path.join(dir,'design',`slide-${i+1}.jpg`)).toString('base64')}">`).join('');
    await page.setViewportSize({width:1080,height:900});
    await page.setContent(`<html><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#e5dfd2;display:grid;grid-template-columns:repeat(3,1fr);gap:18px}img{width:100%;height:auto}</style><body>${sources}</body></html>`);
    await page.evaluate(async()=>Promise.all([...document.images].map(i=>i.decode())));
    await page.screenshot({path:path.join(dir,'contact-sheet.jpg'),type:'jpeg',quality:95,fullPage:true});
    console.log('6 slides and Reel preview rendered; bounds and fonts checked.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
