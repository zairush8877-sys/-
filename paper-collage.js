// Opt-in editorial theme. Photos are explicit, licensed assets, never random.
const fs = require('fs');
const path = require('path');
const F = require('./fonts');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const txt = v => esc(v).replace(/\n/g, '<br>');
function photo(key) {
  const p = require('./assets/photos/paper-collage.json').photos.find(p => p.id === key);
  if (!p || !p.author || !p.source || !p.licenseUrl) throw new Error(`Missing verified collage photo: ${key}`);
  return p;
}
function img(key, cls = '') {
  const p = photo(key);
  return `<figure class="${esc(cls)}"><img alt="${esc(p.alt)}" src="data:image/jpeg;base64,${fs.readFileSync(path.join(__dirname,p.file)).toString('base64')}"></figure>`;
}
function slideHtml(s, i, total, handle, width=1080, height=1350) {
  let body = '';
  if (s.layout === 'collage-cover') {
    body = `${img(s.photo, 'hero')}<section class="cover-paper"><span class="eyebrow">${txt(s.kicker)}</span><h1>${txt(s.title)}</h1><p class="sub">${txt(s.sub)}</p><p class="hand">${txt(s.note)}</p></section>`;
  } else if (s.layout === 'collage-pair') {
    const dual = s.photos.length === 2;
    body = `<section class="inner"><div class="titleline"><span class="number">${i}</span><h1>${txt(s.title)}</h1></div><div class="pictures ${dual?'dual':'single'}">${s.photos.map(p=>img(p)).join('')}</div><div class="definitions">${s.meanings.map(m=>`<div><h2>${txt(m.word)}</h2><p>${txt(m.definition)}</p></div>`).join('')}</div><p class="hand">${txt(s.note)}</p></section>`;
  } else if (s.layout === 'collage-exercise' || s.layout === 'collage-answer') {
    body = `<section class="inner textpage"><span class="eyebrow">${txt(s.kicker)}</span><h1>${txt(s.title)}</h1><div class="sentences">${s.lines.map((line,j)=>`<p><span class="n">0${j+1}</span><span>${txt(line)}</span></p>`).join('')}</div><p class="hand">${txt(s.note)}</p></section>`;
  } else throw new Error(`Unsupported paper-collage layout: ${s.layout}`);
  return `<!doctype html><html lang="ru"><meta charset="utf-8"><style>${F.fontFaceCss()}
  *{box-sizing:border-box;margin:0}body{width:${width}px;height:${height}px;background:#f7f3e9;color:#153f92;font-family:${F.body()};position:relative;overflow:hidden}
  body::after{content:'';pointer-events:none;position:absolute;inset:0;opacity:.08;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Cpath fill='%23545043' opacity='.5' filter='url(%23n)' d='M0 0h180v180H0z'/%3E%3C/svg%3E")}
  header,footer{position:absolute;left:72px;right:72px;display:flex;justify-content:space-between;font-size:25px;z-index:2}header{top:50px}footer{bottom:49px;font-size:24px;align-items:center}footer span:last-child{font-family:${F.hand()};font-size:32px}
  h1{font:600 83px/1.1 ${F.serif()};letter-spacing:-2px}h2{font:600 72px/1.25 ${F.serif()};margin:0 0 13px}p{font-size:33px;line-height:1.35;color:#333c46}.eyebrow{display:block;font-size:26px;margin-bottom:25px;letter-spacing:.035em}.hand{font:600 41px/1.2 ${F.hand()};color:#153f92}.sub{font-size:35px;line-height:1.35;max-width:810px}
  figure{margin:0;display:flex;align-items:center;justify-content:center}figure img{width:100%;height:100%;object-fit:contain;display:block}.hero{position:absolute;top:125px;left:45px;width:990px;height:683px;background:#fff;padding:12px;transform:rotate(-2deg);box-shadow:0 10px 24px #37362516}
  .cover-paper{position:absolute;left:0;top:758px;width:100%;padding:60px 76px 35px;background:#f7f3e9;clip-path:polygon(0 3%,3% 2%,6% 4%,10% 1%,14% 3%,18% 1%,23% 3%,28% 0,33% 3%,38% 2%,44% 4%,49% 1%,54% 3%,60% 0,65% 3%,72% 2%,77% 4%,83% 1%,88% 3%,94% 1%,100% 3%,100% 100%,0 100%)}.cover-paper h1{margin-bottom:24px}.cover-paper .hand{margin-top:24px}
  .inner{position:absolute;left:76px;right:76px;top:153px;bottom:132px}.titleline{display:flex;gap:33px;align-items:center}.number{font:400 151px/1 ${F.serif()};opacity:.9}.titleline h1{font-size:79px}.pictures{height:420px;margin:50px 0 33px;display:flex;justify-content:center;gap:38px}.pictures.dual{height:440px;margin-top:45px}.pictures.dual figure{width:350px;background:#fff;padding:12px;transform:rotate(-3deg);box-shadow:0 8px 16px #37362516}.pictures.dual figure:nth-child(2){transform:rotate(3deg)}.pictures.single figure{width:760px;background:white;padding:13px;transform:rotate(-1.5deg);box-shadow:0 8px 16px #37362516}.definitions{display:grid;grid-template-columns:1fr 1fr;gap:42px;border-top:1px solid #153f9240;padding-top:29px}.definitions>div+div{border-left:1px solid #153f9230;padding-left:37px}.definitions p{font-size:33px;line-height:1.3}.inner>.hand{margin-top:40px}
  .textpage{top:198px}.textpage h1{font-size:84px;margin-bottom:75px}.sentences{display:flex;flex-direction:column;gap:30px}.sentences p{display:flex;gap:30px;font-size:44px;line-height:1.3;padding:28px 0;border-bottom:1px solid #153f9238}.n{font:400 30px ${F.serif()};color:#153f92;padding-top:7px}.textpage>.hand{margin-top:72px;font-size:43px}
  body.answer{background:#173f92;color:#fff9e9}.answer p,.answer .hand,.answer .n{color:#fff9e9}.answer .sentences p{border-color:#fff9e946;font-size:47px}.answer .textpage h1{font-size:88px}
  .cover-paper{top:738px}
  </style><body class="${s.layout==='collage-answer'?'answer':''}"><header><span>русский язык · с Анной</span><span>${String(i+1).padStart(2,'0')} / ${String(total).padStart(2,'0')}</span></header>${body}<footer><span>@${esc(handle)}</span><span>${esc(s.footer || 'прочитайте вслух')}</span></footer></body></html>`;
}
function reelHtml(post, handle, legacy) {
  const p=photo(post.photo);
  return legacy({...post,background:p.file,lightBg:true,videoBg:undefined},handle).replace('</style>',`
  body{background:#f7f3e9!important;padding:350px 76px 560px!important;color:#153f92!important;font-family:${F.body()}!important}
  body::before{display:none!important}.kicker{font:28px ${F.body()}!important;letter-spacing:.04em!important;color:#153f92!important;margin-bottom:28px!important}.title{font:600 78px/1.12 ${F.serif()}!important;color:#153f92!important;margin-bottom:38px!important}.plate{background:none!important;color:inherit!important;padding:0!important}
  .card{background:#fffdf7!important;border:1px solid #153f9238;box-shadow:none!important;padding:24px 30px!important;flex-shrink:0}.head{font-size:23px!important;color:#153f92!important;letter-spacing:.03em!important}.row{padding:25px 0!important;font-size:46px!important;line-height:1.27!important;border-color:#153f9230!important}.bad,.good{white-space:pre-line;color:#153f92!important;text-decoration:none!important;font-family:${F.body()}!important}.progress i{background:#d9b45d!important}
  .photo{position:absolute;left:76px;right:76px;bottom:290px;height:235px;background:white;padding:12px;display:flex;justify-content:center}.photo img{width:100%;height:100%;object-fit:contain}.foot{bottom:240px!important;color:#153f92!important;text-shadow:none!important;font:25px ${F.body()}!important}.foot *{color:#153f92!important;text-shadow:none!important}
  body{padding-top:360px!important}.foot{position:absolute!important;left:76px!important;right:76px!important;bottom:260px!important;font-size:24px!important;line-height:28px!important}.photo{bottom:310px;height:220px;background:transparent;padding:0;gap:25px}.photo figure{width:30%;height:100%;background:white;padding:10px;transform:rotate(-2deg)}.photo figure:nth-child(2){transform:rotate(2deg)}.head span{color:#153f92!important}
  </style>`).replace('<body>',`<body><div class="photo">${(post.photos||[post.photo]).map(key=>img(key)).join('')}</div>`).replace('подготовка к ЕГЭ и ОГЭ','читаем вслух');
}
async function verifySlide(page) {
  const violations=await page.evaluate(()=>{
    const footer=document.querySelector('footer').getBoundingClientRect();
    return [...document.querySelectorAll('h1,h2,p,.eyebrow')].filter(n=>{
      const r=n.getBoundingClientRect();
      return r.x<55||r.right>1025||r.bottom>footer.top-10||n.scrollWidth>n.clientWidth+2;
    }).map(n=>n.textContent);
  });
  if(violations.length)throw new Error(`Paper collage text outside safe area: ${violations.join(' / ')}`);
}
module.exports={slideHtml,reelHtml,photo,verifySlide};
