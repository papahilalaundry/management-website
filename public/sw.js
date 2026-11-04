/*
 * Papa Hila service worker: makes the installed app open instantly and keep
 * working without a connection. App data lives in the browser (localStorage),
 * so caching the app shell is all that is needed for offline use.
 *
 * Bump CACHE when this file's caching strategy changes. Built assets are
 * content-hashed, so normal deploys do not need a bump.
 */
const CACHE = 'phl-shell-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const put = (req, res) => {
  if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) {
    const copy = res.clone()
    caches.open(CACHE).then((c) => c.put(req, copy))
  }
  return res
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Page loads: network first so updates arrive, cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => put('/index.html', res))
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  // Hashed build assets never change: cache first.
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((res) => put(request, res))))
    return
  }

  // Other same-origin files and Google Fonts: serve cached copy, refresh in background.
  if (url.origin === self.location.origin || url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(request).then((hit) => {
        const network = fetch(request).then((res) => put(request, res)).catch(() => hit)
        return hit || network
      }),
    )
  }
})
