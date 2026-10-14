/*
 * 虎尾場 2D CAD 配置系統 V6.7
 * 精簡介面、側欄、手機 / iPad UI
 *
 * 注意：app-core.js 保持原本大型 IIFE 的作用域，
 * 不任意拆散 let / const 狀態，避免再次發生跨 script 作用域錯誤。
 */

(()=>{
  const body=document.body, aside=document.querySelector('aside'), right=document.querySelector('.right');
  const $=id=>document.getElementById(id);
  let simple=true;

  function setSimpleMode(on){
    simple=!!on;
    body.classList.toggle('simple-ui',simple);
    if(simple)body.classList.remove('device-more-open');
    body.classList.remove('show-export-menu');
    $('uiModeBtn').textContent=simple?'⚙ 進階設定':'✓ 回到精簡';
    $('uiModeBtn').title=simple?'顯示進階工程設定':'回到日常精簡操作';
    if(!simple){
      aside.querySelectorAll('.section[data-ui-group]').forEach(s=>s.style.display='');
      right.querySelectorAll('.secondary-info,.primary-properties').forEach(s=>s.style.display='');
    }else{
      aside.querySelectorAll('.section[data-ui-group]').forEach(s=>s.style.display='');
      right.querySelectorAll('.secondary-info,.primary-properties').forEach(s=>s.style.display='');
    }
    try{localStorage.setItem('pigfarmUiSimple',simple?'1':'0')}catch(e){}
  }
  function setLeftTab(group){
    aside.dataset.activeGroup=group;
    [['leftTabCommon','common'],['leftTabLibrary','library'],['leftTabView','view']].forEach(([id,g])=>$(id)?.classList.toggle('active',g===group));
  }
  function setRightTab(tab){
    right.dataset.rightTab=tab;
    $('rightTabBasic')?.classList.toggle('active',tab==='basic');
    $('rightTabInfo')?.classList.toggle('active',tab==='info');
  }
  function proxyTool(name){
    const btn=document.querySelector(`.tool[data-tool="${name}"]`);
    if(btn)btn.click();
  }

  $('uiModeBtn')?.addEventListener('click',()=>setSimpleMode(!simple));
  $('moreExportBtn')?.addEventListener('click',()=>body.classList.toggle('show-export-menu'));
  $('leftTabCommon')?.addEventListener('click',()=>setLeftTab('common'));
  $('leftTabLibrary')?.addEventListener('click',()=>setLeftTab('library'));
  $('leftTabView')?.addEventListener('click',()=>setLeftTab('view'));
  $('rightTabBasic')?.addEventListener('click',()=>setRightTab('basic'));
  $('rightTabInfo')?.addEventListener('click',()=>setRightTab('info'));
  $('quickSelectBtn')?.addEventListener('click',()=>proxyTool('select'));
  $('quickPanBtn')?.addEventListener('click',()=>proxyTool('pan'));
  $('quickWaterBtn')?.addEventListener('click',()=>proxyTool('water'));
  $('quickElectricBtn')?.addEventListener('click',()=>proxyTool('electric'));

  function mobileUi(){return window.matchMedia('(max-width:1100px)').matches}
  function refreshPanelButtons(){if(mobileUi()){$('leftPanelToggle').textContent=body.classList.contains('mobile-left-open')?'✕ 工具':'☰ 工具';$('rightPanelToggle').textContent=body.classList.contains('mobile-right-open')?'設定 ✕':'設備設定'}else{$('leftPanelToggle').textContent=body.classList.contains('left-collapsed')?'☰ 展開左欄':'◀ 收合左欄';$('rightPanelToggle').textContent=body.classList.contains('right-collapsed')?'展開右欄 ☰':'收合右欄 ▶'}}
  $('leftPanelToggle')?.addEventListener('click',()=>{if(mobileUi()){body.classList.toggle('mobile-left-open');body.classList.remove('mobile-right-open')}else body.classList.toggle('left-collapsed');refreshPanelButtons()});
  $('rightPanelToggle')?.addEventListener('click',()=>{if(mobileUi()){body.classList.toggle('mobile-right-open');body.classList.remove('mobile-left-open')}else body.classList.toggle('right-collapsed');refreshPanelButtons()});window.addEventListener('resize',refreshPanelButtons);refreshPanelButtons();
  $('mobileLeftClose')?.addEventListener('click',()=>{body.classList.remove('mobile-left-open');refreshPanelButtons()});
  $('mobileRightClose')?.addEventListener('click',()=>{body.classList.remove('mobile-right-open');refreshPanelButtons()});

  // 點設備庫後自動回常用工具，減少來回尋找；拖曳不影響。
  document.querySelectorAll('.libitem').forEach(el=>el.addEventListener('click',()=>{/* 設備點選後保留在設備分頁，方便再次選擇 */if(mobileUi()){setTimeout(()=>{body.classList.remove('mobile-left-open');refreshPanelButtons()},60)}}));

  // 選取圖面物件時，右側自動回「目前設備」。
  document.getElementById('svg')?.addEventListener('pointerdown',()=>{if(simple)setRightTab('basic')},{capture:true});

  let saved='1';
  try{saved=localStorage.getItem('pigfarmUiSimple')??'1'}catch(e){}
  setLeftTab('common');setRightTab('basic');
  setSimpleMode(true);setSimpleMode(saved!=='0');
})();
