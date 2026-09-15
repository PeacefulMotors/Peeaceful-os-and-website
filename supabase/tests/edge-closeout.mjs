import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
const root=new URL('../functions/',import.meta.url);
function load(slug,extra={}) {
 let handler;
 const source=fs.readFileSync(new URL(slug+'/index.ts',root),'utf8').replace(/^import .*;\r?\n/gm,'');
 const ctx=vm.createContext({Request,Response,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,AbortController,crypto,setTimeout,clearTimeout,console,atob,btoa,
 Deno:{env:{get:k=>({SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-test-key'})[k]},serve:f=>handler=f},...extra});
 vm.runInContext(stripTypeScriptTypes(source,{mode:'transform'}),ctx);
 return {ctx,handler};
}
let calls=[];
const calendar=load('calendar-sync',{fetch:async(...x)=>{calls.push(x);throw Error('Unexpected network')}});
for(const headers of [{},{authorization:'Bearer customer-token'},{authorization:'Bearer anon-token'}]){
 const r=await calendar.handler(new Request('https://local/',{method:'POST',headers,body:'{}'}));
 assert.equal(r.status,401);
}
assert.equal(calls.length,0);
assert.equal((await calendar.handler(new Request('https://local/',{method:'POST',headers:{authorization:'Bearer server-test-key'},body:'{}'}))).status,400);
assert.equal(calls.length,0);
assert.equal(vm.runInContext("eventIdForBooking('12345678-1234-4234-8234-123456789012')",calendar.ctx),'pm12345678123442348234123456789012');
for(const slug of ['book','stripe-subscription-webhook']) {
 let patches=[],requests=[];
 const dbStub={from:()=>({update:x=>({eq:async()=>patches.push(x)})})};
 const app=load(slug,{createClient:()=>dbStub,fetch:async(url,init)=>{
 requests.push({url,init});
 if(url.includes('/calendar-sync'))return new Response('',{status:401});
 patches.push(JSON.parse(init.body));return new Response('');
 }});
 await vm.runInContext("syncCalendar('12345678-1234-4234-8234-123456789012','booking_created')",app.ctx);
 assert.equal(requests[0].init.headers.Authorization,'Bearer server-test-key');
 assert.equal(patches[0].calendar_sync_status,'failed');
}
const page=fs.readFileSync(new URL('customer-app/page.ts',root),'utf8');
const html=JSON.parse(page.replace(/^export const html = /,'').trim().replace(/;$/,''));
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
const storageCode=script.slice(0,script.indexOf('const sb='));
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
let remember={checked:true};const localStorage=storage(),sessionStorage=storage();
const ctx=vm.createContext({localStorage,sessionStorage,document:{getElementById:()=>remember}});
vm.runInContext(storageCode,ctx);
vm.runInContext("authStorage.setItem('auth','persistent')",ctx);
assert.equal(localStorage.getItem('auth'),'persistent');
remember.checked=false;
vm.runInContext("authStorage.setItem('auth','session')",ctx);
assert.equal(localStorage.getItem('auth'),null);
assert.equal(sessionStorage.getItem('auth'),'session');
vm.runInContext("authStorage.removeItem('auth')",ctx);
assert.equal(sessionStorage.getItem('auth'),null);
console.log('PASS: calendar rejects non-server requests before I/O; server calls carry authentication and record failed sync; deterministic event ID; customer script syntax and remember-me storage/logout.');
