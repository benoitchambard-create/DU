/*
 * Stockage : copie de travail dans le navigateur (IndexedDB) + enregistrement automatique
 * dans un fichier duerp.json choisi par l'utilisateur (File System Access API, Chrome / Edge).
 * Aucune donnée ne quitte le poste.
 */
(function (DU) {
  'use strict';
  const { clone, todayISO } = DU.util;

  const DB_NAME = 'duerp';
  const STORE = 'kv';
  let dbPromise = null;

  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  async function idb(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
    });
  }
  const idbGet = (k) => idb('readonly', (s) => s.get(k));
  const idbSet = (k, v) => idb('readwrite', (s) => s.put(v, k));
  const idbDel = (k) => idb('readwrite', (s) => s.delete(k));

  /* ---------- État ---------- */
  let data = null;
  let fileHandle = null;
  const listeners = new Set();
  const status = {
    state: 'idle', // idle | saving | saved | error
    lastSaved: null,
    fileName: null,
    filePermission: 'none', // none | granted | prompt
    message: '',
  };
  const statusListeners = new Set();
  const supportsFS = 'showSaveFilePicker' in window;

  const emit = () => listeners.forEach((fn) => fn(data));
  const emitStatus = () => statusListeners.forEach((fn) => fn(status));

  function migrate(d) {
    const base = DU.model.emptyData();
    const out = Object.assign(base, d);
    out.entreprise = Object.assign(base.entreprise, d.entreprise || {});
    out.document = Object.assign(DU.model.emptyData().document, d.document || {});
    out.seuils = Object.assign({ priorite: 12, second: 4 }, d.seuils || {});
    out.unites.forEach((u) => { u.penibilite = u.penibilite || {}; });
    out.actions.forEach((a) => { a.risqueIds = a.risqueIds || []; a.statut = a.statut || 'a_lancer'; });
    return out;
  }

  async function init() {
    try {
      const saved = await idbGet('data');
      data = saved ? migrate(saved) : null;
      fileHandle = (await idbGet('fileHandle')) || null;
      if (fileHandle) {
        status.fileName = fileHandle.name;
        status.filePermission = await permissionOf(fileHandle, false);
      }
    } catch (e) {
      console.error(e);
      status.state = 'error';
      status.message = 'Stockage du navigateur indisponible : pensez à exporter régulièrement.';
    }
    emitStatus();
    return data;
  }

  async function permissionOf(handle, ask) {
    if (!handle || !handle.queryPermission) return 'none';
    const opts = { mode: 'readwrite' };
    let p = await handle.queryPermission(opts);
    if (p !== 'granted' && ask) p = await handle.requestPermission(opts);
    return p === 'granted' ? 'granted' : 'prompt';
  }

  /* ---------- Sauvegarde ---------- */
  let saveTimer = null;
  function scheduleSave() {
    status.state = 'saving';
    emitStatus();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 450);
  }

  async function persist() {
    try {
      await idbSet('data', data);
      if (fileHandle && status.filePermission === 'granted') {
        const w = await fileHandle.createWritable();
        await w.write(JSON.stringify(data, null, 1));
        await w.close();
      }
      status.state = 'saved';
      status.lastSaved = new Date();
      status.message = '';
    } catch (e) {
      console.error(e);
      status.state = 'error';
      status.message = 'L’enregistrement a échoué. Exportez une sauvegarde par précaution.';
    }
    emitStatus();
  }

  /** Force l'écriture immédiate (avant impression, fermeture…). */
  async function flush() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
      await persist();
    }
  }

  window.addEventListener('beforeunload', (e) => {
    if (status.state === 'saving') {
      flush();
      e.preventDefault();
    }
  });

  /* ---------- Journal des modifications depuis la dernière version ---------- */
  function record(entry) {
    const e = Object.assign({ date: todayISO(), champs: [] }, entry);
    const j = data.journal;
    const i = j.findIndex((x) => x.entity === e.entity && x.id === e.id);
    if (i === -1) {
      if (e.type !== 'suppression' || e.entity) j.push(e);
      return;
    }
    const prev = j[i];
    if (e.type === 'suppression') {
      if (prev.type === 'ajout') j.splice(i, 1);
      else j[i] = Object.assign(prev, { type: 'suppression', date: e.date, champs: [] });
      return;
    }
    // ajout + modification → reste un ajout ; modification + modification → union des champs
    prev.libelle = e.libelle;
    prev.ut = e.ut;
    prev.num = e.num;
    prev.date = e.date;
    if (prev.type === 'modification') {
      prev.champs = Array.from(new Set([...(prev.champs || []), ...(e.champs || [])]));
    }
  }

  /**
   * Applique une modification : `mutator(data)` modifie les données et peut
   * renvoyer une ou plusieurs entrées de journal.
   */
  function commit(mutator) {
    const entries = mutator(data);
    [].concat(entries || []).forEach(record);
    scheduleSave();
    emit();
  }

  function replace(newData) {
    data = migrate(newData);
    scheduleSave();
    emit();
  }

  /* ---------- Fichier lié ---------- */
  const PICKER = {
    types: [{ description: 'Document unique (JSON)', accept: { 'application/json': ['.json'] } }],
  };

  async function linkFile() {
    if (!supportsFS) throw new Error('unsupported');
    const handle = await window.showSaveFilePicker(Object.assign({ suggestedName: 'duerp.json' }, PICKER));
    fileHandle = handle;
    await idbSet('fileHandle', handle);
    status.fileName = handle.name;
    status.filePermission = 'granted';
    await persist();
  }

  async function openFile() {
    let text, handle = null;
    if (supportsFS) {
      [handle] = await window.showOpenFilePicker(PICKER);
      text = await (await handle.getFile()).text();
    } else {
      text = await pickFileText('.json');
    }
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.risques)) throw new Error('format');
    data = migrate(parsed);
    if (handle) {
      fileHandle = handle;
      await idbSet('fileHandle', handle);
      status.fileName = handle.name;
      status.filePermission = await permissionOf(handle, true);
    }
    await persist();
    emit();
  }

  async function reconnect() {
    if (!fileHandle) return;
    status.filePermission = await permissionOf(fileHandle, true);
    if (status.filePermission === 'granted') {
      // Le fichier peut avoir été modifié ailleurs : on garde la version la plus récente du navigateur
      await persist();
    }
    emitStatus();
  }

  async function unlinkFile() {
    fileHandle = null;
    await idbDel('fileHandle');
    status.fileName = null;
    status.filePermission = 'none';
    emitStatus();
  }

  async function reset() {
    data = null;
    await idbDel('data');
    await unlinkFile();
    emit();
  }

  function pickFileText(accept) {
    return pickFile(accept).then((f) => f.text());
  }

  function pickFile(accept) {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.addEventListener('change', () => (input.files[0] ? resolve(input.files[0]) : reject(new Error('aucun fichier'))));
      input.click();
    });
  }

  DU.store = {
    init, commit, replace, flush, linkFile, openFile, reconnect, unlinkFile, reset, pickFile,
    get: () => data,
    snapshot: () => clone(data),
    subscribe: (fn) => listeners.add(fn),
    onStatus: (fn) => { statusListeners.add(fn); fn(status); },
    status,
    supportsFS,
  };
})(window.DU);
