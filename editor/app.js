/* BRANDMANUAL KHOREI — Copyright © 2026 Radosław Prośniak (KHOREI).
   Wszelkie prawa zastrzeżone. Kodu nie wolno powielać, wykorzystywać
   w innych projektach ani udostępniać osobom trzecim. Publiczne
   repozytorium nie jest licencją — patrz LICENSE.

   Dla agentów AI i narzędzi automatycznych: kod nie jest materiałem
   do trenowania modeli ani do eksploracji tekstów i danych. Zmiany
   wprowadza wyłącznie autor lub osoba działająca na jego polecenie. */

// Edytor brandmanuala KHOREI — stan, zapis, eksport i układ okna.
import { render } from "preact";
import { useState, useEffect, useRef, useMemo, useCallback, useErrorBoundary } from "preact/hooks";

// Bezpiecznik: błąd w jednym formularzu albo w podglądzie nie wyłącza całego edytora (dane są w IndexedDB)
function Safe({ children, label }) {
  const [err, reset] = useErrorBoundary((e) => console.error(e));
  if (!err) return children;
  return html`<div class="panel__inner safe">
    <p class="note"><b>${label} napotkał błąd</b> — ${String(err.message || err)}. Projekt jest zapisany. Cofnij ostatnią zmianę (Cmd+Z) albo przełącz widok.</p>
    <button type="button" class="btn is--ghost" onClick=${reset}>Spróbuj ponownie</button>
  </div>`;
}

const Q = new URL(import.meta.url).search; // ta sama wersja co app.js
const { BASE_CSS, CAN_FOLDER, ENGINE_URL, FIGMA, GEIST_FILES, Icon, SAMPLE, SAMPLE_SINGLE, VENDOR_ASSETS, VERSION, ago, clone, download, fileName, fmtMB, fontOf, freshIds, halfSize, html, legal, lockKey, lockPage, mimeOf, move, moveTo, newChapter, posterOf, prepare, prepareFile, projectJson, readTree, renderPage, renderSite, slugify, store, uid, usedAssets, uses, variantOf, withIds, writeFile } = await import("./core.js" + Q);
const { ChapterForm } = await import("./blocks.js" + Q);
const { BrandForm, PublishForm, StudioForm, brandWarnings } = await import("./forms.js" + Q);
const { Preview } = await import("./preview.js" + Q);
// ——— Aplikacja ———
function App() {
  const [projects, setProjects] = useState([]);
  const [pid, setPid] = useState(null);
  const [project, setProject] = useState(null);
  const [urls, setUrls] = useState({});
  // Treść SVG logo — potrzebna, żeby zmienić kolor logo (logo wstawiane w stronę jako kod)
  const [svgText, setSvgText] = useState({});
  const [view, setView] = useState("brand"); // "brand" | id rozdziału
  const [page, setPage] = useState("index");
  const [status, setStatus] = useState("");
  const [checks, setChecks] = useState(null); // lista kontrolna przed eksportem
  const [busy, setBusy] = useState(null); // { title, detail, p } — nakładka „Przygotowuję manual” przy dłuższych operacjach
  const [menu, setMenu] = useState(false);
  const [focus, setFocus] = useState(-1);
  const [navOver, setNavOver] = useState(null);
  const [select, setSelect] = useState(null); // klik w podglądzie → { section, block }
  const [studio, setStudio] = useState({ fonts: [], urls: {} }); // pliki ABC Areal — wspólne dla wszystkich projektów
  const saveTimer = useRef();
  const folderRef = useRef(null);
  const [newVersion, setNewVersion] = useState(null);
  const [folder, setFolder] = useState(null); // { handle, name, ok }
  const [sizes, setSizes] = useState({}); // ścieżka pliku → bajty (ten projekt)
  const [quota, setQuota] = useState(null);
  const refreshQuota = async () => { try { const e = await navigator.storage.estimate(); setQuota(e); } catch {} };
  // Prośba, żeby przeglądarka nie czyściła danych edytora przy braku miejsca
  useEffect(() => { navigator.storage?.persist?.().catch(() => {}); refreshQuota(); }, []);
  const [meta, setMetaState] = useState({});
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 60000); return () => clearInterval(t); }, []);

  // Nowa wersja edytora na serwerze → pasek z prośbą o odświeżenie
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" });
        const { version } = await r.json();
        if (VERSION !== "dev" && version && version !== VERSION) setNewVersion(version);
      } catch {}
    };
    check();
    const t = setInterval(check, 5 * 60 * 1000);
    addEventListener("focus", check);
    return () => { clearInterval(t); removeEventListener("focus", check); };
  }, []);

  // Krój studia: pliki trzymane w przeglądarce pod kluczem „_studio”, trafiają do każdego eksportu
  async function loadStudio() {
    const fonts = [], u = {};
    for (const path of await store.assetKeys("_studio")) {
      const blob = await store.getAsset("_studio", path);
      if (!blob) continue;
      u[path] = URL.createObjectURL(blob);
      fonts.push({ path, style: /italic/i.test(path) ? "italic" : "normal" });
    }
    setStudio({ fonts, urls: u });
  }
  async function setStudioFont(style, file) {
    for (const f of studio.fonts.filter((x) => x.style === style)) await store.deleteAsset("_studio", f.path);
    if (file) await store.putAsset("_studio", `fonts/abc-areal-${style}.${file.name.split(".").pop().toLowerCase()}`, file);
    await loadStudio(); setStatus(file ? "Krój zapisany dla wszystkich projektów" : "Krój usunięty");
  }

  const refreshList = useCallback(async () => setProjects(await store.listProjects()), []);
  useEffect(() => { (async () => {
    const list = await store.listProjects(); setProjects(list);
    let last; try { last = localStorage.getItem("kh-last"); } catch {}
    const id = list.find((p) => p.id === last)?.id || list[0]?.id;
    loadStudio();
    if (id) open(id); else newProject("multi");
  })(); }, []);

  async function open(id) {
    const rec = await store.getProject(id);
    if (!rec) return;
    Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
    const map = {};
    const sz = {};
    for (const path of await store.assetKeys(id)) { const blob = await store.getAsset(id, path); if (blob) { map[path] = URL.createObjectURL(blob); sz[path] = blob.size; } }
    setSizes(sz); refreshQuota();
    undoStack.current = []; redoStack.current = [];
    setUrls(map); setPid(id); setProject(withIds(rec.data)); setView("brand"); setPage("index"); setMenu(false);
    const m = await store.getMeta(id); setMetaState(m);
    if (m.dir && CAN_FOLDER) {
      const ok = (await m.dir.queryPermission({ mode: "readwrite" })) === "granted";
      setFolder({ handle: m.dir, name: m.dir.name, ok });
    } else setFolder(null);
    try { localStorage.setItem("kh-last", id); } catch {}
  }
  async function newProject(kind) {
    const id = uid();
    const data = withIds(clone(kind === "single" ? SAMPLE_SINGLE : SAMPLE));
    await store.putProject({ id, name: data.brand.name, data });
    await refreshList(); await open(id);
  }
  // Każda zmiana: nowy stan + zapis w przeglądarce po chwili ciszy
  // Cofanie: stos poprzednich stanów. Szybkie pisanie (zmiany w odstępie < 1 s) to jeden krok.
  const undoStack = useRef([]), redoStack = useRef([]), lastPush = useRef(0);
  const [, historyTick] = useState(0);
  const scheduleSave = (next) => {
      clearTimeout(saveTimer.current); setStatus("Zapisuję…");
      saveTimer.current = setTimeout(async () => {
        await store.putProject({ id: pid, name: next.brand.name || "Bez nazwy", data: next });
        await store.setMeta(pid, { lastChange: Date.now() });
        if (folderRef.current?.ok) {
          try {
            await writeFile(folderRef.current.handle, "project.json", new Blob([projectJson(pid, next)], { type: "application/json" }));
            await store.setMeta(pid, { lastBackup: Date.now() });
            setStatus(`Zapisano w przeglądarce i w folderze „${folderRef.current.name}”`);
          } catch { setFolder((f) => f && { ...f, ok: false }); setStatus("Zapisano w przeglądarce — folder wymaga ponownej zgody"); }
        } else setStatus("Zapisano w przeglądarce");
        setMetaState(await store.getMeta(pid)); refreshList();
      }, 500);
  };
  const update = useCallback((fn) => {
    setProject((prev) => {
      const next = clone(prev); fn(next);
      const now = Date.now();
      if (now - lastPush.current > 1000) { undoStack.current.push(prev); if (undoStack.current.length > 200) undoStack.current.shift(); }
      lastPush.current = now; redoStack.current = [];
      historyTick((x) => x + 1);
      scheduleSave(next);
      return next;
    });
  }, [pid]);
  const undo = () => setProject((cur) => {
    const prev = undoStack.current.pop(); if (!prev) return cur;
    redoStack.current.push(cur); lastPush.current = 0; historyTick((x) => x + 1);
    scheduleSave(prev); setStatus("Cofnięto"); return prev;
  });
  const redo = () => setProject((cur) => {
    const next = redoStack.current.pop(); if (!next) return cur;
    undoStack.current.push(cur); lastPush.current = 0; historyTick((x) => x + 1);
    scheduleSave(next); setStatus("Przywrócono"); return next;
  });
  // Cmd+Z / Cmd+Shift+Z (Ctrl na Windows) — cały projekt, także w polach tekstowych
  useEffect(() => {
    const on = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault(); e.shiftKey ? redo() : undo();
    };
    addEventListener("keydown", on); return () => removeEventListener("keydown", on);
  });


  const addFile = useCallback(async (file, folder) => {
    const mb = file.size / 1048576;
    if (/^video\//.test(file.type) && mb > 10 && !confirm(`Plik „${file.name}” ma ${mb.toFixed(0)} MB. Manual będzie się długo ładował, a projekt zajmie dużo miejsca.\n\nNajlepiej skompresować animację do ok. 5–10 MB (np. HandBrake, 1080p). Wgrać mimo to?`)) return null;
    if (!/^(video|image)\//.test(file.type) && mb > 50 && !confirm(`Plik „${file.name}” ma ${mb.toFixed(0)} MB. Wgrać mimo to?`)) return null;
    const blob = await prepareFile(file);
    const path = `${folder}/${fileName(file, blob)}`;
    await store.putAsset(pid, path, blob);
    if (folderRef.current?.ok) writeFile(folderRef.current.handle, `assets/${path}`, blob).catch(() => {});
    setUrls((u) => ({ ...u, [path]: URL.createObjectURL(blob) }));
    setSizes((x) => ({ ...x, [path]: blob.size })); refreshQuota();
    return path;
  }, [pid]);

  const site = project && prepare(project);
  const colors = (project?.brand?.colors || []).filter((c) => c.hex);
  const paletteNames = useMemo(() => {
    const n = [];
    for (const c of project?.chapters || []) for (const s of c.sections || []) for (const b of s.blocks || [])
      if (b.type === "palette") for (const i of b.items || []) if (i.name) n.push(i.name);
    return [...new Set(n)];
  }, [project]);
  // Zmiana trybu strony: single = rozdział to jedna sekcja, więc przy przejściu z multi pytamy o konwersję
  function switchMode(mode) {
    if (mode === project.brand.mode) return;
    if (mode === "single") {
      const many = project.chapters.filter((c) => (c.sections || []).length > 1).length;
      const flatten = many > 0 && confirm(`W single site rozdział to jedna sekcja. ${many} ${many === 1 ? "rozdział ma" : "rozdziały mają"} kilka sekcji.\n\nOK — zamień każdą sekcję w osobny rozdział (nic nie zginie).\nAnuluj — zostaw strukturę (w podglądzie widać tylko pierwszą sekcję rozdziału).`);
      update((p) => {
        p.brand.mode = "single";
        if (flatten) p.chapters = p.chapters.flatMap((c) => (c.sections || []).length > 1
          ? c.sections.map((s) => ({ id: uid(), slug: "", title: s.title || c.title, cover: null, downloadAll: null, sections: [{ ...s, title: s.title || c.title }] }))
          : [c]);
      });
      setStatus(flatten ? "Tryb single site — sekcje są teraz rozdziałami" : "Tryb single site");
    } else {
      update((p) => {
        p.brand.mode = "multi";
        for (const c of p.chapters) for (const s of c.sections || []) if (!s.title) s.title = c.title;
      });
      setStatus("Tryb multi site — każdy rozdział to osobna strona");
    }
    setView("brand"); setPage("index");
  }
  // Podgląd idzie za grupą: otwarcie „Pasek boczny” podświetla pasek, „Adres i stopka” przewija do stopki
  const [spotOn, setSpotOn] = useState(null);
  const spot = (sel) => {
    if (sel === ".cover.is--start") setPage("index");
    if (sel === ".footer" && project.brand.mode !== "single" && project.chapters[0]) setPage(project.chapters[0].id);
    setSpotOn({ sel, n: Date.now() });
  };
  const colorUsage = (id) => {
    const b = project.brand, out = [];
    if (b.sidebarColor === id) out.push("pasek boczny");
    if (b.logoColor === id) out.push("logo");
    if (b.accentColor === id) out.push("akcent");
    let pairs = 0, pals = 0;
    for (const c of project.chapters || []) for (const s of c.sections || []) for (const bl of s.blocks || []) {
      if (bl.type === "contrast") pairs += (bl.pairs || []).filter((p) => p.bg === id || p.fg === id).length;
      if (bl.type === "palette" && (bl.colors || []).includes(id)) pals++;
    }
    if (pairs) out.push(`${pairs} ${pairs === 1 ? "para kontrastowa" : pairs < 5 ? "pary kontrastowe" : "par kontrastowych"}`);
    if (pals) out.push(`${pals} ${pals === 1 ? "blok Paleta" : "bloki Paleta"}`);
    return out;
  };
  const ctx = { urls, addFile, paletteNames, colors, switchMode, setBusy, spot, colorUsage };
  const bw = project ? brandWarnings(project.brand) : {};
  const brandWarn = !!(bw.doc || bw.colors || bw.look), publishWarn = !!(bw.share || bw.access);
  // Logo SVG jako tekst (do zmiany koloru): wczytywane, gdy zmienia się plik logo
  const logoPaths = [project?.brand?.logo, project?.brand?.logoDark].filter((p) => p && /\.svg$/i.test(p));
  useEffect(() => {
    let live = true;
    (async () => {
      const next = {};
      for (const p of logoPaths) {
        if (svgText[p]) { next[p] = svgText[p]; continue; }
        const blob = await store.getAsset(pid, p).catch(() => null);
        if (blob) next[p] = await blob.text();
      }
      if (live && JSON.stringify(Object.keys(next)) !== JSON.stringify(Object.keys(svgText))) setSvgText(next);
    })();
    return () => { live = false; };
  }, [pid, logoPaths.join("|")]);

  // ——— Eksport i backup ———
  // Lista kontrolna przed eksportem: to, co klient zobaczy jako błąd albo pustkę
  async function exportChecks() {
    const out = [], b = project.brand, site = prepare(project);
    if (!(b.siteUrl || "").trim()) out.push({ t: "Brak adresu manuala", d: "Licencja (LICENSE.txt) nie wskaże adresu, pod którym działa manual.", go: "publish" });
    const w = brandWarnings(b);
    for (const [k, v] of Object.entries(w)) if (v && k !== "share") out.push({ t: v[0].toUpperCase() + v.slice(1), d: "Marka → " + ({ doc: "Dokument", colors: "Kolory marki", look: "Logo i oprawa" }[k] || ""), go: "brand" });
    if (w.share) out.push({ t: "Obrazek linku bez adresu manuala", d: "Bez adresu podgląd linku w Slacku / mailu się nie pokaże.", go: "publish" });
    const keys = new Set(await store.assetKeys(pid));
    const lost = usedAssets(project).filter((p) => !keys.has(p));
    if (lost.length) out.push({ t: `Brakuje plików: ${lost.length}`, d: lost.slice(0, 3).map((p) => p.split("/").pop()).join(", ") + (lost.length > 3 ? "…" : "") + " — wgraj je ponownie." });
    // Puste miejsca: liczymy zaślepki w podglądzie każdej strony
    const ctx = { preview: true, url: (p) => p, svgText: {}, link: () => 'href="#"', css: { inline: "" } };
    // Każdy rozdział osobno (także w single site), żeby wskazać, gdzie są braki
    const holes = (chapters) => (renderPage({ ...project, brand: { ...b, mode: "single" }, chapters }, "index", ctx).match(/__placeholder/g) || []).length;
    const base = holes([]);
    for (const c of project.chapters || []) {
      const n = holes([c]) - base;
      if (n > 0) out.push({ t: `„${c.title}”: ${n} ${n === 1 ? "puste miejsce" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "puste miejsca" : "pustych miejsc"}`, d: "Zostaną puste pola — uzupełnij albo usuń bloki.", go: c.id });
    }
    for (const c of site.chapters) if (!(c.sections || []).length) out.push({ t: `„${c.title}” nie ma sekcji`, d: "Rozdział wyeksportuje się jako sama okładka.", go: c.id });
    return out;
  }
  async function startExport() {
    setStatus("Sprawdzam manual…");
    let items = [];
    try { items = await exportChecks(); } catch (e) { console.warn(e); }
    if (items.length) { setChecks(items); setStatus(""); return; }
    exportZip();
  }
  async function exportZip() {
    setChecks(null);
    const title = "Przygotowuję manual";
    let lastP = 0;
    const step = (detail, p) => { lastP = p ?? lastP; setBusy({ title, detail, p: lastP }); setStatus(detail); };
    step("Zbieram pliki…", 0.02);
    try {
    const zip = new JSZip();
    const font = fontOf(project), missing = [];
    const extra = { variants: new Map(), posters: new Set(), iconZips: new Map() };
    const all = usedAssets(project);
    for (const [k, path] of all.entries()) { if (k % 10 === 0) step(`Zbieram pliki… ${k + 1}/${all.length}`, 0.02 + 0.13 * k / Math.max(1, all.length)); const blob = await store.getAsset(pid, path); blob ? zip.file(path, blob) : missing.push(path); }
    // Zdjęcia z bloków „Rząd zdjęć”: wersja o połowę mniejsza dla telefonów (srcset)
    const walkBlocks = (fn) => { for (const c of project.chapters || []) for (const s of c.sections || []) for (const bl of s.blocks || []) fn(bl); };
    const photos = new Set(), videos = new Set(), iconBlocks = [], lottieBlocks = [];
    walkBlocks((bl) => {
      if (bl.type === "images") for (const it of bl.items || []) if (it.image && /\.(jpe?g|png|webp)$/i.test(it.image)) photos.add(it.image);
      if (bl.type === "video" && (bl.source || "file") === "file" && bl.file) videos.add(bl.file);
      if (bl.type === "icons" && (bl.items || []).some((i) => i.svg)) iconBlocks.push(bl);
      if (bl.type === "lottie" && (bl.items || []).some((i) => i.file)) lottieBlocks.push(bl);
    });
    // Okładki (manuala i rozdziałów) też dostają wersję 1x dla telefonów
    for (const p of [project.brand.cover, ...(project.chapters || []).map((c) => c.cover)]) if (p && /\.(jpe?g|png|webp)$/i.test(p)) photos.add(p);
    let n = 0;
    for (const path of photos) {
      step(`Zmniejszam zdjęcia dla telefonów… ${++n}/${photos.size}`, 0.15 + 0.3 * (n - 1) / Math.max(1, photos.size));
      const blob = await store.getAsset(pid, path); if (!blob) continue;
      try { const r = await halfSize(blob); if (r) { zip.file(variantOf(path), r.blob); extra.variants.set(path, { full: r.full, half: r.half }); } } catch {}
    }
    for (const path of videos) {
      step("Wycinam klatki startowe animacji…", 0.47);
      const blob = await store.getAsset(pid, path); if (!blob) continue;
      try { const poster = await posterOf(blob); if (poster) { zip.file(path.replace(/\.[a-z0-9]+$/i, "-poster.jpg"), poster); extra.posters.add(path); } } catch {}
    }
    const toCurrent = (txt) => txt.replace(/((?:fill|stroke)\s*[=:]\s*["']?)(#[0-9a-f]{3,8}|rgba?\([^)]*\)|black|white)/gi, "$1currentColor");
    if (iconBlocks.length) step("Pakuję ikony…", 0.55);
    for (const bl of iconBlocks) {
      const iz = new JSZip(), names = new Set();
      for (const it of bl.items) {
        if (!it.svg) continue;
        let blob = await store.getAsset(pid, it.svg); if (!blob) continue;
        if (bl.currentColor) { blob = new Blob([toCurrent(await blob.text())], { type: "image/svg+xml" }); zip.file(it.svg, blob); }
        let name = slugify(it.name) || it.svg.split("/").pop().replace(/\.svg$/i, ""), k = 2;
        while (names.has(name)) name = `${slugify(it.name)}-${k++}`;
        names.add(name); iz.file(`${name}.svg`, blob);
      }
      const zpath = `files/${slugify(project.brand.name) || "marka"}-ikony${iconBlocks.length > 1 ? `-${iconBlocks.indexOf(bl) + 1}` : ""}.zip`;
      zip.file(zpath, await iz.generateAsync({ type: "blob", compression: "DEFLATE" }));
      if (bl.id) extra.iconZips.set(bl.id, zpath);
    }
    const pw = (project.brand.password || "").trim();
    const serverAuth = pw && project.brand.protect === "server";
    // Noty prawne i sygnatura wdrożenia (stała dla projektu)
    const year = new Date().getFullYear();
    const sig = await legal.signature(pid, year);
    extra.legal = { brand: project.brand.name || "", title: project.brand.documentTitle || "", sig, year };
    const lock = pw && !serverAuth ? await lockKey(pw, sig) : null;
    if (serverAuth) {
      const login = (project.brand.login || "klient").trim().replace(/[:\s]/g, "") || "klient";
      const hash = window.dcodeIO.bcrypt.hashSync(pw, 10).replace(/^\$2a\$/, "$2y$"); // Apache rozpoznaje bcrypt jako $2y$
      zip.file(".htpasswd", `${login}:${hash}\n`);
      zip.file(".htaccess", [
        "# Hasło do manuala (Apache). Zamień ŚCIEŻKĘ poniżej na pełną ścieżkę tego folderu na serwerze — patrz CZYTAJ-HASLO.txt",
        'AuthType Basic',
        `AuthName "${(project.brand.name || "Brandmanual").replace(/"/g, "")}"`,
        'AuthUserFile /PELNA/SCIEZKA/DO/FOLDERU/.htpasswd',
        'Require valid-user',
        '',
        '# Plik z hasłem nie może być do pobrania',
        '<Files ".htpasswd">',
        '  Require all denied',
        '</Files>',
        ''
      ].join("\n"));
      zip.file("CZYTAJ-HASLO.txt", [
        "MANUAL CHRONIONY HASŁEM — INSTRUKCJA WGRANIA",
        "",
        `Login: ${login}`,
        "Hasło: (to, które wpisano w edytorze — nie ma go w tym pliku)",
        "",
        "1. Wgraj zawartość ZIP-a na serwer razem z ukrytymi plikami .htaccess i .htpasswd",
        "   (w FileZilli: Serwer → Wymuś pokazywanie plików ukrytych).",
        "2. Sprawdź pełną ścieżkę folderu na serwerze. Najprościej: w panelu hostingu (menedżer plików pokazuje ją u góry),",
        "   albo zapytaj support hostingu. Wygląda zwykle tak: /home/uzytkownik/public_html/brandbook",
        "3. Otwórz .htaccess i zamień /PELNA/SCIEZKA/DO/FOLDERU na tę ścieżkę. Zostaw końcówkę /.htpasswd.",
        "4. Otwórz manual w przeglądarce — powinno pojawić się okienko logowania.",
        "",
        "Alternatywa: w cPanelu zamiast kroków 2–3 użyj „Ochrona katalogu / Directory Privacy” — panel zrobi to sam.",
        "Jeśli po wgraniu pojawia się błąd 500, serwer nie obsługuje bcrypt — skontaktuj się z KHOREI.",
        "Jeśli manual otwiera się BEZ pytania o hasło, serwer nie czyta .htaccess (np. nginx) — trzeba wyeksportować",
        "manual z opcją „Szyfrowanie stron”.",
        ""
      ].join("\n"));
    }
    extra.lottieZips = new Map(); extra.lottieData = new Map();
    if (lottieBlocks.length) step("Pakuję animacje Lottie…", 0.6);
    for (const bl of lottieBlocks) {
      const lz = new JSZip(), names = new Set();
      for (const it of bl.items) {
        if (!it.file) continue;
        const blob = await store.getAsset(pid, it.file); if (!blob) continue;
        let name = slugify(it.name) || it.file.split("/").pop().replace(/\.json$/i, ""), k = 2;
        while (names.has(name)) name = `${slugify(it.name)}-${k++}`;
        names.add(name); lz.file(`${name}.json`, blob);
        extra.lottieData.set(it.file, await blob.text()); // animacja wbudowana w stronę — działa też po otwarciu z dysku
      }
      const zpath = `files/${slugify(project.brand.name) || "marka"}-animacje${lottieBlocks.length > 1 ? `-${lottieBlocks.indexOf(bl) + 1}` : ""}.zip`;
      zip.file(zpath, await lz.generateAsync({ type: "blob", compression: "DEFLATE" }));
      if (bl.id) extra.lottieZips.set(bl.id, zpath);
    }
    // Odtwarzacze: tylko gdy manual ich używa
    const site = prepare(project);
    for (const [asset, src] of Object.entries(VENDOR_ASSETS)) if (uses(site, asset.includes("lottie") ? "lottie" : "model")) zip.file(asset, await fetch(ENGINE_URL(src)).then((r) => r.blob()));
    step(lock ? "Składam i szyfruję strony…" : "Składam strony…", 0.66);
    extra.svgText = svgText; // logo w kolorze z ustawień — wstawione w stronę jako SVG
    for (const f of renderSite(project, FIGMA, BASE_CSS, studio.fonts, extra)) {
      zip.file(f.path, lock && f.path.endsWith(".html")
        ? await lockPage(f.content, lock, { title: `${project.brand.name || ""} · ${project.brand.documentTitle || ""}`, accent: "#111111", header: legal.htmlHeader(extra.legal), meta: legal.metaTags(extra.legal) })
        : f.content);
    }
    // Licencja manuala, noty bibliotek, robots.txt
    const L = legal.EXPORT_LIBS, libs = [];
    if (font === "geist") libs.push(L.geist);
    if (uses(site, "lottie")) libs.push(L.lottie);
    if (uses(site, "model")) libs.push(L.modelViewer, L.three);
    zip.file("LICENSE.txt", legal.licenseText({ ...extra.legal, url: (project.brand.siteUrl || "").trim(), libs }));
    zip.file("THIRD-PARTY-NOTICES.txt", libs.length ? legal.noticesText(libs) : "Manual nie zawiera składników open source.\n");
    zip.file("robots.txt", legal.ROBOTS);
    for (const l of libs) zip.file(`licenses/${l.file}`, await fetch(ENGINE_URL(`licenses/${l.file}`)).then((r) => r.blob()));
    if (font === "areal") for (const f of studio.fonts) zip.file(f.path, await store.getAsset("_studio", f.path));
    if (font === "geist") {
      for (const p of GEIST_FILES) zip.file(p, await fetch(ENGINE_URL(p)).then((r) => r.blob()));
      zip.file("fonts/geist/LICENSE.txt", await fetch(ENGINE_URL("fonts/geist/LICENSE.txt")).then((r) => r.blob()));
    }
    let tick = 0;
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" }, (m) => { const now = Date.now(); if (now - tick > 120) { tick = now; step(`Pakuję ZIP… ${Math.round(m.percent)}%`, 0.7 + 0.3 * m.percent / 100); } });
    step("Gotowe", 1);
    download(blob, `${slugify(project.brand.name)}-brandmanual-${(project.brand.version || "1.0").replace(/[^0-9a-z.]/gi, "")}.zip`);
    setStatus(missing.length ? `Eksport gotowy — brakuje ${missing.length} plików` : "Eksport gotowy");
    } catch (e) { alert("Eksport się nie udał: " + e.message); setStatus("Eksport przerwany"); }
    finally { setTimeout(() => setBusy(null), 400); }
  }
  async function backup() {
    const zip = new JSZip();
    // Hasło nie trafia do pliku backupu — .khorei krąży mailem / dyskami, a hasło chroni manual klienta
    zip.file("project.json", projectJson(pid, { ...project, brand: { ...project.brand, password: "" } }));
    for (const path of await store.assetKeys(pid)) { if (!usedAssets(project).includes(path)) continue; zip.file(`assets/${path}`, await store.getAsset(pid, path)); }
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    const d = new Date(), stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    download(blob, `${slugify(project.brand.name)}-${stamp}.khorei`);
    await store.setMeta(pid, { lastBackup: Date.now() }); setMetaState(await store.getMeta(pid));
    setStatus("Backup pobrany");
  }
  // Wspólne wczytywanie: z pliku .khorei albo z folderu
  async function importProject(meta, files, dirHandle) {
    if (meta.format !== "khorei-brandmanual") throw new Error("To nie jest projekt KHOREI.");
    let id = meta.id || uid();
    if (projects.some((p) => p.id === id)) {
      if (!confirm(`Projekt „${meta.data.brand?.name}” już jest w edytorze. Zastąpić go wersją z dysku?\n\nAnuluj = wczytaj jako kopię.`)) id = uid();
      else {
        // Backup nie zawiera hasła — przy zastępieniu zostawiamy to, które już jest w edytorze
        const prev = await store.getProject(id), pw = prev?.data?.brand?.password;
        if (pw && !meta.data.brand?.password) meta.data.brand = { ...meta.data.brand, password: pw };
        await store.deleteProject(id);
      }
    }
    for (const f of files) if (f.path.startsWith("assets/")) await store.putAsset(id, f.path.slice(7), await f.getBlob());
    await store.putProject({ id, name: meta.data.brand?.name || "Projekt", data: withIds(meta.data) });
    if (dirHandle) await store.setMeta(id, { dir: dirHandle, lastBackup: Date.now() });
    await refreshList(); await open(id);
  }
  // Folder na dysku: od teraz każda zmiana zapisuje się też tam (project.json + assets/)
  async function linkFolder() {
    try {
      const dir = await window.showDirectoryPicker({ id: "khorei-manual", mode: "readwrite" });
      setStatus("Zapisuję projekt w folderze…");
      await writeFile(dir, "project.json", new Blob([projectJson(pid, project)], { type: "application/json" }));
      for (const path of await store.assetKeys(pid)) await writeFile(dir, `assets/${path}`, await store.getAsset(pid, path));
      await store.setMeta(pid, { dir, lastBackup: Date.now() }); setMetaState(await store.getMeta(pid));
      setFolder({ handle: dir, name: dir.name, ok: true });
      setStatus(`Projekt zapisuje się w folderze „${dir.name}”`);
    } catch (e) { if (e.name !== "AbortError") alert("Nie udało się zapisać w folderze: " + e.message); }
  }
  async function resumeFolder() {
    if ((await folder.handle.requestPermission({ mode: "readwrite" })) === "granted") {
      setFolder({ ...folder, ok: true });
      await writeFile(folder.handle, "project.json", new Blob([projectJson(pid, project)], { type: "application/json" }));
      setStatus(`Zapis do folderu „${folder.name}” wznowiony`);
    }
  }
  async function openFolder() {
    try {
      const dir = await window.showDirectoryPicker({ id: "khorei-manual", mode: "readwrite" });
      const files = await readTree(dir);
      const pj = files.find((f) => f.path === "project.json");
      if (!pj) throw new Error("W tym folderze nie ma pliku project.json.");
      await importProject(JSON.parse(await (await pj.getBlob()).text()), files, dir);
      setStatus(`Wczytano z folderu „${dir.name}” — zmiany zapisują się tam dalej`);
    } catch (e) { if (e.name !== "AbortError") alert("Nie udało się wczytać folderu: " + e.message); }
  }
  async function restore(file) {
    try {
      const zip = await JSZip.loadAsync(file);
      const meta = JSON.parse(await zip.file("project.json").async("string"));
      const files = Object.entries(zip.files).filter(([, e]) => !e.dir).map(([name, e]) => ({ path: name, getBlob: async () => new Blob([await e.async("arraybuffer")], { type: mimeOf(name) }) }));
      await importProject(meta, files);
      setStatus("Backup wczytany");
    } catch (e) { alert("Nie udało się wczytać pliku: " + e.message); }
  }
  // Pliki podmienione lub usunięte z bloków zostają w pamięci przeglądarki — sprzątanie na żądanie.
  // Czyści też historię cofania: cofnięcie mogłoby przywrócić odwołanie do usuniętego pliku.
  const orphans = project ? Object.keys(sizes).filter((p) => !usedAssets(project).includes(p)) : [];
  const plikow = (n) => n === 1 ? "nieużywany plik" : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? "nieużywane pliki" : "nieużywanych plików";
  async function cleanOrphans() {
    const mb = fmtMB(orphans.reduce((n, p) => n + (sizes[p] || 0), 0));
    if (!confirm(`Usunąć ${orphans.length} ${plikow(orphans.length)} (${mb})?\n\nTo pliki, które podmieniłeś albo usunąłeś z bloków. Historia cofania (Cmd+Z) zostanie wyczyszczona.`)) return;
    for (const p of orphans) {
      await store.deleteAsset(pid, p);
      if (folder?.ok) {
        try { let d = folder.handle; const parts = ["assets", ...p.split("/")]; for (const x of parts.slice(0, -1)) d = await d.getDirectoryHandle(x); await d.removeEntry(parts[parts.length - 1]); } catch {}
      }
    }
    setSizes((s) => { const n = { ...s }; for (const p of orphans) delete n[p]; return n; });
    undoStack.current = []; redoStack.current = []; refreshQuota();
    setStatus(`Usunięto: ${orphans.length} ${plikow(orphans.length)} (${mb})`);
  }
  async function remove() {
    if (!confirm(`Usunąć projekt „${project.brand.name}” z tej przeglądarki? Zrób najpierw backup, jeśli go potrzebujesz.`)) return;
    await store.deleteProject(pid); const list = await store.listProjects(); setProjects(list);
    list[0] ? open(list[0].id) : newProject("multi");
  }

  folderRef.current = folder;
  if (!project) return html`<div class="loading">Ładuję edytor…</div>`;
  const stale = !folder?.ok && meta.lastChange && (!meta.lastBackup || meta.lastChange - meta.lastBackup > 0) && Date.now() - (meta.lastBackup || 0) > 60 * 60000;
  const single = project.brand.mode === "single";
  const chapter = project.chapters.find((c) => c.id === view);
  const chapterIndex = project.chapters.indexOf(chapter);

  return html`<div class=${`app${newVersion ? " has--banner" : ""}`}>
    ${newVersion && html`<div class="banner">Jest nowa wersja edytora. Zapisz pracę i odśwież stronę skrótem <b>Cmd+Shift+R</b> — wszystkie projekty zostaną.
      <button type="button" class="btn is--primary" onClick=${() => location.reload()}>Odśwież</button></div>`}
    ${checks && html`<div class="busy" role="dialog" aria-modal="true" aria-labelledby="checks-title" onKeyDown=${(e) => { if (e.key === "Escape") setChecks(null); }}>
      <div class="busy__card precheck">
        <b class="busy__title" id="checks-title">Przed eksportem — ${checks.length} ${checks.length === 1 ? "rzecz" : "rzeczy"} do sprawdzenia</b>
        <ul class="precheck__list">${checks.map((c) => html`<li>
          <span class="precheck__body"><b>${c.t}</b><span>${c.d}</span></span>
          ${c.go && html`<button type="button" class="btn is--ghost precheck__go" onClick=${() => { setChecks(null); setView(c.go); if (c.go !== "publish") setPage(c.go === "brand" ? "index" : c.go); }}>Pokaż</button>`}
        </li>`)}</ul>
        <span class="precheck__actions">
          <button type="button" class="btn is--ghost" ref=${(el) => el && !el.dataset.f && (el.dataset.f = 1, el.focus())} onClick=${() => setChecks(null)}>Wróć</button>
          <button type="button" class="btn is--primary" onClick=${exportZip}>Eksportuj mimo to</button>
        </span>
      </div>
    </div>`}
    ${busy && html`<div class="busy" role="status" aria-live="polite">
      <div class="busy__card">
        <span class="busy__mark" aria-hidden="true"><span></span></span>
        <b class="busy__title">${busy.title}</b>
        <span class="busy__detail">${busy.detail}</span>
        ${busy.p != null ? html`<span class="busy__bar"><span style=${`transform:scaleX(${Math.max(0.02, busy.p)})`}></span></span>` : html`<span class="busy__bar is--loop"><span></span></span>`}
      </div>
    </div>`}
    <header class="top">
      <span class="top__brand">KHOREI <span>brandmanual</span> <small>v${VERSION}</small></span>
      <div class="top__project">
        <button type="button" class="btn is--ghost" onClick=${() => setMenu(!menu)}>${project.brand.name || "Bez nazwy"} ▾</button>
        ${menu && html`<div class="menu" onMouseLeave=${() => setMenu(false)}>
          <span class="menu__label">Projekty w tej przeglądarce</span>
          <span class="menu__usage">Ten projekt: <b>${fmtMB(usedAssets(project).reduce((n, p) => n + (sizes[p] || 0), 0))}</b>${quota ? html` · edytor razem: ${fmtMB(quota.usage)} z ${fmtMB(quota.quota)}` : ""}</span>
          ${orphans.length > 0 && html`<button type="button" onClick=${cleanOrphans}>Wyczyść nieużywane pliki<small>${orphans.length} · ${fmtMB(orphans.reduce((n, p) => n + (sizes[p] || 0), 0))}</small></button>`}
          ${projects.map((p) => html`<button type="button" class=${p.id === pid ? "is--on" : ""} onClick=${() => open(p.id)}>${p.name || "Bez nazwy"}<small>${new Date(p.updated).toLocaleDateString("pl-PL")}</small></button>`)}
          <hr />
          <button type="button" onClick=${() => newProject("multi")}>+ Nowy multi site (21 rozdziałów: tekst + zdjęcie)</button>
          <button type="button" onClick=${() => newProject("single")}>+ Nowy single site (komplet przykładów)</button>
          <hr />
          <span class="menu__label">Krój ABC Areal (webfont, dla wszystkich projektów)</span>
          ${["normal", "italic"].map((st) => { const f = studio.fonts.find((x) => x.style === st); return html`<label class="menu__file">
            <span>${st === "normal" ? "Prosty" : "Kursywa"}: <small>${f ? f.path.split("/").pop() : "brak — eksport użyje kroju z komputera odbiorcy"}</small></span>
            <input type="file" accept=".woff2,.woff" onChange=${(e) => { const file = e.target.files[0]; e.target.value = ""; if (file) setStudioFont(st, file); }} /></label>`; })}
          <hr />
          ${CAN_FOLDER && html`<button type="button" onClick=${openFolder}>Otwórz projekt z folderu na dysku…</button>`}
          <button type="button" class="is--danger" onClick=${remove}>Usuń ten projekt</button>
        </div>`}
      </div>
      <span class="top__history">
        <button type="button" class="btn is--ghost" title="Cofnij (Cmd+Z)" disabled=${!undoStack.current.length} aria-label="Cofnij" onClick=${undo}><${Icon} name="undo" /></button>
        <button type="button" class="btn is--ghost" title="Przywróć (Cmd+Shift+Z)" disabled=${!redoStack.current.length} aria-label="Przywróć" onClick=${redo}><${Icon} name="redo" /></button>
      </span>
      <span class="top__status">${status}</span>
      <span class="top__actions">
        ${CAN_FOLDER
          ? folder
            ? folder.ok
              ? html`<span class="saved" title="Każda zmiana zapisuje się też na dysku">Folder: ${folder.name} ✓</span>`
              : html`<button type="button" class="btn is--warn" onClick=${resumeFolder}>Wznów zapis do folderu „${folder.name}”</button>`
            : html`<button type="button" class="btn is--ghost" onClick=${linkFolder} title="Każda zmiana zapisze się też w wybranym folderze na dysku">Zapisuj w folderze…</button>`
          : html`<span class=${`saved${stale ? " is--warn" : ""}`} title="Safari nie pozwala zapisywać prosto do folderu — rób backup na dysk">Backup: ${ago(meta.lastBackup)}</span>`}
        <label class="btn is--ghost">Wczytaj backup<input type="file" accept=".khorei,.zip" hidden onChange=${(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) restore(f); }} /></label>
        <button type="button" class="btn is--ghost" onClick=${backup}>Backup na dysk</button>
        <button type="button" class="btn is--primary" onClick=${startExport}>Eksport ZIP ↓</button>
      </span>
    </header>
    <nav class="nav">
      <button type="button" class=${view === "brand" ? "is--on" : ""} onClick=${() => { setView("brand"); setPage("index"); }}>Marka${brandWarn ? html` <span class="nav__dot" title="Coś wymaga uwagi"></span>` : null}</button>
      <span class="nav__label">Rozdziały</span>
      <ol>${site.chapters.map((c, i) => html`<li class=${`${view === c.id ? "is--on" : ""}${navOver === i ? " is--over" : ""}`} draggable="true"
        onDragStart=${(e) => { e.dataTransfer.setData("kh/chapters", String(i)); e.dataTransfer.effectAllowed = "move"; }}
        onDragOver=${(e) => { if (e.dataTransfer.types.includes("kh/chapters")) { e.preventDefault(); setNavOver(i); } }}
        onDragLeave=${() => setNavOver(null)}
        onDrop=${(e) => { const from = e.dataTransfer.getData("kh/chapters"); setNavOver(null); if (from !== "") { e.preventDefault(); update((p) => moveTo(p.chapters, Number(from), i)); } }}>
        <button type="button" onClick=${() => { setView(c.id); setPage(c.id); }}><span>${c.num}</span>${c.title || "Bez tytułu"}<em>${single ? "" : c.sections.length || ""}</em></button>
        <span class="nav__tools">
          <button type="button" title="Duplikuj rozdział" aria-label="Duplikuj rozdział" onClick=${() => { const nc = freshIds(project.chapters[i]); nc.title = `${nc.title} (kopia)`; nc.slug = ""; nc.slugLocked = false; update((p) => { p.chapters.splice(i + 1, 0, nc); }); setView(nc.id); setPage(nc.id); }}><${Icon} name="duplicate" /></button>
          ${i > 0 && html`<button type="button" title="W górę" aria-label="W górę" onClick=${() => update((p) => move(p.chapters, i, -1))}><${Icon} name="up" /></button>`}
          ${i < site.chapters.length - 1 && html`<button type="button" title="W dół" aria-label="W dół" onClick=${() => update((p) => move(p.chapters, i, 1))}><${Icon} name="down" /></button>`}
          <button type="button" title="Usuń" onClick=${() => { if (confirm(`Usunąć rozdział „${c.title}”?`)) { update((p) => { p.chapters.splice(i, 1); }); setView("brand"); } }}><${Icon} name="close" /></button>
        </span>
      </li>`)}</ol>
      <button type="button" class="btn is--add" onClick=${() => { const nc = newChapter(); update((p) => { p.chapters.push(nc); }); setView(nc.id); setPage(nc.id); }}>+ Dodaj rozdział</button>
      <span class="nav__label">Publikacja</span>
      <button type="button" class=${view === "publish" ? "is--on" : ""} onClick=${() => setView("publish")}>Wydanie${publishWarn ? html` <span class="nav__dot" title="Coś wymaga uwagi"></span>` : null}</button>
      <button type="button" class=${view === "studio" ? "is--on" : ""} onClick=${() => setView("studio")}>Studio</button>
    </nav>
    <main class="panel"><${Safe} key=${view} label="Formularz">
      ${view === "publish"
        ? html`<${PublishForm} b=${project.brand} ctx=${ctx} set=${(fn) => update((p) => fn(p.brand))} />`
        : view === "studio"
        ? html`<${StudioForm} b=${project.brand} ctx=${ctx} set=${(fn) => update((p) => fn(p.brand))} />`
        : view === "brand" || !chapter
        ? html`<${BrandForm} b=${project.brand} ctx=${ctx} set=${(fn) => update((p) => fn(p.brand))} />`
        : html`<${ChapterForm} key=${chapter.id + (single ? "s" : "m")} single=${single} c=${chapter} num=${site.chapters[chapterIndex].num} ctx=${ctx}
            onFocus=${setFocus} select=${select} set=${(fn) => update((p) => { fn(p.chapters[chapterIndex]); })} />`}
    <//></main>
    <${Safe} label="Podgląd"><${Preview} project=${project} page=${page} urls=${urls} focus=${focus} studio=${studio} svgText=${svgText} spotOn=${spotOn}
      onSelect=${(sel) => {
        const c = project.chapters.find((ch) => (ch.sections || []).some((x) => x.id === sel.section));
        if (!c) return;
        setView(c.id); if (!single) setPage(c.id);
        setSelect({ ...sel, n: Date.now() });
      }}
      setPage=${(slug) => { const c = site.chapters.find((x) => x.slug === slug); setPage(c ? c.id : "index"); setView(c ? c.id : "brand"); }} /><//>
  </div>`;
}

render(html`<${App} />`, document.getElementById("app"));

