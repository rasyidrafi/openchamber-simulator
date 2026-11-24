import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocketServer} from 'ws';
import {liveBridge} from '../service/live-bundle.js';
import https from 'node:https';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);

test('packaged service uses authenticated binary WS, shares frames, orders input acknowledgement, drops on close',async t=>{
  const server=new WebSocketServer({port:0,host:'127.0.0.1'});await once(server,'listening');const bridge=liveBridge();t.after(()=>{bridge.close();server.close()});
  const url=`http://127.0.0.1:${server.address().port}/v1`,epoch='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const connected=once(server,'connection');const reading=bridge.read(url,'operator',0,'');const [ws,req]=await connected;
  assert.equal(req.headers.authorization,'Bearer operator');assert.equal(req.url,'/v1/live');
  function send(key,time){const b=Buffer.alloc(53);b.write(epoch);b.writeUInt16BE(720,36);b.writeUInt16BE(1280,38);b[40]=+key;b.writeBigUInt64BE(BigInt(time),41);b.fill(1,49);ws.send(b)}
  send(true,1234);const first=await reading;assert.equal(first.frames[0].time,1234);assert.equal(first.epoch,epoch);assert.equal(first.width,720);
  const next=bridge.read(url,'operator',first.frames[0].seq,epoch);send(false,2345);assert.equal((await next).frames[0].time,2345);
  const event=once(ws,'message');const ack=bridge.touch({epoch,type:'down'});const [raw]=await event;ws.send(JSON.stringify({ok:true,id:JSON.parse(raw).id}));await ack;
  const closed=once(ws,'close');bridge.close();await closed;assert.throws(()=>bridge.touch({epoch,type:'up'}));
});

test('approved https URL uses a certificate-validated WSS upgrade with its path prefix',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'sim-wss-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const crt=join(dir,'localhost.crt'),key=join(dir,'localhost.key');
  await exec('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1','-keyout',key,'-out',crt]);
  const tls=https.createServer({cert:await readFile(crt),key:await readFile(key)});const wss=new WebSocketServer({server:tls});t.after(()=>{wss.close();tls.close()});
  tls.listen(0,'127.0.0.1');await once(tls,'listening');let accepted=0;
  wss.on('connection',(ws,req)=>{accepted++;assert.equal(req.url,'/android/v1/live');assert.equal(req.headers.authorization,'Bearer fixture');const p=Buffer.alloc(54);p.write('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');p[40]=1;ws.send(p)});
  const src=`import {liveBridge} from './service/live-bundle.js';const b=liveBridge();try{const r=await b.read('https://127.0.0.1:${tls.address().port}/android/v1','fixture',0,'');if(!r.frames.length)throw Error('No video')}finally{b.close()}`;
  await assert.rejects(exec(process.execPath,['--input-type=module','-e',src]));assert.equal(accepted,0);
  await exec(process.execPath,['--input-type=module','-e',src],{env:{...process.env,NODE_EXTRA_CA_CERTS:crt}});assert.equal(accepted,1);
});
