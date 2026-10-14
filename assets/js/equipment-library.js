/* 設備搜尋與分類：只控制顯示，不重建拖曳元件或修改 CAD。 */
(()=>{
 const nav=document.getElementById('equipmentLibraryNavigator');
 const search=document.getElementById('equipmentLibrarySearch');
 const summary=document.getElementById('equipmentLibrarySummary');
 const sections=[...document.querySelectorAll('#equipmentLibrarySections [data-eq-section]')];
 if(!nav||!search||!summary||sections.length!==5)return;
 let category='all';
 function update(){
  const query=search.value.trim().toLocaleLowerCase();
  let visible=0;
  sections.forEach(section=>{
   const matchCat=category==='all'||section.dataset.eqSection===category;
   let sectionCount=0;
   section.querySelectorAll('.libitem').forEach(item=>{
    const match=!query||item.textContent.toLocaleLowerCase().includes(query);
    const show=matchCat&&match;
    item.hidden=!show;
    if(show)sectionCount++;
   });
   const custom=section.dataset.eqSection==='custom';
   if(custom && query){
     const mini=section.querySelector('#customDeviceLibraryMini');
     const customMatch=(section.textContent||'').toLocaleLowerCase().includes(query);
     section.hidden=!matchCat||!customMatch;
   }else section.hidden=!matchCat||(!custom&&sectionCount===0);
   visible+=section.hidden?0:sectionCount;
  });
  summary.textContent=query ? (visible?'搜尋結果：'+visible+' 個設備':'沒有符合的內建設備，可試試其他關鍵字') : category==='all'?'全部設備｜可拖曳至圖面':({water:'水路設備',power:'配電設備',vent:'通風設備',feed:'飼料設備',custom:'自訂物件'}[category]);
  nav.querySelectorAll('[data-eq-filter]').forEach(btn=>{
   const active=btn.dataset.eqFilter===category;
   btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));
  });
 }
 nav.querySelectorAll('[data-eq-filter]').forEach(btn=>btn.addEventListener('click',()=>{category=btn.dataset.eqFilter;search.value='';update();}));
 search.addEventListener('input',()=>{update();});
 update();
})();
