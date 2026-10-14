(()=>{'use strict';
 const $=id=>document.getElementById(id),gate=$('roleGate'),msg=$('roleMessage'),bar=$('employeeBar');
 let mode='none',timer=null,rev=-1,refreshing=false,pendingRevision=null,returnFocus=null;
 const config=()=>{try{const c=JSON.parse(localStorage.getItem('huweiCADCloudConfig')||'{}');return c.endpoint||document.querySelector('#cloudEndpoint')?.value||''}catch(e){return document.querySelector('#cloudEndpoint')?.value||''}};
 // app-core's default deployment URL is already written to the cloud endpoint form.
 function endpoint(){return document.querySelector('#cloudEndpoint')?.value?.trim()||config()}
 async function api(action,params={}){const url=endpoint();if(!url)throw Error('請先在管理者的雲端設定填入 Apps Script /exec 網址');const res=await fetch(url,{method:'POST',redirect:'follow',cache:'no-store',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,projectId:'huwei-pigfarm-main',...params})});const o=await res.json();if(!o.ok)throw Error(o.error||'雲端操作失敗');return o}

 // Employees can operate the original filter controls without permitting edits.
 const filterSection=[...document.querySelectorAll('.layout>aside .section')].find(n=>n.querySelector('#viewAllBtn'));
 const filterPlaceholder=document.createComment('快速檢視原位置');if(filterSection)filterSection.before(filterPlaceholder);
 const filterHost=document.createElement('aside');filterHost.id='employeeFilters';filterHost.className='employee-filter-panel';filterHost.hidden=true;
 filterHost.setAttribute('aria-label','快速檢視／設備標示');
 const filterHeading=document.createElement('div');filterHeading.className='employee-filter-heading';
 filterHeading.innerHTML='<strong>快速檢視／設備標示</strong><button id="employeeFilterClose" type="button" aria-label="關閉快速檢視">✕</button>';
 filterHost.append(filterHeading);
 document.body.append(filterHost);
 function mountEmployeeFilters(){if(filterSection)filterHost.append(filterSection)}
 function restoreAdminFilters(){if(filterSection&&filterPlaceholder.parentNode)filterPlaceholder.after(filterSection)}
 const filterToggle=$('employeeQuickView');const topFilterToggle=$('employeeQuickViewTop');
 // 放進頁首正常排版，不使用覆蓋 CAD 工具列的固定定位。
 const pageHeader=document.querySelector('body > header');if(pageHeader&&topFilterToggle)pageHeader.append(topFilterToggle);
 function setFilterOpen(open){filterHost.hidden=!open;filterToggle?.setAttribute('aria-expanded',String(open));topFilterToggle?.setAttribute('aria-expanded',String(open));document.body.classList.toggle('employee-filters-open',open)}
 filterToggle?.addEventListener('click',()=>setFilterOpen(filterHost.hidden));topFilterToggle?.addEventListener('click',()=>setFilterOpen(filterHost.hidden));
 $('employeeFilterClose')?.addEventListener('click',()=>setFilterOpen(false));
 const filterControlIds=new Set(['viewAllBtn','viewWaterBtn','viewElectricBtn','viewVentBtn','viewWasteBtn','viewFeedBtn','viewPumpBtn','viewValveBtn','viewSensorBtn','buildingFilter','deviceFilterAllBtn','deviceFilterNoneBtn','deviceSingleFilter','customViewPick','customViewApply']);
 function safeFilterControl(t){if(!filterHost.contains(t))return false;const el=t.closest('button,select,input');if(!el)return false;return filterControlIds.has(el.id)||!!el.closest('#deviceTypeFilters')&&el.matches('button')}
 function safeMode(){document.body.classList.add('employee-mode');document.body.classList.remove('admin-mode','role-unselected');bar.hidden=false;topFilterToggle.hidden=false;gate.hidden=true;mountEmployeeFilters();setFilterOpen(false);try{window.CAD_ADMIN_SESSION='';}catch(e){} }
 function adminMode(){document.body.classList.remove('employee-mode','role-unselected');document.body.classList.add('admin-mode');bar.hidden=true;topFilterToggle.hidden=true;gate.hidden=true;setFilterOpen(false);restoreAdminFilters();}
 function loadPublished(data){if(typeof loadData!=='function')throw Error('網站尚未載入 CAD 核心');loadData(data);try{setTool('pan')}catch(e){} }
 async function refresh(force=false){if(refreshing||mode!=='employee')return;refreshing=true;try{const v=await api('publicVersion');if(force||Number(v.revision)!==rev){
   if(!force&&(!detail.hidden||!tip.hidden)){pendingRevision=Number(v.revision);$('employeeVersion').textContent='已有新版本，關閉設備資料後可按「更新」載入';return}
   const x=await api('publicProject');if(x.project)loadPublished(x.project);rev=Number(x.revision||0);pendingRevision=null;$('employeeVersion').textContent=x.project?'已更新至版本 '+rev:'管理者尚未發布配置';
 } }catch(e){$('employeeVersion').textContent='讀取失敗：'+e.message}finally{refreshing=false}}
 async function employee(){mode='employee';safeMode();await refresh(true);clearInterval(timer);timer=setInterval(()=>refresh(false),60000)}
 $('chooseEmployee').onclick=employee;
 $('chooseAdmin').onclick=()=>{$('adminLoginForm').hidden=false;msg.textContent='請使用管理者帳號登入';$('adminPassword').focus()};
 $('backToRole').onclick=()=>{$('adminLoginForm').hidden=true;msg.textContent=''};
 $('adminLoginForm').onsubmit=async e=>{e.preventDefault();msg.textContent='正在驗證管理者…';try{const result=await api('adminLogin',{username:$('adminUsername').value.trim(),password:$('adminPassword').value});window.CAD_ADMIN_SESSION=result.session;mode='admin';clearInterval(timer);adminMode();$('adminPassword').value='';msg.textContent='';}catch(err){msg.textContent=err.message}};
 $('switchAdmin').onclick=()=>{gate.hidden=false;$('adminLoginForm').hidden=false;$('adminPassword').value='';};
 $('employeeRefresh').onclick=()=>refresh(true);
 // 員工模式的互動僅限搜尋、圖面平移縮放與設備簡介；絕不向伺服器提交寫入請求。
 document.addEventListener('click',e=>{if(mode!=='employee')return;const t=e.target.closest('button,a,input,select,[draggable]');if(!t)return;
 const allowed=t.closest('#topCadSearch,#employeeBar,#employeeQuickViewTop,.employee-object-tip,.employee-detail-card,.zoom-pill')||['fitBtn','buildingJump'].includes(t.id)||safeFilterControl(t)||t.id==='employeeFilterClose'||t.closest('#roleGate');
 if(!allowed){e.preventDefault();e.stopImmediatePropagation()}},true);
 // 唯讀模式在 capture 階段阻止核心的選取拖曳與雙擊編輯視窗。
 let selectedUid='', selectedEl=null;
 const tip=document.createElement('section');tip.className='employee-object-tip';tip.hidden=true;
 tip.setAttribute('aria-label','設備簡介');document.body.append(tip);
 const detail=document.createElement('section');detail.className='employee-detail-card';detail.hidden=true;
 detail.setAttribute('role','dialog');detail.setAttribute('aria-modal','true');detail.setAttribute('aria-label','設備詳細資料');document.body.append(detail);
 function text(node,tag,value){const el=document.createElement(tag);el.textContent=value;node.append(el);return el}
 function closeDetail(){const wasOpen=!detail.hidden;detail.hidden=true;detail.replaceChildren();if(wasOpen){returnFocus?.focus?.({preventScroll:true});returnFocus=null;if(pendingRevision!=null)$('employeeVersion').textContent='有新版本可載入，請按更新';}}
 function closePreview(){tip.hidden=true;selectedUid='';selectedEl=null}
 function field(label,value,parent=detail){if(value!=null&&String(value).trim()){
   const row=document.createElement('div');row.className='employee-detail-row';text(row,'strong',label);text(row,'span',String(value));parent.append(row);return true}return false}
 function parseArray(value){try{const x=JSON.parse(value||'[]');return Array.isArray(x)?x:[]}catch(e){return []}}
 function parseObject(value){try{const x=JSON.parse(value||'{}');return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}catch(e){return {}}}
 function section(label){const h=text(detail,'h4',label);h.className='employee-detail-section';return h}
 function openDetails(){const el=selectedEl;if(!el)return;returnFocus=document.activeElement;closePreview();detail.replaceChildren();
   const header=document.createElement('div');header.className='employee-detail-head';text(header,'h3',el.dataset.name||el.dataset.kind||'設備');
   if(mode==='admin'){
     const edit=document.createElement('button');edit.type='button';edit.className='admin-view-edit';edit.textContent='✎ 返回編輯';edit.addEventListener('click',()=>{
       // 先保存當前設備參照，關閉唯讀視窗不會失去編輯對象。
       const target=selectedEl;
       closeDetail();
       if(mode!=='admin'||!target||!document.contains(target)){alert('設備已不存在，請重新選取');return}
       if(typeof window.CAD_OPEN_OBJECT_EDITOR==='function'){
         if(!window.CAD_OPEN_OBJECT_EDITOR(target))alert('無法開啟設備編輯，請重新選取');
       }else{alert('編輯功能尚未完成載入，請重新整理頁面')}
     });header.append(edit);
   }
   const close=document.createElement('button');close.type='button';close.textContent='✕ 關閉';close.addEventListener('click',closeDetail);header.append(close);detail.append(header);
   const d=el.dataset,kind=d.kind||'',isPanel=['mainSwitch','mainPanel','subPanel','equipmentPanel'].includes(kind)||!!d.panelMeta||!!d.panelCircuits||!!d.panelPhotoMarks;
   let count=0;
   function add(a,b){if(field(a,b))count++}
   section('基本資料');
   add('設備名稱',d.name);add('所屬棟舍',d.building);add('主要功能',d.mainFunction);add('規格',d.spec);
   add('來源／上游',d.powerParentName||d.sourceA);add('第二來源',d.sourceB);add('去向／下游',d.target);
   add('備註',d.note);
   if(kind==='threeWay'){section('水源切換');add('入口 A',d.valveSourceA);add('入口 B',d.valveSourceB);add('入口 C',d.valveSourceC);add('目前供水',d.switchState);add('出水去向',d.valveOutlet)}
   const electrical=[['powerKw','功率 (kW)'],['airflow','風量 (m³/h)'],['staticPa','靜壓 (Pa)'],['emergencyClass','緊急等級'],['backup','發電備援'],['generatorKva','發電機容量 (kVA)'],['atsMode','ATS 模式']];
   if(electrical.some(([key])=>d[key])){section('電力／設備參數');electrical.forEach(([key,label])=>add(label,d[key]))}
   if(isPanel){const meta=parseObject(d.panelMeta),circuits=parseArray(d.panelCircuits),marks=parseArray(d.panelPhotoMarks);
     if(Object.keys(meta).length){section('配電箱配置');for(const [key,label] of [['voltage','電壓'],['phase','相別'],['busbar','母排'],['mainType','主開關類型'],['mainAmp','主開關電流 (A)'],['mainPoles','主開關極數'],['upstream','上游供電']])add(label,meta[key])}
     if(circuits.length){section('迴路配置（'+circuits.length+' 路）');circuits.forEach(c=>{const card=document.createElement('article');card.className='employee-detail-item';text(card,'b',c.id||'未編號迴路');const parts=[c.loadName,c.groupArea,c.breakerType,c.poles,c.amp?c.amp+'A':'',c.kw?c.kw+' kW':'',c.controlMode,c.cable?'線徑 '+c.cable:'',c.note].filter(Boolean);text(card,'p',parts.join('｜')||'尚未填寫迴路說明');detail.append(card)});count+=circuits.length}
     if(d.panelPhoto){section('配電箱現場照片');const img=document.createElement('img');img.className='employee-panel-photo';img.alt='配電箱現場照片（唯讀）';img.src=d.panelPhoto;detail.append(img);count++}
     if(marks.length){section('照片標記（'+marks.length+' 筆）');marks.forEach(m=>{const card=document.createElement('article');card.className='employee-detail-item';text(card,'b',m.circuitId||m.breaker||'未編號標記');text(card,'p',[m.functionName,m.purpose,m.loadName,m.sourceFrom&&'來源：'+m.sourceFrom,m.targetTo&&'去向：'+m.targetTo,m.detail,m.note].filter(Boolean).join('｜')||'尚未填寫標記說明');detail.append(card)});count+=marks.length}
   }
   if(count<=1){const hint=text(detail,'p','此設備目前只有基本資料。其他詳細內容需由管理者補充並發布最新配置。');hint.className='employee-detail-empty'}
   // 把既有內容分到四個分頁；資料仍由相同的 dataset 欄位讀取，不變動原專案格式。
   const children=[...detail.children].filter(n=>n!==header);let group='basic';
   const groups={basic:[],circuit:[],photo:[],marks:[]};
   for(const child of children){if(child.classList.contains('employee-detail-section')){
      const label=child.textContent||'';if(label.includes('迴路配置'))group='circuit';else if(label.includes('配電箱現場照片'))group='photo';else if(label.includes('照片標記'))group='marks';
   }groups[group].push(child)}
   const nav=document.createElement('div');nav.className='employee-detail-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','詳細資料分類');
   const body=document.createElement('div');body.className='employee-detail-content';body.tabIndex=0;
   // 先將舊的整頁內容移出視窗：否則它會擠壓可捲動區，造成照片頁無法向下滑動。
   detail.replaceChildren(header,nav,body);
   const titles={basic:'基本資料',circuit:'迴路',photo:'照片',marks:'標記'};
   const available=Object.keys(groups).filter(k=>groups[k].length>0);
   function showTab(key){body.replaceChildren(...groups[key]);body.scrollTop=0;for(const btn of nav.querySelectorAll('button')){const on=btn.dataset.tab===key;btn.setAttribute('aria-selected',String(on));btn.classList.toggle('active',on)}}
   for(const key of available){const b=document.createElement('button');b.type='button';b.dataset.tab=key;b.setAttribute('role','tab');b.textContent=titles[key]+(key==='marks'?' '+Math.max(0,groups[key].filter(n=>n.classList?.contains('employee-detail-item')).length):'');b.addEventListener('click',()=>showTab(key));nav.append(b)}
   // 標記清單可一鍵切到照片，並顯示目前選取的標記編號；照片上沒有額外的編輯功能。
   if(groups.photo.length&&groups.marks.length){for(const card of groups.marks.filter(n=>n.classList?.contains('employee-detail-item'))){
      const id=card.querySelector('b')?.textContent||'';const btn=document.createElement('button');btn.type='button';btn.className='employee-photo-jump';btn.textContent='查看照片 ↗';btn.addEventListener('click',()=>{showTab('photo');const note=body.querySelector('.employee-mark-note')||document.createElement('p');note.className='employee-mark-note';note.textContent='目前對照標記：'+id;body.prepend(note)});card.append(btn)
   }}
   const scrollBar=document.createElement('div');scrollBar.className='employee-detail-scrollbar';
   const up=document.createElement('button');up.type='button';up.textContent='↑ 上一段';up.setAttribute('aria-label','向上捲動詳細資料');
   const down=document.createElement('button');down.type='button';down.textContent='↓ 下一段';down.setAttribute('aria-label','向下捲動詳細資料');
   const info=document.createElement('span');info.textContent='可上下滑動閱讀';
   function scrollBySection(dir){body.scrollBy({top:dir*Math.max(130,body.clientHeight*.7),behavior:'smooth'})}
   up.onclick=()=>scrollBySection(-1);down.onclick=()=>scrollBySection(1);
   scrollBar.append(up,info,down);detail.append(scrollBar);
   detail.hidden=false;showTab('basic');close.focus({preventScroll:true});
 }
 // 管理者使用同一套唯讀詳細視窗；原有編輯操作仍由 CAD 核心管理。
 window.CAD_VIEW_DETAILS=function(el){
   if(mode!=='admin'||!el||el.dataset?.user!=='1')return;
   selectedEl=el;selectedUid=el.dataset.uid||el.dataset.name||'';
   openDetails();
 };
 document.addEventListener('keydown',e=>{
   if(mode==='admin'&&e.key==='Escape'&&!detail.hidden){
     e.preventDefault();e.stopImmediatePropagation();closeDetail();
   }
 },true);
 function preview(el){const uid=el.dataset.uid||el.dataset.name||'';
   if(!tip.hidden&&selectedUid===uid){openDetails();return}
   selectedUid=uid;selectedEl=el;tip.replaceChildren();text(tip,'strong',el.dataset.name||el.dataset.kind||'設備');
   text(tip,'p',el.dataset.mainFunction||el.dataset.spec||'尚未填寫用途說明');
   const btn=document.createElement('button');btn.type='button';btn.textContent='查看詳細資料 ›';btn.addEventListener('click',openDetails);tip.append(btn);
   tip.hidden=false;
 }
 // pointerdown 是核心開始拖曳的時機；先攔截，避免員工誤進入編輯流程。
 document.addEventListener('pointerdown',e=>{if(mode!=='employee')return;
   if(e.target.closest('.employee-object-tip,.employee-detail-card,#roleGate,#employeeBar,#employeeQuickViewTop,#topCadSearch,#employeeFilters'))return;
   const el=e.target.closest?.('.component[data-user="1"]');if(!el)return;
   e.preventDefault();e.stopImmediatePropagation();
 },true);
 document.addEventListener('pointerup',e=>{if(mode!=='employee')return;
   if(e.target.closest('.employee-object-tip,.employee-detail-card,#roleGate,#employeeBar,#employeeQuickViewTop,#topCadSearch,#employeeFilters'))return;
   const el=e.target.closest?.('.component[data-user="1"]');if(!el)return;
   e.preventDefault();e.stopImmediatePropagation();
 },true);
 document.addEventListener('click',e=>{if(mode!=='employee')return;
   if(e.target.closest('.employee-object-tip,.employee-detail-card,#roleGate,#employeeBar,#employeeQuickViewTop,#topCadSearch,#employeeFilters'))return;
   const el=e.target.closest?.('.component[data-user="1"]');if(el){e.preventDefault();e.stopImmediatePropagation();if(detail.hidden)preview(el);return}
   if(e.target.closest?.('svg'))closePreview();
 },true);
 // 停止 CAD 雙擊呼叫 openObjectEditor / openPanelEditor。
 document.addEventListener('dblclick',e=>{if(mode!=='employee')return;
   if(e.target.closest?.('.component[data-user="1"]')){e.preventDefault();e.stopImmediatePropagation()}
 },true);
 document.addEventListener('keydown',e=>{if(mode!=='employee')return;if(!detail.hidden&&e.key==='Tab'){const buttons=[...detail.querySelectorAll('button:not([disabled])')];if(buttons.length){const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}}if(e.key==='Escape'){if(!filterHost.hidden)setFilterOpen(false);closePreview();closeDetail()}if(!e.target.matches('input,textarea,[contenteditable]')&&['Delete','Backspace'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation()}},true);
 window.addEventListener('beforeunload',()=>clearInterval(timer));
})();