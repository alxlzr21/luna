/* ============================================================
   LUNA — STORAGE v2
   Local persistence + Google Sheets sync.
   Handles: entries, food batches, temperature readings,
   Apple Health import, Ultrahuman CSV import,
   and user-edited habit/supplement config.
   ============================================================ */

const Storage = (() => {

  const KEY        = 'luna_data_v2';
  const HABITS_KEY = 'luna_habits_v2';
  const CONFIG_KEY = 'luna_user_config_v2';

  /* ---- STATE ---- */

  function defaultState() {
    return {
      lastPeriod:    null,
      ovulationDate: null,
      entries:       [],
      foodBatches:   [],
      temperatures:  [],   /* { iso, value, unit, note, cycleDay, phase, source } */
      importedData:  [],   /* rows from Apple Health / Ultrahuman */
      cycleHistory: [
        { start:'2026-02-10', ovDay:22, lutealLen:12 },
        { start:'2026-01-08', ovDay:24, lutealLen:9  },
        { start:'2025-12-07', ovDay:null, lutealLen:11 },
        { start:'2025-11-06', ovDay:21, lutealLen:10 },
        { start:'2025-10-03', ovDay:null, lutealLen:19 },
        { start:'2025-09-04', ovDay:18, lutealLen:11 },
      ],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const saved = raw ? JSON.parse(raw) : {};
      return Object.assign(defaultState(), saved);
    } catch(e) { return defaultState(); }
  }

  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch(e) { console.warn('Luna: save failed', e); }
  }

  /* ---- HABITS (daily reset) ---- */

  function freshHabits(date) {
    return { date, supps:{}, habits:{}, quickTicks:{} };
  }

  function loadHabits() {
    try {
      const raw = localStorage.getItem(HABITS_KEY);
      const today = todayStr();
      if (!raw) return freshHabits(today);
      const h = JSON.parse(raw);
      return h.date === today ? h : freshHabits(today);
    } catch(e) { return freshHabits(todayStr()); }
  }

  function saveHabits(h) {
    try { localStorage.setItem(HABITS_KEY, JSON.stringify(h)); }
    catch(e) {}
  }

  /* ---- USER CONFIG (editable habits/supps) ---- */

  function loadUserConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }

  function saveUserConfig(cfg) {
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); }
    catch(e) {}
  }

  /* ---- TEMPERATURE ---- */

  function saveTemperature(state, reading) {
    /* reading: { value, unit, note, cycleDay, phase, iso (optional) } */
    const entry = {
      iso: reading.iso || new Date().toISOString(),
      value: reading.value,
      unit: reading.unit || 'C',
      note: reading.note || '',
      cycleDay: reading.cycleDay || null,
      phase: reading.phase || null,
      source: reading.source || 'manual',
    };
    state.temperatures.push(entry);
    save(state);
    return entry;
  }

  /* ---- GOOGLE SHEETS SYNC ---- */

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
    } catch(e) { console.warn('Luna: Sheets sync failed', e); }
  }

  /* ---- APPLE HEALTH XML IMPORT ---- */

  async function importAppleHealth(file, state) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const parser = new DOMParser();
          const xml = parser.parseFromString(text, 'application/xml');

          const results = {
            heartRate:    [],
            hrv:          [],
            sleep:        [],
            steps:        [],
            bodyTemp:     [],
            respiratoryRate: [],
            activeEnergy: [],
          };

          const records = xml.querySelectorAll('Record');
          records.forEach(r => {
            const type  = r.getAttribute('type') || '';
            const val   = parseFloat(r.getAttribute('value'));
            const start = r.getAttribute('startDate') || '';
            const unit  = r.getAttribute('unit') || '';
            if (!start || isNaN(val)) return;

            const row = { iso: new Date(start).toISOString(), value: val, unit };

            if (type.includes('HeartRate') && !type.includes('Variability')) {
              results.heartRate.push(row);
            } else if (type.includes('HeartRateVariabilitySDNN')) {
              results.hrv.push(row);
            } else if (type.includes('StepCount')) {
              results.steps.push(row);
            } else if (type.includes('BodyTemperature')) {
              results.bodyTemp.push(row);
            } else if (type.includes('RespiratoryRate')) {
              results.respiratoryRate.push(row);
            } else if (type.includes('ActiveEnergyBurned')) {
              results.activeEnergy.push(row);
            }
          });

          /* Also pull sleep from CategorySamples */
          const cats = xml.querySelectorAll('CategorySample');
          cats.forEach(c => {
            const type  = c.getAttribute('type') || '';
            const start = c.getAttribute('startDate') || '';
            const end   = c.getAttribute('endDate') || '';
            if (type.includes('SleepAnalysis') && start && end) {
              const mins = Math.round((new Date(end) - new Date(start)) / 60000);
              results.sleep.push({ iso: new Date(start).toISOString(), minutes: mins });
            }
          });

          /* Store in state */
          const summary = {};
          Object.entries(results).forEach(([key, rows]) => {
            if (rows.length) {
              state.importedData.push(...rows.map(r => ({ ...r, dataType: key, source: 'apple_health' })));
              summary[key] = rows.length;
            }
          });

          /* Also store body temps in temperatures array for unified display */
          results.bodyTemp.forEach(r => {
            state.temperatures.push({
              iso: r.iso,
              value: r.value,
              unit: r.unit || 'C',
              note: '',
              cycleDay: null,
              phase: null,
              source: 'apple_health',
            });
          });

          save(state);
          resolve(summary);
        } catch(err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  }

  /* ---- ULTRAHUMAN CSV IMPORT ---- */

  async function importUltrahuman(file, state) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.trim().split('\n');
          if (lines.length < 2) throw new Error('CSV appears empty');

          const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
          const rows = [];
          const temps = [];
          const summary = { rows: 0, temperatures: 0 };

          for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(',');
            if (vals.length < 2) continue;
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = (vals[idx] || '').trim(); });

            /* Try to find date/time column */
            const dateKey = headers.find(h => h.includes('date') || h.includes('time') || h === 'timestamp');
            const iso = dateKey && obj[dateKey] ? new Date(obj[dateKey]).toISOString() : null;
            if (!iso || iso === 'Invalid Date') continue;

            const row = { ...obj, iso, source: 'ultrahuman' };
            rows.push(row);
            summary.rows++;

            /* Pull skin/body temperature if present */
            const tempKey = headers.find(h => h.includes('temp') || h.includes('skin'));
            if (tempKey && obj[tempKey] && !isNaN(parseFloat(obj[tempKey]))) {
              const t = {
                iso,
                value: parseFloat(obj[tempKey]),
                unit: 'C',
                note: 'Ultrahuman skin temp',
                cycleDay: null,
                phase: null,
                source: 'ultrahuman',
              };
              temps.push(t);
              summary.temperatures++;
            }
          }

          state.importedData.push(...rows.map(r => ({ ...r, dataType: 'ultrahuman', source: 'ultrahuman' })));
          state.temperatures.push(...temps);
          save(state);
          resolve(summary);
        } catch(err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  }

  /* ---- UTIL ---- */

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function nowTimeStr() {
    return new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
  }

  return {
    load, save,
    loadHabits, saveHabits,
    loadUserConfig, saveUserConfig,
    saveTemperature,
    syncToSheets,
    importAppleHealth,
    importUltrahuman,
    todayStr, nowTimeStr,
  };

})();
