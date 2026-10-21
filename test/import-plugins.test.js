import {describe,it,expect,vi} from 'vitest';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../js/importPlugins.js',import.meta.url),'utf8');
const io=readFileSync(new URL('../js/fileOperations.js',import.meta.url),'utf8');
function documentData(){return {version:'1.0',sheets:[
    {name:'原画',fps:24,frames:3,framePageSize:144,layers:['A'],data:[['001','001','×']]},
    {name:'動画',fps:30,frames:3,framePageSize:144,layers:['B'],data:[['1','2','3']]}
]};}
function app(result){
    let pagehide;
    const state={sheets:[{name:'existing',data:{keep:true}}],currentSheetIndex:0};
    const invoke=vi.fn().mockResolvedValue(result);
    const context=vm.createContext({
        AppState:state,window:{__TAURI_INTERNALS__:{invoke},addEventListener:(_name,fn)=>{pagehide=fn;}},
        ErrorLevel:{ERROR:'error',INFO:'info'},getCurrentLanguage:()=> 'ja',
        saveHistory:vi.fn(),renderTabs:vi.fn(),renderSpreadsheet:vi.fn(),selectA1:vi.fn(),
        saveToLocalStorage:vi.fn(),updateWindowTitle:vi.fn(),updateStatusBar:vi.fn(),
        showErrorToast:vi.fn(),triggerMenuRebuild:vi.fn(),
    });
    vm.runInContext(io,context);vm.runInContext(source,context);
    return {context,state,invoke,unload:()=>pagehide()};
}
describe('optional menu import using the real host functions',()=>{
    it('imports as new unsaved tabs, preserving cel strings and per-sheet FPS',async()=>{
        const a=app(documentData());await a.context.handleImportPluginMenu('import-plugin:openai-timesheet');
        expect(a.invoke).toHaveBeenCalledWith('run_import_plugin',{pluginId:'openai-timesheet'});
        expect(a.state.sheets).toHaveLength(3);expect(a.state.sheets[0].data).toEqual({keep:true});
        expect(a.state.sheets[1].data[1].L1).toBe('001');expect(a.state.sheets[1].data[2].L1).toBe('001');
        expect(a.state.sheets[1].filePath).toBeNull();expect(a.state.sheets[2].fps).toBe(30);
        expect(a.state.currentSheetIndex).toBe(1);expect(a.context.saveHistory).toHaveBeenCalledOnce();
    });
    it('rejects all imported sheets if any later sheet is invalid',async()=>{
        const data=documentData();data.sheets[1].data[0].push('outside');
        const a=app(data);await a.context.handleImportPluginMenu('import-plugin:test');
        expect(a.state.sheets).toHaveLength(1);expect(a.context.saveHistory).not.toHaveBeenCalled();
        expect(a.context.showErrorToast).toHaveBeenCalled();
    });
    it('cancellation leaves tabs, history and saved state intact',async()=>{
        const a=app(null);await a.context.handleImportPluginMenu('import-plugin:test');
        expect(a.state.sheets).toHaveLength(1);expect(a.context.saveHistory).not.toHaveBeenCalled();
        expect(a.context.saveToLocalStorage).not.toHaveBeenCalled();
    });
    it('commits an active edit to its original sheet before adding imported tabs',async()=>{
        const a=app(documentData());
        a.context.finishEditing=vi.fn(()=>{
            expect(a.state.currentSheetIndex).toBe(0);
            a.state.sheets[0].data.lastEdit='kept';
        });
        await a.context.handleImportPluginMenu('import-plugin:test');
        expect(a.context.finishEditing).toHaveBeenCalledWith(true,true);
        expect(a.state.sheets[0].data.lastEdit).toBe('kept');
        expect(a.state.sheets[1].data[1].L1).toBe('001');
    });
    it('does not import a late success into an unloaded page',async()=>{
        const a=app();let finish;
        a.invoke.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
        const pending=a.context.handleImportPluginMenu('import-plugin:test');
        a.unload();finish(documentData());await pending;
        expect(a.state.sheets).toHaveLength(1);
        expect(a.context.saveToLocalStorage).not.toHaveBeenCalled();
    });
    it('deduplicates imports and cancels a running plugin on navigation',async()=>{
        const a=app();let finish;
        a.invoke.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
        const pending=a.context.handleImportPluginMenu('import-plugin:test');
        await a.context.handleImportPluginMenu('import-plugin:test');expect(a.invoke).toHaveBeenCalledTimes(1);
        a.unload();expect(a.invoke).toHaveBeenCalledWith('cancel_import_plugin');
        finish(null);await pending;
    });
    it('reloads the menu without requiring an app restart',async()=>{
        const a=app({count:1,errors:[]});await a.context.handleImportPluginMenu('reload-import-plugins');
        expect(a.context.triggerMenuRebuild).toHaveBeenCalledOnce();
        expect(await a.context.handleImportPluginMenu('save-file')).toBe(false);
    });
});
