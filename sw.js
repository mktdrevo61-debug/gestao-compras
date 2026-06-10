// sw.js - Service Worker simples para PWA Drevo Gestão de Compras
const CACHE_NAME = 'drevo-compras-v3';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.json',
  './assets/logo.png',
  './assets/favicon.png',
  './assets/favicon-192.png',
  './assets/favicon-512.png'
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

// Evento de clique na notificação para focar/abrir o aplicativo PWA
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se a página já estiver aberta, foca nela
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não estiver aberta, abre uma nova janela
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});

// Evento de recebimento de Web Push offline (segundo plano)
self.addEventListener('push', (e) => {
  // Variáveis padrão vazias (serão substituídas pelos dados dinâmicos do pedido)
  let notificationTitle = 'Nova Atualização';
  let notificationBody = 'Verifique o status do pedido.';
  let notificationTag = 'general';
  
  if (e.data) {
    try {
      // Aqui o app puxa as VARIÁVEIS dinâmicas (Item, Status, ID) enviadas pelo Apps Script
      const jsonData = e.data.json();
      if (jsonData.title) notificationTitle = jsonData.title;
      if (jsonData.body) notificationBody = jsonData.body;
      if (jsonData.tag) notificationTag = jsonData.tag;
    } catch (err) {
      // Se não for JSON, lê como texto puro
      notificationBody = e.data.text();
    }
  }
  
  const options = {
    body: notificationBody,
    icon: 'assets/favicon-192.png',
    badge: 'assets/favicon-192.png',
    tag: notificationTag,
    vibrate: [200, 100, 200],
    requireInteraction: true
  };
  
  e.waitUntil(
    self.registration.showNotification(notificationTitle, options)
  );
});
