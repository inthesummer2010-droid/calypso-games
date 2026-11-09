'use strict';
const crypto=require('node:crypto');
const CATEGORIES=Object.freeze(['accounts','oauth','mail','rooms','server','browser_runtime','browser_rejection']);
function createMonitor({now=Date.now}={}){
 const startedAt=now(),buckets=new Map(),rates=new Map(),salt=crypto.randomBytes(32);let totalRequests=0;
 function prune(){for(const [time]of buckets)if(time<=now()-86400000)buckets.delete(time);for(const [key,row]of rates)if(row.until<=now())rates.delete(key);}
 const cleanup=setInterval(prune,10000);cleanup.unref?.();
 function record(category){if(!CATEGORIES.includes(category))return false;prune();const time=Math.floor(now()/900000)*900000;let bucket=buckets.get(time);if(!bucket){bucket=Object.fromEntries(CATEGORIES.map(key=>[key,0]));buckets.set(time,bucket);}bucket[category]=Math.min(1000000,bucket[category]+1);return true;}
 function observe(req,res){totalRequests=Math.min(Number.MAX_SAFE_INTEGER,totalRequests+1);res.once('finish',()=>{if(res.statusCode<500)return;const path=String(req.url||'').split('?')[0];record(path.startsWith('/social/oauth/')?'oauth':path.startsWith('/social/')?'accounts':path.startsWith('/rooms/')?'rooms':'server');});}
 function snapshot(){prune();const rows=[...buckets].sort((a,b)=>a[0]-b[0]).map(([at,counts])=>({at,counts:{...counts}})),totals=Object.fromEntries(CATEGORIES.map(key=>[key,rows.reduce((n,row)=>n+row.counts[key],0)]));return {enabled:true,startedAt,checkedAt:now(),retentionHours:24,persistence:'process_memory',requestsSinceStart:totalRequests,totals,buckets:rows};}
 function allowReport(address){prune();const key=crypto.createHmac('sha256',salt).update(String(address)).digest('hex'),row=rates.get(key);if(row)return ++row.n<=5;if(rates.size>=2000)return false;rates.set(key,{n:1,until:now()+60000});return true;}
 return {record,observe,snapshot,allowReport,close(){clearInterval(cleanup);buckets.clear();rates.clear();salt.fill(0);}};
}
module.exports={createMonitor,CATEGORIES};
