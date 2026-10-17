import { createRemoteJWKSet, jwtVerify } from 'jose';

interface Env {
  ASSETS: Fetcher;
  BOOKINGS_DB: D1Database;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_EMAILS?: string;
  RESEND_API_KEY?: string;
  BOOKING_FROM_EMAIL?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});
const denied = () => json({error:'Administrator access is not configured or authorised.'},403);
const validId = (s:unknown):s is string => typeof s==='string' && /^[a-z0-9][a-z0-9_-]{1,63}$/.test(s);
const validTime = (s:unknown):s is string => typeof s==='string' && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(s);
const stringField = (s:unknown,max=80):s is string => typeof s==='string' && s.trim().length>0 && s.trim().length<=max;
async function verifyAdmin(request:Request, env:Env):Promise<string|null> {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAILS) return null;
  const allowed=env.ADMIN_EMAILS.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) return null;
  const token=request.headers.get('cf-access-jwt-assertion');
  if (!token) return null;
  try {
    const issuer=env.ACCESS_TEAM_DOMAIN.replace(/\/$/,'');
    if (!/^https:\/\/[^/]+\.cloudflareaccess\.com$/.test(issuer)) return null;
    const jwks=createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs'));
    const {payload}=await jwtVerify(token,jwks,{issuer,audience:env.ACCESS_AUD});
    return typeof payload.email==='string' && allowed.includes(payload.email.toLowerCase()) ? payload.email.toLowerCase() : null;
  } catch { return null; }
}
async function body(request:Request):Promise<Record<string,unknown>> {
  if (Number(request.headers.get('content-length')||0)>8192) throw new Error('Request is too large');
  const result=await request.json() as unknown;
  if (!result || typeof result!=='object' || Array.isArray(result)) throw new Error('Invalid request');
  return result as Record<string,unknown>;
}

const openingHours:Record<number,[string,string]> = {
  0:['11:00','16:00'],1:['09:30','19:00'],2:['09:30','19:00'],
  3:['09:30','19:00'],4:['09:30','19:00'],5:['09:30','19:00'],6:['08:30','17:00']
};
function londonParts(now:Date) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}
function proposedSlots(today:string,currentTime:string,days=14) {
  const out:{date:string;time:string}[]=[];
  const base=new Date(today+'T12:00:00Z');
  for(let d=0;d<days;d++){
    const day=new Date(base.getTime()+d*86400000);
    const date=day.toISOString().slice(0,10);
    const [start,end]=openingHours[day.getUTCDay()];
    const toMin=(v:string)=>Number(v.slice(0,2))*60+Number(v.slice(3,5));
    for(let minute=toMin(start);minute+60<=toMin(end);minute+=60){
      const time=`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
      if(date===today&&time<=currentTime)continue;
      out.push({date,time});
    }
  }
  return out;
}
async function getSlots(env:Env,includeBlocked:boolean) {
  const {date,time}=londonParts(new Date());
  const all=proposedSlots(date,time);
  const end=all.at(-1)?.date??date;
  const [r,bookings]=await Promise.all([
    env.BOOKINGS_DB.prepare('SELECT date,time FROM blocked_slots WHERE date>=? AND date<=?').bind(date,end).all(),
    env.BOOKINGS_DB.prepare('SELECT date,time,customer_name,assigned_barber FROM simple_bookings WHERE date>=? AND date<=?').bind(date,end).all()
  ]);
  const blockedRecords=r.results as {date:string;time:string}[];
  // A 30-minute legacy block anywhere inside an hour also blocks that hour.
  const isBlocked=(slot:{date:string;time:string})=>blockedRecords.some(row=>
    row.date===slot.date && row.time>=slot.time &&
    (Number(row.time.slice(0,2))*60+Number(row.time.slice(3,5))) <
    (Number(slot.time.slice(0,2))*60+Number(slot.time.slice(3,5))+60)
  );
  const reservations=new Map((bookings.results as {date:string;time:string;customer_name:string;assigned_barber:string|null}[]).map(x=>[x.date+'|'+x.time,x]));
  return all.filter(x=>includeBlocked||(!isBlocked(x)&&!reservations.has(x.date+'|'+x.time))).map(x=>({...x,blocked:isBlocked(x),booked:reservations.has(x.date+'|'+x.time),customer_name:includeBlocked?(reservations.get(x.date+'|'+x.time)?.customer_name??null):undefined,assigned_barber:includeBlocked?(reservations.get(x.date+'|'+x.time)?.assigned_barber??null):undefined}));
}

const PREVIEW_ONLY=true; // Deliberate fail-closed demo mode. Disable only during an authorised production launch.
const emailEnabled=(env:Env)=>Boolean(env.RESEND_API_KEY&&env.BOOKING_FROM_EMAIL&&env.TURNSTILE_SITE_KEY&&env.TURNSTILE_SECRET_KEY);
const safeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
async function verifyTurnstile(token:string,request:Request,env:Env) {
  if(!env.TURNSTILE_SECRET_KEY||!token)return false;
  const form=new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token});
  const ip=request.headers.get('CF-Connecting-IP');if(ip)form.set('remoteip',ip);
  const res=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:form});
  if(!res.ok)return false;
  const data=await res.json() as {success?:boolean};
  return data.success===true;
}
async function sendConfirmation(env:Env,email:string,name:string,date:string,time:string) {
 const pretty=new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'});
 const details={date:pretty,time,shop:"Your Barbershop",address:"Your shop address"};
 const html=`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#f5f1ea;font-family:Arial,Helvetica,sans-serif;color:#2b211a"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:36px 15px"><tr><td align="center"><table role="presentation" width="100%" style="max-width:520px;background:#fff;border:1px solid #e8dcd0;border-radius:12px;padding:35px"><tr><td><p style="font-size:12px;letter-spacing:3px;color:#987048;font-weight:bold">YOUR BARBERSHOP</p><h1 style="font-size:30px;margin:30px 0 15px">You're booked in.</h1><p>Hi ${safeHtml(name)},</p><p>Your appointment is confirmed. Here are your details:</p><div style="background:#f5f1ea;padding:20px;border-radius:8px;margin:24px 0"><strong>${safeHtml(details.date)}</strong><br><span style="font-size:24px;font-weight:bold">${safeHtml(details.time)}</span><p style="margin-bottom:0">${safeHtml(details.shop)}<br>${safeHtml(details.address)}</p></div><p>Please arrive on time. If you need to cancel or change your appointment, contact the shop on <a style="color:#80603e" href="#contact">Your shop number</a>.</p><p style="font-size:12px;color:#776d64;margin-top:30px">This message confirms a booking you made. It is not a marketing email.</p></td></tr></table></td></tr></table></body></html>`;
 const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:env.BOOKING_FROM_EMAIL,to:[email],subject:'Your Your Barbershop appointment — '+pretty,html})});
 return res.ok;
}
async function audit(env:Env,actor:string,action:string,target:string,details:Record<string,unknown>={}) {
  await env.BOOKINGS_DB.prepare('INSERT INTO admin_audit_log(id,actor_email,action,target,details) VALUES(?,?,?,?,?)')
    .bind(crypto.randomUUID(),actor,action,target,JSON.stringify(details)).run();
}
async function api(request:Request,env:Env,url:URL,actor:string):Promise<Response> {
  const path=url.pathname,method=request.method;
  if (method==='GET' && path==='/admin/api/audit') {
    const selected=url.searchParams.get('date')||londonParts(new Date()).date;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(selected))return json({error:'Invalid activity date'},400);
    const today=londonParts(new Date()).date;
    const offset=(Date.parse(today+'T12:00:00Z')-Date.parse(selected+'T12:00:00Z'))/86400000;
    if(!Number.isInteger(offset)||offset<0||offset>7)return json({error:'Activity is available for today and the previous seven days'},400);
    // Retrieve adjacent UTC days so UK daylight-saving transitions are handled correctly.
    const records=await env.BOOKINGS_DB.prepare("SELECT occurred_at,actor_email,action,target,details FROM admin_audit_log WHERE occurred_at>=datetime(?,'-1 day') AND occurred_at<datetime(?,'+2 day') ORDER BY occurred_at DESC,id DESC LIMIT 500").bind(selected,selected).all();
    const events=(records.results as {occurred_at:string}[]).filter(record=>{
      const utcDate=new Date(record.occurred_at.replace(' ','T')+'Z');
      const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(utcDate);
      return parts===selected;
    });
    return json({events});
  }
  if (method==='GET' && path==='/admin/api/slots') return json({slots:await getSlots(env,true)});
  if (method==='PATCH' && path==='/admin/api/bookings/barber') {
    const b=await body(request);
    if(typeof b.date!=='string'||typeof b.time!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||!validTime(b.time))return json({error:'Invalid appointment'},400);
    const barber=typeof b.barber==='string'?b.barber.trim():'';
    if(barber.length>70||/[<>\x00-\x1f]/.test(barber))return json({error:'Invalid barber name'},400);
    const result=await env.BOOKINGS_DB.prepare('UPDATE simple_bookings SET assigned_barber=? WHERE date=? AND time=?').bind(barber||null,b.date,b.time).run();
    if(!result.meta.changes)return json({error:'Appointment not found'},404);
    await audit(env,actor,'assign_barber',b.date+' '+b.time,{assigned:barber||null});
    return json({ok:true});
  }
  if (method==='DELETE' && path==='/admin/api/bookings') {
    const b=await body(request);
    if(typeof b.date!=='string'||typeof b.time!=='string')return json({error:'Invalid reservation'},400);
    const deleted=await env.BOOKINGS_DB.prepare('DELETE FROM simple_bookings WHERE date=? AND time=?').bind(b.date,b.time).run();
    if(deleted.meta.changes)await audit(env,actor,'cancel_booking',b.date+' '+b.time);
    return json({ok:true});
  }
  if (method==='POST' && path==='/admin/api/slots') {
    const b=await body(request);
    if (typeof b.date!=='string'||typeof b.time!=='string'||typeof b.blocked!=='boolean') return json({error:'Invalid time slot'},400);
    const allowed=(await getSlots(env,true)).some(x=>x.date===b.date&&x.time===b.time);
    if(!allowed) return json({error:'This time is outside the upcoming opening hours'},400);
    if(b.blocked && (await getSlots(env,true)).some(x=>x.date===b.date&&x.time===b.time&&x.booked)) return json({error:'Cancel the reservation before blocking this time'},409);
    if(b.blocked) await env.BOOKINGS_DB.prepare('INSERT OR IGNORE INTO blocked_slots(date,time) VALUES (?,?)').bind(b.date,b.time).run();
    else {
      const start=Number(b.time.slice(0,2))*60+Number(b.time.slice(3,5))+60;
      const end=`${String(Math.floor(start/60)).padStart(2,'0')}:${String(start%60).padStart(2,'0')}`;
      await env.BOOKINGS_DB.prepare('DELETE FROM blocked_slots WHERE date=? AND time>=? AND time<?').bind(b.date,b.time,end).run();
    }
    await audit(env,actor,b.blocked?'block_slot':'unblock_slot',b.date+' '+b.time);
    return json({ok:true});
  }
  if (method==='GET' && path==='/admin/api/overview') {
    const [staff,services,hours]=await Promise.all([
      env.BOOKINGS_DB.prepare('SELECT id,display_name,active,sort_order FROM barbers ORDER BY sort_order,display_name').all(),
      env.BOOKINGS_DB.prepare('SELECT id,title,duration_minutes,buffer_minutes,active FROM services ORDER BY title').all(),
      env.BOOKINGS_DB.prepare('SELECT id,barber_id,weekday,starts_at,ends_at FROM working_hours ORDER BY weekday,starts_at').all()
    ]);
    return json({staff:staff.results,services:services.results,hours:hours.results});
  }
  if (method==='POST' && path==='/admin/api/staff') {
    const b=await body(request);
    if (!validId(b.id)||!stringField(b.display_name)||typeof b.active!=='boolean') return json({error:'Invalid staff details'},400);
    await env.BOOKINGS_DB.prepare('INSERT INTO barbers(id,display_name,active) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,active=excluded.active').bind(b.id,b.display_name.trim(),Number(b.active)).run();
    return json({ok:true});
  }
  if (method==='POST' && path==='/admin/api/services') {
    const b=await body(request);
    if (!validId(b.id)||!stringField(b.title)||!Number.isInteger(b.duration_minutes)||Number(b.duration_minutes)<5||Number(b.duration_minutes)>240||!Number.isInteger(b.buffer_minutes)||Number(b.buffer_minutes)<0||Number(b.buffer_minutes)>120||typeof b.active!=='boolean') return json({error:'Invalid service details'},400);
    await env.BOOKINGS_DB.prepare('INSERT INTO services(id,title,duration_minutes,buffer_minutes,active) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,duration_minutes=excluded.duration_minutes,buffer_minutes=excluded.buffer_minutes,active=excluded.active').bind(b.id,b.title.trim(),b.duration_minutes,b.buffer_minutes,Number(b.active)).run();
    return json({ok:true});
  }
  if (method==='POST' && path==='/admin/api/hours') {
    const b=await body(request);
    if (!validId(b.id)||!validId(b.barber_id)||!Number.isInteger(b.weekday)||Number(b.weekday)<0||Number(b.weekday)>6||!validTime(b.starts_at)||!validTime(b.ends_at)||b.starts_at>=b.ends_at) return json({error:'Invalid working hours'},400);
    await env.BOOKINGS_DB.prepare('INSERT INTO working_hours(id,barber_id,weekday,starts_at,ends_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET barber_id=excluded.barber_id,weekday=excluded.weekday,starts_at=excluded.starts_at,ends_at=excluded.ends_at').bind(b.id,b.barber_id,b.weekday,b.starts_at,b.ends_at).run();
    return json({ok:true});
  }
  if (method==='DELETE' && path.startsWith('/admin/api/hours/')) {
    const id=decodeURIComponent(path.slice('/admin/api/hours/'.length));
    if (!validId(id)) return json({error:'Invalid ID'},400);
    await env.BOOKINGS_DB.prepare('DELETE FROM working_hours WHERE id=?').bind(id).run();
    return json({ok:true});
  }
  return json({error:'Not found'},404);
}
export default {
 async fetch(request:Request, env:Env):Promise<Response> {
  const url=new URL(request.url);
  const isAdmin=url.pathname==='/admin'||url.pathname.startsWith('/admin/')||url.pathname.startsWith('/admin/api/');
  if (url.pathname==='/api/booking-config' && request.method==='GET') return json({previewOnly:PREVIEW_ONLY,emailEnabled:emailEnabled(env),turnstileSiteKey:emailEnabled(env)?env.TURNSTILE_SITE_KEY:null});
  if (url.pathname==='/api/slots' && request.method==='GET') {
    if(!env.BOOKINGS_DB)return json({slots:[]},503);
    try {return json({slots:(await getSlots(env,false)).map(({date,time})=>({date,time}))});}
    catch {return json({slots:[]},503);}
  }
  if(url.pathname==='/api/bookings' && request.method==='POST') {
    if(!env.BOOKINGS_DB)return json({error:'Bookings unavailable'},503);
    if(PREVIEW_ONLY)return json({previewOnly:true,error:'PREVIEW ONLY — appointments cannot be booked through this demonstration.'},409);
    try {
      if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return json({error:'Invalid request'},415);
      const input=await body(request);
      const name=typeof input.name==='string'?input.name.trim().replace(/\s+/g,' '):'';
      const date=input.date,time=input.time;
      const useEmail=emailEnabled(env);
      const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
      if(useEmail){
        if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({error:'Enter a valid email address'},400);
        if(typeof input.turnstile_token!=='string'||!(await verifyTurnstile(input.turnstile_token,request,env)))return json({error:'Please complete the booking security check and try again.'},403);
      }
      if(name.length<2||name.length>80||/[<>\x00-\x1f]/.test(name)||typeof date!=='string'||typeof time!=='string'||input.accepted_terms!==true) return json({error:'Enter your name and accept the arrival terms'},400);
      if(!(await getSlots(env,false)).some(x=>x.date===date&&x.time===time))return json({error:'This time is no longer available. Please choose another.'},409);
      // Unique (date,time) is enforced in D1 even under simultaneous requests.
      const result=await env.BOOKINGS_DB.prepare(`INSERT INTO simple_bookings(date,time,customer_name,customer_email) SELECT ?,?,?,? WHERE NOT EXISTS (
        SELECT 1 FROM blocked_slots WHERE date=? AND time>=? AND time<?
      )`).bind(date,time,name,useEmail?email:null,date,time,
        `${String(Math.floor((Number(time.slice(0,2))*60+Number(time.slice(3,5))+60)/60)).padStart(2,'0')}:${String((Number(time.slice(0,2))*60+Number(time.slice(3,5))+60)%60).padStart(2,'0')}`).run();
      if(!result.meta.changes)return json({error:'This time is no longer available'},409);
      // Log the appointment after the successful insert. Audit failures must not
      // cause the customer to retry a booking that already exists.
      try {await audit(env,'customer_booking','new_booking',date+' '+time);} catch (error) {
        console.error('Unable to record new-booking audit event',error);
      }
      let emailSent=false;
      if(useEmail){try{emailSent=await sendConfirmation(env,email,name,date,time);}catch{ /* Appointment remains booked; report email delivery acceptance accurately. */ }}
      return json({ok:true,date,time,emailSent});
    } catch {return json({error:'This time could not be booked. Refresh availability and try again.'},409);}
  }
  if (!isAdmin) return env.ASSETS.fetch(request);
  const actor=await verifyAdmin(request,env);
  if (!actor) return denied();
  if (url.pathname.startsWith('/admin/api/') && !['GET','HEAD','OPTIONS'].includes(request.method)) {
    const origin=request.headers.get('origin');
    const fetchSite=request.headers.get('sec-fetch-site');
    if ((origin&&origin!==url.origin)||(fetchSite&&fetchSite!=='same-origin'&&fetchSite!=='none'))return json({error:'Cross-site administration requests are not permitted.'},403);
  }
  if (url.pathname.startsWith('/admin/api/')) {
    if (!env.BOOKINGS_DB) return json({error:'Booking database not configured'},503);
    try {return await api(request,env,url,actor);}
    catch(e) {return json({error:'Unable to save changes. Check for duplicate IDs or invalid references.'},400);}
  }
  const assetPath=url.pathname==='/admin' ? '/admin/' : url.pathname;
  const assetUrl=new URL(request.url);assetUrl.pathname=assetPath;
  const response=await env.ASSETS.fetch(new Request(assetUrl,request));
  const headers=new Headers(response.headers);
  headers.set('Cache-Control','no-store, private');
  headers.set('X-Content-Type-Options','nosniff');
  headers.set('Referrer-Policy','no-referrer');
  headers.set('X-Frame-Options','DENY');
  headers.set('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 }
};
