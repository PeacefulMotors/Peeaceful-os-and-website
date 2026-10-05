import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const SB=Deno.env.get("SUPABASE_URL")!;
const KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KEYS=["_oa_inbox_20261005_0","_oa_inbox_20261005_1","_oa_inbox_20261005_2","_oa_inbox_20261005_3","_oa_inbox_20261005_4","_oa_inbox_20261005_5"];
Deno.serve(async()=>{
  try{
    const parts=[];
    for(const key of KEYS){
      const r=await fetch(`${SB}/rest/v1/app_data?key=eq.${key}&select=value`,{headers:{apikey:KEY,Authorization:`Bearer ${KEY}`}});
      if(!r.ok) return new Response(`db ${key} ${r.status}`,{status:500});
      const rows=await r.json();
      const v=rows?.[0]?.value;
      if(typeof v!=="string") return new Response(`missing ${key}`,{status:500});
      parts.push(v);
    }
    return new Response(parts.join(""),{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","x-owner-app":"inbox-20261005"}});
  }catch(e){return new Response(String(e),{status:500});}
});
