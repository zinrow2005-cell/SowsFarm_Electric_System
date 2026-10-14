/*
 * 虎尾場 2D CAD 配置系統 V6.7
 * CAD 核心、設備、繪圖、專案資料、Google 雲端
 *
 * 注意：app-core.js 保持原本大型 IIFE 的作用域，
 * 不任意拆散 let / const 狀態，避免再次發生跨 script 作用域錯誤。
 */

(()=>{
const svg=document.getElementById('svg'),vp=document.getElementById('viewport'),status=document.getElementById('status'),canvasWrap=document.getElementById('canvasWrap');
const qs=id=>document.getElementById(id);
let tool='select',selected=null,zoom=1,pan={x:0,y:0},panning=false,panStart=null,spacePan=false,pendingComponent='',pendingCustomDefinition=null,pendingDuplicateSource=null,customEditTarget=null,customSelectedIcon='⚙',handleDrag=null,draw=null,counter=1,dragObj=null,routeDraw=null,snapVisual=null,scaleFactor=null,calibrationPts=[],measurePts=[],viewPreset='all',deviceTypeFilter=null,singleDeviceUid='',viewHistory=[];let historyUndo=[],historyRedo=[],historyCurrent='',historyReady=false,historyApplying=false;
const fields={name:qs('name'),mainFunction:qs('mainFunction'),shapeScaleX:qs('shapeScaleX'),shapeScaleY:qs('shapeScaleY'),shapeLock:qs('shapeLock'),type:qs('type'),x:qs('x1'),y:qs('y1'),rotation:qs('rotation'),iconScale:qs('iconScale'),labelScale:qs('labelScale'),showLabel:qs('showLabel'),building:qs('building'),sourceA:qs('sourceA'),sourceB:qs('sourceB'),target:qs('target'),spec:qs('spec'),lineSize:qs('lineSize'),routeLength:qs('routeLength'),realLength:qs('realLength'),powerParent:qs('powerParent'),powerKw:qs('powerKw'),airflow:qs('airflow'),staticPa:qs('staticPa'),emergencyClass:qs('emergencyClass'),switchState:qs('switchState'),backup:qs('backup'),note:qs('note')};
const waterColors={tower:'#3fd0ff',city:'#ffb454',ground:'#51df95',mixed:'#be9cff'};
const sourceFields={box:qs('sourceConfig'),genWrap:qs('generatorFields'),atsWrap:qs('atsFields'),kva:qs('generatorKva'),pf:qs('generatorPf'),cap:qs('generatorCapacityKw'),atsMode:qs('atsMode'),atsAmp:qs('atsAmp'),atsUtility:qs('atsUtilitySourceName'),atsGenerator:qs('atsGeneratorSourceName')};
let outageSimActive=false;
function generatorCapacityKw(g){
 const kva=parseFloat(g?.dataset?.generatorKva||125)||125,pf=parseFloat(g?.dataset?.generatorPf||0.8)||0.8;
 return kva*pf;
}
function syncSourceConfig(el){
 const kind=el?.dataset?.kind||'',show=['generator','ats','utilityPower'].includes(kind);
 sourceFields.box?.classList.toggle('show',show);
 if(!show)return;
 sourceFields.genWrap.style.display=kind==='generator'?'':'none';
 sourceFields.atsWrap.style.display=kind==='ats'?'':'none';
 if(kind==='generator'){
   sourceFields.kva.value=el.dataset.generatorKva||125;sourceFields.pf.value=el.dataset.generatorPf||0.8;
   sourceFields.cap.value=generatorCapacityKw(el).toFixed(1)+' kW';
 }
 if(kind==='ats'){
   sourceFields.atsMode.value=el.dataset.atsMode||'AUTO';sourceFields.atsAmp.value=el.dataset.atsAmp||'';
   sourceFields.atsUtility.value=el.dataset.atsUtilitySourceName||'尚未接台電';
   sourceFields.atsGenerator.value=el.dataset.atsGeneratorSourceName||'尚未接發電機';
 }
}
function saveSourceConfig(deferSave=false){
 if(!selected?.classList?.contains('component'))return;
 if(selected.dataset.kind==='generator'){
   selected.dataset.generatorKva=String(Math.max(1,parseFloat(sourceFields.kva.value)||125));
   selected.dataset.generatorPf=String(Math.max(.1,Math.min(1,parseFloat(sourceFields.pf.value)||.8)));
   selected.dataset.generatorKw=generatorCapacityKw(selected).toFixed(1);
   selected.dataset.spec=`${selected.dataset.generatorKva} kVA；PF ${selected.dataset.generatorPf}；可用 ${selected.dataset.generatorKw} kW`;
 }
 if(selected.dataset.kind==='ats'){
   selected.dataset.atsMode=sourceFields.atsMode.value||'AUTO';selected.dataset.atsAmp=sourceFields.atsAmp.value||'';
   selected.dataset.spec=`ATS ${selected.dataset.atsAmp||'—'}A；${selected.dataset.atsMode}`;
 }
 syncSourceConfig(selected);if(!deferSave){refreshStats();autosave();refreshList();}
}

const valveEls={box:qs('valveConfig'),a:qs('valveSourceA'),b:qs('valveSourceB'),c:qs('valveSourceC'),active:qs('valveActivePort'),outlet:qs('valveOutlet'),mode:qs('valveMode'),note:qs('valveNote'),status:qs('valveStatus'),scale:qs('valveIconScale'),scaleNum:qs('valveIconScaleNumber')};
function sourceColor(name){name=(name||'').trim();if(name.includes('水塔'))return waterColors.tower;if(name.includes('自來水'))return waterColors.city;if(name.includes('地下水')||name.includes('井'))return waterColors.ground;return waterColors.mixed}
// Water source endpoint types also serve as anchor objects for water line snapping.
function waterKindName(kind){return ({waterTower:'水塔',towerOutlet:'水塔',cityWater:'自來水',cityOutlet:'自來水',groundWater:'地下水',groundWell:'地下水',groundOutlet:'地下水'})[kind]||'';}
function valveSourceByPort(g,port){if(!g)return'';if(port==='A')return g.dataset.valveSourceA||g.dataset.sourceA||'';if(port==='B')return g.dataset.valveSourceB||g.dataset.sourceB||'';if(port==='C')return g.dataset.valveSourceC||'';return''}
function syncValvePanel(g){
 if(!valveEls.box)return;
 const isValve=!!(g?.classList?.contains('component')&&g.dataset.kind==='threeWay');
 valveEls.box.classList.toggle('show',isValve);
 if(!isValve)return;
 valveEls.a.value=g.dataset.valveSourceA||g.dataset.sourceA||'';
 valveEls.b.value=g.dataset.valveSourceB||g.dataset.sourceB||'';
 valveEls.c.value=g.dataset.valveSourceC||'';
 valveEls.active.value=g.dataset.valveActivePort||'';
 valveEls.outlet.value=g.dataset.valveOutlet||g.dataset.target||'';
 valveEls.mode.value=g.dataset.valveMode||'手動';
 valveEls.note.value=g.dataset.valveNote||'';
 const sc=Math.max(.2,Math.min(3,parseFloat(g.dataset.iconScale||0.8)||0.8));
 valveEls.scale.value=sc.toFixed(1);
 valveEls.scaleNum.value=sc.toFixed(1);
 previewValvePanel();
}
function previewValvePanel(){
 if(!valveEls.status)return;
 const src=valveEls.active.value==='A'?valveEls.a.value:valveEls.active.value==='B'?valveEls.b.value:valveEls.active.value==='C'?valveEls.c.value:'';
 valveEls.status.innerHTML=`目前供水：<b style="color:${sourceColor(src)}">${src||'未指定'}</b><br>入口A：${valveEls.a.value||'—'}｜入口B：${valveEls.b.value||'—'}｜入口C：${valveEls.c.value||'—'}<br>出水：${valveEls.outlet.value||'—'}｜${valveEls.mode.value||'手動'}`;
 const counts=JSON.parse(selected?.dataset?.valveConnections||'{}');if(selected?.dataset.kind==='threeWay')valveEls.status.textContent += `　連線 A:${counts.A||0} B:${counts.B||0} C:${counts.C||0} OUT:${counts.OUT||0}`;
}
function setValveScale(v,save=true){
 if(!selected?.classList?.contains('component')||selected.dataset.kind!=='threeWay')return;
 v=Math.max(.2,Math.min(3,parseFloat(v)||0.8));
 selected.dataset.iconScale=v.toFixed(1);
 fields.iconScale.value=v.toFixed(1);
 valveEls.scale.value=v.toFixed(1);
 valveEls.scaleNum.value=v.toFixed(1);
 applyComponentVisual(selected);
 updateConnectedRoutes(selected.dataset.uid);
 if(save)autosave();
 status.textContent=`三向閥圖示倍率：${v.toFixed(1)}×`;
}
function saveValveConfig(){
 if(!selected?.classList?.contains('component')||selected.dataset.kind!=='threeWay')return alert('請先選取三向閥');
 selected.dataset.valveSourceA=valveEls.a.value.trim();
 selected.dataset.valveSourceB=valveEls.b.value.trim();
 selected.dataset.valveSourceC=valveEls.c.value.trim();
 selected.dataset.valveActivePort=valveEls.active.value;
 selected.dataset.valveOutlet=valveEls.outlet.value.trim();
 selected.dataset.valveMode=valveEls.mode.value;
 selected.dataset.valveNote=valveEls.note.value.trim();
 selected.dataset.sourceA=selected.dataset.valveSourceA;
 selected.dataset.sourceB=selected.dataset.valveSourceB;
 selected.dataset.target=selected.dataset.valveOutlet;
 selected.dataset.switchState=valveSourceByPort(selected,selected.dataset.valveActivePort);
 fields.sourceA.value=selected.dataset.sourceA;
 fields.sourceB.value=selected.dataset.sourceB;
 fields.target.value=selected.dataset.target;
 fields.switchState.value=['水塔','自來水','地下水'].includes(selected.dataset.switchState)?selected.dataset.switchState:'';
 updateThreeWayVisual(selected);applyComponentVisual(selected);syncValvePanel(selected);refreshWaterFlow();autosave();refreshList();
 status.textContent='已儲存三向閥設定：'+(selected.dataset.switchState||'未指定供水來源');
}
const labels={feedSilo:'飼料桶',feedMotor:'飼料輸送馬達',feedCorner:'料線轉角器',feedDrop:'落料口',nippleDrinker:'自動飲水器',medTank:'藥液混合桶',dosingPump:'定量加藥器',feedSensor:'料位感測器',transferPump:'抽水馬達',boosterPump:'加壓泵',pressureTank:'壓力桶',waterFilter:'水質過濾器',waterMeter:'水表',checkValve:'逆止閥',shutoffValve:'球閥／關斷閥',levelSensor:'水位感測器',waterTower:'水塔',cityWater:'自來水',groundWater:'地下水',groundWell:'地下水井',cityOutlet:'自來水出水口',groundOutlet:'地下水出水口',towerOutlet:'水塔水出水口',threeWay:'三向閥',utilityPower:'台電進線',generator:'發電機',ats:'ATS切換盤',mainSwitch:'總開關箱',mainPanel:'總配電箱',subPanel:'分電箱',equipmentPanel:'設備電箱',coolingPad:'水簾設備',exhaustFan:'主排風扇',guideFan:'導引扇',coolingPump:'水簾泵浦',heatLamp:'保溫燈 / 保溫設備',customDevice:'自訂設備'};
const defaultMainFunctions={feedSilo:'儲存散裝飼料',feedMotor:'驅動送料管線與螺旋',feedCorner:'連接飼料輸送管線轉角',feedDrop:'飼料分配至欄位或料槽',nippleDrinker:'豬隻飲水末端設備',medTank:'藥液或營養添加液混合',dosingPump:'飲水系統定量投藥',feedSensor:'監測飼料桶或料槽的料位',transferPump:'抽取地下水或將水送入水塔',boosterPump:'增加豬舍供水壓力',pressureTank:'穩定供水壓力與降低泵浦頻繁啟停',waterFilter:'過濾供水中的泥沙及雜質',waterMeter:'量測區域用水量',checkValve:'防止管路逆流',shutoffValve:'手動關斷或隔離管路',levelSensor:'監測水塔液位，作為補水控制依據',
 waterTower:'儲水與全場供水',cityWater:'自來水供水來源',groundWater:'地下水抽取與供水',groundWell:'地下水取水井及抽水設備',cityOutlet:'自來水出水端，可連到三向閥',groundOutlet:'地下水出水端，可連到三向閥',towerOutlet:'水塔出水端，可連到三向閥',threeWay:'水塔 / 地下水 / 自來水水源切換',
 utilityPower:'台電主電源進線',generator:'停電時緊急備援供電',ats:'台電與發電機自動切換',
 mainSwitch:'全場總電源隔離與保護',mainPanel:'主配電與各區分路供電',subPanel:'區域分路供電與保護',equipmentPanel:'單一設備或設備群控制配電',
 coolingPad:'蒸發降溫與進風冷卻',exhaustFan:'主排風、換氣與高溫降溫',guideFan:'舍內氣流導引與循環',coolingPump:'水簾循環供水',heatLamp:'仔豬局部保溫'
};
function objectMainFunction(el){
 if(!el)return'';
 const own=String(el.dataset.mainFunction||'').trim();if(own)return own;
 if(el.classList?.contains('component'))return defaultMainFunctions[el.dataset.kind]||labels[el.dataset.kind]||el.dataset.name||'設備功能';
 if(el.tagName==='polyline')return el.parentElement?.id==='waterLayer'?'供水管路':(el.parentElement?.id==='elecLayer'?'電力配線':el.parentElement?.id==='feedLayer'?'飼料管線':'路線');
 if(el.tagName==='text')return'圖面文字註記';
 if(el.tagName==='rect'||el.tagName==='line'||el.tagName==='polygon')return'圖面註記';
 return el.dataset.name||'圖面物件';
}

function tf(){vp.setAttribute('transform',`translate(${pan.x} ${pan.y}) scale(${zoom})`);requestAnimationFrame(()=>{positionObjectDetail();positionSelectionActionBar()})}
function pt(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(vp.getScreenCTM().inverse())}
function snapGridPoint(p){const step=parseFloat(qs('gridSnap')?.value||0)||0;if(!step)return{x:p.x,y:p.y};return{x:Math.round(p.x/step)*step,y:Math.round(p.y/step)*step}}
function metersFromUnits(u){return scaleFactor&&isFinite(scaleFactor)?u*scaleFactor:null}
function updateScaleUI(){qs('scaleFactor').value=scaleFactor?scaleFactor.toFixed(6):'';qs('scaleStatus').value=scaleFactor?`已校正：1單位 = ${scaleFactor.toFixed(5)} m`:'尚未校正';refreshStats();if(selected)fill(selected)}
function clearMeasureGuide(){qs('scaleGuideLayer')?.remove();qs('measureGuideLayer')?.remove()}
function drawGuide(points,id,labelText){qs(id)?.remove();const g=mk('g',{id});qs('annoLayer').appendChild(g);points.forEach(p=>g.appendChild(mk('circle',{cx:p.x,cy:p.y,r:6,class:'cal-dot'})));if(points.length===2){g.appendChild(mk('line',{x1:points[0].x,y1:points[0].y,x2:points[1].x,y2:points[1].y,class:'measure-line'}));if(labelText){const tx=mk('text',{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2-10,'text-anchor':'middle',class:'measure-label'});tx.textContent=labelText;g.appendChild(tx)}}}
function doCalibrationClick(p){calibrationPts.push(p);drawGuide(calibrationPts,'scaleGuideLayer','');if(calibrationPts.length===1){status.textContent='比例尺校正：請點第二個已知尺寸端點';return}const units=Math.hypot(calibrationPts[1].x-calibrationPts[0].x,calibrationPts[1].y-calibrationPts[0].y);const val=prompt(`圖面距離 ${units.toFixed(1)} 單位。請輸入這一段的實際公尺：`,'60.7');const meters=parseFloat(val);if(meters>0&&units>0){scaleFactor=meters/units;status.textContent=`比例尺已校正：1圖面單位 = ${scaleFactor.toFixed(5)} m`;updateAllRouteLengths();autosave();}else status.textContent='比例尺校正取消';calibrationPts=[];setTool('select');setTimeout(()=>qs('scaleGuideLayer')?.remove(),500);updateScaleUI()}
function doMeasureClick(p){measurePts.push(p);drawGuide(measurePts,'measureGuideLayer','');if(measurePts.length===1){status.textContent='量距：請點第二點';return}const units=Math.hypot(measurePts[1].x-measurePts[0].x,measurePts[1].y-measurePts[0].y);const m=metersFromUnits(units);const label=m!=null?`${m.toFixed(2)} m`:`${units.toFixed(1)} 圖面單位（尚未校正）`;drawGuide(measurePts,'measureGuideLayer',label);status.textContent='量距：'+label;measurePts=[];setTool('select')}
function updateAllRouteLengths(){document.querySelectorAll('polyline[data-user="1"]').forEach(el=>{const u=routeLength(routePoints(el));el.dataset.length=u.toFixed(1);const m=metersFromUnits(u);el.dataset.realLength=m==null?'':m.toFixed(2)});refreshStats()}

function setTool(t){if(pendingDuplicateSource&&t!=='select')cancelDuplicatePlacement();if(routeDraw&&!['water','electric','feed'].includes(t))finishRoute(false);if(t!=='select')clearComponentHandles();if(pendingComponent&&t!=='select'){pendingComponent='';pendingCustomDefinition=null;document.body.classList.remove('component-place-mode');document.querySelectorAll('.libitem[data-component]').forEach(el=>{el.classList.remove('placing-selected');el.setAttribute('aria-pressed','false')});document.querySelectorAll('[data-quick-component]').forEach(b=>b.classList.remove('active'));if(qs('quickDeviceMenuBtn')){qs('quickDeviceMenuBtn').textContent='＋ 設備';qs('quickDeviceMenuBtn').classList.remove('place-active')}}if(routeDraw&&t!==routeDraw.kind)finishRoute(false);tool=t;document.body.classList.remove('device-menu-open');qs('quickDeviceBar')?.setAttribute('aria-hidden','true');document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));if(t==='select')updateSelectionActionBar(selected);else hideSelectionActionBar();status.textContent='工具：'+({select:'選取 / 拖移',pan:'平移',water:'畫水線',electric:'畫電線',feed:'畫料線',rect:'矩形',text:'文字'})[t]+'｜尺寸顯示 1 位小數。'}
document.querySelectorAll('.tool').forEach(b=>b.onclick=()=>{setTool(b.dataset.tool);document.body.classList.toggle('pan-tool-ready',b.dataset.tool==='pan')});

let objectDetailTarget=null;
const objectDetailIcons={feedSilo:'料',feedMotor:'馬',feedCorner:'轉',feedDrop:'落',nippleDrinker:'飲',medTank:'藥',dosingPump:'劑',feedSensor:'位',transferPump:'P',boosterPump:'P+',pressureTank:'壓',waterFilter:'濾',waterMeter:'m³',checkValve:'▷|',shutoffValve:'⊗',levelSensor:'LV',waterTower:'水塔',cityWater:'自',groundWater:'井',groundWell:'深井',cityOutlet:'自出',groundOutlet:'井出',towerOutlet:'塔出',threeWay:'Y',utilityPower:'台電',generator:'G',ats:'ATS',mainSwitch:'總開',mainPanel:'總配',subPanel:'分電',equipmentPanel:'設備',coolingPad:'水簾',exhaustFan:'排風',guideFan:'導引',coolingPump:'P',heatLamp:'☀'};
function detailRow(label,value){
 const v=String(value??'').trim();if(!v)return'';
 return `<b>${esc(label)}</b><span>${esc(v)}</span>`;
}
function objectTypeText(el){
 if(!el)return'—';
 if(el.classList?.contains('component'))return el.dataset.kind==='customDevice'?'自訂設備':(labels[el.dataset.kind]||el.dataset.kind||'設備');
 if(el.tagName==='polyline')return el.parentElement?.id==='waterLayer'?'水路':(el.parentElement?.id==='elecLayer'?'電路':el.parentElement?.id==='feedLayer'?'料線':'路線');
 return el.dataset.area||el.tagName||'圖面物件';
}

function objectDetailRowsCompact(el){
 const rows=[];const add=(k,v)=>{const s=String(v??'').trim();if(s)rows.push(detailRow(k,s))};
 if(!el)return'';
 if(el.classList?.contains('component')){
   const kind=el.dataset.kind||'';
   add('棟舍',el.dataset.building);
   if(kind==='customDevice')add('類別',CUSTOM_CATEGORY_LABELS[el.dataset.customCategory]||'一般 / 其他');
   if(kind==='threeWay'){add('目前水源',el.dataset.switchState);add('去向',el.dataset.valveOutlet||el.dataset.target)}
   else if(kind==='generator'){add('容量',(el.dataset.generatorKva||'125')+' kVA');add('可用',(el.dataset.generatorKw||'100')+' kW')}
   else if(kind==='ats'){add('模式',el.dataset.atsMode);add('台電',el.dataset.atsUtilitySourceName);add('發電機',el.dataset.atsGeneratorSourceName)}
   else{
     add('來源',el.dataset.powerParentName||el.dataset.sourceA);
     add('去向',el.dataset.target);
     add('規格',el.dataset.spec);
     if(el.dataset.powerKw)add('功率',el.dataset.powerKw+' kW');
     if(['mainSwitch','mainPanel','subPanel','equipmentPanel'].includes(kind)&&el.dataset.panelCircuitCount)add('配電',el.dataset.panelCircuitCount+' 路 / '+(el.dataset.panelLoadKw||'0')+' kW');
   }
 }else if(el.tagName==='polyline'){
   add('來源',el.dataset.sourceA);add('去向',el.dataset.target);add('線徑',el.dataset.lineSize);add('長度',el.dataset.realLength?el.dataset.realLength+' m':el.dataset.length);
 }
 return rows.slice(0,5).join('');
}

function objectDetailRows(el){
 const rows=[];
 const add=(k,v)=>{const s=String(v??'').trim();if(s)rows.push(detailRow(k,s))};
 add('名稱',el.dataset.name);
 add('所屬棟舍',el.dataset.building);
 if(el.classList?.contains('component')){
   const kind=el.dataset.kind||'';
   if(kind==='customDevice')add('自訂類別',CUSTOM_CATEGORY_LABELS[el.dataset.customCategory]||'一般 / 其他');
   if(kind==='threeWay'){
     add('入口 A',el.dataset.valveSourceA||el.dataset.sourceA);add('入口 B',el.dataset.valveSourceB||el.dataset.sourceB);add('入口 C',el.dataset.valveSourceC);
     add('目前供水',el.dataset.switchState);add('出水去向',el.dataset.valveOutlet||el.dataset.target);add('操作方式',el.dataset.valveMode);
   }else{
     add('來源 / 上游',el.dataset.powerParentName||el.dataset.sourceA);add('第二來源',el.dataset.sourceB);add('去向 / 下游',el.dataset.target);
   }
   add('規格',el.dataset.spec);
   if(el.dataset.powerKw)add('額定功率',el.dataset.powerKw+' kW');
   if(el.dataset.airflow)add('風量',el.dataset.airflow+' m³/h');
   if(el.dataset.staticPa)add('靜壓',el.dataset.staticPa+' Pa');
   add('緊急級別',el.dataset.emergencyClass);
   if(el.dataset.backup)add('發電備援',el.dataset.backup==='yes'?'是':el.dataset.backup==='no'?'否':el.dataset.backup);
   if(kind==='generator'){add('發電機容量',(el.dataset.generatorKva||'125')+' kVA');add('功率因數',el.dataset.generatorPf||'0.8');add('可用功率',(el.dataset.generatorKw||'100')+' kW')}
   if(kind==='ats'){add('ATS模式',el.dataset.atsMode);if(el.dataset.atsAmp)add('ATS額定',el.dataset.atsAmp+' A');add('台電來源',el.dataset.atsUtilitySourceName);add('發電機來源',el.dataset.atsGeneratorSourceName)}
   if(['mainSwitch','mainPanel','subPanel','equipmentPanel'].includes(kind)){
     if(el.dataset.panelCircuitCount)add('配電分路',el.dataset.panelCircuitCount+' 路');
     if(el.dataset.panelLoadKw)add('盤內負載',el.dataset.panelLoadKw+' kW');
   }
 }else if(el.tagName==='polyline'){
   add('來源',el.dataset.sourceA);add('去向',el.dataset.target);add('管徑 / 線徑',el.dataset.lineSize);
   if(el.dataset.realLength)add('實際長度',el.dataset.realLength+' m');else if(el.dataset.length)add('圖面長度',el.dataset.length);
 }
 return rows.join('');
}

function hideSelectionActionBar(){const b=qs('selectionActionBar');if(b){b.classList.remove('show');b.setAttribute('aria-hidden','true')}}
function positionSelectionActionBar(){
 const bar=qs('selectionActionBar');
 if(!bar?.classList.contains('show')||!selected||selected.dataset?.user!=='1'||tool!=='select'||!document.body.contains(selected)||bar.dataset.userMoved==='1')return;
 if(window.matchMedia('(max-width:520px)').matches)return;
 const c=canvasWrap.getBoundingClientRect(),b=selected.getBoundingClientRect(),bw=bar.offsetWidth||210,bh=bar.offsetHeight||38;
 let left=(b.left+b.right)/2-c.left,top=b.top-c.top-bh-9;
 if(top<54)top=b.bottom-c.top+9;
 left=Math.max(bw/2+8,Math.min(c.width-bw/2-8,left));
 top=Math.max(52,Math.min(c.height-bh-36,top));
 bar.style.left=left+'px';bar.style.top=top+'px';
}
function updateSelectionActionBar(el=selected){
 const bar=qs('selectionActionBar');
 if(!bar)return;
 if(!el||el.dataset?.user!=='1'||tool!=='select'){hideSelectionActionBar();return}
 if(bar.dataset.selectedUid!==(el.dataset.uid||'')){bar.dataset.userMoved='';bar.dataset.selectedUid=el.dataset.uid||'';bar.style.removeProperty('bottom');bar.style.removeProperty('transform');bar.style.removeProperty('left');bar.style.removeProperty('top')}
 qs('selectionActionName').textContent=el.dataset.name||objectTypeText(el)||'物件';
 if(qs('selectionDuplicateBtn'))qs('selectionDuplicateBtn').style.display=el.classList?.contains('component')?'':'none';syncObjectLockUi(el);updatePhotoAction(el);
 bar.classList.add('show');bar.setAttribute('aria-hidden','false');requestAnimationFrame(positionSelectionActionBar);
}
// 選取浮動工具列：拖曳名稱區域可移動，不會擋住旋轉控制點。
(function setupSelectionActionBarDrag(){
 const bar=qs('selectionActionBar'),handle=qs('selectionActionName');if(!bar||!handle)return;
 handle.title='按住拖移工具列（避免遮住旋轉控制點）';handle.setAttribute('role','button');handle.setAttribute('tabindex','0');
 let dragging=null;
 handle.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  const wrap=canvasWrap.getBoundingClientRect(),rect=bar.getBoundingClientRect();
  dragging={x:e.clientX,y:e.clientY,left:rect.left-wrap.left,top:rect.top-wrap.top};
  bar.dataset.userMoved='1';bar.style.transform='none';bar.style.bottom='auto';
  bar.style.setProperty('left',dragging.left+'px','important');bar.style.setProperty('top',dragging.top+'px','important');
  try{handle.setPointerCapture(e.pointerId)}catch(_){}
  e.preventDefault();e.stopPropagation();
 });
 handle.addEventListener('pointermove',e=>{
  if(!dragging)return;
  const bounds=canvasWrap.getBoundingClientRect(),w=bar.offsetWidth,h=bar.offsetHeight;
  const left=Math.max(4,Math.min(bounds.width-w-4,dragging.left+e.clientX-dragging.x));
  const top=Math.max(4,Math.min(bounds.height-h-4,dragging.top+e.clientY-dragging.y));
  bar.style.setProperty('left',left+'px','important');bar.style.setProperty('top',top+'px','important');
 });
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(ev,()=>{dragging=null});
})();

function openSelectedPhoto(){
 if(!selected?.dataset||selected.dataset.user!=='1')return;
 if(window.matchMedia('(max-width:1100px)').matches){document.body.classList.add('mobile-right-open');document.body.classList.remove('mobile-left-open')}
 document.body.classList.remove('right-collapsed');
 // iPhone / iPad 的相機/相簿選擇必須直接由使用者手勢觸發，不能延遲 click。
 qs('fieldPhotoInput')?.click();
 setTimeout(()=>qs('fieldPhotoSection')?.scrollIntoView({behavior:'smooth',block:'start'}),60);
}

function positionObjectDetail(){
 const pop=qs('objectDetailPopover');if(!pop?.classList.contains('show')||!objectDetailTarget||!document.body.contains(objectDetailTarget))return;
 const c=canvasWrap.getBoundingClientRect(),b=objectDetailTarget.getBoundingClientRect();
 let left=b.right-c.left+12,top=b.top-c.top;
 const pw=pop.offsetWidth||310,ph=pop.offsetHeight||260;
 if(left+pw>c.width-10)left=Math.max(10,b.left-c.left-pw-12);
 top=Math.max(54,Math.min(c.height-ph-44,top));
 pop.style.left=left+'px';pop.style.top=top+'px';
}

function openObjectEditor(el){
 if(!el||!document.contains(el)||el.dataset?.user!=='1')return false;
 fill(el);
 document.body.classList.remove('right-collapsed');
 if(window.matchMedia('(max-width:1100px)').matches){document.body.classList.add('mobile-right-open');document.body.classList.remove('mobile-left-open')}
 const right=document.querySelector('.right');
 if(right)right.dataset.rightTab='basic';
 qs('rightTabBasic')?.classList.add('active');qs('rightTabInfo')?.classList.remove('active');
 document.body.classList.add('object-edit-focus');
 setTimeout(()=>document.body.classList.remove('object-edit-focus'),700);
 right?.scrollTo({top:0,behavior:'smooth'});
 setTimeout(()=>{fields.name?.focus();fields.name?.select?.()},120);
 status.textContent='編輯：'+(el.dataset.name||objectTypeText(el))+'｜右側可調整大小、寬高比例與功能。';
 return true;
}
// 唯讀詳細視窗與編輯面板共用同一個設備選取入口，避免選取到上一個物件。
window.CAD_OPEN_OBJECT_EDITOR=function(el){return openObjectEditor(el)};
let deletePendingObject=null;
function closeDeleteConfirm(){
 deletePendingObject=null;
 const m=qs('deleteConfirmModal');if(m){m.classList.remove('show');m.setAttribute('aria-hidden','true')}
}
function requestDeleteObject(el){
 if(!el)return false;
 if(el.dataset.user!=='1'){alert('底圖區域鎖定，不能刪除。');return false}
 deletePendingObject=el;
 qs('deleteConfirmName').textContent=el.dataset.name||objectTypeText(el)||'此物件';
 const m=qs('deleteConfirmModal');m.classList.add('show');m.setAttribute('aria-hidden','false');
 setTimeout(()=>qs('deleteConfirmOk')?.focus(),40);
 return true;
}
function deleteObjectNow(el){
 if(!el||!document.body.contains(el)){closeDeleteConfirm();return false}
 const name=el.dataset.name||objectTypeText(el)||'此物件';
 if(objectDetailTarget===el)hideObjectDetail();
 clearComponentHandles();hideSelectionActionBar();
 if(selected===el)selected=null;
 el.remove();
 closeDeleteConfirm();
 fill(null);
 rebuildPowerRelations();autosave();refreshList();refreshStats();
 status.textContent='已刪除：'+name;
 return true;
}
function deleteObject(el){return requestDeleteObject(el)}

function showObjectDetail(el,keepExpanded=false){
 if(!el||el.classList?.contains('hotspot'))return hideObjectDetail();
 const same=objectDetailTarget===el;objectDetailTarget=el;
 if(!keepExpanded&&!same)el.dataset.detailExpanded='no';
 const expanded=el.dataset.detailExpanded==='yes';
 const pop=qs('objectDetailPopover');
 qs('objectDetailIcon').textContent=el.dataset.customIcon||objectDetailIcons[el.dataset.kind]||((el.tagName==='polyline')?'線':'●');
 qs('objectDetailName').textContent=el.dataset.name||objectTypeText(el);
 qs('objectDetailType').textContent=objectTypeText(el);
 qs('objectDetailMainFunction').textContent=objectMainFunction(el)||'—';
 qs('objectDetailGrid').innerHTML=(expanded?objectDetailRows(el):objectDetailRowsCompact(el))||'<b>重點</b><span>尚未填寫</span>';
 const note=String(el.dataset.note||'').trim();qs('objectDetailNote').style.display=(expanded&&note)?'':'none';qs('objectDetailNote').textContent=note?'備註：'+note:'';
 const actions=qs('objectDetailActions');actions.innerHTML='';
 if(el.dataset.user==='1'){
   const view=document.createElement('button');view.type='button';view.textContent='查看完整資料';view.title='以分頁方式檢視基本資料、迴路、照片與標記（唯讀）';view.onclick=()=>{if(typeof window.CAD_VIEW_DETAILS==='function')window.CAD_VIEW_DETAILS(el)};actions.appendChild(view);
   const edit=document.createElement('button');edit.type='button';edit.textContent='編輯';edit.onclick=()=>openObjectEditor(el);actions.appendChild(edit);
   if(isPanel(el)){const btn=document.createElement('button');btn.type='button';btn.textContent='配電箱';btn.onclick=()=>openPanelEditor(el);actions.appendChild(btn)}
   const del=document.createElement('button');del.type='button';del.className='danger-btn';del.textContent='刪除';del.onclick=e=>{e.preventDefault();e.stopPropagation();requestDeleteObject(el)};actions.appendChild(del);
 }
 const more=document.createElement('button');more.type='button';more.className='detail-more-btn';more.textContent=expanded?'收合':'更多';
 more.onclick=()=>{el.dataset.detailExpanded=expanded?'no':'yes';showObjectDetail(el,true)};actions.appendChild(more);
 pop.classList.add('show');pop.setAttribute('aria-hidden','false');requestAnimationFrame(positionObjectDetail);
}
function hideObjectDetail(){
 objectDetailTarget=null;const pop=qs('objectDetailPopover');if(pop){pop.classList.remove('show');pop.setAttribute('aria-hidden','true')}
}

function clearFields(){Object.values(fields).forEach(f=>{if(f.tagName==='SELECT')f.value='';else f.value=''});if(valveEls.box)valveEls.box.classList.remove('show');if(sourceFields.box)sourceFields.box.classList.remove('show');}
function componentXY(el){return{ x:+(el.dataset.x||0), y:+(el.dataset.y||0)} }
function applyComponentVisual(el){
 if(!el||!el.classList?.contains('component'))return;
 if(el.dataset.kind==='customDevice')applyCustomDeviceAppearance(el);
 const x=parseFloat(el.dataset.x||0)||0,y=parseFloat(el.dataset.y||0)||0,rot=parseFloat(el.dataset.rotation||0)||0;
 const sc=Math.max(.2,Math.min(5,parseFloat(el.dataset.iconScale||.8)||.8));
 const sx=Math.max(.3,Math.min(3,parseFloat(el.dataset.shapeScaleX||1)||1));
 const sy=Math.max(.3,Math.min(3,parseFloat(el.dataset.shapeScaleY||1)||1));
 const lsc=Math.max(.4,Math.min(3,parseFloat(el.dataset.labelScale||.9)||.9)),show=(el.dataset.showLabel||'yes')!=='no';
 el.dataset.iconScale=sc.toFixed(2);el.dataset.shapeScaleX=sx.toFixed(2);el.dataset.shapeScaleY=sy.toFixed(2);el.dataset.shapeLock=el.dataset.shapeLock||'yes';el.dataset.labelScale=lsc.toFixed(1);el.dataset.showLabel=show?'yes':'no';
 if(!el.dataset.mainFunction)el.dataset.mainFunction=defaultMainFunctions[el.dataset.kind]||'';
 el.dataset.locked=el.dataset.locked||'no';el.classList.toggle('locked-object',objectLocked(el));
 let lockLabel=el.querySelector('.component-lock-label');if(objectLocked(el)){if(!lockLabel){lockLabel=mk('text',{x:0,y:-31,'text-anchor':'middle',class:'component-lock-label'});el.appendChild(lockLabel)}lockLabel.textContent='🔒'}else lockLabel?.remove();
 el.setAttribute('transform',`translate(${x} ${y}) rotate(${rot}) scale(${(sc*sx).toFixed(4)} ${(sc*sy).toFixed(4)})`);
 el.querySelectorAll('text').forEach(t=>t.setAttribute('transform',`scale(${(1/sx).toFixed(5)} ${(1/sy).toFixed(5)})`));
 const lab=el.querySelector('.component-label');if(lab){lab.setAttribute('font-size',(13*lsc).toFixed(1));lab.setAttribute('y',(40+lsc*6).toFixed(1))}
 let role=el.querySelector('.component-role-label');
 if(!role){role=mk('text',{x:0,'text-anchor':'middle',class:'component-role-label'});el.appendChild(role)}
 role.setAttribute('transform',`scale(${(1/sx).toFixed(5)} ${(1/sy).toFixed(5)})`);
 role.textContent='功能：'+objectMainFunction(el);
 role.setAttribute('font-size',(10*lsc).toFixed(1));role.setAttribute('y',(el.dataset.kind==='threeWay'?(83+lsc*6):(57+lsc*7)).toFixed(1));
 const sw=el.querySelector('.switch-label');if(sw){sw.setAttribute('font-size',(12*lsc).toFixed(1));sw.setAttribute('y',(56+lsc*6).toFixed(1))}
 el.classList.toggle('hide-label',!show);
 if(selected===el)requestAnimationFrame(()=>{renderComponentHandles(el);positionSelectionActionBar()});if(objectDetailTarget===el)requestAnimationFrame(()=>{showObjectDetail(el,true);positionObjectDetail()});
}
function applyGlobalMarkerSettings(opts={}){document.querySelectorAll('.component[data-user="1"]').forEach(el=>{if(opts.iconScale!=null)el.dataset.iconScale=(Math.max(.2,Math.min(5,parseFloat(opts.iconScale)||.8))).toFixed(1);if(opts.labelScale!=null)el.dataset.labelScale=(Math.max(.4,Math.min(3,parseFloat(opts.labelScale)||.9))).toFixed(1);if(opts.showLabel!=null)el.dataset.showLabel=opts.showLabel?'yes':'no';applyComponentVisual(el)});if(selected)fill(selected);autosave();refreshList();status.textContent='已更新標記顯示設定';}

function setSimpleRow(id,show,more=false){
 const el=qs(id);const row=el?.closest('.prop-row')||el?.closest('.section')||null;if(!row)return;
 row.classList.remove('smart-hide','smart-more');
 if(!show){row.classList.add('smart-hide');if(more)row.classList.add('smart-more')}
}
function updateSimplePropertyVisibility(el){
 if(!el)return;
 const kind=el.dataset.kind||'',isComp=el.classList?.contains('component'),isRoute=el.tagName==='polyline';
 const powered=['utilityPower','generator','ats','mainSwitch','mainPanel','subPanel','equipmentPanel','exhaustFan','guideFan','coolingPump','heatLamp'].includes(kind);
 const fan=['exhaustFan','guideFan'].includes(kind);
 const isPanelKind=['mainSwitch','mainPanel','subPanel','equipmentPanel'].includes(kind);
 const sourceUseful=isComp&&!['coolingPad','heatLamp'].includes(kind);
 setSimpleRow('building',isComp);
 setSimpleRow('sourceA',sourceUseful||isRoute);
 setSimpleRow('sourceB',false,true);
 setSimpleRow('target',isComp||isRoute);
 setSimpleRow('spec',isComp||isRoute);
 setSimpleRow('powerKw',powered);
 setSimpleRow('airflow',fan,false);
 setSimpleRow('staticPa',false,true);
 setSimpleRow('emergencyClass',powered,false);
 setSimpleRow('backup',powered,false);
 setSimpleRow('lineSize',isRoute,false);
 setSimpleRow('routeLength',false,true);
 setSimpleRow('realLength',isRoute,false);
 setSimpleRow('powerParent',false,true);
 setSimpleRow('switchState',false,true);
 setSimpleRow('iconScale',false,true);
 setSimpleRow('labelScale',false,true);
 setSimpleRow('showLabel',false,true);
 const iconActions=qs('iconSmallerBtn')?.parentElement;if(iconActions){iconActions.classList.add('smart-hide','smart-more')}
 const globalBox=qs('globalIconScale')?.closest('.section');if(globalBox){globalBox.classList.add('smart-hide','smart-more')}
 qs('openPanelEditorBtn').style.display=isPanelKind?'':'none';
 if(qs('sourceConfig')){qs('sourceConfig').classList.toggle('smart-more',true)}
 if(qs('valveConfig')){qs('valveConfig').classList.toggle('smart-more',true)}
 const hint=qs('deviceMoreBtn');if(hint)hint.textContent=document.body.classList.contains('device-more-open')?'收合設定':'更多設定';
}



function clearAlignmentGuides(){const l=qs('alignmentGuideLayer');if(l)l.innerHTML=''}
function drawAlignmentGuide(axis,value){
 const l=qs('alignmentGuideLayer');if(!l)return;const vb=svg.viewBox.baseVal;
 if(axis==='x')l.appendChild(mk('line',{x1:value,y1:vb.y,x2:value,y2:vb.y+vb.height,class:'alignment-guide'}));
 else l.appendChild(mk('line',{x1:vb.x,y1:value,x2:vb.x+vb.width,y2:value,class:'alignment-guide'}));
}
function smartAlignPoint(p,movingEl=null,show=true){
 const th=Math.max(3,9/Math.max(.35,zoom));let nx=p.x,ny=p.y,bx=Infinity,by=Infinity,sx=null,sy=null;
 document.querySelectorAll('.component[data-user="1"]').forEach(c=>{
   if(c===movingEl||c.style.display==='none')return;const q=componentXY(c),dx=Math.abs(q.x-p.x),dy=Math.abs(q.y-p.y);
   if(dx<th&&dx<bx){bx=dx;sx=q.x}if(dy<th&&dy<by){by=dy;sy=q.y}
 });
 if(sx!==null)nx=sx;if(sy!==null)ny=sy;
 if(show){clearAlignmentGuides();if(sx!==null)drawAlignmentGuide('x',sx);if(sy!==null)drawAlignmentGuide('y',sy)}
 return{x:nx,y:ny};
}
function cancelDuplicatePlacement(){
 pendingDuplicateSource=null;document.body.classList.remove('duplicate-place-mode');status.textContent='已取消複製放置';
}
function startDuplicatePlacement(el=selected){
 if(!el?.classList?.contains('component')||el.dataset.user!=='1'){status.textContent='請先選取設備物件再複製';return}
 pendingComponent='';pendingCustomDefinition=null;pendingDuplicateSource=el;setTool('select');
 document.body.classList.add('duplicate-place-mode');
 status.textContent='複製 '+(el.dataset.name||'設備')+'：請點圖面新位置；Esc 可取消';
}
function cloneComponentAt(source,p){
 if(!source?.classList?.contains('component'))return null;
 const q=smartAlignPoint(snapGridPoint(p),source,false),clone=source.cloneNode(true);
 clone.dataset.uid='cmp-'+Date.now()+'-'+Math.floor(Math.random()*99999);
 clone.dataset.name=(source.dataset.name||objectTypeText(source)||'設備')+' 副本';
 clone.dataset.x=q.x.toFixed(1);clone.dataset.y=q.y.toFixed(1);clone.dataset.powerChildren='[]';clone.dataset.locked='no';clone.dataset.photoCount='0';
 delete clone.dataset.detailExpanded;delete clone.dataset.panelPhoto;delete clone.dataset.panelPhotoMarks;delete clone.dataset.panelPhotoCount;
 (source.parentElement||qs('componentLayer')).appendChild(clone);
 if(clone.dataset.kind==='customDevice'){applyCustomDeviceAppearance(clone);moveCustomDeviceLayer(clone)}
 if(clone.dataset.kind==='threeWay')updateThreeWayVisual(clone);
 applyComponentVisual(clone);pendingDuplicateSource=null;document.body.classList.remove('duplicate-place-mode');
 fill(clone);refreshList();rebuildPowerRelations();autosave();applyViewFilters();
 status.textContent='已複製：'+clone.dataset.name;return clone;
}
const BUILDING_FOCUS={
 farrowingA:{
   label:'產房A 42床',
   points:[[157,38],[680,134],[646,333],[127,214]]
 },
 farrowingB:{
   label:'產房B 36床',
   points:[[125,206],[648,321],[590,520],[124,408]]
 },
 farrowingC:{
   label:'產房C 36床',
   points:[[739,137],[1197,242],[1157,446],[700,338]]
 },
 farrowingD:{
   label:'產房D 36床',
   points:[[700,338],[1157,446],[1110,645],[625,520]]
 },
 boar:{
   label:'公豬舍',
   points:[[235,510],[546,510],[585,531],[585,659],[235,659]]
 },
 giltBreeding:{
   label:'新女豬育成區 / 配種區',
   points:[[158,666],[1092,666],[1092,806],[158,806]]
 },
 gestationUpper:{
   label:'妊娠舍（上棟）',
   points:[[159,824],[1095,824],[1095,972],[159,972]]
 },
 gestationLower:{
   label:'妊娠舍（下棟）',
   points:[[158,1024],[1097,1024],[1097,1181],[158,1181]]
 }
};
function buildingFocusBounds(box){
 if(Array.isArray(box?.points)&&box.points.length){
   const xs=box.points.map(p=>Number(p[0])),ys=box.points.map(p=>Number(p[1]));
   const x=Math.min(...xs),y=Math.min(...ys),x2=Math.max(...xs),y2=Math.max(...ys);
   return{x,y,w:x2-x,h:y2-y};
 }
 return{x:Number(box.x||0),y:Number(box.y||0),w:Number(box.w||1),h:Number(box.h||1)};
}
function clearBuildingFocus(){const g=qs('focusGuideLayer');if(g)g.innerHTML=''}
function showBuildingFocus(box){
 clearBuildingFocus();const g=qs('focusGuideLayer');if(!g)return;
 if(Array.isArray(box?.points)&&box.points.length){
   g.appendChild(mk('polygon',{
     points:box.points.map(p=>p.join(',')).join(' '),
     class:'building-focus-polygon'
   }));
 }else{
   g.appendChild(mk('rect',{x:box.x,y:box.y,width:box.w,height:box.h,rx:6,class:'building-focus-box'}));
 }
 setTimeout(clearBuildingFocus,1600);
}
function zoomToBuilding(key){
 const box=BUILDING_FOCUS[key];if(!box){status.textContent='找不到棟舍定位資料';return}pushViewState();
 const focus=buildingFocusBounds(box),rect=svg.getBoundingClientRect(),vb=svg.viewBox.baseVal;
 const clientW=Math.max(320,rect.width||canvasWrap.clientWidth||800),clientH=Math.max(320,rect.height||canvasWrap.clientHeight||700);
 const baseScale=Math.min(clientW/vb.width,clientH/vb.height);
 const padX=clientW<600?42:84,padY=clientH<700?92:76;
 const targetScale=Math.min(Math.max(80,clientW-padX*2)/focus.w,Math.max(100,clientH-padY*2)/focus.h);
 zoom=Math.max(.5,Math.min(5,targetScale/Math.max(.0001,baseScale)));
 const cx=focus.x+focus.w/2,cy=focus.y+focus.h/2;
 pan={x:vb.x+vb.width/2-zoom*cx,y:vb.y+vb.height/2-zoom*cy};
 tf();showBuildingFocus(box);
 status.textContent=`已精準定位：${box.label}｜${Math.round(zoom*100)}%`;
}


function objectLocked(el){return !!(el?.classList?.contains('component')&&el.dataset.locked==='yes')}
function syncObjectLockUi(el=selected){
 const locked=objectLocked(el),isComp=!!el?.classList?.contains('component'),btn=qs('selectionLockBtn');
 if(btn){btn.style.display=isComp?'':'none';btn.textContent=locked?'🔓':'🔒';btn.title=locked?'解鎖位置與尺寸':'鎖定位置與尺寸';btn.classList.toggle('active',locked)}
 ['x','y','rotation','iconScale','shapeScaleX','shapeScaleY','shapeLock'].forEach(k=>{if(fields[k])fields[k].disabled=locked});
}
function toggleSelectedLock(){
 if(!selected?.classList?.contains('component'))return;
 const next=objectLocked(selected)?'no':'yes';selected.dataset.locked=next;applyComponentVisual(selected);syncObjectLockUi(selected);renderComponentHandles(selected);autosave();refreshList();updateSelectionActionBar(selected);
 status.textContent=(next==='yes'?'已鎖定：':'已解鎖：')+(selected.dataset.name||'設備');
}
function updatePhotoAction(el=selected){
 const btn=qs('selectionPhotoBtn');if(!btn)return;const n=Math.max(0,parseInt(el?.dataset?.photoCount||'0',10)||0);btn.textContent=n>0?`📷${n}`:'📷';btn.title=n>0?`現場照片 ${n} 張`:'現場拍照';
}
function captureView(){return{zoom,pan:{x:pan.x,y:pan.y}}}
function updateViewBackBtn(){if(qs('viewBackBtn'))qs('viewBackBtn').disabled=!viewHistory.length}
function pushViewState(){
 const v=captureView(),last=viewHistory[viewHistory.length-1];
 if(last&&Math.abs(last.zoom-v.zoom)<.001&&Math.abs(last.pan.x-v.pan.x)<.1&&Math.abs(last.pan.y-v.pan.y)<.1)return;
 viewHistory.push(v);if(viewHistory.length>12)viewHistory.shift();updateViewBackBtn();
}
function goBackView(){const v=viewHistory.pop();if(!v)return;zoom=v.zoom;pan={...v.pan};tf();updateViewBackBtn();status.textContent='已回上一個視圖'}
function focusComponent(el){
 if(!el?.classList?.contains('component'))return;pushViewState();
 el.style.display='';if(el.parentElement)el.parentElement.style.display='';
 const p=componentXY(el),rect=svg.getBoundingClientRect(),target=rect.width<600?4.2:3.0;
 zoom=Math.max(.8,Math.min(5,target));const vb=svg.viewBox.baseVal;pan={x:vb.x+vb.width/2-zoom*p.x,y:vb.y+vb.height/2-zoom*p.y};tf();fill(el);showObjectDetail(el);status.textContent='已定位：'+(el.dataset.name||objectTypeText(el));
}
function closeDeviceSearch(){qs('deviceSearchPanel')?.classList.remove('show');qs('deviceSearchPanel')?.setAttribute('aria-hidden','true');qs('quickSearchBtn')?.classList.remove('active')}
function openSearchMatch(result){
 closeDeviceSearch();focusComponent(result.panel||result.component);
 if(result.panel){
  openPanelEditor(result.panel);
  if(result.markUid){
   setPanelEditorTab('photo');
   const mark=(panelDraft.photoMarks||[]).find(m=>String(m.uid)===String(result.markUid));
   if(mark){loadPhotoMarkEditor(mark);status.textContent='已找到配電箱照片標記：'+photoMarkCode(mark)}
  }else if(result.circuitId){
   setPanelEditorTab('circuits');
   const tr=[...qs('panelCircuitBody').querySelectorAll('tr[data-ci]')].find(tr=>tr.querySelector('[data-f="id"]')?.value===result.circuitId);
   if(tr){tr.scrollIntoView({block:'center',behavior:'smooth'});tr.style.outline='3px solid #f5d05b';setTimeout(()=>tr.style.removeProperty('outline'),3500)}
   status.textContent='已找到配電箱迴路：'+result.circuitId;
  }
 }
}
function renderDeviceSearch(query=''){
 const box=qs('deviceSearchResults');if(!box)return;const q=String(query||'').trim().toLowerCase();
 if(!q){box.innerHTML='<div class="tiny">搜尋圖面設備、配電箱照片標記或迴路編號。</div>';return}
 const results=[];
 const components=[...document.querySelectorAll('.component[data-user="1"]')];
 for(const c of components){
  const info=[c.dataset.name,c.dataset.building,c.dataset.mainFunction,c.dataset.kind,c.dataset.spec,c.dataset.note,c.dataset.uid];
  if(info.join(' ').toLowerCase().includes(q))results.push({component:c,name:c.dataset.name||objectTypeText(c),detail:[c.dataset.building,objectTypeText(c)].filter(Boolean).join('｜')});
  if(!isPanel(c))continue;
  const marks=safeJson(c.dataset.panelPhotoMarks,[]);
  if(Array.isArray(marks))for(const mark of marks){
   const terms=[mark.circuitId,mark.breaker,mark.functionName,mark.purpose,mark.loadName,mark.sourceFrom,mark.targetTo,mark.detail,mark.note];
   if(terms.join(' ').toLowerCase().includes(q))results.push({panel:c,markUid:mark.uid,name:mark.circuitId||mark.breaker||'照片標記',detail:'📷 '+(c.dataset.name||'配電箱')+'｜'+(mark.functionName||'照片標記')});
  }
  const circuits=safeJson(c.dataset.panelCircuits,[]);
  if(Array.isArray(circuits))for(const circuit of circuits){
   const terms=[circuit.id,circuit.loadName,circuit.groupArea,circuit.controlMode,circuit.note];
   if(terms.join(' ').toLowerCase().includes(q))results.push({panel:c,circuitId:String(circuit.id||''),name:String(circuit.id||'未編號迴路'),detail:'⚡ '+(c.dataset.name||'配電箱')+'｜'+(circuit.loadName||'迴路')});
  }
 }
 box.innerHTML='';if(!results.length){box.innerHTML='<div class="tiny">找不到符合項目。請確認該設備或照片標記已儲存到目前專案。</div>';return}
 results.slice(0,30).forEach(result=>{const btn=document.createElement('button');btn.type='button';btn.className='device-search-result';const n=document.createElement('b');n.textContent=result.name;const detail=document.createElement('span');detail.textContent=result.detail;btn.append(n,detail);btn.onclick=()=>openSearchMatch(result);box.appendChild(btn)});
 if(results.length>30){const p=document.createElement('div');p.className='tiny';p.textContent='顯示前 30 筆，請輸入更完整的名稱以縮小範圍。';box.appendChild(p)}
}
function toggleDeviceSearch(){const p=qs('deviceSearchPanel'),open=!p.classList.contains('show');p.classList.toggle('show',open);p.setAttribute('aria-hidden',open?'false':'true');qs('quickSearchBtn')?.classList.toggle('active',open);if(open){renderDeviceSearch(qs('deviceSearchInput')?.value||'');setTimeout(()=>qs('deviceSearchInput')?.focus(),40)}}

function clearComponentHandles(){
 const layer=qs('selectionHandlesLayer');if(layer)layer.innerHTML='';
}
function componentBaseBBox(el){
 if(!el?.classList?.contains('component'))return{x:-30,y:-25,width:60,height:50};
 const shapes=[...el.children].filter(n=>['rect','circle','line','path','ellipse','polygon'].includes((n.tagName||'').toLowerCase())&&!n.classList?.contains('selection-ui'));
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 shapes.forEach(n=>{try{const b=n.getBBox();minX=Math.min(minX,b.x);minY=Math.min(minY,b.y);maxX=Math.max(maxX,b.x+b.width);maxY=Math.max(maxY,b.y+b.height)}catch(e){}});
 if(!isFinite(minX))return{x:-30,y:-25,width:60,height:50};
 const pad=4;return{x:minX-pad,y:minY-pad,width:(maxX-minX)+pad*2,height:(maxY-minY)+pad*2};
}
function localPointToViewport(el,x,y){
 const m=el.transform.baseVal.consolidate()?.matrix;if(!m)return{x,y};
 return{x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f};
}
function renderComponentHandles(el=selected){
 clearComponentHandles();
 if(!el?.classList?.contains('component')||el.dataset.user!=='1'||tool!=='select'||objectLocked(el))return;
 const layer=qs('selectionHandlesLayer'),b=componentBaseBBox(el);
 const p1=localPointToViewport(el,b.x,b.y),p2=localPointToViewport(el,b.x+b.width,b.y),p3=localPointToViewport(el,b.x+b.width,b.y+b.height),p4=localPointToViewport(el,b.x,b.y+b.height);
 const right=localPointToViewport(el,b.x+b.width,b.y+b.height/2);
 const bottom=localPointToViewport(el,b.x+b.width/2,b.y+b.height);
 const uniform=p3;
 const center=localPointToViewport(el,0,0);
 const top=localPointToViewport(el,b.x+b.width/2,b.y);
 let vx=top.x-center.x,vy=top.y-center.y,vl=Math.hypot(vx,vy)||1;vx/=vl;vy/=vl;
 const rotate={x:top.x+vx*28,y:top.y+vy*28};
 const poly=mk('polygon',{points:[p1,p2,p3,p4].map(p=>`${p.x},${p.y}`).join(' '),class:'selection-outline'});layer.appendChild(poly);
 layer.appendChild(mk('line',{x1:top.x,y1:top.y,x2:rotate.x,y2:rotate.y,class:'selection-rotate-line'}));
 const addHandle=(pos,mode,label)=>{
   const c=mk('circle',{cx:pos.x,cy:pos.y,r:6,class:`transform-handle ${mode}`,'data-transform-handle':mode});
   c.setAttribute('title',label);layer.appendChild(c);
 };
 addHandle(uniform,'uniform','整體大小');
 addHandle(right,'width','調整寬度');
 addHandle(bottom,'height','調整高度');
 addHandle(rotate,'rotate','旋轉角度');
 const cap=mk('text',{x:rotate.x+9,y:rotate.y-7,class:'selection-handle-caption'});cap.textContent='旋轉';layer.appendChild(cap);
}
function componentLocalVector(p,center,rotationDeg){
 const r=rotationDeg*Math.PI/180,c=Math.cos(r),s=Math.sin(r),dx=p.x-center.x,dy=p.y-center.y;
 return{x:c*dx+s*dy,y:-s*dx+c*dy};
}
function beginComponentHandleDrag(e,mode){
 if(!selected?.classList?.contains('component')||objectLocked(selected))return;
 const p=pt(e),cx=parseFloat(selected.dataset.x)||0,cy=parseFloat(selected.dataset.y)||0,rot=parseFloat(selected.dataset.rotation)||0;
 const b=componentBaseBBox(selected),sc=parseFloat(selected.dataset.iconScale)||.8,sx=parseFloat(selected.dataset.shapeScaleX)||1,sy=parseFloat(selected.dataset.shapeScaleY)||1;
 handleDrag={mode,el:selected,cx,cy,rot,sc,sx,sy,bbox:b,start:p,startDistance:Math.max(1,Math.hypot(p.x-cx,p.y-cy)),startAngle:Math.atan2(p.y-cy,p.x-cx)*180/Math.PI};
 document.body.classList.add('component-transforming');
 e.preventDefault();e.stopPropagation();
}
function updateComponentHandleDrag(e){
 if(!handleDrag)return false;
 const p=pt(e),h=handleDrag,el=h.el;
 if(h.mode==='uniform'){
   const d=Math.max(1,Math.hypot(p.x-h.cx,p.y-h.cy));
   const sc=Math.max(.2,Math.min(5,h.sc*d/h.startDistance));
   el.dataset.iconScale=sc.toFixed(2);fields.iconScale.value=sc.toFixed(2);
 }else if(h.mode==='rotate'){
   let ang=Math.atan2(p.y-h.cy,p.x-h.cx)*180/Math.PI;
   let nr=h.rot+(ang-h.startAngle);
   while(nr>180)nr-=360;while(nr<=-180)nr+=360;
   if(e.shiftKey)nr=Math.round(nr/5)*5;
   else if(!e.altKey){const snap45=Math.round(nr/45)*45;if(Math.abs(nr-snap45)<=4)nr=snap45}
   el.dataset.rotation=nr.toFixed(1);fields.rotation.value=nr.toFixed(1);
 }else{
   const lv=componentLocalVector(p,{x:h.cx,y:h.cy},h.rot),halfW=Math.max(8,Math.max(Math.abs(h.bbox.x),Math.abs(h.bbox.x+h.bbox.width))),halfH=Math.max(8,Math.max(Math.abs(h.bbox.y),Math.abs(h.bbox.y+h.bbox.height)));
   if(h.mode==='width'){
     const nsx=Math.max(.3,Math.min(3,Math.abs(lv.x)/(halfW*(parseFloat(el.dataset.iconScale)||h.sc))));
     el.dataset.shapeScaleX=nsx.toFixed(2);fields.shapeScaleX.value=nsx.toFixed(2);
   }else if(h.mode==='height'){
     const nsy=Math.max(.3,Math.min(3,Math.abs(lv.y)/(halfH*(parseFloat(el.dataset.iconScale)||h.sc))));
     el.dataset.shapeScaleY=nsy.toFixed(2);fields.shapeScaleY.value=nsy.toFixed(2);
   }
   el.dataset.shapeLock='no';fields.shapeLock.value='no';
 }
 applyComponentVisual(el);updateConnectedRoutes(el.dataset.uid);renderComponentHandles(el);positionObjectDetail();
 status.textContent=`調整 ${el.dataset.name||'設備'}｜大小 ${el.dataset.iconScale||'—'}×｜寬 ${el.dataset.shapeScaleX||'1'}｜高 ${el.dataset.shapeScaleY||'1'}｜角度 ${el.dataset.rotation||'0'}°`;
 return true;
}
function endComponentHandleDrag(){
 if(!handleDrag)return;
 const el=handleDrag.el;handleDrag=null;document.body.classList.remove('component-transforming');
 applyComponentVisual(el);renderComponentHandles(el);autosave();refreshList();
}

function fill(el){
 qs('routeEditLayer')?.remove();selected?.classList.remove('selected');selected=el;if(el&&!el.classList.contains('hotspot'))el.classList.add('selected');clearFields();
 if(!el){window.refreshDeviceRelevantFields?.(null);clearComponentHandles();hideSelectionActionBar();syncObjectLockUi(null);if(qs('editCustomDeviceBtn'))qs('editCustomDeviceBtn').style.display='none';updateFieldPhotoTarget(null);status.textContent='工具：'+tool+'｜尺寸顯示 1 位小數。';return}
 fields.name.value=el.dataset.name||'';fields.mainFunction.value=el.dataset.mainFunction||objectMainFunction(el);fields.type.value=el.dataset.area||el.dataset.kind||el.tagName||'';fields.note.value=el.dataset.note||'';fields.rotation.value=el.dataset.rotation||0;fields.iconScale.value=el.dataset.iconScale||0.8;fields.shapeScaleX.value=el.dataset.shapeScaleX||1;fields.shapeScaleY.value=el.dataset.shapeScaleY||1;fields.shapeLock.value=el.dataset.shapeLock||'yes';fields.labelScale.value=el.dataset.labelScale||0.9;fields.showLabel.value=el.dataset.showLabel||'yes';fields.building.value=el.dataset.building||'';fields.sourceA.value=el.dataset.sourceA||'';fields.sourceB.value=el.dataset.sourceB||'';fields.target.value=el.dataset.target||'';fields.spec.value=el.dataset.spec||'';fields.lineSize.value=el.dataset.lineSize||'';fields.routeLength.value=el.tagName==='polyline'?(el.dataset.length||routeLength(routePoints(el)).toFixed(1))+' 圖面單位':'';fields.realLength.value=el.tagName==='polyline'?(el.dataset.realLength?el.dataset.realLength+' m':(scaleFactor?(routeLength(routePoints(el))*scaleFactor).toFixed(2)+' m':'尚未校正')):'';fields.powerParent.value=el.dataset.powerParentName||'';fields.powerKw.value=el.dataset.powerKw||'';fields.airflow.value=el.dataset.airflow||'';fields.staticPa.value=el.dataset.staticPa||'';fields.emergencyClass.value=el.dataset.emergencyClass||'';fields.switchState.value=el.dataset.switchState||'';fields.backup.value=el.dataset.backup||'';
 if(el.classList.contains('component')){const p=componentXY(el);fields.x.value=p.x.toFixed(1);fields.y.value=p.y.toFixed(1);applyComponentVisual(el)}else if(el.tagName==='line'){fields.x.value=(+el.getAttribute('x1')).toFixed(1);fields.y.value=(+el.getAttribute('y1')).toFixed(1)}else if(el.tagName==='polyline'){const ps=routePoints(el);if(ps.length){fields.x.value=ps[0].x.toFixed(1);fields.y.value=ps[0].y.toFixed(1)}renderRouteNodes(el)}
 updatePowerPathDisplay(el);syncValvePanel(el);syncSourceConfig(el);updateSimplePropertyVisibility(el);window.refreshDeviceRelevantFields?.(el);if(qs('editCustomDeviceBtn'))qs('editCustomDeviceBtn').style.display=el.dataset?.kind==='customDevice'?'':'none';syncObjectLockUi(el);renderComponentHandles(el);updateSelectionActionBar(el);updateFieldPhotoTarget(el);status.textContent='已選取：'+(el.dataset.name||el.tagName);
}
function mk(tag,attrs={}){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));return el}
// 6.9.40 自由外框吸附：非閥門設備允許沿四邊連續滑動，位置記錄為 EDGE:邊號:比例。
// 特殊三向閥必須保留 A/B/C/OUT 的語意端點，才能安全追蹤供水流向。
function edgePoint(el,edge,t){
 const b=componentBaseBBox(el), u=Math.max(0,Math.min(1,t));
 const points=[{x:b.x+u*b.width,y:b.y}, {x:b.x+b.width,y:b.y+u*b.height},
 {x:b.x+(1-u)*b.width,y:b.y+b.height},{x:b.x,y:b.y+(1-u)*b.height}];
 return localPointToViewport(el,(points[edge]||points[0]).x,(points[edge]||points[0]).y);
}
function nearestComponentEdge(el,p){
 const b=componentBaseBBox(el);
 const corners=[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]].map(q=>localPointToViewport(el,q[0],q[1]));
 let best=null;
 for(let edge=0;edge<4;edge++){
  const a=corners[edge],c=corners[(edge+1)%4],dx=c.x-a.x,dy=c.y-a.y,len2=dx*dx+dy*dy;
  const t=Math.max(0,Math.min(1,len2?((p.x-a.x)*dx+(p.y-a.y)*dy)/len2:0));
  const x=a.x+t*dx,y=a.y+t*dy,dist=Math.hypot(x-p.x,y-p.y);
  if(!best||dist<best.dist)best={x,y,dist,name:`EDGE:${edge}:${t.toFixed(4)}`,el};
 }
 return best;
}
function componentPortCandidates(){
 const out=[];document.querySelectorAll('.component[data-user="1"]').forEach(g=>{
   if(g.dataset.kind==='threeWay'){
    const p=componentXY(g),sc=parseFloat(g.dataset.iconScale||1);
    [['A',0,-30],['B',-28,20],['C',28,20],['OUT',34,-12]].forEach(([name,x,y])=>out.push({x:p.x+x*sc,y:p.y+y*sc,name,el:g}));
   }
 });return out;
}
function nearestSnap(p,r=26){
 if(qs('snapMode')?.value==='off')return null;
 let best=null,bd=r;
 for(const q of componentPortCandidates()){const d=Math.hypot(q.x-p.x,q.y-p.y);if(d<bd){bd=d;best=q}}
 for(const g of document.querySelectorAll('.component[data-user="1"]')){
  if(g.dataset.kind==='threeWay')continue;
  const q=nearestComponentEdge(g,p);
  if(q&&q.dist<bd){bd=q.dist;best=q}
 }
 return best;
}
function showSnap(q){if(snapVisual){snapVisual.remove();snapVisual=null}if(!q)return; snapVisual=mk('circle',{cx:q.x,cy:q.y,r:10,class:'snap-ring'});qs('annoLayer').appendChild(snapVisual)}
function findComponent(uid){return uid?document.querySelector(`.component[data-uid="${uid}"]`):null}
function portPosition(el,name){
 if(!el)return null;
 if(typeof name==='string'&&name.startsWith('EDGE:')){
  const parts=name.split(':'),side=Number(parts[1]),t=Number(parts[2]);
  if(Number.isInteger(side)&&side>=0&&side<4&&Number.isFinite(t))return edgePoint(el,side,t);
 }
 const p=componentXY(el),sc=parseFloat(el.dataset.iconScale||1),d=30*sc;
 if(name==='N'||name==='A')return{x:p.x,y:p.y-d};
 if(name==='E')return{x:p.x+d,y:p.y};
 if(name==='S')return{x:p.x,y:p.y+d};
 if(name==='W')return{x:p.x-d,y:p.y};
 if(name==='B')return{x:p.x-28*sc,y:p.y+20*sc};
 if(name==='C')return{x:p.x+28*sc,y:p.y+20*sc};
 if(name==='OUT')return{x:p.x+34*sc,y:p.y-12*sc};return p;
}
// V6.9.40：只沿已記錄設備端點的水線追蹤；未指定端點的線不自動接通。
function refreshWaterFlow(){
 const lines=[...document.querySelectorAll('#waterLayer polyline[data-user="1"]')];
 const components=[...document.querySelectorAll('.component[data-user="1"][data-uid]')];
 const byUid=new Map(components.map(c=>[c.dataset.uid,c]));
 const links=new Map();
 const edgeInfo=[];
 const add=(node,edge)=>{if(!links.has(node))links.set(node,[]);links.get(node).push(edge)};
 for(const line of lines){
  const a=line.dataset.startComponent,b=line.dataset.endComponent;
  // 不能以圖上線條相交推測接通，也不能把沒有雙端連接的線當已供水。
  if(!a||!b||!byUid.has(a)||!byUid.has(b)){edgeInfo.push({line,valid:false});continue}
  const left=byUid.get(a),right=byUid.get(b);
  const ap=left.dataset.kind==='threeWay'?(line.dataset.startPort||''):null;
  const bp=right.dataset.kind==='threeWay'?(line.dataset.endPort||''):null;
  if((left.dataset.kind==='threeWay'&&!['A','B','C','OUT'].includes(ap))||(right.dataset.kind==='threeWay'&&!['A','B','C','OUT'].includes(bp))){edgeInfo.push({line,valid:false});continue}
  const na=a+(ap?':'+ap:''),nb=b+(bp?':'+bp:'');
  const item={line,valid:true,na,nb};edgeInfo.push(item);
  add(na,{to:nb,line});add(nb,{to:na,line});
 }
 // 一般設備的所有管線端點共用同一個節點；三向閥則只允許目前入口通往 OUT。
 for(const c of components){
  if(c.dataset.kind!=='threeWay')continue;
  const active=c.dataset.valveActivePort;
  if(!['A','B','C'].includes(active))continue;
  const inlet=c.dataset.uid+':'+active,outlet=c.dataset.uid+':OUT';
  add(inlet,{to:outlet,valve:true});
  // 不從 OUT 反灌到入口，避免標示錯誤的水源路徑。
 }
 const sourceKinds=new Set(['cityWater','groundWater','groundWell','waterTower','cityOutlet','groundOutlet','towerOutlet']);
 const seeds=components.filter(c=>sourceKinds.has(c.dataset.kind)).map(c=>c.dataset.uid);
 const seen=new Set(seeds),activated=new Set(),queue=[...seeds];
 for(let i=0;i<queue.length&&i<100000;i++){
  const at=queue[i];
  for(const edge of links.get(at)||[]){
   if(edge.line)activated.add(edge.line);
   if(!seen.has(edge.to)){seen.add(edge.to);queue.push(edge.to)}
  }
 }
 const standby=new Set();
 for(const item of edgeInfo){
  if(!item.valid||activated.has(item.line))continue;
  for(const v of components){
   if(v.dataset.kind!=='threeWay')continue;
   const inactive=['A','B','C'].filter(p=>p!==v.dataset.valveActivePort);
   if(inactive.some(p=>item.na===v.dataset.uid+':'+p||item.nb===v.dataset.uid+':'+p)){standby.add(item.line);break}
  }
 }
 let on=0,back=0,unknown=0;
 for(const line of lines){
  const state=activated.has(line)?'active':standby.has(line)?'standby':'unconnected';
  line.dataset.flowState=state;
  line.style.opacity=state==='active'?'1':state==='standby'?'0.58':'0.32';
  line.style.strokeDasharray=state==='active'?'none':state==='standby'?'7 5':'2 7';
  line.style.strokeWidth=state==='active'?'4':'2.6';
  line.setAttribute('title',state==='active'?'已連通的規劃供水路徑':state==='standby'?'三向閥非選定入口（備用）':'未連通／未確認端點');
  if(state==='active')on++;else if(state==='standby')back++;else unknown++;
 }
 const indicator=document.getElementById('waterTraceCounts');
 if(indicator)indicator.textContent=`連通 ${on}｜備用 ${back}｜未確認 ${unknown}`;
}
function syncValveFromWaterRoutes(){
 const valves=[...document.querySelectorAll('.component[data-user="1"][data-kind="threeWay"]')];
 valves.forEach(v=>{
   const connections={A:[],B:[],C:[],OUT:[]};
   document.querySelectorAll('#waterLayer polyline[data-user="1"]').forEach(r=>{
     const ends=[['startComponent','startPort','endComponent'],['endComponent','endPort','startComponent']];
     ends.forEach(([uidKey,portKey,otherKey])=>{
       if(r.dataset[uidKey]!==v.dataset.uid)return;
       const port=r.dataset[portKey];if(!connections[port])return;
       const other=findComponent(r.dataset[otherKey]);
       connections[port].push({route:r,other});
     });
   });
   ['A','B','C'].forEach(port=>{
      const entry=connections[port].find(x=>x.other&&waterKindName(x.other.dataset.kind));
      if(entry)v.dataset['valveSource'+port]=waterKindName(entry.other.dataset.kind);
   });
   const out=connections.OUT.find(x=>x.other);
   if(out)v.dataset.valveOutlet=out.other.dataset.name||'出水設備';
   v.dataset.valveConnections=JSON.stringify(Object.fromEntries(Object.entries(connections).map(([k,a])=>[k,a.length])));
   v.dataset.switchState=valveSourceByPort(v,v.dataset.valveActivePort);
   updateThreeWayVisual(v);
   if(selected===v)syncValvePanel(v);
 });
 refreshWaterFlow();
}
function updateConnectedRoutes(uid){document.querySelectorAll('polyline[data-user="1"]').forEach(r=>{let pts=routePoints(r),changed=false;if(!pts.length)return;if(r.dataset.startComponent===uid){const c=findComponent(uid),q=portPosition(c,r.dataset.startPort);if(q){pts[0]=q;changed=true}}if(r.dataset.endComponent===uid){const c=findComponent(uid),q=portPosition(c,r.dataset.endPort);if(q){pts[pts.length-1]=q;changed=true}}if(changed)setRoutePoints(r,pts)});rebuildPowerRelations();syncValveFromWaterRoutes();refreshStats()}
function powerComponents(){const connected=new Set();document.querySelectorAll('#elecLayer polyline[data-user="1"]').forEach(r=>{if(r.dataset.startComponent)connected.add(r.dataset.startComponent);if(r.dataset.endComponent)connected.add(r.dataset.endComponent)});const panelKinds=new Set(['utilityPower','generator','ats','mainSwitch','mainPanel','subPanel','equipmentPanel','exhaustFan','guideFan','coolingPump','heatLamp']);return [...document.querySelectorAll('.component[data-user="1"]')].filter(c=>panelKinds.has(c.dataset.kind)||connected.has(c.dataset.uid)||parseFloat(c.dataset.powerKw||0)>0)}
function rebuildPowerRelations(){powerComponents().forEach(c=>{c.dataset.powerParent='';c.dataset.powerParentName='';c.dataset.powerChildren='[]';if(c.dataset.kind==='ats'){c.dataset.atsUtilitySource='';c.dataset.atsUtilitySourceName='';c.dataset.atsGeneratorSource='';c.dataset.atsGeneratorSourceName=''}});document.querySelectorAll('#elecLayer polyline[data-user="1"]').forEach(r=>{const sEl=findComponent(r.dataset.startComponent),tEl=findComponent(r.dataset.endComponent);if(!sEl||!tEl)return;r.dataset.powerSource=sEl.dataset.uid;r.dataset.powerTarget=tEl.dataset.uid;r.dataset.sourceA=sEl.dataset.name||'';r.dataset.target=tEl.dataset.name||'';if(tEl.dataset.kind==='ats'&&sEl.dataset.kind==='utilityPower'){tEl.dataset.atsUtilitySource=sEl.dataset.uid;tEl.dataset.atsUtilitySourceName=sEl.dataset.name||'台電';return}if(tEl.dataset.kind==='ats'&&sEl.dataset.kind==='generator'){tEl.dataset.atsGeneratorSource=sEl.dataset.uid;tEl.dataset.atsGeneratorSourceName=sEl.dataset.name||'發電機';return}tEl.dataset.powerParent=sEl.dataset.uid;tEl.dataset.powerParentName=sEl.dataset.name||labels[sEl.dataset.kind]||'上游';let ch=[];try{ch=JSON.parse(sEl.dataset.powerChildren||'[]')}catch(e){}if(!ch.includes(tEl.dataset.uid))ch.push(tEl.dataset.uid);sEl.dataset.powerChildren=JSON.stringify(ch)});renderPowerTree();refreshEmergencySimulator();if(selected){updatePowerPathDisplay(selected);syncSourceConfig(selected)}}
function powerPathFor(el){if(!el?.classList?.contains('component'))return[];const path=[el];let cur=el,guard=0;while(cur?.dataset?.powerParent&&guard++<20){cur=findComponent(cur.dataset.powerParent);if(!cur)break;path.unshift(cur)}return path}
function atsSourcesText(el){if(el?.dataset?.kind!=='ats')return'';const u=el.dataset.atsUtilitySourceName||'台電未接',g=el.dataset.atsGeneratorSourceName||'發電機未接';return `${u} + ${g} → ATS`}
function updatePowerPathDisplay(el){const box=qs('powerPath');if(!box)return;if(!el?.classList?.contains('component')){box.textContent='選取已接電線的風扇、泵浦或電箱，可反查：總開關箱 → 總配電箱 → 分電箱 → 設備。';return}const path=powerPathFor(el);fields.powerParent.value=el.dataset.powerParentName||'';box.textContent=el.dataset.kind==='ats'?atsSourcesText(el):(path.length>1?path.map(x=>x.dataset.name||labels[x.dataset.kind]||'設備').join(' → '):'尚未建立上游電線連接');}
function renderPowerTree(){const box=qs('powerTree');if(!box)return;const comps=powerComponents();if(!comps.length){box.textContent='尚未建立電路連線';return}const childIds=new Set(comps.filter(x=>x.dataset.powerParent).map(x=>x.dataset.uid));let roots=comps.filter(x=>!childIds.has(x.dataset.uid)&&['utilityPower','generator','ats','mainSwitch','mainPanel','subPanel','equipmentPanel'].includes(x.dataset.kind));if(!roots.length)roots=comps.filter(x=>!x.dataset.powerParent);const byParent={};comps.forEach(c=>{const p=c.dataset.powerParent||'';(byParent[p]||(byParent[p]=[])).push(c)});const html=[];const walk=(c,depth)=>{const isPanel=['utilityPower','generator','ats','mainSwitch','mainPanel','subPanel','equipmentPanel'].includes(c.dataset.kind);const cls=depth===0?'power-root':(isPanel?'power-child':'power-load');html.push(`<div class="power-node ${cls}" data-puid="${c.dataset.uid}" style="padding-left:${5+depth*14}px">${'↳ '.repeat(depth)}${c.dataset.name||labels[c.dataset.kind]||'設備'}${c.dataset.powerKw?` <span class="badge">${c.dataset.powerKw} kW</span>`:''}</div>`);(byParent[c.dataset.uid]||[]).forEach(ch=>walk(ch,depth+1))};roots.forEach(r=>walk(r,0));box.innerHTML=html.join('')||'尚未建立電路連線';box.querySelectorAll('[data-puid]').forEach(n=>n.onclick=()=>{const el=findComponent(n.dataset.puid);if(el)fill(el)})}

function routePoints(el){return (el.getAttribute('points')||'').trim().split(/\s+/).filter(Boolean).map(s=>{const [x,y]=s.split(',').map(Number);return{x,y}})}
function setRoutePoints(el,pts){el.setAttribute('points',pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));el.dataset.points=JSON.stringify(pts.map(p=>[+p.x.toFixed(1),+p.y.toFixed(1)]));el.dataset.length=routeLength(pts).toFixed(1);const m=metersFromUnits(routeLength(pts));el.dataset.realLength=m==null?'':m.toFixed(2)}
function routeLength(pts){let d=0;for(let i=1;i<pts.length;i++)d+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);return d}

function freeRoutePoint(last,p,e=null){
 if(qs('routeMode')?.value==='ortho')return orthogonalPoint(last,p);
 if(e?.shiftKey){
   const dx=p.x-last.x,dy=p.y-last.y,len=Math.hypot(dx,dy);
   if(len<.001)return p;
   const step=Math.PI/12; // 15°
   const a=Math.round(Math.atan2(dy,dx)/step)*step;
   return{x:last.x+Math.cos(a)*len,y:last.y+Math.sin(a)*len};
 }
 return p;
}
function routeAngleDeg(a,b){
 let deg=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
 if(deg<0)deg+=360;
 return deg;
}
function updateRouteAngleBadge(last,q){
 const badge=qs('routeAngleBadge');if(!badge||!last||!q)return;
 const len=Math.hypot(q.x-last.x,q.y-last.y);
 badge.textContent=`角度 ${routeAngleDeg(last,q).toFixed(1)}°｜本段 ${len.toFixed(1)}`;
}

function orthogonalPoint(last,p){if(qs('routeMode')?.value!=='ortho')return p; const dx=Math.abs(p.x-last.x),dy=Math.abs(p.y-last.y);return dx>=dy?{x:p.x,y:last.y}:{x:last.x,y:p.y}}
function beginRoute(kind,p,snap){const poly=mk('polyline',{points:`${p.x.toFixed(1)},${p.y.toFixed(1)}`,fill:'none'});poly.dataset.user='1';poly.dataset.kind=kind;poly.dataset.name=(kind==='water'?'水線 ':kind==='feed'?'料線 ':'電線 ')+counter++;poly.dataset.lineSize='';poly.dataset.sourceA=kind==='water'?qs('waterSource').value:'';poly.dataset.startComponent=snap?.el?.dataset?.uid||'';poly.dataset.startPort=snap?.name||'';poly.setAttribute('class',(kind==='water'?'water-item':kind==='feed'?'feed-item':'elec-item')+' editable');if(kind==='water')poly.setAttribute('stroke',waterColors[poly.dataset.sourceA]||waterColors.mixed);(kind==='water'?qs('waterLayer'):kind==='feed'?qs('feedLayer'):qs('elecLayer')).appendChild(poly);routeDraw={kind,el:poly,points:[{x:p.x,y:p.y}],preview:p};document.body.classList.add('route-drawing');qs('routeTouchControls')?.setAttribute('aria-hidden','false');fill(poly);status.textContent=(kind==='water'?'水線':kind==='feed'?'料線':'電線')+'：移動滑鼠決定任意角度，單擊增加轉折點，雙擊 / Enter 完成。';return poly}

function undoRoutePoint(){
 if(!routeDraw)return;
 if(routeDraw.points.length<=1){status.textContent='目前只有起點；Esc 或「取消」可放棄這條線。';return}
 routeDraw.points.pop();setRoutePoints(routeDraw.el,routeDraw.points);
 status.textContent=`已復原上一個轉折點｜剩 ${routeDraw.points.length} 個固定點`;
}

function addRoutePoint(p,snap,e=null){if(!routeDraw)return;let last=routeDraw.points[routeDraw.points.length-1];let q=freeRoutePoint(last,p,e);if(snap)q={x:snap.x,y:snap.y};if(Math.hypot(q.x-last.x,q.y-last.y)<1)return;routeDraw.points.push(q);if(snap){routeDraw.el.dataset.endComponent=snap.el?.dataset?.uid||'';routeDraw.el.dataset.endPort=snap.name||''}setRoutePoints(routeDraw.el,routeDraw.points);const startUid=routeDraw.el.dataset.startComponent||'',startPort=routeDraw.el.dataset.startPort||'';if(snap&&(snap.el?.dataset?.uid!==startUid||snap.name!==startPort)){const name=routeDraw.el.dataset.name||'線路';finishRoute(false);setTool('select');status.textContent=name+' 已接到設備端點並自動完成';}}
function finishRoute(cancel=false){if(!routeDraw)return;if(cancel||routeDraw.points.length<2){routeDraw.el.remove();}else{setRoutePoints(routeDraw.el,routeDraw.points);if(routeDraw.kind==='electric')rebuildPowerRelations();if(routeDraw.kind==='water')syncValveFromWaterRoutes();autosave();refreshList();fill(routeDraw.el)}routeDraw=null;document.body.classList.remove('route-drawing');qs('routeTouchControls')?.setAttribute('aria-hidden','true');if(qs('routeAngleBadge'))qs('routeAngleBadge').textContent='角度 —';if(snapVisual){snapVisual.remove();snapVisual=null}status.textContent=cancel?'已取消折線':'折線完成';}
function renderRouteNodes(el){qs('routeEditLayer')?.remove();const layer=mk('g',{id:'routeEditLayer'});qs('annoLayer').appendChild(layer);if(!el||el.tagName!=='polyline')return;routePoints(el).forEach((p,i)=>{const c=mk('circle',{cx:p.x,cy:p.y,r:i===0||i===routePoints(el).length-1?6:5,class:'route-node '+(i===0||i===routePoints(el).length-1?'endpoint':'')});c.dataset.index=i;c.dataset.routeEditor='1';layer.appendChild(c)})}
function updateThreeWayVisual(g){if(!g||g.dataset.kind!=='threeWay')return;const activePort=g.dataset.valveActivePort||'';const state=valveSourceByPort(g,activePort)||g.dataset.switchState||'';const color=sourceColor(state);g.querySelectorAll('.tw-branch').forEach(x=>{x.classList.remove('threeway-active');x.setAttribute('stroke','#7e6b9e')});const br=activePort?g.querySelector(`[data-branch="${activePort}"]`):null;if(br){br.setAttribute('stroke',color);br.classList.add('threeway-active')}let st=g.querySelector('.switch-label');if(!st){st=mk('text',{x:0,y:62,'text-anchor':'middle','font-size':12,class:'switch-label'});g.appendChild(st)}st.setAttribute('fill',color);st.textContent=state?'目前：'+state:'未設定切換';}


const CUSTOM_LIB_KEY='pigfarmCustomDeviceLibraryV1';
const CUSTOM_CATEGORY_LABELS={other:'一般 / 其他',water:'水路設備',electric:'電力設備',vent:'通風 / 環控設備',waste:'排污 / 清洗設備'};
function customTheme(cat){
 if(cat==='water')return{stroke:'#55dcff',fill:'rgba(27,91,113,.92)'};
 if(cat==='electric')return{stroke:'#ffe27d',fill:'rgba(103,87,37,.92)'};
 if(cat==='vent')return{stroke:'#ff9b82',fill:'rgba(103,51,42,.92)'};if(cat==='waste')return{stroke:'#8fe39b',fill:'rgba(42,94,55,.92)'};
 return{stroke:'#c7a4ff',fill:'rgba(75,55,99,.92)'};
}
function getCustomLibrary(){try{const x=JSON.parse(localStorage.getItem(CUSTOM_LIB_KEY)||'[]');return Array.isArray(x)?x:[]}catch(e){return[]}}
function setCustomLibrary(list,saveProject=false){
 const clean=(Array.isArray(list)?list:[]).slice(0,40).map(x=>({id:String(x.id||('tpl-'+Date.now()+'-'+Math.random().toString(36).slice(2,7))),name:String(x.name||'自訂設備').slice(0,40),icon:String(x.icon||'⚙').slice(0,4),category:['other','water','electric','vent','waste'].includes(x.category)?x.category:'other',mainFunction:String(x.mainFunction||'').slice(0,80)}));
 try{localStorage.setItem(CUSTOM_LIB_KEY,JSON.stringify(clean))}catch(e){}renderCustomLibrary();if(saveProject)autosave();return clean;
}
function renderCustomLibrary(){
 const list=getCustomLibrary(),mini=qs('customDeviceLibraryMini'),saved=qs('customSavedList');
 if(mini){mini.innerHTML='';if(!list.length)mini.innerHTML='<div class="tiny">尚未建立自訂設備。</div>';list.slice(0,8).forEach(t=>{const b=document.createElement('button');b.type='button';b.className='custom-library-chip';const i=document.createElement('b');i.textContent=t.icon||'⚙';const s=document.createElement('span');s.textContent=t.name||'自訂設備';b.append(i,s);b.onclick=()=>openCustomDeviceModal(null,t);mini.appendChild(b)})}
 if(saved){saved.innerHTML='';if(!list.length)saved.innerHTML='<div class="tiny">建立後會顯示在這裡，之後可快速重複使用。</div>';list.forEach(t=>{const row=document.createElement('div');row.className='custom-saved-item';const load=document.createElement('button');load.type='button';load.className='load';const ib=document.createElement('b');ib.textContent=t.icon||'⚙';const sp=document.createElement('span');sp.textContent=t.name||'自訂設備';load.append(ib,sp);load.onclick=()=>loadCustomDefinitionToForm(t);const rm=document.createElement('button');rm.type='button';rm.className='remove';rm.textContent='×';rm.title='刪除此常用設備';rm.onclick=e=>{e.stopPropagation();setCustomLibrary(list.filter(x=>x.id!==t.id),true)};row.append(load,rm);saved.appendChild(row)})}
}
function setCustomIcon(icon){customSelectedIcon=String(icon||'⚙').slice(0,4);document.querySelectorAll('[data-custom-icon]').forEach(b=>b.classList.toggle('active',b.dataset.customIcon===customSelectedIcon));if(qs('customPreviewIcon'))qs('customPreviewIcon').textContent=customSelectedIcon;updateCustomPreview()}
function updateCustomPreview(){const n=(qs('customDeviceName')?.value||'').trim()||'自訂設備';if(qs('customPreviewName'))qs('customPreviewName').textContent=n;const theme=customTheme(qs('customDeviceCategory')?.value||'other'),box=qs('customDevicePreview')?.querySelector('b');if(box){box.style.borderColor=theme.stroke;box.style.color=theme.stroke}}
function loadCustomDefinitionToForm(def){def=def||{};qs('customDeviceName').value=def.name||'';qs('customDeviceCategory').value=def.category||'other';qs('customDeviceFunction').value=def.mainFunction||'';setCustomIcon(def.icon||'⚙');updateCustomPreview()}
function readCustomDefinition(){const name=(qs('customDeviceName').value||'').trim();if(!name){qs('customDeviceName').focus();return null}return{id:'tpl-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),name:name.slice(0,40),icon:customSelectedIcon||'⚙',category:qs('customDeviceCategory').value||'other',mainFunction:(qs('customDeviceFunction').value||'').trim().slice(0,80)}}
function saveCustomTemplate(def){const list=getCustomLibrary(),same=list.findIndex(x=>x.name===def.name&&x.icon===def.icon&&x.category===def.category),item={...def,id:same>=0?list[same].id:def.id};if(same>=0)list[same]=item;else list.unshift(item);setCustomLibrary(list,true)}
function openCustomDeviceModal(editEl=null,preset=null){
 customEditTarget=editEl?.dataset?.kind==='customDevice'?editEl:null;
 const def=customEditTarget?{name:customEditTarget.dataset.name||'',icon:customEditTarget.dataset.customIcon||'⚙',category:customEditTarget.dataset.customCategory||'other',mainFunction:customEditTarget.dataset.mainFunction||''}:(preset||{name:'',icon:'⚙',category:'other',mainFunction:''});
 loadCustomDefinitionToForm(def);qs('customSaveTemplate').checked=!customEditTarget;qs('customDeviceTitle').textContent=customEditTarget?'✎ 編輯自訂物件':'＋ 自訂物件';qs('customDeviceApplyBtn').textContent=customEditTarget?'套用修改':'建立並放置';qs('customDeviceModal').classList.add('show');qs('customDeviceModal').setAttribute('aria-hidden','false');renderCustomLibrary();setTimeout(()=>qs('customDeviceName')?.focus(),60);
}
function closeCustomDeviceModal(){qs('customDeviceModal').classList.remove('show');qs('customDeviceModal').setAttribute('aria-hidden','true');customEditTarget=null}
function applyCustomDeviceAppearance(el){
 if(!el||el.dataset.kind!=='customDevice')return;const theme=customTheme(el.dataset.customCategory||'other');el.dataset.customColor=theme.stroke;const box=el.querySelector('.box');if(box){box.setAttribute('stroke',theme.stroke);box.setAttribute('fill',theme.fill)}el.querySelectorAll('.custom-detail-line').forEach(n=>n.setAttribute('stroke',theme.stroke));const sym=el.querySelector('.custom-symbol');if(sym){sym.textContent=el.dataset.customIcon||'⚙';sym.setAttribute('fill','#fff');sym.setAttribute('font-size',(String(el.dataset.customIcon||'').length>2?11:17))}const lab=el.querySelector('.component-label');if(lab){lab.textContent=el.dataset.name||'自訂設備';lab.setAttribute('fill',theme.stroke)}
}
function moveCustomDeviceLayer(el){if(!el||el.dataset.kind!=='customDevice')return;const dest=(el.dataset.customCategory==='vent')?qs('ventLayer'):qs('componentLayer');if(el.parentElement!==dest)dest.appendChild(el)}
function commitCustomDevice(){
 const def=readCustomDefinition();if(!def)return;if(qs('customSaveTemplate').checked)saveCustomTemplate(def);
 if(customEditTarget){const el=customEditTarget;el.dataset.name=def.name;el.dataset.mainFunction=def.mainFunction||def.name;el.dataset.customIcon=def.icon;el.dataset.customCategory=def.category;applyCustomDeviceAppearance(el);moveCustomDeviceLayer(el);applyComponentVisual(el);fill(el);autosave();refreshList();applyViewFilters();closeCustomDeviceModal();status.textContent='已更新自訂物件：'+def.name;return}
 pendingCustomDefinition=def;closeCustomDeviceModal();setPendingComponent('customDevice');
}

function componentLabel(kind){return labels[kind]||kind||'設備'}
function setPendingComponent(kind){
 pendingComponent=kind||'';
 if(kind!=='customDevice')pendingCustomDefinition=null;
 document.body.classList.remove('device-menu-open');qs('quickDeviceBar')?.setAttribute('aria-hidden','true');
 document.body.classList.toggle('component-place-mode',!!pendingComponent);
 document.querySelectorAll('.libitem[data-component]').forEach(el=>{const on=el.dataset.component===pendingComponent;el.classList.toggle('placing-selected',on);el.setAttribute('aria-pressed',String(on))});
 document.querySelectorAll('[data-quick-component]').forEach(b=>b.classList.toggle('active',b.dataset.quickComponent===pendingComponent));
 if(qs('quickDeviceMenuBtn')){qs('quickDeviceMenuBtn').textContent=pendingComponent?'✕ 取消設備':'＋ 設備';qs('quickDeviceMenuBtn').classList.toggle('place-active',!!pendingComponent)}
 if(pendingComponent){
   setTool('select');
   status.textContent='放置 '+componentLabel(pendingComponent)+'：請點圖面位置；Esc 取消。';
 }else{
   status.textContent='已取消設備放置。';
 }
}
function placePendingComponent(p){
 if(!pendingComponent)return false;
 // 避免『目前篩選』將剛放置的設備立即隱藏，造成看不到圖示。
 viewPreset='all';deviceTypeFilter=null;singleDeviceUid='';
 if(qs('buildingFilter'))qs('buildingFilter').value='all';
 if(qs('deviceSingleFilter'))qs('deviceSingleFilter').value='';
 ['componentChk','ventChk'].forEach(id=>{if(qs(id))qs(id).checked=true});
 ['componentLayer','ventLayer'].forEach(id=>{if(qs(id))qs(id).style.display=''});
 const kind=pendingComponent,customDef=kind==='customDevice'?pendingCustomDefinition:null;
 const keepPlacing=false; // 單次放置：再次點設備才重新進入放置模式。
 // 由使用者決定是否連續放置。
 pendingComponent='';pendingCustomDefinition=null;
 document.body.classList.remove('component-place-mode','device-menu-open');
 document.querySelectorAll('.libitem[data-component]').forEach(el=>{el.classList.remove('placing-selected');el.setAttribute('aria-pressed','false')});
 document.querySelectorAll('[data-quick-component]').forEach(b=>b.classList.remove('active'));
 if(qs('quickDeviceMenuBtn')){qs('quickDeviceMenuBtn').textContent='＋ 設備';qs('quickDeviceMenuBtn').classList.remove('place-active','active')}
 qs('quickDeviceBar')?.setAttribute('aria-hidden','true');
 setTool('select');
 const g=createComponent(kind,p,customDef);
 applyViewFilters();renderDeviceFilters();
 fill(g);showObjectDetail(g);renderComponentHandles(g);
 if(keepPlacing){
   // 連續放置重新啟用放置模式，保持目前設備分類頁，不切換回其他分頁。
   pendingCustomDefinition=customDef;
   setPendingComponent(kind);
   status.textContent='已放置：'+(g.dataset.name||componentLabel(kind))+'｜繼續點圖面可放置同設備，Esc 結束。';
 }else{status.textContent='已放置：'+(g.dataset.name||componentLabel(kind))+'｜已回到選取模式。';}
 return true;
}

function createComponent(kind,p,customDef=null){
 p=snapGridPoint(p);
 const g=mk('g',{class:'component editable'});g.dataset.user='1';g.dataset.uid='cmp-'+Date.now()+'-'+Math.floor(Math.random()*99999);g.dataset.kind=kind;
 const isCustom=kind==='customDevice',baseLabel=isCustom?(customDef?.name||'自訂設備'):(labels[kind]||'設備');
 g.dataset.name=isCustom?baseLabel:(baseLabel+' '+counter++);
 g.dataset.mainFunction=isCustom?(customDef?.mainFunction||baseLabel):(defaultMainFunctions[kind]||labels[kind]||'');g.dataset.locked='no';g.dataset.photoCount='0';g.dataset.x=p.x.toFixed(1);g.dataset.y=p.y.toFixed(1);g.dataset.rotation='0';g.dataset.iconScale='0.8';g.dataset.shapeScaleX='1';g.dataset.shapeScaleY='1';g.dataset.shapeLock='yes';g.dataset.labelScale='0.9';g.dataset.showLabel='yes';g.dataset.building='';g.dataset.sourceA='';g.dataset.sourceB='';g.dataset.target='';g.dataset.spec='';g.dataset.lineSize='';g.dataset.powerKw='';g.dataset.airflow='';g.dataset.staticPa='';g.dataset.emergencyClass='';g.dataset.switchState='';g.dataset.backup='';g.dataset.powerParent='';g.dataset.powerParentName='';g.dataset.powerChildren='[]';g.dataset.panelMeta='';g.dataset.panelCircuits='';g.setAttribute('transform',`translate(${p.x} ${p.y}) rotate(0) scale(0.8)`);
 let stroke='#72dcff',fillColor='rgba(35,80,108,.82)',short='';
 if(kind==='customDevice'){g.dataset.customIcon=String(customDef?.icon||'⚙').slice(0,4);g.dataset.customCategory=['other','water','electric','vent','waste'].includes(customDef?.category)?customDef.category:'other';const th=customTheme(g.dataset.customCategory);stroke=th.stroke;fillColor=th.fill;short=g.dataset.customIcon;g.dataset.spec='自訂設備';}
 if(kind==='feedSilo'){stroke='#eab963';fillColor='rgba(74,64,42,.90)' ;short='料';g.dataset.spec='料桶容量／材質／編號：';}
 if(kind==='feedMotor'){stroke='#eab963';fillColor='rgba(74,64,42,.90)' ;short='馬';g.dataset.spec='功率／電壓／送料量：';}
 if(kind==='feedCorner'){stroke='#eab963';fillColor='rgba(74,64,42,.90)' ;short='轉';g.dataset.spec='轉角角度／料線尺寸：';}
 if(kind==='feedDrop'){stroke='#eab963';fillColor='rgba(74,64,42,.90)' ;short='落';g.dataset.spec='落料管徑／位置：';}
 if(kind==='nippleDrinker'){stroke='#65d2f1';fillColor='rgba(74,64,42,.90)' ;short='飲';g.dataset.spec='水壓／規格／數量：';}
 if(kind==='medTank'){stroke='#65d2f1';fillColor='rgba(74,64,42,.90)' ;short='藥';g.dataset.spec='容量／混合比例：';}
 if(kind==='dosingPump'){stroke='#65d2f1';fillColor='rgba(74,64,42,.90)' ;short='劑';g.dataset.spec='加藥比例／流量／功率：';}
 if(kind==='feedSensor'){stroke='#eab963';fillColor='rgba(74,64,42,.90)' ;short='位';g.dataset.spec='高低料位／安裝位置：';}
 if(kind==='waterTower'){stroke='#3fd0ff';short='水塔';g.dataset.spec='容量：';}
 if(kind==='cityWater'){stroke='#ffb454';fillColor='rgba(100,69,28,.85)';short='自';g.dataset.spec='管徑：';}
 if(kind==='groundWater'){stroke='#51df95';fillColor='rgba(30,91,60,.85)';short='井';g.dataset.spec='泵浦/管徑：';}
 if(kind==='groundWell'){stroke='#51df95';fillColor='rgba(23,72,55,.9)';short='深井';g.dataset.spec='井深／抽水量／泵浦規格：';g.dataset.sourceA='地下水';}
 if(kind==='cityOutlet'){stroke='#ffb454';fillColor='rgba(100,69,28,.85)';short='自出';g.dataset.sourceA='自來水';g.dataset.spec='管徑／出水壓力：';}
 if(kind==='groundOutlet'){stroke='#51df95';fillColor='rgba(30,91,60,.85)';short='井出';g.dataset.sourceA='地下水';g.dataset.spec='管徑／泵浦出水：';}
 if(kind==='towerOutlet'){stroke='#3fd0ff';fillColor='rgba(35,80,108,.82)';short='塔出';g.dataset.sourceA='水塔';g.dataset.spec='出水管徑／高度：';}
 if(kind==='transferPump'){stroke='#7ae2a5';short='P';g.dataset.spec='功率／流量／揚程：';g.dataset.sourceA='水塔';}
 if(kind==='boosterPump'){stroke='#7ae2a5';short='P+';g.dataset.spec='功率／流量／揚程：';g.dataset.sourceA='水塔';}
 if(kind==='pressureTank'){stroke='#5cd6ef';short='壓';g.dataset.spec='容量／工作壓力：';g.dataset.sourceA='水塔';}
 if(kind==='waterFilter'){stroke='#5cd6ef';short='濾';g.dataset.spec='濾材／流量／更換週期：';g.dataset.sourceA='水塔';}
 if(kind==='waterMeter'){stroke='#5cd6ef';short='m³';g.dataset.spec='口徑／累計用水量：';g.dataset.sourceA='水塔';}
 if(kind==='checkValve'){stroke='#c6a3f6';short='▷|';g.dataset.spec='口徑／方向：';g.dataset.sourceA='水塔';}
 if(kind==='shutoffValve'){stroke='#c6a3f6';short='⊗';g.dataset.spec='口徑／位置／常態：';g.dataset.sourceA='水塔';}
 if(kind==='levelSensor'){stroke='#5cd6ef';short='LV';g.dataset.spec='高低液位設定：';g.dataset.sourceA='水塔';}
 if(kind==='threeWay'){stroke='#be9cff';fillColor='rgba(71,51,101,.9)';short='Y';g.dataset.valveSourceA='水塔';g.dataset.valveSourceB='地下水';g.dataset.valveSourceC='自來水';g.dataset.valveActivePort='A';g.dataset.valveOutlet='';g.dataset.valveMode='手動';g.dataset.valveNote='';g.dataset.sourceA='水塔';g.dataset.sourceB='地下水';g.dataset.switchState='水塔';}
 if(kind==='utilityPower'){stroke='#63c9ff';fillColor='rgba(28,75,103,.92)';short='台電';g.dataset.spec='台電進線；380/220V';g.dataset.backup='no';}
 if(kind==='generator'){stroke='#ffd25f';fillColor='rgba(92,73,24,.94)';short='G';g.dataset.generatorKva='125';g.dataset.generatorPf='0.8';g.dataset.generatorKw='100.0';g.dataset.spec='125 kVA；PF 0.8；可用 100.0 kW';g.dataset.backup='yes';}
 if(kind==='ats'){stroke='#9aec8e';fillColor='rgba(42,91,49,.94)';short='ATS';g.dataset.atsMode='AUTO';g.dataset.atsAmp='400';g.dataset.spec='ATS 400A；AUTO';g.dataset.backup='yes';}
 if(kind==='mainSwitch'){stroke='#ff8388';fillColor='rgba(105,44,48,.9)';short='總開';g.dataset.backup='yes';}
 if(kind==='mainPanel'){stroke='#ff9fa4';fillColor='rgba(105,44,48,.9)';short='總配';g.dataset.backup='yes';}
 if(kind==='subPanel'){stroke='#ffe27d';fillColor='rgba(103,87,37,.9)';short='分電';}
 if(kind==='equipmentPanel'){stroke='#ffb6dd';fillColor='rgba(102,52,82,.9)';short='設備';}
 if(kind==='coolingPad'){stroke='#55dcff';fillColor='rgba(27,91,113,.9)';short='水簾';g.dataset.spec='150mm厚；高1.8m；有效長度：';g.dataset.emergencyClass='none';g.dataset.backup='no';}
 if(kind==='exhaustFan'){stroke='#ff9b82';fillColor='rgba(103,51,42,.92)';short='排風';g.dataset.spec='主排風扇；尺寸：';g.dataset.powerKw='1.50';g.dataset.staticPa='50';g.dataset.emergencyClass='A';g.dataset.backup='yes';}
 if(kind==='guideFan'){stroke='#8fc7ff';fillColor='rgba(37,69,105,.92)';short='導引';g.dataset.spec='導引扇；36吋';g.dataset.powerKw='0.75';g.dataset.emergencyClass='A';g.dataset.backup='yes';}
 if(kind==='coolingPump'){stroke='#80edc0';fillColor='rgba(31,92,72,.92)';short='P';g.dataset.spec='水簾循環泵';g.dataset.powerKw='0.75';g.dataset.emergencyClass='B';g.dataset.backup='yes';}
 if(kind==='heatLamp'){stroke='#ffd45c';fillColor='rgba(108,78,20,.94)';short='☀';g.dataset.spec='保溫燈/保溫設備；單燈瓦數：250W；數量：1';g.dataset.powerKw='0.25';g.dataset.emergencyClass='B';g.dataset.backup='yes';g.dataset.note='仔豬保溫；冬季/低溫時屬重要負載，可依現場需求改A/B/C級';}
 if(kind==='customDevice'){
   g.appendChild(mk('rect',{x:-30,y:-24,width:60,height:48,rx:8,class:'box',stroke,fill:fillColor}));
   g.appendChild(mk('line',{x1:-20,y1:15,x2:20,y2:15,stroke,'stroke-width':1.4,class:'custom-detail-line',opacity:.72}));
 }else if(kind==='coolingPad'){
   g.appendChild(mk('rect',{x:-40,y:-18,width:80,height:36,rx:3,class:'box',stroke,fill:fillColor}));
   for(let xx=-32;xx<=32;xx+=8)g.appendChild(mk('line',{x1:xx,y1:-14,x2:xx+10,y2:14,stroke,'stroke-width':1.2}));
 }else if(kind==='exhaustFan'){
   g.appendChild(mk('rect',{x:-28,y:-28,width:56,height:56,rx:4,class:'box',stroke,fill:fillColor}));
   g.appendChild(mk('circle',{cx:0,cy:0,r:22,stroke,fill:'none','stroke-width':2}));
   for(let a=0;a<4;a++){const blade=mk('ellipse',{cx:0,cy:-11,rx:5,ry:13,fill:stroke,opacity:.82});blade.setAttribute('transform',`rotate(${a*90})`);g.appendChild(blade)}
   g.appendChild(mk('circle',{cx:0,cy:0,r:5,fill:'#f4f8ff'}));
 }else if(kind==='guideFan'){
   g.appendChild(mk('circle',{cx:0,cy:0,r:24,class:'box',stroke,fill:fillColor}));
   for(let a=0;a<3;a++){const blade=mk('ellipse',{cx:0,cy:-11,rx:5,ry:13,fill:stroke,opacity:.85});blade.setAttribute('transform',`rotate(${a*120})`);g.appendChild(blade)}
   g.appendChild(mk('circle',{cx:0,cy:0,r:5,fill:'#f4f8ff'}));
   g.appendChild(mk('line',{x1:27,y1:0,x2:45,y2:0,stroke,'stroke-width':3}));g.appendChild(mk('polygon',{points:'45,0 35,-6 35,6',fill:stroke}));
 }else if(kind==='coolingPump'){
   g.appendChild(mk('circle',{cx:0,cy:0,r:22,class:'box',stroke,fill:fillColor}));
   g.appendChild(mk('path',{d:'M -10 7 C -2 1 1 -8 10 -10 C 10 -2 5 8 -4 11 Z',fill:stroke,opacity:.8}));
 }else if(kind==='threeWay'){
   g.appendChild(mk('circle',{cx:0,cy:0,r:15,class:'box',stroke,fill:fillColor}));g.appendChild(mk('line',{x1:0,y1:-15,x2:0,y2:-30,stroke:'#7e6b9e','stroke-width':3,class:'tw-branch', 'data-branch':'A'}));g.appendChild(mk('line',{x1:-12,y1:8,x2:-28,y2:20,stroke:'#7e6b9e','stroke-width':3,class:'tw-branch', 'data-branch':'B'}));g.appendChild(mk('line',{x1:12,y1:8,x2:28,y2:20,stroke:'#7e6b9e','stroke-width':3,class:'tw-branch', 'data-branch':'C'}));g.appendChild(mk('line',{x1:12,y1:-5,x2:34,y2:-12,stroke:'#c9d9e8','stroke-width':3,class:'tw-outlet'}));
 }else if(kind==='utilityPower'){
   g.appendChild(mk('rect',{x:-30,y:-24,width:60,height:48,rx:6,class:'box',stroke,fill:fillColor}));
   g.appendChild(mk('path',{d:'M -4 -17 L 7 -4 L 0 -4 L 6 16 L -9 1 L -1 1 Z',fill:stroke}));
 }else if(kind==='generator'){
   g.appendChild(mk('rect',{x:-32,y:-23,width:64,height:46,rx:7,class:'box',stroke,fill:fillColor}));
   g.appendChild(mk('circle',{cx:-14,cy:0,r:8,stroke,fill:'none','stroke-width':2}));
   g.appendChild(mk('line',{x1:-6,y1:0,x2:19,y2:0,stroke,'stroke-width':3}));
 }else if(kind==='ats'){
   g.appendChild(mk('rect',{x:-34,y:-24,width:68,height:48,rx:6,class:'box',stroke,fill:fillColor}));
   g.appendChild(mk('line',{x1:-22,y1:-11,x2:0,y2:0,stroke,'stroke-width':3}));
   g.appendChild(mk('line',{x1:-22,y1:11,x2:0,y2:0,stroke,'stroke-width':3}));
   g.appendChild(mk('line',{x1:0,y1:0,x2:22,y2:0,stroke,'stroke-width':3}));
 }else if(['transferPump','boosterPump'].includes(kind)){
   g.appendChild(mk('circle',{cx:0,cy:0,r:23,class:'box',stroke,fill:fillColor}));
   g.appendChild(mk('path',{d:'M -11 12 L -11 -12 L 5 -12 Q 20 -10 16 1 Q 13 11 0 11 Z',stroke,fill:'none','stroke-width':2}));
   g.appendChild(mk('path',{d:'M -4 -6 L 8 0 L -4 7 Z',fill:stroke}));
 }else if(['feedSilo','medTank'].includes(kind)){
   g.appendChild(mk('rect',{x:-23,y:-25,width:46,height:45,rx:7,class:'box',stroke,fill:fillColor}));
   g.appendChild(mk('ellipse',{cx:0,cy:-25,rx:23,ry:8,stroke,fill:fillColor}));
   g.appendChild(mk('path',{d:'M -15 20 L -8 33 L 8 33 L 15 20',stroke,fill:'none','stroke-width':2}));
 }else if(['feedMotor','dosingPump'].includes(kind)){
   g.appendChild(mk('rect',{x:-27,y:-19,width:54,height:38,rx:8,class:'box',stroke,fill:fillColor}));
   g.appendChild(mk('circle',{cx:-8,cy:0,r:12,stroke,fill:'none','stroke-width':2}));
   g.appendChild(mk('line',{x1:5,y1:0,x2:28,y2:0,stroke,'stroke-width':3}));
 }else if(kind==='feedCorner'){
   g.appendChild(mk('path',{d:'M -26 20 L -7 20 L -7 -9 L 27 -9',stroke,'stroke-width':9,fill:'none','stroke-linejoin':'round'}));
   g.appendChild(mk('path',{d:'M -26 20 L -7 20 L -7 -9 L 27 -9',stroke:'#172d39','stroke-width':3,fill:'none'}));
 }else if(kind==='feedDrop'){
   g.appendChild(mk('path',{d:'M -19 -23 L 19 -23 L 12 8 L 5 8 L 5 26 L -5 26 L -5 8 L -12 8 Z',stroke,fill:fillColor,'stroke-width':2}));
 }else if(kind==='nippleDrinker'){
   g.appendChild(mk('line',{x1:-20,y1:-10,x2:13,y2:-10,stroke,'stroke-width':5}));
   g.appendChild(mk('line',{x1:13,y1:-10,x2:13,y2:12,stroke,'stroke-width':4}));
   g.appendChild(mk('circle',{cx:13,cy:18,r:6,stroke,fill:fillColor}));
 }else if(kind==='feedSensor'){
   g.appendChild(mk('rect',{x:-20,y:-24,width:40,height:48,rx:5,class:'box',stroke,fill:fillColor}));
   g.appendChild(mk('circle',{cx:0,cy:0,r:11,stroke,fill:'none','stroke-width':2}));
 }else if(kind==='pressureTank'){
   g.appendChild(mk('rect',{x:-23,y:-26,width:46,height:55,rx:18,class:'box',stroke,fill:fillColor}));
   g.appendChild(mk('line',{x1:-17,y1:3,x2:17,y2:3,stroke,'stroke-width':2}));
 }else if(kind==='waterFilter'){
   g.appendChild(mk('rect',{x:-23,y:-27,width:46,height:54,rx:7,class:'box',stroke,fill:fillColor}));
   for(let i=-12;i<=12;i+=8)g.appendChild(mk('line',{x1:i,y1:-16,x2:i+9,y2:14,stroke,'stroke-width':1.5}));
 }else if(kind==='waterMeter'){
   g.appendChild(mk('circle',{cx:0,cy:0,r:24,class:'box',stroke,fill:fillColor}));
   g.appendChild(mk('path',{d:'M -13 8 A 17 17 0 0 1 13 8',fill:'none',stroke,'stroke-width':2}));
   g.appendChild(mk('line',{x1:0,y1:3,x2:11,y2:-7,stroke,'stroke-width':2}));
 }else if(['checkValve','shutoffValve'].includes(kind)){
   g.appendChild(mk('rect',{x:-30,y:-20,width:60,height:40,rx:6,class:'box',stroke,fill:fillColor}));
   g.appendChild(mk('path',{d:'M -19 -13 L 0 0 L -19 13 Z M 19 -13 L 0 0 L 19 13 Z',fill:'none',stroke,'stroke-width':2.5}));
   if(kind==='checkValve')g.appendChild(mk('line',{x1:19,y1:-13,x2:19,y2:13,stroke,'stroke-width':3}));
 }else if(kind==='levelSensor'){
   g.appendChild(mk('rect',{x:-22,y:-27,width:44,height:54,rx:8,class:'box',stroke,fill:fillColor}));
   g.appendChild(mk('path',{d:'M -15 9 H 15 M -15 -5 H 15',stroke,'stroke-width':2}));
   g.appendChild(mk('circle',{cx:0,cy:9,r:5,fill:stroke}));
 }else if(kind==='waterTower'){
   g.appendChild(mk('rect',{x:-24,y:-22,width:48,height:42,rx:7,class:'box',stroke,fill:fillColor}));g.appendChild(mk('ellipse',{cx:0,cy:-22,rx:24,ry:7,stroke,fill:fillColor}));g.appendChild(mk('line',{x1:-14,y1:20,x2:-18,y2:31,stroke,'stroke-width':3}));g.appendChild(mk('line',{x1:14,y1:20,x2:18,y2:31,stroke,'stroke-width':3}));
 }else if(kind==='groundWell'){
   g.appendChild(mk('rect',{x:-25,y:-20,width:50,height:43,rx:4,class:'box',stroke,fill:fillColor}));
   g.appendChild(mk('ellipse',{cx:0,cy:-20,rx:24,ry:9,stroke,fill:fillColor}));
   g.appendChild(mk('line',{x1:-13,y1:-8,x2:-13,y2:16,stroke,'stroke-width':2}));
   g.appendChild(mk('line',{x1:13,y1:-8,x2:13,y2:16,stroke,'stroke-width':2}));
 }else if(['cityOutlet','groundOutlet','towerOutlet'].includes(kind)){
   g.appendChild(mk('circle',{cx:0,cy:0,r:23,class:'box',stroke,fill:fillColor}));
   g.appendChild(mk('line',{x1:-17,y1:0,x2:13,y2:0,stroke,'stroke-width':3}));
   g.appendChild(mk('polygon',{points:'20,0 7,-9 7,9',fill:stroke}));
 }else if(kind==='groundWater'){
   g.appendChild(mk('circle',{cx:0,cy:0,r:23,class:'box',stroke,fill:fillColor}));g.appendChild(mk('circle',{cx:0,cy:0,r:12,stroke,fill:'none'}));
 }else if(kind==='cityWater'){
   g.appendChild(mk('circle',{cx:0,cy:0,r:23,class:'box',stroke,fill:fillColor}));
 }else{
   g.appendChild(mk('rect',{x:-29,y:-22,width:58,height:44,rx:5,class:'box',stroke,fill:fillColor}));g.appendChild(mk('line',{x1:-20,y1:-12,x2:20,y2:-12,stroke,'stroke-width':1.5}));g.appendChild(mk('line',{x1:-20,y1:-4,x2:20,y2:-4,stroke,'stroke-width':1.5}));
 }
 const t=mk('text',{x:0,y:5,'text-anchor':'middle',fill:'#fff','font-size':kind==='threeWay'?16:(kind==='customDevice'?(String(short).length>2?11:17):13)});t.textContent=short;if(kind==='customDevice')t.classList.add('custom-symbol');g.appendChild(t);
 const label=mk('text',{x:0,y:45,'text-anchor':'middle',fill:stroke,'font-size':13});label.textContent=kind==='customDevice'?g.dataset.name:labels[kind];label.classList.add('component-label');g.appendChild(label);
 const ventKinds=['coolingPad','exhaustFan','guideFan','coolingPump'];((ventKinds.includes(kind)||(kind==='customDevice'&&g.dataset.customCategory==='vent'))?qs('ventLayer'):qs('componentLayer')).appendChild(g);if(kind==='threeWay')updateThreeWayVisual(g);applyComponentVisual(g);fill(g);refreshList();autosave();applyViewFilters();return g;
}
document.querySelectorAll('.libitem').forEach(el=>{
 el.addEventListener('dragstart',e=>e.dataTransfer.setData('text/component',el.dataset.component));
 el.addEventListener('click',()=>setPendingComponent(el.dataset.component));
});
qs('selectionHandlesLayer').addEventListener('mousedown',e=>{
 const h=e.target.closest?.('[data-transform-handle]');if(!h)return;
 beginComponentHandleDrag(e,h.dataset.transformHandle);
});
svg.addEventListener('dragover',e=>e.preventDefault());svg.addEventListener('drop',e=>{e.preventDefault();const kind=e.dataTransfer.getData('text/component');if(kind){viewPreset='all';deviceTypeFilter=null;singleDeviceUid='';if(qs('buildingFilter'))qs('buildingFilter').value='all';['componentChk','ventChk'].forEach(id=>{if(qs(id))qs(id).checked=true});const g=createComponent(kind,pt(e));applyViewFilters();renderDeviceFilters();fill(g);status.textContent='已放置：'+(g.dataset.name||kind)}});
svg.addEventListener('wheel',e=>{e.preventDefault();zoom*=e.deltaY<0?1.1:.9;zoom=Math.max(.3,Math.min(4,zoom));tf()},{passive:false});
svg.addEventListener('mousedown',e=>{
 if(tool==='pan'||e.button===1||spacePan||(e.button===0&&e.ctrlKey)){panning=true;panStart={cx:e.clientX,cy:e.clientY,x:pan.x,y:pan.y};e.preventDefault();return}
 const p=pt(e);const comp=e.target.closest?.('.component');
 if(pendingDuplicateSource&&e.button===0){cloneComponentAt(pendingDuplicateSource,p);e.preventDefault();e.stopPropagation();return}
 if(pendingComponent&&e.button===0){placePendingComponent(p);e.preventDefault();e.stopPropagation();return}
 if(tool==='calibrate'){doCalibrationClick(p);return}
 if(tool==='measure'){doMeasureClick(p);return}
 if(tool==='select'&&e.target.dataset.routeEditor==='1'&&selected?.tagName==='polyline'){dragObj={routeEl:selected,nodeIndex:+e.target.dataset.index};return;}
 if(tool==='select'){
   if(comp){hideObjectDetail();fill(comp);if(objectLocked(comp)){status.textContent='🔒 已鎖定：'+(comp.dataset.name||'設備')+'；按鎖頭可解鎖';return}const cp=componentXY(comp);dragObj={el:comp,start:p,orig:cp};return}
   if(e.target.classList.contains('editable')){hideObjectDetail();fill(e.target)}else{fill(null);hideObjectDetail()}return;
 }
 if(tool==='water'||tool==='electric'||tool==='feed'){
   const snap=nearestSnap(p),q=snap?{x:snap.x,y:snap.y}:p;
   if(!routeDraw)beginRoute(tool,q,snap);else addRoutePoint(q,snap,e);
   return;
 }
 if(tool==='rect'){const r=mk('rect',{x:p.x,y:p.y,width:1,height:1,class:'anno-item editable'});r.dataset.user='1';r.dataset.name='矩形 '+counter++;qs('annoLayer').appendChild(r);draw={kind:'rect',el:r,start:p};fill(r);return}
 if(tool==='text'){const txt=prompt('輸入文字：');if(txt){const t=mk('text',{x:p.x,y:p.y,class:'user-text editable'});t.textContent=txt;t.dataset.user='1';t.dataset.name=txt;qs('annoLayer').appendChild(t);fill(t);refreshList();autosave();}}
});
svg.addEventListener('mousemove',e=>{const p=pt(e);if(panning){pan.x=panStart.x+(e.clientX-panStart.cx)/zoom;pan.y=panStart.y+(e.clientY-panStart.cy)/zoom;tf();return}if(handleDrag){updateComponentHandleDrag(e);return}
 const snap=nearestSnap(p);if(tool==='water'||tool==='electric'||tool==='feed')showSnap(snap);else showSnap(null);
 if(routeDraw){const last=routeDraw.points[routeDraw.points.length-1],raw=snap?{x:snap.x,y:snap.y}:p,q=snap?raw:freeRoutePoint(last,raw,e);const pts=[...routeDraw.points,q];setRoutePoints(routeDraw.el,pts);updateRouteAngleBadge(last,q);return}
 if(dragObj?.routeEl){const pts=routePoints(dragObj.routeEl);let q=snap?{x:snap.x,y:snap.y}:p;if(qs('routeMode').value==='ortho'&&dragObj.nodeIndex>0&&dragObj.nodeIndex<pts.length-1){const prev=pts[dragObj.nodeIndex-1],next=pts[dragObj.nodeIndex+1];if(Math.abs(prev.x-next.x)<Math.abs(prev.y-next.y))q.x=prev.x;else q.y=prev.y;}pts[dragObj.nodeIndex]=q;setRoutePoints(dragObj.routeEl,pts);renderRouteNodes(dragObj.routeEl);fields.routeLength.value=dragObj.routeEl.dataset.length+' 圖面單位';fields.realLength.value=dragObj.routeEl.dataset.realLength?dragObj.routeEl.dataset.realLength+' m':'尚未校正';refreshStats();return}
 if(dragObj){const raw={x:dragObj.orig.x+(p.x-dragObj.start.x),y:dragObj.orig.y+(p.y-dragObj.start.y)},sp=snapGridPoint(raw),ap=smartAlignPoint(sp,dragObj.el,true),nx=ap.x,ny=ap.y;dragObj.el.dataset.x=nx.toFixed(1);dragObj.el.dataset.y=ny.toFixed(1);applyComponentVisual(dragObj.el);fields.x.value=nx.toFixed(1);fields.y.value=ny.toFixed(1);updateConnectedRoutes(dragObj.el.dataset.uid);renderComponentHandles(dragObj.el);positionObjectDetail();positionSelectionActionBar();return}if(!draw)return;if(draw.kind==='rect'){draw.el.setAttribute('x',Math.min(draw.start.x,p.x));draw.el.setAttribute('y',Math.min(draw.start.y,p.y));draw.el.setAttribute('width',Math.abs(p.x-draw.start.x));draw.el.setAttribute('height',Math.abs(p.y-draw.start.y))}});
svg.addEventListener('mouseup',()=>{clearAlignmentGuides();if(handleDrag)endComponentHandleDrag();if(panning){panning=false;panStart=null}if(dragObj){dragObj=null;autosave();refreshList()}if(draw){draw=null;autosave();refreshList()}});svg.addEventListener('mouseleave',()=>{clearAlignmentGuides();if(handleDrag)endComponentHandleDrag();panning=false;dragObj=null;if(draw){draw=null;autosave();refreshList()}showSnap(null)});
svg.addEventListener('dblclick',e=>{if(routeDraw){e.preventDefault();finishRoute(false);return}const comp=e.target.closest?.('.component[data-user="1"]');if(comp){e.preventDefault();openObjectEditor(comp)}});
document.addEventListener('mouseup',()=>{if(handleDrag)endComponentHandleDrag()});
document.addEventListener('keydown',e=>{
 const tag=document.activeElement?.tagName;
 const editing=['INPUT','TEXTAREA','SELECT'].includes(tag);
 if((e.ctrlKey||e.metaKey)&&!editing&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redoHistory();else undoHistory();return}
 if((e.ctrlKey||e.metaKey)&&!editing&&e.key.toLowerCase()==='y'){e.preventDefault();redoHistory();return}
 if((e.key==='Delete'||e.key==='Backspace')&&!editing&&selected?.dataset?.user==='1'){
   e.preventDefault();requestDeleteObject(selected);return;
 }
 if(e.key==='Escape'&&qs('deviceSearchPanel')?.classList.contains('show')){closeDeviceSearch();setTool('select');return}
 if(e.key==='Escape'&&qs('customDeviceModal')?.classList.contains('show')){closeCustomDeviceModal();setTool('select');return}
 if(e.key==='Escape'&&qs('deleteConfirmModal')?.classList.contains('show')){closeDeleteConfirm();setTool('select');return}

 if(e.code==='Space'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){spacePan=true;document.body.classList.add('space-pan-ready');e.preventDefault()}
 if(e.key==='Control')document.body.classList.add('ctrl-pan-ready');
 if(e.key==='Enter'&&routeDraw){finishRoute(false)}
 if(e.key==='Escape'){
  // Esc：退出編輯工具，回到選取；一般表單保留輸入內容。
  if(editing){return}
  e.preventDefault();
  document.body.classList.remove('device-menu-open','pan-tool-ready','space-pan-ready','ctrl-pan-ready');
  qs('quickDeviceBar')?.setAttribute('aria-hidden','true');
  qs('quickDeviceMenuBtn')?.classList.remove('active');
  if(routeDraw)finishRoute(true);
  if(draw){draw.el?.remove();draw=null}
  if(pendingComponent)setPendingComponent('');
  if(pendingDuplicateSource)cancelDuplicatePlacement();
  calibrationPts=[];measurePts=[];
  spacePan=false;panning=false;panStart=null;
  showSnap(null);clearAlignmentGuides();
  setTool('select');
  status.textContent='已返回選取工具，可點選或拖移設備。';
}
});
document.addEventListener('keyup',e=>{
 if(e.code==='Space'){spacePan=false;document.body.classList.remove('space-pan-ready')}
 if(e.key==='Control')document.body.classList.remove('ctrl-pan-ready');
});
window.addEventListener('blur',()=>{spacePan=false;document.body.classList.remove('space-pan-ready','ctrl-pan-ready')});

qs('routeTouchUndoBtn').onclick=e=>{e.preventDefault();e.stopPropagation();undoRoutePoint()};
qs('selectionDuplicateBtn').onclick=e=>{e.preventDefault();e.stopPropagation();startDuplicatePlacement(selected)};
qs('buildingJump').onchange=e=>{const v=e.target.value;if(v){zoomToBuilding(v);e.target.value=''}};qs('viewBackBtn').onclick=goBackView;qs('deviceSearchCloseBtn').onclick=closeDeviceSearch;qs('deviceSearchInput').addEventListener('input',e=>renderDeviceSearch(e.target.value));qs('deviceSearchInput').addEventListener('keydown',e=>{if(e.key==='Enter'){const first=qs('deviceSearchResults')?.querySelector('button');if(first){e.preventDefault();first.click()}}});
qs('routeTouchFinishBtn').onclick=e=>{e.preventDefault();e.stopPropagation();if(routeDraw)finishRoute(false)};qs('routeTouchCancelBtn').onclick=e=>{e.preventDefault();e.stopPropagation();if(routeDraw)finishRoute(true)};
qs('plus').onclick=()=>{zoom=Math.min(4,zoom*1.15);tf()};qs('minus').onclick=()=>{zoom=Math.max(.3,zoom/1.15);tf()};qs('fitBtn').onclick=()=>{pushViewState();zoom=1;pan={x:0,y:0};tf()};qs('resetBtn').onclick=()=>{zoom=1;pan={x:0,y:0};tf()};
function componentCategory(c){const k=c.dataset.kind||'';if(k==='customDevice')return c.dataset.customCategory||'other';if(['nippleDrinker','medTank','dosingPump','waterTower','cityWater','groundWater','groundWell','cityOutlet','groundOutlet','towerOutlet','threeWay','transferPump','boosterPump','pressureTank','waterFilter','waterMeter','checkValve','shutoffValve','levelSensor'].includes(k))return 'water';if(['utilityPower','generator','ats','mainSwitch','mainPanel','subPanel','equipmentPanel'].includes(k))return 'electric';if(['coolingPad','exhaustFan','guideFan','coolingPump','heatLamp'].includes(k))return 'vent';return 'other'}

const QUICK_FILTER_KINDS={
 feed:new Set(['feedSilo','feedMotor','feedCorner','feedDrop','feedSensor']),
 pump:new Set(['transferPump','boosterPump','coolingPump','dosingPump']),
 valve:new Set(['threeWay','checkValve','shutoffValve']),
 sensor:new Set(['levelSensor','feedSensor','waterMeter'])
};
const QUICK_FILTER_BUTTONS={all:'viewAllBtn',water:'viewWaterBtn',electric:'viewElectricBtn',vent:'viewVentBtn',waste:'viewWasteBtn',feed:'viewFeedBtn',pump:'viewPumpBtn',valve:'viewValveBtn',sensor:'viewSensorBtn'};
function quickFilterMatch(c,preset){
 if(preset==='all')return true;
 const kind=c.dataset.kind||'',cat=componentCategory(c);
 if(QUICK_FILTER_KINDS[preset])return QUICK_FILTER_KINDS[preset].has(kind)||(kind==='customDevice'&&c.dataset.customCategory===preset);
 return cat===preset||(preset==='electric'&&cat==='vent');
}
function deviceFilterKey(c){
 if(!c?.classList?.contains('component'))return'';
 if(c.dataset.kind==='customDevice')return'custom:'+((c.dataset.name||'自訂設備').trim());
 return'kind:'+(c.dataset.kind||'other');
}
function deviceFilterLabel(c){
 if(c.dataset.kind==='customDevice')return(c.dataset.customIcon||'●')+' '+(c.dataset.name||'自訂設備');
 return labels[c.dataset.kind]||c.dataset.kind||'設備';
}
function renderDeviceFilters(){
 const box=qs('deviceTypeFilters'),single=qs('deviceSingleFilter');if(!box||!single)return;
 const comps=[...document.querySelectorAll('.component[data-user="1"]')],groups=new Map();
 comps.forEach(c=>{
   const key=deviceFilterKey(c);if(!key)return;
   const g=groups.get(key)||{label:deviceFilterLabel(c),count:0};g.count++;groups.set(key,g);
 });
 box.innerHTML='';
 if(!groups.size)box.innerHTML='<span class="tiny">尚未放置設備。</span>';
 [...groups.entries()].sort((a,b)=>a[1].label.localeCompare(b[1].label,'zh-Hant')).forEach(([key,g])=>{
   const b=document.createElement('button');b.type='button';b.className='device-filter-chip';b.dataset.filterKey=key;
   const name=document.createElement('span');name.textContent=g.label;const count=document.createElement('b');count.textContent=g.count;b.append(name,count);
   b.classList.toggle('active',deviceTypeFilter instanceof Set&&deviceTypeFilter.has(key));
   b.onclick=()=>{
     singleDeviceUid='';single.value='';
     if(deviceTypeFilter===null)deviceTypeFilter=new Set([key]);
     else if(deviceTypeFilter.has(key))deviceTypeFilter.delete(key);
     else deviceTypeFilter.add(key);
     applyViewFilters();renderDeviceFilters();
   };
   box.appendChild(b);
 });
 single.innerHTML='<option value="">依上方篩選</option>';
 comps.sort((a,b)=>(a.dataset.name||'').localeCompare(b.dataset.name||'','zh-Hant')).forEach(c=>{
   const o=document.createElement('option');o.value=c.dataset.uid||'';o.textContent=c.dataset.name||objectTypeText(c);single.appendChild(o);
 });
 if(singleDeviceUid&&[...single.options].some(o=>o.value===singleDeviceUid))single.value=singleDeviceUid;
 else if(!singleDeviceUid)single.value='';
 qs('deviceFilterAllBtn')?.classList.toggle('active',deviceTypeFilter===null&&!singleDeviceUid);
}

function applyViewFilters(){
 const b=qs('buildingFilter')?.value||'all';
 document.querySelectorAll('.component[data-user="1"]').forEach(c=>{
   const cat=componentCategory(c);
   let ok=quickFilterMatch(c,viewPreset);
   if(b!=='all'){const cb=(c.dataset.building||'').trim();ok=ok&&cb.includes(b)}
   if(singleDeviceUid)ok=ok&&c.dataset.uid===singleDeviceUid;
   else if(deviceTypeFilter instanceof Set)ok=ok&&deviceTypeFilter.has(deviceFilterKey(c));
   c.style.display=ok?'':'none';
 });
 const show=(id,on)=>{const el=qs(id);if(el)el.style.display=on?'':'none'};
 if(viewPreset==='feed'){show('feedLayer',true);show('waterLayer',false);show('elecLayer',false);show('ventLayer',false)}
 else if(['pump','valve','sensor'].includes(viewPreset)){show('feedLayer',false);show('waterLayer',false);show('elecLayer',false);show('ventLayer',false)}
 if(viewPreset==='water'){show('feedLayer',false);show('waterLayer',true);show('elecLayer',false);show('ventLayer',false)}
 else if(viewPreset==='electric'){show('feedLayer',false);show('waterLayer',false);show('elecLayer',true);show('ventLayer',true)}
 else if(viewPreset==='vent'){show('feedLayer',false);show('waterLayer',false);show('elecLayer',false);show('ventLayer',true)}
 else if(viewPreset==='waste'){show('feedLayer',false);show('waterLayer',true);show('elecLayer',false);show('ventLayer',false)}
 else{show('feedLayer',qs('feedChk').checked);show('waterLayer',qs('waterChk').checked);show('elecLayer',qs('elecChk').checked);show('ventLayer',qs('ventChk').checked)}
 Object.values(QUICK_FILTER_BUTTONS).forEach(id=>{const btn=qs(id);if(!btn)return;const active=id===QUICK_FILTER_BUTTONS[viewPreset];btn.classList.toggle('preset-active',active);btn.setAttribute('aria-pressed',String(active))});
}
qs('viewAllBtn').onclick=()=>{viewPreset='all';applyViewFilters()};
qs('viewWaterBtn').onclick=()=>{viewPreset='water';applyViewFilters()};
qs('viewElectricBtn').onclick=()=>{viewPreset='electric';applyViewFilters()};
qs('viewVentBtn').onclick=()=>{viewPreset='vent';applyViewFilters()};
qs('viewWasteBtn').onclick=()=>{viewPreset='waste';applyViewFilters()};
qs('viewSensorBtn').onclick=()=>{viewPreset='sensor';applyViewFilters()};
qs('viewValveBtn').onclick=()=>{viewPreset='valve';applyViewFilters()};
qs('viewPumpBtn').onclick=()=>{viewPreset='pump';applyViewFilters()};
qs('viewFeedBtn').onclick=()=>{viewPreset='feed';applyViewFilters()};

// Custom view groups: browser-local UI preference, never modifies or deletes devices.
const CUSTOM_VIEW_KEY='huwei-cad-quick-presets-v1';
function getCustomViews(){try{const a=JSON.parse(localStorage.getItem(CUSTOM_VIEW_KEY)||'[]');return Array.isArray(a)?a.filter(p=>p&&typeof p.name==='string'&&Array.isArray(p.keys)).slice(0,30):[]}catch{return[]}}
function setCustomViews(p){try{localStorage.setItem(CUSTOM_VIEW_KEY,JSON.stringify(p));return true}catch{return false}}
function customViewMessage(message){const s=qs('customViewStatus');if(s)s.textContent=message}
function refreshCustomViewPick(preferred){const p=qs('customViewPick');if(!p)return;const old=preferred??p.value;p.replaceChildren(new Option('選擇已儲存組合…',''));getCustomViews().forEach(v=>p.add(new Option(v.name,v.name)));p.value=getCustomViews().some(v=>v.name===old)?old:''}
qs('customViewSave')?.addEventListener('click',()=>{
 const name=(qs('customViewName')?.value||'').trim();if(!name){customViewMessage('請先輸入組合名稱');return}
 const visible=[...document.querySelectorAll('.device-filter-chip.active')].map(b=>b.dataset.filterKey).filter(Boolean);
 const keys=deviceTypeFilter instanceof Set?[...deviceTypeFilter]:deviceTypeFilter===null?[...document.querySelectorAll('.device-filter-chip')].map(b=>b.dataset.filterKey):visible;
 if(!keys.length){customViewMessage('請先在「設備項目」選擇至少一種設備');return}
 const all=getCustomViews(),existing=all.findIndex(x=>x.name===name);const v={name,keys};if(existing>=0)all[existing]=v;else all.push(v);
 if(all.length>30){customViewMessage('最多可儲存 30 個檢視組合');return}
 if(!setCustomViews(all)){customViewMessage('瀏覽器無法儲存此組合');return}
 refreshCustomViewPick(name);customViewMessage('已儲存「'+name+'」；點「套用」即可檢視');
});
qs('customViewApply')?.addEventListener('click',()=>{
 const v=getCustomViews().find(x=>x.name===qs('customViewPick')?.value);if(!v){customViewMessage('請先選擇組合');return}
 viewPreset='all';singleDeviceUid='';if(qs('deviceSingleFilter'))qs('deviceSingleFilter').value='';
 deviceTypeFilter=new Set(v.keys);applyViewFilters();renderDeviceFilters();
 if(qs('customViewName'))qs('customViewName').value=v.name;
 customViewMessage('已套用「'+v.name+'」：顯示 '+v.keys.length+' 種設備類型');
});
qs('customViewDelete')?.addEventListener('click',()=>{
 const name=qs('customViewPick')?.value;if(!name){customViewMessage('請先選擇要刪除的組合');return}
 if(!confirm('刪除自訂檢視「'+name+'」？不會刪除圖面設備。'))return;
 const a=getCustomViews().filter(x=>x.name!==name);if(!setCustomViews(a)){customViewMessage('刪除失敗');return}
 refreshCustomViewPick('');customViewMessage('已刪除檢視組合，圖面設備沒有變動');
});
refreshCustomViewPick();

qs('deviceFilterAllBtn').onclick=()=>{deviceTypeFilter=null;singleDeviceUid='';qs('deviceSingleFilter').value='';applyViewFilters();renderDeviceFilters()};
qs('deviceFilterNoneBtn').onclick=()=>{deviceTypeFilter=new Set();singleDeviceUid='';qs('deviceSingleFilter').value='';applyViewFilters();renderDeviceFilters()};
qs('deviceSingleFilter').onchange=e=>{singleDeviceUid=e.target.value||'';if(singleDeviceUid)deviceTypeFilter=null;applyViewFilters();renderDeviceFilters()};
qs('buildingFilter').onchange=applyViewFilters;
[['cadBaseChk','cadBase'],['whiteRefChk','whiteRef'],['feedChk','feedLayer'],['hotspotChk','hotspots'],['waterChk','waterLayer'],['elecChk','elecLayer'],['componentChk','componentLayer'],['ventChk','ventLayer'],['annoChk','annoLayer']].forEach(([c,l])=>qs(c).onchange=e=>{qs(l).style.display=e.target.checked?'':'none';if(['waterChk','elecChk','ventChk'].includes(c)&&viewPreset!=='all')applyViewFilters()});
qs('modeBtn').onclick=()=>{const dark=qs('cadBase').style.display!=='none';if(dark){qs('cadBase').style.display='none';qs('whiteRef').style.display='';qs('cadBaseChk').checked=false;qs('whiteRefChk').checked=true;qs('modeBtn').textContent='底圖：白底確認圖'}else{qs('cadBase').style.display='';qs('whiteRef').style.display='none';qs('cadBaseChk').checked=true;qs('whiteRefChk').checked=false;qs('modeBtn').textContent='底圖：深色CAD'}};
qs('applyBtn').onclick=()=>{if(!selected)return alert('請先選物件');
 if(!fields.name.value.trim()){alert('請填寫設備名稱，才能儲存。');fields.name.focus();return;}
 fields.name.value=fields.name.value.trim();
 if(selected.classList.contains('component'))for(const key of ['x','y','rotation']){const fld=fields[key];if(!fld||!fld.value.trim()||!Number.isFinite(Number(fld.value))){alert('請輸入有效的數值：'+(fld?.closest('.prop-row')?.querySelector('label')?.textContent||key));fld?.focus();return;}}
 const ranges=[['iconScale',.2,5],['shapeScaleX',.3,3],['shapeScaleY',.3,3],['labelScale',.4,3]];
 if(selected.classList.contains('component'))for(const [key,min,max] of ranges){const fld=fields[key];if(!fld||fld.value==='')continue;const val=Number(fld.value);if(!Number.isFinite(val)||val<min||val>max){alert('數值超出允許範圍：'+(fld.closest('.prop-row')?.querySelector('label')?.textContent||key)+'（'+min+'～'+max+'）');fld.focus();return;}}
selected.dataset.name=fields.name.value;selected.dataset.mainFunction=fields.mainFunction.value.trim()||objectMainFunction(selected);selected.dataset.note=fields.note.value;selected.dataset.building=fields.building.value;selected.dataset.sourceA=fields.sourceA.value;selected.dataset.sourceB=fields.sourceB.value;selected.dataset.target=fields.target.value;selected.dataset.spec=fields.spec.value;selected.dataset.lineSize=fields.lineSize.value;selected.dataset.powerKw=fields.powerKw.value;selected.dataset.airflow=fields.airflow.value;selected.dataset.staticPa=fields.staticPa.value;selected.dataset.emergencyClass=fields.emergencyClass.value;selected.dataset.switchState=fields.switchState.value;selected.dataset.backup=fields.backup.value;
 if(selected.classList.contains('component')){saveSourceConfig(true);const nx=parseFloat(fields.x.value)||0,ny=parseFloat(fields.y.value)||0,rot=parseFloat(fields.rotation.value)||0,sc=Math.max(.2,Math.min(5,parseFloat(fields.iconScale.value)||0.8)),sx=Math.max(.3,Math.min(3,parseFloat(fields.shapeScaleX.value)||1)),sy=Math.max(.3,Math.min(3,parseFloat(fields.shapeScaleY.value)||1)),lsc=Math.max(.4,Math.min(3,parseFloat(fields.labelScale.value)||0.9));selected.dataset.x=nx.toFixed(1);selected.dataset.y=ny.toFixed(1);selected.dataset.rotation=rot.toFixed(0);selected.dataset.iconScale=sc.toFixed(2);selected.dataset.shapeScaleX=sx.toFixed(2);selected.dataset.shapeScaleY=sy.toFixed(2);selected.dataset.shapeLock=fields.shapeLock.value||'yes';selected.dataset.labelScale=lsc.toFixed(1);selected.dataset.showLabel=fields.showLabel.value||'yes';applyComponentVisual(selected);const lab=selected.querySelector('.component-label');if(lab)lab.textContent=fields.name.value;if(selected.dataset.kind==='customDevice')applyCustomDeviceAppearance(selected);if(selected.dataset.kind==='threeWay'){if(fields.switchState.value){const s=fields.switchState.value;selected.dataset.valveActivePort=s===selected.dataset.valveSourceB?'B':s===selected.dataset.valveSourceC?'C':'A';}updateThreeWayVisual(selected);applyComponentVisual(selected);syncValvePanel(selected);}updateConnectedRoutes(selected.dataset.uid);}
 autosave();refreshList();if(selected.classList?.contains('component'))applyComponentVisual(selected);fill(selected);showObjectDetail(selected);status.textContent='本機已保存：'+selected.dataset.name+'｜雲端狀態請看上方提示';window.dispatchEvent(new CustomEvent('cad:editor-saved',{detail:{uid:selected.dataset.uid||'',name:selected.dataset.name||''}}));};
qs('iconSmallerBtn').onclick=()=>{if(!selected||!selected.classList.contains('component'))return alert('請先選取標記設備');fields.iconScale.value=(Math.max(.2,(parseFloat(fields.iconScale.value)||0.8)-0.1)).toFixed(1);qs('applyBtn').click();};
qs('iconLargerBtn').onclick=()=>{if(!selected||!selected.classList.contains('component'))return alert('請先選取標記設備');fields.iconScale.value=(Math.min(5,(parseFloat(fields.iconScale.value)||0.8)+0.1)).toFixed(1);qs('applyBtn').click();};
qs('labelToggleBtn').onclick=()=>{if(!selected||!selected.classList.contains('component'))return alert('請先選取標記設備');fields.showLabel.value=(fields.showLabel.value==='no'?'yes':'no');qs('applyBtn').click();};
qs('applyGlobalMarkerBtn').onclick=()=>applyGlobalMarkerSettings({iconScale:qs('globalIconScale').value,labelScale:qs('globalLabelScale').value});
qs('hideAllLabelsBtn').onclick=()=>applyGlobalMarkerSettings({showLabel:false});
qs('showAllLabelsBtn').onclick=()=>applyGlobalMarkerSettings({showLabel:true});

let shapeSyncing=false;
function applyShapeRatioLive(changed){
 if(shapeSyncing||!selected?.classList?.contains('component'))return;
 shapeSyncing=true;
 let sx=Math.max(.3,Math.min(3,parseFloat(fields.shapeScaleX.value)||1));
 let sy=Math.max(.3,Math.min(3,parseFloat(fields.shapeScaleY.value)||1));
 if(fields.shapeLock.value==='yes'){
   if(changed==='y')sx=sy;else sy=sx;
 }
 fields.shapeScaleX.value=sx.toFixed(2);fields.shapeScaleY.value=sy.toFixed(2);
 selected.dataset.shapeScaleX=sx.toFixed(2);selected.dataset.shapeScaleY=sy.toFixed(2);selected.dataset.shapeLock=fields.shapeLock.value;
 applyComponentVisual(selected);updateConnectedRoutes(selected.dataset.uid);autosave();
 shapeSyncing=false;
}
fields.shapeScaleX.addEventListener('input',()=>applyShapeRatioLive('x'));
fields.shapeScaleY.addEventListener('input',()=>applyShapeRatioLive('y'));
fields.shapeLock.addEventListener('change',()=>{
 if(!selected?.classList?.contains('component'))return;
 selected.dataset.shapeLock=fields.shapeLock.value;
 if(fields.shapeLock.value==='yes'){fields.shapeScaleY.value=fields.shapeScaleX.value;applyShapeRatioLive('x')}else autosave();
});
qs('shapeNormalBtn').onclick=()=>{if(!selected?.classList?.contains('component'))return alert('請先選取標示物件');fields.shapeLock.value='yes';fields.shapeScaleX.value='1';fields.shapeScaleY.value='1';applyShapeRatioLive('x')};
qs('shapeWideBtn').onclick=()=>{if(!selected?.classList?.contains('component'))return alert('請先選取標示物件');fields.shapeLock.value='no';fields.shapeScaleX.value='1.35';fields.shapeScaleY.value='0.85';applyShapeRatioLive('x')};
qs('shapeTallBtn').onclick=()=>{if(!selected?.classList?.contains('component'))return alert('請先選取標示物件');fields.shapeLock.value='no';fields.shapeScaleX.value='0.85';fields.shapeScaleY.value='1.35';applyShapeRatioLive('y')};

fields.mainFunction.addEventListener('input',()=>{if(!selected)return;selected.dataset.mainFunction=fields.mainFunction.value; if(selected.classList?.contains('component'))applyComponentVisual(selected); if(objectDetailTarget===selected)showObjectDetail(selected);});
fields.iconScale.addEventListener('input',()=>{if(!selected?.classList?.contains('component'))return;const v=parseFloat(fields.iconScale.value);if(!isFinite(v))return;selected.dataset.iconScale=Math.max(.2,Math.min(5,v)).toFixed(1);applyComponentVisual(selected);updateConnectedRoutes(selected.dataset.uid);});
fields.labelScale.addEventListener('input',()=>{if(!selected?.classList?.contains('component'))return;const v=parseFloat(fields.labelScale.value);if(!isFinite(v))return;selected.dataset.labelScale=Math.max(.4,Math.min(3,v)).toFixed(1);applyComponentVisual(selected);});
fields.showLabel.addEventListener('change',()=>{if(!selected?.classList?.contains('component'))return;selected.dataset.showLabel=fields.showLabel.value||'yes';applyComponentVisual(selected);autosave();});
[sourceFields.kva,sourceFields.pf,sourceFields.atsMode,sourceFields.atsAmp].forEach(el=>el?.addEventListener('input',()=>{if(selected?.classList?.contains('component')){saveSourceConfig();}}));
qs('saveValveBtn').onclick=saveValveConfig;
qs('presetTowerGround').onclick=()=>{valveEls.a.value='水塔';valveEls.b.value='地下水';valveEls.c.value='';valveEls.active.value='A';valveEls.mode.value='手動';previewValvePanel();};
qs('presetTowerCity').onclick=()=>{valveEls.a.value='水塔';valveEls.b.value='自來水';valveEls.c.value='';valveEls.active.value='A';valveEls.mode.value='手動';previewValvePanel();};
qs('presetAllWater').onclick=()=>{valveEls.a.value='水塔';valveEls.b.value='地下水';valveEls.c.value='自來水';valveEls.active.value='A';valveEls.mode.value='手動';previewValvePanel();};
valveEls.scale.addEventListener('input',()=>setValveScale(valveEls.scale.value,false));
valveEls.scale.addEventListener('change',()=>setValveScale(valveEls.scale.value,true));
valveEls.scaleNum.addEventListener('input',()=>setValveScale(valveEls.scaleNum.value,false));
valveEls.scaleNum.addEventListener('change',()=>setValveScale(valveEls.scaleNum.value,true));
qs('valveShrinkBtn').onclick=()=>setValveScale((parseFloat(selected?.dataset?.iconScale||0.8)-0.1),true);
qs('valveGrowBtn').onclick=()=>setValveScale((parseFloat(selected?.dataset?.iconScale||0.8)+0.1),true);
qs('valveResetSizeBtn').onclick=()=>setValveScale(0.8,true);
[valveEls.a,valveEls.b,valveEls.c,valveEls.active,valveEls.outlet,valveEls.mode,valveEls.note].forEach(el=>{el?.addEventListener('input',previewValvePanel);el?.addEventListener('change',previewValvePanel);});

qs('clearUserBtn').onclick=()=>{if(confirm('清除所有後續新增的水線、電線、設備與註記？')){document.querySelectorAll('[data-user="1"]').forEach(n=>n.remove());fill(null);autosave();refreshList()}};
function serialize(){return [...document.querySelectorAll('[data-user="1"]')].map(el=>({parent:el.parentElement.id,svg:new XMLSerializer().serializeToString(el)}))}
function dl(fn,content,type){const b=new Blob([content],{type});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=fn;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function exportData(){return{version:'6.9.49',zoom,pan,scaleFactor,customLibrary:getCustomLibrary(),elements:serialize()}}
// V6.9.31 設備資料保護：下載備份、匯入還原、刪除前保留可復原快照。
const SAFE_BACKUP_KEY='pigfarmCadSafeBackupV6931';
function backupSnapshot(){
  try {localStorage.setItem(SAFE_BACKUP_KEY,JSON.stringify({savedAt:new Date().toISOString(),project:exportData()}));return true;}catch(e){status.textContent='備份暫存失敗：請手動下載配置';return false}
}
// V6.9.32：有數量上限的本機歷史版本，每 3 分鐘最多自動記錄一次。
const HISTORY_STORAGE_KEY='pigfarmCadHistoryV6932';
let lastTimedSnapshot=0;
function readSavedVersions(){
 try {const arr=JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY)||'[]');return Array.isArray(arr)?arr.filter(v=>v&&v.project&&Array.isArray(v.project.elements)).slice(0,8):[]}catch(e){return []}
}
function saveVersion(reason='手動還原點',force=false){
 try {
  const now=Date.now(); if(!force&&now-lastTimedSnapshot<180000)return false;
  const project=exportData(); const arr=readSavedVersions();
  const serialized=JSON.stringify(project);
  if(arr.length&&JSON.stringify(arr[0].project)===serialized){lastTimedSnapshot=now;return true}
  const item={id:now,savedAt:new Date(now).toISOString(),reason,project};
  const keep=[item,...arr].slice(0,8);
  try {localStorage.setItem(HISTORY_STORAGE_KEY,JSON.stringify(keep))}
  catch(err){ // 儲存空間不足時僅減少歷史數量，絕不清除當前專案
   let ok=false;
   for(let n=keep.length-1;n>=1;n--){try{localStorage.setItem(HISTORY_STORAGE_KEY,JSON.stringify(keep.slice(0,n)));ok=true;break}catch(e){}}
   if(!ok)throw err;
  }
  lastTimedSnapshot=now;return true;
 }catch(e){status.textContent='歷史版本儲存失敗：請下載 JSON 備份';return false}
}
function showHistoryManager(){
 const el=qs('historyManagerDialog'),list=qs('historyManagerList');if(!el||!list)return;
 list.textContent='';const versions=readSavedVersions();
 if(!versions.length){list.textContent='目前還沒有歷史版本。可先按「建立還原點」。'}
 versions.forEach(v=>{
  const row=document.createElement('div');row.className='history-entry';
  const info=document.createElement('div');info.className='history-entry-info';
  const name=document.createElement('strong');name.textContent=v.reason||'歷史配置';
  const detail=document.createElement('span');detail.textContent=new Date(v.savedAt).toLocaleString('zh-TW')+' · '+v.project.elements.length+' 個新增物件';
  const btn=document.createElement('button');btn.type='button';btn.textContent='還原此版本';
  btn.onclick=()=>{
   if(!confirm('將以此版本覆蓋目前的新增設備、管線及註記。要繼續嗎？'))return;
   saveVersion('還原前自動備份',true);backupSnapshot();
   try{loadData(v.project);resetHistoryFromCurrent();autosave();el.hidden=true;status.textContent='已還原歷史版本：'+detail.textContent}
   catch(e){alert('還原失敗：'+e.message)}
  };
  info.append(name,detail);row.append(info,btn);list.append(row);
 });
 el.hidden=false;
}
qs('historyManagerBtn')?.addEventListener('click',showHistoryManager);
qs('historyCloseBtn')?.addEventListener('click',()=>{qs('historyManagerDialog').hidden=true});
qs('historyManagerDialog')?.addEventListener('click',e=>{if(e.target.id==='historyManagerDialog')e.target.hidden=true});
qs('historyCreateBtn')?.addEventListener('click',()=>{saveVersion('手動還原點',true);showHistoryManager()});
qs('historyDownloadBtn')?.addEventListener('click',()=>qs('backupNowBtn')?.click());

qs('backupNowBtn')?.addEventListener('click',()=>{
  backupSnapshot();saveVersion('下載備份',true);
  dl('虎尾母豬場設備配置備份.json',JSON.stringify({kind:'huwei-cad-backup',savedAt:new Date().toISOString(),project:exportData()},null,2),'application/json');
  status.textContent='已產生設備配置備份下載';
});
qs('restoreBackupBtn')?.addEventListener('click',()=>qs('restoreBackupFile')?.click());
qs('restoreBackupFile')?.addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  const raw=JSON.parse(await file.text()), data=raw?.kind==='huwei-cad-backup'?raw.project:raw;
  if(!data||!Array.isArray(data.elements)||data.elements.length>25000)throw Error('檔案缺少有效的設備配置資料');
  if(!confirm('還原會取代目前新增的設備、管線與註記。確定繼續？'))return;
  backupSnapshot();saveVersion('匯入前備份',true);
  loadData(data);resetHistoryFromCurrent();autosave();
  status.textContent='已還原備份：設備與管線資料載入完成';
 }catch(err){alert('備份還原失敗：'+err.message)}
 finally{e.target.value=''}
});
qs('saveBtn').onclick=()=>dl('pigfarm_cad_project_v18.json',JSON.stringify(exportData(),null,2),'application/json');qs('loadBtn').onclick=()=>qs('loadInput').click();qs('loadInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;loadData(JSON.parse(await f.text()));};

function sanitizeObsoleteOverlayArtifacts(){
 let removed=0;
 const badClasses=['route-preview','measure-line','measure-label','snap-ring','cal-dot'];
 document.querySelectorAll('#viewport [data-user="1"]').forEach(el=>{
   const cls=[...el.classList];
   const dash=(el.getAttribute('stroke-dasharray')||'').trim();
   const style=(el.getAttribute('style')||'').toLowerCase();
   const obsolete=badClasses.some(c=>cls.includes(c)) || (!!dash && dash!=='none') || style.includes('stroke-dasharray');
   if(obsolete){el.remove();removed++}
 });
 ['scaleGuideLayer','measureGuideLayer','routeEditLayer'].forEach(id=>{const el=qs(id);if(el){el.remove();removed++}});
 return removed;
}


// ===== V6.0 Google Sheet / Apps Script cloud sync =====
const CLOUD_CFG_KEY='pigfarmCloudCfgV1';
let cloudPushTimer=null,cloudApplyingRemote=false,cloudBusy=false,pendingFieldPhoto=null,cloudSheetUrl='',cloudFolderUrl='',cloudPullArmed=false;
function defaultDeviceName(){const ua=navigator.userAgent||'';if(/iPad/i.test(ua)||(/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1))return'現場 iPad';if(/iPhone/i.test(ua))return'現場 iPhone';if(/Android/i.test(ua))return'現場 Android';return'現場電腦'}
function loadCloudConfig(){const defaultEndpoint='https://script.google.com/macros/s/AKfycbwNUOGoY0j-XRQpBJ7YODl_nangQzSKZa2GfHmXXZVC7bP2r9suQtgjYvGe690sid1X/exec';let c={endpoint:defaultEndpoint,token:'',projectId:'huwei-pigfarm-main',deviceName:defaultDeviceName(),autoSync:false,revision:0,lastSynced:'',pendingCount:0};try{const s=JSON.parse(localStorage.getItem(CLOUD_CFG_KEY)||'{}');c={...c,...s};c.token='';if(!String(c.endpoint||'').trim())c.endpoint=defaultEndpoint}catch(e){}return c}
let cloudConfig=loadCloudConfig();
function saveCloudConfig(){try{localStorage.setItem(CLOUD_CFG_KEY,JSON.stringify(cloudConfig))}catch(e){}updateCloudUi()}
function cloudConfigured(){return!!(cloudConfig.endpoint&&window.CAD_ADMIN_SESSION&&cloudConfig.projectId)}
function fmtBytes(n){n=Number(n)||0;if(n<1024)return n+' B';if(n<1048576)return(n/1024).toFixed(1)+' KB';return(n/1048576).toFixed(1)+' MB'}
function ensureObjectUid(el){if(!el||el.dataset.user!=='1')return'';if(!el.dataset.uid){el.dataset.uid='obj-'+Date.now()+'-'+Math.floor(Math.random()*99999);autosave()}return el.dataset.uid}
function getDeviceId(){let id='';try{id=localStorage.getItem('pigfarmDeviceId')||''}catch(e){}if(!id){id='dev-'+Date.now()+'-'+Math.random().toString(36).slice(2,9);try{localStorage.setItem('pigfarmDeviceId',id)}catch(e){}}return id}
function setCloudMessage(msg,kind=''){const el=qs('cloudMessage');if(!el)return;el.className='cloud-message'+(kind?' '+kind:'');el.textContent=msg}
function setCloudDot(kind=''){const d=qs('cloudDot');if(!d)return;d.className='cloud-dot'+(kind?' '+kind:'')}
function updateCloudStatusLabel(){
 const t=qs('cloudStatusText');if(!t)return;const pending=Number(cloudConfig.pendingCount||0);
 if(!navigator.onLine){t.textContent='離線';setCloudDot('error');return}
 if(!cloudConfigured()){t.textContent='雲端設定';setCloudDot('');return}
 if(cloudBusy){t.textContent='同步中…';setCloudDot('sync');return}
 if(pending>0){t.textContent='待同步 '+pending;setCloudDot('sync');return}
 t.textContent='已同步';setCloudDot('ok');
}
function markCloudPending(){
 if(cloudApplyingRemote||!cloudConfigured())return;
 cloudConfig.pendingCount=Math.min(99,Number(cloudConfig.pendingCount||0)+1);
 try{localStorage.setItem(CLOUD_CFG_KEY,JSON.stringify(cloudConfig))}catch(e){}
 updateCloudStatusLabel();
}
function updateCloudUi(){if(qs('cloudEndpoint'))qs('cloudEndpoint').value=cloudConfig.endpoint||'';if(qs('cloudToken'))qs('cloudToken').value='';if(qs('cloudProjectId'))qs('cloudProjectId').value=cloudConfig.projectId||'huwei-pigfarm-main';if(qs('cloudDeviceName'))qs('cloudDeviceName').value=cloudConfig.deviceName||defaultDeviceName();if(qs('cloudAutoSync'))qs('cloudAutoSync').checked=!!cloudConfig.autoSync;if(qs('cloudRevision'))qs('cloudRevision').textContent=String(cloudConfig.revision||0);if(qs('cloudLastSync'))qs('cloudLastSync').textContent=cloudConfig.lastSynced?new Date(cloudConfig.lastSynced).toLocaleString('zh-TW'):'尚未同步';try{if(qs('cloudProjectSize'))qs('cloudProjectSize').textContent=fmtBytes(new Blob([JSON.stringify(exportData())]).size)}catch(e){}if(qs('cloudOpenSheetBtn'))qs('cloudOpenSheetBtn').disabled=!cloudSheetUrl;if(qs('cloudOpenFolderBtn'))qs('cloudOpenFolderBtn').disabled=!cloudFolderUrl;if(!cloudConfigured())setCloudDot('');updateCloudStatusLabel()}
function readCloudForm(){cloudConfig.endpoint=(qs('cloudEndpoint')?.value||'').trim();cloudConfig.token='';cloudConfig.projectId=(qs('cloudProjectId')?.value||'huwei-pigfarm-main').trim()||'huwei-pigfarm-main';cloudConfig.deviceName=(qs('cloudDeviceName')?.value||defaultDeviceName()).trim()||defaultDeviceName();cloudConfig.autoSync=!!qs('cloudAutoSync')?.checked;saveCloudConfig()}
async function cloudApi(action,data={}){if(!cloudConfigured())throw new Error('請先設定 Apps Script URL 與 Token');const ctrl=new AbortController(),tm=setTimeout(()=>ctrl.abort(),45000);try{const res=await fetch(cloudConfig.endpoint,{method:'POST',redirect:'follow',cache:'no-store',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,session:window.CAD_ADMIN_SESSION||'',projectId:cloudConfig.projectId,deviceId:getDeviceId(),deviceName:cloudConfig.deviceName,...data}),signal:ctrl.signal});const raw=await res.text();let out;try{out=JSON.parse(raw)}catch(e){throw new Error('Apps Script 回傳不是 JSON；請確認使用 /exec 網址與部署權限。')}if(!out.ok){const err=new Error(out.error||'雲端操作失敗');err.cloud=out;throw err}if(out.sheetUrl)cloudSheetUrl=out.sheetUrl;if(out.folderUrl)cloudFolderUrl=out.folderUrl;return out}catch(err){if(err?.name==='AbortError')throw new Error('雲端連線逾時');if(String(err?.message||err).includes('Failed to fetch'))throw new Error('無法連線 Apps Script。請確認 Web App 已部署為可存取，並使用 /exec 網址。');throw err}finally{clearTimeout(tm)}}
function openCloudModal(){qs('cloudModal').classList.add('show');qs('cloudModal').setAttribute('aria-hidden','false');updateCloudUi();setCloudMessage(cloudConfigured()?'已載入此裝置的連線設定。':'請先填入 Apps Script /exec 網址與 Token。',cloudConfigured()?'ok':'')}
function closeCloudModal(){qs('cloudModal').classList.remove('show');qs('cloudModal').setAttribute('aria-hidden','true')}
async function testCloud(){if(cloudBusy)return;readCloudForm();cloudBusy=true;setCloudDot('sync');setCloudMessage('正在測試 Apps Script / Google Sheet…');try{const out=await cloudApi('ping');cloudConfig.revision=Number(out.revision||0);saveCloudConfig();setCloudDot('ok');setCloudMessage(`連線成功｜雲端版本 ${cloudConfig.revision}｜伺服器 ${out.serverTime||''}`,'ok')}catch(e){setCloudDot('error');setCloudMessage(e.message||String(e),'error')}finally{cloudBusy=false}}
async function cloudPush({silent=false,force=false}={}){if(!cloudConfigured()){if(!silent)openCloudModal();return false}if(cloudBusy)return false;cloudBusy=true;updateCloudStatusLabel();if(!silent)setCloudMessage('正在上傳目前圖面到雲端…');try{const project=exportData(),bytes=new Blob([JSON.stringify(project)]).size;const out=await cloudApi('saveProject',{project,baseRevision:Number(cloudConfig.revision||0),force:!!force});cloudConfig.revision=Number(out.revision||cloudConfig.revision||0);cloudConfig.lastSynced=out.updatedAt||new Date().toISOString();cloudConfig.pendingCount=0;saveCloudConfig();updateCloudStatusLabel();window.dispatchEvent(new CustomEvent('cad:cloud-published',{detail:{revision:cloudConfig.revision,time:cloudConfig.lastSynced}}));if(!silent)setCloudMessage(`上傳完成｜版本 ${cloudConfig.revision}｜${fmtBytes(bytes)}`,'ok');return true}catch(e){setCloudDot('error');if(e.cloud?.conflict){cloudConfig.revision=Number(e.cloud.revision||cloudConfig.revision||0);saveCloudConfig();setCloudMessage(`雲端已有較新版本 ${cloudConfig.revision}，本機沒有覆蓋。請先下載雲端版本。`,'warn')}else if(!silent)setCloudMessage(e.message||String(e),'error');window.dispatchEvent(new CustomEvent('cad:cloud-failed',{detail:{message:e.message||String(e)}}));return false}finally{cloudBusy=false;updateCloudStatusLabel()}}
async function cloudPull(){if(!cloudConfigured()){openCloudModal();return}if(!cloudPullArmed){cloudPullArmed=true;qs('cloudPullBtn').textContent='再次按下確認覆蓋本機';setCloudMessage('下載會用雲端圖面覆蓋目前本機圖面；請再按一次確認。','warn');setTimeout(()=>{cloudPullArmed=false;if(qs('cloudPullBtn'))qs('cloudPullBtn').textContent='↓ 下載雲端專案'},5000);return}cloudPullArmed=false;qs('cloudPullBtn').textContent='↓ 下載雲端專案';cloudBusy=true;setCloudDot('sync');setCloudMessage('正在下載雲端圖面…');try{const out=await cloudApi('getProject');if(!out.project)throw new Error('雲端尚未有專案資料');cloudApplyingRemote=true;loadData(out.project);cloudApplyingRemote=false;resetHistoryFromCurrent();cloudConfig.revision=Number(out.revision||0);cloudConfig.lastSynced=out.updatedAt||new Date().toISOString();try{localStorage.setItem('pigfarmCadV69',JSON.stringify(exportData()))}catch(e){}cloudConfig.pendingCount=0;saveCloudConfig();updateCloudStatusLabel();setCloudMessage(`已載入雲端版本 ${cloudConfig.revision}`,'ok')}catch(e){cloudApplyingRemote=false;setCloudDot('error');setCloudMessage(e.message||String(e),'error')}finally{cloudBusy=false}}
function scheduleCloudPush(){if(cloudApplyingRemote||!cloudConfig.autoSync||!cloudConfigured()||!navigator.onLine)return;clearTimeout(cloudPushTimer);cloudPushTimer=setTimeout(()=>cloudPush({silent:true}),8000)}
function updateOnlineState(){if(!navigator.onLine){status.textContent='目前離線：圖面仍會儲存在本機，恢復網路後再同步。'}else if(cloudConfigured())scheduleCloudPush();updateCloudStatusLabel()}
function updateFieldPhotoTarget(el){const target=qs('fieldPhotoTarget'),input=qs('fieldPhotoInput'),up=qs('fieldPhotoUploadBtn');if(!target)return;pendingFieldPhoto=null;if(qs('fieldPhotoPending'))qs('fieldPhotoPending').textContent='尚未選照片';if(up)up.disabled=true;const valid=!!(el&&el.dataset?.user==='1');if(!valid){target.textContent='先選取圖面上的設備或線路。';if(input)input.disabled=true;qs('fieldPhotoList').innerHTML='<div class="tiny">選取物件後，可直接用手機 / iPad 拍照。</div>';return}if(input)input.disabled=false;const uid=ensureObjectUid(el),name=el.dataset.name||objectTypeText(el);target.textContent=`目前：${name}${el.dataset.building?'｜'+el.dataset.building:''}`;loadCloudPhotos(uid)}
async function compressPhoto(file){const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=dataUrl});let max=1600,q=.80,sw=img.naturalWidth||img.width,sh=img.naturalHeight||img.height,scale=Math.min(1,max/Math.max(sw,sh));let c=document.createElement('canvas');c.width=Math.max(1,Math.round(sw*scale));c.height=Math.max(1,Math.round(sh*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);let out=c.toDataURL('image/jpeg',q);if(out.length>3500000){max=1280;q=.70;scale=Math.min(1,max/Math.max(sw,sh));c.width=Math.max(1,Math.round(sw*scale));c.height=Math.max(1,Math.round(sh*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);out=c.toDataURL('image/jpeg',q)}return{dataUrl:out,fileName:(file.name||'photo').replace(/\.[^.]+$/,'')+'.jpg',mimeType:'image/jpeg',width:c.width,height:c.height,bytes:Math.round(out.length*.75)}}
async function chooseFieldPhoto(file){if(!file)return;qs('fieldPhotoPending').textContent='正在壓縮照片…';qs('fieldPhotoUploadBtn').disabled=true;try{pendingFieldPhoto=await compressPhoto(file);qs('fieldPhotoPending').textContent=`已準備：${pendingFieldPhoto.fileName}｜${pendingFieldPhoto.width}×${pendingFieldPhoto.height}｜約 ${fmtBytes(pendingFieldPhoto.bytes)}`;qs('fieldPhotoUploadBtn').disabled=false}catch(e){pendingFieldPhoto=null;qs('fieldPhotoPending').textContent='照片處理失敗：'+(e.message||e)}}
async function uploadFieldPhoto(){if(cloudBusy)return;if(!selected?.dataset||selected.dataset.user!=='1')return alert('請先選取要附加照片的設備或線路');if(!pendingFieldPhoto)return alert('請先拍照或選照片');if(!cloudConfigured()){openCloudModal();return}const uid=ensureObjectUid(selected),btn=qs('fieldPhotoUploadBtn');cloudBusy=true;btn.disabled=true;btn.textContent='上傳中…';try{const out=await cloudApi('uploadPhoto',{objectUid:uid,objectName:selected.dataset.name||objectTypeText(selected),building:selected.dataset.building||'',note:(qs('fieldPhotoNote').value||'').trim(),fileName:pendingFieldPhoto.fileName,mimeType:pendingFieldPhoto.mimeType,dataUrl:pendingFieldPhoto.dataUrl});pendingFieldPhoto=null;qs('fieldPhotoInput').value='';qs('fieldPhotoNote').value='';qs('fieldPhotoPending').textContent='照片已上傳到 Google Drive';setCloudDot('ok');await loadCloudPhotos(uid);status.textContent='照片已上傳：'+(out.fileName||'現場照片')}catch(e){setCloudDot('error');qs('fieldPhotoPending').textContent='上傳失敗：'+(e.message||e)}finally{cloudBusy=false;btn.disabled=!pendingFieldPhoto;btn.textContent='上傳到 Google Drive'}}
async function loadCloudPhotos(uid){const list=qs('fieldPhotoList');if(!list)return;if(!cloudConfigured()){list.innerHTML='<div class="tiny">尚未設定雲端；點上方「☁ 雲端」完成設定。</div>';return}list.innerHTML='<div class="tiny">讀取雲端照片…</div>';try{const out=await cloudApi('listPhotos',{objectUid:uid});const photos=out.photos||[];const obj=[...document.querySelectorAll('[data-user="1"]')].find(n=>n.dataset.uid===uid);if(obj){obj.dataset.photoCount=String(photos.length);if(obj===selected)updatePhotoAction(obj)}if(!photos.length){list.innerHTML='<div class="tiny">此物件尚無雲端照片。</div>';return}list.innerHTML=photos.map(p=>`<div class="cloud-photo-item"><div><b>${esc(p.fileName||'照片')}</b><small>${esc(p.note||'無備註')}<br>${esc(p.createdAt||'')}｜${esc(p.deviceName||'')}</small></div><a href="${esc(p.driveUrl||'#')}" target="_blank" rel="noopener">開啟</a></div>`).join('')}catch(e){list.innerHTML='<div class="tiny">照片清單讀取失敗：'+esc(e.message||String(e))+'</div>'}}

function loadData(d){if(Array.isArray(d?.customLibrary))setCustomLibrary(d.customLibrary,false);document.querySelectorAll('[data-user="1"]').forEach(n=>n.remove());(d.elements||[]).forEach(o=>{const doc=new DOMParser().parseFromString(o.svg,'image/svg+xml');const el=document.importNode(doc.documentElement,true);el.dataset.user='1';if(el.classList.contains('component')&&!el.dataset.uid)el.dataset.uid='cmp-'+Date.now()+'-'+Math.floor(Math.random()*99999);(qs(o.parent)||qs('annoLayer')).appendChild(el);if(el.classList.contains('component')){if(!el.dataset.iconScale)el.dataset.iconScale='0.8';if(!el.dataset.shapeScaleX)el.dataset.shapeScaleX='1';if(!el.dataset.shapeScaleY)el.dataset.shapeScaleY='1';if(!el.dataset.shapeLock)el.dataset.shapeLock='yes';if(!el.dataset.labelScale)el.dataset.labelScale='0.9';if(!el.dataset.showLabel)el.dataset.showLabel='yes';if(!el.dataset.locked)el.dataset.locked='no';if(!el.dataset.photoCount)el.dataset.photoCount='0';if(!el.dataset.mainFunction)el.dataset.mainFunction=defaultMainFunctions[el.dataset.kind]||el.dataset.name||'';if(el.dataset.kind==='customDevice'){if(!el.dataset.customIcon)el.dataset.customIcon='⚙';if(!el.dataset.customCategory)el.dataset.customCategory='other';applyCustomDeviceAppearance(el);moveCustomDeviceLayer(el);}if(el.dataset.kind==='threeWay'){if(!el.dataset.valveSourceA)el.dataset.valveSourceA=el.dataset.sourceA||'水塔';if(!el.dataset.valveSourceB)el.dataset.valveSourceB=el.dataset.sourceB||'地下水';if(!el.dataset.valveSourceC)el.dataset.valveSourceC='自來水';if(!el.dataset.valveActivePort){const st=el.dataset.switchState||'';el.dataset.valveActivePort=st===el.dataset.valveSourceB?'B':st===el.dataset.valveSourceC?'C':'A';}if(!el.dataset.valveMode)el.dataset.valveMode='手動';}applyComponentVisual(el);}if(el.dataset.kind==='threeWay')updateThreeWayVisual(el);if(el.tagName==='polyline')el.dataset.length=routeLength(routePoints(el)).toFixed(1)});scaleFactor=d.scaleFactor||scaleFactor||null;zoom=d.zoom||1;pan=d.pan||{x:0,y:0};sanitizeObsoleteOverlayArtifacts();tf();updateAllRouteLengths();rebuildPowerRelations();syncValveFromWaterRoutes();refreshList();updateScaleUI();refreshStats();applyViewFilters();}

const HISTORY_LIMIT=30;
function historySnapshot(){try{return JSON.stringify(exportData())}catch(e){return''}}
function updateHistoryButtons(){if(qs('undoBtn'))qs('undoBtn').disabled=!historyUndo.length;if(qs('redoBtn'))qs('redoBtn').disabled=!historyRedo.length}
function initHistory(){historyUndo=[];historyRedo=[];historyCurrent=historySnapshot();historyReady=true;updateHistoryButtons()}
function historyCommit(){
 if(!historyReady||historyApplying)return false;
 const now=historySnapshot();if(!now||now===historyCurrent)return false;
 if(historyCurrent)historyUndo.push(historyCurrent);
 if(historyUndo.length>HISTORY_LIMIT)historyUndo.shift();
 historyCurrent=now;historyRedo=[];updateHistoryButtons();return true;
}
function applyHistoryState(raw,label){
 if(!raw)return;
 historyApplying=true;hideObjectDetail();hideSelectionActionBar();fill(null);
 try{loadData(JSON.parse(raw));historyCurrent=raw;localStorage.setItem('pigfarmCadV69',raw);markCloudPending()}finally{historyApplying=false}
 updateHistoryButtons();scheduleCloudPush();status.textContent=label;
}
function undoHistory(){
 if(!historyUndo.length)return;
 if(routeDraw)finishRoute(true);
 const now=historySnapshot(),prev=historyUndo.pop();if(now)historyRedo.push(now);applyHistoryState(prev,'已復原上一個操作');
}
function redoHistory(){
 if(!historyRedo.length)return;
 if(routeDraw)finishRoute(true);
 const now=historySnapshot(),next=historyRedo.pop();if(now)historyUndo.push(now);applyHistoryState(next,'已重做操作');
}
function resetHistoryFromCurrent(){historyReady=false;initHistory()}

function autosave(){const changed=historyCommit();if(changed)window.dispatchEvent(new CustomEvent('cad:local-changed'));if(changed)saveVersion('定期自動備份');try{localStorage.setItem('pigfarmCadV69',JSON.stringify(exportData()))}catch(e){}if(changed)markCloudPending();scheduleCloudPush();updateCloudUi();}
function autoload(){
 try{
   const fresh=localStorage.getItem('pigfarmCadV69')||localStorage.getItem('pigfarmCadV68')||localStorage.getItem('pigfarmCadV67')||localStorage.getItem('pigfarmCadV66')||localStorage.getItem('pigfarmCadV64')||localStorage.getItem('pigfarmCadV60')||localStorage.getItem('pigfarmCadV53');
   if(fresh){loadData(JSON.parse(fresh));sanitizeObsoleteOverlayArtifacts();return}
   const legacy=localStorage.getItem('pigfarmCadV52')||localStorage.getItem('pigfarmCadV51')||localStorage.getItem('pigfarmCadV50')||localStorage.getItem('pigfarmCadV49')||localStorage.getItem('pigfarmCadV48')||localStorage.getItem('pigfarmCadV47')||localStorage.getItem('pigfarmCadV46')||localStorage.getItem('pigfarmCadV45')||localStorage.getItem('pigfarmCadV44')||localStorage.getItem('pigfarmCadV20')||localStorage.getItem('pigfarmCadV18')||localStorage.getItem('pigfarmCadV17')||localStorage.getItem('pigfarmCadV16');
   if(legacy){
     loadData(JSON.parse(legacy));
     const removed=sanitizeObsoleteOverlayArtifacts();
     autosave();
     if(removed>0)status.textContent='已自動清除舊版虛線殘影 '+removed+' 個；其他既有設備與線路已保留。';
   }
 }catch(e){}
}
function csvCell(v){v=String(v??'');return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
function exportEngineeringCsv(){const rows=[['類別','名稱','所屬棟舍','X','Y','規格','管徑/線徑','功率kW','風量m3/h','靜壓Pa','緊急等級','發電備援','上游/來源','去向','實際長度m','備註']];document.querySelectorAll('.component[data-user="1"]').forEach(c=>{const p=componentXY(c);rows.push([componentCategory(c),c.dataset.name||'',c.dataset.building||'',p.x.toFixed(1),p.y.toFixed(1),c.dataset.spec||'',c.dataset.lineSize||'',c.dataset.powerKw||'',c.dataset.airflow||'',c.dataset.staticPa||'',c.dataset.emergencyClass||'',c.dataset.backup||'',c.dataset.powerParentName||c.dataset.sourceA||'',c.dataset.target||'','',c.dataset.note||''])});document.querySelectorAll('polyline[data-user="1"]').forEach(r=>rows.push([r.dataset.kind==='water'?'水線':r.dataset.kind==='feed'?'料線':'電線',r.dataset.name||'',r.dataset.building||'','','',r.dataset.spec||'',r.dataset.lineSize||'','','','','','',r.dataset.sourceA||'',r.dataset.target||'',r.dataset.realLength||'',r.dataset.note||'']));const csv='\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');dl('pigfarm_engineering_list_v26.csv',csv,'text/csv;charset=utf-8');status.textContent='已匯出工程清單 CSV';}
qs('csvBtn').onclick=exportEngineeringCsv;
qs('svgBtn').onclick=()=>dl('pigfarm_cad_export_v691.svg',new XMLSerializer().serializeToString(svg),'image/svg+xml');qs('pngBtn').onclick=()=>{const s=new XMLSerializer().serializeToString(svg),u=URL.createObjectURL(new Blob([s],{type:'image/svg+xml'})),im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=1600;c.height=1556;const ctx=c.getContext('2d');ctx.fillStyle='#1b2228';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);c.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='pigfarm_cad_export_v691.png';a.click()})};im.src=u};

function emergencyLoads(){
 return powerComponents().filter(c=>{
   if(['utilityPower','generator','ats','mainSwitch','mainPanel','subPanel','equipmentPanel'].includes(c.dataset.kind))return false;
   return (parseFloat(c.dataset.powerKw||0)||0)>0;
 });
}
function generators(){return [...document.querySelectorAll('.component[data-user="1"][data-kind="generator"]')]}
function refreshEmergencySimulator(){
 const sel=qs('simGenerator');if(!sel)return;
 const current=sel.value;const gs=generators();
 sel.innerHTML='<option value="">自動選第一台</option>'+gs.map(g=>`<option value="${g.dataset.uid}">${g.dataset.name||'發電機'}｜${g.dataset.generatorKva||125} kVA</option>`).join('');
 if(gs.some(g=>g.dataset.uid===current))sel.value=current;
 if(!outageSimActive){const r=qs('simResult');if(r)r.textContent=gs.length?'可模擬停電並檢查發電機容量。':'尚未放置發電機。';}
}
function selectedSimGenerator(){const uid=qs('simGenerator')?.value;return findComponent(uid)||generators()[0]||null}
function clearOutageVisual(){
 document.querySelectorAll('.component.power-off,.component.power-on').forEach(x=>x.classList.remove('power-off','power-on'));
 document.querySelectorAll('#elecLayer polyline.power-off,#elecLayer polyline.power-on').forEach(x=>x.classList.remove('power-off','power-on'));
}
function simulateOutage(){
 rebuildPowerRelations();
 const gen=selectedSimGenerator(),r=qs('simResult');if(!gen){r.className='sim-result danger';r.textContent='尚未放置發電機，無法模擬。';return}
 const allowed=new Set();if(qs('simA').checked)allowed.add('A');if(qs('simB').checked)allowed.add('B');if(qs('simC').checked)allowed.add('C');
 const loads=emergencyLoads(),powered=loads.filter(c=>c.dataset.backup==='yes'&&allowed.has(c.dataset.emergencyClass));
 const kw=powered.reduce((s,c)=>s+(parseFloat(c.dataset.powerKw||0)||0),0),cap=generatorCapacityKw(gen),pct=cap?kw/cap*100:0,head=cap-kw;
 outageSimActive=true;clearOutageVisual();
 document.querySelectorAll('.component[data-user="1"]').forEach(c=>{
   const sourceKinds=['generator','ats','mainSwitch','mainPanel','subPanel','equipmentPanel'].includes(c.dataset.kind);
   const on=sourceKinds||powered.includes(c);c.classList.add(on?'power-on':'power-off');
 });
 document.querySelectorAll('#elecLayer polyline[data-user="1"]').forEach(line=>{
   const target=findComponent(line.dataset.endComponent);const on=target&&(target.classList.contains('power-on')||target.dataset.kind==='ats');line.classList.add(on?'power-on':'power-off');
 });
 const cls=pct>100?'danger':pct>85?'warn':'ok';r.className='sim-result '+cls;
 r.innerHTML=`<b>停電模擬中</b><span class="outage-pill">${[...allowed].join('+')||'未選級別'}級</span><br>發電機：${gen.dataset.name||'發電機'}｜容量 ${cap.toFixed(1)} kW<br>模擬備援負載：${kw.toFixed(2)} kW｜負載率 ${pct.toFixed(1)}%｜餘裕 ${head.toFixed(2)} kW<br>供電設備 ${powered.length} 個／總負載設備 ${loads.length} 個`;
 status.textContent=`停電模擬：${kw.toFixed(1)} / ${cap.toFixed(1)} kW（${pct.toFixed(0)}%）`;
}
function normalPower(){
 outageSimActive=false;clearOutageVisual();const r=qs('simResult');r.className='sim-result';r.textContent='已恢復正常供電顯示。';status.textContent='已恢復正常供電顯示';
}

function refreshStats(){let w=0,e=0,p=0,ab=0;document.querySelectorAll('#waterLayer polyline[data-user="1"]').forEach(r=>{const u=routeLength(routePoints(r));const m=metersFromUnits(u);if(m!=null)w+=m});document.querySelectorAll('#elecLayer polyline[data-user="1"]').forEach(r=>{const u=routeLength(routePoints(r));const m=metersFromUnits(u);if(m!=null)e+=m});emergencyLoads().forEach(c=>{const kw=parseFloat(c.dataset.powerKw||0)||0;p+=kw;if(c.dataset.backup==='yes'&&(c.dataset.emergencyClass==='A'||c.dataset.emergencyClass==='B'))ab+=kw});if(qs('waterLenStat'))qs('waterLenStat').textContent=scaleFactor?w.toFixed(1)+' m':'未校正';if(qs('elecLenStat'))qs('elecLenStat').textContent=scaleFactor?e.toFixed(1)+' m':'未校正';if(qs('powerStat'))qs('powerStat').textContent=p.toFixed(2)+' kW';if(qs('backupPowerStat'))qs('backupPowerStat').textContent=ab.toFixed(2)+' kW';refreshEmergencySimulator();}
// V6.9.49：已放置元件全文搜尋與定位（不搜尋尚未放置的設備庫）。
let cadFindTimer=0,cadFindFocusTimer=0;
function cadFindAll(){return [...document.querySelectorAll('[data-user="1"]')].filter(el=>el.classList.contains('component')||['polyline','line','text','rect','circle'].includes(el.tagName.toLowerCase()));}
function cadFindName(el){return el.dataset.name||el.dataset.kind||el.tagName||'未命名元件';}
function cadFindText(el){return [el.dataset.name,el.dataset.mainFunction,el.dataset.building,el.dataset.kind,el.dataset.note,el.dataset.spec,el.dataset.area,el.dataset.sourceA,el.dataset.target,el.dataset.uid].filter(Boolean).join(' ').toLocaleLowerCase();}
function cadFindBounds(el){
 try{
   if(el.classList.contains('component')){
     const center=componentXY(el),box=el.getBBox();
     return {x:center.x,y:center.y,r:Math.max(24,Math.hypot(box.width,box.height)*.65)};
   }
   const b=el.getBBox();
   // SVG getBBox is local; for polyline and static annotations there is no element rotation.
   return {x:b.x+b.width/2,y:b.y+b.height/2,r:Math.max(22,Math.hypot(b.width,b.height)*.55)};
 }catch(e){return null}
}
function cadFindLocate(el){
 const bounds=cadFindBounds(el);if(!bounds)return;
 // Clear only UI filters; do not delete or edit project data.
 viewPreset='all';singleDeviceUid='';deviceTypeFilter=null;
 if(qs('buildingFilter'))qs('buildingFilter').value='all';
 if(qs('deviceSingleFilter'))qs('deviceSingleFilter').value='';
 ['componentChk','ventChk','waterChk','elecChk','feedChk','annoChk'].forEach(id=>{if(qs(id))qs(id).checked=true});
 ['componentLayer','ventLayer','waterLayer','elecLayer','feedLayer','annoLayer'].forEach(id=>{if(qs(id))qs(id).style.display=''});
 applyViewFilters();renderDeviceFilters();
 const vb=svg.viewBox.baseVal;
 zoom=Math.max(zoom,Math.min(3.2,Math.max(1.6,80/Math.max(1,bounds.r))));
 pan={x:vb.x+vb.width/2-zoom*bounds.x,y:vb.y+vb.height/2-zoom*bounds.y};tf();
 // Selecting resets the UI field controls and updates selection handles.
 fill(el);showObjectDetail(el);
 qs('cadFindFocusRing')?.remove();
 const ring=mk('circle',{id:'cadFindFocusRing',cx:bounds.x,cy:bounds.y,r:bounds.r+13,class:'cad-find-focus-ring','pointer-events':'none'});
 vp.appendChild(ring);
 clearTimeout(cadFindFocusTimer);cadFindFocusTimer=setTimeout(()=>ring.remove(),3500);
 status.textContent='已定位並標示：'+cadFindName(el);
}
function cadFindRender(){
 const inp=qs('cadFindInput'),meta=qs('cadFindMeta'),list=qs('cadFindResults');if(!inp||!list)return;
 const q=inp.value.trim().toLocaleLowerCase();list.replaceChildren();
 const drop=qs('cadFindDrop');if(drop){drop.hidden=!q;inp.setAttribute('aria-expanded',q?'true':'false')}
 if(!q){meta.textContent='輸入關鍵字，快速找到已放置的元件';return}
 const matches=cadFindAll().filter(el=>cadFindText(el).includes(q));
 // 與配電箱編輯器共用同一份已儲存資料；上方搜尋不能只查 CAD 最上層物件。
 const nested=[];
 for(const panel of document.querySelectorAll('.component[data-user="1"]')){
  if(!isPanel(panel))continue;
  const marks=safeJson(panel.dataset.panelPhotoMarks,[]);
  if(Array.isArray(marks))for(const mark of marks){
   const terms=[mark.circuitId,mark.breaker,mark.functionName,mark.purpose,mark.loadName,mark.sourceFrom,mark.targetTo,mark.detail,mark.note];
   if(terms.filter(Boolean).join(' ').toLocaleLowerCase().includes(q)){
    nested.push({panel,markUid:mark.uid,name:photoMarkCode(mark),detail:'📷 '+(panel.dataset.name||'配電箱')+'｜'+(mark.functionName||'照片標記')});
   }
  }
  const circuits=safeJson(panel.dataset.panelCircuits,[]);
  if(Array.isArray(circuits))for(const circuit of circuits){
   const terms=[circuit.id,circuit.loadName,circuit.groupArea,circuit.controlMode,circuit.note];
   if(terms.filter(Boolean).join(' ').toLocaleLowerCase().includes(q)){
    nested.push({panel,circuitId:String(circuit.id||''),name:String(circuit.id||'未編號迴路'),detail:'⚡ '+(panel.dataset.name||'配電箱')+'｜'+(circuit.loadName||'迴路')});
   }
  }
 }
 const total=matches.length+nested.length;
 meta.textContent=total?`找到 ${total} 個結果${total>80?'（僅顯示前 80 個）':''}`:'找不到符合的元件。請確認配電箱標記已儲存，或改用設備名稱搜尋。';

 matches.slice(0,80).forEach(el=>{
  const row=document.createElement('button');row.type='button';row.className='cad-find-result';row.setAttribute('role','option');
  const name=document.createElement('strong');name.textContent=cadFindName(el);
  const desc=document.createElement('small');desc.textContent=[el.dataset.building,el.dataset.mainFunction||el.dataset.kind||el.tagName].filter(Boolean).join(' · ');
  row.append(name,desc);row.onclick=()=>{cadFindLocate(el);const drop=qs('cadFindDrop');if(drop)drop.hidden=true;inp.setAttribute('aria-expanded','false')};list.appendChild(row);
 });
 nested.slice(0,Math.max(0,80-matches.length)).forEach(result=>{
  const row=document.createElement('button');row.type='button';row.className='cad-find-result';row.setAttribute('role','option');
  const name=document.createElement('strong');name.textContent=result.name;
  const desc=document.createElement('small');desc.textContent=result.detail;
  row.append(name,desc);
  row.onclick=()=>{const drop=qs('cadFindDrop');if(drop)drop.hidden=true;inp.setAttribute('aria-expanded','false');openSearchMatch(result)};
  list.appendChild(row);
 });
}
qs('cadFindResults')?.addEventListener('click',e=>{
 if(e.target.closest('button')){const d=qs('cadFindDrop');if(d)d.hidden=true;qs('cadFindInput')?.setAttribute('aria-expanded','false')}
});
qs('cadFindDismiss')?.addEventListener('click',()=>{
 const d=qs('cadFindDrop');if(d)d.hidden=true;qs('cadFindInput')?.setAttribute('aria-expanded','false');
});
document.addEventListener('pointerdown',e=>{
 if(!e.target.closest('#topCadSearch')){const d=qs('cadFindDrop');if(d)d.hidden=true;qs('cadFindInput')?.setAttribute('aria-expanded','false')}
});
qs('cadFindInput')?.addEventListener('focus',e=>{if(e.target.value.trim())cadFindRender()});
qs('cadFindInput')?.addEventListener('input',()=>{clearTimeout(cadFindTimer);cadFindTimer=setTimeout(cadFindRender,100)});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();qs('cadFindInput')?.focus();qs('cadFindInput')?.select()}});
qs('cadFindInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();qs('cadFindResults')?.querySelector('button')?.click()}if(e.key==='Escape'){e.currentTarget.value='';cadFindRender();e.currentTarget.blur()}});
function refreshList(){if(qs('cadFindInput')?.value.trim())cadFindRender();const items=[...document.querySelectorAll('[data-user="1"]')];const list=qs('objList');if(!items.length){list.innerHTML='<div class="objrow">尚未新增設備</div>';refreshStats();renderPowerTree();renderDeviceFilters();return}list.innerHTML='';items.forEach((el,i)=>{const row=document.createElement('div');row.className='objrow';const kind=el.dataset.kind||el.tagName;row.innerHTML=`${objectLocked(el)?'🔒 ':''}${el.dataset.name||('物件 '+(i+1))}<span class="badge">${kind}</span>`;row.onclick=()=>{fill(el);showObjectDetail(el)};list.appendChild(row)});refreshStats();renderPowerTree();renderDeviceFilters()}



qs('objectDetailClose').onclick=hideObjectDetail;
qs('deleteConfirmCancel').onclick=closeDeleteConfirm;
qs('deleteConfirmOk').onclick=()=>{if(deletePendingObject){backupSnapshot();saveVersion('刪除前備份',true);deleteObjectNow(deletePendingObject)}};
qs('deleteConfirmModal').addEventListener('mousedown',e=>{if(e.target===qs('deleteConfirmModal'))closeDeleteConfirm()});


document.querySelectorAll('[data-quick-component]').forEach(btn=>{
 btn.addEventListener('click',()=>setPendingComponent(btn.dataset.quickComponent));
});
qs('quickDeviceMenuBtn').onclick=e=>{e.preventDefault();e.stopPropagation();if(pendingComponent){setPendingComponent('');return}const open=!document.body.classList.contains('device-menu-open');document.body.classList.toggle('device-menu-open',open);qs('quickDeviceBar').setAttribute('aria-hidden',open?'false':'true');qs('quickDeviceMenuBtn').classList.toggle('active',open)};
qs('cancelPlaceBtn').onclick=()=>setPendingComponent('');
qs('undoBtn').onclick=undoHistory;qs('redoBtn').onclick=redoHistory;
qs('selectionLockBtn').onclick=e=>{e.preventDefault();e.stopPropagation();toggleSelectedLock()};
qs('selectionPhotoBtn').onclick=e=>{e.preventDefault();e.stopPropagation();openSelectedPhoto()};
qs('selectionDetailBtn').onclick=e=>{e.preventDefault();e.stopPropagation();if(selected)openObjectEditor(selected)};
qs('selectionDeleteBtn').onclick=e=>{e.preventDefault();e.stopPropagation();if(selected)requestDeleteObject(selected)};

qs('deviceMoreBtn').onclick=()=>{
 document.body.classList.toggle('device-more-open');
 qs('deviceMoreBtn').textContent=document.body.classList.contains('device-more-open')?'收合設定 ▴':'更多設定 ▾';
 qs('deviceMoreBtn').setAttribute('aria-expanded',String(document.body.classList.contains('device-more-open')));
 if(selected)updateSimplePropertyVisibility(selected);
};
document.querySelectorAll('.right .secondary-info').forEach(sec=>{
 const h=(sec.querySelector('h3')?.textContent||'').trim();
 if(h.startsWith('已放置元件')||h.startsWith('工程統計')||h.startsWith('停電 / 發電機'))sec.classList.add('simple-info-keep');
});



qs('quickCustomDeviceBtn').onclick=e=>{e.preventDefault();e.stopPropagation();openCustomDeviceModal()};
qs('customDeviceLibraryBtn').onclick=()=>openCustomDeviceModal();
qs('editCustomDeviceBtn').onclick=()=>{if(selected?.dataset?.kind==='customDevice')openCustomDeviceModal(selected)};
qs('customDeviceCloseBtn').onclick=closeCustomDeviceModal;
qs('customDeviceCancelBtn').onclick=closeCustomDeviceModal;
qs('customDeviceApplyBtn').onclick=commitCustomDevice;
qs('customDeviceModal').addEventListener('mousedown',e=>{if(e.target===qs('customDeviceModal'))closeCustomDeviceModal()});
qs('customDeviceName').addEventListener('input',updateCustomPreview);
qs('customDeviceCategory').addEventListener('change',updateCustomPreview);
document.querySelectorAll('[data-custom-icon]').forEach(b=>b.onclick=()=>setCustomIcon(b.dataset.customIcon));
renderCustomLibrary();

qs('cloudBtn').onclick=openCloudModal;qs('cloudCloseBtn').onclick=closeCloudModal;qs('cloudModal').addEventListener('mousedown',e=>{if(e.target===qs('cloudModal'))closeCloudModal()});
qs('cloudSaveConfigBtn').onclick=()=>{readCloudForm();setCloudMessage('連線設定已儲存在這台裝置。','ok');if(cloudConfigured())setCloudDot('ok')};qs('cloudTestBtn').onclick=testCloud;qs('cloudPushBtn').onclick=()=>{readCloudForm();cloudPush({silent:false})};qs('cloudPullBtn').onclick=()=>{readCloudForm();cloudPull()};qs('cloudOpenSheetBtn').onclick=()=>{if(cloudSheetUrl)window.open(cloudSheetUrl,'_blank','noopener')};qs('cloudOpenFolderBtn').onclick=()=>{if(cloudFolderUrl)window.open(cloudFolderUrl,'_blank','noopener')};
qs('fieldPhotoInput').addEventListener('change',e=>chooseFieldPhoto(e.target.files?.[0]));qs('fieldPhotoUploadBtn').onclick=uploadFieldPhoto;qs('fieldPhotoRefreshBtn').onclick=()=>{if(selected?.dataset?.user==='1')loadCloudPhotos(ensureObjectUid(selected));else alert('請先選取設備或線路')};window.addEventListener('online',updateOnlineState);window.addEventListener('offline',updateOnlineState);updateCloudUi();updateOnlineState();

qs('scaleFactor').onchange=()=>{const v=parseFloat(qs('scaleFactor').value);scaleFactor=v>0?v:null;updateAllRouteLengths();updateScaleUI();autosave();};
qs('clearScaleBtn').onclick=()=>{scaleFactor=null;updateAllRouteLengths();updateScaleUI();autosave();status.textContent='已清除比例尺';};
qs('defaultScaleBtn').onclick=()=>{scaleFactor=60.7/1098;updateAllRouteLengths();updateScaleUI();autosave();status.textContent='已套用預設參考比例（60.7m / 1098圖面單位）；建議仍以兩點校正覆核。';};

// ===== V2.1 配電箱內部迴路 / 單線圖 / 產房保溫燈分組 =====
const PANEL_KINDS=new Set(['mainSwitch','mainPanel','subPanel','equipmentPanel']);
let panelEditTarget=null,panelEditOriginal=null,panelDraft={meta:{},circuits:[],photoData:'',photoMarks:[]};let photoToolMode='browse',photoDrawStart=null,photoTempBox=null,photoSelectedMarkId=null,photoDrag=null;
function isPanel(el){return !!(el&&el.classList?.contains('component')&&PANEL_KINDS.has(el.dataset.kind))}
function setPanelEditorTab(tab){
 const card=qs('panelEditorModal')?.querySelector('.modal-card');if(!card)return;
 const prev=card.dataset.panelTab||'meta';
 if(prev==='photo'&&tab!=='photo'&&photoSelectedMarkId)commitSelectedPhotoMark(true);
 card.dataset.panelTab=tab;
 [['panelTabMeta','meta'],['panelTabPhoto','photo'],['panelTabCircuits','circuits'],['panelTabPreview','preview']].forEach(([id,t])=>qs(id)?.classList.toggle('active',t===tab));
 if(tab==='photo'){requestAnimationFrame(()=>renderPanelPhoto())}
 if(tab==='circuits')renderCircuitRows();
 if(tab==='preview')renderPanelPreview();
}
function updatePanelTabBadges(){
 const cc=(panelDraft.circuits||[]).length,pc=(panelDraft.photoMarks||[]).length;
 if(qs('panelCircuitCountBadge'))qs('panelCircuitCountBadge').textContent=String(cc);
 if(qs('panelPhotoCountBadge'))qs('panelPhotoCountBadge').textContent=String(pc);
}

function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function safeJson(s,fallback){try{return JSON.parse(s||'')}catch(e){return fallback}}
function panelLoadOptions(selectedUid=''){
 const comps=[...document.querySelectorAll('.component[data-user="1"]')].filter(c=>!PANEL_KINDS.has(c.dataset.kind)||c.dataset.uid!==panelEditTarget?.dataset.uid);
 let h='<option value="">— 手動輸入 / 尚未指定 —</option>';
 comps.forEach(c=>{const uid=c.dataset.uid||'',name=c.dataset.name||labels[c.dataset.kind]||'設備';h+=`<option value="${esc(uid)}" ${uid===selectedUid?'selected':''}>${esc(name)}</option>`});return h;
}
function defaultPanelMeta(panel){return {voltage:'380V',phase:'3相4線',busbar:'',mainType:'MCCB',mainAmp:'',mainPoles:'4P',upstream:panel?.dataset.powerParentName||panel?.dataset.sourceA||''}}
function openPanelEditor(panel=selected){
 if(!isPanel(panel)){alert('請先選取「總開關箱、總配電箱、分電箱或設備電箱」。');return}
 panelEditTarget=panel;panelEditOriginal={meta:panel.dataset.panelMeta||'',circuits:panel.dataset.panelCircuits||''};
 const meta=Object.assign(defaultPanelMeta(panel),safeJson(panel.dataset.panelMeta,{}));
 const circuits=safeJson(panel.dataset.panelCircuits,[]);panelDraft={meta:{...meta},circuits:Array.isArray(circuits)?circuits.map(x=>Object.assign({groupArea:'',unitW:'',lampQty:'',controlMode:'手動開關',stage:'',startTemp:'',stopTemp:'',delaySec:'',interlock:'',tempSet:'',tempDiff:'',contactor:''},{...x})):[],photoData:panel.dataset.panelPhoto||'',photoMarks:safeJson(panel.dataset.panelPhotoMarks,[])};
 qs('panelEditorTitle').textContent=`配電箱內部迴路配置｜${panel.dataset.name||labels[panel.dataset.kind]}`;
 qs('pmPanelName').value=panel.dataset.name||'';qs('pmVoltage').value=meta.voltage||'380V';qs('pmPhase').value=meta.phase||'3相4線';qs('pmBusbar').value=meta.busbar||'';qs('pmMainType').value=meta.mainType||'MCCB';qs('pmMainAmp').value=meta.mainAmp||'';qs('pmMainPoles').value=meta.mainPoles||'4P';qs('pmUpstream').value=panel.dataset.powerParentName||meta.upstream||'';
 renderCircuitRows();clearPhotoMarkEditor(false);updatePanelTabBadges();setPhotoTool('browse');qs('panelEditorModal').classList.add('show');qs('panelEditorModal').setAttribute('aria-hidden','false');setPanelEditorTab('meta');
}
function closePanelEditor(save=false){
 if(save){savePanelEditor(true);return}
 qs('panelEditorModal').classList.remove('show');qs('panelEditorModal').setAttribute('aria-hidden','true');panelEditTarget=null;panelEditOriginal=null;photoSelectedMarkId=null;photoDrag=null;
}
function syncPanelMeta(){panelDraft.meta={voltage:qs('pmVoltage').value,phase:qs('pmPhase').value,busbar:qs('pmBusbar').value,mainType:qs('pmMainType').value,mainAmp:qs('pmMainAmp').value,mainPoles:qs('pmMainPoles').value,upstream:qs('pmUpstream').value}}
function syncPanelDraftFromForm(){syncPanelMeta();const rows=[...qs('panelCircuitBody').querySelectorAll('tr[data-ci]')];panelDraft.circuits=rows.map((tr,i)=>({id:tr.querySelector('[data-f="id"]').value||`QF${i+1}`,groupArea:tr.querySelector('[data-f="groupArea"]').value,breakerType:tr.querySelector('[data-f="breakerType"]').value,poles:tr.querySelector('[data-f="poles"]').value,amp:tr.querySelector('[data-f="amp"]').value,phase:tr.querySelector('[data-f="phase"]').value,cable:tr.querySelector('[data-f="cable"]').value,loadUid:tr.querySelector('[data-f="loadUid"]').value,loadName:tr.querySelector('[data-f="loadName"]').value,unitW:tr.querySelector('[data-f="unitW"]').value,lampQty:tr.querySelector('[data-f="lampQty"]').value,kw:tr.querySelector('[data-f="kw"]').value,controlMode:tr.querySelector('[data-f="controlMode"]').value,stage:tr.querySelector('[data-f="stage"]').value,startTemp:tr.querySelector('[data-f="startTemp"]').value,stopTemp:tr.querySelector('[data-f="stopTemp"]').value,delaySec:tr.querySelector('[data-f="delaySec"]').value,interlock:tr.querySelector('[data-f="interlock"]').value,tempSet:tr.querySelector('[data-f="tempSet"]').value,tempDiff:tr.querySelector('[data-f="tempDiff"]').value,contactor:tr.querySelector('[data-f="contactor"]').value,emergency:tr.querySelector('[data-f="emergency"]').value,backup:tr.querySelector('[data-f="backup"]').value,note:tr.querySelector('[data-f="note"]').value}))}
function newCircuit(seed={}){return Object.assign({id:`QF${panelDraft.circuits.length+1}`,groupArea:'',breakerType:'MCB',poles:'3P',amp:'',phase:'RST',cable:'',loadUid:'',loadName:'',unitW:'',lampQty:'',kw:'',controlMode:'手動開關',stage:'',startTemp:'',stopTemp:'',delaySec:'',interlock:'',tempSet:'',tempDiff:'',contactor:'',emergency:'',backup:'no',note:''},seed)}
function renderCircuitRows(){updatePanelTabBadges();
 const body=qs('panelCircuitBody');body.innerHTML='';
 panelDraft.circuits.forEach((c,i)=>{const tr=document.createElement('tr');tr.dataset.ci=i;tr.innerHTML=`
 <td><input class="w-id" data-f="id" value="${esc(c.id)}"></td>
 <td class="w-group"><input data-f="groupArea" value="${esc(c.groupArea||'')}" placeholder="例 產房A-第1組"></td>
 <td><select data-f="breakerType"><option ${c.breakerType==='MCB'?'selected':''}>MCB</option><option ${c.breakerType==='MCCB'?'selected':''}>MCCB</option><option ${c.breakerType==='NFB'?'selected':''}>NFB</option><option ${c.breakerType==='ELCB'?'selected':''}>ELCB</option><option ${c.breakerType==='RCBO'?'selected':''}>RCBO</option><option ${c.breakerType==='Contactor'?'selected':''}>Contactor</option><option ${c.breakerType==='Other'?'selected':''}>Other</option></select></td>
 <td><select data-f="poles"><option ${c.poles==='1P'?'selected':''}>1P</option><option ${c.poles==='2P'?'selected':''}>2P</option><option ${c.poles==='3P'?'selected':''}>3P</option><option ${c.poles==='4P'?'selected':''}>4P</option></select></td>
 <td><input type="number" step="1" data-f="amp" value="${esc(c.amp)}"></td>
 <td><select data-f="phase"><option ${c.phase==='R-N'?'selected':''}>R-N</option><option ${c.phase==='S-N'?'selected':''}>S-N</option><option ${c.phase==='T-N'?'selected':''}>T-N</option><option ${c.phase==='R'?'selected':''}>R</option><option ${c.phase==='S'?'selected':''}>S</option><option ${c.phase==='T'?'selected':''}>T</option><option ${c.phase==='RS'?'selected':''}>RS</option><option ${c.phase==='ST'?'selected':''}>ST</option><option ${c.phase==='TR'?'selected':''}>TR</option><option ${c.phase==='RST'?'selected':''}>RST</option><option ${c.phase==='待確認'?'selected':''}>待確認</option></select></td>
 <td><input data-f="cable" value="${esc(c.cable)}" placeholder="例 5.5mm²"></td>
 <td class="w-load"><select data-f="loadUid">${panelLoadOptions(c.loadUid)}</select><input style="margin-top:3px" data-f="loadName" value="${esc(c.loadName)}" placeholder="負載名稱"></td>
 <td><input type="number" min="0" step="1" data-f="unitW" value="${esc(c.unitW||'')}" placeholder="W"></td>
 <td><input type="number" min="0" step="1" data-f="lampQty" value="${esc(c.lampQty||'')}" placeholder="盞"></td>
 <td><input type="number" step="0.01" data-f="kw" value="${esc(c.kw)}"></td>
 <td class="w-control"><select data-f="controlMode"><option ${c.controlMode==='手動開關'?'selected':''}>手動開關</option><option ${c.controlMode==='溫控器'?'selected':''}>溫控器</option><option ${c.controlMode==='定時器'?'selected':''}>定時器</option><option ${c.controlMode==='接觸器'?'selected':''}>接觸器</option><option ${c.controlMode==='溫控+接觸器'?'selected':''}>溫控+接觸器</option><option ${c.controlMode==='手/自動切換'?'selected':''}>手/自動切換</option><option ${c.controlMode==='環控器+接觸器'?'selected':''}>環控器+接觸器</option><option ${c.controlMode==='PLC/環控器'?'selected':''}>PLC/環控器</option><option ${c.controlMode==='手/自動+環控'?'selected':''}>手/自動+環控</option><option ${c.controlMode==='變頻/VFD'?'selected':''}>變頻/VFD</option><option ${c.controlMode==='其他'?'selected':''}>其他</option></select></td>
 <td class="w-stage"><input type="number" min="0" step="1" data-f="stage" value="${esc(c.stage||'')}" placeholder="1"></td>
 <td class="w-temp"><input type="number" step="0.1" data-f="startTemp" value="${esc(c.startTemp||'')}" placeholder="啟動"></td>
 <td class="w-temp"><input type="number" step="0.1" data-f="stopTemp" value="${esc(c.stopTemp||'')}" placeholder="停止"></td>
 <td class="w-delay"><input type="number" min="0" step="1" data-f="delaySec" value="${esc(c.delaySec||'')}" placeholder="秒"></td>
 <td class="w-interlock"><input data-f="interlock" value="${esc(c.interlock||'')}" placeholder="例：主排風扇運轉"></td>
 <td class="w-temp"><input type="number" step="0.1" data-f="tempSet" value="${esc(c.tempSet||'')}" placeholder="例 30.0"></td>
 <td class="w-temp"><input type="number" step="0.1" data-f="tempDiff" value="${esc(c.tempDiff||'')}" placeholder="例 1.0"></td>
 <td class="w-contact"><input data-f="contactor" value="${esc(c.contactor||'')}" placeholder="例 AC-3 25A / 溫控器"></td>
 <td><select data-f="emergency"><option value="" ${!c.emergency?'selected':''}>—</option><option value="A" ${c.emergency==='A'?'selected':''}>A</option><option value="B" ${c.emergency==='B'?'selected':''}>B</option><option value="C" ${c.emergency==='C'?'selected':''}>C</option><option value="none" ${c.emergency==='none'?'selected':''}>非備援</option></select></td>
 <td><select data-f="backup"><option value="yes" ${c.backup==='yes'?'selected':''}>是</option><option value="no" ${c.backup!=='yes'?'selected':''}>否</option></select></td>
 <td class="w-note"><input data-f="note" value="${esc(c.note)}"></td>
 <td><button class="del-circuit" data-delci="${i}">×</button></td>`;body.appendChild(tr)});
 body.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',()=>{syncPanelDraftFromForm();renderPanelPreview()}));
 body.querySelectorAll('select[data-f="loadUid"]').forEach(sel=>sel.addEventListener('change',()=>{const tr=sel.closest('tr'),cmp=findComponent(sel.value);if(cmp){tr.querySelector('[data-f="loadName"]').value=cmp.dataset.name||labels[cmp.dataset.kind]||'';tr.querySelector('[data-f="kw"]').value=cmp.dataset.powerKw||'';tr.querySelector('[data-f="emergency"]').value=cmp.dataset.emergencyClass||'';tr.querySelector('[data-f="backup"]').value=cmp.dataset.backup||'no'}syncPanelDraftFromForm();renderPanelPreview()}));
 body.querySelectorAll('[data-delci]').forEach(b=>b.onclick=()=>{syncPanelDraftFromForm();panelDraft.circuits.splice(+b.dataset.delci,1);renderCircuitRows()});
 renderPanelPreview();
}

function panelCircuitById(id){return (panelDraft.circuits||[]).find(c=>String(c.id||'').trim()===String(id||'').trim())||null}

const photoIconMap={breaker:'QF',exhaustFan:'🌬',guideFan:'↔',coolingPump:'P',heatLamp:'☀',lighting:'💡',socket:'🔌',motor:'M',ats:'ATS',generator:'G',other:'●'};
function persistPanelPhotoDraft(){
 if(!panelEditTarget)return;
 panelEditTarget.dataset.panelPhoto=panelDraft.photoData||'';
 panelEditTarget.dataset.panelPhotoMarks=JSON.stringify(panelDraft.photoMarks||[]);
 panelEditTarget.dataset.panelPhotoCount=String((panelDraft.photoMarks||[]).length);
 try{autosave()}catch(e){}
}
function setPhotoTool(mode){
 photoToolMode=mode;
 [['photoToolAddBtn','point'],['photoToolBoxBtn','box'],['photoToolMoveBtn','move']].forEach(([id,m])=>qs(id)?.classList.toggle('active',m===mode));
 const msg=mode==='point'?'新增標記模式：直接點照片上的開關位置。':mode==='box'?'框選模式：在照片上拖曳框住一顆斷路器。':mode==='move'?'移動 / 調整模式：拖標記可移動；拖右下角控制點可調大小。':'目前：瀏覽模式。點照片上的標記可查看細項。';
 if(qs('photoToolStatus'))qs('photoToolStatus').textContent=msg;
}
function photoMarkById(id){return (panelDraft.photoMarks||[]).find(m=>m.uid===id)||null}
function newPhotoMarkAt(x,y,w=6,h=5){
 const n=(panelDraft.photoMarks||[]).length+1;
 const m={uid:'pm-'+Date.now()+'-'+Math.floor(Math.random()*9999),x:+Math.max(0,Math.min(100-w,x-w/2)).toFixed(2),y:+Math.max(0,Math.min(100-h,y-h/2)).toFixed(2),w:+w.toFixed(2),h:+h.toFixed(2),circuitId:`QF${n}`,functionName:'',purpose:'',loadName:'',ratedKw:'',measuredA:'',measuredKw:'',kwh:'',breaker:'',emergency:'',backup:'',note:'',sourceFrom:'',targetTo:'',detail:'',iconType:'breaker',showPower:'yes'};
 panelDraft.photoMarks.push(m);photoSelectedMarkId=m.uid;persistPanelPhotoDraft();updatePanelTabBadges();loadPhotoMarkEditor(m);return m;
}
function photoSummaryHtml(mark){
 const ep=mark.backup==='yes'?'發電備援':mark.backup==='no'?'非發電備援':'—';
 const use=[mark.measuredKw?`${mark.measuredKw} kW`:(mark.ratedKw?`${mark.ratedKw} kW`:''),mark.measuredA?`${mark.measuredA} A`:'' ].filter(Boolean).join(' / ')||'—';
 return `<div class="photo-detail-card"><div class="photo-detail-title">${esc(mark.breaker||mark.circuitId||'開關標記')}｜${esc(mark.functionName||'未填控制位置')}</div><div class="photo-detail-grid">
 <div><b>控制哪裡</b><span>${esc(mark.functionName||'—')}</span></div><div><b>功能 / 作用</b><span>${esc(mark.purpose||'—')}</span></div>
 <div><b>從哪邊接過來</b><span>${esc(mark.sourceFrom||'—')}</span></div><div><b>可以接到哪裡去</b><span>${esc(mark.targetTo||'—')}</span></div>
 <div><b>供電設備 / 區域</b><span>${esc(mark.loadName||'—')}</span></div><div><b>用電</b><span>${esc(use)}</span></div>
 <div><b>緊急級別 / 備援</b><span>${esc(mark.emergency||'—')} / ${esc(ep)}</span></div><div><b>開關規格</b><span>${esc(mark.breaker||'—')}</span></div>
 <div style="grid-column:1/-1"><b>其他細項</b><span>${esc(mark.detail||mark.note||'—')}</span></div></div></div>`;
}


function photoMainRole(mark){return String(mark?.functionName||mark?.purpose||mark?.loadName||'未設定主要作用').trim()}
function photoMarkCode(mark){return String(mark?.circuitId||mark?.breaker||'未編號').trim()}
function photoUseText(mark){
 const a=[];if(mark?.measuredKw)a.push(mark.measuredKw+' kW');else if(mark?.ratedKw)a.push(mark.ratedKw+' kW');
 if(mark?.measuredA)a.push(mark.measuredA+' A');if(mark?.kwh)a.push(mark.kwh+' kWh/月');return a.join(' / ')||'—';
}
function photoPopupHtml(mark){
 const backup=mark.backup==='yes'?'發電備援':mark.backup==='no'?'非備援':'—';
 const rows=[];
 const add=(k,v)=>{const s=String(v??'').trim();if(s)rows.push(`<b>${esc(k)}</b><span>${esc(s)}</span>`)};
 add('控制',mark.functionName||mark.purpose);
 add('來源',mark.sourceFrom);
 add('去向',mark.targetTo||mark.loadName);
 add('用電',photoUseText(mark));
 if(mark.emergency||mark.backup)add('備援',[mark.emergency,backup].filter(Boolean).join(' / '));
 return `<div class="pip-head"><div class="pip-icon">${esc((mark.iconType||'breaker')==='breaker'?photoMarkCode(mark):(photoIconMap[mark.iconType]||'●'))}</div><div class="pip-title"><strong>${esc(photoMainRole(mark))}</strong><span>${esc(photoMarkCode(mark))}<span class="photo-save-state">自動儲存</span></span></div><button type="button" class="pip-close" title="關閉">×</button></div>
 <div class="photo-inline-grid">${rows.slice(0,5).join('')||'<b>重點</b><span>尚未填寫</span>'}</div>`;
}
function writePhotoFormToMark(mark){
 if(!mark)return false;
 mark.circuitId=qs('photoMarkId').value.trim();mark.functionName=qs('photoMarkFunction').value.trim();mark.purpose=qs('photoMarkPurpose').value.trim();mark.loadName=qs('photoMarkLoad').value.trim();
 mark.ratedKw=qs('photoMarkRatedKw').value;mark.measuredA=qs('photoMarkMeasuredA').value;mark.measuredKw=qs('photoMarkMeasuredKw').value;mark.kwh=qs('photoMarkKwh').value;
 mark.breaker=qs('photoMarkBreaker').value.trim();mark.emergency=qs('photoMarkEmergency').value;mark.backup=qs('photoMarkBackup').value;mark.note=qs('photoMarkNote').value.trim();
 mark.sourceFrom=qs('photoMarkFrom').value.trim();mark.targetTo=qs('photoMarkTo').value.trim();mark.detail=qs('photoMarkDetail').value.trim();
 mark.iconType=qs('photoMarkIconType').value||'breaker';mark.showPower=qs('photoMarkShowPower').value||'yes';return true;
}
function commitSelectedPhotoMark(silent=true){
 const mark=photoMarkById(photoSelectedMarkId);if(!mark)return false;
 writePhotoFormToMark(mark);persistPanelPhotoDraft();renderPanelPhoto();if(qs('cadFindInput')?.value.trim())cadFindRender();
 if(!silent){qs('photoMarkSummary').innerHTML=photoSummaryHtml(mark);status.textContent='已儲存照片標註：'+photoMainRole(mark)}
 return true;
}
function savePanelEditor(closeAfter=false){
 if(!panelEditTarget)return;
 commitSelectedPhotoMark(true);syncPanelDraftFromForm();
 panelEditTarget.dataset.name=qs('pmPanelName').value||panelEditTarget.dataset.name;
 panelEditTarget.dataset.panelMeta=JSON.stringify(panelDraft.meta);panelEditTarget.dataset.panelCircuits=JSON.stringify(panelDraft.circuits);
 panelEditTarget.dataset.panelPhoto=panelDraft.photoData||'';panelEditTarget.dataset.panelPhotoMarks=JSON.stringify(panelDraft.photoMarks||[]);
 panelEditTarget.dataset.panelCircuitCount=String(panelDraft.circuits.length);
 panelEditTarget.dataset.panelLoadKw=panelDraft.circuits.reduce((a,c)=>a+(parseFloat(c.kw)||0),0).toFixed(2);
 const lab=panelEditTarget.querySelector('.component-label');if(lab)lab.textContent=panelEditTarget.dataset.name;
 autosave();refreshList();if(qs('cadFindInput')?.value.trim())cadFindRender();status.textContent='已儲存配電箱配置：'+panelEditTarget.dataset.name;
 qs('panelFootSummary').textContent='已儲存｜'+panelEditTarget.dataset.name+'｜'+panelDraft.circuits.length+' 分路｜照片標註 '+(panelDraft.photoMarks||[]).length+' 筆';
 if(closeAfter)closePanelEditor(false);
}

function clearPhotoMarkEditor(rerender=true){
 photoSelectedMarkId=null;
 ['photoMarkId','photoMarkFunction','photoMarkPurpose','photoMarkLoad','photoMarkRatedKw','photoMarkMeasuredA','photoMarkMeasuredKw','photoMarkKwh','photoMarkBreaker','photoMarkNote','photoMarkFrom','photoMarkTo','photoMarkDetail'].forEach(id=>{const el=qs(id);if(el)el.value=''});
 qs('photoMarkEmergency').value='';qs('photoMarkBackup').value='';qs('photoMarkIconType').value='breaker';qs('photoMarkShowPower').value='yes';
 qs('photoMarkSummary').className='photo-mark-summary';qs('photoMarkSummary').textContent='尚未選取照片上的開關標註。';
 if(rerender)renderPanelPhoto();
}
function loadPhotoMarkEditor(mark){
 if(!mark)return clearPhotoMarkEditor();
 photoSelectedMarkId=mark.uid;
 qs('photoMarkId').value=mark.circuitId||'';qs('photoMarkFunction').value=mark.functionName||'';qs('photoMarkPurpose').value=mark.purpose||'';qs('photoMarkLoad').value=mark.loadName||'';
 qs('photoMarkRatedKw').value=mark.ratedKw||'';qs('photoMarkMeasuredA').value=mark.measuredA||'';qs('photoMarkMeasuredKw').value=mark.measuredKw||'';qs('photoMarkKwh').value=mark.kwh||'';
 qs('photoMarkBreaker').value=mark.breaker||'';qs('photoMarkEmergency').value=mark.emergency||'';qs('photoMarkBackup').value=mark.backup||'';qs('photoMarkNote').value=mark.note||'';
 qs('photoMarkFrom').value=mark.sourceFrom||'';qs('photoMarkTo').value=mark.targetTo||'';qs('photoMarkDetail').value=mark.detail||'';
 qs('photoMarkIconType').value=mark.iconType||'breaker';qs('photoMarkShowPower').value=mark.showPower||'yes';
 qs('photoMarkSummary').innerHTML=photoSummaryHtml(mark);
 renderPanelPhoto();
}
function savePhotoMarkFields(){
 const mark=photoMarkById(photoSelectedMarkId);
 if(!mark)return alert('請先在照片上新增或點選一個開關標註');
 writePhotoFormToMark(mark);persistPanelPhotoDraft();renderPanelPhoto();
 qs('photoMarkSummary').innerHTML=photoSummaryHtml(mark);
 status.textContent='已儲存照片標註：'+photoMainRole(mark);
}
function renderPanelPhoto(){updatePanelTabBadges();
 const img=qs('panelPhotoImg'),ph=qs('panelPhotoPlaceholder'),ov=qs('panelPhotoOverlay');
 const has=!!panelDraft.photoData;
 img.style.display=has?'block':'none';ph.style.display=has?'none':'block';
 if(!has){img.removeAttribute('src');ov.innerHTML='';qs('panelPhotoFit').style.display='none';return}
 qs('panelPhotoFit').style.display='inline-block';
 if(img.src!==panelDraft.photoData)img.src=panelDraft.photoData;
 qs('panelCircuitIdList').innerHTML=(panelDraft.circuits||[]).map(c=>`<option value="${esc(c.id||'')}">${esc(c.loadName||'')}</option>`).join('');
 ov.innerHTML='';
 (panelDraft.photoMarks||[]).forEach((mark,idx)=>{
   if((+mark.x)<=1&&(+mark.y)<=1&&(+mark.w)<=1&&(+mark.h)<=1){mark.x*=100;mark.y*=100;mark.w*=100;mark.h*=100}
   const d=document.createElement('div');d.className='photo-mark'+(mark.uid===photoSelectedMarkId?' selected':'');
   d.style.left=mark.x+'%';d.style.top=mark.y+'%';d.style.width=mark.w+'%';d.style.height=mark.h+'%';d.dataset.markUid=mark.uid;
   const icon=document.createElement('div');icon.className='photo-mark-icon';icon.textContent=(mark.iconType||'breaker')==='breaker'?photoMarkCode(mark):(photoIconMap[mark.iconType]||'●');
   const oldLabel=document.createElement('div');oldLabel.className='photo-mark-label';oldLabel.textContent=photoMainRole(mark);d.appendChild(oldLabel);
   const main=document.createElement('div');main.className='photo-mark-main'+((+mark.x)>72?' flip':'')+((+mark.y)+(+mark.h)>86?' above':'');
   main.innerHTML=`<span class="pm-code">${esc(photoMarkCode(mark))}</span><span class="pm-role">${esc(photoMainRole(mark))}</span>`;d.appendChild(icon);d.appendChild(main);
   if((mark.showPower||'yes')==='yes'&&(mark.measuredKw||mark.ratedKw||mark.measuredA)){const pp=document.createElement('div');pp.className='photo-mark-power';pp.textContent=(mark.measuredKw||mark.ratedKw?`${mark.measuredKw||mark.ratedKw}kW`:'')+(mark.measuredA?` / ${mark.measuredA}A`:'');d.appendChild(pp)}
   if(photoToolMode==='move'&&mark.uid===photoSelectedMarkId){const h=document.createElement('div');h.className='photo-resize-handle';h.title='拖曳調整大小';d.appendChild(h)}
   d.addEventListener('click',e=>{e.stopPropagation();loadPhotoMarkEditor(mark)});
   d.addEventListener('pointerdown',e=>{
     e.stopPropagation();
     if(photoSelectedMarkId!==mark.uid)loadPhotoMarkEditor(mark);
     if(photoToolMode!=='move')return;
     const resize=e.target.classList.contains('photo-resize-handle');
     photoDrag={mark,resize,startX:e.clientX,startY:e.clientY,x:+mark.x,y:+mark.y,w:+mark.w,h:+mark.h};
     d.setPointerCapture?.(e.pointerId);e.preventDefault();
   });
   ov.appendChild(d);
 });
 const selectedMark=photoMarkById(photoSelectedMarkId);
 if(selectedMark){
   qs('photoMarkSummary').innerHTML=photoSummaryHtml(selectedMark);
   // 標註資料不再覆蓋照片；編輯欄位固定顯示於旁邊。

 }
}
function photoPointerPos(e){const r=qs('panelPhotoOverlay').getBoundingClientRect();return{x:Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100)),y:Math.max(0,Math.min(100,(e.clientY-r.top)/r.height*100))}}
function enablePhotoMarkMode(){if(!panelDraft.photoData)return alert('請先上傳配電箱實體照片');setPhotoTool('box')}
function finishPhotoMarkBox(a,b){
 const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);if(w<1||h<1)return;
 const m=newPhotoMarkAt(x+w/2,y+h/2,w,h);setPhotoTool('browse');persistPanelPhotoDraft();qs('photoMarkFunction')?.focus({preventScroll:true});return m;
}
function compressPanelPhoto(file){
 return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onerror=reject;fr.onload=()=>{const im=new Image();im.onerror=reject;im.onload=()=>{const maxW=1280,maxH=1200,scale=Math.min(1,maxW/im.width,maxH/im.height);const c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*scale));c.height=Math.max(1,Math.round(im.height*scale));const ctx=c.getContext('2d');ctx.drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',0.78));};im.src=fr.result;};fr.readAsDataURL(file);});
}
function loadPhotoDataFromCircuit(){
 const mark=photoMarkById(photoSelectedMarkId);if(!mark)return alert('請先選取照片標註');syncPanelDraftFromForm();
 const c=panelCircuitById(qs('photoMarkId').value||mark.circuitId);if(!c)return alert('迴路表找不到相同編號，請先輸入例如 QF1');
 qs('photoMarkFunction').value=c.loadName||'';qs('photoMarkPurpose').value=c.controlMode||'';qs('photoMarkLoad').value=c.groupArea||c.loadName||'';qs('photoMarkRatedKw').value=c.kw||'';qs('photoMarkBreaker').value=[c.breakerType,c.poles,c.amp?c.amp+'A':''].filter(Boolean).join(' ');qs('photoMarkEmergency').value=c.emergency||'';qs('photoMarkBackup').value=c.backup||'';qs('photoMarkFrom').value=panelDraft.meta?.upstream||qs('pmUpstream').value||'';qs('photoMarkTo').value=c.loadName||'';qs('photoMarkDetail').value=c.note||'';
}
function syncPhotoMarkToCircuit(){
 const mark=photoMarkById(photoSelectedMarkId);if(!mark)return alert('請先選取照片標註');savePhotoMarkFields();syncPanelDraftFromForm();
 let c=panelCircuitById(mark.circuitId);if(!c){c=newCircuit({id:mark.circuitId||`QF${panelDraft.circuits.length+1}`});panelDraft.circuits.push(c);}
 c.loadName=mark.functionName||mark.loadName||c.loadName;c.groupArea=mark.loadName||c.groupArea;c.kw=mark.ratedKw||mark.measuredKw||c.kw;c.emergency=mark.emergency||c.emergency;c.backup=mark.backup||c.backup;c.note=[c.note,mark.purpose,mark.sourceFrom?('來源：'+mark.sourceFrom):'',mark.targetTo?('去向：'+mark.targetTo):'',mark.detail,mark.note].filter(Boolean).join('；');persistPanelPhotoDraft();
 renderCircuitRows();renderPanelPreview();updatePanelTabBadges();setPanelEditorTab('circuits');status.textContent='已將照片標註同步回迴路表';
}

function renderPanelPreview(){syncPanelMeta();const cs=panelDraft.circuits,total=cs.reduce((a,c)=>a+(parseFloat(c.kw)||0),0),ab=cs.reduce((a,c)=>a+((c.emergency==='A'||c.emergency==='B')?(parseFloat(c.kw)||0):0),0),controlled=cs.filter(c=>c.controlMode&&c.controlMode!=='手動開關').length,heatLamps=cs.reduce((a,c)=>a+(parseInt(c.lampQty)||0),0),heatKw=cs.reduce((a,c)=>a+((parseInt(c.lampQty)||0)>0?(parseFloat(c.kw)||0):0),0);qs('pkCircuitCount').textContent=cs.length;qs('pkTotalKw').textContent=total.toFixed(2);qs('pkBackupKw').textContent=ab.toFixed(2);qs('pkControlledHeat').textContent=controlled;qs('pkHeatLamps').textContent=heatLamps;qs('pkHeatKw').textContent=heatKw.toFixed(2);const ventCs=cs.filter(c=>parseInt(c.stage)>0);const maxStage=Math.max(0,...ventCs.map(c=>parseInt(c.stage)||0));qs('pkVentAuto').textContent=ventCs.length;qs('pkVentStageMax').textContent=maxStage;const vs=qs('ventSequence');if(vs){const ordered=[...ventCs].sort((a,b)=>(parseInt(a.stage)||999)-(parseInt(b.stage)||999));vs.innerHTML=ordered.length?ordered.map(c=>`<div class="vent-step"><b>第 ${esc(c.stage)} 段｜${esc(c.loadName||'未指定設備')}</b><br><span class="muted">${c.startTemp?`啟動 ${esc(c.startTemp)}°C`: '啟動溫度未設定'}${c.stopTemp?`｜停止 ${esc(c.stopTemp)}°C`:''}${c.delaySec?`｜延遲 ${esc(c.delaySec)} 秒`:''}${c.interlock?`｜互鎖：${esc(c.interlock)}`:''}｜${esc(c.controlMode||'手動開關')}</span></div>`).join(''):'<div class="tiny">尚未設定通風分段控制。</div>';}qs('panelFootSummary').textContent=`${qs('pmPanelName').value||'配電箱'}｜${panelDraft.meta.voltage} ${panelDraft.meta.phase}｜主開關 ${panelDraft.meta.mainType} ${panelDraft.meta.mainAmp||'—'}A｜${cs.length} 分路｜${total.toFixed(2)} kW｜通風最高第${maxStage||0}段`;
 const sld=qs('panelSld'),up=qs('pmUpstream').value||'上游電源 / ATS';let h=`<div class="sld-source">${esc(up)}</div><div class="sld-main">${esc(panelDraft.meta.mainType)} ${esc(panelDraft.meta.mainPoles)} ${esc(panelDraft.meta.mainAmp||'—')}A<br><span style="font-size:10px;font-weight:400">${esc(panelDraft.meta.voltage)}｜${esc(panelDraft.meta.phase)}｜母排 ${esc(panelDraft.meta.busbar||'未設定')}</span></div>`;if(!cs.length){h+='<div class="tiny" style="text-align:center;margin-top:30px">尚無分路，請新增迴路或從下游設備自動建立。</div>'}else{h+='<div class="branch-bus">'+cs.map(c=>`<div class="branch-card"><div class="bc-id">${esc(c.id)}｜${esc(c.breakerType)} ${esc(c.poles)} ${esc(c.amp||'—')}A</div><div class="bc-load">${esc(c.loadName||'未指定負載')}</div>${c.groupArea?`<div class="bc-sub">群組 ${esc(c.groupArea)}</div>`:''}<div class="bc-sub">相別 ${esc(c.phase||'—')}｜線徑 ${esc(c.cable||'—')}｜${esc(c.kw||'0')} kW${c.lampQty?`｜${esc(c.unitW||'—')}W × ${esc(c.lampQty)}盞`:''}</div>${c.stage?`<div class="stage-badge">通風第 ${esc(c.stage)} 段${c.startTemp?`｜啟 ${esc(c.startTemp)}°C`:''}${c.stopTemp?`｜停 ${esc(c.stopTemp)}°C`:''}${c.delaySec?`｜延遲 ${esc(c.delaySec)}s`:''}</div>`:''}<div class="ctrl-badge">控制：${esc(c.controlMode||'手動開關')}${c.tempSet?`｜保溫 ${esc(c.tempSet)}°C`:''}${c.tempDiff?` ±${esc(c.tempDiff)}°C`:''}${c.contactor?`｜${esc(c.contactor)}`:''}${c.interlock?`｜互鎖 ${esc(c.interlock)}`:''}</div><br><span class="${c.backup==='yes'?'ab':'noab'}">${c.backup==='yes'?'發電備援':'非發電備援'}${c.emergency?`・${esc(c.emergency)}級`:''}</span></div>`).join('')+'</div>'}sld.innerHTML=h;
}
function autoCircuitsFromDownstream(){setPanelEditorTab('circuits');
 if(!panelEditTarget)return;syncPanelDraftFromForm();const children=[...document.querySelectorAll('.component[data-user="1"]')].filter(c=>c.dataset.powerParent===panelEditTarget.dataset.uid);const existing=new Set(panelDraft.circuits.map(c=>c.loadUid).filter(Boolean));children.forEach(c=>{if(existing.has(c.dataset.uid))return;const isHeat=c.dataset.kind==='heatLamp',isVent=['exhaustFan','guideFan','coolingPump'].includes(c.dataset.kind);panelDraft.circuits.push(newCircuit({loadUid:c.dataset.uid,loadName:c.dataset.name||labels[c.dataset.kind]||'設備',kw:c.dataset.powerKw||'',emergency:c.dataset.emergencyClass||'',backup:c.dataset.backup||'no',poles:isHeat?'2P':'3P',phase:isHeat?'R-N':'RST',controlMode:isHeat?'手/自動切換':(isVent?'環控器+接觸器':'手動開關'),contactor:(isHeat||isVent)?'接觸器（規格待填）':'',note:'由圖面電線連接自動建立'}))});renderCircuitRows();status.textContent=`已從下游連線新增 ${children.length} 個候選負載`;}

function addHeatLampCircuit(){
 if(!panelDraft)return;
 syncPanelDraftFromForm();
 const wRaw=prompt('單盞保溫燈瓦數（W），例如 175 或 250：','250');
 if(wRaw===null)return;
 const nRaw=prompt('此迴路保溫燈數量：','1');
 if(nRaw===null)return;
 const w=Math.max(0,parseFloat(wRaw)||0), n=Math.max(1,parseInt(nRaw)||1);
 const kw=(w*n/1000).toFixed(2);
 const modeRaw=prompt('控制模式：\n1 手動開關\n2 溫控器\n3 定時器\n4 接觸器\n5 溫控+接觸器\n6 手/自動切換','5');
 if(modeRaw===null)return;
 const modeMap={'1':'手動開關','2':'溫控器','3':'定時器','4':'接觸器','5':'溫控+接觸器','6':'手/自動切換'};
 const controlMode=modeMap[String(modeRaw).trim()]||String(modeRaw).trim()||'溫控+接觸器';
 let tempSet='',tempDiff='';
 if(controlMode.includes('溫控')||controlMode.includes('自動')){
   const t=prompt('溫控設定溫度（°C，可留白後續再填）：','');
   if(t!==null)tempSet=t.trim();
   const d=prompt('溫控回差（°C，可留白後續再填）：','');
   if(d!==null)tempDiff=d.trim();
 }
 panelDraft.circuits.push(newCircuit({
   groupArea:'',
   loadName:`保溫燈迴路（${w}W × ${n}盞）`,
   unitW:String(w),
   lampQty:String(n),
   kw,
   breakerType:'MCB',
   poles:'2P',
   phase:'R-N',
   controlMode,
   tempSet,
   tempDiff,
   contactor:(controlMode.includes('接觸器')||controlMode.includes('自動'))?'接觸器（規格待填）':'',
   emergency:'B',
   backup:'yes',
   note:'仔豬保溫；控制設定值請依仔豬日齡、局部保溫區溫度與現場設備規格確認'
 }));
 renderCircuitRows();
 status.textContent=`已新增保溫燈控制迴路：${w}W × ${n}盞 = ${kw} kW｜${controlMode}`;
}

function nextCircuitId(){
 const nums=panelDraft.circuits.map(c=>{const m=String(c.id||'').match(/QF\s*(\d+)/i);return m?parseInt(m[1]):0});
 return 'QF'+(Math.max(0,...nums)+1);
}
function addFarrowHeatGroups(){
 if(!panelDraft)return;
 syncPanelDraftFromForm();
 const barnRaw=prompt('選擇產房：\nA = 42床\nB = 36床\nC = 36床\nD = 36床\n或直接輸入自訂名稱','A');
 if(barnRaw===null)return;
 const code=String(barnRaw).trim().toUpperCase()||'A';
 const bedMap={A:42,B:36,C:36,D:36};
 const barnName=bedMap[code]?`產房${code}棟`:String(barnRaw).trim();
 const beds=bedMap[code]||Math.max(1,parseInt(prompt('此產房/區域床數：','36')||'36')||36);
 const groupRaw=prompt('要分成幾組控制？\n建議三排產房先用 3 組，可再自行修改。','3');
 if(groupRaw===null)return;
 const groups=Math.max(1,Math.min(20,parseInt(groupRaw)||3));
 const lampRaw=prompt(`每組保溫燈數量？\n${barnName} ${beds}床、${groups}組時，若每床1盞平均約 ${(beds/groups).toFixed(1)} 盞/組。\n可輸入單一數字（每組相同），或用逗號分隔，例如 14,14,14。`,String(Math.floor(beds/groups)));
 if(lampRaw===null)return;
 let quantities=String(lampRaw).split(/[,，\s]+/).map(x=>Math.max(0,parseInt(x)||0)).filter((_,i)=>i<groups);
 if(quantities.length===1)quantities=Array(groups).fill(quantities[0]);
 while(quantities.length<groups)quantities.push(Math.floor(beds/groups));
 const wRaw=prompt('單盞保溫燈瓦數（W）：','250');
 if(wRaw===null)return;
 const w=Math.max(0,parseFloat(wRaw)||250);
 const controlRaw=prompt('群組控制模式：\n1 手動開關\n2 溫控器\n3 定時器\n4 接觸器\n5 溫控+接觸器\n6 手/自動切換','5');
 if(controlRaw===null)return;
 const modeMap={'1':'手動開關','2':'溫控器','3':'定時器','4':'接觸器','5':'溫控+接觸器','6':'手/自動切換'};
 const controlMode=modeMap[String(controlRaw).trim()]||'溫控+接觸器';
 let tempSet='',tempDiff='';
 if(controlMode.includes('溫控')||controlMode.includes('自動')){
   const t=prompt('各組共同的初始溫控設定（°C，可留白）：',''); if(t!==null)tempSet=t.trim();
   const d=prompt('共同溫控回差（°C，可留白）：',''); if(d!==null)tempDiff=d.trim();
 }
 const phaseCycle=['R-N','S-N','T-N'];
 let created=0;
 for(let i=0;i<groups;i++){
   const n=quantities[i]||0,kw=(w*n/1000).toFixed(2),id=nextCircuitId();
   panelDraft.circuits.push(newCircuit({
     id,
     groupArea:`${barnName}-第${i+1}組`,
     loadName:`${barnName} 保溫燈第${i+1}組（${w}W × ${n}盞）`,
     unitW:String(w),lampQty:String(n),kw,
     breakerType:'MCB',poles:'2P',phase:phaseCycle[i%3],
     controlMode,tempSet,tempDiff,
     contactor:(controlMode.includes('接觸器')||controlMode.includes('自動'))?'接觸器（規格待填）':'',
     emergency:'B',backup:'yes',
     note:`${barnName}保溫燈分組；第${i+1}/${groups}組。R-N/S-N/T-N為負載平衡規劃提示，實際相別與電壓須依現場盤體確認。`
   }));created++;
 }
 renderCircuitRows();
 status.textContent=`已建立 ${barnName} 保溫燈 ${created} 組｜共 ${quantities.slice(0,groups).reduce((a,b)=>a+b,0)} 盞｜相別依 R-N / S-N / T-N 輪替。`;
}

function addVentilationStages(){
 if(!panelDraft||!panelEditTarget)return;
 syncPanelDraftFromForm();
 const barn=prompt('通風控制所屬棟舍/區域：',panelEditTarget.dataset.building||panelEditTarget.dataset.name||'');
 if(barn===null)return;
 const modeRaw=prompt('控制方式：\n1 環控器+接觸器\n2 PLC/環控器\n3 手/自動+環控\n4 變頻/VFD（適用有變頻器設備）','1');
 if(modeRaw===null)return;
 const modeMap={'1':'環控器+接觸器','2':'PLC/環控器','3':'手/自動+環控','4':'變頻/VFD'};
 const controlMode=modeMap[String(modeRaw).trim()]||'環控器+接觸器';
 const delayRaw=prompt('各段啟動延遲秒數（降低同時啟動衝擊，可自行修改）：','5');
 if(delayRaw===null)return;
 const defaultDelay=Math.max(0,parseInt(delayRaw)||0);
 const startsRaw=prompt('各段「啟動溫度」可用逗號分隔，例如 26,28,30,32；若尚未決定可留白，之後在表格逐段設定。','');
 if(startsRaw===null)return;
 const starts=String(startsRaw).split(/[,，\s]+/).filter(Boolean);
 const hystRaw=prompt('冷卻設備停機回差（°C）。例如輸入 1.0，啟動 28°C 時停止會先填 27°C；若不想自動帶入可留白。','');
 if(hystRaw===null)return;
 const hyst=String(hystRaw).trim()===''?null:Math.max(0,parseFloat(hystRaw)||0);
 const downstream=[...document.querySelectorAll('.component[data-user="1"]')].filter(c=>c.dataset.powerParent===panelEditTarget.dataset.uid&&['exhaustFan','guideFan','coolingPump'].includes(c.dataset.kind));
 let targets=[...downstream];
 if(!targets.length){
   const ef=Math.max(0,parseInt(prompt('目前圖面尚無直接連到此電箱的通風設備。要先建立幾個「主排風扇」虛擬迴路？','3')||'0')||0);
   const gf=Math.max(0,parseInt(prompt('要建立幾個「導引扇」虛擬迴路？','0')||'0')||0);
   const pp=Math.max(0,parseInt(prompt('要建立幾個「水簾泵浦」虛擬迴路？','1')||'0')||0);
   targets=[];
   for(let i=0;i<ef;i++)targets.push({dataset:{kind:'exhaustFan',name:`${barn||'棟舍'} 主排風扇${i+1}`,powerKw:'1.50',emergencyClass:'A',backup:'yes',uid:''}});
   for(let i=0;i<gf;i++)targets.push({dataset:{kind:'guideFan',name:`${barn||'棟舍'} 導引扇${i+1}`,powerKw:'0.75',emergencyClass:'A',backup:'yes',uid:''}});
   for(let i=0;i<pp;i++)targets.push({dataset:{kind:'coolingPump',name:`${barn||'棟舍'} 水簾泵浦${i+1}`,powerKw:'0.75',emergencyClass:'B',backup:'yes',uid:''}});
 }
 if(!targets.length){alert('沒有可建立的通風設備。請先在圖面放置設備並以電線接到此電箱，或在建置視窗輸入虛擬迴路數量。');return}
 const order={exhaustFan:1,guideFan:2,coolingPump:3};targets.sort((a,b)=>(order[a.dataset.kind]||9)-(order[b.dataset.kind]||9));
 const existing=new Set(panelDraft.circuits.map(c=>c.loadUid).filter(Boolean));
 let stage=1,created=0;
 for(const dev of targets){
   const d=dev.dataset;if(d.uid&&existing.has(d.uid))continue;
   const start=starts[stage-1]||'';const stop=(start!==''&&hyst!==null)?(parseFloat(start)-hyst).toFixed(1):'';
   const interlock=d.kind==='coolingPump'?'至少1台主排風扇運轉':(d.kind==='guideFan'?'主排風扇已運轉':'');
   panelDraft.circuits.push(newCircuit({
     id:nextCircuitId(),groupArea:barn||'',loadUid:d.uid||'',loadName:d.name||labels[d.kind]||'通風設備',kw:d.powerKw||'',
     breakerType:'MCB',poles:'3P',phase:'RST',controlMode,stage:String(stage),startTemp:start,stopTemp:stop,delaySec:String(defaultDelay),interlock,
     contactor:controlMode.includes('VFD')?'VFD（規格待填）':'接觸器（AC-3規格待填）',emergency:d.emergencyClass||(d.kind==='coolingPump'?'B':'A'),backup:d.backup||'yes',
     note:`${barn||'棟舍'}通風分段控制；段位與溫度為可編輯規劃值，實際設定應依舍內溫度、豬隻階段、風量與環控器現場調校。`
   }));stage++;created++;
 }
 renderCircuitRows();
 status.textContent=`已建立 ${created} 個通風分段迴路｜${barn||'棟舍'}｜${controlMode}｜最高第 ${Math.max(0,stage-1)} 段。`;
}


qs('panelPhotoUploadBtn').onclick=()=>qs('panelPhotoInput').click();
qs('panelPhotoInput').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{panelDraft.photoData=await compressPanelPhoto(f);panelDraft.photoMarks=[];clearPhotoMarkEditor(false);persistPanelPhotoDraft();setPanelEditorTab('photo');renderPanelPhoto();status.textContent='已載入配電箱照片；照片已自動保存。';setPhotoTool('browse');}catch(err){alert('照片讀取失敗：'+err.message)}e.target.value='';});
qs('panelPhotoAddMarkBtn').onclick=()=>setPhotoTool('box');
qs('photoToolAddBtn').onclick=()=>{if(!panelDraft.photoData)return alert('請先上傳配電箱實體照片');setPhotoTool('point')};
qs('photoToolBoxBtn').onclick=()=>{if(!panelDraft.photoData)return alert('請先上傳配電箱實體照片');setPhotoTool('box')};
qs('photoToolMoveBtn').onclick=()=>{if(!panelDraft.photoData)return alert('請先上傳配電箱實體照片');setPhotoTool('move');renderPanelPhoto()};
qs('photoToolDoneBtn').onclick=()=>{setPhotoTool('browse');photoDrag=null;renderPanelPhoto()};
qs('photoToolDeleteBtn').onclick=()=>{if(!photoSelectedMarkId)return alert('請先點選照片上的標記');if(confirm('確定刪除此標記？')){panelDraft.photoMarks=(panelDraft.photoMarks||[]).filter(m=>m.uid!==photoSelectedMarkId);clearPhotoMarkEditor(false);persistPanelPhotoDraft();renderPanelPhoto();updatePanelTabBadges()}};
qs('panelPhotoClearBtn').onclick=()=>{if(confirm('移除這個配電箱的實體照片與所有照片標註？')){panelDraft.photoData='';panelDraft.photoMarks=[];clearPhotoMarkEditor(false);persistPanelPhotoDraft();renderPanelPhoto();updatePanelTabBadges();setPhotoTool('browse')}};

['photoMarkRatedKw','photoMarkMeasuredA','photoMarkMeasuredKw','photoMarkKwh','photoMarkEmergency','photoMarkBackup','photoMarkNote','photoMarkIconType','photoMarkShowPower','photoMarkDetail'].forEach(id=>{
 const box=qs(id)?.closest('.box');if(box){box.classList.add('photo-extra-field');if(id==='photoMarkDetail')box.classList.add('full')}
});
qs('photoMoreFieldsBtn').onclick=()=>{
 const sec=qs('photoMoreFieldsBtn').closest('.panel-photo-section');sec?.classList.toggle('photo-more-open');
 qs('photoMoreFieldsBtn').textContent=sec?.classList.contains('photo-more-open')?'收合欄位':'更多欄位';
};
qs('photoSaveMarkBtn').onclick=savePhotoMarkFields;
qs('panelEditorModal').querySelector('.photo-workspace-editor')?.addEventListener('pointerdown',e=>e.stopPropagation());
['photoMarkId','photoMarkFunction','photoMarkPurpose','photoMarkLoad','photoMarkBreaker','photoMarkFrom','photoMarkTo','photoMarkDetail','photoMarkRatedKw','photoMarkMeasuredKw','photoMarkMeasuredA','photoMarkKwh','photoMarkNote'].forEach(id=>qs(id)?.addEventListener('input',()=>{
 const m=photoMarkById(photoSelectedMarkId);if(!m)return;writePhotoFormToMark(m);persistPanelPhotoDraft();renderPanelPhoto();
}));
['photoMarkEmergency','photoMarkBackup','photoMarkIconType','photoMarkShowPower'].forEach(id=>qs(id)?.addEventListener('change',()=>{
 const m=photoMarkById(photoSelectedMarkId);if(!m)return;writePhotoFormToMark(m);persistPanelPhotoDraft();renderPanelPhoto();
}));
qs('photoDeleteMarkBtn').onclick=()=>{if(!photoSelectedMarkId)return;panelDraft.photoMarks=(panelDraft.photoMarks||[]).filter(m=>m.uid!==photoSelectedMarkId);clearPhotoMarkEditor(false);persistPanelPhotoDraft();renderPanelPhoto();updatePanelTabBadges()};
qs('photoLoadFromCircuitBtn').onclick=loadPhotoDataFromCircuit;
qs('photoSyncCircuitBtn').onclick=syncPhotoMarkToCircuit;
qs('panelPhotoOverlay').addEventListener('pointerdown',e=>{
 if(e.target.closest('.photo-mark')||e.target.closest('.photo-inline-popup'))return;
 if(photoToolMode==='browse'&&photoSelectedMarkId){commitSelectedPhotoMark(true);photoSelectedMarkId=null;clearPhotoMarkEditor(false);renderPanelPhoto();return}
 if(photoToolMode==='point'){const p=photoPointerPos(e);newPhotoMarkAt(p.x,p.y,6,5);setPhotoTool('browse');e.preventDefault();return}
 if(photoToolMode!=='box')return;
 photoDrawStart=photoPointerPos(e);photoTempBox=document.createElement('div');photoTempBox.className='photo-temp-mark';qs('panelPhotoOverlay').appendChild(photoTempBox);e.preventDefault();
});
qs('panelPhotoOverlay').addEventListener('pointermove',e=>{
 if(photoDrag){
   const r=qs('panelPhotoOverlay').getBoundingClientRect(),dx=(e.clientX-photoDrag.startX)/r.width*100,dy=(e.clientY-photoDrag.startY)/r.height*100,m=photoDrag.mark;
   if(photoDrag.resize){m.w=Math.max(1,Math.min(100-photoDrag.x,photoDrag.w+dx));m.h=Math.max(1,Math.min(100-photoDrag.y,photoDrag.h+dy))}
   else{m.x=Math.max(0,Math.min(100-m.w,photoDrag.x+dx));m.y=Math.max(0,Math.min(100-m.h,photoDrag.y+dy))}
   renderPanelPhoto();return
 }
 if(photoToolMode!=='box'||!photoDrawStart||!photoTempBox)return;
 const b=photoPointerPos(e),x=Math.min(photoDrawStart.x,b.x),y=Math.min(photoDrawStart.y,b.y),w=Math.abs(photoDrawStart.x-b.x),h=Math.abs(photoDrawStart.y-b.y);Object.assign(photoTempBox.style,{left:x+'%',top:y+'%',width:w+'%',height:h+'%'});
});
qs('panelPhotoOverlay').addEventListener('pointerup',e=>{
 if(photoDrag){photoDrag=null;persistPanelPhotoDraft();renderPanelPhoto();return}
 if(photoToolMode!=='box'||!photoDrawStart)return;
 const b=photoPointerPos(e);finishPhotoMarkBox(photoDrawStart,b);photoDrawStart=null;if(photoTempBox){photoTempBox.remove();photoTempBox=null}persistPanelPhotoDraft();renderPanelPhoto();
});



qs('panelTabMeta').onclick=()=>setPanelEditorTab('meta');
qs('panelTabPhoto').onclick=()=>setPanelEditorTab('photo');
qs('panelTabCircuits').onclick=()=>setPanelEditorTab('circuits');
qs('panelTabPreview').onclick=()=>setPanelEditorTab('preview');
qs('simulateOutageBtn').onclick=simulateOutage;
qs('normalPowerBtn').onclick=normalPower;
['simA','simB','simC','simGenerator'].forEach(id=>qs(id)?.addEventListener('change',()=>{if(outageSimActive)simulateOutage()}));
qs('openPanelEditorBtn').onclick=()=>openPanelEditor(selected);qs('panelCloseTopBtn').onclick=()=>closePanelEditor(false);qs('panelCancelBtn').onclick=()=>closePanelEditor(false);qs('panelSaveBtn').onclick=()=>savePanelEditor(false);qs('panelSaveCloseBtn').onclick=()=>savePanelEditor(true);qs('panelAddCircuitBtn').onclick=()=>{setPanelEditorTab('circuits');syncPanelDraftFromForm();panelDraft.circuits.push(newCircuit());renderCircuitRows()};qs('panelAddHeatBtn').onclick=addHeatLampCircuit;qs('panelAddHeatGroupBtn').onclick=addFarrowHeatGroups;qs('panelAddVentStageBtn').onclick=addVentilationStages;qs('panelAutoBtn').onclick=autoCircuitsFromDownstream;qs('panelRenumberBtn').onclick=()=>{syncPanelDraftFromForm();panelDraft.circuits.forEach((c,i)=>c.id=`QF${i+1}`);renderCircuitRows()};qs('panelClearCircuitsBtn').onclick=()=>{if(confirm('確定清空這個配電箱的所有分路？')){panelDraft.circuits=[];renderCircuitRows()}};['pmPanelName','pmVoltage','pmPhase','pmBusbar','pmMainType','pmMainAmp','pmMainPoles'].forEach(id=>qs(id).addEventListener('input',renderPanelPreview));qs('panelEditorModal').addEventListener('mousedown',e=>{if(e.target===qs('panelEditorModal'))closePanelEditor(false)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&qs('panelEditorModal')?.classList.contains('show'))closePanelEditor(false)});
// 配電箱雙擊可直接進入內部迴路編輯；保留折線雙擊完成邏輯
svg.addEventListener('dblclick',e=>{if(routeDraw)return;const c=e.target.closest?.('.component');if(isPanel(c)){e.preventDefault();fill(c);openPanelEditor(c)}});


// V6.0 iPad / 手機 PointerEvent 觸控橋接
if(window.PointerEvent){
 const touchPts=new Map();
 let primaryTouchId=null,primaryTarget=null,pinch=null;

 const mouseFromPointer=(type,e)=>new MouseEvent(type,{
   bubbles:true,cancelable:true,clientX:e.clientX,clientY:e.clientY,
   screenX:e.screenX,screenY:e.screenY,button:0,
   buttons:type==='mouseup'?0:1,shiftKey:e.shiftKey,ctrlKey:e.ctrlKey,
   altKey:e.altKey,metaKey:e.metaKey
 });
 const svgBasePoint=(clientX,clientY)=>{
   const p=svg.createSVGPoint();p.x=clientX;p.y=clientY;
   return p.matrixTransform(svg.getScreenCTM().inverse());
 };
 const touchPair=()=>{
   const a=[...touchPts.values()];
   if(a.length<2)return null;
   const p1=a[0],p2=a[1];
   return{p1,p2,cx:(p1.x+p2.x)/2,cy:(p1.y+p2.y)/2,
     dist:Math.max(1,Math.hypot(p2.x-p1.x,p2.y-p1.y))};
 };
 const endSyntheticMouse=e=>{
   if(primaryTouchId===null)return;
   svg.dispatchEvent(mouseFromPointer('mouseup',e));
   primaryTouchId=null;primaryTarget=null;
 };

 svg.addEventListener('pointerdown',e=>{
   if(e.pointerType==='mouse')return;
   touchPts.set(e.pointerId,{x:e.clientX,y:e.clientY});
   try{svg.setPointerCapture(e.pointerId)}catch(_){}
   if(touchPts.size===1){
     primaryTouchId=e.pointerId;primaryTarget=e.target;
     (primaryTarget||svg).dispatchEvent(mouseFromPointer('mousedown',e));
   }else if(touchPts.size===2){
     endSyntheticMouse(e);
     const pair=touchPair();
     if(pair){
       const anchorWorld=pt({clientX:pair.cx,clientY:pair.cy});
       pinch={startDist:pair.dist,startZoom:zoom,anchorWorld};
       document.body.classList.add('touch-pinching');
     }
   }
   e.preventDefault();
 },{passive:false});

 svg.addEventListener('pointermove',e=>{
   if(e.pointerType==='mouse'||!touchPts.has(e.pointerId))return;
   touchPts.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(pinch&&touchPts.size>=2){
     const pair=touchPair();
     if(pair){
       const nextZoom=Math.max(.3,Math.min(4,pinch.startZoom*(pair.dist/pinch.startDist)));
       const centerSvg=svgBasePoint(pair.cx,pair.cy);
       zoom=nextZoom;
       pan.x=centerSvg.x-zoom*pinch.anchorWorld.x;
       pan.y=centerSvg.y-zoom*pinch.anchorWorld.y;
       tf();
       status.textContent=`雙指縮放：${Math.round(zoom*100)}%`;
     }
   }else if(e.pointerId===primaryTouchId){
     svg.dispatchEvent(mouseFromPointer('mousemove',e));
   }
   e.preventDefault();
 },{passive:false});

 const endTouch=e=>{
   if(e.pointerType==='mouse'||!touchPts.has(e.pointerId))return;
   const wasPrimary=e.pointerId===primaryTouchId;
   touchPts.delete(e.pointerId);
   if(pinch){
     if(touchPts.size<2){
       pinch=null;document.body.classList.remove('touch-pinching');
       primaryTouchId=null;primaryTarget=null;
       status.textContent=`縮放 ${Math.round(zoom*100)}%｜可繼續選取或繪圖`;
     }
   }else if(wasPrimary){
     (primaryTarget||svg).dispatchEvent(mouseFromPointer('mouseup',e));
     primaryTouchId=null;primaryTarget=null;
   }
   e.preventDefault();
 };
 svg.addEventListener('pointerup',endTouch,{passive:false});
 svg.addEventListener('pointercancel',endTouch,{passive:false});
}

autoload();if(qs('routeMode'))qs('routeMode').value='free';sanitizeObsoleteOverlayArtifacts();tf();refreshList();updateScaleUI();rebuildPowerRelations();refreshStats();updateCloudUi();initHistory();
})();
