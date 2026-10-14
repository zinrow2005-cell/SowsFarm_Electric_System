const CACHE='huwei-cad-v6971-dual-role-20261014';
const ASSETS=[
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/app.css',
  './assets/js/app-core.js',
  './assets/js/dual-role.js','./assets/js/admin-status.js',
  './assets/js/app-ui.js',
  './assets/js/equipment-library.js',
  './assets/js/project-menu.js',
  './assets/js/pwa-register.js',
'./assets/js/device-relevance.js',
  './assets/js/mobile-ui-fix.js',
  './assets/images/cad-base.png',
  './cad/虎尾母豬場CAD圖.dxf',
  './assets/js/settings-quick.js',
  './assets/images/cad-white-reference.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;

  event.respondWith(
    fetch(event.request)
      .then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        return response;
      })
      .catch(()=>caches.match(event.request).then(
        cached=>cached||caches.match('./index.html')
      ))
  );
});
