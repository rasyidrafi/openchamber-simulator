import android from '../icons/android.svg' with {type:'text'};
import upstreamStyles from './session-tabs.css' with {type:'text'};

// SessionTabsStrip presentation, without project/session store actions (rename, close, reorder).
export function mountDeviceTabs(nav:HTMLElement,select:(id:string)=>void){
  const style=document.createElement('style');style.textContent=upstreamStyles;document.head.append(style);
  const strip=document.createElement('div');strip.className='device-tabs session-tabs-scroll';strip.setAttribute('role','tablist');strip.setAttribute('aria-label','Devices');strip.tabIndex=0;nav.prepend(strip);
  strip.onwheel=e=>{if(e.ctrlKey||e.deltaX||!e.deltaY||strip.scrollWidth<=strip.clientWidth)return;const old=strip.scrollLeft;strip.scrollLeft+=e.deltaY;if(strip.scrollLeft!==old)e.preventDefault()};
  strip.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();strip.scrollLeft=e.key==='Home'?0:e.key==='End'?strip.scrollWidth:strip.scrollLeft+(e.key==='ArrowRight'?182:-182)}};
  let previous='';return(devices:{id?:string,name:string}[],selected:string)=>{
    const key=JSON.stringify([selected,devices.map(d=>[d.id,d.name])]);if(key===previous)return;previous=key;
    const offset=strip.scrollLeft;
    strip.replaceChildren(...devices.map((d,i)=>{const active=selected?d.id===selected:i===0;const slot=document.createElement('div');slot.className='session-tab-slot';slot.dataset.active=String(active);
      const tab=document.createElement('button');tab.type='button';tab.className='session-tab';tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(active));tab.disabled=!d.id&&!active;tab.onclick=()=>{if(d.id)select(d.id)};tab.title=d.name;tab.innerHTML=android;
      const title=document.createElement('span');title.className='session-tab-title';const text=document.createElement('span');text.dir='auto';text.textContent=d.name;title.append(text);tab.append(title);slot.append(tab);return slot}));strip.scrollLeft=offset;
  };
}
