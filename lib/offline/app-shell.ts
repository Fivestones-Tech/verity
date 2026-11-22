/**
 * Make sure the taking screen can reload with no connection: register the service
 * worker and save this page plus the scripts and styles it uses.
 */
export async function prepareOfflineShell() {
  if (typeof window === "undefined" || !("caches" in window)) return;
  try {
    if ("serviceWorker" in navigator) await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const pages = await caches.open("verity-pages-v1");
    await pages.add(new Request(location.pathname, { credentials: "same-origin" }));
    const assets = new Set<string>();
    for (const e of performance.getEntriesByType("resource")) {
      const u = new URL(e.name);
      if (u.origin === location.origin && u.pathname.startsWith("/_next/static/")) assets.add(u.pathname + u.search);
    }
    document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>("script[src], link[rel=stylesheet][href]").forEach((el) => {
      const href = "src" in el ? el.src : el.href;
      const u = new URL(href, location.href);
      if (u.origin === location.origin && u.pathname.startsWith("/_next/static/")) assets.add(u.pathname + u.search);
    });
    const stat = await caches.open("verity-static-v1");
    await Promise.all(
      [...assets].map(async (a) => {
        if (!(await stat.match(a))) await stat.add(a).catch(() => undefined);
      }),
    );
  } catch {
    // Best effort: the test still works online, and answers are still saved locally.
  }
}

export async function clearOfflineShell() {
  if (typeof window === "undefined" || !("caches" in window)) return;
  await caches.delete("verity-pages-v1").catch(() => undefined);
}
