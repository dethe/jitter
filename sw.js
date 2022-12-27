// Service worker for Jitter to work offline

self.addEventListener("install", e => {
  console.log("[Service Worker] Install");
  e.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName);
      console.log("[Service Worker] Caching all: app shell and content");
      await cache.addAll(appShellFiles);
    })()
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    (async () => {
      const r = await caches.match(e.request);
      console.log(`[Service Worker] Fetching resource: ${e.request.url}`);
      if (r) {
        return r;
      }
      const response = await fetch(e.request);
      const cache = await caches.open(cacheName);
      console.log(`[Service Worker] Caching new resource: ${e.request.url}`);
      cache.put(e.request, response.clone());
      return response;
    })()
  );
});

const cacheName = "jitter-v0";
const appShellFiles = [
  "/jitter",
  "/jitter/js/animation.js",
  "/jitter/js/dom.js",
  "/jitter/js/file.js",
  "/jitter/js/frames.js",
  "/jitter/js/moat.js",
  "/jitter/js/palettes.js",
  "/jitter/js/script.js",
  "/jitter/js/state.js",
  "/jitter/js/stepper.js",
  "/jitter/js/svgcanvas.js",
  "/jitter/js/timeline.js",
  "/jitter/js/tool.js",
  "/jitter/js/ui.js",
  "/jitter/js/undo.js",
  "/jitter/favicon/android-chrome-192x192.png",
  "/jitter/favicon/android-chrome-512x512.png",
  "/jitter/favicon/apple-touch-icon.png",
  "/jitter/favicon/favicon-16x16.png",
  "/jitter/favicon/favicon-32x32.png",
  "/jitter/img/arrows.svg",
  "/jitter/img/compress-arrows-alt.svg",
  "/jitter/img/eraser.svg",
  "/jitter/img/expand-arrows-alt.svg",
  "/jitter/img/pen.svg",
  "/jitter/img/sync-alt.svg",
  "/jitter/css/fontawesome.css",
  "/jitter/css/regular.css",
  "/jitter/css/select-css.css",
  "/jitter/css/solid.css",
  "/jitter/css/style.css",
  "/jitter/font/fa-regular-400.eot",
  "/jitter/font/fa-regular-400.svg",
  "/jitter/font/fa-regular-400.ttf",
  "/jitter/font/fa-regular-400.woff",
  "/jitter/font/fa-regular-400.woff2",
  "/jitter/font/fa-solid-900.eot",
  "/jitter/font/fa-solid-900.svg",
  "/jitter/font/fa-solid-900.ttf",
  "/jitter/font/fa-solid-900.woff",
  "/jitter/font/fa-solid-900.woff2",
  "/jitter/icons/icon0_48.png",
  "/jitter/icons/icon0_57.png",
  "/jitter/icons/icon0_60.png",
  "/jitter/icons/icon0_72.png",
  "/jitter/icons/icon0_76.png",
  "/jitter/icons/icon0_96.png",
  "/jitter/icons/icon0_114.png",
  "/jitter/icons/icon0_144.png",
  "/jitter/icons/icon0_152.png",
  "/jitter/icons/icon0_180.png",
  "/jitter/icons/icon0_192.png",
  "/jitter/icons/icon0_256.png",
  "/jitter/icons/icon0_384.png",
  "/jitter/icons/icon0_512.png",
  "/jitter/favicon.ico",
];
