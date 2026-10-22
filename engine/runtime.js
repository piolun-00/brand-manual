// Skrypt strony manuala (trafia do każdej strony, w podglądzie i w eksporcie).
// Sidebar wysuwany < 1280 px, kopiowanie HEX, przejścia między rozdziałami bez przeładowania.
// W podglądzie edytora linki wewnętrzne nie przeładowują ramki — strona prosi edytor o inny rozdział.
export const RUNTIME = `
(() => {
  const body = document.body;
  const preview = document.documentElement.hasAttribute("data-preview");
  const closeDrawer = () => body.classList.remove("is--drawer-open");
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-drawer-open]")) body.classList.add("is--drawer-open");
    else if (e.target.closest("[data-drawer-close], .sidebar__item")) closeDrawer();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-copy], [data-copy-url]");
    if (!el) return;
    try {
      // Ikony: kopiujemy kod SVG (pobrany z pliku), kolory: wartość HEX
      const text = el.dataset.copy ?? await fetch(el.dataset.copyUrl).then((r) => r.text());
      await navigator.clipboard.writeText(text);
    } catch { return; }
    const label = el.querySelector(".button__label");
    const prev = label ? label.textContent : null;
    el.classList.add("is--copied");
    if (label) label.textContent = "Skopiowano";
    setTimeout(() => { el.classList.remove("is--copied"); if (label) label.textContent = prev; }, 1500);
  });

  if (preview) {
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-page]");
      if (a) { e.preventDefault(); closeDrawer(); parent.postMessage({ khorei: "page", page: a.dataset.page, hash: a.dataset.hash || "" }, "*"); return; }
      const ext = e.target.closest("a[href]");
      if (!ext) return;
      e.preventDefault(); // podgląd nie może nawigować ramki (kotwica w srcdoc otworzyłaby edytor w ramce)
      const href = ext.getAttribute("href");
      if (href.startsWith("#") && href.length > 1) { closeDrawer(); document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({ behavior: "smooth" }); }
    });
    return;
  }

  const cache = new Map();
  const load = (url) => {
    if (!cache.has(url)) cache.set(url, fetch(url).then((r) => (r.ok ? r.text() : Promise.reject())).catch((err) => { cache.delete(url); throw err; }));
    return cache.get(url);
  };
  const internal = (a) => {
    if (!a || a.target || a.hasAttribute("download") || location.protocol === "file:") return null;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname) return null;
    if (/\\/(files|media|fonts)\\//.test(url.pathname)) return null;
    return url;
  };
  async function go(url, push) {
    let html;
    try { html = await load(url.href.split("#")[0]); } catch { location.href = url.href; return; }
    const doc = new DOMParser().parseFromString(html, "text/html");
    const next = doc.querySelector(".layout__column");
    if (!next) { location.href = url.href; return; }
    // Względne adresy z innej strony (../media/…) trzeba przeliczyć względem nowego adresu.
    const fix = (root) => root.querySelectorAll("[href],[src],[style]").forEach((el) => {
      for (const at of ["href", "src"]) { const v = el.getAttribute(at); if (v && !/^(#|[a-z]+:|\\/)/i.test(v)) el.setAttribute(at, new URL(v, url.href).pathname); }
      const st = el.getAttribute("style"); if (st && st.includes("url(")) el.setAttribute("style", st.replace(/url\\((['"]?)(?![a-z]+:|\\/)([^'")]+)\\1\\)/gi, (m, q, p) => "url(" + q + new URL(p, url.href).pathname + q + ")"));
    });
    fix(next);
    document.querySelector(".layout__column").replaceWith(document.adoptNode(next));
    document.querySelector(".footer")?.remove();
    const footer = doc.querySelector(".footer");
    if (footer) { fix(footer); document.querySelector(".page").after(document.adoptNode(footer)); }
    const items = doc.querySelectorAll(".sidebar__item");
    document.querySelectorAll(".sidebar__item").forEach((el, i) => {
      const on = items[i]?.classList.contains("is--active");
      el.classList.toggle("is--active", !!on);
      on ? el.setAttribute("aria-current", "page") : el.removeAttribute("aria-current");
      if (items[i]) el.setAttribute("href", new URL(items[i].getAttribute("href"), url.href).pathname);
    });
    const logo = doc.querySelector(".sidebar__logo"); if (logo) document.querySelector(".sidebar__logo")?.setAttribute("href", new URL(logo.getAttribute("href"), url.href).pathname);
    if (doc.title) document.title = doc.title;
    if (push) history.pushState(null, "", url.href);
    const target = url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)));
    target ? target.scrollIntoView({ behavior: "instant" }) : window.scrollTo({ top: 0, behavior: "instant" });
  }
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const url = internal(e.target.closest("a[href]"));
    if (!url) return;
    e.preventDefault(); closeDrawer(); go(url, true);
  });
  document.addEventListener("pointerover", (e) => {
    const url = internal(e.target.closest?.("a[href]"));
    if (url) load(url.href.split("#")[0]).catch(() => {});
  });
  window.addEventListener("popstate", () => go(new URL(location.href), false));
})();
`;
