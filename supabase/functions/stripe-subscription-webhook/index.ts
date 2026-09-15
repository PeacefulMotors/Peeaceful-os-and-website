import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const SB=Deno.env.get('SUPABASE_URL')!,KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const H={apikey:KEY,Authorization:`Bearer ${KEY}`,'content-type':'application/json'};
const plans:any={'plink_1U5kYiGfDywknrUDs1JjTiWR':'solo','plink_1U5kYsGfDywknrUDOUizKxDV':'shop','plink_1U5kZ1GfDywknrUDQxMuwPha':'pro','plink_1U5kZBGfDywknrUDL4McDUTM':'founding'};
const BOOKING_LINK='plink_1U5zpYGfDywknrUD5nWCzWZq',APPRAISAL_LINK='plink_1U6cMqGfDywknrUDEUEeIY2G';
const INSPECT_LINKS:Record<string,{key:string,service_name:string,amount_cents:number}>={
  plink_1UAEABGfDywknrUDvMZdfYQX:{key:'compact_car',service_name:'Peaceful Inspect — Standard Pre-Purchase Inspection',amount_cents:19900},
  plink_1UAEZaGfDywknrUD95w9vuGH:{key:'ev_hybrid_ppi',service_name:'Peaceful Inspect — EV / Hybrid Pre-Purchase Inspection',amount_cents:21900},
  plink_1UAEZjGfDywknrUDRjPhFrig:{key:'exotic_ppi',service_name:'Peaceful Inspect — Exotic / Supercar Pre-Purchase Inspection',amount_cents:27900},
  plink_1UAEZlGfDywknrUDMQ7MwIxI:{key:'classic_ppi',service_name:'Peaceful Inspect — Classic / Collector Pre-Purchase Inspection',amount_cents:28900},
  plink_1UAEZoGfDywknrUDZTCzhobs:{key:'motorcycle_ppi',service_name:'Peaceful Inspect — Motorcycle / Powersports Inspection',amount_cents:18900},
  plink_1UAEZqGfDywknrUDcR2r0m4R:{key:'commercial_van_ppi',service_name:'Peaceful Inspect — Commercial Van / Light Truck Inspection',amount_cents:32900},
  plink_1UAEZsGfDywknrUDBjLqsYNc:{key:'rv_prepurchase',service_name:'Peaceful Inspect — RV Pre-Purchase Inspection',amount_cents:39900},
  plink_1UAEZuGfDywknrUDGAJxMdPt:{key:'check_engine',service_name:'Peaceful Inspect — Check-Engine / Warning Lights Inspection',amount_cents:14900},
  plink_1UAEZwGfDywknrUDTWbE689W:{key:'mechanical_concern',service_name:'Peaceful Inspect — Mechanical Concern Inspection',amount_cents:17900},
  plink_1UAEZzGfDywknrUDeD09Kdxu:{key:'family_used_car',service_name:'Peaceful Inspect — Family Used-Car Inspection',amount_cents:17900},
  plink_1UAEa1GfDywknrUDpzJ83128:{key:'pre_sale',service_name:'Peaceful Inspect — Pre-Sale Inspection',amount_cents:19900},
  plink_1UAEa2GfDywknrUDyeQ00B2f:{key:'post_repair',service_name:'Peaceful Inspect — Post-Repair Verification Inspection',amount_cents:12900}
};
const INSPECT_SHOP='a0000000-0000-4000-8000-000000000001';
let _resendCache:string|null|undefined;
async function resendKey(){if(_resendCache!==undefined)return _resendCache;const r=await rest('rpc/get_integration_secret',{method:'POST',body:JSON.stringify({p_key:'resend_api_key'})});_resendCache=typeof r==='string'?r:null;return _resendCache}
const BILLING_FROM=Deno.env.get('BILLING_EMAIL_FROM')||'Peaceful Motors Billing <billing@peacefulmotors.com>';
const OWNER_BCC=Deno.env.get('OWNER_NOTIFY_EMAIL')||'frederickm@peacefulmotors.com';
async function rest(path:string,init:any={}){const r=await fetch(`${SB}/rest/v1/${path}`,{...init,headers:{...H,...(init.headers||{})}});if(!r.ok)throw new Error(await r.text());const t=await r.text();return t?JSON.parse(t):null}
async function webhookSecret(){const r=await rest('rpc/get_integration_secret',{method:'POST',body:JSON.stringify({p_key:'stripe_webhook_secret_v2'})});return typeof r==='string'?r:null}
async function sigOK(body:string,h:string|null){if(!h)return false;const secret=await webhookSecret();if(!secret)return false;const parts=h.split(',').map(x=>x.split('=')),t=parts.find(x=>x[0]==='t')?.[1],sigs=parts.filter(x=>x[0]==='v1').map(x=>x[1]);if(!t||!sigs.length)return false;if(Math.abs(Math.floor(Date.now()/1000)-Number(t))>300)return false;const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(t+'.'+body));const hex=[...new Uint8Array(sig)].map(b=>b.toString(16).padStart(2,'0')).join('');return sigs.some(v=>{if(v.length!==hex.length)return false;let d=0;for(let i=0;i<hex.length;i++)d|=hex.charCodeAt(i)^v.charCodeAt(i);return d===0})}
async function shopByEmail(email:string){const p=await rest(`profiles?email=eq.${encodeURIComponent(email.toLowerCase())}&select=user_id&limit=1`);if(!p?.length)return null;const s=await rest(`staff?user_id=eq.${p[0].user_id}&select=shop_id&limit=1`);return s?.[0]?.shop_id||null}
async function upsertSub(obj:any){await rest('subscriptions?on_conflict=stripe_subscription_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(obj)})}
function field(o:any,key:string){const f=(o.custom_fields||[]).find((x:any)=>x.key===key);const v=f?.text?.value??f?.numeric?.value??f?.dropdown?.value??null;if(v&&typeof v==='object')return v.value??v.label??null;return v==null||v===''?null:String(v)}
function uuidish(s:any){return typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)}
async function resolveBooking(ref:any){if(typeof ref!=='string')return null;const v=ref.trim();if(/^\d{8}$/.test(v))return null;let rows;if(uuidish(v))rows=await rest(`bookings?id=eq.${encodeURIComponent(v)}&select=id,shop_id,job_id,status,short_ref&limit=1`);else if(/^[0-9a-f]{8}$/i.test(v))rows=await rest(`bookings?short_ref=eq.${encodeURIComponent(v.toUpperCase())}&select=id,shop_id,job_id,status,short_ref&limit=1`);return rows?.[0]||null}
async function recordPayment(o:any,kind:string,ref:string|null,booking:any=null,job:any=null,estimate:any=null){const row={shop_id:booking?.shop_id||job?.shop_id||estimate?.shop_id||null,booking_id:booking?.id||null,job_id:job?.id||booking?.job_id||estimate?.job_id||null,estimate_id:estimate?.id||null,payment_kind:kind,reference_text:ref,amount_cents:Number(o.amount_total||0),currency:o.currency||'usd',status:o.payment_status==='paid'?'paid':'pending',stripe_checkout_session_id:String(o.id||''),stripe_payment_intent_id:String(o.payment_intent||''),stripe_customer_id:String(o.customer||''),stripe_payment_link_id:String(o.payment_link||''),customer_email:o.customer_details?.email||o.customer_email||null,customer_phone:o.customer_details?.phone||null,paid_at:o.payment_status==='paid'?new Date().toISOString():null,raw_summary:{mode:o.mode,payment_status:o.payment_status}};await rest('stripe_reconciliation_events?on_conflict=stripe_checkout_session_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(row)})}

async function syncCalendar(bookingId:string,phase:string){
  try{
    const ctrl=new AbortController();
    const t=setTimeout(()=>ctrl.abort(),8000);
    const response=await fetch(`${SB}/functions/v1/calendar-sync`,{method:'POST',headers:H,body:JSON.stringify({booking_id:bookingId,phase}),signal:ctrl.signal});
    clearTimeout(t);
    if(!response.ok)throw new Error('Calendar sync HTTP '+response.status);
  }catch(err){
    try { await rest(`bookings?id=eq.${bookingId}`,{method:'PATCH',body:JSON.stringify({calendar_sync_status:'failed',calendar_sync_error:'Calendar sync request failed; retry required'})}); } catch { /* Preserve payment handling if status recording also fails. */ }
    // Best-effort only — calendar-sync records calendar_sync_status='failed'
    // on the booking row itself; a webhook must never fail/retry-loop just
    // because the calendar update didn't go through.
    console.error('calendar sync failed',err);
  }
}

function nextWeekdayChicago(){
  const tz='America/Chicago';
  const fmt=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  const wd=(d:Date)=>new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'short'}).format(d);
  const today=fmt(new Date());
  const [y,m,day]=today.split('-').map(Number);
  for(let i=1;i<=8;i++){
    const cand=new Date(Date.UTC(y,m-1,day+i,17,0,0));
    const w=wd(cand);
    if(w!=='Sat'&&w!=='Sun') return fmt(cand);
  }
  return today;
}

function money(cents:number,currency:string){return new Intl.NumberFormat('en-US',{style:'currency',currency:(currency||'usd').toUpperCase()}).format((cents||0)/100)}
const EXPLANATIONS:Record<string,(o:any,ref:string|null)=>string>={
  booking_hold:()=>`This is a <b>$50 booking hold</b>. It reserves your appointment slot and is <b>credited in full toward your final invoice</b> once the job is done. Per Peaceful Motors policy, this hold is <b>non-refundable</b> if you cancel or no-show.`,
  collision_appraisal:()=>`This <b>$250 fee</b> covers a collision estimate/appraisal service visit. If Peaceful Motors performs the repair, any repair-credit arrangement is documented separately and is not automatic.`,
  inspect_ppi:(o:any)=>`This is your <b>${money(o.amount_total,o.currency)} ${o._inspect_name||'Peaceful Inspect inspection'}</b> with Peaceful Inspect. A Peaceful Motors inspector comes to the car in Greater St. Louis and documents observed condition at the time of the visit. Any repairs are a <b>separate estimate</b> — never a surprise upsell on-site.`,
  fleet_subscription:(o:any)=>`This is your recurring <b>Fleet subscription</b> charge (${money(o.amount_total,o.currency)}), billed on the schedule you signed up for.`,
  peaceful_os_subscription:(o:any)=>`This is your <b>Peaceful OS</b> subscription charge (${money(o.amount_total,o.currency)}) for the plan you selected.`,
  other_one_time:(o:any)=>`This is a one-time payment of ${money(o.amount_total,o.currency)} to Peaceful Motors.`,
};
async function sendReceipt(opts:{to:string|null,subject:string,kind:string,o:any,ref:string|null,extra?:string}){
  const RESEND=await resendKey();
  if(!opts.to||!RESEND)return;
  const explain=(EXPLANATIONS[opts.kind]||EXPLANATIONS.other_one_time)(opts.o,opts.ref);
  const amount=money(opts.o.amount_total,opts.o.currency);
  const html=`<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto">
  <div style="background:#4A0506;color:#ffffff;padding:12px 18px;border-radius:10px 10px 0 0;font-weight:800;font-size:16px">Peaceful Motors</div>
  <div style="border:1px solid #E7DACE;border-top:0;padding:18px;border-radius:0 0 10px 10px;background:#ffffff;color:#241F1F;font-size:14px;line-height:1.6">
  <p style="font-size:20px;font-weight:800;margin:0 0 4px">${amount} received</p>
  <p style="margin:0 0 14px;color:#555">${new Date().toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})}</p>
  <p style="margin:0 0 14px">${explain}</p>
  ${opts.extra?`<p style="margin:0 0 14px">${opts.extra}</p>`:''}
  ${opts.ref?`<p style="margin:0 0 14px;color:#555">Reference: ${opts.ref}</p>`:''}
  <hr style="border:none;border-top:1px solid #E7DACE;margin:18px 0 10px"/>
  <div style="font-size:12px;color:#555555"><b>Peaceful Motors, LLC</b> - (314) 919-7456 - peacefulmotors.com<br/>Questions about this charge? Reply to this email.<br/>An Ease of Mind is Simply Divine.</div>
  </div></div>`;
  try{
    await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${RESEND}`},body:JSON.stringify({from:BILLING_FROM,to:[opts.to],bcc:OWNER_BCC&&OWNER_BCC!==opts.to?[OWNER_BCC]:undefined,subject:opts.subject,html})});
  }catch(err){console.error('receipt email failed',err)}
}

async function upsertInspectPpiBooking(o:any,spec:any){
  const sid=String(o.id||'');
  const vehicle=field(o,'vehicle');
  const service_address=field(o,'service_address');
  const preferred=field(o,'preferred_window');
  const booking_window=(preferred&&String(preferred).trim())||'To be confirmed';
  const name=(o.customer_details?.name&&String(o.customer_details.name).trim())||'Peaceful Inspect customer';
  const email=o.customer_details?.email||o.customer_email||null;
  const phone=o.customer_details?.phone||null;
  const paidAt=new Date().toISOString();
  const hold=Number(o.amount_total||0)/100;
  if(sid){
    const existing=await rest(`bookings?stripe_checkout_session_id=eq.${encodeURIComponent(sid)}&select=id,shop_id,job_id,status,short_ref&limit=1`);
    if(existing?.[0]){
      await rest(`bookings?id=eq.${existing[0].id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({paid_claimed:true,booking_hold_paid_at:paidAt,booking_hold_amount:hold,stripe_checkout_session_id:sid,status:existing[0].status==='cancelled'?'cancelled':'payment_verified'})});
      await syncCalendar(existing[0].id,'payment_verified');
      return existing[0];
    }
  }
  const rows=await rest('bookings?select=id,shop_id,job_id,status,short_ref',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({
    shop_id:INSPECT_SHOP,
    name,
    email,
    phone,
    vehicle,
    service_address,
    service:(spec&&spec.service_name)||'Peaceful Inspect inspection',
    notes:preferred,
    service_division:'inspection',
    status:'payment_verified',
    paid_claimed:true,
    booking_hold_amount:hold,
    booking_hold_paid_at:paidAt,
    stripe_checkout_session_id:sid||null,
    booking_date:nextWeekdayChicago(),
    booking_window,
    calendar_sync_status:'pending'
  })});
  const created=rows?.[0]||null;
  if(created) await syncCalendar(created.id,'payment_verified');
  return created;
}

async function handlePayment(o:any){if(o.payment_status!=='paid')return;
 const to=o.customer_details?.email||o.customer_email||null;
 const metadataBookingId=typeof o.metadata?.booking_id==='string'?o.metadata.booking_id.trim():'';
 if(metadataBookingId){
  // Server-created Checkout Sessions carry the durable booking UUID. Never
  // reinterpret a customer-entered 8-character value as this trusted key.
  if(!uuidish(metadataBookingId)){await recordPayment(o,'booking_hold_rejected',metadataBookingId);return}
  const b=await resolveBooking(metadataBookingId);
  await recordPayment(o,'booking_hold',metadataBookingId,b);
  if(!b)return;
  await rest(`bookings?id=eq.${b.id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({paid_claimed:true,booking_hold_paid_at:new Date().toISOString(),booking_hold_amount:Number(o.amount_total||0)/100,stripe_checkout_session_id:o.id,status:b.status==='cancelled'?'cancelled':'payment_verified'})});
  await syncCalendar(b.id,'payment_verified');
  return
 }
 if(o.payment_link===BOOKING_LINK){const ref=field(o,'booking_id');const b=await resolveBooking(ref);await recordPayment(o,'booking_hold',ref,b);if(b){await rest(`bookings?id=eq.${b.id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({paid_claimed:true,booking_hold_paid_at:new Date().toISOString(),booking_hold_amount:Number(o.amount_total||0)/100,stripe_checkout_session_id:o.id,status:b.status==='cancelled'?'cancelled':'payment_verified'})});await syncCalendar(b.id,'payment_verified')}await sendReceipt({to,subject:'Your $50 booking hold — Peaceful Motors',kind:'booking_hold',o,ref});return}
 if(o.payment_link===APPRAISAL_LINK){const ref=field(o,'claim_or_job');let e=null,j=null,b=null;if(ref){let er=await rest(`estimates?estimate_number=eq.${encodeURIComponent(ref)}&select=id,job_id,shop_id,estimate_number&limit=1`);e=er?.[0]||null;if(!e){let jr=uuidish(ref)?await rest(`jobs?id=eq.${encodeURIComponent(ref)}&select=id,shop_id,external_ref&limit=1`):await rest(`jobs?external_ref=eq.${encodeURIComponent(ref)}&select=id,shop_id,external_ref&limit=1`);j=jr?.[0]||null}if(!e&&!j)b=await resolveBooking(ref)}await recordPayment(o,'collision_appraisal',ref,b,j,e);await sendReceipt({to,subject:'Collision appraisal payment received — Peaceful Motors',kind:'collision_appraisal',o,ref});return}
 const spec=INSPECT_LINKS[String(o.payment_link||'')];if(spec){const b=await upsertInspectPpiBooking(o,spec);const ref=b?.short_ref||String(o.id||'')||null;await recordPayment(o,'inspect_ppi',ref,b);await sendReceipt({to,subject:'Your '+spec.service_name+' booking is paid — Peaceful Motors',kind:'inspect_ppi',o:{...o,_inspect_name:spec.service_name},ref});return}
 await recordPayment(o,'other_one_time',null);await sendReceipt({to,subject:'Payment received — Peaceful Motors',kind:'other_one_time',o,ref:null})}

Deno.serve(async req=>{const body=await req.text();if(!(await sigOK(body,req.headers.get('stripe-signature'))))return new Response('bad signature',{status:400});try{const e=JSON.parse(body),o=e.data?.object||{};
 if(e.type==='checkout.session.completed'||e.type==='checkout.session.async_payment_succeeded'){if(o.mode==='subscription'){const email=o.customer_details?.email||o.customer_email;const sid=email?await shopByEmail(email):null;const plan=o.metadata?.plan||plans[o.payment_link]||'shop';if(sid){await upsertSub({shop_id:sid,stripe_customer_id:String(o.customer||''),stripe_subscription_id:String(o.subscription||''),plan,status:'active',provider:'stripe',billing_interval:'month',currency:o.currency||'usd',price_cents:Number(o.amount_total||0),updated_at:new Date().toISOString()})}const kind=plan==='founding'||['solo','shop','pro'].includes(plan)?'peaceful_os_subscription':'fleet_subscription';await sendReceipt({to:email||null,subject:'Subscription payment received — Peaceful Motors',kind,o,ref:null})}else if(o.mode==='payment')await handlePayment(o)}
 else if(String(e.type).startsWith('customer.subscription.')){const rows=await rest(`subscriptions?stripe_subscription_id=eq.${encodeURIComponent(o.id)}&select=id,shop_id,plan&limit=1`);if(rows?.length){const status=e.type==='customer.subscription.deleted'?'canceled':(o.status||'active');await rest(`subscriptions?id=eq.${rows[0].id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status,current_period_end:o.current_period_end?new Date(o.current_period_end*1000).toISOString():null,updated_at:new Date().toISOString()})})}}
 else if(e.type==='charge.refunded'&&o.payment_intent){await rest(`stripe_reconciliation_events?stripe_payment_intent_id=eq.${encodeURIComponent(o.payment_intent)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'refunded',updated_at:new Date().toISOString()})});const email=o.billing_details?.email||null;await sendReceipt({to:email,subject:'Refund issued — Peaceful Motors',kind:'other_one_time',o:{...o,amount_total:o.amount_refunded||o.amount},ref:null,extra:'This charge was refunded.'})}
 return new Response('ok',{status:200})}catch(err){console.error(err);return new Response('handler error',{status:500})}});
