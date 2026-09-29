/* IDRAL — service worker del gestionale.
   Serve una cosa sola: che l'app del tecnico si apra anche in cantina, senza
   rete. Strategia «prima la rete, poi la copia»: con la rete si prende sempre
   l'ultima versione (cosi' un aggiornamento arriva subito), senza rete si usa
   l'ultima copia salvata. Cambiare VERSIONE a ogni rilascio che tocca i file. */
const VERSIONE = 'idral-2026-09-29-1';
const GUSCIO = ['./', './index.html', './app.css', './manifest.webmanifest',
  './js/dati.js', './js/base.js', './js/fogli.js', './js/accesso.js', './js/tecnico.js',
  './js/guscio-ufficio.js', './js/ufficio-lavori.js', './js/ufficio-gestione.js', './js/cliente.js',
  './icone/icona.svg', './icone/icona-192.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(GUSCIO)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSIONE).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // mappe e link esterni: non si toccano
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(VERSIONE).then(c => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
