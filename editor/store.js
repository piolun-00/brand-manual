// Zapis w przeglądarce (IndexedDB): projekty i ich pliki. Nic nie wychodzi poza Twój komputer.
const DB = "khorei-brandmanual";
let dbp;
function db() {
  dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("projects", { keyPath: "id" });
      r.result.createObjectStore("assets");
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => res(out?.result ?? out);
    t.onerror = () => rej(t.error);
  });
}

export const listProjects = async () =>
  (await tx("projects", "readonly", (s) => s.getAll())).map(({ id, name, updated }) => ({ id, name, updated })).sort((a, b) => b.updated - a.updated);
export const getProject = (id) => tx("projects", "readonly", (s) => s.get(id));
export const putProject = (p) => tx("projects", "readwrite", (s) => s.put({ ...p, updated: Date.now() }));

export const putAsset = (pid, path, blob) => tx("assets", "readwrite", (s) => s.put(blob, `${pid}/${path}`));
export const getAsset = (pid, path) => tx("assets", "readonly", (s) => s.get(`${pid}/${path}`));
export async function assetKeys(pid) {
  const keys = await tx("assets", "readonly", (s) => s.getAllKeys());
  return keys.filter((k) => k.startsWith(pid + "/")).map((k) => k.slice(pid.length + 1));
}
export async function deleteProject(pid) {
  for (const path of await assetKeys(pid)) await tx("assets", "readwrite", (s) => s.delete(`${pid}/${path}`));
  await tx("projects", "readwrite", (s) => s.delete(pid));
}
