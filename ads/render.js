// Renders every ad in ads.html: feed (1080x1350) to png/feed, story (1080x1920) to png/story.
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:1400},deviceScaleFactor:1});
await p.goto('file://'+__dirname+'/ads.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(1500);
for(const d of ['png/feed','png/story'])fs.mkdirSync(__dirname+'/'+d,{recursive:true});
for(const el of await p.$$('section.ad')){const id=await el.getAttribute('id');const st=id.endsWith('-story');
await el.screenshot({path:`${__dirname}/png/${st?'story':'feed'}/${id.replace('-story','')}.png`});}
await b.close();})();
