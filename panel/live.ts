type Request=(path:string,data?:object)=>Promise<any>;
type EventData={type:string,gesture:string,epoch:string,x?:number,y?:number,key?:string};
export function liveViewer(canvas:HTMLCanvasElement,request:Request,shown:()=>boolean,notify:(text:string)=>void){
  let epoch='',drawn='',seq=0,decoder:VideoDecoder|undefined,failed=false,lastOutput=0;
  const ctx=canvas.getContext('2d');let contact:{id:number,event:EventData}|undefined;
  const queue:EventData[]=[];let sending=false;
  function enqueue(e:EventData){const tail=queue.at(-1);if(e.type==='move'&&tail?.type==='move'&&tail.gesture===e.gesture)queue[queue.length-1]=e;else queue.push(e);
    if(!sending)void drain()}
  async function drain(){sending=true;try{while(queue.length){const e=queue.shift()!;try{await request('/viewer/touch',e)}catch(err){notify(err instanceof Error?err.message:'Input failed');for(let i=queue.length-1;i>=0;i--)if(queue[i].gesture===e.gesture)queue.splice(i,1);if(contact?.event.gesture===e.gesture)contact=undefined}}}finally{sending=false}}
  function cancel(){if(contact){enqueue({...contact.event,type:'cancel'});contact=undefined}}
  setInterval(()=>{if(contact&&shown()&&!sending&&!queue.length)enqueue({...contact.event,type:'hold'})},1500);
  function reset(){cancel();if(decoder&&decoder.state!=='closed')decoder.close();decoder=undefined;epoch=drawn='';seq=0;canvas.hidden=true;failed=false;lastOutput=0}
  function xy(e:PointerEvent){const r=canvas.getBoundingClientRect();return {x:Math.min(canvas.width-1,Math.max(0,Math.floor((e.clientX-r.left)*canvas.width/r.width))),y:Math.min(canvas.height-1,Math.max(0,Math.floor((e.clientY-r.top)*canvas.height/r.height)))}}
  canvas.onpointerdown=e=>{if(contact||!drawn||e.button!==0)return;canvas.focus();canvas.setPointerCapture(e.pointerId);const event={type:'down',gesture:crypto.randomUUID(),epoch:drawn,...xy(e)};contact={id:e.pointerId,event};enqueue(event)};
  canvas.onpointermove=e=>{if(contact?.id!==e.pointerId)return;contact.event={...contact.event,type:'move',...xy(e)};enqueue(contact.event)};
  canvas.onpointerup=e=>{if(contact?.id!==e.pointerId)return;enqueue({...contact.event,type:'up',...xy(e)});contact=undefined};canvas.onlostpointercapture=cancel;canvas.onpointercancel=cancel;window.addEventListener('blur',cancel);
  function key(key:string){if(!drawn||canvas.hidden)return false;enqueue({type:'key',key,gesture:crypto.randomUUID(),epoch:drawn});return true}
  canvas.onkeydown=e=>{if(!e.repeat&&['Escape','Enter'].includes(e.key)){e.preventDefault();key(e.key==='Escape'?'BACK':'ENTER')}};
  async function poll(){
    if(!ctx||typeof VideoDecoder==='undefined'||!isSecureContext||failed)throw Error('Live decoder unavailable');
    const b=await request(`/viewer/live?after=${seq}&epoch=${encodeURIComponent(epoch)}`);if(!shown())return false;
    if(b.epoch!==epoch){reset();epoch=b.epoch}
    for(const f of b.frames){const bytes=Uint8Array.from(atob(f.data),c=>c.charCodeAt(0));
      if(!decoder){if(!f.key)continue;let codec='';for(let i=0;i+6<bytes.length;i++)if(bytes[i]===0&&bytes[i+1]===0&&bytes[i+2]===1&&(bytes[i+3]&31)===7){codec='avc1.'+Array.from(bytes.slice(i+4,i+7),n=>n.toString(16).padStart(2,'0')).join('');break}if(!codec)throw Error('Missing H.264 configuration');
        const gen=epoch;decoder=new VideoDecoder({output(frame){try{if(gen!==epoch||!shown())return;if(canvas.width!==frame.displayWidth||canvas.height!==frame.displayHeight){canvas.width=frame.displayWidth;canvas.height=frame.displayHeight}ctx!.drawImage(frame,0,0);drawn=gen;lastOutput=performance.now();canvas.hidden=false}finally{frame.close()}},error(){failed=true}});decoder.configure({codec,optimizeForLatency:true});}
      if(decoder.decodeQueueSize>60)throw Error('Live decoder overloaded');decoder.decode(new EncodedVideoChunk({type:f.key?'key':'delta',timestamp:f.time,data:bytes}));seq=f.seq;
    }return !!lastOutput;
  }
  return {poll,reset,key,cancel,get epoch(){return epoch}};
}
