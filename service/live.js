import WebSocket from 'ws';

// Only this service connects to the Hub. The panel sees video and input acknowledgements, never credentials.
export function liveBridge(){
  let socket,epoch='',width=0,height=0,frames=[],bytes=0,seq=0,last=0,next=0;
  const pending=new Map();let waiters=new Set();
  function wake(){for(const fn of waiters)fn();waiters.clear()}
  function close(){const old=socket;socket=undefined;frames=[];bytes=0;epoch='';for(const p of pending.values())p.reject(Error('Stream disconnected'));pending.clear();wake();old?.terminate()}
  function connect(url,token){if(socket)return;const u=new URL(url+'/live');u.protocol=u.protocol==='https:'?'wss:':'ws:';
    const ws=new WebSocket(u,{headers:{authorization:`Bearer ${token}`},followRedirects:false,handshakeTimeout:5000,maxPayload:1600000,perMessageDeflate:false});socket=ws;
    ws.on('error',()=>{if(socket===ws)close()});ws.on('close',()=>{if(socket===ws)close()});
    ws.on('message',(packet,binary)=>{if(socket!==ws)return;try{
      if(!binary){const a=JSON.parse(packet.toString());const p=pending.get(a.id);if(p){pending.delete(a.id);a.ok?p.resolve():p.reject(Error(a.error||'Input rejected'))}return}
      if(packet.length<=49)throw Error('Truncated video');const gen=packet.toString('ascii',0,36),key=packet[40]===1;
      if(gen!==epoch||key){frames=[];bytes=0}epoch=gen;width=packet.readUInt16BE(36);height=packet.readUInt16BE(38);
      if(!key&&!frames.length)return;bytes+=packet.length;if(bytes>1600000||frames.length>=240){frames=[];return}
      frames.push({seq:++seq,key,time:Number(packet.readBigUInt64BE(41)),data:packet.subarray(49).toString('base64')});wake();
    }catch{close()}});
  }
  setInterval(()=>{if(socket&&Date.now()-last>4000)close()},1000).unref();
  async function read(url,token,after,seen){last=Date.now();connect(url,token);const ws=socket;
    if(!frames.length||(seen===epoch&&after===seq))await new Promise(resolve=>{const done=()=>{clearTimeout(t);waiters.delete(done);resolve()};const t=setTimeout(done,100);waiters.add(done)});
    if(ws!==socket)throw Error('Live video unavailable');return {epoch,width,height,frames:seen===epoch?frames.filter(f=>f.seq>after):frames};}
  function touch(e){if(socket?.readyState!==WebSocket.OPEN||!epoch||e.epoch!==epoch||pending.size>=64)throw Error('Live input unavailable');const id=++next;
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('Input acknowledgement timed out'));close()},3000);pending.set(id,{resolve:()=>{clearTimeout(timer);resolve()},reject:e=>{clearTimeout(timer);reject(e)}});socket.send(JSON.stringify({...e,id}))});}
  return {read,touch,close};
}
