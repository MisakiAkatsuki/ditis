import * as pdfjs from './vendor/pdf/pdf.mjs';
import {normalizedRect,cropCanvas,labelsFromTsv,detectGridRegions} from './privacy.js';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf/pdf.worker.mjs',import.meta.url).href;
const $=id=>document.getElementById(id);
const invoke=(command,args)=>window.__TAURI__.core.invoke(command,args);
const canvas=$('source-canvas'), base=document.createElement('canvas');
let pages=[],regions=[],selection=null,drag=null,review=null,reviewFps=24,busy=false,workerPromise;
let nextRegionId=1,integrated=false;
const kindLabel=kind=>kind==='key'?'原画欄':'動画欄';

function showError(error){$('error').textContent=String(error);$('error').hidden=false;}
function clearError(){$('error').hidden=true;}
function invalidateReview(){review=null;$('review-section').hidden=true;syncButtons();}
function syncButtons(){
    $('recognize').disabled=busy || regions.length===0;
    $('add-region').disabled=busy || !selection;
    $('detect').hidden=$('selection-mode').value!=='auto';
    $('detect-all').hidden=$('selection-mode').value!=='auto';
    const unresolved=review?.rows.filter(r=>r.uncertain || r.value===null).length || 0;
    $('unresolved').textContent=unresolved+'行が要確認';
    $('finish').disabled=$('save').disabled=busy || !review || unresolved>0;
    $('selection-hint').textContent=$('selection-mode').value==='manual'?
        '画像上をドラッグして範囲を選択':'自動検出後もドラッグで範囲を指定できます';
}
function setBusy(value){
    busy=value;
    document.querySelectorAll('main button, main input, main select').forEach(el=>{el.disabled=value;});
    syncButtons();
}
async function action(fn){
    if(busy)return;
    clearError();setBusy(true);
    try{await fn();}catch(error){showError(error);}
    finally{setBusy(false);}
}
function number(id){return Number($(id).value);}
function frameSettings(){
    const startFrame=number('start-frame'),frameCount=number('frame-count');
    if(!Number.isInteger(startFrame)||startFrame<1||!Number.isInteger(frameCount)||frameCount<1||
        frameCount>2000||startFrame+frameCount-1>20000)throw new Error('開始コマとコマ数を確認してください');
    return {startFrame,frameCount};
}
function redraw(){
    const ctx=canvas.getContext('2d');
    canvas.width=base.width;canvas.height=base.height;ctx.drawImage(base,0,0);
    for(const region of regions.filter(r=>r.page===Number($('page').value))){
        const r=region.rect;ctx.fillStyle=region.kind==='key'?'#1b856321':'#4776c521';
        ctx.fillRect(r.x,r.y,r.width,r.height);ctx.strokeStyle=region.kind==='key'?'#1b8563':'#4776c5';
        ctx.lineWidth=Math.max(2,base.width/450);ctx.strokeRect(r.x,r.y,r.width,r.height);
    }
    if(selection){
        ctx.fillStyle='#438c5b33';ctx.fillRect(selection.x,selection.y,selection.width,selection.height);
        ctx.strokeStyle='#267944';ctx.lineWidth=Math.max(2,base.width/450);
        ctx.strokeRect(selection.x,selection.y,selection.width,selection.height);
    }
}
function position(event){
    const rect=canvas.getBoundingClientRect();
    return {x:(event.clientX-rect.left)*base.width/rect.width,y:(event.clientY-rect.top)*base.height/rect.height};
}
canvas.addEventListener('pointerdown',event=>{
    if(busy||!pages.length)return;
    drag=position(event);selection=null;canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove',event=>{
    if(!drag)return;
    selection=normalizedRect(drag,position(event),base.width,base.height);redraw();
});
canvas.addEventListener('pointerup',event=>{
    if(!drag)return;
    selection=normalizedRect(drag,position(event),base.width,base.height);drag=null;redraw();syncButtons();
});
canvas.addEventListener('pointercancel',()=>{drag=null;});

async function renderPage(index){
    const page=pages[index];
    $('page').value=String(index);
    selection=null;drag=null;
    const original=document.createElement('canvas');
    if(page.pdf){
        const pdfPage=await page.pdf.getPage(page.number);
        const natural=pdfPage.getViewport({scale:1});
        const scale=Math.min(3,4096/natural.width,6000/natural.height);
        const viewport=pdfPage.getViewport({scale});
        original.width=Math.ceil(viewport.width);original.height=Math.ceil(viewport.height);
        await pdfPage.render({canvasContext:original.getContext('2d'),viewport}).promise;
    }else{
        const img=new Image();img.src=page.image;await img.decode();
        original.width=img.naturalWidth;original.height=img.naturalHeight;
        original.getContext('2d').drawImage(img,0,0);
    }
    const rotate=(page.rotation||0)%360,swap=rotate===90||rotate===270;
    base.width=swap?original.height:original.width;base.height=swap?original.width:original.height;
    const ctx=base.getContext('2d');
    ctx.translate(base.width/2,base.height/2);ctx.rotate(rotate*Math.PI/180);
    ctx.drawImage(original,-original.width/2,-original.height/2);ctx.setTransform(1,0,0,1,0,0);
    $('start-frame').value=String(index*number('page-frames')+1);
    $('frame-count').value=$('page-frames').value;
    $('page-status').textContent=page.label+' · '+base.width+' × '+base.height;
    redraw();syncButtons();
}
async function chooseSources(){
    const sources=await invoke('choose_sources');
    if(!sources.length)return;
    const next=[];
    for(const source of sources){
        if(source.mime==='application/pdf'){
            const bytes=Uint8Array.from(atob(source.dataUrl.split(',')[1]),c=>c.charCodeAt(0));
            const pdf=await pdfjs.getDocument({
                data:bytes,cMapUrl:new URL('./vendor/pdf/cmaps/',import.meta.url).href,cMapPacked:true,
                standardFontDataUrl:new URL('./vendor/pdf/standard_fonts/',import.meta.url).href,
                wasmUrl:new URL('./vendor/pdf/wasm/',import.meta.url).href,
                isEvalSupported:false
            }).promise;
            if(pdf.numPages>100)throw new Error('PDFは100ページ以内に分割してください');
            for(let n=1;n<=pdf.numPages;n++)next.push({pdf,number:n,label:source.name+' / '+n+'ページ',rotation:0});
        }else next.push({image:source.dataUrl,label:source.name,rotation:0});
    }
    for(const doc of new Set(pages.map(p=>p.pdf).filter(Boolean)))await doc.destroy();
    pages=next;regions=[];invalidateReview();
    $('page').replaceChildren(...pages.map((page,i)=>new Option(page.label,String(i))));
    $('editor').hidden=false;renderRegions();
    await renderPage(0);
    if($('selection-mode').value==='auto')await detectPage();
}
function addRegion(kind,rect,settings=frameSettings()){
    if(regions.length>=24)throw new Error('範囲は24個まで追加できます');
    const page=Number($('page').value);
    if(regions.some(r=>r.page===page&&r.kind===kind&&JSON.stringify(r.rect)===JSON.stringify(rect)))return;
    regions.push({id:nextRegionId++,page,kind,rect:{...rect},...settings,image:cropCanvas(base,rect)});
    invalidateReview();renderRegions();redraw();
}
function renderRegions(){
    $('region-count').textContent=regions.length+'範囲';
    $('regions').replaceChildren();
    if(!regions.length){
        const p=document.createElement('p');p.className='empty';p.textContent='原画欄・動画欄を自動検出するか、手動で追加してください。';
        $('regions').append(p);
    }
    for(const region of regions){
        const card=document.createElement('article');card.className='region';
        const title=document.createElement('strong');title.textContent=kindLabel(region.kind)+' · '+(region.page+1)+'ページ目';
        const img=new Image();img.src=region.image;img.alt='OpenAIへ送信する'+kindLabel(region.kind)+'の切り出し画像';
        const zoom=document.createElement('button');zoom.className='secondary';zoom.textContent='送信画像を拡大して確認';
        const preview=()=>{$('preview-image').src=region.image;$('preview-title').textContent=kindLabel(region.kind)+'の送信画像';$('preview-dialog').showModal();};
        img.addEventListener('click',preview);zoom.addEventListener('click',preview);
        const fields=document.createElement('div');fields.className='fields';
        for(const [key,labelText] of [['startFrame','開始コマ'],['frameCount','コマ数']]){
            const label=document.createElement('label');label.textContent=labelText;
            const input=document.createElement('input');input.type='number';input.min='1';input.max=key==='frameCount'?'2000':'20000';input.value=String(region[key]);
            input.addEventListener('change',()=>{region[key]=Number(input.value);invalidateReview();});label.append(input);fields.append(label);
        }
        const remove=document.createElement('button');remove.className='secondary';remove.dataset.action='remove-region';remove.textContent='この範囲を削除';
        remove.addEventListener('click',()=>{regions=regions.filter(r=>r.id!==region.id);invalidateReview();renderRegions();redraw();});
        card.append(title,img,zoom,fields,remove);$('regions').append(card);
    }
    syncButtons();
}
async function ocrWorker(){
    if(!workerPromise)workerPromise=window.Tesseract.createWorker('jpn',1,{
        workerPath:new URL('./vendor/tesseract/worker.min.js',import.meta.url).href,
        corePath:new URL('./vendor/tesseract/core/',import.meta.url).href,
        langPath:new URL('./vendor/tesseract/lang/',import.meta.url).href,
        gzip:true,workerBlobURL:false,cacheMethod:'none',
        logger:message=>{$('page-status').textContent='端末内で欄を検出中… '+Math.round((message.progress||0)*100)+'%';}
    }).then(async worker=>{await worker.setParameters({tessedit_pageseg_mode:'11'});return worker;})
      .catch(error=>{workerPromise=null;throw error;});
    return workerPromise;
}
async function detectPage(){
    const worker=await ocrWorker();
    const local=document.createElement('canvas'),scale=Math.min(1,2200/base.width);
    local.width=Math.round(base.width*scale);local.height=Math.round(base.height*scale);
    local.getContext('2d').drawImage(base,0,0,local.width,local.height);
    const {data}=await worker.recognize(local.toDataURL('image/png'),{}, {text:false,tsv:true});
    const labels=labelsFromTsv(data.tsv).map(l=>({...l,x:l.x/scale,y:l.y/scale,width:l.width/scale,height:l.height/scale}));
    const found=detectGridRegions(base.getContext('2d').getImageData(0,0,base.width,base.height),labels);
    if(!found.length){
        $('page-status').textContent='原画欄・動画欄を確実に検出できませんでした。手動選択に切り替えて範囲を指定してください。';
        return;
    }
    for(const region of found)addRegion(region.kind,region.rect);
    $('page-status').textContent=found.length+'範囲を検出しました。送信画像にタイトルなどが含まれていないか確認してください。';
}
function renderReview(){
    $('review-section').hidden=false;$('review-rows').replaceChildren();$('warnings').replaceChildren();
    for(const warning of review.warnings){
        const li=document.createElement('li');li.textContent=warning;$('warnings').append(li);
    }
    for(const row of review.rows){
        const tr=document.createElement('tr');
        const kind=document.createElement('td');kind.textContent=kindLabel(row.kind);tr.append(kind);
        for(const key of ['layer','start','end','value']){
            const td=document.createElement('td'),input=document.createElement('input');
            input.type=key==='start'||key==='end'?'number':'text';
            if(input.type==='number'){input.min='1';input.max='20000';}else input.maxLength=128;
            input.value=row[key]??'';if(key==='value'&&row.value===null)input.placeholder='不明（要確認）';
            input.addEventListener('change',()=>{row[key]=input.type==='number'?Number(input.value):input.value;syncButtons();});
            td.append(input);tr.append(td);
        }
        const td=document.createElement('td'),checked=document.createElement('input');checked.type='checkbox';
        checked.checked=!row.uncertain&&row.value!==null;
        const update=()=>{tr.classList.toggle('uncertain',row.uncertain||row.value===null);syncButtons();};
        checked.addEventListener('change',()=>{row.uncertain=!checked.checked;if(checked.checked&&row.value===null)row.value='';update();});
        td.append(checked);tr.append(td);update();$('review-rows').append(tr);
    }
    $('finish').hidden=!integrated;syncButtons();
}
async function recognize(){
    if(!regions.length)return;
    // An explicit allowlist. Source files, page labels, local sheet name and original
    // canvases are never passed to the native network command.
    const payload=regions.map(({kind,startFrame,frameCount,image})=>({kind,startFrame,frameCount,image}));
    reviewFps=number('fps');
    $('api-status').textContent='OpenAIで認識中…（最大3分程度）';
    try{
        const result=await invoke('recognize',{apiKey:$('api-key').value,model:$('model').value,fps:reviewFps,regions:payload});
        review=result;renderReview();$('api-status').textContent='認識しました。値・コマ位置を確認してから取り込んでください。';
        $('review-section').scrollIntoView({behavior:'smooth'});
    }catch(error){$('api-status').textContent='認識に失敗しました。';throw error;}
}
function finishArgs(){return {review,fps:reviewFps,name:$('sheet-name').value,framePageSize:number('page-frames')};}
$('choose').addEventListener('click',()=>action(chooseSources));
$('page').addEventListener('change',()=>action(async()=>{await renderPage(number('page'));if($('selection-mode').value==='auto')await detectPage();}));
$('selection-mode').addEventListener('change',()=>action(async()=>{syncButtons();if(pages.length&&$('selection-mode').value==='auto')await detectPage();}));
$('detect').addEventListener('click',()=>action(detectPage));
$('detect-all').addEventListener('click',()=>action(async()=>{
    for(let i=0;i<pages.length;i++){await renderPage(i);await detectPage();}
}));
$('add-region').addEventListener('click',()=>{try{clearError();addRegion($('kind').value,selection);}catch(error){showError(error);}});
$('rotate').addEventListener('click',()=>action(async()=>{
    const index=number('page');pages[index].rotation=(pages[index].rotation+90)%360;await renderPage(index);
}));
$('recognize').addEventListener('click',()=>action(recognize));
$('finish').addEventListener('click',()=>action(()=>invoke('finish_import',finishArgs())));
$('save').addEventListener('click',()=>action(async()=>{
    if(await invoke('save_document',finishArgs()))$('api-status').textContent='.ditisファイルを保存しました。';
}));
$('fps').addEventListener('change',invalidateReview);
$('close-preview').addEventListener('click',()=>$('preview-dialog').close());
try{integrated=await invoke('integrated_mode');$('mode-badge').textContent=integrated?'DiTiSから起動':'単独起動';}
catch(error){showError('プラグインをネイティブアプリとして起動してください。');}
syncButtons();
