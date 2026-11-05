'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../frontend/js/feed.js'),'utf8');
class Node {
    constructor(kind){this.kind=kind;this.children=[];this.parentNode=null;}
    appendChild(node){node.parentNode=this;this.children.push(node);return node;}
    remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(node=>node!==this);this.parentNode=null;}}
    clear(){for(const node of [...this.children])node.remove();}
}
function fixture(feed){
    const callbacks=[],errors=[];
    const context={window:{},FaeAuth:{currentUser:{username:'test'}},FaeAPI:{feed},
        FaeUtils:{el:(_tag,attrs={})=>new Node(attrs.class),error:message=>errors.push(message)}};
    vm.createContext(context);vm.runInContext(source,context);
    const subject=context.window.FaeFeed;
    subject.renderStories=async root=>root.appendChild(new Node('stories'));
    subject.renderCompose=(root,onPosted)=>{root.appendChild(new Node('compose'));callbacks.push(onPosted);};
    subject.renderPostCard=(post,root)=>root.appendChild(new Node(post.id));
    const container=new Node('main'),hero=container.appendChild(new Node('welcome'));
    return {subject,container,hero,callbacks,errors};
}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
const settle=()=>new Promise(setImmediate);
test('posting refreshes one feed and keeps the welcome header',async()=>{
    let posts=[];
    const f=fixture(async()=>posts);
    await f.subject.renderFeed(f.container);
    assert.equal(f.container.children[1].children.filter(n=>n.kind==='empty').length,1);
    posts=[{id:'new-post'}];await f.callbacks[0]();
    assert.equal(f.container.children.length,2);
    assert.equal(f.container.children[0],f.hero);
    assert.deepEqual(f.container.children[1].children.map(n=>n.kind),['stories','compose','new-post']);
    posts=[{id:'second-post'},{id:'new-post'}];await f.callbacks[1]();
    assert.deepEqual(f.container.children[1].children.map(n=>n.kind),['stories','compose','second-post','new-post']);
});
test('late response from an older refresh cannot duplicate or overwrite the new feed',{timeout:3000},async()=>{
    const first=deferred(),second=deferred();let calls=0;
    const f=fixture(()=>++calls===1?first.promise:second.promise);
    const old=f.subject.renderFeed(f.container);await settle();
    const current=f.subject.renderFeed(f.container);await settle();
    second.resolve([{id:'newer'}]);await current;
    first.resolve([{id:'stale'}]);await old;
    assert.equal(f.container.children.length,2);
    assert.deepEqual(f.container.children[1].children.map(n=>n.kind),['stories','compose','newer']);
});
test('a feed response after navigation cannot change another page or show a stale error',{timeout:3000},async()=>{
    const response=deferred(),f=fixture(()=>response.promise);
    const pending=f.subject.renderFeed(f.container);await settle();
    f.container.clear();const profile=f.container.appendChild(new Node('profile'));
    response.reject(Error('old failure'));await pending;
    assert.deepEqual(f.container.children,[profile]);assert.deepEqual(f.errors,[]);
});
test('current feed failure removes the loader and reports the actual error once',async()=>{
    const f=fixture(async()=>{throw Error('Sem conexão');});
    await f.subject.renderFeed(f.container);
    assert.deepEqual(f.errors,['Sem conexão']);
    assert.deepEqual(f.container.children[1].children.map(n=>n.kind),['stories','compose']);
});
