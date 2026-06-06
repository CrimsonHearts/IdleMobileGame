/* ===========================================================================
 * storage.js — Save / load to localStorage.
 * On native (Capacitor) localStorage is persisted by the WebView, which is
 * fine for v1. For cloud saves later, swap save()/load() to also sync with a
 * backend (Play Games / Game Center / your own server).
 * ========================================================================= */

const Storage = {
  save(state) {
    try {
      localStorage.setItem(GameData.saveKey, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('Save failed', e);
      return false;
    }
  },

  load() {
    try {
      const raw = localStorage.getItem(GameData.saveKey);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      return data;
    } catch (e) {
      console.warn('Load failed', e);
      return null;
    }
  },

  wipe() {
    try { localStorage.removeItem(GameData.saveKey); } catch (_) {}
  },
};

window.Storage = Storage;
