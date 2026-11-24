import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

test('adapter authorizes, displays screenshots, and coordinates a lease', async t => {
 const calls=[]; const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
 const hub=http.createServer(async(req,res)=>{let b='';for await(const c of req)b+=c;calls.push({url:req.url,method:req.method,lease:req.headers['x-lease-id'],body:b&&JSON.parse(b)});if(req.url==='/v1/device/screenshot'){res.writeHead(200,{'content-type':'image/png'});return res.end(png);}res.setHeader('content-type','application/json');if(req.url==='/v1/devices') return res.end(JSON.stringify({devices:[{name:'Test',status:'ready'}]}));if(req.url==='/v1/me')return res.end(JSON.stringify({role:'admin'}));if(req.url==='/v1/lease'&&req.method==='POST')return res.end(JSON.stringify({id:'lease1'}));res.end('{}');});
 hub.listen(0,'127.0.0.1');await once(hub,'listening');t.after(()=>hub.close());
 let hubUrl=`http://127.0.0.1:${hub.address().port}/v1`;const callback=http.createServer(async(req,res)=>{for await (const _ of req) {} res.setHeader('content-type','application/json');res.end(JSON.stringify({result:{settings:{'hub-url':hubUrl,'client-token':'client','admin-token':'admin'}}}));}); callback.listen(0,'127.0.0.1');await once(callback,'listening');t.after(()=>callback.close());
 const probe=http.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
 const dir=await mkdtemp(path.join(os.tmpdir(),'sim-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const child=spawn(process.execPath,['service/main.js'],{env:{...process.env,OPENCHAMBER_SERVICE_PORT:String(port),OPENCHAMBER_SERVICE_TOKEN:'service',OPENCHAMBER_HOST_CALLBACK_URL:`http://127.0.0.1:${callback.address().port}`,OPENCHAMBER_SERVICE_DATA_DIR:dir},stdio:'ignore'});t.after(()=>child.kill());
 const base=`http://127.0.0.1:${port}`;let response;for(let i=0;i<40;i++){try{response=await fetch(base+'/health',{headers:{authorization:'Bearer service'}});break;}catch{await delay(50)}}assert.equal(response.status,200);
 assert.equal((await fetch(base+'/state')).status,401);
 const auth={authorization:'Bearer service','content-type':'application/json'}; const wrong=await fetch(base+'/action',{method:'POST',headers:auth,body:JSON.stringify({action:'approve-url',url:'https://old.example/v1'})});assert.equal(wrong.status,400);assert.equal(calls.length,0);await fetch(base+'/action',{method:'POST',headers:auth,body:JSON.stringify({action:'approve-url',url:`http://127.0.0.1:${hub.address().port}/v1`})});const state=await (await fetch(base+'/state',{headers:auth})).json();assert.equal(state.admin,true);assert.equal(state.devices[0].name,'Test');assert.equal(JSON.stringify(state).includes('client'),true);assert.equal(JSON.stringify(state).includes('Bearer'),false);
 const picture=await fetch(base+'/surface/frame?after=0',{headers:auth});assert.equal(picture.headers.get('x-surface-width'),'1');assert.equal(picture.status,200);
 await fetch(base+'/surface/control',{method:'POST',headers:auth,body:JSON.stringify({controller:'user',viewer:'v1'})});
 const r=await fetch(base+'/surface/input',{method:'POST',headers:{...auth,'x-surface-viewer':'v1','x-surface-frame-seq':'1'},body:JSON.stringify({events:[{type:'pointer',action:'down',x:0,y:0},{type:'pointer',action:'up',x:0,y:0}]})});assert.equal(r.status,204);assert.deepEqual(calls.find(x=>x.url==='/v1/device/input').body,{type:'tap',x:0,y:0});assert.equal(calls.find(x=>x.url==='/v1/device/input').lease,'lease1');
 await fetch(base+'/surface/control',{method:'POST',headers:auth,body:JSON.stringify({controller:'none'})});assert.ok(calls.some(x=>x.url==='/v1/lease'&&x.method==='DELETE'));
 const own=await (await fetch(base+'/viewer/frame',{headers:auth})).json();assert.deepEqual(Buffer.from(own.png,'base64'),png);const tap=(x,seq)=>fetch(base+'/viewer/input',{method:'POST',headers:auth,body:JSON.stringify({type:'tap',seq,x,y:0})});assert.equal((await tap(1,own.seq)).status,400);assert.equal((await tap(0,own.seq+1)).status,409);assert.equal((await tap(0,own.seq)).status,200);assert.deepEqual(calls.slice(-3).map(c=>[c.method,c.url]),[['POST','/v1/lease'],['POST','/v1/device/input'],['DELETE','/v1/lease']]);
 const old=hubUrl;hubUrl=`http://localhost:${hub.address().port}/v1`;const count=calls.length;const stale=await fetch(base+'/action',{method:'POST',headers:auth,body:JSON.stringify({action:'approve-url',url:old})});assert.equal(stale.status,400);await fetch(base+'/state',{headers:auth});assert.equal(calls.length,count);
});
