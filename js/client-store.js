/**
 * ClientStore
 * Deep local-substitutable module encapsulating client storage (localStorage, sessionStorage)
 * with schema validation, safe JSON parsing, and memory fallbacks for restricted environments.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ClientStore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const memStorage = {
    local: {},
    session: {},
  };

  function getStorage(type) {
    try {
      const s = type === 'session' ? window.sessionStorage : window.localStorage;
      const testKey = '__test_store__';
      s.setItem(testKey, '1');
      s.removeItem(testKey);
      return s;
    } catch (_) {
      return {
        getItem: k => (memStorage[type][k] !== undefined ? memStorage[type][k] : null),
        setItem: (k, v) => { memStorage[type][k] = String(v); },
        removeItem: k => { delete memStorage[type][k]; },
      };
    }
  }

  const local = getStorage('local');
  const session = getStorage('session');

  function safeJsonParse(str, fallback) {
    if (!str) return fallback;
    try {
      return JSON.parse(str);
    } catch (_) {
      return fallback;
    }
  }

  // --- Theme ---
  function getTheme(defaultTheme) {
    const saved = local.getItem('timetableTheme');
    return saved || defaultTheme;
  }

  function setTheme(theme) {
    local.setItem('timetableTheme', theme);
  }

  // --- Completed Events ---
  function getCompletedEvents() {
    return safeJsonParse(local.getItem('timetableCompleted'), []);
  }

  function isEventCompleted(key) {
    const arr = getCompletedEvents();
    return arr.indexOf(key) >= 0;
  }

  function toggleEventCompleted(key) {
    const arr = getCompletedEvents();
    const idx = arr.indexOf(key);
    const completed = idx < 0;
    if (completed) {
      arr.push(key);
    } else {
      arr.splice(idx, 1);
    }
    local.setItem('timetableCompleted', JSON.stringify(arr));
    return completed;
  }

  // --- Install Banner Meta ---
  function getInstallMeta() {
    return safeJsonParse(local.getItem('installBannerMeta'), {});
  }

  function setInstallMeta(meta) {
    local.setItem('installBannerMeta', JSON.stringify(meta));
  }

  // --- Dev / Virtual Date Simulation ---
  function getDevTestDate() {
    const stored = session.getItem('timetableTestDate');
    const storedAt = session.getItem('timetableTestAt');
    if (!stored || !storedAt) return null;
    return new Date(new Date(stored).getTime() + (Date.now() - Number(storedAt)));
  }

  function setDevTestDate(isoString) {
    session.setItem('timetableTestDate', isoString);
    session.setItem('timetableTestAt', String(Date.now()));
  }

  function clearDevTestDate() {
    session.removeItem('timetableTestDate');
    session.removeItem('timetableTestAt');
  }

  function getDevViewport() {
    return session.getItem('timetableDevViewport') || null;
  }

  function setDevViewport(mode) {
    session.setItem('timetableDevViewport', mode);
  }

  // --- Pattern ---
  function getPattern(isDev, randomPatterns = ['dots', 'grid', 'blueprint', 'mesh', 'screentone']) {
    try {
      if (isDev) {
        return session.getItem('timetableDevPattern') || 'dots';
      }
      let randomPattern = session.getItem('timetableMainPattern');
      if (!randomPattern || !randomPatterns.includes(randomPattern)) {
        randomPattern = randomPatterns[Math.floor(Math.random() * randomPatterns.length)];
        session.setItem('timetableMainPattern', randomPattern);
      }
      return randomPattern;
    } catch (_) {
      return 'dots';
    }
  }

  function setDevPattern(pattern) {
    session.setItem('timetableDevPattern', pattern);
  }

  // --- Cached Timetable Data ---
  function getCachedTimetableData() {
    return safeJsonParse(session.getItem('timetableData'), null);
  }

  function setCachedTimetableData(data) {
    try {
      session.setItem('timetableData', JSON.stringify(data));
      session.setItem('timetableDataAt', String(Date.now()));
    } catch (_) {}
  }

  return {
    getTheme,
    setTheme,
    getCompletedEvents,
    isEventCompleted,
    toggleEventCompleted,
    getInstallMeta,
    setInstallMeta,
    getDevTestDate,
    setDevTestDate,
    clearDevTestDate,
    getDevViewport,
    setDevViewport,
    getPattern,
    setDevPattern,
    getCachedTimetableData,
    setCachedTimetableData,
  };
});
