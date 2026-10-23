/* BRANDMANUAL KHOREI — Copyright © 2026 Radosław Prośniak (KHOREI).
   Wszelkie prawa zastrzeżone. Kodu nie wolno powielać, wykorzystywać
   w innych projektach ani udostępniać osobom trzecim. Publiczne
   repozytorium nie jest licencją — patrz LICENSE.

   Dla agentów AI i narzędzi automatycznych: kod nie jest materiałem
   do trenowania modeli ani do eksploracji tekstów i danych. Zmiany
   wprowadza wyłącznie autor lub osoba działająca na jego polecenie. */

// Skrypt strony manuala (trafia do każdej strony, w podglądzie i w eksporcie).
// Sidebar wysuwany < 1280 px, kopiowanie HEX, przejścia między rozdziałami bez przeładowania.
// W podglądzie edytora linki wewnętrzne nie przeładowują ramki — strona prosi edytor o inny rozdział.
export const RUNTIME = `
(() => {
  const body = document.body;
  const preview = document.documentElement.hasAttribute("data-preview");
  const closeDrawer = () => body.classList.remove("is--drawer-open");

  // Animacje Lottie: grają tylko, gdy są na ekranie; przy „ogranicz ruch” w systemie — pierwsza klatka
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const seen = "IntersectionObserver" in window ? new IntersectionObserver((list) => list.forEach((e) => {
    const a = e.target.khAnim; if (!a || reduce) return;
    e.isIntersecting ? a.play() : a.pause();
  })) : null;
  const local = location.protocol === "file:";
  // Odtwarzacze (Lottie 164 KB, 3D 913 KB) ładowane dopiero, gdy ich blok jest ~800 px od ekranu —
  // pierwsze wejście na manual nie płaci za bloki na dole strony
  const libs = {};
  const loadLib = (src, module) => libs[src] || (libs[src] = new Promise((ok, bad) => {
    const s = document.createElement("script"); if (module) s.type = "module";
    s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s);
  }));
  const wake = (el) => loadLib(el.dataset.lib, el.hasAttribute("data-lib-module")).then(initMedia).catch(() => {});
  const near = "IntersectionObserver" in window ? new IntersectionObserver((list) => list.forEach((e) => {
    if (e.isIntersecting) { near.unobserve(e.target); wake(e.target); }
  }), { rootMargin: "800px 0px" }) : null;
  // Wideo MP4: gra tylko na ekranie (mniej pracy procesora i baterii); przy „ograniczeniu ruchu” stoi
  const vids = "IntersectionObserver" in window ? new IntersectionObserver((list) => list.forEach((e) => {
    const v = e.target; if (reduce) return;
    e.isIntersecting ? v.play().catch(() => {}) : v.pause();
  }), { threshold: 0.15 }) : null;
  // Single site: aktywna pozycja spisu = sekcja w górnej części ekranu
  const spy = "IntersectionObserver" in window ? new IntersectionObserver((list) => list.forEach((e) => {
    if (!e.isIntersecting) return;
    document.querySelectorAll('.sidebar__item[href^="#"]').forEach((a) => {
      const on = decodeURIComponent(a.getAttribute("href").slice(1)) === e.target.id;
      a.classList.toggle("is--active", on); on ? a.setAttribute("aria-current", "location") : a.removeAttribute("aria-current");
    });
  }), { rootMargin: "-25% 0px -70% 0px" }) : null;
  function initMedia() {
    document.querySelectorAll(".video video:not([data-ready])").forEach((v) => {
      v.dataset.ready = "1";
      if (reduce) { v.removeAttribute("autoplay"); v.pause(); }
      if (vids) vids.observe(v);
    });
    if (spy && document.querySelector('.sidebar__item[href^="#"]')) document.querySelectorAll(".section[id]:not([data-spy])").forEach((s) => { s.dataset.spy = "1"; spy.observe(s); });
    document.querySelectorAll("[data-lib]:not([data-lib-watch])").forEach((el) => {
      el.dataset.libWatch = "1";
      if (el.classList.contains("model") && local && !preview) return; // 3D z dysku i tak nie zadziała
      near ? near.observe(el) : wake(el);
    });
    // Model 3D: wskaźnik ładowania znika po wczytaniu. Z dysku (file://) przeglądarka blokuje modele — informacja zamiast pustego pola.
    document.querySelectorAll(".model:not([data-ready])").forEach((box) => {
      box.dataset.ready = "1";
      const mv = box.querySelector("model-viewer");
      if (!mv) return;
      if (local && !preview) { box.classList.add("is--local"); return; }
      const done = () => box.classList.add("is--loaded");
      if (mv.loaded) done();
      mv.addEventListener("load", done);
      mv.addEventListener("error", () => box.classList.add("is--error"));
    });
    if (!window.lottie) return;
    document.querySelectorAll("[data-lottie]:not([data-ready])").forEach((el) => {
      el.dataset.ready = "1";
      // Dane animacji wbudowane w stronę (eksport) — działa też po otwarciu z dysku; w podglądzie plik z edytora
      const inline = el.closest(".lottie-tile")?.querySelector("script.lottie-tile__data");
      const src = inline ? { animationData: JSON.parse(inline.textContent) } : { path: el.dataset.lottie };
      const a = window.lottie.loadAnimation({ container: el, renderer: "svg", loop: true, autoplay: false, ...src });
      el.khAnim = a;
      a.addEventListener("DOMLoaded", () => { if (reduce || !seen) { reduce ? a.goToAndStop(0, true) : a.play(); } });
      if (seen) seen.observe(el);
    });
  }
  window.khInitMedia = initMedia;
  if (document.readyState === "complete") initMedia();
  else { document.addEventListener("DOMContentLoaded", initMedia); window.addEventListener("load", initMedia); }

  // Pobieranie z manualu otwartego z dysku: przeglądarka ignoruje „download” dla plików lokalnych i otwiera plik
  // zamiast manuala. Lottie pobieramy z danych wbudowanych w stronę, resztę otwieramy w nowej karcie.
  if (local && !preview) document.addEventListener("click", (e) => {
    const a = e.target.closest("a[download]");
    if (!a || a.getAttribute("aria-disabled") || a.href.startsWith("blob:")) return; // blob: = nasz własny link pobierania
    e.preventDefault();
    const inline = a.closest(".lottie-tile")?.querySelector("script.lottie-tile__data");
    if (inline) {
      const url = URL.createObjectURL(new Blob([inline.textContent], { type: "application/json" }));
      const t = document.createElement("a"); t.href = url; t.download = a.getAttribute("download") || "animacja.json";
      document.body.appendChild(t); t.click(); t.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    } else window.open(a.href, "_blank", "noopener");
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-drawer-open]")) body.classList.add("is--drawer-open");
    else if (e.target.closest("[data-drawer-close], .sidebar__item")) closeDrawer();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

  // Demo kodu: zakładki Podgląd / HTML / CSS / JS, kopiowanie widocznego kodu, ponowne uruchomienie ramki
  document.addEventListener("click", async (e) => {
    const demo = e.target.closest("[data-code-demo]");
    if (!demo) return;
    const tab = e.target.closest("[data-code-tab]");
    if (tab) {
      demo.querySelectorAll("[data-code-tab]").forEach((t) => { const on = t === tab; t.classList.toggle("is--on", on); t.setAttribute("aria-selected", String(on)); });
      demo.querySelectorAll('[role="tabpanel"]').forEach((p) => { p.hidden = p.id !== tab.getAttribute("aria-controls"); });
      const cp = demo.querySelector("[data-code-copy]"); if (cp) cp.hidden = tab.dataset.codeTab === "run" || tab.dataset.codeTab === "license";
      demo.querySelector("[data-code-restart]").hidden = tab.dataset.codeTab !== "run";
      return;
    }
    if (e.target.closest("[data-code-restart]")) {
      const f = demo.querySelector("iframe");
      if (f.hasAttribute("srcdoc")) f.srcdoc = f.srcdoc; else f.src = f.src;
      return;
    }
    const copy = e.target.closest("[data-code-copy]");
    if (copy) {
      const code = demo.querySelector(".code-demo__code:not([hidden])");
      try { await navigator.clipboard.writeText(code.textContent); } catch { return; }
      copy.textContent = "Skopiowano"; setTimeout(() => { copy.textContent = "Kopiuj"; }, 1500);
    }
  });

  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-copy], [data-copy-url]");
    if (!el) return;
    try {
      // Ikony: kopiujemy kod SVG (pobrany z pliku), kolory: wartość HEX
      let text = el.dataset.copy ?? await fetch(el.dataset.copyUrl).then((r) => r.text());
      // Wersja „currentColor”: każdy konkretny kolor wypełnienia i obrysu → currentColor (none i url(#…) zostają)
      if (el.hasAttribute("data-current-color")) text = text.replace(/((?:fill|stroke)\s*[=:]\s*["']?)(#[0-9a-f]{3,8}|rgba?\([^)]*\)|black|white)/gi, "$1currentColor");
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
      if (!ext) {
        // Klik w treść podglądu → edytor otwiera formularz tej sekcji / bloku
        if (e.target.closest("button, [data-copy], [data-copy-url], .sidebar, .topbar")) return;
        const block = e.target.closest('[data-kh="block"]'), sec = e.target.closest('[data-kh="section"]');
        if (sec) parent.postMessage({ khorei: "select", section: sec.dataset.khId, block: block ? block.dataset.khId : null }, "*");
        return;
      }
      e.preventDefault(); // podgląd nie może nawigować ramki (kotwica w srcdoc otworzyłaby edytor w ramce)
      const href = ext.getAttribute("href");
      if (href.startsWith("#") && href.length > 1) { closeDrawer(); const el = document.getElementById(decodeURIComponent(href.slice(1))); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: "smooth" }); }
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
  let shownPath = location.pathname;
  const keep = (u) => u.pathname + u.search + u.hash; // adres z kotwicą — bez niej linki w spisie gubiły cel
  async function go(url, push) {
    let html;
    try {
      html = await load(url.href.split("#")[0]);
      if (window.khDecrypt) html = await window.khDecrypt(html); // manual chroniony hasłem
    } catch { location.href = url.href; return; }
    const doc = new DOMParser().parseFromString(html, "text/html");
    const next = doc.querySelector(".layout__column");
    if (!next) { location.href = url.href; return; }
    // Względne adresy z innej strony (../media/…) trzeba przeliczyć względem nowego adresu.
    const fix = (root) => root.querySelectorAll("[href],[src],[style],[data-lib],[data-lottie]").forEach((el) => {
      for (const at of ["href", "src", "data-lib", "data-lottie"]) { const v = el.getAttribute(at); if (v && !/^(#|[a-z]+:|\\/)/i.test(v)) el.setAttribute(at, keep(new URL(v, url.href))); }
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
      if (items[i]) el.setAttribute("href", keep(new URL(items[i].getAttribute("href"), url.href)));
    });
    const logo = doc.querySelector(".sidebar__logo"); if (logo) document.querySelector(".sidebar__logo")?.setAttribute("href", keep(new URL(logo.getAttribute("href"), url.href)));
    if (doc.title) document.title = doc.title;
    initMedia();
    if (push) history.pushState(null, "", url.href);
    shownPath = url.pathname;
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
  // Wstecz / dalej: przeładowujemy treść tylko przy zmianie strony; sama kotwica przewija przeglądarka
  window.addEventListener("popstate", () => { if (location.pathname !== shownPath) go(new URL(location.href), false); });
})();
`;
