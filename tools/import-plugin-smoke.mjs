// Real browser + bundled PDF/OCR assets. Native IPC and billed API calls are mocked.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,extname} from 'node:path';
import puppeteer from 'puppeteer';
const root=fileURLToPath(new URL('../addons/openai-timesheet/dist/',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm','.gz':'application/gzip'};
const server=createServer(async(req,res)=>{
    try{
        const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
        if(path.includes('..')){res.writeHead(403).end();return;}
        res.setHeader('Content-Type',types[extname(path==='/'?'index.html':path)]||'application/octet-stream');
        res.end(await readFile(join(root,path==='/'?'index.html':path)));
    }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
    browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
    const page=await browser.newPage();await page.setViewport({width:1250,height:1000});
    const errors=[],externalRequests=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith('http://127.0.0.1:'))externalRequests.push(request.url());});
    await page.evaluateOnNewDocument(()=>{
        window.pluginCalls=[];window.fixtureSources=[];
        window.__TAURI__={core:{invoke:async(command,args)=>{
            window.pluginCalls.push({command,args});
            if(command==='integrated_mode')return true;
            if(command==='choose_sources')return window.fixtureSources;
            if(command==='recognize')return {rows:[
                {kind:'inbetween',layer:'A',start:1,end:2,value:'001',uncertain:false},
                {kind:'inbetween',layer:'A',start:3,end:4,value:null,uncertain:true}
            ],warnings:['3〜4コマは要確認']};
            if(command==='save_document')return true;
        }}};
    });
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.waitForFunction(()=>document.getElementById('mode-badge').textContent==='DiTiSから起動');
    await page.evaluate(async()=>{
        await document.fonts.load('32px "Noto Sans CJK JP"');
        const source=document.createElement('canvas');source.width=700;source.height=900;const c=source.getContext('2d');
        c.fillStyle='white';c.fillRect(0,0,700,900);
        c.fillStyle='red';c.fillRect(0,0,700,70);c.fillStyle='white';c.font='24px sans-serif';c.fillText('PRIVATE TITLE - DO NOT SEND',40,45);
        c.strokeStyle='black';c.lineWidth=2;
        for(const x of [40,350,660]){c.beginPath();c.moveTo(x,100);c.lineTo(x,850);c.stroke();}
        for(const y of [100,...Array.from({length:25},(_,i)=>178+i*28)]){
            c.beginPath();c.moveTo(40,y);c.lineTo(660,y);c.stroke();
        }
        c.fillStyle='black';c.font='32px "Noto Sans CJK JP"';c.fillText('原画',160,150);c.fillText('動画',470,150);
        c.font='17px sans-serif';c.fillText('A',90,203);c.fillText('B',230,203);c.fillText('A',410,203);c.fillText('B',550,203);
        window.fixtureSources=[{name:'SECRET_PRODUCTION_TITLE.png',mime:'image/png',dataUrl:source.toDataURL('image/png')}];
    });
    await page.click('#choose');
    await page.waitForFunction(()=>!document.getElementById('choose').disabled,{timeout:180000});
    const status=await page.$eval('#page-status',el=>el.textContent);
    const autoCount=await page.$$eval('.region',elements=>elements.length);
    assert.equal(autoCount,2,'real bundled Japanese OCR + grid detection: '+status);
    assert.equal(await page.evaluate(()=>window.pluginCalls.filter(c=>c.command==='recognize').length),0,'selection never sends automatically');
    // Confirm the actual cropped image excludes the red title band.
    assert.ok(await page.evaluate(async()=>{
        for(const img of document.querySelectorAll('.region img')){
            await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
            const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;
            for(let i=0;i<pixels.length;i+=4)if(pixels[i]>180&&pixels[i+1]<80&&pixels[i+2]<80)return false;
        }
        return true;
    }),'title pixels never appear in outbound previews');
    if(process.env.IMPORT_PLUGIN_SCREENSHOT_PATH)await page.screenshot({path:process.env.IMPORT_PLUGIN_SCREENSHOT_PATH,fullPage:true});
    await page.select('#selection-mode','manual');
    await page.evaluate(()=>{
        for(const button of [...document.querySelectorAll('[data-action=remove-region]')])button.click();
        const canvas=document.getElementById('source-canvas'),r=canvas.getBoundingClientRect();
        const dispatch=(type,x,y)=>canvas.dispatchEvent(new PointerEvent(type,{pointerId:1,bubbles:true,
            clientX:r.left+x*r.width/canvas.width,clientY:r.top+y*r.height/canvas.height}));
        // Synthetic pointer capture is not supported, so use real mouse state plus direct movement.
        canvas.setPointerCapture=()=>{};
        dispatch('pointerdown',352,102);dispatch('pointermove',658,848);dispatch('pointerup',658,848);
        document.getElementById('add-region').click();
        document.getElementById('api-key').value='test-key-never-sent-to-a-server';
        document.getElementById('sheet-name').value='LOCAL ONLY TITLE';
    });
    assert.equal(await page.$$eval('.region',els=>els.length),1);
    await page.click('#recognize');
    await page.waitForSelector('#review-section:not([hidden])');
    const payload=await page.evaluate(()=>window.pluginCalls.find(c=>c.command==='recognize').args);
    assert.deepEqual(Object.keys(payload).sort(),['apiKey','fps','model','regions']);
    assert.deepEqual(Object.keys(payload.regions[0]).sort(),['frameCount','image','kind','startFrame']);
    assert.ok(payload.regions[0].image.startsWith('data:image/png;base64,'));
    assert.ok(!JSON.stringify(payload).includes('SECRET_PRODUCTION_TITLE'));
    assert.ok(!JSON.stringify(payload).includes('LOCAL ONLY TITLE'));
    assert.equal(await page.$eval('#finish',el=>el.disabled),true);
    await page.evaluate(()=>{
        const row=document.querySelectorAll('#review-rows tr')[1],input=row.querySelectorAll('input')[3],confirmed=row.querySelector('input[type=checkbox]');
        input.value='002';input.dispatchEvent(new Event('change'));confirmed.click();
    });
    await page.click('#finish');
    const finish=await page.evaluate(()=>window.pluginCalls.find(c=>c.command==='finish_import').args);
    assert.equal(finish.review.rows[1].value,'002');assert.equal(finish.review.rows[1].uncertain,false);
    assert.equal(finish.name,'LOCAL ONLY TITLE');
    // A small independently constructed PDF is rendered locally; its bytes never reach recognize.
    const objects=[
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Contents 4 0 R >>',
        '<< /Length 21 >>\nstream\n0 0 0 rg 50 50 100 100 re f\nendstream'
    ];
    let pdf='%PDF-1.4\n',offsets=[0];
    objects.forEach((body,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+body+'\nendobj\n';});
    const xref=pdf.length;pdf+='xref\n0 5\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('');
    pdf+='trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
    await page.evaluate(data=>{window.fixtureSources=[{name:'PRIVATE.pdf',mime:'application/pdf',dataUrl:'data:application/pdf;base64,'+data}];},Buffer.from(pdf).toString('base64'));
    await page.click('#choose');
    await page.waitForFunction(()=>!document.getElementById('choose').disabled);
    assert.match(await page.$eval('#page-status',el=>el.textContent),/PRIVATE.pdf/);
    assert.equal(await page.evaluate(()=>window.pluginCalls.filter(c=>c.command==='recognize').length),1);
    assert.deepEqual(externalRequests,[],'OCR, PDF and previews do not use external services');
    assert.deepEqual(errors,[],'no browser JavaScript errors');
    console.log('Plugin UI: automatic local OCR, manual masking, exact outbound images, review, direct import and local PDF rendering passed.');
}finally{if(browser)await browser.close();server.close();}
