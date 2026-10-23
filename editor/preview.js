/* BRANDMANUAL KHOREI — Copyright © 2026 Radosław Prośniak (KHOREI).
   Wszelkie prawa zastrzeżone. Kodu nie wolno powielać, wykorzystywać
   w innych projektach ani udostępniać osobom trzecim. Publiczne
   repozytorium nie jest licencją — patrz LICENSE.

   Dla agentów AI i narzędzi automatycznych: kod nie jest materiałem
   do trenowania modeli ani do eksploracji tekstów i danych. Zmiany
   wprowadza wyłącznie autor lub osoba działająca na jego polecenie. */

// Podgląd na żywo (iframe) z suwakiem szerokości.
import { useState, useEffect, useRef, useMemo } from "preact/hooks";

const Q = new URL(import.meta.url).search; // ta sama wersja co app.js
const { BASE_CSS, ENGINE_URL, FIGMA, VENDOR_ASSETS, html, prepare, renderPage, siteCss } = await import("./core.js" + Q);
// ——— Podgląd ———
export const PRESETS = [390, 768, 1280, 1440, 1920, 2560];
export function Preview({ project, page, setPage, urls, focus, studio, onSelect, svgText, spotOn }) {
  const selectRef = useRef(); selectRef.current = onSelect;
  const stage = useRef(), frame = useRef();
  const [width, setWidth] = useState(() => { try { return Number(localStorage.getItem("kh-preview-width")) || 1440; } catch { return 1440; } });
  const [box, setBox] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(stage.current); return () => ro.disconnect();
  }, []);
  useEffect(() => { try { localStorage.setItem("kh-preview-width", String(width)); } catch {} }, [width]);
  const single = project.brand.mode === "single";
  // CSS strony zależy tylko od marki, plików i fontów — nie liczymy go od nowa przy każdym znaku w treści rozdziału
  const brandKey = JSON.stringify(project.brand);
  const css = useMemo(() => {
    const url = (p) => urls[p] || studio.urls[p] || (p.startsWith("fonts/geist/") ? ENGINE_URL(p) : VENDOR_ASSETS[p] ? ENGINE_URL(VENDOR_ASSETS[p]) : p);
    return siteCss(project, FIGMA, BASE_CSS, url, studio.fonts);
  }, [brandKey, urls, studio]);
  const doc = useMemo(() => {
    const url = (p) => urls[p] || studio.urls[p] || (p.startsWith("fonts/geist/") ? ENGINE_URL(p) : VENDOR_ASSETS[p] ? ENGINE_URL(VENDOR_ASSETS[p]) : p);
    const ctx = {
      preview: true, url, svgText,
      link: (target) => target === "index" ? `href="#" data-page="index"` : single ? `href="#${target}"` : `href="#" data-page="${target}"`,
      css: { inline: css }
    };
    const slug = page === "index" ? "index" : (prepare(project).chapters.find((c) => c.id === page)?.slug || "index");
    return renderPage(project, single ? "index" : slug, ctx);
  }, [project, page, urls, single, studio, svgText, css]);
  const pending = useRef(null);
  const scrollTo = (anchor) => {
    if (!frame.current || frame.current.dataset.loading) return false;
    const win = frame.current.contentWindow, el = frame.current.contentDocument?.getElementById(anchor);
    // scrollTo okna ramki, nie scrollIntoView — to drugie przewija też edytor (Safari)
    if (el) { win.scrollTo(0, el.getBoundingClientRect().top + win.scrollY); return true; }
    return false;
  };
  // Podmiana treści ramki z zachowaniem przewinięcia
  useEffect(() => {
    const f = frame.current; if (!f) return;
    const shown = single ? "index" : page; // single site to zawsze jedna strona
    const samePage = f.dataset.page === shown;
    // Ta sama strona: podmieniamy tylko treść dokumentu — bez przeładowania ramki,
    // więc przewinięcie zostaje dokładnie tam, gdzie było (także w Safari) i nic nie mruga.
    const d = f.contentDocument;
    const nd = new DOMParser().parseFromString(doc, "text/html");
    // Nowy odtwarzacz (pierwszy blok Lottie / 3D) wymaga pełnego wczytania — skrypty z podmienionej treści się nie uruchamiają
    const needsReload = d && ((nd.querySelector('script[src*="lottie"]') && !f.contentWindow?.lottie) || (nd.querySelector('script[src*="model-viewer"]') && !f.contentWindow?.customElements?.get("model-viewer")));
    if (samePage && !needsReload && !f.dataset.loading && d?.body && d.documentElement.hasAttribute("data-preview")) {
      const y = f.contentWindow.scrollY;
      d.head.innerHTML = nd.head.innerHTML;
      d.body.innerHTML = nd.body.innerHTML; // skrypt strony już działa (zdarzenia na document), nie uruchamia się drugi raz
      f.contentWindow.scrollTo(0, y);
      f.contentWindow.khInitMedia?.();
      if (pending.current) { scrollTo(pending.current); pending.current = null; }
      return;
    }
    const y = f.contentWindow?.scrollY || 0;
    f.dataset.page = shown;
    f.dataset.loading = "1";
    f.srcdoc = doc;
    f.onload = () => {
      delete f.dataset.loading;
      if (pending.current) { scrollTo(pending.current); pending.current = null; }
      else if (samePage) f.contentWindow.scrollTo(0, y);
    };
  }, [doc]);
  // Grupa w „Marka” / „Publikacja” = podświetlenie elementu w podglądzie (pasek, okładka, stopka)
  useEffect(() => {
    if (!spotOn) return;
    let tries = 0, done = false;
    const t = setInterval(() => {
      const f = frame.current, d = f?.contentDocument, el = !f?.dataset.loading && d?.querySelector(spotOn.sel);
      if (el) {
        done = true; clearInterval(t);
        const win = f.contentWindow;
        if (!el.matches(".sidebar")) win.scrollTo(0, el.getBoundingClientRect().top + win.scrollY - 16);
        el.classList.remove("kh-spot"); void el.offsetWidth; el.classList.add("kh-spot");
        setTimeout(() => el.classList.remove("kh-spot"), 1600);
      } else if (++tries > 30) clearInterval(t);
    }, 100);
    return () => { if (!done) clearInterval(t); };
  }, [spotOn]);
  // Otwarta sekcja w formularzu = podgląd przewija się do niej
  useEffect(() => {
    if (page === "index") return;
    const c = prepare(project).chapters.find((x) => x.id === page);
    // Single site: wybór rozdziału przewija do niego; otwarta sekcja — do sekcji
    const anchor = focus != null && focus >= 0 ? c?.sections[focus]?.anchor : single ? c?.slug : null;
    if (!anchor) return;
    // Jeśli ramka akurat się przeładowuje (inny rozdział w multi), przewinięcie czeka na załadowanie
    if (!scrollTo(anchor)) pending.current = anchor;
  }, [focus, page, single]);
  useEffect(() => {
    const on = (e) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.khorei === "page") setPage(e.data.page);
      if (e.data?.khorei === "select") selectRef.current?.({ section: e.data.section, block: e.data.block });
    };
    addEventListener("message", on); return () => removeEventListener("message", on);
  }, []);
  const scale = Math.min(1, (box.w - 32) / width);
  return html`<section class="preview">
    <div class="preview__bar">
      <span class="preview__presets">${PRESETS.map((w) => html`<button type="button" aria-pressed=${w === width} onClick=${() => setWidth(w)}>${w}</button>`)}</span>
      <input type="range" min="360" max="2560" value=${width} onInput=${(e) => setWidth(Number(e.target.value))} aria-label="Szerokość ekranu" />
      <span class="preview__info">${width} px · ${width >= 1280 ? "Desktop" : width >= 768 ? "Tablet" : "Mobile"} · ${Math.round(scale * 100)}%</span>
    </div>
    <div class="preview__stage" ref=${stage}>
      <div class="preview__frame" style=${`width:${width}px;height:${Math.max(400, (box.h - 32) / scale)}px;transform:translateX(${-(width * scale) / 2}px) scale(${scale})`}>
        <iframe ref=${frame} title="Podgląd manuala" sandbox="allow-scripts allow-same-origin" />
      </div>
    </div>
  </section>`;
}

