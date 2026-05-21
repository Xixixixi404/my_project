const CACHE_NAME = "fake-bank-v2";
const ASSETS = [
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
  "./assets/icons/app-icon.svg",
  "./assets/icons/arrow.svg",
  "./assets/icons/back.svg",
  "./assets/icons/eye.svg",
  "./assets/icons/money.svg",
  "./assets/icons/record.svg",
  "./assets/icons/service.svg",
  "./assets/icons/tips.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
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
    )
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
