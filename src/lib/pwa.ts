/** The only place the offline service worker is registered. Never runs in the editor preview or dev. */
const PREVIEW_LABEL = /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/;
const LOVABLE_HOSTS = [".lovable.app", ".gpt-eng.com", ".gptengineer.run"];

function refused(): boolean {
  if (!import.meta.env.PROD) return true;
  try { if (window.self !== window.top) return true; } catch { return true; }
  const h = window.location.hostname.toLowerCase();
  const label = h.split(".")[0] ?? "";
  if (LOVABLE_HOSTS.some((d) => h.endsWith(d)) && (PREVIEW_LABEL.test(label) || /^project--.+-dev$/.test(label))) return true;
  for (const d of ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"]) {
    if (h === d || h.endsWith(`.${d}`)) return true;
  }
  return new URLSearchParams(window.location.search).get("sw") === "off";
}

export async function registerPwa() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (refused()) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.filter((r) => r.active?.scriptURL.endsWith("/sw.js") || r.installing?.scriptURL.endsWith("/sw.js") || r.waiting?.scriptURL.endsWith("/sw.js")).map((r) => r.unregister()));
    return;
  }
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
