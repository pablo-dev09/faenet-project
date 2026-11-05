'use strict';
// No browser or production session: exercise the actual identity script in a VM.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../frontend/js/identity.js'),'utf8');
function client(url){
    const context={document:{querySelector:()=>null,getElementById:()=>null,querySelectorAll:()=>[]},
        window:{location:{href:url},addEventListener:()=>{}}};
    vm.createContext(context);vm.runInContext(source,context);return context;
}
for(const route of ['/auth/faehub/link','/auth/faehub/profile']){
    test('named action cannot clobber POST destination: '+route,()=>{
        const url='https://faenet.example'+route,context=client(url);
        const form={action:{toString:()=>'[object HTMLInputElement]'},getAttribute:key=>key==='action'?null:undefined};
        assert.equal(context.identitySubmitUrl(form),url);
        assert.match(source,/fetch\(identitySubmitUrl\(form\),/);
    });
}
test('explicit action attribute is respected without reading the named property',()=>{
    const context=client('https://faenet.example/auth/faehub/link');
    const form={get action(){throw Error('clobbered property read');},getAttribute:()=>'/auth/faehub/profile'};
    assert.equal(context.identitySubmitUrl(form),'/auth/faehub/profile');
});
test('JSON upload errors remain actionable',()=>{
    const context=client('https://faenet.example/auth/faehub/link');
    const response={status:413,headers:{get:()=>'application/json'}};
    assert.equal(context.identityResponseError(response,JSON.stringify({error:{message:'Arquivo muito grande.'}})),'Arquivo muito grande.');
});
test('unexpected or malformed responses include HTTP status instead of blaming fields',()=>{
    const context=client('https://faenet.example/auth/faehub/link');
    for(const status of [405,500,503]){
        assert.match(context.identityResponseError({status,headers:{get:()=>null}},'<html>failure</html>'),new RegExp('erro '+status));
    }
    assert.match(context.identityResponseError({status:502,headers:{get:()=>'application/json'}},'invalid'),/erro 502/);
});
