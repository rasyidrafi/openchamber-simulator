import React from 'react';
import {createRoot} from 'react-dom/client';
import {SettingsChipGroup} from '../vendor/openchamber/SettingsChipGroup';

export function mountMode(slot:HTMLElement,onChange:(value:string)=>void){
  const root=createRoot(slot);
  return (mode:string,hasAdmin:boolean|undefined,verified:boolean)=>{
    const options=hasAdmin===false ? [{value:'Admin',label:'Admin',disabled:true}] : [
      {value:'Client',label:'Client'}, {value:'Admin',label:'Admin',disabled:!verified},
    ];
    root.render(<SettingsChipGroup aria-label="Simulator mode" className="mode-chips" value={hasAdmin===false?'Admin':mode} options={options} onChange={onChange}/>);
  };
}
