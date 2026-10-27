const SB='https://cplpzqijglqrtnfrepsu.supabase.co';
const KEY=process.env.SUPABASE_ANON_KEY||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwbHB6cWlqZ2xxcnRuZnJlcHN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NDE2NDMsImV4cCI6MjA5NDUxNzY0M30.sbvDH-1SmWqURDKCP0eYEvGUmoopwVIIrEu3gqHyvWk';
const HSH='https://apicheckpricev3.huasengheng.com/api/values/getprice/';
const out=(res,status,data)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');return res.status(status).json(data)};
export default async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return out(res,405,{ok:false})}
 const cron=req.query?.cron==='1'||req.headers['x-vercel-cron']==='1';
 if(cron){
  const secret=process.env.CRON_SECRET;
  if(!secret||req.headers.authorization!=='Bearer '+secret)return out(res,401,{ok:false,error:'Unauthorized'});
  try{
   const upstream=await fetch(HSH,{headers:{Accept:'application/json','User-Agent':'GoldMark/1.0'}});
   if(!upstream.ok)throw Error('upstream '+upstream.status);
   const list=await upstream.json();
   const d=Array.isArray(list)?list.find(x=>x.GoldType==='REF'&&x.GoldCode==='96.50'):null;
   if(!d)throw Error('reference price missing');
   const num=v=>Number(String(v??'').replace(/,/g,'').trim());
   const buy=num(d.Buy),sell=num(d.Sell);
   if(!Number.isFinite(buy)||!Number.isFinite(sell)||buy<=0||sell<=0)throw Error('invalid price');
   const row={id:1,buy,sell,buy_change:Number(d.BuyChange)||0,sell_change:Number(d.SellChange)||0,str_time:String(d.StrTimeUpdate||''),updated_at:new Date().toISOString()};
   const save=await fetch(SB+'/rest/v1/gold_prices?on_conflict=id',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)});
   if(!save.ok)throw Error('cache write '+save.status);
   return out(res,200,{ok:true,updated_at:row.updated_at,str_time:row.str_time});
  }catch(e){console.error('GoldMark refresh failed',e.message);return out(res,502,{ok:false,error:'Refresh failed; previous cache retained'})}
 }
 try{
  const read=async()=>{const q=await fetch(SB+'/rest/v1/gold_prices?id=eq.1&select=*',{headers:{apikey:KEY,Authorization:'Bearer '+KEY}});if(!q.ok)throw Error('cache read '+q.status);const rows=await q.json();return rows[0]||null};
  let r=await read();
  let age=r?Date.now()-new Date(r.updated_at).getTime():Infinity;
  // Active clients may request a refresh, but only the central endpoint contacts HSH.
  // Jitter and re-check the shared timestamp to collapse most simultaneous requests.
  if(req.query?.refresh==='1'&&(!r||!Number.isFinite(age)||age>55000)){
   await new Promise(resolve=>setTimeout(resolve,Math.floor(Math.random()*6500)));
   r=await read();age=r?Date.now()-new Date(r.updated_at).getTime():Infinity;
   if(!r||!Number.isFinite(age)||age>55000){
    const upstream=await fetch(HSH,{headers:{Accept:'application/json','User-Agent':'GoldMark/1.0'}});
    if(!upstream.ok)throw Error('upstream '+upstream.status);
    const list=await upstream.json(),d=Array.isArray(list)?list.find(x=>x.GoldType==='REF'&&x.GoldCode==='96.50'):null;
    if(!d)throw Error('reference price missing');
    const num=v=>Number(String(v??'').replace(/,/g,'').trim()),buy=num(d.Buy),sell=num(d.Sell);
    if(!Number.isFinite(buy)||!Number.isFinite(sell)||buy<=0||sell<=0)throw Error('invalid price');
    const row={id:1,buy,sell,buy_change:Number(d.BuyChange)||0,sell_change:Number(d.SellChange)||0,str_time:String(d.StrTimeUpdate||''),updated_at:new Date().toISOString()};
    const saved=await fetch(SB+'/rest/v1/gold_prices?on_conflict=id',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)});
    if(!saved.ok)throw Error('cache write '+saved.status);
    r=row;age=0;
   }
  }
  if(!r)return out(res,503,{ok:false,status:'missing'});
  age=Date.now()-new Date(r.updated_at).getTime();
  const fresh=Number.isFinite(age)&&age>=0&&age<=95000;
  return out(res,fresh?200:503,{ok:fresh,status:fresh?'ok':'stale',price:{buy:Number(r.buy),sell:Number(r.sell),buy_change:Number(r.buy_change||0),sell_change:Number(r.sell_change||0),str_time:r.str_time||''},updated_at:r.updated_at,age_ms:age});
 }catch(e){console.error('GoldMark price refresh/read failed',e.message);return out(res,503,{ok:false,status:'error',error:'Shared price cache unavailable',detail:String(e.message||e).slice(0,180)})}
}
