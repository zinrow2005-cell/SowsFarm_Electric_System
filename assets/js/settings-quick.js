/* 虎尾母豬場：設定介面快捷控制，不改動圖面資料 */
(()=>{
 'use strict';
 const ids=['waterChk','elecChk','componentChk','ventChk','annoChk'];
 const byId=id=>document.getElementById(id);
 const countLabel=()=>{
   const total=ids.filter(id=>byId(id)).length;
   const count=ids.filter(id=>byId(id)?.checked).length;
   const el=byId('layerStateLabel');
   if(el)el.textContent=`目前顯示 ${count} / ${total} 個工程圖層（底圖與區域點選不受影響）`;
 };
 const apply=checked=>{
   ids.forEach(id=>{
     const checkbox=byId(id);
     if(!checkbox)return;
     if(checkbox.checked!==checked){
       checkbox.checked=checked;
       checkbox.dispatchEvent(new Event('change',{bubbles:true}));
     }
   });
   countLabel();
 };
 const allOn=byId('layersAllOn'),allOff=byId('layersAllOff'),reset=byId('layersReset');
 if(allOn)allOn.addEventListener('click',()=>apply(true));
 if(allOff)allOff.addEventListener('click',()=>apply(false));
 if(reset)reset.addEventListener('click',()=>apply(true));
 ids.forEach(id=>byId(id)?.addEventListener('change',countLabel));
 countLabel();
})();
