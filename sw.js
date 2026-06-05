// sw.js - Service Worker simples para PWA Drevo Gestão de Compras
const CACHE_NAME = 'drevo-compras-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.json',
  './assets/logo.png',
  './assets/favicon.png'
];

// Instalação do Service Worker e cache dos recursos essenciais
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Ativação do Service Worker e limpeza de caches antigos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia Network-First com Fallback de Cache (prioriza dados da rede, recorre ao cache se estiver offline)
self.addEventListener('fetch', (e) => {
  // Ignorar requisições externas (como a API do Google Sheets que precisa ser sempre em tempo real na nuvem)
  if (e.request.url.includes(self.location.origin)) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          // Atualiza o cache local com a resposta da rede
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Se não conseguir conectar à rede, busca no cache local
          return caches.match(e.request);
        })
    );
  }
});
