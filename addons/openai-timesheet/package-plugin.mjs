import {cpSync,mkdirSync,writeFileSync,rmSync,chmodSync,existsSync,readdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const target=process.argv.find(arg=>arg.startsWith('--target='))?.slice(9);
const profile=process.argv.includes('--debug')?'debug':'release';
const build=join(root,'src-tauri','target',target||'',profile);
const out=join(root,'plugin-package','openai-timesheet');
rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
const windows=target?target.includes('windows'):process.platform==='win32';
const macos=target?target.includes('apple-darwin'):process.platform==='darwin';
const binary='ditis-openai-importer'+(windows?'.exe':'');
if(!existsSync(join(build,binary)))throw new Error('先にプラグインをビルドしてください: '+join(build,binary));
let executable=binary;
if(macos){
    const contents=join(out,'DiTiS AI Import.app','Contents');
    mkdirSync(join(contents,'MacOS'),{recursive:true});mkdirSync(join(contents,'Resources'));
    cpSync(join(build,binary),join(contents,'MacOS',binary));chmodSync(join(contents,'MacOS',binary),0o755);
    cpSync(join(root,'../../src-tauri/icons/icon.icns'),join(contents,'Resources','icon.icns'));
    writeFileSync(join(contents,'Info.plist'),'<?xml version="1.0" encoding="UTF-8"?>\n'+
        '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n'+
        '<plist version="1.0"><dict><key>CFBundleExecutable</key><string>'+binary+'</string>'+
        '<key>CFBundleIdentifier</key><string>com.ditis.openai-importer</string>'+
        '<key>CFBundleName</key><string>DiTiS AI Import</string><key>CFBundlePackageType</key><string>APPL</string>'+
        '<key>CFBundleIconFile</key><string>icon.icns</string><key>CFBundleShortVersionString</key><string>0.1.0</string>'+
        '<key>NSHighResolutionCapable</key><true/></dict></plist>\n');
    executable='DiTiS AI Import.app/Contents/MacOS/'+binary;
}else{
    cpSync(join(build,binary),join(out,binary));if(!windows)chmodSync(join(out,binary),0o755);
}
writeFileSync(join(out,'plugin.json'),JSON.stringify({
    apiVersion:1,id:'openai-timesheet',name:'DiTiS AI Import',
    menuLabel:{ja:'画像・PDFから読み込み（OpenAI）',en:'Import images / PDF (OpenAI)'},executable
},null,2)+'\n');
cpSync(join(root,'README.md'),join(out,'README.md'));
for(const name of ['pdfjs-dist','tesseract.js','tesseract.js-core','@tesseract.js-data/jpn']){
    const dir=join(root,'node_modules',name),dest=join(out,'licenses',name.replaceAll('/','-'));
    mkdirSync(dest,{recursive:true});
    for(const file of readdirSync(dir).filter(f=>/^(LICENSE|NOTICE|COPYING)/i.test(f)))cpSync(join(dir,file),join(dest,file));
}
cpSync(join(root,'licenses'),join(out,'licenses','tessdata'),{recursive:true});
console.log(out);
