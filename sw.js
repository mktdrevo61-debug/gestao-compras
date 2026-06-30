// sw.js - Service Worker simples para PWA Drevo Gestão de Compras
const CACHE_NAME = 'drevo-compras-v19';
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

// ============================================================
// FIREBASE CLOUD MESSAGING (FCM)
// ============================================================
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD_TaKudierPObWMsgmTJ9Cx4XdXLZ4meg",
  authDomain: "drevo-compras.firebaseapp.com",
  projectId: "drevo-compras",
  storageBucket: "drevo-compras.firebasestorage.app",
  messagingSenderId: "954205790898",
  appId: "1:954205790898:web:fa632733b0468ea51d5fab"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[sw.js] Mensagem recebida em background ', payload);
  const notificationTitle = payload.notification ? payload.notification.title : (payload.data ? payload.data.title : 'Nova Atualização');
  const notificationBody = payload.notification ? payload.notification.body : (payload.data ? payload.data.body : 'Verifique o status do pedido.');
  
  const notificationOptions = {
    body: notificationBody,
    icon: 'assets/favicon-192.png',
    badge: 'assets/favicon-192.png',
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    requireInteraction: true
  };
  
  self.registration.showNotification(notificationTitle, notificationOptions);
});
