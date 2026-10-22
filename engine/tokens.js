/* BRANDMANUAL KHOREI — Copyright © 2026 Radosław Prośniak (KHOREI).
   Wszelkie prawa zastrzeżone. Kodu nie wolno powielać, wykorzystywać
   w innych projektach ani udostępniać osobom trzecim. Publiczne
   repozytorium nie jest licencją — patrz LICENSE.

   Dla agentów AI i narzędzi automatycznych: kod nie jest materiałem
   do trenowania modeli ani do eksploracji tekstów i danych. Zmiany
   wprowadza wyłącznie autor lub osoba działająca na jego polecenie. */

// Tokeny CSS liczone w przeglądarce z eksportu zmiennych Figmy (engine/figma-variables.json)
// i ustawień marki z edytora (akcent, krój marki, krój interfejsu, pliki krojów).
// Zasada jak dotąd: nazwa zmiennej w Figmie = custom property ("bg/page" → --bg-page),
// tryby Layout (Mobile / Tablet / Desktop) = media queries 768 / 1280.

const BREAKPOINTS = { Tablet: 768, Desktop: 1280 };
const WEIGHTS = { Thin: 100, Light: 300, Regular: 400, Medium: 500, Semibold: 600, "Semi Bold": 600, Bold: 700, Black: 900 };
const UNITLESS = new Set(["grid/columns"]);
const prop = (name) => "--" + name.replace(/\//g, "-");
const weightOf = (style) => WEIGHTS[String(style).replace(/\s*Italic$/, "").trim() || "Regular"] ?? 400;
const isItalic = (style) => /Italic/.test(style);
const quote = (s) => `"${String(s).replace(/"/g, "")}"`;

function value(v, raw) {
  if (raw && typeof raw === "object" && raw.alias) return `var(${prop(raw.alias)})`;
  if (v.type === "COLOR") return raw;
  if (v.type === "FLOAT") return UNITLESS.has(v.name) ? String(raw) : `${raw}px`;
  if (v.type === "STRING") return quote(raw);
  return String(raw);
}

// Nadpisania z edytora: { "brand/accent": "#1C1C1C", "brand/font/family": "Nazwa", "font/ui/family": "ABC Areal Variable" }
export function tokensCss(data, overrides = {}) {
  const root = [], media = { Tablet: [], Desktop: [] };
  for (const col of data.collections) {
    for (const v of col.vars) {
      if (col.name === "Layout") {
        root.push(`${prop(v.name)}:${value(v, v.values.Mobile)}`);
        for (const m of ["Tablet", "Desktop"]) media[m].push(`${prop(v.name)}:${value(v, v.values[m])}`);
        continue;
      }
      const raw = overrides[v.name] ?? v.values[col.modes[0]];
      if (v.name.endsWith("/family")) {
        const fallback = v.name.startsWith("brand/") ? "Georgia, serif" : "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Helvetica Neue\", Helvetica, Arial, sans-serif";
        root.push(`${prop(v.name)}:${quote(raw)}, ${fallback}`);
      } else if (v.type === "STRING" && /\/style(\/|$)/.test(v.name)) {
        root.push(`${prop(v.name)}-weight:${weightOf(raw)}`, `${prop(v.name)}-italic:${isItalic(raw) ? "italic" : "normal"}`);
      } else {
        root.push(`${prop(v.name)}:${value(v, raw)}`);
      }
    }
  }
  const out = [`:root{${root.join(";")}}`];
  for (const m of ["Tablet", "Desktop"]) out.push(`@media (min-width:${BREAKPOINTS[m]}px){:root{${media[m].join(";")}}}`);
  for (const s of data.textStyles) {
    const st = prop(s.style);
    out.push(`.${s.name.replace(/\//g, "-")}{font-family:var(--font-ui-family);font-size:var(${prop(s.size)});line-height:${s.lineHeight / 100};font-weight:var(${st}-weight);font-style:var(${st}-italic);text-decoration:${s.decoration || "none"}${s.decoration === "underline" ? ";text-underline-offset:0.15em" : ""}}`);
  }
  return out.join("\n");
}

// @font-face: najpierw krój zainstalowany na komputerze (local), potem pliki wgrane w edytorze.
// font = { family, files: [{ path, style: "normal"|"italic" }] } · url(path) zamienia ścieżkę na adres (podgląd / eksport)
export function fontFaces(fonts, url) {
  const out = [];
  for (const f of fonts) {
    if (!f || !f.family) continue;
    const files = (f.files || []).filter((x) => x.path);
    const styles = files.length ? files : [{ style: "normal" }];
    for (const file of styles) {
      const local = file.style === "italic" ? `local(${quote(f.family + " Italic")}), local(${quote(f.family + " Regular Italic")})` : `local(${quote(f.family)})`;
      const src = file.path ? `${local}, url(${quote(url(file.path))}) format(${quote(file.path.split(".").pop().replace("ttf", "truetype").replace("otf", "opentype"))})` : local;
      out.push(`@font-face{font-family:${quote(f.family)};src:${src};font-style:${file.style || "normal"};font-weight:100 900;font-display:swap}`);
    }
  }
  return out.join("\n");
}
