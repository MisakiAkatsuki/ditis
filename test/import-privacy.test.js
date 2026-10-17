import {describe,it,expect,vi} from 'vitest';
import {normalizedRect,cropCanvas,labelsFromTsv,detectGridRegions} from '../addons/openai-timesheet/ui/privacy.js';
describe('local-only source masking',()=>{
    it('clamps a backwards drag and copies only the selected source pixels',()=>{
        const rect=normalizedRect({x:85.6,y:90.2},{x:-12,y:30.8},100,100);
        expect(rect).toEqual({x:0,y:30,width:86,height:61});
        const ctx={fillRect:vi.fn(),drawImage:vi.fn()};
        const target={getContext:()=>ctx,toDataURL:()=> 'cropped PNG'};
        const source={width:100,height:100};
        expect(cropCanvas(source,rect,()=>target)).toBe('cropped PNG');
        expect(ctx.drawImage).toHaveBeenCalledWith(source,0,30,86,61,0,0,86,61);
        expect(()=>cropCanvas(source,{x:0,y:0,width:101,height:100},()=>target)).toThrow();
        expect(normalizedRect({x:1,y:1},{x:2,y:2},100,100)).toBeNull();
    });
    it('identifies Japanese header words split across OCR tokens',()=>{
        const tsv='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n'+
            '5\t1\t1\t1\t1\t1\t100\t60\t20\t20\t95\t原\n'+
            '5\t1\t1\t1\t1\t2\t125\t60\t20\t20\t95\t画\n'+
            '5\t1\t1\t1\t2\t1\t250\t60\t40\t20\t95\t動画\n'+
            '5\t1\t1\t1\t3\t1\t10\t5\t100\t20\t90\tタイトル\n';
        expect(labelsFromTsv(tsv)).toEqual([
            {kind:'key',x:100,y:60,width:45,height:20},
            {kind:'inbetween',x:250,y:60,width:40,height:20}
        ]);
    });
    it('requires matching headers and a ruled body; never falls back to the whole page',()=>{
        const width=400,height=550,data=new Uint8ClampedArray(width*height*4).fill(255);
        const pixel=(x,y)=>{const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=0;};
        for(const x of [50,200,350])for(let y=50;y<=500;y++)pixel(x,y);
        for(const y of [50,...Array.from({length:42},(_,i)=>90+i*10)])for(let x=50;x<=350;x++)pixel(x,y);
        const image={data,width,height};
        const labels=[{kind:'key',x:105,y:60,width:40,height:20},{kind:'inbetween',x:250,y:60,width:40,height:20}];
        const regions=detectGridRegions(image,labels);
        expect(regions).toEqual([
            {kind:'key',rect:{x:51,y:51,width:149,height:449}},
            {kind:'inbetween',rect:{x:201,y:51,width:149,height:449}}
        ]);
        expect(regions.every(r=>r.rect.y>25)).toBe(true); // Title above grid is excluded.
        expect(detectGridRegions(image,[])).toEqual([]);
        expect(detectGridRegions({data:new Uint8ClampedArray(data.length).fill(255),width,height},labels)).toEqual([]);
    });
});
