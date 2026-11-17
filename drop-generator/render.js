const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1080,height:1350}});
for(const i of [1,2,3]){await pg.goto('file://'+path.join(__dirname,`slide${i}.html`));await pg.waitForTimeout(1500);await pg.evaluate(()=>document.fonts.ready);
await pg.screenshot({path:path.join(__dirname,`slide${i}.png`)});}
await b.close()})();
