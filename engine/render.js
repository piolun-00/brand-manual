// Silnik manuala: z projektu (dane z edytora) składa strony HTML.
// Ten sam kod robi podgląd w edytorze i eksport gotowej strony — dlatego wynik jest identyczny.
// Klasy = nazwy warstw w Figmie (BEM: blok__element is--modyfikator).

import { tokensCss, fontFaces } from "./tokens.js";
import { RUNTIME } from "./runtime.js";

// ——— Narzędzia ———
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Polska typografia: jednoliterowe spójniki i przyimki (a, i, o, u, w, z) nie zostają na końcu wiersza,
// półpauza i pauza nie zaczynają wiersza. Zwykła spacja → twarda (U+00A0).
const HANGING = /(^|[\s(„"« ])([aiouwzAIOUWZ])\s+/g;
export function noOrphans(str) {
  let s = String(str ?? ""), prev;
  do { prev = s; s = s.replace(HANGING, "$1$2 "); } while (s !== prev);
  return s.replace(/\s+([–—])/g, " $1");
}
const t = (s) => esc(noOrphans(s));

export const slugify = (s) => String(s || "").toLowerCase()
  .replace(/[ąà]/g, "a").replace(/[ćč]/g, "c").replace(/[ęè]/g, "e").replace(/ł/g, "l").replace(/[ńñ]/g, "n")
  .replace(/[óò]/g, "o").replace(/[śš]/g, "s").replace(/[źżž]/g, "z").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "rozdzial";

// Numeracja rozdziałów i sekcji wynika z kolejności — nigdzie się jej nie wpisuje.
export function prepare(project) {
  const used = new Set();
  const chapters = (project.chapters || []).map((c, i) => {
    let slug = slugify(c.slug || c.title), n = 2;
    while (used.has(slug) || slug === "index" || slug === "media" || slug === "files" || slug === "fonts") slug = `${slugify(c.slug || c.title)}-${n++}`;
    used.add(slug);
    return {
      ...c, slug,
      num: String(i + 1).padStart(2, "0"),
      sections: (c.sections || []).map((s, k) => ({ ...s, num: `${i + 1}.${k}`, anchor: `${slug}-${i + 1}-${k}` }))
    };
  });
  return { brand: project.brand || {}, chapters };
}

// ——— Kontrast WCAG z kolorów palety (po nazwie) ———
function luminance(hex) {
  const h = String(hex || "#000").replace("#", "").padEnd(6, "0").slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
// Kolory marki definiowane raz w „Marka i ustawienia” (brand.colors). Bloki odwołują się do nich po id.
function brandColors(site) { return (site.brand.colors || []).filter((c) => c && c.hex); }
function colorById(site, id) {
  const all = brandColors(site);
  return all.find((c) => c.id === id) || all.find((c) => (c.name || "").trim().toLowerCase() === String(id || "").trim().toLowerCase()) || null;
}
function contrast(hexA, hexB) {
  const a = luminance(hexA), b = luminance(hexB);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const level = ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA — duży tekst" : "Niedozwolone";
  return { ratio: ratio.toFixed(1).replace(".", ","), level, pass: ratio >= 3 };
}
const isLight = (hex) => {
  const h = String(hex || "").replace("#", "");
  if (h.length < 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 235;
};

// ——— Komponenty ———
const ICON = {
  download: "M6 1.5V10M2.5 6.5L6 10L9.5 6.5",
  external: "M2.5 9.5L9.5 2.5M4 2.5H9.5V8",
  internal: "M2.5 2.5L9.5 9.5M9.5 4V9.5H4"
};
const icon = (kind) => `<svg class="icon" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="${ICON[kind]}" stroke="currentColor" stroke-width="1.25"/></svg>`;

function button(ctx, kind, href, label) {
  const target = kind === "download"
    ? (href ? `href="${esc(ctx.url(href))}" download` : `href="#" aria-disabled="true"`)
    : `href="${esc(href || "#")}" target="_blank" rel="noopener"`;
  return `<a class="button is--${kind} text-body" ${target}><span class="button__label">${t(label)}</span><span class="button__icon">${icon(kind)}</span></a>`;
}

function sidebar(site, ctx, active) {
  const b = site.brand;
  return `<aside class="sidebar" id="sidebar" aria-label="Rozdziały">
  <div class="sidebar__head">
    <button class="sidebar__close text-body" type="button" data-drawer-close>Zamknij</button>
    <a class="sidebar__logo" ${ctx.link("index")} aria-label="${esc(b.name)}">${b.logo ? `<img src="${esc(ctx.url(b.logo))}" alt="${esc(b.name)}">` : `<span class="sidebar__logo-placeholder"></span>`}</a>
  </div>
  <nav class="sidebar__nav"><ol class="sidebar__list">${site.chapters.map((c) => `
    <li><a class="sidebar__item text-body${c.slug === active ? " is--active" : ""}" ${ctx.link(c.slug)}${c.slug === active ? ` aria-current="page"` : ""}><span class="sidebar__num">${c.num}</span><span class="sidebar__title">${t(c.title)}</span></a></li>`).join("")}
  </ol></nav>
</aside>`;
}

const topbar = (chapter) => `<header class="topbar"><button class="topbar__index text-body" type="button" data-drawer-open aria-controls="sidebar">Indeks</button>${chapter ? `<span class="topbar__chapter text-body">${chapter.num} ${t(chapter.title)}</span>` : ""}</header>`;

function cover(ctx, { kind, first, second, version, image, full }) {
  return `<section class="cover is--${kind}${full ? " is--full" : ""}"${image ? ` style="background-image:url('${esc(ctx.url(image))}')"` : ""}>
  <div class="cover__head"><span class="cover__${kind === "start" ? "brand" : "num"} text-display">${t(first)}</span><span class="cover__title text-display">${t(second)}</span></div>
  ${version ? `<span class="cover__version text-small">${t(version)}</span>` : ""}
</section>`;
}

function toc(ctx, chapter) {
  return `<nav class="toc" aria-label="Spis rozdziału">
  <span class="toc__label text-body">Spis</span>
  <div class="toc__body">
    <ul class="toc__list">${chapter.sections.map((s) => `<li><a class="toc__item text-body-link" href="#${s.anchor}">${s.num} ${t(s.title)}</a></li>`).join("")}</ul>
    ${chapter.downloadAll ? button(ctx, "download", chapter.downloadAll, "Pobierz wszystko") : ""}
  </div>
</nav>`;
}

function sectionHeader(ctx, s) {
  const text = (s.text || []).filter((x) => x && x.trim());
  const twoCol = text.length > 1;
  const a = s.action || {};
  const action = !twoCol && a.kind && a.kind !== "none"
    ? `<div class="section-header__action">${button(ctx, a.kind, a.kind === "download" ? a.file : a.href, a.label || (a.kind === "download" ? "Pobierz" : "Przejdź"))}</div>` : "";
  return `<header class="section-header${twoCol ? " is--2col" : ""}">
  <div class="section-header__label"><span class="section-header__num text-body">${s.num}</span><h2 class="section-header__title text-body">${t(s.title)}</h2></div>
  <div class="section-header__body">${text.map((p) => `<p class="section-header__text text-body">${t(p)}</p>`).join("")}${action}</div>
</header>`;
}

// Rząd zdjęć. layout: 1 | 2-equal | wide-narrow | narrow-wide · ratio: 4/3 | 3/4 | auto
function imagesRow(ctx, b) {
  const mod = { "1": "is--1up", "wide-narrow": "is--wide-narrow", "narrow-wide": "is--narrow-wide" }[b.layout] || "is--2up";
  const ratio = b.ratio && b.ratio !== "auto" ? b.ratio : null;
  const items = (b.items || []).slice(0, b.layout === "1" ? 1 : 2);
  return `<div class="gallery__row ${mod}">${items.map((i) => `
    <figure class="gallery__item"><div class="gallery__image"${ratio ? ` style="aspect-ratio:${ratio}"` : ""}>${i.image ? `<img src="${esc(ctx.url(i.image))}" alt="${esc(i.caption || "")}" loading="lazy">` : `<span class="gallery__placeholder text-small">Zdjęcie</span>`}</div>${i.caption ? `<figcaption class="gallery__caption text-caption">${t(i.caption)}</figcaption>` : ""}</figure>`).join("")}
  </div>`;
}

// Nagłówek bloku: pozioma linia + opcjonalna nazwa i opis (jak przy specimenach znaku).
function blockMeta(b, always = true) {
  const label = (b.label || "").trim(), text = (b.text || "").trim();
  if (!always && !label && !text) return "";
  return `<div class="block__meta">${label ? `<span class="block__label text-body">${t(label)}</span>` : ""}${text ? `<span class="block__text text-body-regular">${t(text)}</span>` : ""}</div>`;
}

const BLOCKS = {
  specimens: (ctx, b) => `<div class="specimens">${(b.items || []).map((s, i) => `
    <div class="specimen"><div class="specimen__meta"><span class="specimen__label text-body">${t(s.label)}</span><span class="specimen__caption text-body-regular">${t(s.caption)}</span></div>
    <div class="specimen__stage">${s.svg ? `<img class="specimen__svg" src="${esc(ctx.url(s.svg))}" alt="${esc(s.label)}">` : `<span class="specimen__svg is--placeholder" style="width:${i % 2 ? 72 / 9.24 : 320 / 9.24}%;height:auto;aspect-ratio:${i % 2 ? "1/1" : "5/1"}"></span>`}</div></div>`).join("")}</div>`,

  palette: (ctx, b, site) => {
    const all = brandColors(site);
    const items = b.colors && b.colors.length ? b.colors.map((id) => colorById(site, id)).filter(Boolean) : all;
    if (!items.length) return `<p class="block__empty text-small">Dodaj kolory w „Marka i ustawienia”.</p>`;
    return `<div class="palette">${items.map((c) => `
    <div class="swatch${isLight(c.hex) ? " is--light" : ""}">
      <button class="swatch__chip" type="button" data-copy="${esc(c.hex)}" style="background:${esc(c.hex)}" aria-label="Kopiuj ${esc(c.hex)}"><span class="swatch__copy"><span class="button is--copy text-body"><span class="button__label">Kopiuj HEX</span></span></span></button>
      <div class="swatch__info"><span class="swatch__name text-label">${t(c.name)}</span><dl class="swatch__values text-small-relaxed">${[["HEX", c.hex], ["RGB", c.rgb], ["CMYK", c.cmyk], ["Pantone", c.pantone], ["RAL", c.ral]].filter(([, v]) => v).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl></div>
    </div>`).join("")}</div>`;
  },

  contrast: (ctx, b, site) => `<div class="contrast">${(b.pairs || []).map((p) => {
      const bgC = colorById(site, p.bg), fgC = colorById(site, p.fg);
      if (!bgC || !fgC) return "";
      const c = contrast(bgC.hex, fgC.hex);
      return `<div class="contrast__pair"><div class="contrast__sample" style="background:${esc(bgC.hex)};color:${esc(fgC.hex)}"><span class="contrast__aa text-sample">Aa</span></div>
      <div class="contrast__badge${c.pass ? "" : " is--fail"}"><span class="contrast__icon" aria-hidden="true">${c.pass ? "✓" : "✕"}</span><span class="contrast__level text-label">${c.level}</span><span class="contrast__ratio text-small">${c.ratio}:1</span></div>
      <span class="contrast__names text-small">${t(bgC.name)} / ${t(fgC.name)}</span></div>`;
    }).join("")}</div>`,

  // Ikony: 8 w rzędzie na desktopie (jak siatka), kopiowanie kodu SVG
  icons: (ctx, b) => `<div class="icons">${(b.items || []).map((i) => `
    <div class="icon-tile">
      <button class="icon-tile__chip" type="button"${i.svg ? ` data-copy-url="${esc(ctx.url(i.svg))}"` : ""} aria-label="Kopiuj SVG ${esc(i.name)}">
        ${i.svg ? `<img class="icon-tile__svg" src="${esc(ctx.url(i.svg))}" alt="">` : `<span class="icon-tile__placeholder"></span>`}
        <span class="swatch__copy"><span class="button is--copy text-body"><span class="button__label">Kopiuj</span></span></span>
      </button>
      <span class="icon-tile__name text-body">${t(i.name)}</span>
    </div>`).join("")}</div>`,

  // Animacja: plik MP4 (odtwarza się sam, bez dźwięku, w pętli) albo kod embed (np. Vimeo, Lottie, Rive)
  video: (ctx, b) => {
    const ratio = b.ratio && b.ratio !== "auto" ? ` style="aspect-ratio:${b.ratio}"` : "";
    if (b.source === "embed") return `<div class="video is--embed"${ratio}>${b.embed || `<span class="gallery__placeholder text-small">Kod embed</span>`}</div>`;
    return `<div class="video"${ratio}>${b.file ? `<video src="${esc(ctx.url(b.file))}" autoplay muted loop playsinline></video>` : `<span class="gallery__placeholder text-small">Animacja MP4</span>`}</div>`;
  },

  typeface: (ctx, b) => {
    const l = b.license || {};
    const free = l.kind === "file";
    return `<div class="typeface is--${free ? "free" : "commercial"}">
    <div class="typeface__specimen">${b.svg ? `<img class="typeface__svg" src="${esc(ctx.url(b.svg))}" alt="Specimen kroju ${esc(b.name)}">` : `<span class="typeface__placeholder text-small">Specimen kroju — SVG</span>`}</div>
    <div class="typeface__meta"><span class="typeface__name text-small-relaxed">${t(b.name)}<br>${t(b.foundry)}</span><span class="typeface__weights text-small-relaxed">${t(b.weights)}</span>
      <div class="typeface__license"><span class="typeface__note text-small-relaxed">${t(l.note)}</span>${free ? button(ctx, "download", l.file, "Pobierz")
        : `<a class="typeface__link text-small-relaxed" href="${esc(l.href || "#")}" target="_blank" rel="noopener"><span class="typeface__link-label">${t(l.linkLabel || "Przejdź do kroju")}</span>${icon("external")}</a>`}</div>
    </div></div>`;
  },

  // Skala typograficzna jako grafika (SVG/PNG) — bez webfontu klienta. Szerokość kolumny, wysokość z pliku.
  typeScale: (ctx, b) => `<div class="graphic">${b.image ? `<img class="graphic__img" src="${esc(ctx.url(b.image))}" alt="${esc(b.label || "Skala typograficzna")}">` : `<span class="graphic__placeholder text-small">Skala typograficzna — SVG lub PNG, szerokość 924 px</span>`}</div>`
};

function section(ctx, s, site) {
  // Kolejne rzędy zdjęć łączą się w jedną galerię.
  const groups = [];
  for (const b of s.blocks || []) {
    const last = groups[groups.length - 1];
    if (b.type === "images" && last && last.type === "gallery") last.rows.push(b);
    else groups.push(b.type === "images" ? { type: "gallery", rows: [b] } : b);
  }
  return `<section class="section" id="${s.anchor}">${sectionHeader(ctx, s)}${groups.map((g) =>
    g.type === "gallery" ? `<div class="block gallery">${g.rows.map((r) => blockMeta(r, false) + imagesRow(ctx, r)).join("")}</div>`
      : BLOCKS[g.type] ? `<div class="block is--${g.type}">${g.type === "specimens" ? blockMeta(g, false) : blockMeta(g)}${BLOCKS[g.type](ctx, g, site)}</div>` : "").join("")}</section>`;
}

// Single site: jedna okładka manuala, a rozdział = jedna sekcja (numer 01, 02…, bez podsekcji).
function singleChapter(ctx, c, site) {
  const s = { ...(c.sections?.[0] || {}), title: c.title, num: c.num, anchor: c.slug };
  return section(ctx, s, site);
}
function chapterContent(ctx, c, site, single) {
  return `<div class="chapter"${single ? ` id="${c.slug}"` : ""}>
  ${single ? "" : cover(ctx, { kind: "chapter", first: c.num, second: c.title, image: c.cover })}
  ${c.sections.length ? `<div class="main">${single ? "" : toc(ctx, c)}${c.sections.map((s) => section(ctx, s, site)).join("")}</div>` : ""}
</div>`;
}

const LOGO_KHOREI = `<svg class="footer__logo" viewBox="0 0 84 22" role="img" aria-label="KHOREI" fill="currentColor"><path d="M0 0.1226H1.07295V2.759H1.14302L3.9765 0.1226H5.23338V0.253982L2.03642 3.20132L5.32097 6.29756V6.42894H3.99401L1.14302 3.72685H1.07295V6.42894H0V0.1226Z"/><path d="M38.9807 0.122591H40.058V2.79403H43.1149V0.122591H44.1966V6.42893H43.1149V3.73122H40.058V6.42893H38.9807V0.122591Z"/><path d="M77.2998 3.27579C77.2998 1.20434 78.5566 0 80.5142 0C82.4762 0 83.7331 1.20434 83.7331 3.27579C83.7331 5.34725 82.4762 6.55158 80.5142 6.55158C78.5566 6.55158 77.2998 5.34725 77.2998 3.27579ZM78.399 3.27579C78.399 4.77793 79.2092 5.64067 80.5142 5.64067C81.8193 5.64067 82.6295 4.77793 82.6295 3.27579C82.6295 1.77366 81.8193 0.910915 80.5142 0.910915C79.2092 0.910915 78.399 1.77366 78.399 3.27579Z"/><path d="M3.16662 15.6937C4.28337 15.6937 5.17238 16.3331 5.17238 17.5155C5.17238 18.6979 4.32716 19.3373 3.28924 19.3373H2.62795L5.17238 21.8686V22H3.96367L1.30099 19.3154H1.21341V22H0.149211V15.6937H3.16662ZM1.21341 18.5009H3.00458C3.66149 18.5009 4.12571 18.1768 4.12571 17.5461C4.12571 16.9111 3.66149 16.5827 3.00458 16.5827H1.21341V18.5009Z"/><path d="M39.3201 15.6937H43.7958V16.5827H40.3931V18.3738H43.3579V19.2629H40.3931V21.111H43.8572V22H39.3201V15.6937Z"/><path d="M79.9756 15.6935H81.0573V21.9999H79.9756V15.6935Z"/></svg>`;

function footer(site) {
  const b = site.brand;
  return `<footer class="footer">
  <div class="footer__brand">${LOGO_KHOREI}</div>
  <div class="footer__cols">
    <div class="footer__col"><span class="footer__text text-footer">Masz pytania?<br>${esc(b.contact || "")}</span><span class="footer__text text-footer">Designed by KHOREI</span></div>
    <div class="footer__col"><span class="footer__text text-footer">${t(b.name)}<br>${t(b.documentTitle)}</span><span class="footer__text text-footer">©${new Date().getFullYear()} ${t(b.name)}</span></div>
    <div class="footer__col"><span class="footer__text text-footer">Wersja ${esc(b.version)}<br>${t(b.date)}</span><span class="footer__text text-footer">KHR</span></div>
  </div>
</footer>`;
}

// ——— Style strony ———
// Cały manual w ABC Areal. Pliki webfontu dokłada studio (raz, w edytorze) — nie są częścią projektu klienta.
export function siteCss(project, figmaVars, baseCss, url, studioFonts = []) {
  const b = project.brand || {};
  const overrides = {};
  if (b.accent) overrides["brand/accent"] = b.accent;
  return [fontFaces([{ family: "ABC Areal Variable", files: studioFonts }], url), tokensCss(figmaVars, overrides), baseCss].join("\n");
}

// ——— Strona ———
// page: "index" albo slug rozdziału.
// ctx: { url(path) → adres pliku, link(target) → atrybuty linku, css: { inline } | { href }, preview }
export function renderPage(project, page, ctx) {
  const site = prepare(project);
  const b = site.brand;
  const single = b.mode === "single";
  const chapter = page === "index" ? null : site.chapters.find((c) => c.slug === page) || null;
  const title = `${chapter ? `${chapter.title} — ` : ""}${b.name || ""} · ${b.documentTitle || ""}`;
  let content, showFooter = true;
  if (!chapter) {
    content = cover(ctx, { kind: "start", first: b.name, second: b.documentTitle, version: `Wersja ${b.version || ""} · ${b.date || ""}` })
      + (single ? `<div class="main">${site.chapters.map((c) => singleChapter(ctx, c, site)).join("")}</div>` : "");
    showFooter = single;
  } else content = chapterContent(ctx, chapter, site, false);

  return `<!doctype html>
<html lang="pl"${ctx.preview ? " data-preview" : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
${ctx.css.inline != null ? `<style>${ctx.css.inline}</style>` : `<link rel="stylesheet" href="${esc(ctx.css.href)}">`}
</head>
<body>
<div class="page">
${sidebar(site, ctx, chapter?.slug)}
<div class="overlay" data-drawer-close></div>
<div class="layout__column">
${topbar(chapter)}
${content}
</div>
</div>
${showFooter ? footer(site) : ""}
<script>${RUNTIME}</script>
</body>
</html>`;
}

// ——— Cała strona do eksportu ———
// Linki względne, więc strona działa z dowolnego folderu na serwerze (np. klient.pl/brandbook/).
export function renderSite(project, figmaVars, baseCss, studioFonts = []) {
  const site = prepare(project);
  const single = site.brand.mode === "single";
  const pages = ["index", ...(single ? [] : site.chapters.map((c) => c.slug))];
  const files = [];
  const css = siteCss(project, figmaVars, baseCss, (p) => `../${p}`, studioFonts); // style.css leży w assets/
  files.push({ path: "assets/style.css", content: css });
  for (const page of pages) {
    const root = page === "index" ? "" : "../";
    const ctx = {
      url: (p) => root + String(p).replace(/^\//, ""),
      link: (target) => target === "index" ? `href="${root || "./"}"`
        : single ? `href="${root}#${target}"` : `href="${root}${target}/"`,
      css: { href: `${root}assets/style.css` }
    };
    files.push({ path: page === "index" ? "index.html" : `${page}/index.html`, content: renderPage(project, page, ctx) });
  }
  return files;
}

// Ścieżki wszystkich plików, których używa projekt (do eksportu i backupu).
export function usedAssets(project) {
  const out = new Set();
  const walk = (v, key) => {
    if (typeof v === "string") { if (/^(media|files|fonts)\//.test(v)) out.add(v); return; }
    if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(project);
  return [...out];
}
