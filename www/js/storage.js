/* ===========================================================================
 * storage.js — Save / load to localStorage.
 * On native (Capacitor) localStorage is persisted by the WebView, which is
 * fine for v1. For cloud saves later, swap save()/load() to also sync with a
 * backend (Play Games / Game Center / your own server).
 * ========================================================================= */

const Storage = {
  _OLD_KEY: 'xianxia_idle_save_v1',

  save(state) {
    try {
      localStorage.setItem(GameData.saveKey, JSON.stringify(state));
      // Migrate: remove old key once we've written to the new one.
      try { localStorage.removeItem(this._OLD_KEY); } catch (_) {}
      return true;
    } catch (e) {
      console.warn('Save failed', e);
      return false;
    }
  },

  load() {
    try {
      let raw = localStorage.getItem(GameData.saveKey);
      // Fallback: if no save under the new key, try the old key.
      if (!raw) raw = localStorage.getItem(this._OLD_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      // Reject anything that isn't a plain save object — arrays pass
      // `typeof === 'object'` but JSON.stringify silently drops named
      // properties on them, which would corrupt every future save.
      if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
      return data;
    } catch (e) {
      console.warn('Load failed', e);
      return null;
    }
  },

  wipe() {
    try {
      localStorage.removeItem(GameData.saveKey);
      localStorage.removeItem(this._OLD_KEY);
    } catch (_) {}
  },
};

window.Storage = Storage;
