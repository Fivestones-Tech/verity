/* Verity service worker (docs/17 "PWA light touch").
 * - Static build assets: cache-first (they are content-hashed).
 * - The test-taking page: network-first, falling back to the copy saved when the
 *   test was opened, so a refresh with no connection still shows the test.
 * - Nothing else is cached. API responses are never cached.
 */
const STATIC = "verity-static-v1";
const PAGES = "verity-pages-v1";
const TAKE = /^\/app\/assessments\/[0-9a-f-]{36}\/take\/?$/;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC, PAGES]);
      for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === "navigate" && TAKE.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const c = await caches.open(PAGES);
        try {
          const res = await fetch(req);
          if (res.ok && !res.redirected) c.put(url.pathname, res.clone());
          return res;
        } catch {
          const hit = await c.match(url.pathname);
          if (hit) return hit;
          throw new Error("offline and not cached");
        }
      })(),
    );
  }
});
