type Request=(path:string,data?:object)=>Promise<any>;
export function mountViewer(request:Request,ready:()=>boolean,onFirstAttempt:()=>void,onFrame:(available:boolean)=>void){
  const box=document.createElement('section'),img=new Image(),notice=document.createElement('output');
  box.id='viewport';box.setAttribute('aria-label','Emulator viewport');img.alt='';img.draggable=false;img.tabIndex=0;img.setAttribute('aria-label','Emulator screen');box.append(img,notice);document.body.append(box);
  let seq=0,visible=true,busy=false;
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting}).observe(box);
  async function poll(){try{if(visible&&!document.hidden&&ready()){
    const f=await request('/viewer/frame');const next=new Image();next.src='data:image/png;base64,'+f.png;await next.decode();if(ready()){img.src=next.src;seq=f.seq;onFrame(true)}onFirstAttempt();
  }else if(!ready()){img.removeAttribute('src');seq=0}}
  catch{seq=0;img.removeAttribute('src');notice.textContent='';onFrame(false);onFirstAttempt()}finally{setTimeout(poll,1000)}}void poll();
  async function send(data:object,seen=seq){if(!seen||busy)return;busy=true;try{await request('/viewer/input',{seq:seen,...data});notice.textContent=''}catch(e){notice.textContent=e instanceof Error?e.message:'Input failed'}finally{busy=false}}
  function point(e:PointerEvent){const r=img.getBoundingClientRect();return [Math.min(img.naturalWidth-1,Math.max(0,Math.floor((e.clientX-r.left)*img.naturalWidth/r.width))),Math.min(img.naturalHeight-1,Math.max(0,Math.floor((e.clientY-r.top)*img.naturalHeight/r.height)))];}
  let gesture:{id:number,p:number[],time:number,seq:number}|undefined;
  img.onpointerdown=e=>{if(!seq||gesture||e.button!==0)return;img.focus();img.setPointerCapture(e.pointerId);gesture={id:e.pointerId,p:point(e),time:performance.now(),seq}};
  img.onpointercancel=()=>{gesture=undefined};img.onpointerup=e=>{if(!gesture||gesture.id!==e.pointerId)return;const g=gesture;gesture=undefined;const [x,y]=point(e),[x1,y1]=g.p,ms=Math.round(performance.now()-g.time);void send(Math.hypot(x-x1,y-y1)<10&&ms<500?{type:'tap',x,y}:{type:'swipe',x1,y1,x2:x,y2:y,duration:Math.max(100,Math.min(5000,ms))},g.seq)};
  const key=(key:string)=>send({type:'key',key});img.onkeydown=e=>{if(!e.repeat&&['Escape','Enter'].includes(e.key)){e.preventDefault();void key(e.key==='Escape'?'BACK':'ENTER')}};return key;
}
