export type State={url:string,urlApproved:boolean,hasClient:boolean,admin:boolean,devices:{id?:string,name:string,status:string,control?:string}[],clientError:string|null};
type Token={id:string,name:string};

export function settingsPage(page:HTMLElement,heading:HTMLElement,get:()=>State|undefined,action:(name:string,data?:object)=>Promise<any>,refresh:()=>Promise<void>){
  let view:'home'|'connection'|'tokens'='home',list:Token[]|undefined, generation=0, busy=false,error='', signature='';
  let pending:{message:string,label:string,name:string,data?:object}|undefined;
  const el=(tag:string,text='')=>{const e=document.createElement(tag);e.textContent=text;return e};
  function btn(text:string,run:()=>void,disabled=false){const b=document.createElement('button');b.textContent=text;b.disabled=busy||disabled;b.onclick=run;return b}
  function row(label:string,value:string|HTMLElement,parent=page){const r=el('div');r.className='setting-row';r.append(el('span',label),typeof value==='string'?el('span',value):value);parent.append(r)}
  function navigate(next:typeof view){view=next;pending=undefined;error='';page.scrollTop=0;render();if(next==='tokens')void loadTokens()}
  async function loadTokens(){const id=++generation;try{const result=await action('tokens');if(id===generation&&get()?.admin){list=result.tokens||[];render()}}catch(e){if(id===generation){error=String((e as Error).message);render()}}}
  async function execute(name:string,data?:object){if(busy)return;busy=true;pending=undefined;error='';render();try{await action(name,data);await refresh();if(name==='revoke-token'&&get()?.admin)await loadTokens()}catch(e){error=(e as Error).message;await refresh()}finally{busy=false;render()}}
  const dialog=document.createElement('dialog');dialog.className='sim-confirm';dialog.setAttribute('aria-labelledby','confirm-title');dialog.setAttribute('aria-describedby','confirm-message');document.body.append(dialog);
  function dismiss(){pending=undefined;if(dialog.open)dialog.close()}
  dialog.oncancel=e=>{e.preventDefault();dismiss()};
  dialog.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismiss()}};
  function confirm(message:string,label:string,name:string,data?:object){
    pending={message,label,name,data};const title=el('h2',label+'?');title.id='confirm-title';const description=el('p',message);description.id='confirm-message';
    const close=btn('',dismiss);close.className='dialog-close';close.setAttribute('aria-label','Close dialog');close.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    const cancel=btn('Cancel',dismiss);cancel.autofocus=true;const accept=btn(label,()=>{if(!pending)return;dismiss();void execute(name,data)});accept.className=name==='approve-url'?'':'danger';const footer=el('footer');footer.append(cancel,accept);dialog.replaceChildren(title,close,description,footer);dialog.showModal();cancel.focus();
  }
  function render(){const s=get(),d=s?.devices[0];if(!s?.admin){list=undefined;if(view==='tokens')view='home';if(pending?.name!=='approve-url')pending=undefined}if(pending?.name==='approve-url'&&pending.data&&'url' in pending.data&&pending.data.url!==s?.url)pending=undefined;
    heading.textContent={home:'Settings',connection:'Connection details',tokens:'Client tokens'}[view];page.replaceChildren();
    if(view==='home'){
      const layout=el('div');layout.className='settings-overview';page.append(layout);
      const client=el('section');client.append(el('h2','Client'));layout.append(client);
      const device=el('strong',d?.name||'No device available');device.className='device-name';client.append(device);
      const status=d?({ready:'Ready',booting:'Booting',stopped:'Stopped'}[d.status]||d.status):'Unavailable';
      const control=d?.control==='free'?'Control free':d?.control==='in_use'?'Control in use':'Control unknown';
      client.append(el('p',`${status} · ${control}`),btn('Connection details',()=>navigate('connection')));
      if(s?.admin){const admin=el('section');layout.append(admin);admin.append(el('h2','Admin'));const stopped=d?.status==='stopped';row('Emulator',btn(stopped?'Start':'Stop',()=>stopped?void execute('start'):confirm('This interrupts the current emulator session.','Stop emulator','stop'),!d),admin);row('Control lease',btn('Force release',()=>confirm('The current lease holder will lose control.','Release lease','force-release'),d?.control!=='in_use'),admin);row('Client tokens',btn('Manage',()=>navigate('tokens')),admin)}
    }else if(view==='connection'){
      page.append(el('h2','Simulator Hub'));row('API URL',s?.url||'Unavailable');row('Destination',s?.urlApproved?'Approved':'Not approved');row('Client token',s?.hasClient?'Configured':'Not configured');if(s&&!s.urlApproved){const target=s.url;page.append(btn('Review URL',()=>confirm(`Send configured credentials to ${target}?`,'Approve connection','approve-url',{url:target})))}
      page.append(el('p','Manage the URL and credentials in OpenChamber Settings → Integrations → Simulator Hub.'));if(s?.clientError&&s.urlApproved)page.append(el('p',s.clientError));page.append(btn('Refresh',()=>void refresh()));
    }else{page.append(el('h2','Issued tokens'));for(const t of list||[])row(t.name,btn('Revoke',()=>confirm(`${t.name} will lose access and its current lease.`,'Revoke token','revoke-token',{id:t.id})));if(list?.length===0)page.append(el('p','No client tokens.'));page.append(el('p','Issue new client tokens through the Hub CLI or API.'));}
    if(!pending&&dialog.open)dialog.close();
    if(error){const msg=el('p',error);msg.setAttribute('role','status');page.append(msg);if(view==='tokens')page.append(btn('Retry',()=>void loadTokens()))}
  }
  return {open(connection=false){navigate(connection?'connection':'home')},back(){if(pending){pending=undefined;render();return true}if(view!=='home'){navigate('home');return true}return false},sync(){const next=JSON.stringify(get());if(next!==signature){signature=next;if(!page.hidden)render();if(!get()?.admin){generation++;list=undefined}}}};
}
