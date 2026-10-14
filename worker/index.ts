import { createRemoteJWKSet, jwtVerify } from 'jose';

interface Env {
  ASSETS: Fetcher;
  BOOKINGS_DB: D1Database;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_EMAILS?: string;
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});
const denied = () => json({error:'Administrator access is not configured or authorised.'},403);
const validId = (s:unknown):s is string => typeof s==='string' && /^[a-z0-9][a-z0-9_-]{1,63}$/.test(s);
const validTime = (s:unknown):s is string => typeof s==='string' && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(s);
const stringField = (s:unknown,max=80):s is string => typeof s==='string' && s.trim().length>0 && s.trim().length<=max;
async function verifyAdmin(request:Request, env:Env):Promise<boolean> {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAILS) return false;
  const allowed=env.ADMIN_EMAILS.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) return false;
  const token=request.headers.get('cf-access-jwt-assertion');
  if (!token) return false;
  try {
    const issuer=env.ACCESS_TEAM_DOMAIN.replace(/\/$/,'');
    if (!/^https:\/\/[^/]+\.cloudflareaccess\.com$/.test(issuer)) return false;
    const jwks=createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs'));
    const {payload}=await jwtVerify(token,jwks,{issuer,audience:env.ACCESS_AUD});
    return typeof payload.email==='string' && allowed.includes(payload.email.toLowerCase());
  } catch { return false; }
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
    for(let minute=toMin(start);minute+30<=toMin(end);minute+=30){
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
  const r=await env.BOOKINGS_DB.prepare('SELECT date,time FROM blocked_slots WHERE date>=? AND date<=?').bind(date,end).all();
  const blocked=new Set((r.results as {date:string;time:string}[]).map(x=>x.date+'|'+x.time));
  return all.filter(x=>includeBlocked||!blocked.has(x.date+'|'+x.time)).map(x=>({...x,blocked:blocked.has(x.date+'|'+x.time)}));
}

async function api(request:Request,env:Env,url:URL):Promise<Response> {
  const path=url.pathname,method=request.method;
  if (method==='GET' && path==='/admin/api/slots') return json({slots:await getSlots(env,true)});
  if (method==='POST' && path==='/admin/api/slots') {
    const b=await body(request);
    if (typeof b.date!=='string'||typeof b.time!=='string'||typeof b.blocked!=='boolean') return json({error:'Invalid time slot'},400);
    const allowed=(await getSlots(env,true)).some(x=>x.date===b.date&&x.time===b.time);
    if(!allowed) return json({error:'This time is outside the upcoming opening hours'},400);
    if(b.blocked) await env.BOOKINGS_DB.prepare('INSERT OR IGNORE INTO blocked_slots(date,time) VALUES (?,?)').bind(b.date,b.time).run();
    else await env.BOOKINGS_DB.prepare('DELETE FROM blocked_slots WHERE date=? AND time=?').bind(b.date,b.time).run();
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
  if (url.pathname==='/api/slots' && request.method==='GET') {
    if(!env.BOOKINGS_DB)return json({slots:[]},503);
    try {return json({slots:(await getSlots(env,false)).map(({date,time})=>({date,time}))});}
    catch {return json({slots:[]},503);}
  }
  if (!isAdmin) return env.ASSETS.fetch(request);
  if (!await verifyAdmin(request,env)) return denied();
  if (url.pathname.startsWith('/admin/api/')) {
    if (!env.BOOKINGS_DB) return json({error:'Booking database not configured'},503);
    try {return await api(request,env,url);}
    catch(e) {return json({error:'Unable to save changes. Check for duplicate IDs or invalid references.'},400);}
  }
  const assetPath=url.pathname==='/admin' ? '/admin/' : url.pathname;
  const assetUrl=new URL(request.url);assetUrl.pathname=assetPath;
  return env.ASSETS.fetch(new Request(assetUrl,request));
 }
};
