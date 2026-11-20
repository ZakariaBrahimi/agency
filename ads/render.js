const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:1400},deviceScaleFactor:1});
await p.goto('file://'+__dirname+'/ads.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(1500);
for(const el of await p.$$('section.ad')){const id=await el.getAttribute('id');await el.screenshot({path:`${__dirname}/png/${id}.png`});}
console.log(await p.evaluate(()=>[...document.fonts].filter(f=>f.status=='loaded').map(f=>f.family).join(',')));
await b.close();})();
