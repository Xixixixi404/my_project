const CACHE_NAME = "fake-bank-v6";
const OFFLINE_FALLBACK = "./index.html";
const ASSETS = [
  "./",
  "./index.html",
  "./loan-detail.html",
  "./monthly-due-detail.html",
  "./next-month-due-detail.html",
  "./prepayment-detail.html",
  "./usage-record.html",
  "./repayment-detail.html",
  "./manifest.webmanifest",
  "./assets/styles/main.css",
  "./assets/front/PingFang Regular.ttf",
  "./assets/scripts/app.js",
  "./assets/scripts/data.js",
  "./assets/data/repayment_schedule.json",
  "./assets/data/repayment_history.json",
  "./assets/data/usage_records.json",
  "./assets/logo.png",
  "./assets/icons/arrow.svg",
  "./assets/icons/back.svg",
  "./assets/icons/eye.svg",
  "./assets/icons/todo.png",
  "./assets/icons/progress.png",
  "./assets/icons/keep.png",
  "./assets/icons/proof.png",
  "./assets/icons/money.svg",
  "./assets/icons/record.svg",
  "./assets/icons/service.svg",
  "./assets/icons/tips.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }

          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });

          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match(OFFLINE_FALLBACK);
          }

          return caches.match(event.request);
        });
    })
  );
});
