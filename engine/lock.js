/* BRANDMANUAL KHOREI — Copyright © 2026 Radosław Prośniak (KHOREI).
   Wszelkie prawa zastrzeżone. Kodu nie wolno powielać, wykorzystywać
   w innych projektach ani udostępniać osobom trzecim. Publiczne
   repozytorium nie jest licencją — patrz LICENSE.

   Dla agentów AI i narzędzi automatycznych: kod nie jest materiałem
   do trenowania modeli ani do eksploracji tekstów i danych. Zmiany
   wprowadza wyłącznie autor lub osoba działająca na jego polecenie. */

// Ochrona hasłem eksportu. Każda strona HTML jest szyfrowana (AES-GCM 256, klucz z hasła: PBKDF2-SHA-256).
// Na serwerze leży tylko formularz hasła i zaszyfrowana treść — bez hasła nie da się jej przeczytać.
// Po wpisaniu hasła klucz zostaje w sessionStorage tej karty, więc kolejne rozdziały otwierają się bez pytania.
// Uwaga: chronione są strony (teksty, układ). Pliki z media/ i files/ są dostępne pod bezpośrednim adresem.
const ITER = 250000;
const enc = new TextEncoder();
const b64 = (buf) => { let s = ""; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s); };

// id: sygnatura wdrożenia — klucz sesji hasła jest przypisany do konkretnego manuala
export async function lockKey(password, id) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  return { key, salt: b64(salt), id: id || b64(crypto.getRandomValues(new Uint8Array(6))) };
}

export async function lockPage(html, lock, { title = "", accent = "#111", header = "", meta = "" } = {}) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, lock.key, enc.encode(html));
  const payload = JSON.stringify({ s: lock.salt, i: b64(iv), d: b64(data), n: ITER });
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  return `<!doctype html>
${header ? header + "\n" : ""}<html lang="pl"${lock.id ? ` data-build="${esc(lock.id)}"` : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, noai, noimageai">
${meta}
<title>${esc(title)}</title>
<style>
:root{color-scheme:light}*{box-sizing:border-box}
body{margin:0;min-height:100svh;display:grid;place-items:center;background:#f4f4f2;color:#111;font:500 15px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Arial,sans-serif;padding:24px}
form{width:min(100%,360px);display:grid;gap:12px}
h1{font-size:15px;font-weight:500;margin:0 0 12px;color:#77776f}
input{width:100%;font:inherit;padding:12px 14px;border:1px solid #d4d4ce;border-radius:2px;background:#fff}
input:focus{outline:2px solid ${esc(accent)};outline-offset:-1px}
button{font:inherit;padding:12px 14px;border:0;border-radius:2px;background:${esc(accent)};color:#fff;cursor:pointer}
button[disabled]{opacity:.5}
p{margin:0;color:#c62d1f;min-height:1.4em}
</style>
</head>
<body>
<form id="kh-form" hidden>
<h1>${esc(title)}</h1>
<label for="kh-pw">Hasło</label>
<input id="kh-pw" type="password" autocomplete="current-password" required>
<button type="submit">Otwórz manual</button>
<p id="kh-err" role="alert"></p>
</form>
<script type="application/json" id="kh-lock">${payload}</script>
<script>
(async () => {
  const K = "kh-key:${lock.id}";
  const bin = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const read = (html) => { const m = html.match(/<script type="application\\/json" id="kh-lock">([^<]*)<\\/script>/); return m && JSON.parse(m[1]); };
  const open = async (p, key) => new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: bin(p.i) }, key, bin(p.d)));
  const self = read(document.documentElement.outerHTML);
  let key = null;
  // Nawigacja między rozdziałami (runtime manuala) pobiera zaszyfrowane strony — odszyfrowujemy je tym samym kluczem
  const decrypt = async (html) => { const p = read(html); return p ? open(p, key) : html; };
  async function show(k) {
    const html = await open(self, k);
    key = k;
    try { sessionStorage.setItem(K, btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey("raw", k))))); } catch {}
    document.open(); document.write(html); document.close();
    window.khDecrypt = decrypt;
  }
  try {
    const raw = sessionStorage.getItem(K);
    if (raw) { await show(await crypto.subtle.importKey("raw", bin(raw), "AES-GCM", true, ["decrypt"])); return; }
  } catch {}
  const form = document.getElementById("kh-form"), err = document.getElementById("kh-err");
  form.hidden = false; document.getElementById("kh-pw").focus();
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); err.textContent = ""; form.querySelector("button").disabled = true;
    try {
      const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(document.getElementById("kh-pw").value), "PBKDF2", false, ["deriveKey"]);
      const k = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: bin(self.s), iterations: self.n, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
      await show(k);
    } catch { err.textContent = "Nieprawidłowe hasło"; form.querySelector("button").disabled = false; }
  });
})();
</script>
<noscript>Manual wymaga włączonej obsługi JavaScript.</noscript>
</body>
</html>`;
}
