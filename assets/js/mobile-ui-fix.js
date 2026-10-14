(()=>{
'use strict';
const dock=document.querySelector('.mobile-cad-dock');
if(!dock)return;
const ids={common:'leftTabCommon',library:'leftTabLibrary',view:'leftTabView'};
function sync(){const tab=document.querySelector('aside')?.getAttribute('data-active-group')||'common';dock.querySelectorAll('[data-mobile-go]').forEach(b=>{const active=b.dataset.mobileGo===tab&&document.body.classList.contains('mobile-left-open');b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}
dock.addEventListener('click',ev=>{const b=ev.target.closest('[data-mobile-go]');if(!b)return;const to=b.dataset.mobileGo;document.body.classList.remove('mobile-left-open','mobile-right-open');if(ids[to]){document.getElementById(ids[to])?.click();document.body.classList.add('mobile-left-open');}else if(to==='properties'){document.getElementById('rightTabBasic')?.click();document.body.classList.add('mobile-right-open');}sync();});
new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
document.querySelectorAll('#leftTabCommon,#leftTabLibrary,#leftTabView').forEach(b=>b.addEventListener('click',()=>requestAnimationFrame(sync)));sync();
})();
