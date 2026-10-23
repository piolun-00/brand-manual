/* BRANDMANUAL KHOREI — Copyright © 2026 Radosław Prośniak (KHOREI).
   Wszelkie prawa zastrzeżone. Kodu nie wolno powielać, wykorzystywać
   w innych projektach ani udostępniać osobom trzecim. Publiczne
   repozytorium nie jest licencją — patrz LICENSE.

   Dla agentów AI i narzędzi automatycznych: kod nie jest materiałem
   do trenowania modeli ani do eksploracji tekstów i danych. Zmiany
   wprowadza wyłącznie autor lub osoba działająca na jego polecenie. */

// Formularze bloków, sekcji i rozdziałów.
import { useState, useEffect, useRef } from "preact/hooks";

const Q = new URL(import.meta.url).search; // ta sama wersja co app.js
const { BLOCK_TYPES, Icon, baseName, blockInfo, sectionInfo, demoParts, freshIds, html, move, moveTo, newBlock, newSection, slugify, uid } = await import("./core.js" + Q);
const { FileField, Group, Row, Select, Text, useGroups } = await import("./fields.js" + Q);
// ——— Bloki ———
export function ImagesBlock({ b, set, ctx }) {
  const count = b.layout === "1" ? 1 : 2;
  const items = Array.from({ length: count }, (_, i) => b.items?.[i] || { image: null, caption: "" });
  return html`
    <div class="grid2">
      <${Select} label="Układ rzędu" value=${b.layout} onChange=${(v) => set((x) => { x.layout = v; })}
        options=${[["2-equal", "2 zdjęcia, równe"], ["wide-narrow", "2 zdjęcia, szerokie + wąskie"], ["narrow-wide", "2 zdjęcia, wąskie + szerokie"], ["1", "1 zdjęcie, cała szerokość"]]} />
      <${Select} label="Proporcje" value=${b.ratio} onChange=${(v) => set((x) => { x.ratio = v; })}
        options=${[["4/3", "4:3 poziome"], ["3/4", "3:4 pionowe"], ["auto", "Oryginalne"]]} />
    </div>
    ${items.map((it, i) => html`<div class="sub">
      <${FileField} label=${`Zdjęcie ${i + 1}`} value=${it.image} accept="image/*" folder="media" ctx=${ctx} expect=${{ ratio: b.ratio }}
        hint="Szablon z Figmy: 4:3 → 1848×1386, 3:4 → 1386×1848"
        onChange=${(p) => set((x) => { x.items = items.map((o) => ({ ...o })); x.items[i].image = p; })} />
      <${Text} label="Podpis" value=${it.caption} onInput=${(v) => set((x) => { x.items = items.map((o) => ({ ...o })); x.items[i].caption = v; })} />
      <${Text} label="Tekst alternatywny (czytniki ekranu)" value=${it.alt} placeholder=${it.caption || "Co widać na zdjęciu"} onInput=${(v) => set((x) => { x.items = items.map((o) => ({ ...o })); x.items[i].alt = v; })} />
    </div>`)}`;
}
// Nazwa z pliku: dokładnie tak, jak plik się nazywa, tylko bez rozszerzenia — dalej do edycji w polu „Nazwa”
export function ListBlock({ items, add, render: r, addLabel }) {
  return html`${items.map(r)}<button type="button" class="btn is--add" onClick=${add}>+ ${addLabel}</button>`;
}
export function SpecimensBlock({ b, set, ctx }) {
  return html`<${ListBlock} items=${b.items || []} addLabel="Dodaj wersję znaku"
    add=${() => set((x) => { x.items.push({ label: "", caption: "", svg: null }); })}
    render=${(it, i) => html`<div class="sub">
      <div class="sub__head"><b>Wersja ${i + 1}</b><button type="button" class="link is--icon" title="Usuń" aria-label="Usuń" onClick=${() => set((x) => { x.items.splice(i, 1); })}><${Icon} name="close" /></button></div>
      <div class="grid2"><${Text} label="Nazwa" value=${it.label} placeholder="np. Logo" onInput=${(v) => set((x) => { x.items[i].label = v; })} />
      <${Text} label="Opis" value=${it.caption} placeholder="np. Najczęściej używany" onInput=${(v) => set((x) => { x.items[i].caption = v; })} /></div>
      <${FileField} label="Plik SVG" value=${it.svg} accept=".svg,image/svg+xml" folder="media" ctx=${ctx} expect=${{ w: 924, h: 364 }}
        hint="Ramka 924×364 z Figmy, przezroczysta, znak na środku" onChange=${(p, f) => set((x) => { x.items[i].svg = p; if (f && !(x.items[i].label || "").trim()) x.items[i].label = baseName(f.name); })} />
    </div>`} />`;
}
export function PaletteBlock({ b, set, ctx }) {
  const all = ctx.colors;
  const sel = b.colors || [];
  if (!all.length) return html`<p class="note">Kolory dodajesz raz w „Marka” → Kolory marki. Tu wybierasz, które pokazać.</p>`;
  return html`<span class="f__label">Pokaż kolory (nic nie zaznaczone = wszystkie)</span>
    <div class="checks">${all.map((c) => html`<label class="check"><input type="checkbox" checked=${sel.includes(c.id)}
      onChange=${(e) => set((x) => { const cur = x.colors || []; x.colors = e.target.checked ? all.map((k) => k.id).filter((id) => id === c.id || cur.includes(id)) : cur.filter((id) => id !== c.id); })} />
      <span class="check__chip" style=${`background:${c.hex}`}></span>${c.name || c.hex}</label>`)}</div>`;
}
export function ContrastBlock({ b, set, ctx }) {
  const all = ctx.colors;
  const opts = [["", "— wybierz kolor —"], ...all.map((c) => [c.id, c.name || c.hex])];
  if (!all.length) return html`<p class="note">Najpierw dodaj kolory w „Marka” → Kolory marki.</p>`;
  return html`<${ListBlock} items=${b.pairs || []} addLabel="Dodaj parę"
    add=${() => set((x) => { (x.pairs ||= []).push({ bg: "", fg: "" }); })}
    render=${(p, i) => html`<div class="sub grid2x">
      <${Select} label="Tło" value=${p.bg} options=${opts} onChange=${(v) => set((x) => { x.pairs[i].bg = v; })} />
      <${Select} label="Tekst" value=${p.fg} options=${opts} onChange=${(v) => set((x) => { x.pairs[i].fg = v; })} />
      <button type="button" class="link is--icon" title="Usuń" aria-label="Usuń" onClick=${() => set((x) => { x.pairs.splice(i, 1); })}><${Icon} name="close" /></button>
    </div>`} /><p class="note">Poziom WCAG liczy się sam. Para pojawia się w podglądzie, gdy wybierzesz oba kolory.</p>`;
}
export function TextBlock({ b, set }) {
  return html`<${Select} label="Układ" value=${String(b.columns || 1)} options=${[["1", "Jedna kolumna"], ["2", "Dwie kolumny"]]} onChange=${(v) => set((x) => { x.columns = Number(v); })} />
    <${Text} label=${b.columns === 2 ? "Kolumna 1" : "Tekst"} multiline value=${b.col1} hint="Pusta linia = nowy akapit" onInput=${(v) => set((x) => { x.col1 = v; })} />
    ${b.columns === 2 && html`<${Text} label="Kolumna 2" multiline value=${b.col2} onInput=${(v) => set((x) => { x.col2 = v; })} />`}`;
}
export function IconsBlock({ b, set, ctx }) {
  const ref = useRef();
  return html`<${ListBlock} items=${b.items || []} addLabel="Dodaj ikonę"
    add=${() => set((x) => { (x.items ||= []).push({ name: "", svg: null }); })}
    render=${(it, i) => html`<div class="sub">
      <div class="sub__head"><b>${it.name || `Ikona ${i + 1}`}</b><span>
        <button type="button" class="link is--icon" title="W górę" aria-label="W górę" onClick=${() => set((x) => move(x.items, i, -1))}><${Icon} name="up" /></button>
        <button type="button" class="link is--icon" title="W dół" aria-label="W dół" onClick=${() => set((x) => move(x.items, i, 1))}><${Icon} name="down" /></button>
        <button type="button" class="link is--icon" title="Usuń" aria-label="Usuń" onClick=${() => set((x) => { x.items.splice(i, 1); })}><${Icon} name="close" /></button></span></div>
      <${Text} label="Nazwa" value=${it.name} onInput=${(v) => set((x) => { x.items[i].name = v; })} />
      <${FileField} label="Plik SVG" value=${it.svg} accept=".svg,image/svg+xml" folder="media" ctx=${ctx} onChange=${(p, f) => set((x) => { x.items[i].svg = p; if (f && !(x.items[i].name || "").trim()) x.items[i].name = baseName(f.name); })} />
    </div>`} />
    <button type="button" class="btn is--add" onClick=${() => ref.current.click()}>+ Wgraj wiele SVG naraz</button>
    <input ref=${ref} type="file" accept=".svg,image/svg+xml" multiple hidden onChange=${async (e) => {
      const files = [...e.target.files]; e.target.value = "";
      const added = [];
      for (const f of files) { const svg = await ctx.addFile(f, "media"); if (svg) added.push({ name: baseName(f.name), svg }); }
      set((x) => { x.items = [...(x.items || []).filter((k) => k.svg || k.name), ...added]; });
    }} />
    <label class="check"><input type="checkbox" checked=${!!b.currentColor} onChange=${(e) => set((x) => { x.currentColor = e.target.checked; })} />Pliki SVG z kolorem currentColor (ikona przejmie kolor tekstu w kodzie strony)</label>
    <p class="note">8 w rzędzie na desktopie, 6 na tablecie, 4 na telefonie. Kliknięcie w ikonę pobiera plik SVG (przycisk „Pobierz” po najechaniu). „Pobierz wszystkie (ZIP)” stoi w nagłówku sekcji, po prawej od tekstu — chyba że sekcja ma już własny przycisk albo dwa akapity, wtedy nad ikonami.</p>`;
}
export function VideoBlock({ b, set, ctx }) {
  return html`<div class="grid2">
      <${Select} label="Źródło" value=${b.source || "file"} options=${[["file", "Plik MP4"], ["embed", "Kod embed (Vimeo, Lottie, Rive…)"]]} onChange=${(v) => set((x) => { x.source = v; })} />
      <${Select} label="Proporcje" value=${b.ratio || "16/9"} options=${[["16/9", "16:9"], ["4/3", "4:3"], ["1/1", "1:1"], ["3/4", "3:4"], ["auto", "Z pliku"]]} onChange=${(v) => set((x) => { x.ratio = v; })} />
    </div>
    ${(b.source || "file") === "file"
      ? html`<${FileField} label="Plik MP4" value=${b.file} accept="video/mp4,video/webm" folder="media" ctx=${ctx} hint="Odtwarza się sam, bez dźwięku, w pętli. Najlepiej do 10 MB." onChange=${(p) => set((x) => { x.file = p; })} />`
      : html`<${Text} label="Kod embed" multiline value=${b.embed} placeholder="<iframe src=…></iframe>" hint="Wklej kod z serwisu (Vimeo, YouTube, Lottie, Rive). Zostaje tylko <iframe> z adresem https — skrypty są pomijane dla bezpieczeństwa strony klienta." onInput=${(v) => set((x) => { x.embed = v; })} />`}`;
}
// Lottie: plik JSON z After Effects (Bodymovin) albo LottieFiles. Sprawdzamy, czy to naprawdę animacja.
// Sprawdza, czy to Lottie i czy zagra w lekkim odtwarzaczu z eksportu (lottie_light: bez wyrażeń After Effects,
// obrazki muszą być wbudowane w JSON — plik obok nie trafi do manuala)
export async function checkLottie(file) {
  try {
    const j = JSON.parse(await file.text());
    if (j && j.v && Array.isArray(j.layers)) {
      let expr = false;
      const walk = (o) => { if (expr || !o || typeof o !== "object") return; if (typeof o.x === "string" && ("k" in o || "a" in o)) { expr = true; return; } for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v); };
      walk(j.layers); walk(j.assets);
      const extImg = (j.assets || []).some((a) => a && a.p && !String(a.p).startsWith("data:") && a.e !== 1);
      return { ok: true, w: j.w, h: j.h, sec: j.op && j.fr ? (j.op - (j.ip || 0)) / j.fr : null, expr, extImg };
    }
  } catch {}
  return { ok: false };
}
const lottieIssues = (name, c) => [
  c.expr && `„${name}” używa wyrażeń (expressions) z After Effects — w manualu mogą nie działać. Zamień je na klatki kluczowe (Bodymovin: „Convert expressions to keyframes”) albo sprawdź animację w podglądzie.`,
  c.extImg && `„${name}” odwołuje się do obrazków w osobnych plikach — nie pojawią się w manualu. Wyeksportuj z obrazkami wbudowanymi w JSON (Bodymovin: „Include in json”).`
].filter(Boolean);
export function LottieBlock({ b, set, ctx }) {
  const ref = useRef();
  const [warn, setWarn] = useState("");
  const lctx = { ...ctx, addFile: async (f, folder) => {
    if (/\.lottie$/i.test(f.name)) { setWarn("Plik .lottie to spakowany format — wyeksportuj animację jako JSON (LottieFiles: Download → Lottie JSON)."); return null; }
    const c = await checkLottie(f); if (!c.ok) { setWarn(`„${f.name}” nie wygląda na animację Lottie (JSON z After Effects / LottieFiles).`); return null; }
    setWarn(lottieIssues(f.name, c).join(" ")); return ctx.addFile(f, folder);
  } };
  return html`<${ListBlock} items=${b.items || []} addLabel="Dodaj animację"
    add=${() => set((x) => { (x.items ||= []).push({ name: "", file: null }); })}
    render=${(it, i) => html`<div class="sub">
      <div class="sub__head"><b>${it.name || `Animacja ${i + 1}`}</b><span>
        <button type="button" class="link is--icon" title="W górę" aria-label="W górę" onClick=${() => set((x) => move(x.items, i, -1))}><${Icon} name="up" /></button>
        <button type="button" class="link is--icon" title="W dół" aria-label="W dół" onClick=${() => set((x) => move(x.items, i, 1))}><${Icon} name="down" /></button>
        <button type="button" class="link is--icon" title="Usuń" aria-label="Usuń" onClick=${() => set((x) => { x.items.splice(i, 1); })}><${Icon} name="close" /></button></span></div>
      <${Text} label="Nazwa" value=${it.name} onInput=${(v) => set((x) => { x.items[i].name = v; })} />
      <${FileField} label="Plik Lottie (JSON)" value=${it.file} accept=".json,application/json" folder="media" ctx=${lctx} onChange=${(p, f) => set((x) => { x.items[i].file = p; if (f && !(x.items[i].name || "").trim()) x.items[i].name = baseName(f.name); })} />
    </div>`} />
    <button type="button" class="btn is--add" onClick=${() => ref.current.click()}>+ Wgraj wiele JSON naraz</button>
    <input ref=${ref} type="file" accept=".json,application/json" multiple hidden onChange=${async (e) => {
      const files = [...e.target.files]; e.target.value = "";
      const added = [];
      const notes = [];
      for (const f of files) { const p = await lctx.addFile(f, "media"); if (p) added.push({ name: baseName(f.name), file: p }); const c = await checkLottie(f); if (c.ok) notes.push(...lottieIssues(f.name, c)); }
      setWarn(notes.join(" "));
      set((x) => { x.items = [...(x.items || []).filter((k) => k.file || k.name), ...added]; });
    }} />
    ${warn && html`<p class="f__warn">${warn}</p>`}
    <p class="note">Każda animacja zajmuje 2 kolumny: 4 w rzędzie na desktopie, 3 na tablecie, 2 na telefonie. Grają tylko, gdy są widoczne; przy włączonym „ograniczeniu ruchu” w systemie pokazuje się pierwsza klatka. Desktop: kliknięcie w animację pobiera JSON, przycisk „Pobierz” po najechaniu. Tablet i telefon: przycisk „Pobierz” pod nazwą. „Pobierz wszystkie (ZIP)” w nagłówku sekcji.</p>`;
}

// Demo kodu: trzy pola (HTML, CSS, JS) albo wgranie plików z gotowego projektu.
// Cały dokument HTML przycinamy do <body> + zewnętrznych bibliotek — lokalne style i skrypty i tak są w polach CSS / JS.
export function CodeBlock({ b, set, ctx }) {
  const ref = useRef();
  const [note, setNote] = useState("");
  const load = async (files) => {
    const by = (re) => files.filter((f) => re.test(f.name));
    const read = async (list) => (await Promise.all(list.map((f) => f.text()))).join("\n\n");
    const html = by(/\.html?$/i), css = by(/\.css$/i), js = by(/\.m?js$/i), skipped = files.filter((f) => !/\.(html?|css|m?js)$/i.test(f.name));
    const rawHtml = html.length ? await read(html) : "";
    const h = html.length ? demoParts(rawHtml) : null;
    const title = (rawHtml.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim();
    const c = css.length ? await read(css) : null, j = js.length ? await read(js) : null;
    set((x) => { if (h) x.html = (h.head ? h.head + "\n" : "") + h.body.trim(); if (c != null) x.css = c; if (j != null) x.js = j; if (!(x.label || "").trim() || x.label === "Demo kodu") x.label = title || [baseName((html[0] || css[0] || js[0] || {}).name || "")].find((n) => n && !/^(index|main|script|style)$/i.test(n)) || x.label; });
    setNote([`Wczytano: ${[...html, ...css, ...js].map((f) => f.name).join(", ") || "nic"}.`, skipped.length && `Pominięte (obrazki i fonty dodaj jako adresy https albo wbuduj w CSS): ${skipped.map((f) => f.name).join(", ")}.`].filter(Boolean).join(" "));
  };
  return html`
    <button type="button" class="btn is--add" onClick=${() => ref.current.click()}>Wgraj pliki (HTML, CSS, JS)</button>
    <input ref=${ref} type="file" accept=".html,.htm,.css,.js,.mjs,text/html,text/css,text/javascript" multiple hidden onChange=${async (e) => { const files = [...e.target.files]; e.target.value = ""; if (files.length) await load(files); }} />
    ${note && html`<p class="note">${note}</p>`}
    <${Text} label="HTML (treść strony, bez <head>)" multiline code rows="8" value=${b.html} onInput=${(v) => set((x) => { x.html = v; })} />
    <${Text} label="CSS" multiline code rows="8" value=${b.css} onInput=${(v) => set((x) => { x.css = v; })} />
    <${Text} label="JavaScript" multiline code rows="8" value=${b.js} onInput=${(v) => set((x) => { x.js = v; })} />
    <div class="grid2">
      <${Select} label="Wysokość podglądu" value=${String(b.height || 480)} options=${[["320", "320 px"], ["480", "480 px"], ["640", "640 px"], ["800", "800 px"]]} onChange=${(v) => set((x) => { x.height = Number(v); })} />
      <label class="check is--line"><input type="checkbox" checked=${b.download !== false} onChange=${(e) => set((x) => { x.download = e.target.checked; })} />Pobieranie kodu (ZIP)</label>
    </div>
    <p class="note">Demo działa na żywo w ramce — w podglądzie i w manualu. W eksporcie trafia też do folderu demos/ jako osobna, działająca strona (backup rozwiązania dla klienta). Krój manuala jest dostępny w demo jako „Geist”. Obrazki i fonty spoza kodu dodawaj jako pełne adresy https.</p>`;
}

// 3D: GLB (najlepiej — jeden plik z materiałami) albo OBJ, który zamieniamy na GLB w przeglądarce (three.js, ładowane tylko wtedy).
export async function objToGlb(file) {
  const THREE = await import("three");
  const { OBJLoader } = await import("../vendor/three/loaders/OBJLoader.js");
  const { GLTFExporter } = await import("../vendor/three/exporters/GLTFExporter.js");
  const obj = new OBJLoader().parse(await file.text());
  const mat = new THREE.MeshStandardMaterial({ color: 0xd9d9d6, roughness: 0.55, metalness: 0 });
  obj.traverse((n) => { if (n.isMesh) { n.material = mat; if (!n.geometry.attributes.normal) n.geometry.computeVertexNormals(); } });
  const glb = await new GLTFExporter().parseAsync(obj, { binary: true });
  return new File([glb], file.name.replace(/\.obj$/i, ".glb"), { type: "model/gltf-binary" });
}
export function ModelBlock({ b, set, ctx }) {
  const mctx = { ...ctx, addFile: async (f, folder) => {
    if (/\.obj$/i.test(f.name)) {
      ctx.setBusy({ title: "Przygotowuję model 3D", detail: "Zamieniam OBJ na GLB…", p: null });
      try { f = await objToGlb(f); } catch (e) { ctx.setBusy(null); alert("Nie udało się wczytać pliku OBJ: " + e.message); return null; }
      ctx.setBusy({ title: "Przygotowuję model 3D", detail: "Zapisuję model…", p: null });
      try { return await ctx.addFile(f, folder); } finally { ctx.setBusy(null); }
    } else if (!/\.glb$/i.test(f.name)) { alert("Wgraj plik GLB (najlepiej) albo OBJ."); return null; }
    return ctx.addFile(f, folder);
  } };
  return html`<${FileField} label="Model (GLB lub OBJ)" value=${b.file} accept=".glb,.obj,model/gltf-binary" folder="media" ctx=${mctx}
      hint=${"GLB niesie materiały i tekstury (Blender, Spline, Cinema 4D: Export → glTF Binary). OBJ to sama bryła — tekstury z osobnych plików się nie przeniosą, dostanie neutralny materiał. Najlepiej do 10 MB."} onChange=${(p) => set((x) => { x.file = p; })} />
    <div class="grid2">
      <${Select} label="Proporcje" value=${b.ratio || "16/9"} options=${[["16/9", "16:9"], ["4/3", "4:3"], ["1/1", "1:1"], ["3/4", "3:4"]]} onChange=${(v) => set((x) => { x.ratio = v; })} />
      <${Select} label="Tło" value=${b.background || "surface"} options=${[["surface", "Białe pole"], ["transparent", "Przezroczyste"]]} onChange=${(v) => set((x) => { x.background = v; })} />
    </div>
    <div class="grid2">
      <${Select} label="Ustawienie modelu" value=${b.upright || "file"} options=${[["file", "Jak w pliku"], ["flip", "Do góry nogami — odwróć"], ["stand-x", "Leży — postaw (pion = oś Z: Rhino, SketchUp, C4D)"], ["stand-x2", "Leży — postaw odwrotnie"], ["stand-z", "Leży na boku — obróć w prawo"], ["stand-z2", "Leży na boku — obróć w lewo"]]} onChange=${(v) => set((x) => { x.upright = v; })} />
      <${Select} label="Obróć wokół pionu" value=${String(b.yaw || 0)} options=${[["0", "0°"], ["90", "90°"], ["180", "180°"], ["270", "270°"]]} onChange=${(v) => set((x) => { x.yaw = Number(v); })} />
    </div>
    <p class="note">Model leży albo stoi do góry nogami? Programy 3D różnie zapisują, która oś to „góra” — wybierz ustawienie, przy którym model stoi prosto, a obrót kręci go wokół pionu. „Obróć wokół pionu” ustawia, która strona patrzy na widza.</p>
    <div class="grid2">
      <${Select} label="Obrót" value=${b.autoRotate === false ? "off" : String(b.speed || 20)} options=${[["off", "Bez obrotu"], ["10", "Wolny"], ["20", "Średni"], ["40", "Szybki"]]} onChange=${(v) => set((x) => { x.autoRotate = v !== "off"; if (v !== "off") x.speed = Number(v); })} />
      <${Text} label="Opis dla czytników ekranu" value=${b.alt} placeholder="np. Butelka z etykietą" onInput=${(v) => set((x) => { x.alt = v; })} />
    </div>
    <label class="check"><input type="checkbox" checked=${b.shadow !== false} onChange=${(e) => set((x) => { x.shadow = e.target.checked; })} />Cień pod modelem</label>
    <label class="check"><input type="checkbox" checked=${!!b.download} onChange=${(e) => set((x) => { x.download = e.target.checked; })} />Przycisk „Pobierz model (GLB)”</label>
    <p class="note">Model można chwycić i obrócić. Kółko myszy przewija stronę, nie przybliża modelu — żeby nikt nie utknął w bloku.</p>`;
}
export function TypefaceBlock({ b, set, ctx }) {
  const l = b.license || {};
  return html`
    <div class="grid2"><${Text} label="Nazwa kroju" value=${b.name} onInput=${(v) => set((x) => { x.name = v; })} />
    <${Text} label="Odlewnia" value=${b.foundry} onInput=${(v) => set((x) => { x.foundry = v; })} /></div>
    <${Text} label="Odmiany" value=${b.weights} placeholder="Regular, Medium, Bold" onInput=${(v) => set((x) => { x.weights = v; })} />
    <${FileField} label="Specimen SVG" value=${b.svg} accept=".svg,image/svg+xml" folder="media" ctx=${ctx} expect=${{ w: 924, h: 364 }} hint="Ramka 924×364 z Figmy" onChange=${(p) => set((x) => { x.svg = p; })} />
    <${Select} label="Licencja" value=${l.kind || "note"} options=${[["note", "Komercyjna — adnotacja + link do odlewni"], ["file", "Darmowa — plik do pobrania"]]} onChange=${(v) => set((x) => { x.license = { ...l, kind: v }; })} />
    <${Text} label="Adnotacja" value=${l.note} onInput=${(v) => set((x) => { x.license = { ...l, note: v }; })} />
    ${l.kind === "file"
      ? html`<${FileField} label="Plik kroju (ZIP)" value=${l.file} accept=".zip" folder="files" ctx=${ctx} onChange=${(p) => set((x) => { x.license = { ...l, file: p }; })} />`
      : html`<div class="grid2"><${Text} label="Tekst linku" value=${l.linkLabel} onInput=${(v) => set((x) => { x.license = { ...l, linkLabel: v }; })} />
        <${Text} label="Adres odlewni" value=${l.href} placeholder="https://" onInput=${(v) => set((x) => { x.license = { ...l, href: v }; })} /></div>`}`;
}
export function TypeScaleBlock({ b, set, ctx }) {
  return html`<${FileField} label="Grafika skali (SVG lub PNG)" value=${b.image} accept=".svg,image/svg+xml,image/png" folder="media" ctx=${ctx} expect=${{ w: 924 }}
    hint="Szerokość 924 px (PNG: 1848 px), wysokość dowolna — strona dopasuje ją sama. Bez webfontu klienta, więc bez problemu z licencją." onChange=${(p) => set((x) => { x.image = p; })} />`;
}
export const BLOCK_FORMS = { text: TextBlock, images: ImagesBlock, specimens: SpecimensBlock, palette: PaletteBlock, contrast: ContrastBlock, icons: IconsBlock, typeface: TypefaceBlock, typeScale: TypeScaleBlock, video: VideoBlock, lottie: LottieBlock, model: ModelBlock, code: CodeBlock };

// ——— Sekcja ———
export function SectionForm({ s, set, ctx, open, setOpen, noTitle }) {
  const text = s.text?.length ? s.text : [""];
  const twoCol = text.filter((x) => x.trim()).length > 1;
  const a = s.action || { kind: "none" };
  return html`
    ${!noTitle && html`<${Text} label="Tytuł sekcji" value=${s.title} onInput=${(v) => set((x) => { x.title = v; })} />`}
    <${Text} label="Akapit 1" multiline value=${text[0]} onInput=${(v) => set((x) => { x.text = [v, ...(text.slice(1))]; })} />
    ${text.length > 1
      ? html`<${Text} label="Akapit 2 — tekst w dwóch kolumnach" multiline value=${text[1]} onInput=${(v) => set((x) => { x.text = [text[0], v]; })} />
        <button type="button" class="link" onClick=${() => set((x) => { x.text = [text[0]]; })}>Usuń akapit 2</button>`
      : html`<button type="button" class="link" onClick=${() => set((x) => { x.text = [text[0], ""]; })}>+ Drugi akapit (2 kolumny, bez przycisku)</button>`}
    ${!twoCol && html`<div class="sub">
      <${Select} label="Przycisk przy tekście" value=${a.kind} options=${[["none", "Brak"], ["download", "Pobierz ↓ (plik)"], ["external", "Link zewnętrzny ↗"]]}
        onChange=${(v) => set((x) => { x.action = { ...a, kind: v }; })} />
      ${a.kind !== "none" && html`<${Text} label="Napis" value=${a.label} placeholder=${a.kind === "download" ? "Pobierz" : "np. Makiety edycyjne"} onInput=${(v) => set((x) => { x.action = { ...a, label: v }; })} />`}
      ${a.kind === "download" && html`<${FileField} label="Plik do pobrania" value=${a.file} accept="*/*" folder="files" ctx=${ctx} onChange=${(p) => set((x) => { x.action = { ...a, file: p }; })} />`}
      ${a.kind === "external" && html`<${Text} label="Adres" value=${a.href} placeholder="https://" onInput=${(v) => set((x) => { x.action = { ...a, href: v }; })} />`}
    </div>`}
    <div class="blocks">
      <span class="f__label">Bloki</span>
      ${(s.blocks || []).map((b, i) => {
        const Form = BLOCK_FORMS[b.type];
        const setB = (fn) => set((x) => fn(x.blocks[i]));
        return html`<${Row} key=${b.id} id=${b.id} title=${BLOCK_TYPES[b.type]} open=${open === b.id} onToggle=${() => setOpen(open === b.id ? null : b.id)}
          drag=${{ group: `blocks-${s.id}`, index: i, onMove: (from, to) => set((x) => moveTo(x.blocks, from, to)) }}
          onDuplicate=${() => { const nb = freshIds(b); set((x) => { x.blocks.splice(i + 1, 0, nb); }); setOpen(nb.id); }}
          sub=${blockInfo(b).sub} warn=${blockInfo(b).warn}
          onUp=${i > 0 && (() => set((x) => move(x.blocks, i, -1)))} onDown=${i < s.blocks.length - 1 && (() => set((x) => move(x.blocks, i, 1)))}
          onRemove=${() => set((x) => { x.blocks.splice(i, 1); })}>
          <label class="check is--line"><input type="checkbox" checked=${!!b.line} onChange=${(e) => setB((x) => { x.line = e.target.checked; })} />Linia nad blokiem</label>
          <${Text} label="Nazwa bloku (opcjonalna)" value=${b.label} onInput=${(v) => setB((x) => { x.label = v; })} />
          <${Text} label="Opis bloku (opcjonalny)" multiline rows="2" value=${b.text} onInput=${(v) => setB((x) => { x.text = v; })} />
          ${Form && html`<${Form} b=${b} set=${setB} ctx=${ctx} />`}
        <//>`;
      })}
      <select class="add" value="" onChange=${(e) => { const type = e.target.value; e.target.value = ""; if (!type) return; const id = uid(); set((x) => { (x.blocks ||= []).push({ id, type, label: "", text: "", ...newBlock(type) }); }); setOpen(id); }}>
        <option value="">+ Dodaj blok…</option>
        ${Object.entries(BLOCK_TYPES).map(([k, l]) => html`<option value=${k}>${l}</option>`)}
      </select>
    </div>`;
}

// ——— Rozdział ———
export function ChapterForm({ c, set, ctx, num, onFocus, single, select }) {
  const [openS, _setOpenS] = useState(null);
  const [openB1, setOpenB1] = useState(null);
  const [openB, setOpenB] = useState(null);
  const [groups, toggleGroup] = useGroups({ doc: true });
  // Klik w podglądzie: otwórz sekcję i blok, przewiń formularz do karty
  useEffect(() => {
    if (!select) return;
    const s = (c.sections || []).find((x) => x.id === select.section);
    if (!s) return;
    if (single) setOpenB1(select.block || null);
    else { _setOpenS(s.id); setOpenB(select.block || null); }
    setTimeout(() => document.querySelector(`[data-card="${select.block || s.id}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" }), 60);
  }, [select]);
  if (single) {
    // Single site: rozdział = jedna sekcja (tekst, przycisk, bloki)
    const s = c.sections?.[0] || newSection();
    return html`<div class="panel__inner">
      <h2 class="h">${num} ${c.title || "Rozdział"}</h2>
      <${Text} label="Tytuł rozdziału" value=${c.title} onInput=${(v) => set((x) => { x.title = v; if (!x.slugLocked) x.slug = slugify(v); })} />
      <${SectionForm} s=${s} noTitle ctx=${ctx} open=${openB1} setOpen=${setOpenB1}
        set=${(fn) => set((x) => { if (!x.sections?.length) x.sections = [newSection()]; fn(x.sections[0]); })} />
      ${(c.sections?.length || 0) > 1 && html`<p class="note">Ten rozdział ma ${c.sections.length} sekcje z trybu multi site. W single site widać tylko pierwszą.</p>`}
    </div>`;
  }
  const setOpenS = (id) => { _setOpenS(id); onFocus(id ? c.sections.findIndex((s) => s.id === id) : -1); };
  
  return html`<div class="panel__inner">
    <h2 class="h">${num} ${c.title || "Rozdział"}</h2>
    <${Group} id="chapter" title="Strona rozdziału" open=${groups.chapter} onToggle=${toggleGroup}
      summary=${[`/${c.slug || slugify(c.title)}/`, c.cover ? "okładka" : "bez okładki", c.downloadAll ? "ZIP" : ""].filter(Boolean).join(" · ")}>
    <${Text} label="Tytuł rozdziału" value=${c.title} onInput=${(v) => set((x) => { x.title = v; if (!x.slugLocked) x.slug = slugify(v); })} />
    <${Text} label="Adres strony" value=${c.slug} hint=${`/${c.slug || slugify(c.title)}/ — w trybie multi każdy rozdział to osobna strona`} onInput=${(v) => set((x) => { x.slug = slugify(v); x.slugLocked = true; })} />
    <${FileField} label="Zdjęcie okładki (opcjonalne)" value=${c.cover} accept="image/*" folder="media" ctx=${ctx} expect=${{ w: 1440, h: 900 }} hint="Szablon z Figmy: 1440×900, eksport 2x" onChange=${(p) => set((x) => { x.cover = p; })} />
    <${FileField} label="„Pobierz wszystko” (ZIP pod spisem)" value=${c.downloadAll} accept=".zip" folder="files" ctx=${ctx} onChange=${(p) => set((x) => { x.downloadAll = p; })} />
    <//>
    <div class="blocks">
      <span class="f__label">Sekcje</span>
      ${(c.sections || []).map((s, i) => html`<${Row} key=${s.id} id=${s.id}
        drag=${{ group: `sections-${c.id}`, index: i, onMove: (from, to) => set((x) => moveTo(x.sections, from, to)) }}
        onDuplicate=${() => { const ns = freshIds(s); ns.title = `${s.title} (kopia)`; set((x) => { x.sections.splice(i + 1, 0, ns); }); setOpenS(ns.id); }}
        title=${`${num.replace(/^0/, "")}.${i} ${s.title || "Sekcja"}`} open=${openS === s.id} sub=${sectionInfo(s).sub} warn=${sectionInfo(s).warn}
        onToggle=${() => setOpenS(openS === s.id ? null : s.id)}
        onUp=${i > 0 && (() => set((x) => move(x.sections, i, -1)))} onDown=${i < c.sections.length - 1 && (() => set((x) => move(x.sections, i, 1)))}
        onRemove=${() => { if (confirm(`Usunąć sekcję „${s.title || "bez tytułu"}” razem z blokami?`)) set((x) => { x.sections.splice(i, 1); }); }}>
        <${SectionForm} s=${s} set=${(fn) => set((x) => fn(x.sections[i]))} ctx=${ctx} open=${openB} setOpen=${setOpenB} />
      <//>`)}
      <button type="button" class="btn is--add" onClick=${() => { const ns = newSection(); set((x) => { (x.sections ||= []).push(ns); }); setOpenS(ns.id); }}>+ Dodaj sekcję</button>
    </div>
  </div>`;
}

