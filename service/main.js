import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const port = Number(process.env.OPENCHAMBER_SERVICE_PORT), serviceToken = process.env.OPENCHAMBER_SERVICE_TOKEN;
if (!port || !serviceToken) throw new Error('OpenChamber service environment missing');
const bindingFile=path.join(process.env.OPENCHAMBER_SERVICE_DATA_DIR || '.', 'hub-url.json');
let approvedUrl = await readFile(bindingFile,'utf8').then(JSON.parse).then(x=>x.url).catch(()=>null);
let config = { url: 'http://127.0.0.1:8787/v1', client: '', admin: '' };
async function readSettings() { const response=await fetch(`${process.env.OPENCHAMBER_HOST_CALLBACK_URL}/service/call`,{method:'POST',headers:{authorization:`Bearer ${serviceToken}`,'content-type':'application/json'},body:JSON.stringify({method:'settings.read',input:{}})}); if(!response.ok) throw Error('Cannot read OpenChamber integration settings'); return (await response.json()).result.settings; }
async function syncSettings() { const s=await readSettings(); const url=new URL(s['hub-url'] || 'http://127.0.0.1:8787/v1'); if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash) throw Error('Invalid Hub API URL in Settings → Integrations'); const next={url:url.href.replace(/\/$/,''),client:s['client-token']||'',admin:s['admin-token']||''}; if(JSON.stringify(next)!==JSON.stringify(config)){await release();frameGeneration++;config=next;frame=null;changedAt=frameSeq+1;} }
let viewerBusy=false, lease = null, controller = null, pointer = null, frameSeq = 0, frame = null, lastCapture = 0, capturePromise = null, frameGeneration = 0, changedAt = 1;
const json = (res, status, value) => { res.writeHead(status, {'content-type':'application/json','cache-control':'no-store'}); res.end(JSON.stringify(value)); };
const body = async req => { let data = ''; for await (const chunk of req) { data += chunk; if (data.length > 16384) throw Error('Request too large'); } return JSON.parse(data || '{}'); };
async function hub(path, {role='client', method='GET', data, leased=false} = {}) {
 if (config.url!==approvedUrl) throw Error('Approve the Hub URL in the simulator panel before connecting');
 const token = config[role]; if (!token) throw Error(`Set a ${role} token first`);
 const response = await fetch(config.url + '/' + path, {method, redirect:'error', signal:AbortSignal.timeout(12000), headers:{authorization:`Bearer ${token}`, ...(data ? {'content-type':'application/json'} : {}), ...(leased && lease ? {'x-lease-id':lease} : {})}, ...(data ? {body:JSON.stringify(data)} : {})});
 if (!response.ok) { if (leased && [401,403].includes(response.status)) lease = null; throw Error(`Simulator Hub ${response.status} (${path})`); }
 return response;
}
async function release() { if (!lease) return; try { await hub('lease',{method:'DELETE',leased:true}); } finally { lease = null; pointer = null; } }
async function acquire() { if (!lease) lease = (await (await hub('lease',{method:'POST'})).json()).id; }
async function input(data) { await acquire(); await hub('device/input',{method:'POST',data,leased:true}); }
async function capture() {
 if (capturePromise) return capturePromise;
 const generation=frameGeneration; capturePromise = (async () => { const elapsed = Date.now()-lastCapture; if (elapsed < 1000) await delay(1000-elapsed); lastCapture=Date.now(); await syncSettings(); const r = await hub('device/screenshot'); const bytes = Buffer.from(await r.arrayBuffer()); if (bytes.length < 24 || bytes.readUInt32BE(0)!==0x89504e47) throw Error('Invalid screenshot'); if(generation!==frameGeneration) throw Error('Connection changed'); const width=bytes.readUInt32BE(16), height=bytes.readUInt32BE(20); if (frame && (frame.width!==width || frame.height!==height)) changedAt=frameSeq+1; frame = {bytes,width,height,seq:++frameSeq}; lastCapture=Date.now(); return frame; })().finally(()=>{capturePromise=null;}); return capturePromise;
}
setInterval(()=>{ if (lease && controller) void hub('lease',{method:'PUT',leased:true}).catch(()=>{lease=null;}); }, 15000).unref();
async function handle(req,res) {
 if (req.headers.authorization !== `Bearer ${serviceToken}`) return json(res,401,{error:'Unauthorized'});
 const u = new URL(req.url,'http://localhost'), path=u.pathname;
 if (path==='/health') return json(res,200,{ok:true});
 if (path==='/viewer/frame' && req.method==='GET') { const f=await capture(); if(f.bytes.length>5900000) throw Error('Screenshot exceeds panel transport limit'); return json(res,200,{seq:f.seq,png:f.bytes.toString('base64')}); }
 if (!path.startsWith('/surface/')) await syncSettings();
 if(path==='/viewer/input' && req.method==='POST') {
   const x=await body(req), f=frame;
   if(!f||!Number.isInteger(x.seq)||x.seq<changedAt||x.seq>f.seq)return json(res,409,{error:'Device changed; wait for a new frame'});
   const point=(a,b)=>Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&a<f.width&&b>=0&&b<f.height;
   let data;
   if(x.type==='tap'&&point(x.x,x.y))data={type:'tap',x:x.x,y:x.y};
   else if(x.type==='swipe'&&point(x.x1,x.y1)&&point(x.x2,x.y2)&&Number.isInteger(x.duration)&&x.duration>=100&&x.duration<=5000)data={type:'swipe',x1:x.x1,y1:x.y1,x2:x.x2,y2:x.y2,duration:x.duration};
   else if(x.type==='key'&&['BACK','HOME','ENTER'].includes(x.key))data={type:'key',key:x.key};
   else return json(res,400,{error:'Invalid device input'});
   if(viewerBusy)return json(res,409,{error:'Device input is busy'});viewerBusy=true;
   try{await input(data)}finally{try{await release()}finally{viewerBusy=false}}return json(res,200,{ok:true});
 }
 if (path==='/state') { let devices=[], clientError=null, admin=false; if(config.client) try { devices=(await (await hub('devices')).json()).devices; } catch(e) {clientError=e.message;} if(config.admin) try { admin=(await (await hub('me',{role:'admin'})).json()).role==='admin'; } catch {} return json(res,200,{url:config.url,hasClient:!!config.client,hasAdmin:!!config.admin,admin,devices,clientError,leased:!!lease,urlApproved:config.url===approvedUrl}); }
 if (path==='/action' && req.method==='POST') { const x=await body(req); if (x.action==='approve-url') { const target=x.url; if(typeof target!=='string'||target!==config.url) throw Error('Hub URL changed; review it again before approving'); await writeFile(bindingFile,JSON.stringify({url:target}),{mode:0o600}); approvedUrl=target; } else if (x.action==='release') await release();  else if (['HOME','BACK','ENTER'].includes(x.action)) { if(req.headers['x-surface-viewer-controls']!=='1') throw Error('Click the simulator to take control first'); await input({type:'key',key:x.action}); } else if (['start','stop'].includes(x.action)) { await hub(`device/${x.action}`,{role:'admin',method:'POST'}); } else if(x.action==='force-release') { await hub('lease',{role:'admin',method:'DELETE'}); lease=null; } else if(x.action==='tokens') return json(res,200,await (await hub('tokens',{role:'admin'})).json()); else if(x.action==='revoke-token') { if(!/^[\w-]+$/.test(x.id)) throw Error('Invalid token ID'); await hub(`tokens/${x.id}`,{role:'admin',method:'DELETE'}); } else throw Error('Unknown action'); return json(res,200,{ok:true}); }
 if (path==='/surface/frame' && req.method==='GET') { try { const f=await capture(); res.writeHead(200,{'content-type':'image/png','x-surface-seq':String(f.seq),'x-surface-width':String(f.width),'x-surface-height':String(f.height),'x-surface-title':'Android simulator'}); return res.end(f.bytes); } catch { res.writeHead(204); return res.end(); } }
 if (path==='/surface/control' && req.method==='POST') { const x=await body(req); controller=x.controller==='user'?x.viewer:null; if (!controller) await release(); res.writeHead(204); return res.end(); }
 if (path==='/surface/input' && req.method==='POST') { const x=await body(req); if (!controller || req.headers['x-surface-viewer']!==controller || !Array.isArray(x.events)) return json(res,403,{error:'Control required'}); const seen=Number(req.headers['x-surface-frame-seq']); if (!frame || !Number.isInteger(seen) || seen<changedAt || seen>frame.seq) return json(res,409,{error:'The simulator view changed; try again on the current frame'}); for (const e of x.events) { if(e.type==='pointer' && e.action==='down') pointer={x:Math.round(e.x),y:Math.round(e.y),at:Date.now()}; else if(e.type==='pointer' && e.action==='up' && pointer) { const p=pointer; pointer=null; const x2=Math.round(e.x), y2=Math.round(e.y); if(Math.hypot(x2-p.x,y2-p.y)<10 && Date.now()-p.at<500) await input({type:'tap',x:p.x,y:p.y}); else await input({type:'swipe',x1:p.x,y1:p.y,x2,y2,duration:Math.max(100,Math.min(5000,Date.now()-p.at))}); } else if(e.type==='key' && e.action==='down' && ['Enter','Escape'].includes(e.key)) { const key={Enter:'ENTER',Escape:'BACK'}[e.key]; await input({type:'key',key}); } } res.writeHead(204); return res.end(); }
 if (path==='/surface/resize') return json(res,400,{error:'Device size is fixed'});
 if (path==='/surface/clipboard') return json(res,200,{text:''});
 return json(res,404,{error:'Not found'});
}
http.createServer((req,res)=>{handle(req,res).catch(e=>{if(!res.headersSent) json(res,400,{error:e.message}); else res.destroy();});}).listen(port,'127.0.0.1');
