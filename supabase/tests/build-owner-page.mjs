import fs from 'node:fs';
const dir=new URL('../functions/owner-app/',import.meta.url);
const page=fs.readFileSync(new URL('page.html',dir),'utf8').trimEnd();
const chunks=[];for(let i=0;i<page.length;i+=3980)chunks.push(page.slice(i,i+3980));
const expected=chunks.map((_,i)=>'_oa_final_20261005_'+i);
const source=fs.readFileSync(new URL('index.ts',dir),'utf8');
if(!source.includes('const KEYS='+JSON.stringify(expected)+';'))throw Error('Loader keys differ from generated page chunks');
const sql='BEGIN;\n'+chunks.map((v,i)=>"INSERT INTO public.app_data(key,value) VALUES ('"+expected[i]+"',$owner_page$"+v+"$owner_page$) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now();").join('\n')+'\nCOMMIT;\n';
fs.writeFileSync(new URL('page.generated.sql',dir),sql);
console.log('Generated owner-app/page.generated.sql; seed before deploying the existing owner-app loader.');

