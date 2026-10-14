(()=>{
 const btn=document.getElementById('projectMenuBtn'),box=document.getElementById('projectExtra');
 if(!btn||!box)return;
 const close=()=>{box.classList.remove('open');btn.setAttribute('aria-expanded','false')};
 const toggle=()=>{const open=!box.classList.contains('open');box.classList.toggle('open',open);btn.setAttribute('aria-expanded',String(open))};
 btn.addEventListener('click',e=>{e.stopPropagation();toggle()});
 box.addEventListener('click',e=>{if(e.target.closest('button'))close()});
 document.addEventListener('pointerdown',e=>{if(!box.contains(e.target)&&!btn.contains(e.target))close()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&box.classList.contains('open')){close();btn.focus()}});
})();
