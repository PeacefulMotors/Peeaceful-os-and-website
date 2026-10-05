import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../functions/owner-app/page.html',import.meta.url),'utf8');
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
new vm.Script(script);
const els=new Map();
class El{constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.value='';this.classList={add(){},remove(){}};this.style={};this.attrs={};}set id(v){this._id=v;els.set(v,this)}get id(){return this._id}append(...xs){this.children.push(...xs)}replaceChildren(...xs){this.children=xs}setAttribute(k,v){this.attrs[k]=v}}
const el=id=>{if(!els.has(id)){const e=new El();e.id=id}return els.get(id)};
el('inboxFilter').value='inbox';
const tables={communication_threads:[{id:'thread',shop_id:'shop',customer_id:'customer',contact_name:'Test',is_starred:false,folder:'inbox',archived_at:null,last_activity_at:new Date().toISOString()}],communication_events:[{id:'event',shop_id:'shop',thread_id:'thread',channel:'email',direction:'inbound',visibility:'customer',body:'<img src=x onerror=alert(1)>',occurred_at:new Date().toISOString()}],customers:[{id:'customer',shop_id:'shop',name:'Test',email:'fixture@example.invalid'}],vehicles:[],bookings:[],jobs:[]};
let queries=[];
class Q{constructor(t){this.table=t;this.filters=[];this.action='read'}select(){return this}eq(k,v){this.filters.push([k,v]);return this}order(){return this}limit(){return this}is(k,v){this.filters.push([k,v]);return this}not(){return this}insert(v){this.action='insert';this.payload=v;return this}update(v){this.action='update';this.payload=v;return this}then(resolve,reject){try{queries.push(this);let rows=tables[this.table]||[];const matched=rows.filter(r=>this.filters.every(([k,v])=>r[k]===v||v===null&&r[k]==null));if(this.action==='insert'){const r={id:'inserted',occurred_at:new Date().toISOString(),...this.payload};rows.push(r);resolve({data:[r]})}else if(this.action==='update'){matched.forEach(r=>Object.assign(r,this.payload));resolve({data:matched})}else resolve({data:matched});}catch(e){reject(e)}}}
const ctx=vm.createContext({document:{createElement:t=>new El(t),getElementById:el},Option:class extends El{constructor(text,value){super('option');this.textContent=text;this.value=value}},supabase:{createClient:()=>({from:t=>new Q(t),auth:{onAuthStateChange(){},getSession:async()=>({data:{session:null}})}})},setTimeout(){},location:{},console});
vm.runInContext(script,ctx);await new Promise(r=>setImmediate(r));
vm.runInContext("workspace={shop_id:'shop',role:'owner'}",ctx);
await vm.runInContext('loadInbox()',ctx);assert.equal(el('threadList').children[0].textContent,'Test');
await vm.runInContext("openInboxThread('thread')",ctx);
const walk=n=>[n,...n.children.flatMap(walk)];let nodes=walk(el('threadDetail'));
assert(nodes.some(n=>n.textContent==='<img src=x onerror=alert(1)>'));assert(!nodes.some(n=>n.tagName==='IMG'));
el('inboxNote').value='Private fixture note';
await nodes.find(n=>n.textContent==='Save internal note').onclick();
assert.equal(tables.communication_events.at(-1).channel,'internal_note');assert.equal(tables.communication_events.at(-1).visibility,'internal');assert.equal(tables.communication_events.at(-1).shop_id,'shop');
nodes=walk(el('threadDetail'));await nodes.find(n=>n.textContent==='Star').onclick();assert(tables.communication_threads[0].is_starred);
nodes=walk(el('threadDetail'));await nodes.find(n=>n.textContent==='Archive').onclick();assert(tables.communication_threads[0].archived_at);
for(const q of queries.filter(q=>q.action!=='insert'))assert(q.filters.some(([k,v])=>k==='shop_id'&&v==='shop'),'all Inbox reads/updates shop scoped');
assert(!script.includes('api.resend.com'));assert(!script.includes('SUPABASE_SERVICE_ROLE_KEY'));
console.log('PASS: Inbox list/detail, safe text rendering, office note save, star/archive, shop-scoped queries, no email transport or server secret.');
