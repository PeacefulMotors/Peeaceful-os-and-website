import { createClient } from "jsr:@supabase/supabase-js@2";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"content-type"};
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...CORS,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}})}
const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SHOP_ID="a0000000-0000-4000-8000-000000000001";
const DIVISIONS=new Set(['auto','diesel','exotic_european','small_engine','collision','rv_specialty','inspection']);
const WARRANTY_FALLBACK="24 months or 24,000 miles, whichever comes first. Peaceful Motors Confidence Warranty.";
function clip(v:unknown,max:number){if(typeof v!=="string")return null;const s=v.trim();return s?s.slice(0,max):null}
function cleanVin(v:unknown){const s=clip(v,17)?.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g,"")??null;return s&&s.length===17?s:null}
function validEmail(v:string|null){return !!v&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)}
async function syncCalendar(bookingId:string,phase:string){
  try{
    const ctrl=new AbortController();
    const t=setTimeout(()=>ctrl.abort(),8000);
    const response=await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/calendar-sync`,{
      method:"POST",
      headers:{"content-type":"application/json", Authorization:`Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, apikey:Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!},
      body:JSON.stringify({booking_id:bookingId,phase}),
      signal:ctrl.signal
    });
    clearTimeout(t);
    if(!response.ok)throw new Error("Calendar sync HTTP "+response.status);
  }catch(_e){
    await supabase.from("bookings").update({calendar_sync_status:"failed",calendar_sync_error:"Calendar sync request failed; retry required"}).eq("id",bookingId);
    // Best-effort only. calendar-sync itself records calendar_sync_status='failed'
    // on the booking row when it can't reach Google; a booking must never be
    // rejected just because the calendar hold didn't go through.
  }
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:CORS});
 if(req.method==="GET"){
  const today=new Date().toISOString().slice(0,10),end=new Date(Date.now()+200*86400000).toISOString().slice(0,10);
  const [slotsRes,hoursRes,catalogRes,warrantyRes,divisionRes]=await Promise.all([
   supabase.from("bookings").select("booking_date,booking_window").neq("status","cancelled").gte("booking_date",today).lte("booking_date",end),
   supabase.from("app_data").select("value").eq("key","booking_windows").maybeSingle(),
   supabase.from("app_data").select("value").eq("key","service_catalog").maybeSingle(),
   supabase.from("app_data").select("value").eq("key","warranty_terms").maybeSingle(),
   supabase.from("service_divisions").select("key,label,description,sort_order").eq("active",true).order("sort_order")]);
  if(slotsRes.error)return json({error:"availability unavailable"},500);
  let hours=null,catalog=null;try{hours=hoursRes.data?JSON.parse(hoursRes.data.value):null}catch{}try{catalog=catalogRes.data?JSON.parse(catalogRes.data.value):null}catch{}
  return json({taken:slotsRes.data??[],hours,catalog,divisions:divisionRes.data??[],booking_url:"https://peacefulmotors.com/book",warranty:(warrantyRes.data?.value||WARRANTY_FALLBACK).trim()});
 }
 if(req.method==="POST"){
  let body:Record<string,unknown>;try{body=await req.json()}catch{return json({error:"bad json"},400)}
  if(clip(body.company,50))return json({ok:true});
  const first=clip(body.first_name,80),last=clip(body.last_name,80),legacyName=clip(body.name,160);
  const name=(first&&last)?`${first} ${last}`:legacyName;
  const phone=clip(body.phone,40),email=clip(body.email,160),address=clip(body.service_address,300),vehicle=clip(body.vehicle,200),service=clip(body.service,300),notes=clip(body.notes,1000);
  const bookingDate=clip(body.booking_date,10),bookingWindow=clip(body.booking_window,60),vin=cleanVin(body.vin),division=clip(body.service_division,40)||'auto';
  const holdAccepted=body.booking_hold_ack===true||body.booking_hold_ack==='true'||body.booking_hold_ack===1||body.booking_hold_ack==='1';
  if(!DIVISIONS.has(division))return json({error:"invalid service division"},400);
  if(!name||!first||!last)return json({error:"first_name and last_name are required"},400);
  if(!phone)return json({error:"phone is required"},400);
  if(!validEmail(email))return json({error:"valid email is required"},400);
  if(!vehicle)return json({error:"vehicle/equipment is required"},400);
  if(!service)return json({error:"service is required"},400);
  if(!notes)return json({error:"concern/symptoms are required"},400);
  if(!address)return json({error:"service address is required"},400);
  if(!bookingDate||!bookingWindow)return json({error:"booking_date and booking_window are required"},400);
  if(!holdAccepted)return json({error:"booking hold acknowledgement is required"},400);
  if(body.vin&&!vin && division!=='small_engine')return json({error:"VIN must be 17 valid characters"},400);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate))return json({error:"bad date"},400);
  const d=new Date(bookingDate+"T12:00:00Z");if(isNaN(d.getTime())||d.getTime()<Date.now()-86400000)return json({error:"date is in the past"},400);if(d.getTime()>Date.now()+200*86400000)return json({error:"date is too far out, six months maximum"},400);
  const missingVin=division!=='small_engine'&&!vin;
  const notesWithVinFlag=missingVin?`VIN REQUIRED BEFORE DISPATCH / REPAIR ORDER.\n${notes}`:notes;
  const {data,error}=await supabase.from("bookings").insert({shop_id:SHOP_ID,name,phone,email,service_address:address,vehicle,vin:division==='small_engine'?null:vin,service_division:division,service,notes:notesWithVinFlag,booking_date:bookingDate,booking_window:bookingWindow,estimate_ref:clip(body.estimate_ref,60),paid_claimed:false}).select("id,short_ref,name,phone,email,service_address,vehicle,service,notes,booking_date,booking_window,vin,service_division").single();
  if(error){if(error.code==="23505")return json({error:"slot_taken",message:"That time was just booked. Please pick another window."},409);return json({error:"could not save booking"},500)}
  // Create-booking-first: the calendar hold is placed immediately, before any
  // Stripe interaction, so the slot is reserved and can't be double-booked.
  await syncCalendar(data.id,"booking_created");
  return json({ok:true,booking:data,vin_required_before_dispatch:missingVin,payment_status:"not_verified",payment_reference:data.short_ref||data.id.slice(0,8).toUpperCase(),next:"https://xsqjskbcmsjzkumbsrti.supabase.co/functions/v1/booking-page?booked="+data.id});
 }
 return json({error:"method not allowed"},405);
});
