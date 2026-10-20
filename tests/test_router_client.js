'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../frontend/js/app.js'),'utf8');
function fixture(initial='/profile/teacher'){
    const routes=[],changes=[],errors=[],window={location:new URL('https://faenet.example'+initial)};
    const context={window,URL,document:{addEventListener:()=>{}},FaeUtils:{error:message=>errors.push(message)},
        history:{pushState:(_state,_title,target)=>{changes.push(target);window.location=new URL(target,window.location);}}};
    vm.createContext(context);vm.runInContext(source,context);
    const app=window.FaeApp;app.route=path=>routes.push(path);
    return {app,window,routes,changes,errors};
}
test('profile message link keeps the recipient but dispatches the messages route',()=>{
    const f=fixture();f.app.go('/messages?to=internal-user');
    assert.deepEqual(f.routes,['/messages']);
    assert.equal(new URLSearchParams(f.window.location.search).get('to'),'internal-user');
    assert.deepEqual(f.changes,['/messages?to=internal-user']);
});
test('reopening the same destination does not add duplicate history',()=>{
    const f=fixture('/messages?to=internal-user');f.app.go('/messages?to=internal-user');
    assert.deepEqual(f.routes,['/messages']);assert.equal(f.changes.length,0);
});
test('messages navigation clears an old recipient instead of reopening it',()=>{
    const f=fixture('/messages?to=old-user');f.app.go('/messages');
    assert.equal(f.window.location.search,'');assert.deepEqual(f.routes,['/messages']);
});
test('hash remains in the address but never in the route name',()=>{
    const f=fixture();f.app.go('/feed#post');
    assert.equal(f.window.location.hash,'#post');assert.deepEqual(f.routes,['/feed']);
});
test('SPA navigation cannot push another origin into internal routing',()=>{
    const f=fixture();f.app.go('https://other.example/messages');
    assert.equal(f.routes.length,0);assert.equal(f.changes.length,0);assert.equal(f.errors.length,1);
});
