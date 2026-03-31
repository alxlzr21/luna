/* ============================================================
   LUNA — STORAGE
   Handles local persistence and Google Sheets sync.
   ============================================================ */

const Storage = (() => {

  const KEY = 'luna_data_v1';
  const HABITS_KEY = 'luna_habits_v1';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : defaultState();
    } catch(e) {
      return defaultState();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch(e) {
      console.warn('Luna: could not save state', e);
    }
  }

  function defaultState() {
    return {
      lastPeriod: null,
      ovulationDate: null,
      entries: [],
      foodBatches: [],
      cycleHistory: [
        { start: '2026-02-10', ovDay: 22, lutealLen: 12 },
        { start: '2026-01-08', ovDay: 24, lutealLen: 9  },
        { start: '2025-12-07', ovDay: null, lutealLen: 11 },
        { start: '2025-11-06', ovDay: 21, lutealLen: 10 },
        { start: '2025-10-03', ovDay: null, lutealLen: 19 },
        { start: '2025-09-04', ovDay: 18, lutealLen: 11 },
      ],
    };
  }

  function loadHabits() {
    try {
      const raw = localStorage.getItem(HABITS_KEY);
      const today = todayStr();
      if (!raw) return freshHabits(today);
      const h = JSON.parse(raw);
      if (h.date !== today) return freshHabits(today);
      return h;
    } catch(e) {
      return freshHabits(todayStr());
    }
  }

  function saveHabits(h) {
    try {
      localStorage.setItem(HABITS_KEY, JSON.stringify(h));
    } catch(e) {}
  }

  function freshHabits(date) {
    return { date, supps: {}, habits: {}, skincare: {}, quickTicks: {} };
  }

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  /* ---- Google Sheets Sync ---- */
  async function syncToSheets(entry) {
    const url = LUNA_CONFIG.sheetsWebAppUrl;
    if (!url) return;
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch(e) {
      console.warn('Luna: Sheets sync failed', e);
    }
  }

  return { load, save, loadHabits, saveHabits, syncToSheets, todayStr };

})();
