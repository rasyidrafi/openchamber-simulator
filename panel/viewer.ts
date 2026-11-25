import {liveViewer} from './live';
type Request=(path:string,data?:object)=>Promise<any>;
export function mountViewer(request:Request,ready:()=>boolean,onFirstAttempt:()=>void,onFrame:(available:boolean)=>void){
  const box=document.createElement('section'),img=new Image(),notice=document.createElement('output');
  box.id='viewport';box.setAttribute('aria-label','Emulator viewport');img.alt='';img.draggable=false;img.tabIndex=0;img.setAttribute('aria-label','Emulator screen');box.append(img,notice);document.body.append(box);
  const canvas=document.createElement('canvas');canvas.hidden=true;canvas.tabIndex=0;canvas.setAttribute('aria-label','Live emulator screen');box.prepend(canvas);
  let seq=0,visible=true,retryAt=0,starting=0;let backlog=Promise.resolve();
  let disposed=false;const shown=()=>!disposed&&visible&&!box.hidden&&!document.hidden&&ready();const live=liveViewer(canvas,request,shown,t=>notice.textContent=t);
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting});observer.observe(box);
  async function poll(){let interval=1000;try{if(shown()){
    if(Date.now()>=retryAt){try{starting||=Date.now();const previous=live.epoch;const displayed=await live.poll();if(!shown())return;if(previous!==live.epoch)starting=Date.now();if(displayed){seq=0;img.hidden=true;onFrame(true);onFirstAttempt()}else if(Date.now()-starting>3500)throw Error('No video');interval=8;return}catch{live.reset();retryAt=Date.now()+30000;starting=0}}
    img.hidden=false;
    const f=await request('/viewer/frame');const next=new Image();next.src='data:image/png;base64,'+f.png;await next.decode();if(disposed)return;if(ready()){img.src=next.src;seq=f.seq;onFrame(true)}onFirstAttempt();
  }else{live.reset();starting=0;if(!ready()){img.removeAttribute('src');seq=0}}}
  catch{if(!disposed){seq=0;img.removeAttribute('src');notice.textContent='';onFrame(false);onFirstAttempt()}}finally{if(!disposed)setTimeout(poll,interval)}}void poll();
  function send(data:object,seen=seq){if(!seen)return;backlog=backlog.then(async()=>{try{await request('/viewer/input',{seq:seen,...data});notice.textContent=''}catch(e){notice.textContent=e instanceof Error?e.message:'Input failed'}})}
  function point(e:PointerEvent){const r=img.getBoundingClientRect();return [Math.min(img.naturalWidth-1,Math.max(0,Math.floor((e.clientX-r.left)*img.naturalWidth/r.width))),Math.min(img.naturalHeight-1,Math.max(0,Math.floor((e.clientY-r.top)*img.naturalHeight/r.height)))];}
  let gesture:{id:number,p:number[],time:number,seq:number}|undefined;
  img.onpointerdown=e=>{if(!seq||gesture||e.button!==0)return;img.focus();img.setPointerCapture(e.pointerId);gesture={id:e.pointerId,p:point(e),time:performance.now(),seq}};
  img.onpointercancel=()=>{gesture=undefined};img.onpointerup=e=>{if(!gesture||gesture.id!==e.pointerId)return;const g=gesture;gesture=undefined;const [x,y]=point(e),[x1,y1]=g.p,ms=Math.round(performance.now()-g.time);void send(Math.hypot(x-x1,y-y1)<10&&ms<500?{type:'tap',x,y}:{type:'swipe',x1,y1,x2:x,y2:y,duration:Math.max(100,Math.min(5000,ms))},g.seq)};
  const key=(key:string)=>live.key(key)||send({type:'key',key});img.onkeydown=e=>{if(!e.repeat&&['Escape','Enter'].includes(e.key)){e.preventDefault();void key(e.key==='Escape'?'BACK':'ENTER')}};return {key,box,dispose(){disposed=true;observer.disconnect();live.dispose();box.remove()}};
}
