(function(){
 'use strict';
 // Display-only relevance filtering. Inputs remain mounted and retain their values for save/load.
 const fields={
  water:['sourceA','sourceB','target','switchState','lineSize'],
  power:['powerKw','emergencyClass','backup','powerParent'],
  air:['airflow','staticPa'],
  spec:['spec'],
  valve:['valveConfig']
 };
 const W=new Set('waterTower cityWater groundWater groundWell cityOutlet groundOutlet towerOutlet threeWay waterPump boosterPump pressureTank waterFilter waterMeter checkValve ballValve levelSensor coolingPump nippleDrinker medTank dosingPump'.split(' '));
 const P=new Set('utilityPower generator ats mainSwitch mainPanel subPanel equipmentPanel exhaustFan guideFan coolingPump heatLamp feedMotor dosingPump feedSensor'.split(' '));
 const A=new Set('exhaustFan guideFan coolingFan airFan inletFan'.split(' '));
 const F=new Set('feedSilo feedMotor feedCorner feedDrop feedSensor'.split(' '));
 const shared=new Set(['name','mainFunction','building','spec','target']);
 const relevant=new Set([...shared,...fields.water,...fields.power,...fields.air]);
 let selected=null,showAll=false;
 const byId=id=>document.getElementById(id);
 function groupOf(el){
  if(!el)return 'none';
  const k=el.dataset?.kind||'';
  if(el.tagName==='polyline')return 'route';
  if(k==='threeWay')return 'valve';
  if(F.has(k))return 'feed';
  if(A.has(k))return 'air';
  if(W.has(k))return 'water';
  if(P.has(k)||/panel|switch|generator|ats/i.test(k))return 'power';
  return 'other';
 }
 function update(el){
  selected=el||null;
  const group=groupOf(selected);
  const chosen=new Set(shared);
  if(group==='water'||group==='valve'){['sourceA','sourceB','target','switchState','lineSize'].forEach(x=>chosen.add(x));}
  if(group==='power'||group==='air'){['powerKw','emergencyClass','backup','powerParent'].forEach(x=>chosen.add(x));}
  if(group==='air'){['airflow','staticPa'].forEach(x=>chosen.add(x));}
  if(group==='feed')chosen.add('powerKw');
  if(group==='route'){['lineSize','sourceA','target','routeLength','realLength'].forEach(x=>chosen.add(x));}
  // Explicit data must remain reachable even when the kind is unexpected.
  relevant.forEach(id=>{
   const input=byId(id),row=input?.closest('.prop-row');if(!row)return;
   const hasValue=input?.value&&input.value!=='—'&&input.value!=='none';
   row.classList.toggle('relevance-hidden',!!selected&&!showAll&&!chosen.has(id)&&!hasValue);
  });
  // For the valve-specific editor, existing visibility logic remains authoritative.
  const hint=byId('deviceRelevanceHint');
  const desc={none:'先選擇圖面元件',water:'水路設備',valve:'三向閥',power:'電力設備',air:'通風設備',feed:'飼料設備',route:'管線',other:'一般設備'};
  if(hint)hint.textContent=(desc[group]||desc.other)+'・優先顯示相關欄位';
  const b=byId('deviceShowAllFields');if(b){b.textContent=showAll?'僅顯示相關欄位':'顯示全部欄位';b.setAttribute('aria-pressed',String(showAll));}
 }
 window.refreshDeviceRelevantFields=update;
 document.addEventListener('DOMContentLoaded',()=>{
  byId('deviceShowAllFields')?.addEventListener('click',()=>{showAll=!showAll;update(selected)});
  update(null);
 });
})();
