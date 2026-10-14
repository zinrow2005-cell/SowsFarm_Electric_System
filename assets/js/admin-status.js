(()=>{
'use strict';
const local=document.getElementById('adminLocalState'),cloud=document.getElementById('adminPublishState'),host=document.getElementById('adminSaveState');
if(!local||!cloud||!host)return;
function show(a,b,mode){if(a)local.textContent=a;if(b)cloud.textContent=b;host.dataset.state=mode||'idle'}
function time(){return new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}
window.addEventListener('cad:local-changed',()=>show('本機：已自動保存 '+time(),'雲端：有修改待確認','pending'));
window.addEventListener('cad:cloud-published',e=>{const d=e.detail||{};show(null,'雲端：已更新 v'+(d.revision||'?'),'published')});
window.addEventListener('cad:cloud-failed',e=>show(null,'雲端：上傳失敗，請檢查連線','error'));
// This is only a file download, never label it a cloud publication.
document.getElementById('saveBtn')?.addEventListener('click',()=>{local.textContent='本機：已下載 JSON '+time()});
})();

// 管理者點擊「儲存修改」後，確認本機寫入並明確提示雲端尚需完成同步。
window.addEventListener('cad:editor-saved',e=>{
  if(!document.body.classList.contains('admin-mode'))return;
  const name=e.detail?.name||'設備';
  let note=document.getElementById('adminSaveFeedback');
  if(!note){note=document.createElement('div');note.id='adminSaveFeedback';note.setAttribute('role','status');document.body.appendChild(note)}
  note.textContent='✓ '+name+' 已保存在本機｜請確認雲端同步狀態';
  note.hidden=false;
  clearTimeout(window.__cadSaveFeedbackTimer);
  window.__cadSaveFeedbackTimer=setTimeout(()=>{note.hidden=true},3800);
});
