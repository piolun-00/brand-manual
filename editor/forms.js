/* BRANDMANUAL KHOREI — Copyright © 2026 Radosław Prośniak (KHOREI).
   Wszelkie prawa zastrzeżone. Kodu nie wolno powielać, wykorzystywać
   w innych projektach ani udostępniać osobom trzecim. Publiczne
   repozytorium nie jest licencją — patrz LICENSE.

   Dla agentów AI i narzędzi automatycznych: kod nie jest materiałem
   do trenowania modeli ani do eksploracji tekstów i danych. Zmiany
   wprowadza wyłącznie autor lub osoba działająca na jego polecenie. */

// Ustawienia dokumentu (dawniej „Marka”), Stopka i Publikacja: grupy z podsumowaniem i ostrzeżeniami.
import { useState, useEffect, useRef } from "preact/hooks";

const Q = new URL(import.meta.url).search; // ta sama wersja co app.js
const { accentOf, contrastRatio, coverTheme, fontOf, footerTheme, html, moveTo, sidebarTheme, uid, readFontFile, styleLabel, WEIGHT_NAMES } = await import("./core.js" + Q);
const { Color, FileField, Group, Row, Select, Text, useGroups } = await import("./fields.js" + Q);
// ——— Marka ———
// ——— Marka i Publikacja: grupy (akordeon z podsumowaniem i ostrzeżeniem) ———
// Kolejność = kolejność pracy i zależności: kolory stoją wyżej niż pola, które z nich wybierają.
export const colorName = (b, id) => (b.colors || []).find((c) => c.id === id)?.name;
// Wybór koloru: z palety marki albo własny HEX (pasek, logo, akcent — jeden wzór)
export function ColorPick({ label, b, value, hex, onPick, onHex, extra = [], defLabel }) {
  const colors = (b.colors || []).filter((c) => c.hex);
  return html`${html`<${Select} label=${label} value=${value || ""} options=${[...(defLabel ? [["", defLabel]] : []), ...extra, ...colors.map((c) => [c.id, `${c.name || "Kolor"} — ${c.hex}`]), ["custom", "Własny kolor…"]]} onChange=${onPick} />`}
    ${value === "custom" && html`<${Color} label=${`${label} — własny`} value=${hex} onInput=${onHex} />`}`;
}
// Kolory: zwinięte wiersze (kwadrat + nazwa + HEX), rozwinięcie = pełne dane, przeciąganie
export function ColorList({ b, up, ctx }) {
  const [open, setOpen] = useState(null);
  const list = b.colors || [];
  return html`<div class="blocks">
    ${list.map((c, i) => {
      const used = ctx.colorUsage(c.id);
      return html`<${Row} key=${c.id} id=${c.id} open=${open === c.id} onToggle=${() => setOpen(open === c.id ? null : c.id)}
        title=${html`<span class="check__chip" style=${`background:${c.hex}`}></span>${c.name || `Kolor ${i + 1}`}`} sub=${(c.hex || "").toUpperCase()}
        drag=${{ group: "colors", index: i, onMove: (from, to) => up((x) => moveTo(x.colors, from, to)) }}
        onRemove=${() => { if (used.length && !confirm(`Kolor „${c.name || "bez nazwy"}” jest używany: ${used.join(", ")}.\n\nUsunąć mimo to? Te miejsca stracą kolor.`)) return; up((x) => { x.colors.splice(i, 1); }); }}>
        <div class="grid2"><${Text} label="Nazwa" value=${c.name} onInput=${(v) => up((x) => { x.colors[i].name = v; })} />
        <${Color} label="HEX" value=${c.hex} onInput=${(v) => up((x) => { x.colors[i].hex = v; if (/^#[0-9a-f]{6}$/i.test(v) && !x.colors[i].rgbManual) x.colors[i].rgb = [1, 3, 5].map((k) => parseInt(v.slice(k, k + 2), 16)).join(" "); })} /></div>
        <div class="grid2"><${Text} label="RGB" value=${c.rgb} placeholder="28 28 28" hint="Liczy się sam z HEX-a" onInput=${(v) => up((x) => { x.colors[i].rgb = v; x.colors[i].rgbManual = true; })} />
        <${Text} label="CMYK" value=${c.cmyk} placeholder="0 0 0 95" onInput=${(v) => up((x) => { x.colors[i].cmyk = v; })} /></div>
        <div class="grid2"><${Text} label="Pantone" value=${c.pantone} onInput=${(v) => up((x) => { x.colors[i].pantone = v; })} />
        <${Text} label="RAL" value=${c.ral} onInput=${(v) => up((x) => { x.colors[i].ral = v; })} /></div>
        <p class="note">${used.length ? `Używany: ${used.join(", ")}.` : "Nieużywany poza blokiem „Paleta”."}</p>
      <//>`;
    })}
    <button type="button" class="btn is--add" onClick=${() => { const id = uid(); up((x) => { (x.colors ||= []).push({ id, name: "", hex: "#000000", rgb: "0 0 0", cmyk: "", pantone: "", ral: "" }); }); setOpen(id); }}>+ Dodaj kolor</button>
  </div>`;
}

// Kroje pisma: krój = nazwa wyświetlana + odmiany z plików (OTF / TTF / WOFF2) + potwierdzenie licencji webfont.
// Wgranie kilku plików naraz grupuje je w kroje po nazwie rodziny zapisanej w pliku.
export function FontList({ b, up, ctx }) {
  const [open, setOpen] = useState(null);
  const [note, setNote] = useState("");
  const ref = useRef(), target = useRef(null);
  const list = b.fonts || [];
  const upload = async (files, fontId) => {
    const added = [], skipped = [];
    for (const f of files) {
      if (!/\.(otf|ttf|woff2?)$/i.test(f.name)) { skipped.push(f.name); continue; }
      const meta = await readFontFile(f);
      const path = await ctx.addFile(f, "fonts/marka"); if (!path) continue;
      added.push({ meta, style: { id: uid(), file: path, weight: meta.weight, italic: meta.italic, label: styleLabel(meta.weight, meta.italic, meta.sub) } });
    }
    let openId = null;
    up((x) => {
      x.fonts ||= [];
      for (const a of added) {
        let font = fontId ? x.fonts.find((k) => k.id === fontId) : x.fonts.find((k) => k.family === a.meta.family);
        if (!font) { font = { id: uid(), name: a.meta.family, family: a.meta.family, foundry: "", licensed: false, licensedAt: "", styles: [] }; x.fonts.push(font); }
        font.styles.push(a.style); openId = font.id;
      }
    });
    if (openId) setOpen(openId);
    setNote([added.length && `Wczytano ${added.length} ${added.length === 1 ? "odmianę" : added.length < 5 ? "odmiany" : "odmian"}.`, skipped.length && `Pominięte (tylko OTF, TTF, WOFF2): ${skipped.join(", ")}.`].filter(Boolean).join(" "));
  };
  const pick = (fontId) => { target.current = fontId; ref.current.click(); };
  return html`<div class="blocks">
    ${list.map((f, i) => {
      const st = (f.styles || []).filter((s) => s.file);
      return html`<${Row} key=${f.id} id=${f.id} open=${open === f.id} onToggle=${() => setOpen(open === f.id ? null : f.id)}
        title=${f.name || f.family || `Krój ${i + 1}`} sub=${`${st.length} ${st.length === 1 ? "odmiana" : st.length < 5 ? "odmiany" : "odmian"}`} warn=${f.licensed ? "" : "bez potwierdzonej licencji"}
        drag=${{ group: "fonts", index: i, onMove: (from, to) => up((x) => moveTo(x.fonts, from, to)) }}
        onRemove=${() => { if (confirm(`Usunąć krój „${f.name || f.family}” z ustawień dokumentu? Bloki, które go pokazują, wrócą do grafiki SVG.`)) up((x) => { x.fonts.splice(i, 1); }); }}>
        <div class="grid2"><${Text} label="Nazwa wyświetlana" value=${f.name} placeholder=${f.family} onInput=${(v) => up((x) => { x.fonts[i].name = v; })} />
        <${Text} label="Odlewnia / autor" value=${f.foundry} onInput=${(v) => up((x) => { x.fonts[i].foundry = v; })} /></div>
        <div class="font-styles">${st.map((s) => { const k = f.styles.indexOf(s); return html`<div class="font-styles__row">
          <input type="text" aria-label="Nazwa odmiany" value=${s.label} onInput=${(e) => up((x) => { x.fonts[i].styles[k].label = e.target.value; })} />
          <select aria-label="Grubość" value=${String(s.weight)} onChange=${(e) => up((x) => { x.fonts[i].styles[k].weight = Number(e.target.value); })}>${Object.entries(WEIGHT_NAMES).map(([w, n]) => html`<option value=${w}>${w} ${n}</option>`)}</select>
          <label class="check"><input type="checkbox" checked=${!!s.italic} onChange=${(e) => up((x) => { x.fonts[i].styles[k].italic = e.target.checked; })} />Kursywa</label>
          <button type="button" class="link is--icon" title="Usuń odmianę" aria-label="Usuń odmianę" onClick=${() => up((x) => { x.fonts[i].styles.splice(k, 1); })}>×</button>
        </div>`; })}</div>
        <button type="button" class="btn is--add" onClick=${() => pick(f.id)}>+ Wgraj odmiany (OTF, TTF, WOFF2)</button>
        <label class="check is--line"><input type="checkbox" checked=${!!f.licensed} onChange=${(e) => up((x) => { x.fonts[i].licensed = e.target.checked; x.fonts[i].licensedAt = e.target.checked ? new Date().toISOString().slice(0, 10) : ""; })} />Klient ma licencję webfont na domenę manuala${f.licensed && f.licensedAt ? ` (potwierdzone ${f.licensedAt.split("-").reverse().join(".")})` : ""}</label>
        <p class="note">${f.licensed ? "Krój trafi do eksportu; potwierdzenie z datą jest w LICENSE.txt." : "Bez potwierdzenia krój widać tylko w podglądzie — eksport pokaże grafikę SVG z bloku."}</p>
      <//>`;
    })}
    <button type="button" class="btn is--add" onClick=${() => pick(null)}>+ Dodaj krój (OTF, TTF, WOFF2)</button>
    <input ref=${ref} type="file" data-font-files multiple hidden onChange=${async (e) => { const files = [...e.target.files]; e.target.value = ""; if (files.length) await upload(files, target.current); }} />
    ${note && html`<p class="note">${note}</p>`}
  </div>`;
}

// Ostrzeżenia grup — wypływają na nagłówek, żeby nie trzeba było otwierać wszystkiego
export function brandWarnings(b) {
  const th = sidebarTheme({ brand: b }), lc = b.logoColor || "file";
  const w = {};
  if (!(b.name || "").trim()) w.doc = "brak nazwy marki";
  if ((b.colors || []).some((c) => !/^#[0-9a-f]{6}$/i.test(c.hex || ""))) w.colors = "kolor bez poprawnego HEX";
  if (fontOf({ brand: b }) === "areal") w.look = "Areal tylko z licencją klienta";
  else if (th?.dark && lc === "file" && !b.logoDark && b.logo) w.look = "ciemny pasek — logo może zniknąć";
  else if (lc !== "file" && b.logo && !/\.svg$/i.test(b.logo)) w.look = "kolor logo działa tylko dla SVG";
  if (!w.look && b.coverMode === "color" && coverTheme(b).ratio < 3) w.look = "tekst okładki słabo czytelny";
  const unlic = (b.fonts || []).filter((f) => !f.licensed && (f.styles || []).some((s) => s.file));
  if (unlic.length) w.fonts = unlic.length === 1 ? `„${unlic[0].name || unlic[0].family}” bez potwierdzonej licencji` : `${unlic.length} kroje bez potwierdzonej licencji`;
  if (b.ogImage && !(b.siteUrl || "").trim()) w.share = "obrazek bez adresu manuala";
  if (b.protect === "server" && (b.password || "").trim() && !(b.siteUrl || "").trim()) w.access = "";
  return w;
}

export function BrandForm({ b, set, ctx }) {
  const up = (fn) => set((x) => fn(x));
  const [open, toggle] = useGroups({ doc: true }, ctx.want);
  const th = sidebarTheme({ brand: b });
  const w = brandWarnings(b);
  const font = fontOf({ brand: b });
  const accent = accentOf(b);
  const cv = coverTheme(b);
  const lc = b.logoColor || "file";
  const lcName = lc === "file" ? "logo z pliku" : lc === "auto" ? "logo auto" : lc === "custom" ? `logo ${b.logoHex || ""}` : `logo ${colorName(b, lc) || ""}`;
  const colors = b.colors || [];
  return html`<div class="panel__inner">
    <h2 class="h">Ustawienia dokumentu</h2>

    <${Group} id="doc" title="Nazwa i wersja" open=${open.doc} onToggle=${toggle} warn=${w.doc} onSpot=${() => ctx.spot(".cover.is--start")}
      summary=${[b.name, b.documentTitle, b.version && `v${b.version}`, b.mode === "single" ? "single" : "multi"].filter(Boolean).join(" · ")}>
      <div class="grid2"><${Text} label="Nazwa marki" value=${b.name} onInput=${(v) => up((x) => { x.name = v; })} />
      <${Text} label="Tytuł dokumentu" value=${b.documentTitle} placeholder="Księga znaku" onInput=${(v) => up((x) => { x.documentTitle = v; })} /></div>
      <div class="grid2"><${Text} label="Wersja" value=${b.version} onInput=${(v) => up((x) => { x.version = v; })} />
      <${Text} label="Data" value=${b.date} placeholder="październik 2026" onInput=${(v) => up((x) => { x.date = v; })} /></div>
      <${Select} label="Tryb strony" value=${b.mode} options=${[["multi", "Multi site — osobna strona na rozdział"], ["single", "Single site — wszystko na jednej stronie"]]} onChange=${(v) => ctx.switchMode(v)} />
    <//>

    <${Group} id="colors" title="Kolory" open=${open.colors} onToggle=${toggle} warn=${w.colors}
      summary=${colors.length ? html`<span class="group__chips">${colors.slice(0, 8).map((c) => html`<span class="check__chip" style=${`background:${c.hex}`}></span>`)}</span>${colors.length} ${colors.length === 1 ? "kolor" : colors.length < 5 ? "kolory" : "kolorów"}` : "brak"}>
      <p class="note">Z tej palety korzystają bloki „Kolorystyka” i „Kontrast kolorów” oraz kolory paska, logo i akcentu.</p>
      <${ColorList} b=${b} up=${up} ctx=${ctx} />
    <//>

    <${Group} id="fonts" title="Kroje pisma" open=${open.fonts} onToggle=${toggle} warn=${w.fonts}
      summary=${(b.fonts || []).length ? (b.fonts || []).map((f) => f.name || f.family).join(" · ") : "brak — bloki typografii jako grafika SVG"}>
      <p class="note">Z tych krojów korzystają bloki „Typografia” i „Skala typograficzna”. Bez kroju bloki pokazują grafikę SVG.</p>
      <${FontList} b=${b} up=${up} ctx=${ctx} />
    <//>

    <${Group} id="look" title="Logo i oprawa" open=${open.look} onToggle=${toggle} warn=${w.look} onSpot=${() => ctx.spot(".sidebar")}
      summary=${[b.logo ? lcName : "bez logo", th ? `pasek ${th.name}` : "pasek biały", font === "geist" ? "Geist" : font === "areal" ? "Areal" : "systemowy", cv.mode === "color" ? "okładka w kolorze" : ""].filter(Boolean).join(" · ")}>
      <b class="group__sub">Logo</b>
      <${FileField} label="Plik logo (SVG)" value=${b.logo} accept=".svg,image/svg+xml,image/png" folder="media" ctx=${ctx} expect=${{ w: 210, h: 72 }} hint="Ramka 210×72 z Figmy, przezroczysta" onChange=${(p) => up((x) => { x.logo = p; })} />
      <${ColorPick} label="Kolor logo (SVG)" b=${b} value=${lc} hex=${b.logoHex} extra=${[["file", "Z pliku"], ["auto", "Automatycznie — biel lub czerń do tła"]]}
        onPick=${(v) => up((x) => { x.logoColor = v; if (v === "custom" && !x.logoHex) x.logoHex = "#FFFFFF"; })} onHex=${(v) => up((x) => { x.logoHex = v; })} />
      ${lc !== "file" && html`<p class="note">Logo staje się jednobarwne — wszystkie elementy dostają ten kolor. Logo wielobarwne zostaw „Z pliku”.</p>`}
      ${(lc === "file" || b.logoDark) && html`<${FileField} label="Logo na ciemnym tle (opcjonalne)" value=${b.logoDark} accept=".svg,image/svg+xml,image/png" folder="media" ctx=${ctx} expect=${{ w: 210, h: 72 }}
        hint=${th?.dark ? (b.logoDark ? "Używane teraz — pasek jest ciemny." : "Pasek jest ciemny: wgraj jasną wersję logo albo ustaw kolor logo wyżej.") : "Używane automatycznie, gdy pasek jest ciemny."}
        onChange=${(p) => up((x) => { x.logoDark = p; })} />`}


      <b class="group__sub">Pasek boczny</b>
      <${ColorPick} label="Kolor paska" b=${b} value=${th || b.sidebarColor === "custom" ? b.sidebarColor : ""} hex=${b.sidebarHex} defLabel="Domyślny (biały)"
        onPick=${(v) => up((x) => { x.sidebarColor = v || null; if (v === "custom" && !x.sidebarHex) x.sidebarHex = "#1C1C1C"; })} onHex=${(v) => up((x) => { x.sidebarHex = v; })} />
      ${th && html`<p class="note">Tekst spisu: ${th.dark ? "jasny" : "ciemny"} (kontrast ${th.ratio.toFixed(1).replace(".", ",")}:1).${th.underline ? ` Akcent ma na tym tle tylko ${contrastRatio(th.bg, accent || "#000000").toFixed(1).replace(".", ",")}:1, więc aktywna pozycja będzie ${th.dark ? "biała" : "czarna"} z podkreśleniem.` : " Aktywna pozycja w kolorze akcentu."} Ten sam kolor ma menu „Indeks” i górny pasek na tablecie i telefonie.</p>`}
      <b class="group__sub">Akcent</b>
      <${ColorPick} label="Kolor akcentu" b=${b} value=${b.accentColor || (b.accent ? "custom" : "")} hex=${b.accent || "#000000"} defLabel="Domyślny (czarny)"
        onPick=${(v) => up((x) => { x.accentColor = v || null; if (v === "custom" && !x.accent) x.accent = "#000000"; if (!v) x.accent = null; })} onHex=${(v) => up((x) => { x.accent = v; })} />
      <p class="note">Linki, aktywna pozycja spisu, przyciski. Kolor z palety zmienia się razem z paletą.</p>

      <b class="group__sub">Krój</b>
      <${Select} label="Krój manuala" value=${font} options=${[["geist", "Geist (domyślny, darmowa licencja OFL)"], ["areal", "ABC Areal — tylko z licencją webową klienta"], ["system", "Systemowy (SF Pro, Segoe UI, Helvetica, Arial)"]]} onChange=${(v) => up((x) => { x.font = v; })} />
      <p class="note">${font === "areal" ? "Licencja Dinamo obejmuje jedną domenę i jednego licencjobiorcę — klient musi kupić własną licencję webową na swoją domenę. Pliki wgrywasz w menu projektu → Krój ABC Areal." : font === "geist" ? "Geist jest na licencji SIL Open Font License — wolno go dołączyć do strony klienta. Pliki (ok. 95 KB) trafiają do eksportu." : "Bez plików fontu — każdy zobaczy krój swojego systemu."}</p>

      <b class="group__sub">Okładka</b>
      <${Select} label="Tło okładki" value=${cv.mode} options=${[["image", "Zdjęcie"], ["color", "Jednolity kolor"]]} onChange=${(v) => up((x) => { x.coverMode = v; if (v === "color" && !x.coverColor) x.coverColor = (x.colors || [])[0]?.id || "custom"; })} />
      ${cv.mode === "image"
        ? html`<${FileField} label="Zdjęcie okładki manuala (opcjonalne)" value=${b.cover} accept="image/jpeg,image/png,image/webp" folder="media" ctx=${ctx} hint="Szablon z Figmy: 1440×900, eksport 2x. Bez zdjęcia okładka ma ciemnoszare tło." onChange=${(p) => up((x) => { x.cover = p; })} />`
        : html`<${ColorPick} label="Kolor tła okładki" b=${b} value=${b.coverColor} hex=${b.coverHex} onPick=${(v) => up((x) => { x.coverColor = v; if (v === "custom" && !x.coverHex) x.coverHex = "#1C1C1C"; })} onHex=${(v) => up((x) => { x.coverHex = v; })} />`}
      <${ColorPick} label="Kolor tekstu okładki" b=${b} value=${b.coverText || ""} hex=${b.coverTextHex} defLabel="Domyślny (biały)" onPick=${(v) => up((x) => { x.coverText = v || null; if (v === "custom" && !x.coverTextHex) x.coverTextHex = "#000000"; })} onHex=${(v) => up((x) => { x.coverTextHex = v; })} />
      <p class="note">${cv.mode === "color" ? `Kontrast tekstu do tła: ${cv.ratio.toFixed(1).replace(".", ",")}:1${cv.ratio < 3 ? " — za mało, nazwa marki będzie słabo czytelna (min. 3:1 dla dużego tekstu)." : "."}` : "Przy zdjęciu dobierz kolor tekstu do jasności zdjęcia."} Ten sam kolor tła i tekstu dostają okładki rozdziałów bez własnego zdjęcia.</p>
    <//>
  </div>`;
}

// Stopka: autorstwo manuala — podpis KHOREI (zawsze), opcjonalny pas studia projektowego nad linią, kolor tła stopki.
// Grupy jak w Ustawieniach dokumentu i Wydaniu: zwinięte pokazują podsumowanie, błędne pola dają ostrzeżenie przy nagłówku grupy.
export const isEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(String(v || "").trim());
export const isWww = (v) => /^(https?:\/\/)?[^\s/.]+(\.[^\s/.]+)+(\/\S*)?$/i.test(String(v || "").trim());
export function footerWarnings(b) {
  const st = b.studio || {}, w = {};
  if ((b.contact || "").trim() && !isEmail(b.contact)) w.credit = "do poprawy: e-mail";
  if (st.on) {
    const bad = [(st.email || "").trim() && !isEmail(st.email) && "e-mail", (st.www || "").trim() && !isWww(st.www) && "www"].filter(Boolean);
    if (bad.length) w.studio = `do poprawy: ${bad.join(", ")}`;
  }
  return w;
}
export function StudioForm({ b, set, ctx }) {
  const up = (fn) => set((x) => fn(x));
  const [open, toggle] = useGroups({ credit: true }, ctx.want);
  useEffect(() => { ctx.spot(".footer"); }, []);
  const st = b.studio || {};
  const upS = (fn) => up((x) => { x.studio = { ...(x.studio || {}) }; fn(x.studio); });
  const ft = footerTheme(b), w = footerWarnings(b);
  const badEmail = st.on && (st.email || "").trim() && !isEmail(st.email), badWww = st.on && (st.www || "").trim() && !isWww(st.www);
  return html`<div class="panel__inner">
    <h2 class="h">Stopka</h2>
    <p class="note">Stopka każdej strony manuala: kto jest autorem manuala i — opcjonalnie — kto zaprojektował identyfikację.</p>

    <${Group} id="credit" title="Autor manuala (KHOREI)" open=${open.credit} onToggle=${toggle} warn=${w.credit} summary=${(b.contact || "").trim() || "bez e-maila"}>
      <${Text} label="E-mail kontaktowy" value=${b.contact} placeholder="studio@khorei.com" hint="Stoi w stopce pod „Masz pytania?”. W gotowym manualu klik otwiera program pocztowy." onInput=${(v) => up((x) => { x.contact = v; })} />
      ${w.credit && html`<p class="f__warn">To nie wygląda na adres e-mail — w manualu będzie zwykłym tekstem, bez linku.</p>`}
      <p class="note">Logo KHOREI i „Designed by KHOREI” linkują do khorei.com. Nota prawna i sygnatura wdrożenia trafiają do eksportu automatycznie (LICENSE.txt).</p>
    <//>

    <${Group} id="studio" title="Studio projektowe" open=${open.studio} onToggle=${toggle} warn=${w.studio}
      summary=${st.on ? (st.name || st.author || "włączone") : "wyłączone"}>
      <label class="check is--line"><input type="checkbox" checked=${!!st.on} onChange=${(e) => upS((s) => { s.on = e.target.checked; })} />Pokaż w stopce studio, które zaprojektowało identyfikację</label>
      ${st.on && html`
        <p class="note">Nad linią: logo, nazwa, autor, e-mail i strona studia. Pod linią zostaje stopka KHOREI. Puste pola nie pojawiają się w manualu. LICENSE.txt przypisuje studiu autorstwo identyfikacji i treści manuala, w tym doboru typografii.</p>
        <${FileField} label="Logo studia (SVG)" value=${st.logo} accept=".svg,image/svg+xml" folder="media" ctx=${ctx} hint="Przebarwia się na kolor tekstu stopki. Pole 160×40, proporcje z pliku." onChange=${(p) => upS((s) => { s.logo = p; })} />
        <div class="grid2"><${Text} label="Nazwa studia" value=${st.name} onInput=${(v) => upS((s) => { s.name = v; })} />
        <${Text} label="Autor" value=${st.author} placeholder="Imię i nazwisko" onInput=${(v) => upS((s) => { s.author = v; })} /></div>
        <div class="grid2"><${Text} label="E-mail" value=${st.email} placeholder="hej@studio.pl" onInput=${(v) => upS((s) => { s.email = v; })} />
        <${Text} label="Strona www" value=${st.www} placeholder="studio.pl" onInput=${(v) => upS((s) => { s.www = v; })} /></div>
        ${(badEmail || badWww) && html`<p class="f__warn">${[badEmail && "E-mail potrzebuje @ i domeny (np. hej@studio.pl)", badWww && "Strona www potrzebuje domeny (np. studio.pl)"].filter(Boolean).join(". ")}. Do poprawy — w manualu pole będzie zwykłym tekstem, bez linku.</p>`}`}
    <//>

    <${Group} id="color" title="Kolor stopki" open=${open.color} onToggle=${toggle}
      summary=${ft ? html`<span class="group__chips"><span class="check__chip" style=${`background:${ft.bg}`}></span></span>${ft.bg}` : "domyślny (jasnoszary)"}>
      <${ColorPick} label="Tło stopki" b=${b} value=${b.footerColor || ""} hex=${b.footerHex} defLabel="Domyślny (jasnoszary)"
        onPick=${(v) => up((x) => { x.footerColor = v || null; if (v === "custom" && !x.footerHex) x.footerHex = "#1C1C1C"; })} onHex=${(v) => up((x) => { x.footerHex = v; })} />
      ${ft && html`<p class="note">Tekst i logo w stopce: ${ft.fg === "#FFFFFF" ? "białe" : "czarne"} (kontrast ${ft.ratio.toFixed(1).replace(".", ",")}:1).</p>`}
    <//>
  </div>`;
}

export function PublishForm({ b, set, ctx }) {
  const up = (fn) => set((x) => fn(x));
  const [open, toggle] = useGroups({ doc: true }, ctx.want);
  const w = brandWarnings(b);
  const pw = (b.password || "").trim();
  return html`<div class="panel__inner">
    <h2 class="h">Wydanie</h2>
    <p class="note">Ustawienia na koniec — przed eksportem dla klienta.</p>

    <${Group} id="address" title="Adres manuala" open=${open.address} onToggle=${toggle}
      summary=${(b.siteUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, "") || "bez adresu"}>
      <${Text} label="Adres manuala" value=${b.siteUrl} placeholder="https://klient.pl/brandbook/" hint="Wpisywany do licencji (LICENSE.txt) jako adres, pod którym klient może uruchomić manual. Potrzebny też do obrazka udostępniania." onInput=${(v) => up((x) => { x.siteUrl = v; })} />
    <//>

    <${Group} id="access" title="Dostęp" open=${open.access} onToggle=${toggle}
      summary=${!pw ? "otwarty" : (b.protect || "encrypt") === "encrypt" ? "hasło — szyfrowanie stron" : "hasło serwera (.htaccess)"}>
      <${Text} label="Hasło do manuala (puste = otwarty)" value=${b.password} placeholder="np. marka2026" onInput=${(v) => up((x) => { x.password = v; })} />
      ${pw && html`
        <${Select} label="Sposób ochrony" value=${b.protect || "encrypt"} options=${[["encrypt", "Szyfrowanie stron (każdy serwer)"], ["server", "Hasło serwera (.htaccess, Apache)"]]} onChange=${(v) => up((x) => { x.protect = v; })} />
        ${(b.protect || "encrypt") === "server" && html`<${Text} label="Login" value=${b.login} placeholder="klient" onInput=${(v) => up((x) => { x.login = v; })} />`}`}
      ${pw && html`<p class="note">Hasła nie zapisujemy w pliku backupu (.khorei) — po wczytaniu backupu na innym komputerze wpisz je ponownie. Zapis do folderu je zachowuje.</p>`}
      <p class="note">${!pw ? "Bez hasła manual jest otwarty dla każdego, kto zna adres."
        : (b.protect || "encrypt") === "encrypt" ? "Eksport szyfruje treść stron — bez hasła nie da się jej przeczytać. Hasło wpisuje się raz na sesję przeglądarki. Pliki do pobrania (media/, files/) pozostają dostępne pod bezpośrednim adresem, jeśli ktoś go zna."
        : "Serwer pyta o login i hasło, zanim wyda cokolwiek — strony, zdjęcia i pliki. Działa na hostingach z Apache (cPanel, home.pl, nazwa.pl, OVH, LH.pl). Po wgraniu trzeba wpisać w .htaccess pełną ścieżkę folderu — instrukcja jest w pliku CZYTAJ-HASLO.txt w eksporcie. Uwaga: jeśli serwer nie obsługuje .htaccess (np. nginx, Netlify), manual będzie otwarty — wtedy wybierz szyfrowanie."}</p>
    <//>

    <${Group} id="share" title="Udostępnianie" open=${open.share} onToggle=${toggle} warn=${w.share}
      summary=${[b.indexable ? "w wyszukiwarkach" : "poza wyszukiwarkami", b.favicon ? "favicon" : "bez favicony", b.ogImage ? "obrazek linku" : "bez obrazka linku"].join(" · ")}>
      <label class="check"><input type="checkbox" checked=${!!b.indexable} onChange=${(e) => up((x) => { x.indexable = e.target.checked; })} />Widoczny w wyszukiwarkach (Google, Bing)</label>
      <p class="note">${b.indexable ? "Manual może pojawić się w wynikach wyszukiwania — dla manuali publicznych, np. dla mediów i partnerów." : "Domyślnie manual nie trafia do wyników wyszukiwania; link wysłany mailem czy w Slacku dalej pokaże podgląd. Roboty zbierające dane do trenowania AI są blokowane zawsze."}</p>
      <${FileField} label="Favicon (SVG lub PNG 512×512)" value=${b.favicon} accept=".svg,image/svg+xml,image/png" folder="media" ctx=${ctx} onChange=${(p) => up((x) => { x.favicon = p; })} />
      <${FileField} label="Obrazek do udostępniania (1200×630)" value=${b.ogImage} accept="image/png,image/jpeg" folder="media" ctx=${ctx} expect=${{ w: 1200, h: 630 }} hint="Pokazuje się, gdy ktoś wklei link do manuala w Slacku, mailu czy na LinkedIn. Wymaga adresu manuala." onChange=${(p) => up((x) => { x.ogImage = p; })} />
    <//>
  </div>`;
}

