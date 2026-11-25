import { connectHost } from '@openchamber/sdk';
import {settingsPage,type State} from './settings';
import {mountViewer} from './viewer';
import {mountDeviceTabs} from './components/device-tabs';
import { applyHostReady } from '@openchamber/sdk/ui';
import back from './icons/back.svg' with {type:'text'};
import androidBack from './icons/android-back.svg' with {type:'text'};
import home from './icons/home.svg' with {type:'text'};
import gear from './icons/settings.svg' with {type:'text'};

const host=connectHost(), nav=document.querySelector('nav')!;
const button=(id:string)=>document.getElementById(id) as HTMLButtonElement;
const label=document.getElementById('label')!, recover=button('recover');
let state:State|undefined, initialized=false;
let settingsUI:ReturnType<typeof settingsPage>|undefined, openConnection=()=>{};
let deviceTabs:ReturnType<typeof mountDeviceTabs>|undefined;
let frameAvailable=false;
let selected='';let switchViewer:(id:string)=>void;
const current=(s?:State)=>selected?s?.devices.find(d=>d.id===selected):s?.devices[0];
const scoped=(path:string,id:string)=>id?path+(path.includes('?')?'&':'?')+'device='+encodeURIComponent(id):path;
async function request(path:string, body?:object){
  const r=await host.serviceRequest({method:body?'POST':'GET',path,...(body?{body:JSON.stringify(body)}:{})});
  const data=JSON.parse(r.body||'{}'); if(r.status>=400)throw Error(data.error||'Request failed');return data;
}
const action=(action:string,extra={})=>request(scoped('/action',['start','stop','force-release'].includes(action)?selected:''),{action,...extra});
function finishStartup(){document.body.classList.add('started')}
function toolbar(s?:State){const d=current(s),ready=d?.status==='ready';if(!ready)frameAvailable=false;const available=ready&&frameAvailable;button('back').disabled=button('home').disabled=!available;
  deviceTabs?.(s?.devices??[],selected);
  const text=!s?'Simulator unavailable':!s.hasClient?'Client token required':!s.urlApproved?'Hub approval required':s.clientError?'Hub connection failed':ready?d.name:d?`${d.name} · ${d.status}`:'No device available';label.textContent=label.title=text;label.classList.toggle('quiet',!ready);recover.hidden=!!ready;
  const review=s?.hasClient&&!s.urlApproved,start=s?.admin&&d?.status==='stopped',setup=s&&!s.hasClient;recover.hidden=false;recover.textContent=setup?'Setup':review?'Review URL':start?'Start':'Refresh';recover.onclick=async()=>{recover.disabled=true;try{if(review||setup)openConnection();else if(start)await send('start');else await refresh()}finally{recover.disabled=false}};
  document.getElementById('empty-screen')!.hidden=available;
  document.getElementById('empty-description')!.textContent=setup?'Add a client token to connect to the simulator.':review?'Approve the Hub URL to view the emulator.':d?.status==='stopped'?(start?'Start the emulator to view its screen.':'The emulator is stopped.'):d?.status==='booting'?'The emulator is starting. The screen will appear when it is ready.':s?.clientError?'The simulator hub could not be reached.':!d?'No device is available to display.':'A screenshot is not available yet.';
}
async function refresh(){try{state=await request('/state')}catch{state=undefined}if(!selected&&state?.devices[0]?.id)switchViewer(state.devices[0].id);toolbar(state);settingsUI?.sync();if(current(state)?.status!=='ready')finishStartup()}
async function send(name:string){try{await action(name);await refresh()}catch{label.textContent='Action failed';recover.hidden=false;recover.textContent='Retry';recover.onclick=()=>void send(name)}}
host.onReady(ctx=>{
  applyHostReady(ctx,document.documentElement);if(initialized)return;initialized=true;
  nav.hidden=false;deviceTabs=mountDeviceTabs(nav,id=>switchViewer(id));label.textContent='Connecting…';
  const makeViewer=(id:string)=>mountViewer((path,data)=>request(scoped(path,id),data),()=>current(state)?.status==='ready',finishStartup,v=>{if(frameAvailable!==v){frameAvailable=v;toolbar(state)}});let viewer=makeViewer('');
  const empty=document.createElement('section');empty.id='empty-screen';empty.setAttribute('aria-labelledby','empty-title');empty.innerHTML='<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM11 7H13V9H11V7ZM11 11H13V17H11V11Z" fill="currentColor"/></svg><h3 id="empty-title">Screen unavailable</h3><p id="empty-description"></p>';empty.append(recover);document.getElementById('viewport')!.append(empty);
  switchViewer=id=>{if(selected===id)return;const hidden=viewer.box.hidden;viewer.dispose();selected=id;frameAvailable=false;viewer=makeViewer(id);viewer.box.hidden=hidden;viewer.box.append(empty);toolbar(state);settingsUI?.sync()};
  for(const [id,svg] of [['back',androidBack],['home',home]]){button(id).innerHTML=svg;button(id).onclick=()=>void viewer.key(id.toUpperCase())}
  const settings=button('more'),page=document.createElement('section');
  page.id='settings-page';page.hidden=true;page.setAttribute('aria-labelledby','settings-heading');
  document.body.append(page);
  const heading=document.createElement('h1');heading.id='settings-heading';heading.textContent='Settings';heading.hidden=true;nav.prepend(heading);
  settings.removeAttribute('aria-haspopup');settings.setAttribute('aria-controls',page.id);
  settingsUI=settingsPage(page,heading,()=>state?{...state,devices:current(state)?[current(state)!]:[]}:undefined,action,refresh);
  function showSettings(active:boolean,connection=false){
    page.hidden=!active;viewer.box.hidden=active;heading.hidden=!active;nav.classList.toggle('in-settings',active);
    if(active)settingsUI!.open(connection);
    settings.innerHTML=active?back:gear;settings.title=active?'Back':'Simulator settings';settings.setAttribute('aria-label',settings.title);settings.setAttribute('aria-expanded',String(active));
  }
  function goBack(){if(!settingsUI!.back()){showSettings(false);settings.focus()}}
  openConnection=()=>showSettings(true,true);showSettings(false);settings.onclick=()=>page.hidden?showSettings(true):goBack();
  document.addEventListener('keydown',e=>{if(!page.hidden&&e.key==='Escape'){e.preventDefault();goBack()}});
  setInterval(()=>void refresh(),10000);void refresh();
});
