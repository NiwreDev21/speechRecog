/* =============================================
   TALK TO ME — English Learning App
   db.js — Capa de acceso a datos (IndexedDB)
   Todas las lecturas/escrituras persistentes de la app pasan por aqui.
   Sin dependencias de UI ni de logica de negocio de ninguna feature.
   ============================================= */

'use strict';

// ============ INDEXEDDB ============
let db;

function openDB() {
  return new Promise((res, rej) => {
    if (db) return res(db);
    const req = indexedDB.open('EchoDB', 4);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('phrases')) {
        d.createObjectStore('phrases', { keyPath: 'id', autoIncrement: true });
      }
      if (!d.objectStoreNames.contains('estructuras')) {
        d.createObjectStore('estructuras', { keyPath: 'id', autoIncrement: true });
      }
      if (!d.objectStoreNames.contains('audio')) {
        const as = d.createObjectStore('audio', { keyPath: 'id', autoIncrement: true });
        as.createIndex('byPhrase', 'phraseId');
        as.createIndex('byPhraseRole', ['phraseId','role']);
      }
      if (!d.objectStoreNames.contains('mazos')) {
        d.createObjectStore('mazos', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('stats')) {
        d.createObjectStore('stats', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('cfg')) {
        d.createObjectStore('cfg', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('sessions')) {
        const ss = d.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
        ss.createIndex('byDate', 'created');
      }
    };
    req.onsuccess = e => { db = e.target.result; res(db); };
    req.onerror = () => rej(req.error);
  });
}

function idbGet(store, key) {
  return openDB().then(d => new Promise((res, rej) => {
    const tx = d.transaction(store, 'readonly');
    const r = tx.objectStore(store).get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}

function idbPut(store, value) {
  return openDB().then(d => new Promise((res, rej) => {
    const tx = d.transaction(store, 'readwrite');
    const r = tx.objectStore(store).put(value);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}

function idbDelete(store, key) {
  return openDB().then(d => new Promise((res, rej) => {
    const tx = d.transaction(store, 'readwrite');
    const r = tx.objectStore(store).delete(key);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  }));
}

function idbGetAll(store) {
  return openDB().then(d => new Promise((res, rej) => {
    const tx = d.transaction(store, 'readonly');
    const r = tx.objectStore(store).getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}

function idbGetByIndex(store, index, value) {
  return openDB().then(d => new Promise((res, rej) => {
    const tx = d.transaction(store, 'readonly');
    const r = tx.objectStore(store).index(index).getAll(value);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}

function idbClear(store) {
  return openDB().then(d => new Promise((res, rej) => {
    const tx = d.transaction(store, 'readwrite');
    const r = tx.objectStore(store).clear();
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  }));
}

async function saveAudioBlob(phraseId, role, blob, name) {
  const existing = await getAudioRecord(phraseId, role);
  if (existing) await idbDelete('audio', existing.id);
  return idbPut('audio', { phraseId, role, blob, name: name || role, created: Date.now() });
}

async function getAudioRecord(phraseId, role) {
  const results = await idbGetByIndex('audio', 'byPhraseRole', [phraseId, role]);
  return results[0] || null;
}

function blobURL(blob) {
  return URL.createObjectURL(blob);
}

