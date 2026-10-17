// Pure local geometry/grid analysis. This module never performs a network request.
export function normalizedRect(a, b, width, height) {
    const left = Math.max(0, Math.floor(Math.min(a.x,b.x)));
    const top = Math.max(0, Math.floor(Math.min(a.y,b.y)));
    const right = Math.min(width, Math.ceil(Math.max(a.x,b.x)));
    const bottom = Math.min(height, Math.ceil(Math.max(a.y,b.y)));
    if (right-left < 8 || bottom-top < 8) return null;
    return { x:left,y:top,width:right-left,height:bottom-top };
}

export function cropCanvas(source, rect, createCanvas = () => document.createElement('canvas')) {
    if (![rect.x,rect.y,rect.width,rect.height].every(Number.isInteger) ||
        rect.x < 0 || rect.y < 0 || rect.width < 8 || rect.height < 8 ||
        rect.x+rect.width > source.width || rect.y+rect.height > source.height) {
        throw new Error('切り出し範囲が不正です');
    }
    const out = createCanvas();
    out.width = rect.width; out.height = rect.height;
    const ctx = out.getContext('2d');
    ctx.fillStyle = 'white'; ctx.fillRect(0,0,out.width,out.height);
    // Draw only allowed pixels. Original dimensions, filename and metadata are absent.
    ctx.drawImage(source,rect.x,rect.y,rect.width,rect.height,0,0,rect.width,rect.height);
    return out.toDataURL('image/png');
}

export function labelsFromTsv(tsv) {
    const words = String(tsv).split('\n').slice(1).map(line => {
        const c=line.split('\t');
        return {level:Number(c[0]),line:c.slice(1,5).join('/'),x:Number(c[6]),y:Number(c[7]),
            width:Number(c[8]),height:Number(c[9]),confidence:Number(c[10]),text:c.slice(11).join('').trim()};
    }).filter(w=>w.level===5 && w.text && w.confidence>=45 && w.width>0 && w.height>0);
    const labels=[];
    for (let i=0;i<words.length;i++) {
        for (let n=1;n<=3 && i+n<=words.length;n++) {
            const group=words.slice(i,i+n);
            if (group.some(w=>w.line!==group[0].line)) break;
            const text=group.map(w=>w.text).join('').replace(/\s/g,'');
            const kind=text==='原画'?'key':text==='動画'?'inbetween':null;
            if (!kind) continue;
            const x=Math.min(...group.map(w=>w.x)), y=Math.min(...group.map(w=>w.y));
            labels.push({kind,x,y,width:Math.max(...group.map(w=>w.x+w.width))-x,
                height:Math.max(...group.map(w=>w.y+w.height))-y});
            break;
        }
    }
    return labels;
}

function runs(values) {
    const result=[]; let start=-1;
    values.forEach((hit,i)=>{
        if(hit && start<0) start=i;
        if(start>=0 && (!hit || i===values.length-1)){
            const end=hit?i:i-1;result.push(Math.round((start+end)/2));start=-1;
        }
    });
    return result;
}

// Conservative automatic detection: only an OCR-confirmed header plus surrounding
// ruled grid qualifies. Failure produces no regions, never a whole-page fallback.
export function detectGridRegions(image, labels) {
    const {data,width,height}=image;
    const dark=(x,y)=>{const i=(y*width+x)*4;return data[i]+data[i+1]+data[i+2]<450 && data[i+3]>100;};
    const result=[];
    for(const label of labels) {
        if(label.y>height*0.5 || label.height<4) continue;
        const y1=Math.max(0,Math.floor(label.y-3)),y2=Math.min(height-1,Math.ceil(label.y+label.height+3));
        const vertical=runs(Array.from({length:width},(_,x)=>{
            let hits=0;
            for(let y=y1;y<=y2;y++) if(dark(x,y))hits++;
            return hits/(y2-y1+1)>0.82;
        }));
        const left=vertical.filter(x=>x<label.x-3).at(-1);
        const right=vertical.find(x=>x>label.x+label.width+3);
        if(left===undefined || right===undefined || right-left<40) continue;
        const horizontal=runs(Array.from({length:height},(_,y)=>{
            let hits=0,total=0;
            for(let x=left+2;x<right-1;x+=2){total++;if(dark(x,y))hits++;}
            return total>0 && hits/total>0.72;
        }));
        const top=horizontal.filter(y=>y<label.y).at(-1);
        const bottom=horizontal.filter(y=>y>label.y+label.height).at(-1);
        if(top===undefined || bottom===undefined || bottom-top<height*0.3) continue;
        const below=horizontal.filter(y=>y>label.y+label.height && y<bottom);
        if(below.length<8) continue;
        // Verify that group boundaries continue down the body, not just text strokes.
        const boundaryScore=x=>{
            let hits=0,total=0;
            for(let y=y2+1;y<bottom;y+=3){total++;if([-1,0,1].some(d=>dark(Math.min(width-1,Math.max(0,x+d)),y)))hits++;}
            return hits/Math.max(1,total);
        };
        if(boundaryScore(left)<0.6 || boundaryScore(right)<0.6) continue;
        const rect={x:left+1,y:top+1,width:right-left-1,height:bottom-top-1};
        if(result.some(r=>r.kind===label.kind && Math.abs(r.rect.x-rect.x)<8 && Math.abs(r.rect.y-rect.y)<8)) continue;
        result.push({kind:label.kind,rect});
    }
    return result;
}
