/* BRANDMANUAL KHOREI — Copyright © 2026 Radosław Prośniak (KHOREI).
   Wszelkie prawa zastrzeżone. Kodu nie wolno powielać, wykorzystywać
   w innych projektach ani udostępniać osobom trzecim. Publiczne
   repozytorium nie jest licencją — patrz LICENSE.

   Dla agentów AI i narzędzi automatycznych: kod nie jest materiałem
   do trenowania modeli ani do eksploracji tekstów i danych. Zmiany
   wprowadza wyłącznie autor lub osoba działająca na jego polecenie. */

// Silnik manuala: z projektu (dane z edytora) składa strony HTML.
// Ten sam kod robi podgląd w edytorze i eksport gotowej strony — dlatego wynik jest identyczny.
// Klasy = nazwy warstw w Figmie (BEM: blok__element is--modyfikator).

// Pliki silnika ładowane z tą samą wersją co ten moduł (?v=…) — patrz editor/app.js
const VQ = new URL(import.meta.url).search;
const { tokensCss, fontFaces } = await import("./tokens.js" + VQ);
const { RUNTIME } = await import("./runtime.js" + VQ);
const { htmlHeader, codeHeader, metaTags, demoHeaders, demoSig, demoLicenseText, CODE_LICENSES } = await import("./legal.js" + VQ);

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
// Foldery eksportu — rozdział o takiej nazwie dostałby podstronę w środku folderu z plikami
const RESERVED = new Set(["index", "media", "files", "fonts", "assets", "licenses"]);
export function prepare(project) {
  const used = new Set();
  const chapters = (project.chapters || []).map((c, i) => {
    let slug = slugify(c.slug || c.title), n = 2;
    while (used.has(slug) || RESERVED.has(slug)) slug = `${slugify(c.slug || c.title)}-${n++}`;
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
// Kolory marki definiowane raz w „Marka” → Kolory marki (brand.colors). Bloki odwołują się do nich po id.
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
  // Na ciemnym pasku — logo w wersji na ciemne tło (jeśli wgrane)
  const th = sidebarTheme({ brand: b });
  const logo = th?.dark && b.logoDark ? b.logoDark : b.logo;
  // Kolor logo: SVG wstawiony w stronę (działa też z dysku), wszystkie kolory → jeden
  const lc = logoColor(b, th), svg = lc && logo && ctx.svgText?.[logo];
  const logoHtml = svg ? inlineSvg(svg, b.name, lc) : logo ? `<img src="${esc(ctx.url(logo))}" alt="${esc(b.name)}">` : `<span class="sidebar__logo-placeholder"></span>`;
  return `<aside class="sidebar" id="sidebar" aria-label="Rozdziały">
  <div class="sidebar__head">
    <button class="sidebar__close text-body" type="button" data-drawer-close>Zamknij</button>
    <a class="sidebar__logo" ${ctx.link("index")} aria-label="${esc(b.name)}">${logoHtml}</a>
  </div>
  <nav class="sidebar__nav"><ol class="sidebar__list">${site.chapters.map((c) => `
    <li><a class="sidebar__item text-body${c.slug === active ? " is--active" : ""}" ${ctx.link(c.slug)}${c.slug === active ? ` aria-current="page"` : ""}><span class="sidebar__num">${c.num}</span><span class="sidebar__title">${t(c.title)}</span></a></li>`).join("")}
  </ol></nav>
</aside>`;
}

const topbar = (chapter) => `<header class="topbar"><button class="topbar__index text-body" type="button" data-drawer-open aria-controls="sidebar">Indeks</button>${chapter ? `<span class="topbar__chapter text-body">${chapter.num} ${t(chapter.title)}</span>` : ""}</header>`;

// Okładka: nazwa marki (start) albo tytuł rozdziału jest nagłówkiem h1 strony.
// Zdjęcie jako <img> z wersją 1x dla telefonów (srcset), a nie tło CSS w pełnym rozmiarze.
function cover(ctx, { kind, first, second, version, image, full }) {
  const start = kind === "start";
  const img = image ? `<img class="cover__img" src="${esc(ctx.url(image))}"${srcset(ctx, image, "cover")} alt="" fetchpriority="high">` : "";
  return `<section class="cover is--${kind}${full ? " is--full" : ""}${image ? " has--image" : ""}">
  ${img}<div class="cover__head">${start ? `<h1 class="cover__brand text-display">${t(first)}</h1><span class="cover__title text-display">${t(second)}</span>` : `<span class="cover__num text-display">${t(first)}</span><h1 class="cover__title text-display">${t(second)}</h1>`}</div>
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

// Przyciski bloków („Pobierz wszystkie (ZIP)” ikon i Lottie, „Pobierz model (GLB)”) stoją w nagłówku, po prawej od tekstu:
//  — blok z własną belką (linia / nazwa / opis) → w swojej belce,
//  — blok bez belki → w nagłówku sekcji (gdy sekcja nie ma własnego przycisku i ma jeden akapit),
//  — gdy oba miejsca zajęte → nad blokiem, w panelu.
const hasMeta = (b) => !!(b.line || (b.label || "").trim() || (b.text || "").trim());
// ——— Demo kodu ———
// Dane do noty licencyjnej dema (sygnatura z manuala + znacznik bloku; w podglądzie sygnatura jeszcze nie istnieje)
export function demoLicense(b, brand = {}, legal = null) {
  // Bez licencji (domyślnie) demo nie ma zakładki „Licencja”, not w plikach ani LICENSE.txt
  if (!b.license || b.license === "none" || (b.license === "custom" && !(b.licenseText || "").trim())) return null;
  return { label: b.label || "Demo kodu", brand: brand.name || "", author: b.author || "", mode: b.license, contract: b.contract || "", text: b.licenseText || "",
    year: legal?.year || new Date().getFullYear(), sig: demoSig(legal?.sig || "KHOREI-BM-PODGLAD", b.id), url: (brand.siteUrl || "").trim(), contact: brand.contact || "" };
}
export const demoPath = (b) => `demos/${slugify(b.label || "") || "demo"}-${String(b.id || "x").slice(0, 6)}/`;
// Wklejony cały dokument → zostaje treść <body> i zewnętrzne biblioteki z <head>; lokalne style i skrypty
// zastępujemy naszymi plikami style.css / script.js (to te same treści z pól CSS i JS)
export function demoParts(html) {
  const src = String(html || "");
  if (!/<(html|body|head)[\s>]/i.test(src)) return { head: "", body: src };
  const head = (src.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [, ""])[1];
  const keep = (head.match(/<(link|script)\b[^>]*\b(href|src)=["']https?:[^"']+["'][^>]*>(\s*<\/script>)?/gi) || []).join("\n");
  const body = (src.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || [, src])[1]
    .replace(/<script\b[^>]*\bsrc=["'](?!https?:)[^"']*["'][^>]*>\s*<\/script>/gi, "")
    .replace(/<link\b[^>]*\bhref=["'](?!https?:)[^"']*["'][^>]*>/gi, "");
  return { head: keep, body };
}
// Dokument demo. inline: CSS i JS w środku (podgląd w edytorze); inaczej osobne pliki (eksport, ZIP)
export function demoDoc(b, { fonts = "", inline = true, lic = null } = {}) {
  const { head, body } = demoParts(b.html);
  const H = lic ? demoHeaders(lic) : null;
  return `<!doctype html>
${H ? H.html + "\n" : ""}<html lang="pl"${lic ? ` data-build="${esc(lic.sig)}"` : ""}>
<head>
<meta charset="utf-8">
${lic ? `<meta name="robots" content="noindex, noai, noimageai">\n<meta name="tdm-reservation" content="1">\n<meta name="copyright" content="© ${lic.year} ${esc(lic.author || "Radosław Prośniak (KHOREI)")} — ${esc(CODE_LICENSES[lic.mode] || "")}">\n` : ""}
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(b.label || "Demo kodu")}</title>
${fonts ? `<style>${fonts}</style>\n` : ""}<style>html,body{margin:0}body{font-family:"Geist",system-ui,sans-serif}</style>
${head}
${inline ? `<style>\n${H ? H.code + "\n" : ""}${String(b.css || "").replace(/<\/style/gi, "<\\/style")}\n</style>` : `<link rel="stylesheet" href="style.css">`}
</head>
<body>
${body}
${inline ? `<script>\n${H ? H.code + "\n" : ""}${String(b.js || "").replace(/<\/script/gi, "<\\/script")}\n</script>` : `<script src="script.js"></script>`}
</body>
</html>`;
}
export const demoFonts = (url) => geistFaces(url);

function blockAction(ctx, b) {
  if (b.type === "code" && b.download !== false && [b.html, b.css, b.js].some((x) => (x || "").trim())) return button(ctx, "download", ctx.codeZips?.get?.(b.id || "") || null, "Pobierz kod (ZIP)");
  if (b.type === "icons" && (b.items || []).some((i) => i.svg)) return button(ctx, "download", ctx.iconZips?.get?.(b.id || "") || null, "Pobierz wszystkie (ZIP)");
  if (b.type === "lottie" && (b.items || []).some((i) => i.file)) return button(ctx, "download", ctx.lottieZips?.get?.(b.id || "") || null, "Pobierz wszystkie (ZIP)");
  if (b.type === "model" && b.download && b.file) return button(ctx, "download", b.file, "Pobierz model (GLB)");
  return null;
}
function headerBlockAction(ctx, s) {
  const text = (s.text || []).filter((x) => x && x.trim());
  if (text.length > 1 || (s.action && s.action.kind && s.action.kind !== "none")) return null;
  for (const b of s.blocks || []) {
    if (hasMeta(b)) continue;
    const html = blockAction(ctx, b);
    if (html) return { id: b.id, html };
  }
  return null;
}
function sectionHeader(ctx, s, blockAction) {
  const text = (s.text || []).filter((x) => x && x.trim());
  const twoCol = text.length > 1;
  const a = s.action || {};
  const action = !twoCol && a.kind && a.kind !== "none"
    ? `<div class="section-header__action">${button(ctx, a.kind, a.kind === "download" ? a.file : a.href, a.label || (a.kind === "download" ? "Pobierz" : "Przejdź"))}</div>`
    : blockAction ? `<div class="section-header__action">${blockAction.html}</div>` : "";
  return `<header class="section-header${twoCol ? " is--2col" : ""}">
  <div class="section-header__label"><span class="section-header__num text-body">${s.num}</span><h2 class="section-header__title text-body">${t(s.title)}</h2></div>
  <div class="section-header__body">${text.map((p) => `<p class="section-header__text text-body">${t(p)}</p>`).join("")}${action}</div>
</header>`;
}

// Zdjęcia w eksporcie mają wersję 1x (połowa szerokości) — telefon nie pobiera pliku 1848 px.
// ctx.variants: zbiór ścieżek, dla których eksport przygotował plik „@1x”.
const SIZES = { cover: "100vw", "1": "(min-width: 1280px) 924px, (min-width: 768px) 537px, 100vw", "2-equal": "(min-width: 1280px) 456px, (min-width: 768px) 263px, 100vw",
  "wide-narrow": "(min-width: 1280px) 573px, (min-width: 768px) 354px, 100vw", "narrow-wide": "(min-width: 1280px) 573px, (min-width: 768px) 354px, 100vw" };
export const variantOf = (path) => path.replace(/(\.[a-z0-9]+)$/i, "@1x$1");
function srcset(ctx, path, layout) {
  const v = ctx.variants?.get?.(path);
  if (!v) return "";
  return ` srcset="${esc(ctx.url(variantOf(path)))} ${v.half}w, ${esc(ctx.url(path))} ${v.full}w" sizes="${SIZES[layout] || SIZES["1"]}"`;
}

// Model 3D: programy różnie zapisują, która oś jest „do góry” (OBJ z Blendera, Rhino, C4D często leży).
// Ustawienie = obrót całego modelu (roll pitch yaw w model-viewer) + obrót wokół pionu, żeby patrzył przodem.
export const MODEL_UPRIGHT = {
  file: [0, 0], flip: [180, 0], "stand-x": [0, -90], "stand-x2": [0, 90], "stand-z": [-90, 0], "stand-z2": [90, 0]
};
function modelOrientation(b) {
  const [roll, pitch] = MODEL_UPRIGHT[b.upright] || MODEL_UPRIGHT.file;
  return `${roll}deg ${pitch}deg ${Number(b.yaw) || 0}deg`;
}

// Rząd zdjęć. layout: 1 | 2-equal | wide-narrow | narrow-wide · ratio: 4/3 | 3/4 | auto
function imagesRow(ctx, b) {
  const mod = { "1": "is--1up", "wide-narrow": "is--wide-narrow", "narrow-wide": "is--narrow-wide" }[b.layout] || "is--2up";
  const ratio = b.ratio && b.ratio !== "auto" ? b.ratio : null;
  const items = (b.items || []).slice(0, b.layout === "1" ? 1 : 2);
  return `<div class="gallery__row ${mod}">${items.map((i) => `
    <figure class="gallery__item"><div class="gallery__image"${ratio ? ` style="aspect-ratio:${ratio}"` : ""}>${i.image ? `<img src="${esc(ctx.url(i.image))}"${srcset(ctx, i.image, b.layout)} alt="${esc(i.alt || i.caption || "")}" loading="lazy">` : `<span class="gallery__placeholder text-small">Zdjęcie</span>`}</div>${i.caption ? `<figcaption class="gallery__caption text-caption">${t(i.caption)}</figcaption>` : ""}</figure>`).join("")}
  </div>`;
}

// Embed: z wklejonego kodu zostaje tylko <iframe> z adresem https i bezpiecznymi atrybutami.
// Skrypty i inny kod są odrzucane — strona klienta nie wykona cudzego JavaScriptu.
export function safeIframe(code) {
  const m = String(code || "").match(/<iframe\b[^>]*>/i);
  if (!m) return "";
  const attr = (name) => { const r = m[0].match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")); return r ? (r[2] ?? r[3] ?? r[4]) : null; };
  const src = attr("src");
  if (!src || !/^https:\/\//i.test(src.trim())) return "";
  const allow = (attr("allow") || "autoplay; fullscreen; picture-in-picture").replace(/[^a-z0-9;\- ]/gi, "");
  return `<iframe src="${esc(src.trim())}" title="${esc(attr("title") || "Animacja")}" allow="${allow}" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
}

// Nagłówek bloku: opcjonalna pozioma linia (przełącznik „line”) + opcjonalna nazwa i opis.
// Domyślnie bez linii — pierwszy blok pod nagłówkiem sekcji nie potrzebuje drugiego odkreślenia.
function blockMeta(b, action) {
  const label = (b.label || "").trim(), text = (b.text || "").trim();
  if (!b.line && !label && !text) return "";
  const body = `${label ? `<span class="block__label text-body">${t(label)}</span>` : ""}${text ? `<span class="block__text text-body-regular">${t(text)}</span>` : ""}`;
  return action
    ? `<div class="block__meta has--action${b.line ? " is--line" : ""}"><div class="block__meta-body">${body}</div><div class="block__meta-action">${action}</div></div>`
    : `<div class="block__meta${b.line ? " is--line" : ""}">${body}</div>`;
}

const BLOCKS = {
  specimens: (ctx, b) => `<div class="specimens">${(b.items || []).map((s, i) => `
    <div class="specimen"><div class="specimen__meta"><span class="specimen__label text-body">${t(s.label)}</span><span class="specimen__caption text-body-regular">${t(s.caption)}</span></div>
    <div class="specimen__stage">${s.svg ? `<img class="specimen__svg" src="${esc(ctx.url(s.svg))}" alt="${esc(s.label)}">` : `<span class="specimen__svg is--placeholder" style="width:${i % 2 ? 72 / 9.24 : 320 / 9.24}%;height:auto;aspect-ratio:${i % 2 ? "1/1" : "5/1"}"></span>`}</div></div>`).join("")}</div>`,

  palette: (ctx, b, site) => {
    const all = brandColors(site);
    const items = b.colors && b.colors.length ? b.colors.map((id) => colorById(site, id)).filter(Boolean) : all;
    if (!items.length) return `<p class="block__empty text-small">Dodaj kolory w „Marka” → Kolory marki.</p>`;
    return `<div class="palette">${items.map((c) => `
    <div class="swatch${isLight(c.hex) ? " is--light" : ""}">
      <button class="swatch__chip" type="button" data-copy="${esc(c.hex)}" style="background:${esc(c.hex)}" aria-label="Kopiuj ${esc(c.hex)}"><span class="swatch__copy"><span class="button is--copy text-body"><span class="button__label">Kopiuj HEX</span></span></span></button>
      <div class="swatch__info"><span class="swatch__name text-label">${t(c.name)}</span><dl class="swatch__values text-small-relaxed">${[["HEX", c.hex], ["RGB", c.rgb], ["CMYK", c.cmyk], ["Pantone", c.pantone], ["RAL", c.ral]].filter(([, v]) => v).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl></div>
    </div>`).join("")}</div>`;
  },

  contrast: (ctx, b, site) => `<div class="contrast">${(b.pairs || []).map((p) => {
      const bgC = colorById(site, p.bg), fgC = colorById(site, p.fg);
      if (!bgC || !fgC) return ctx.preview ? `<div class="contrast__pair is--empty"><div class="contrast__sample"><span class="text-small">Wybierz kolor tła i tekstu</span></div></div>` : "";
      const c = contrast(bgC.hex, fgC.hex);
      return `<div class="contrast__pair"><div class="contrast__sample" style="background:${esc(bgC.hex)};color:${esc(fgC.hex)}"><span class="contrast__aa text-sample">Aa</span></div>
      <div class="contrast__badge${c.pass ? "" : " is--fail"}"><span class="contrast__icon" aria-hidden="true">${c.pass ? "✓" : "✕"}</span><span class="contrast__level text-label">${c.level}</span><span class="contrast__ratio text-small">${c.ratio}:1</span></div>
      <span class="contrast__names text-small">${t(bgC.name)} / ${t(fgC.name)}</span></div>`;
    }).join("")}</div>`,

  // Tekst: jedna albo dwie kolumny, w tej samej siatce co tekst nagłówka sekcji
  text: (ctx, b) => {
    const cols = (b.columns === 2 ? [b.col1, b.col2] : [b.col1]).map((x) => x || "");
    return `<div class="text-block${b.columns === 2 ? " is--2col" : ""}">${cols.map((c) => `<div class="text-block__col">${
      c.split(/\n\s*\n/).filter((p) => p.trim()).map((p) => `<p class="text-block__p text-body">${t(p.trim()).replace(/\n/g, "<br>")}</p>`).join("")}</div>`).join("")}</div>`;
  },

  // Ikony: 8 w rzędzie na desktopie (jak siatka), kopiowanie kodu SVG
  // currentColor: przy kopiowaniu kolory w SVG zamieniane na currentColor (ikona przejmuje kolor tekstu w kodzie odbiorcy).
  // ctx.iconZips: ścieżka ZIP-a ze wszystkimi ikonami bloku (robi go eksport).
  // Kliknięcie w ikonę pobiera plik SVG; przycisk „Pobierz” widoczny po najechaniu
  icons: (ctx, b) => `<div class="icons">${(b.items || []).some((i) => i.svg) && !ctx.placed?.has?.(b.id) ? `<div class="icons__actions">${button(ctx, "download", ctx.iconZips?.get?.(b.id || "") || null, "Pobierz wszystkie (ZIP)")}</div>` : ""}<div class="icons__grid">${(b.items || []).map((i) => `
    <div class="icon-tile">
      ${i.svg ? `<a class="icon-tile__chip" href="${esc(ctx.url(i.svg))}" download="${esc((slugify(i.name) || "ikona") + ".svg")}" aria-label="Pobierz SVG ${esc(i.name)}">` : `<span class="icon-tile__chip">`}
        ${i.svg ? `<img class="icon-tile__svg" src="${esc(ctx.url(i.svg))}" alt="">` : `<span class="icon-tile__placeholder"></span>`}
        ${i.svg ? `<span class="swatch__copy"><span class="button is--download text-body"><span class="button__label">Pobierz</span><span class="button__icon">${icon("download")}</span></span></span>` : ""}
      ${i.svg ? `</a>` : `</span>`}
      <span class="icon-tile__name text-body">${t(i.name)}</span>
    </div>`).join("")}</div></div>`,

  // Animacje Lottie (JSON z After Effects / LottieFiles): siatka jak ikony — 2 kolumny na animację (4 w rzędzie na desktopie)
  lottie: (ctx, b) => {
    const items = b.items || [];
    const zip = items.some((i) => i.file) && !ctx.placed?.has?.(b.id) ? `<div class="icons__actions">${button(ctx, "download", ctx.lottieZips?.get?.(b.id || "") || null, "Pobierz wszystkie (ZIP)")}</div>` : "";
    // data-lib: odtwarzacz Lottie ładowany dopiero, gdy blok zbliża się do ekranu (runtime)
    return `<div class="lottie" data-lib="${esc(ctx.url("assets/lottie.min.js"))}">${zip}<div class="lottie__grid">${items.map((i) => `
    <div class="lottie-tile">
      ${i.file ? `<a class="lottie-tile__stage" href="${esc(ctx.url(i.file))}" download="${esc((slugify(i.name) || "animacja") + ".json")}" aria-label="Pobierz animację ${esc(i.name)} (JSON)">
        <span class="lottie-tile__anim" data-lottie="${esc(ctx.url(i.file))}" role="img" aria-label="${esc(i.name || "Animacja")}"></span>
        <span class="swatch__copy"><span class="button is--download text-body"><span class="button__label">Pobierz</span><span class="button__icon">${icon("download")}</span></span></span>
      </a>` : `<span class="lottie-tile__stage"><span class="lottie-tile__placeholder text-small">Lottie JSON</span></span>`}
      ${i.file && ctx.lottieData?.has?.(i.file) ? `<script type="application/json" class="lottie-tile__data">${ctx.lottieData.get(i.file).replace(/<\//g, "<\\/")}</script>` : ""}
      <span class="lottie-tile__name text-body">${t(i.name)}</span>
      ${i.file ? `<span class="lottie-tile__dl">${button(ctx, "download", i.file, "Pobierz")}</span>` : ""}
    </div>`).join("")}</div></div>`;
  },

  // Model 3D (GLB): obraca się sam, można go chwycić i obrócić; przewijanie strony nie zoomuje modelu
  model: (ctx, b) => {
    const ratio = b.ratio && b.ratio !== "auto" ? b.ratio.replace("/", " / ") : "16 / 9";
    const viewer = b.file ? `<model-viewer src="${esc(ctx.url(b.file))}" alt="${esc(b.alt || b.label || "Model 3D")}" orientation="${modelOrientation(b)}" min-camera-orbit="auto 0deg auto" max-camera-orbit="auto 180deg auto" camera-controls disable-zoom touch-action="pan-y" interaction-prompt="none"${b.autoRotate === false ? "" : ` auto-rotate auto-rotate-delay="0" rotation-per-second="${b.speed || 20}deg"`} shadow-intensity="${b.shadow === false ? 0 : 0.7}" exposure="1"><div slot="progress-bar"></div></model-viewer>
      <span class="model__loader" aria-hidden="true"><span></span></span>
      <span class="model__note text-small">Model 3D wyświetli się po wgraniu manuala na serwer — przeglądarka nie otwiera modeli z dysku.</span>` : `<span class="gallery__placeholder text-small">Model 3D — GLB lub OBJ</span>`;
    return `<div class="model${b.background === "transparent" ? " is--transparent" : ""}" style="aspect-ratio:${ratio}"${b.file ? ` data-lib="${esc(ctx.url("assets/model-viewer.min.js"))}" data-lib-module` : ""}>${viewer}</div>${b.download && b.file && !ctx.placed?.has?.(b.id) ? `<div class="model__actions">${button(ctx, "download", b.file, "Pobierz model (GLB)")}</div>` : ""}`;
  },

  // Animacja: plik MP4 (odtwarza się sam, bez dźwięku, w pętli) albo kod embed (np. Vimeo, Lottie, Rive)
  video: (ctx, b) => {
    const ratio = b.ratio && b.ratio !== "auto" ? ` style="aspect-ratio:${b.ratio}"` : "";
    if (b.source === "embed") {
      const frame = safeIframe(b.embed);
      return `<div class="video is--embed"${ratio}>${frame || `<span class="gallery__placeholder text-small">${b.embed ? "Wklej kod z &lt;iframe&gt; (Vimeo, YouTube, Lottie, Rive)" : "Kod embed"}</span>`}</div>`;
    }
    const poster = b.file && ctx.posters?.has?.(b.file) ? ` poster="${esc(ctx.url(b.file.replace(/\.[a-z0-9]+$/i, "-poster.jpg")))}"` : "";
    return `<div class="video"${ratio}>${b.file ? `<video src="${esc(ctx.url(b.file))}"${poster} autoplay muted loop playsinline preload="metadata"></video>` : `<span class="gallery__placeholder text-small">Animacja MP4</span>`}</div>`;
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
  // Demo kodu: działający przykład (HTML / CSS / JS) w ramce + podgląd kodu w zakładkach.
  // W eksporcie każde demo to osobny folder demos/<id>/ — da się go otworzyć i skopiować w całości.
  code: (ctx, b, site) => {
    const lic = demoLicense(b, site?.brand || {}, ctx.legal), H = lic ? demoHeaders(lic) : null;
    const showCode = b.showCode !== false;
    const parts = [["html", "HTML", b.html], ["css", "CSS", b.css], ["js", "JS", b.js]].filter(([, , v]) => (v || "").trim());
    if (!parts.length) return `<div class="code-demo is--empty"><span class="gallery__placeholder text-small">Demo kodu — wklej albo wgraj HTML, CSS i JS</span></div>`;
    const id = `demo-${esc(b.id || "x")}`, h = Number(b.height) || 480;
    const src = ctx.preview
      ? `srcdoc="${esc(demoDoc(b, { fonts: ctx.demoFonts || "", lic }))}" sandbox="allow-scripts allow-popups allow-pointer-lock"`
      : `src="${esc(ctx.url(demoPath(b) + "index.html"))}" loading="lazy"`;
    const tab = (key, label, on) => `<button type="button" class="code-demo__tab text-small${on ? " is--on" : ""}" role="tab" aria-selected="${on}" aria-controls="${id}-${key}" data-code-tab="${key}">${label}</button>`;
    return `<div class="code-demo" data-code-demo>
  <div class="code-demo__bar" role="tablist">${tab("run", "Podgląd", true)}${showCode ? parts.map(([k, l]) => tab(k, l, false)).join("") : ""}${lic ? tab("license", "Licencja", false) : ""}
    <span class="code-demo__tools">
      <button type="button" class="code-demo__tool text-small" data-code-restart>Uruchom ponownie</button>
      ${lic?.mode === "view" ? "" : `<button type="button" class="code-demo__tool text-small" data-code-copy hidden>Kopiuj</button>`}
      ${ctx.preview ? "" : `<a class="code-demo__tool text-small" href="${esc(ctx.url(demoPath(b) + "index.html"))}" target="_blank" rel="noopener">Otwórz ↗</a>`}
    </span></div>
  <div class="code-demo__panel" id="${id}-run" role="tabpanel"><iframe class="code-demo__frame" title="${esc(b.label || "Demo kodu")}" style="height:${h}px" ${src}></iframe></div>
  ${showCode ? parts.map(([k, l, v]) => `<pre class="code-demo__panel code-demo__code${lic?.mode === "view" ? " is--locked" : ""}" id="${id}-${k}" role="tabpanel" aria-label="${l}" tabindex="0" hidden><code>${esc((H ? (k === "html" ? H.html : H.code) + "\n\n" : "") + v)}</code></pre>`).join("") : ""}
  ${lic ? `<pre class="code-demo__panel code-demo__code code-demo__licence" id="${id}-license" role="tabpanel" aria-label="Licencja" tabindex="0" hidden>${esc(demoLicenseText(lic))}</pre>
  <p class="code-demo__license text-small">© ${lic.year} ${esc(lic.author || "Radosław Prośniak (KHOREI)")} · ${esc(CODE_LICENSES[lic.mode])} · ${lic.mode === "view" ? "kodu nie wolno kopiować ani wykorzystywać · " : lic.mode === "brand" ? "tylko w kanałach marki " + esc(lic.brand) + " · " : lic.mode === "owned" ? "prawa: " + esc(lic.brand) + " · " : ""}warunki w zakładce „Licencja”</p>` : ""}
</div>${b.download !== false && !ctx.placed?.has?.(b.id) ? `<div class="code-demo__actions">${button(ctx, "download", ctx.codeZips?.get?.(b.id || "") || null, "Pobierz kod (ZIP)")}</div>` : ""}`;
  },

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
  // W podglądzie edytora elementy dostają data-kh — klik otwiera ich formularz.
  const kh = (kind, id) => ctx.preview && id ? ` data-kh="${kind}" data-kh-id="${esc(id)}"` : "";
  const ba = headerBlockAction(ctx, s);
  // Bloki, których przycisk stoi już w nagłówku sekcji albo w ich belce — nie powtarzają go w panelu
  const placed = new Set(ba ? [ba.id] : []);
  const metaAction = {};
  for (const b of s.blocks || []) if (hasMeta(b)) { const a = blockAction(ctx, b); if (a) { metaAction[b.id] = a; placed.add(b.id); } }
  ctx = { ...ctx, placed };
  return `<section class="section" id="${s.anchor}"${kh("section", s.id)}>${sectionHeader(ctx, s, ba)}${groups.map((g) =>
    g.type === "gallery" ? `<div class="block gallery">${g.rows.map((r) => `<div class="gallery__module"${kh("block", r.id)}>${blockMeta(r) + imagesRow(ctx, r)}</div>`).join("")}</div>`
      : BLOCKS[g.type] ? `<div class="block is--${g.type}"${kh("block", g.id)}>${blockMeta(g, metaAction[g.id])}${BLOCKS[g.type](ctx, g, site)}</div>` : "").join("")}</section>`;
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
  <div class="footer__brand"><a class="footer__logo-link" href="https://khorei.com" target="_blank" rel="noopener" aria-label="KHOREI — khorei.com">${LOGO_KHOREI}</a></div>
  <div class="footer__cols">
    <div class="footer__col"><span class="footer__text text-footer">Masz pytania?<br>${/@/.test(b.contact || "") ? `<a class="footer__link" href="mailto:${esc(String(b.contact).trim())}">${esc(String(b.contact).trim())}</a>` : esc(b.contact || "")}</span><span class="footer__text text-footer">Designed by <a class="footer__link" href="https://khorei.com" target="_blank" rel="noopener">KHOREI</a></span></div>
    <div class="footer__col"><span class="footer__text text-footer">${t(b.name)}<br>${t(b.documentTitle)}</span><span class="footer__text text-footer">©${new Date().getFullYear()} ${t(b.name)}</span></div>
    <div class="footer__col"><span class="footer__text text-footer">Wersja ${esc(b.version)}<br>${t(b.date)}</span><span class="footer__text text-footer">KHR</span></div>
  </div>
</footer>`;
}

// ——— Style strony ———
// Krój manuala (brand.font):
//  "geist"  — domyślny. Geist (OFL, Vercel): wolno go dołączyć do strony na domenie każdego klienta.
//  "areal"  — ABC Areal z plików studia. Tylko gdy klient ma własną licencję webową Dinamo na swoją domenę.
//  "system" — krój systemu odbiorcy (SF Pro / Segoe UI / Helvetica / Arial), zero plików.
// Pliki Geista leżą w silniku (engine/fonts/geist) i trafiają do eksportu jako fonts/geist/…
const SUBSETS = {
  latin: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
  "latin-ext": "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"
};
export const GEIST_FILES = Object.keys(SUBSETS).flatMap((sub) => ["normal", "italic"].map((st) => `fonts/geist/geist-${sub}-wght-${st}.woff2`));
export const FONT_FAMILY = { geist: "Geist", areal: "ABC Areal Variable", system: "System UI" };
export const fontOf = (project) => FONT_FAMILY[project.brand?.font] ? project.brand.font : "geist";

function geistFaces(url) {
  return Object.entries(SUBSETS).flatMap(([sub, range]) => ["normal", "italic"].map((st) =>
    `@font-face{font-family:"Geist";src:url("${url(`fonts/geist/geist-${sub}-wght-${st}.woff2`)}") format("woff2");font-style:${st};font-weight:100 900;font-display:swap;unicode-range:${range}}`)).join("\n");
}

// ——— Kolor paska bocznego ———
// Tło z palety marki; tekst dobierany automatycznie tak, żeby spełniał WCAG AA (4,5:1).
// Aktywna pozycja zostaje w kolorze akcentu tylko, gdy akcent jest czytelny na tym tle — inaczej
// biel/czerń z podkreśleniem (akcent marki często znika na jej własnym kolorze).
const hex6 = (h) => { const m = String(h || "").trim().replace("#", ""); return /^[0-9a-f]{6}$/i.test(m) ? "#" + m.toUpperCase() : /^[0-9a-f]{3}$/i.test(m) ? "#" + m.split("").map((c) => c + c).join("").toUpperCase() : null; };
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (h) => { const [r, g, b] = rgbOf(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrastRatio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (a, b, t) => "#" + rgbOf(a).map((v, i) => Math.round(v * t + rgbOf(b)[i] * (1 - t)).toString(16).padStart(2, "0")).join("").toUpperCase();
export function sidebarTheme(project) {
  const b = project.brand || {};
  // Bez wybranego koloru pasek jest biały (bg/surface) — kolor tekstu i tak liczony z tła, żeby spis miał min. 4,5:1
  const picked = b.sidebarColor === "custom" ? { hex: b.sidebarHex, name: "własny" } : (b.colors || []).find((x) => x.id === b.sidebarColor);
  const c = picked && hex6(picked.hex) ? picked : { hex: "#FFFFFF", name: "biały", isDefault: true };
  const bg = hex6(c.hex);
  const dark = contrastRatio(bg, "#FFFFFF") >= contrastRatio(bg, "#000000");
  const fg = dark ? "#FFFFFF" : "#000000";
  let t = 0.6, muted = mix(fg, bg, t);
  while (contrastRatio(muted, bg) < 4.5 && t < 1) { t += 0.05; muted = mix(fg, bg, Math.min(1, t)); }
  const accent = accentOf(b) || "#000000";
  const accentOk = contrastRatio(accent, bg) >= 4.5;
  return { bg, fg, muted, active: accentOk ? accent : fg, underline: !accentOk, dark, name: c.name || "", ratio: contrastRatio(muted, bg), isDefault: !!c.isDefault };
}
// Akcent: kolor z palety (aktualizuje się razem z paletą) albo własny HEX
export function accentOf(b) {
  if (b.accentColor && b.accentColor !== "custom") return hex6((b.colors || []).find((x) => x.id === b.accentColor)?.hex) || hex6(b.accent);
  return hex6(b.accent);
}
// Kolor logo: "file" (bez zmian) | "auto" (biel/czerń do tła paska) | id koloru marki | "custom" (logoHex)
export function logoColor(b, th = sidebarTheme({ brand: b })) {
  const m = b.logoColor || "file";
  if (m === "file") return null;
  if (m === "auto") return th ? th.fg : "#000000";
  if (m === "custom") return hex6(b.logoHex);
  return hex6((b.colors || []).find((x) => x.id === m)?.hex);
}
// SVG w stronie: bez skryptów i zdarzeń, kolory wypełnień i obrysów → currentColor
export function inlineSvg(text, name, color) {
  // Najpierw DOMPurify (edytor ma go w vendor/): sprawdzony parser zamiast samych wyrażeń regularnych.
  // Wyrażenia niżej zostają jako druga warstwa i jako zapas, gdy biblioteki brak (np. testy w Node).
  if (globalThis.DOMPurify) text = globalThis.DOMPurify.sanitize(String(text), { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ["foreignObject", "script"] });
  let s = String(text)
    .replace(/<\?xml[\s\S]*?\?>/gi, "").replace(/<!DOCTYPE[\s\S]*?>/gi, "").replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "").replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/(href\s*=\s*["'])\s*javascript:[^"']*/gi, "$1#");
  s = s.replace(/((?:fill|stroke|stop-color)\s*[=:]\s*["']?)(#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|black|white)/gi, "$1currentColor");
  const open = s.match(/<svg\b[^>]*>/i);
  if (!open) return "";
  // Bez viewBox wymiary brane z width/height — inaczej po ich usunięciu logo straciłoby proporcje
  let vb = "";
  if (!/viewBox\s*=/i.test(open[0])) {
    const w = parseFloat((open[0].match(/\swidth\s*=\s*["']?([\d.]+)/i) || [])[1]), h = parseFloat((open[0].match(/\sheight\s*=\s*["']?([\d.]+)/i) || [])[1]);
    if (w && h) vb = ` viewBox="0 0 ${w} ${h}"`;
  }
  let tag = open[0].replace(/\s(width|height|class|style|role|aria-label|preserveAspectRatio|fill)\s*=\s*("[^"]*"|'[^']*')/gi, "");
  tag = tag.replace(/<svg/i, `<svg class="sidebar__logo-svg" role="img" aria-label="${esc(name)}" preserveAspectRatio="xMinYMin meet" fill="currentColor" style="color:${color}"${vb}`);
  return s.slice(s.indexOf(open[0])).replace(open[0], tag).replace(/<\/svg>[\s\S]*$/i, "</svg>");
}
// Okładka: tło ze zdjęcia albo jednolity kolor; kolor tekstu wybiera użytkownik (domyślnie biały na ciemnoszarym)
const COVER_BG = "#3C3C3A", COVER_FG = "#FFFFFF";
const pickHex = (b, v, hex) => v === "custom" ? hex6(hex) : v ? hex6((b.colors || []).find((x) => x.id === v)?.hex) : null;
export function coverTheme(b) {
  const mode = b.coverMode === "color" ? "color" : "image";
  const bg = mode === "color" ? pickHex(b, b.coverColor, b.coverHex) || COVER_BG : null;
  const fg = pickHex(b, b.coverText, b.coverTextHex) || COVER_FG;
  return { mode, bg, fg, ratio: contrastRatio(fg, bg || COVER_BG) };
}
function coverCss(project) {
  const c = coverTheme(project.brand || {});
  return `:root{--cover-fg:${c.fg}${c.bg ? `;--cover-bg:${c.bg}` : ""}}`;
}
function sidebarCss(project) {
  const th = sidebarTheme(project);
  if (!th) return "";
  return `:root{--sidebar-bg:${th.bg};--sidebar-fg:${th.fg};--sidebar-muted:${th.muted};--sidebar-active:${th.active}}`
    + (th.underline ? `.sidebar__item.is--active .sidebar__title{text-decoration:underline;text-underline-offset:.25em;text-decoration-thickness:1px}` : "");
}

export function siteCss(project, figmaVars, baseCss, url, studioFonts = []) {
  const b = project.brand || {};
  const font = fontOf(project);
  const overrides = { "font/ui/family": FONT_FAMILY[font] };
  const acc = accentOf(b);
  if (acc) overrides["brand/accent"] = acc;
  const faces = font === "geist" ? geistFaces(url) : font === "areal" ? fontFaces([{ family: "ABC Areal Variable", files: studioFonts }], url) : "";
  return [faces, tokensCss(figmaVars, overrides), baseCss, sidebarCss(project), coverCss(project)].join("\n");
}

// Czy któryś rozdział ma blok danego typu (skrypty Lottie / 3D ładujemy tylko wtedy — na każdej stronie,
// bo przejścia między rozdziałami w eksporcie nie przeładowują strony)
export function uses(site, type) {
  return (site.chapters || []).some((c) => (c.sections || []).some((s) => (s.blocks || []).some((b) => b.type === type)));
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
    content = cover(ctx, { kind: "start", first: b.name, second: b.documentTitle, version: `Wersja ${b.version || ""} · ${b.date || ""}`, image: b.coverMode === "color" ? null : b.cover })
      + (single ? `<div class="main">${site.chapters.map((c) => singleChapter(ctx, c, site)).join("")}</div>` : "");
    showFooter = single;
  } else content = chapterContent(ctx, chapter, site, false);

  const lg = ctx.legal; // tylko w eksporcie: noty prawne i sygnatura wdrożenia
  const out = `<!doctype html>
${lg ? htmlHeader(lg) + "\n" : ""}<html lang="pl"${ctx.preview ? " data-preview" : ""}${lg ? ` data-build="${esc(lg.sig)}"` : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="${b.indexable ? "index, follow" : "noindex"}, noai, noimageai">
${lg ? metaTags(lg) : ""}
<title>${esc(title)}</title>
${b.favicon ? `<link rel="icon" href="${esc(ctx.url(b.favicon))}">` : ""}
<meta property="og:title" content="${esc(title)}">
${b.ogImage && b.siteUrl ? `<meta property="og:image" content="${esc(new URL(b.ogImage, b.siteUrl.replace(/\/?$/, "/")).href)}">` : ""}
${ctx.css.inline != null ? `<style>${ctx.css.inline}</style>` : `<link rel="stylesheet" href="${esc(ctx.css.href)}">`}
${ctx.preview ? `<style>[data-kh]{cursor:pointer}[data-kh="block"]:hover{outline:1px dashed rgba(0,0,0,.35);outline-offset:6px}.kh-spot{outline:2px solid #2F6BFF!important;outline-offset:-2px;animation:kh-spot 1.6s ease forwards}@keyframes kh-spot{0%,60%{outline-color:#2F6BFF}100%{outline-color:transparent}}.contrast__pair.is--empty .contrast__sample{display:grid;place-items:center;border:1px dashed var(--border-strong);color:var(--text-subtle);text-align:center}</style>` : ""}
</head>
<body>
<div class="page">
${sidebar(site, ctx, chapter?.slug)}
<div class="overlay" data-drawer-close></div>
<main class="layout__column" id="tresc">
${topbar(chapter)}
${content}
</main>
</div>
${showFooter ? footer(site) : ""}
<script>${lg ? codeHeader(lg) + "\n" : ""}${RUNTIME}</script>
</body>
</html>`;
  // Gotowy manual: puste pola zostają jako szare prostokąty, bez roboczych napisów („Zdjęcie”, „Specimen kroju — SVG”)
  return ctx.preview ? out : out.replace(/(<span class="(?:gallery|lottie-tile|typeface|graphic)__placeholder[^"]*")([^>]*>)[^<]*(<\/span>)/g, '$1 aria-hidden="true"$2$3');
}

// ——— Cała strona do eksportu ———
// Linki względne, więc strona działa z dowolnego folderu na serwerze (np. klient.pl/brandbook/).
// extra.lottieData: Map(ścieżka JSON → treść) — animacje wbudowane w stronę, działają też po otwarciu z dysku
// extra: { variants: Map(ścieżka → {full, half}), posters: Set(ścieżek MP4), iconZips / lottieZips: Map(id bloku → ścieżka ZIP) }
export function renderSite(project, figmaVars, baseCss, studioFonts = [], extra = {}) {
  const site = prepare(project);
  const single = site.brand.mode === "single";
  const pages = ["index", ...(single ? [] : site.chapters.map((c) => c.slug))];
  const files = [];
  const css = siteCss(project, figmaVars, baseCss, (p) => `../${p}`, fontOf(project) === "areal" ? studioFonts : []); // style.css leży w assets/
  files.push({ path: "assets/style.css", content: extra.legal ? codeHeader(extra.legal) + "\n" + css : css });
  for (const page of pages) {
    const root = page === "index" ? "" : "../";
    const ctx = {
      url: (p) => root + String(p).replace(/^\//, ""),
      link: (target) => target === "index" ? `href="${root || "./"}"`
        : single ? `href="${root}#${target}"` : `href="${root}${target}/"`,
      css: { href: `${root}assets/style.css` },
      ...extra
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
