/* ============================================================
   LUNA — APP v2
   Timestamps on everything, temperature log, nested habits,
   edit mode, Apple Health + Ultrahuman importers.
   ============================================================ */

const App = (() => {

  let state, habits, userConfig;
  let editMode = false;

  /* ================================================================
     INIT
  ================================================================ */

  function init() {
    state      = Storage.load();
    habits     = Storage.loadHabits();
    userConfig = Storage.loadUserConfig();
    checkNFC();
    if (!state.lastPeriod) {
      showScreen('setup');
    } else {
      showScreen('main');
      renderAll();
    }
    bindTabs();
  }

  function checkNFC() {
    const params = new URLSearchParams(window.location.search);
    const nfc = params.get('nfc');
    if (!nfc) return;
    const tag = LUNA_CONFIG.nfcTags.find(t => t.id === nfc);
    if (tag) setTimeout(() => openNFCContext(tag), 200);
  }

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('screen-' + name);
    if (el) el.classList.add('active');
  }

  function bindTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(p => {
          p.classList.toggle('hidden', p.id !== 'tab-' + tab);
        });
        if (tab === 'insights')  renderInsights();
        if (tab === 'today')     renderToday();
        if (tab === 'food')      renderBatches();
        if (tab === 'temp')      renderTempHistory();
        if (tab === 'data')      renderImportedData();
      });
    });
  }

  /* ================================================================
     SETUP
  ================================================================ */

  function completeSetup() {
    const val = document.getElementById('setup-period-date').value;
    if (!val) return;
    state.lastPeriod = val;
    Storage.save(state);
    showScreen('main');
    renderAll();
  }

  /* ================================================================
     PHASE BANNER
  ================================================================ */

  function renderPhase() {
    const info = Cycle.getPhaseInfo(state.lastPeriod, state.ovulationDate);
    const banner = document.getElementById('phase-banner');
    if (!info) { banner.className = 'phase-banner'; return; }
    const meta = Cycle.getMeta(info.key);
    banner.className = 'phase-banner ' + info.key;
    document.getElementById('phase-label').textContent    = meta.label;
    document.getElementById('phase-day-text').textContent = Cycle.formatDayLabel(info);
    document.getElementById('phase-note-text').textContent = meta.note;
    if (state.ovulationDate) {
      const s = document.getElementById('ov-status');
      s.textContent = 'Ovulation confirmed — ' + formatDate(state.ovulationDate);
      s.classList.remove('hidden');
    }
  }

  /* ================================================================
     HABITS (nested, with edit mode)
  ================================================================ */

  function getHabitGroups() {
    /* User config overrides built-in config if present */
    return (userConfig && userConfig.habitGroups) || LUNA_CONFIG.habitGroups;
  }

  function getSupplements() {
    return (userConfig && userConfig.supplements) || LUNA_CONFIG.supplements;
  }

  function renderHabits() {
    renderSupplements();
    renderHabitGroups();
  }

  function renderSupplements() {
    const el = document.getElementById('supps-list');
    if (!el) return;
    const supps = getSupplements().filter(s => s.active !== false);
    el.innerHTML = supps.map(s => tickItemHTML('supps', s, editMode)).join('');
    if (editMode) {
      el.innerHTML += addItemButtonHTML('supp');
    }
  }

  function renderHabitGroups() {
    const el = document.getElementById('habits-groups');
    if (!el) return;
    const groups = getHabitGroups();
    el.innerHTML = groups.map(g => habitGroupHTML(g)).join('');
    if (editMode) {
      el.innerHTML += addItemButtonHTML('group');
    }
  }

  function habitGroupHTML(group) {
    const children = (group.children || []).filter(c => c.active !== false);
    const childrenHTML = children.map(child => {
      if (child.children) {
        /* sub-group */
        return `<div class="habit-subgroup">
          <div class="habit-subgroup-label">${child.name}</div>
          <div class="tick-list">
            ${child.children.filter(c => c.active !== false).map(c => tickItemHTML('habits', c, editMode)).join('')}
            ${editMode ? addItemButtonHTML('subhabit', child.id) : ''}
          </div>
        </div>`;
      }
      return tickItemHTML('habits', child, editMode);
    }).join('');

    return `<div class="habit-group">
      <div class="habit-group-header">
        <span class="habit-group-name">${group.name}</span>
        ${editMode ? `<button class="edit-add-btn" onclick="App.addHabitToGroup('${group.id}')">+ add</button>` : ''}
      </div>
      <div class="tick-list">${childrenHTML}</div>
    </div>`;
  }

  function tickItemHTML(group, item, isEdit) {
    const done = !!(habits[group] && habits[group][item.id]);
    const editControls = isEdit
      ? `<button class="edit-del-btn" onclick="App.deleteItem('${group}','${item.id}')" title="Remove">×</button>`
      : '';
    return `<div class="tick-item ${done ? 'done' : ''}" id="tick-${item.id}">
      <div class="tick-dot" onclick="App.toggleTick('${group}','${item.id}')">
        <div class="tick-dot-inner"></div>
      </div>
      <span class="tick-name" onclick="App.toggleTick('${group}','${item.id}')">${item.name}</span>
      ${item.note || item.meta ? `<span class="tick-meta">${item.note || item.meta}</span>` : ''}
      ${editControls}
    </div>`;
  }

  function addItemButtonHTML(type, parentId) {
    const attr = parentId ? `data-parent="${parentId}"` : '';
    return `<button class="edit-add-btn wide" ${attr} onclick="App.addItem('${type}','${parentId||''}')">+ add ${type === 'group' ? 'group' : 'habit'}</button>`;
  }

  function toggleTick(group, id) {
    if (editMode) return;
    if (!habits[group]) habits[group] = {};
    habits[group][id] = !habits[group][id];
    Storage.saveHabits(habits);
    const el = document.getElementById('tick-' + id);
    if (el) el.classList.toggle('done', !!habits[group][id]);
    /* Log supplement tick with timestamp */
    if (group === 'supps' && habits[group][id]) {
      const supp = getSupplements().find(s => s.id === id);
      if (supp) logSuppTick(supp);
    }
  }

  function logSuppTick(supp) {
    const info = Cycle.getPhaseInfo(state.lastPeriod, state.ovulationDate);
    const now  = new Date();
    state.entries.push({
      date:     now.toISOString(),
      time:     now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }),
      type:     'supplement',
      summary:  supp.name + ' taken',
      tags:     ['supplement'],
      flags:    [],
      cycleDay: info?.cycleDay || null,
      phase:    info?.key || null,
      raw:      supp.name,
    });
    Storage.save(state);
  }

  /* ================================================================
     EDIT MODE
  ================================================================ */

  function toggleEditMode() {
    editMode = !editMode;
    const btn = document.getElementById('edit-mode-btn');
    if (btn) {
      btn.textContent = editMode ? 'Done editing' : 'Edit habits';
      btn.classList.toggle('active', editMode);
    }
    renderHabits();
  }

  function addItem(type, parentId) {
    const name = prompt(type === 'group' ? 'Group name:' : 'Habit name:');
    if (!name) return;
    const cfg = getUserConfigCopy();
    const id  = 'custom-' + Date.now();

    if (type === 'group') {
      cfg.habitGroups.push({ id, name, children: [] });
    } else if (type === 'supp') {
      cfg.supplements.push({ id, name, time:'', note:'', active:true });
    } else {
      /* Find parent group or subgroup */
      cfg.habitGroups.forEach(g => {
        if (g.id === parentId) {
          g.children.push({ id, name, meta:'', active:true });
        }
        (g.children || []).forEach(c => {
          if (c.id === parentId) {
            if (!c.children) c.children = [];
            c.children.push({ id, name, meta:'', active:true });
          }
        });
      });
    }

    userConfig = cfg;
    Storage.saveUserConfig(cfg);
    renderHabits();
  }

  function addHabitToGroup(groupId) {
    addItem('habit', groupId);
  }

  function deleteItem(group, id) {
    if (!confirm('Remove this item?')) return;
    const cfg = getUserConfigCopy();
    if (group === 'supps') {
      cfg.supplements = cfg.supplements.filter(s => s.id !== id);
    } else {
      cfg.habitGroups.forEach(g => {
        g.children = (g.children || []).filter(c => c.id !== id);
        g.children.forEach(c => {
          if (c.children) c.children = c.children.filter(sc => sc.id !== id);
        });
      });
    }
    userConfig = cfg;
    Storage.saveUserConfig(cfg);
    renderHabits();
  }

  function getUserConfigCopy() {
    return JSON.parse(JSON.stringify(userConfig || {
      supplements: LUNA_CONFIG.supplements,
      habitGroups: LUNA_CONFIG.habitGroups,
    }));
  }

  /* ================================================================
     LOG MODES
  ================================================================ */

  function setLogMode(mode) {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mode-btn').forEach(b => {
      if (b.dataset.mode === mode) b.classList.add('active');
    });
    document.querySelectorAll('.log-mode-panel').forEach(p => {
      p.classList.toggle('hidden', p.id !== 'log-' + mode);
    });
    if (mode === 'quick') renderQuickTicks();
  }

  /* ================================================================
     TIMESTAMP HELPERS
  ================================================================ */

  function getTimestamp(overrideInputId) {
    /* Returns { iso, timeStr } — uses override if filled, otherwise now */
    const override = overrideInputId ? document.getElementById(overrideInputId)?.value : null;
    if (override) {
      const d = new Date(override);
      return { iso: d.toISOString(), timeStr: d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }) };
    }
    const now = new Date();
    return { iso: now.toISOString(), timeStr: now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }) };
  }

  /* ================================================================
     FREE LOG
  ================================================================ */

  async function submitFreeLog() {
    const text = document.getElementById('free-log-input').value.trim();
    if (!text) return;
    const ts = getTimestamp('free-log-time');
    const feedback = document.getElementById('log-feedback');
    feedback.className = 'log-feedback';
    feedback.innerHTML = '<span class="loading">Parsing</span>';

    const info = Cycle.getPhaseInfo(state.lastPeriod, state.ovulationDate);
    const meta = info ? Cycle.getMeta(info.key) : null;
    const ctx  = info
      ? `Cycle day ${info.cycleDay}, phase: ${info.key}. ${meta?.histamineNote || ''} PMDD risk: ${!!meta?.pmddRisk}. Anchor: ${info.anchor}.`
      : 'No cycle data.';

    const prompt = `You are a health log parser for someone with formally diagnosed PCOS and PMDD, and ADHD managed with Elvanse (30mg standard, 50mg late luteal). Histamine intolerance downstream of PCOS. ${ctx}

Parse this log and return ONLY valid JSON, no markdown:
{
  "type": "mood"|"food"|"symptom"|"supplement"|"other",
  "summary": "one clear sentence",
  "tags": ["short","tags"],
  "food_details": { "name": null, "prep_date": null, "freshness_day": null },
  "mood_note": "verbatim emotional content if present",
  "symptoms": [],
  "flags": [{ "type": "histamine"|"pmdd"|"pcos"|"insulin", "label": "short text" }],
  "correlation_note": ""
}

Flag rules — histamine: batch day 2+, fermented food, aged cheese, onions, wine, leftovers. PMDD: ONLY if late luteal AND emotional content. PCOS: energy crash, blood sugar, androgen symptoms. Insulin: post-meal crash, sugar craving, skipped meal + fog.

Log: "${text}"`;

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: LUNA_CONFIG.aiModel,
          max_tokens: 1000,
          messages: [{ role:'user', content: prompt }],
        }),
      });
      const data   = await resp.json();
      const raw    = data.content.map(c => c.text || '').join('');
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

      const entry = {
        date:     ts.iso,
        time:     ts.timeStr,
        raw:      text,
        cycleDay: info?.cycleDay || null,
        phase:    info?.key || null,
        dpo:      info?.dpo ?? null,
        anchor:   info?.anchor || null,
        ...parsed,
      };

      state.entries.push(entry);
      Storage.save(state);
      Storage.syncToSheets(entry);

      if (parsed.food_details?.name && parsed.food_details?.prep_date) {
        addBatch(parsed.food_details.name, parsed.food_details.prep_date);
      }

      feedback.innerHTML = buildFeedbackHTML(parsed);
      document.getElementById('free-log-input').value = '';
    } catch(err) {
      feedback.innerHTML = 'Saved as raw note.';
      const entry = {
        date: ts.iso, time: ts.timeStr, raw: text,
        type:'other', summary: text,
        cycleDay: info?.cycleDay || null, phase: info?.key || null,
        flags: [],
      };
      state.entries.push(entry);
      Storage.save(state);
      document.getElementById('free-log-input').value = '';
    }
  }

  function buildFeedbackHTML(parsed) {
    let h = `<strong style="font-weight:500;">${parsed.summary}</strong>`;
    if (parsed.tags?.length) h += `<br><span style="font-size:12px;color:var(--text-secondary);">${parsed.tags.join(' · ')}</span>`;
    if (parsed.flags?.length) {
      h += `<div class="entry-flags" style="margin-top:6px;">`;
      parsed.flags.forEach(f => { h += `<span class="entry-flag flag-${f.type}">${f.label}</span>`; });
      h += `</div>`;
    }
    if (parsed.food_details?.freshness_day > 1) {
      h += `<div class="correlation-note">Day ${parsed.food_details.freshness_day} batch — histamine accumulating. Note any bloating in the next 2hrs.</div>`;
    }
    if (parsed.correlation_note) h += `<div class="correlation-note">Pattern note: ${parsed.correlation_note}</div>`;
    return h;
  }

  /* ================================================================
     QUICK TICKS
  ================================================================ */

  function renderQuickTicks() {
    const grid = document.getElementById('quick-tick-grid');
    if (!grid) return;
    grid.innerHTML = LUNA_CONFIG.quickTicks.map(item => {
      const done = !!(habits.quickTicks && habits.quickTicks[item.id]);
      return `<div class="tick-card ${done ? 'done' : ''}" onclick="App.toggleQuickTick('${item.id}',this)">
        <div class="tick-card-name">${item.name}</div>
      </div>`;
    }).join('');
  }

  function toggleQuickTick(id, el) {
    if (!habits.quickTicks) habits.quickTicks = {};
    habits.quickTicks[id] = !habits.quickTicks[id];
    Storage.saveHabits(habits);
    el.classList.toggle('done', !!habits.quickTicks[id]);
    /* Log as entry with timestamp */
    if (habits.quickTicks[id]) {
      const item = LUNA_CONFIG.quickTicks.find(q => q.id === id);
      if (!item) return;
      const info = Cycle.getPhaseInfo(state.lastPeriod, state.ovulationDate);
      const now  = new Date();
      state.entries.push({
        date:     now.toISOString(),
        time:     now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }),
        type:     item.group === 'mood' ? 'mood' : 'symptom',
        summary:  item.name,
        tags:     [item.group],
        flags:    [],
        cycleDay: info?.cycleDay || null,
        phase:    info?.key || null,
        raw:      item.name,
      });
      Storage.save(state);
    }
  }

  /* ================================================================
     OVULATION
  ================================================================ */

  function confirmOvulation() {
    const val = document.getElementById('ov-date-input').value;
    if (!val) return;
    state.ovulationDate = val;
    Storage.save(state);
    const s = document.getElementById('ov-status');
    s.textContent = 'Ovulation confirmed — ' + formatDate(val) + '. Phase dates updated.';
    s.classList.remove('hidden');
    renderPhase();
  }

  /* ================================================================
     TEMPERATURE
  ================================================================ */

  function logTemperature() {
    const val  = parseFloat(document.getElementById('temp-value').value);
    const unit = document.getElementById('temp-unit').value;
    const note = document.getElementById('temp-note').value.trim();
    const ts   = getTimestamp('temp-time');

    if (isNaN(val)) {
      document.getElementById('temp-feedback').textContent = 'Please enter a number.';
      return;
    }

    const info = Cycle.getPhaseInfo(state.lastPeriod, state.ovulationDate);
    const reading = {
      iso:      ts.iso,
      value:    val,
      unit,
      note,
      cycleDay: info?.cycleDay || null,
      phase:    info?.key || null,
      source:   'manual',
    };

    Storage.saveTemperature(state, reading);

    /* Also push as a log entry so it appears in Today */
    state.entries.push({
      date:     ts.iso,
      time:     ts.timeStr,
      type:     'other',
      summary:  `Temperature: ${val}°${unit}${note ? ' — ' + note : ''}`,
      tags:     ['temperature'],
      flags:    [],
      cycleDay: info?.cycleDay || null,
      phase:    info?.key || null,
      raw:      `temp ${val}${unit}`,
    });
    Storage.save(state);

    document.getElementById('temp-value').value = '';
    document.getElementById('temp-note').value  = '';
    document.getElementById('temp-time').value  = '';
    document.getElementById('temp-feedback').textContent = `Logged ${val}°${unit} at ${ts.timeStr}`;
    renderTempHistory();
  }

  function renderTempHistory() {
    const el = document.getElementById('temp-history');
    if (!el) return;
    const temps = [...(state.temperatures || [])].reverse().slice(0, 20);
    if (!temps.length) { el.innerHTML = '<p class="empty-state">No temperature readings yet.</p>'; return; }
    el.innerHTML = temps.map(t => {
      const d    = new Date(t.iso);
      const date = d.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
      const time = d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
      return `<div class="temp-row">
        <div class="temp-val">${t.value}°${t.unit}</div>
        <div class="temp-meta">${date} ${time}${t.cycleDay ? ' · day ' + t.cycleDay : ''}${t.phase ? ' · ' + t.phase.replace('-',' ') : ''}</div>
        ${t.note ? `<div class="temp-note-text">${t.note}</div>` : ''}
        ${t.source !== 'manual' ? `<div class="temp-source">${t.source}</div>` : ''}
      </div>`;
    }).join('');
  }

  /* ================================================================
     FOOD
  ================================================================ */

  function logFood() {
    const name    = document.getElementById('food-name').value.trim();
    const prepDate= document.getElementById('food-prep-date').value;
    const notes   = document.getElementById('food-notes').value.trim();
    const ts      = getTimestamp('food-time');
    if (!name) return;

    const info = Cycle.getPhaseInfo(state.lastPeriod, state.ovulationDate);
    const entry = {
      date:     ts.iso,
      time:     ts.timeStr,
      type:     'food',
      summary:  name + (notes ? ' — ' + notes : ''),
      tags:     ['food'],
      food_details: { name, prep_date: prepDate || Storage.todayStr(), freshness_day: 0 },
      flags:    [],
      cycleDay: info?.cycleDay || null,
      phase:    info?.key || null,
      raw:      name,
    };

    state.entries.push(entry);
    addBatch(name, prepDate || Storage.todayStr());
    Storage.save(state);
    Storage.syncToSheets(entry);

    document.getElementById('food-name').value  = '';
    document.getElementById('food-prep-date').value = '';
    document.getElementById('food-notes').value = '';
    document.getElementById('food-time').value  = '';
    renderBatches();
  }

  function addBatch(name, prepDate) {
    const exists = state.foodBatches.find(b => b.name === name && b.prepDate === prepDate);
    if (!exists) {
      state.foodBatches.push({ name, prepDate, id: Date.now() });
      if (state.foodBatches.length > 40) state.foodBatches.shift();
      Storage.save(state);
    }
  }

  function renderBatches() {
    const el = document.getElementById('batch-list');
    if (!el) return;
    const recent = [...state.foodBatches].reverse().slice(0, 10);
    if (!recent.length) { el.innerHTML = '<p class="empty-state">No batches logged yet.</p>'; return; }
    el.innerHTML = recent.map(b => {
      const f = Cycle.batchFreshness(b.prepDate);
      return `<div class="batch-item">
        <div class="batch-item-name">${b.name}</div>
        <div class="batch-item-meta">Prepared ${formatDate(b.prepDate)}</div>
        ${f ? `<span class="batch-freshness batch-${f.level}">${f.label}</span>` : ''}
      </div>`;
    }).join('');
  }

  /* ================================================================
     TODAY
  ================================================================ */

  function renderToday() {
    const el    = document.getElementById('today-entries');
    const today = Storage.todayStr();
    const items = state.entries.filter(e => e.date && e.date.startsWith(today)).reverse();
    if (!items.length) { el.innerHTML = '<p class="empty-state">Nothing logged yet today.</p>'; return; }
    el.innerHTML = items.map(e => {
      const flags = e.flags || [];
      return `<div class="entry-card">
        <div class="entry-meta">
          <span class="entry-time">${e.time || ''}</span>
          <span class="entry-tag ${e.type || 'other'}">${e.type || 'note'}</span>
          ${e.cycleDay ? `<span class="entry-tag other">day ${e.cycleDay}</span>` : ''}
        </div>
        <div class="entry-text">${e.summary || e.raw}</div>
        ${flags.length ? `<div class="entry-flags">${flags.map(f => `<span class="entry-flag flag-${f.type}">${f.label}</span>`).join('')}</div>` : ''}
      </div>`;
    }).join('');
  }

  /* ================================================================
     DATA IMPORT (Apple Health + Ultrahuman)
  ================================================================ */

  async function handleAppleHealthImport(input) {
    const file = input.files[0];
    if (!file) return;
    const status = document.getElementById('ah-status');
    status.textContent = 'Importing…';
    try {
      const summary = await Storage.importAppleHealth(file, state);
      const parts = Object.entries(summary).map(([k, v]) => `${v} ${k}`);
      status.textContent = 'Imported: ' + parts.join(', ');
      renderTempHistory();
    } catch(e) {
      status.textContent = 'Import failed: ' + e.message;
    }
  }

  async function handleUltrahumanImport(input) {
    const file = input.files[0];
    if (!file) return;
    const status = document.getElementById('uh-status');
    status.textContent = 'Importing…';
    try {
      const summary = await Storage.importUltrahuman(file, state);
      status.textContent = `Imported ${summary.rows} rows, ${summary.temperatures} temperature readings.`;
      renderTempHistory();
    } catch(e) {
      status.textContent = 'Import failed: ' + e.message;
    }
  }

  function renderImportedData() {
    const el = document.getElementById('imported-summary');
    if (!el) return;
    const rows = state.importedData || [];
    if (!rows.length) { el.innerHTML = '<p class="empty-state">No imported data yet.</p>'; return; }
    const bySource = {};
    rows.forEach(r => {
      const k = r.source || 'unknown';
      bySource[k] = (bySource[k] || 0) + 1;
    });
    el.innerHTML = Object.entries(bySource).map(([src, count]) =>
      `<div class="stat-card"><div class="stat-val">${count}</div><div class="stat-label">${src} rows</div></div>`
    ).join('');
  }

  /* ================================================================
     INSIGHTS
  ================================================================ */

  function renderInsights() {
    const stats = Cycle.getStats(state.cycleHistory);
    document.getElementById('stats-grid').innerHTML = [
      { val:'33',                                         label:'Median cycle' },
      { val: stats.avgOvDay  ? stats.avgOvDay  + '' : '—', label:'Avg ovulation day' },
      { val: stats.avgLuteal ? stats.avgLuteal + '' : '—', label:'Avg luteal days' },
      { val: state.entries.length + '',                   label:'Entries logged' },
    ].map(s => `<div class="stat-card"><div class="stat-val">${s.val}</div><div class="stat-label">${s.label}</div></div>`).join('');

    document.getElementById('cycle-insights').innerHTML = [
      { title:'Late ovulation (day 17–24)', body:'Your ovulation lands well after the textbook day 14 — typical of PCOS. Your PMDD window only starts after confirmed ovulation. Log your Ultrahuman temp shift when it appears to anchor all phase dates accurately.' },
      { title:'Variable luteal phase (9–19 days)', body:'Median 12 days is healthy, but your shortest (9 days) is borderline. Short luteal phases can signal progesterone insufficiency, which directly amplifies PMDD severity.' },
      { title:'Fall to Baseline (3 of 6 cycles)', body:'Temperature starts elevated, drops early, then rises at ovulation. Linked to hormonal or metabolic disruption consistent with PCOS. May correlate with unexpected follicular phase fatigue.' },
      { title:'False Start cycles (2 of 6)', body:"Temperature rose mid-cycle without ovulation, dropped, then rose again. Your body geared up, didn't complete ovulation, tried again. Hormonally tiring — may explain fatigue in what should be a high-energy phase." },
    ].map(i => `<div class="insight-card"><div class="insight-title">${i.title}</div><div class="insight-body">${i.body}</div></div>`).join('');

    document.getElementById('pattern-insights').innerHTML = [
      { title:'Histamine is downstream of PCOS', body:'Elevated oestrogen stimulates mast cells and triggers histamine release — a core PCOS dynamic. Quercetin + nettle targets this loop at the source. Pepcid AC treats the symptom.' },
      { title:'Blood sugar stability = Elvanse efficacy', body:'PCOS-related insulin resistance reduces dopamine receptor sensitivity. Eating protein + complex carbs before your meds directly affects how well Elvanse works that day.' },
      { title:'Vitex is your most important upcoming supplement', body:'Chasteberry/Vitex works on LH regulation — the exact pathway dysregulated in PCOS. Effects build over 3–6 months and may reduce both PMDD severity and ovulation irregularity.' },
    ].map(i => `<div class="insight-card"><div class="insight-title">${i.title}</div><div class="insight-body">${i.body}</div></div>`).join('');
  }

  /* ================================================================
     NFC CONTEXT SCREENS
  ================================================================ */

  function openNFCContext(tag) {
    const nfcTs = new Date().toISOString();

    if (tag.mode === 'temp') {
      showScreen('main');
      document.querySelector('[data-tab="temp"]')?.click();
      return;
    }
    if (tag.mode === 'tick') {
      const items = tag.items === 'supplements'
        ? getSupplements().filter(s => s.active !== false)
        : [];
      let html = `<div class="nfc-screen">
        <div class="nfc-header">${tag.label}</div>
        <div class="nfc-sub">${tag.description} · ${new Date(nfcTs).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
        <div class="tick-list">`;
      items.forEach(item => {
        const done = !!(habits.supps && habits.supps[item.id]);
        html += `<div class="tick-item ${done ? 'done' : ''}" onclick="App.nfcTickSupp('${item.id}',this,'${nfcTs}')">
          <div class="tick-dot"><div class="tick-dot-inner"></div></div>
          <span class="tick-name">${item.name}</span>
          ${item.note ? `<span class="tick-meta">${item.note}</span>` : ''}
        </div>`;
      });
      html += `</div><a href="/" class="nfc-back">← Back to Luna</a></div>`;
      document.getElementById('app').innerHTML = html;
      return;
    }
    if (tag.mode === 'habitgroup') {
      showScreen('main');
      document.querySelector('[data-tab="habits"]')?.click();
      return;
    }
    if (tag.mode === 'input') {
      showScreen('main');
      document.querySelector(`[data-tab="${tag.tab || 'log'}"]`)?.click();
      if (tag.promptHint) {
        const inp = document.getElementById('free-log-input');
        if (inp) { inp.placeholder = tag.promptHint; inp.focus(); }
      }
    }
    if (tag.mode === 'quicktick') {
      showScreen('main');
      document.querySelector('[data-tab="log"]')?.click();
      setLogMode('quick');
    }
  }

  function nfcTickSupp(id, el, nfcTs) {
    if (!habits.supps) habits.supps = {};
    habits.supps[id] = !habits.supps[id];
    Storage.saveHabits(habits);
    el.classList.toggle('done', !!habits.supps[id]);
    if (habits.supps[id]) {
      const supp = getSupplements().find(s => s.id === id);
      if (!supp) return;
      const d   = new Date(nfcTs);
      const info= Cycle.getPhaseInfo(state.lastPeriod, state.ovulationDate);
      state.entries.push({
        date:     nfcTs,
        time:     d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }),
        type:     'supplement',
        summary:  supp.name + ' taken (NFC)',
        tags:     ['supplement', 'nfc'],
        flags:    [],
        cycleDay: info?.cycleDay || null,
        phase:    info?.key || null,
        raw:      supp.name,
      });
      Storage.save(state);
    }
  }

  /* ================================================================
     UTIL
  ================================================================ */

  function formatDate(d) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'short' });
  }

  function renderAll() {
    renderPhase();
    renderHabits();
  }

  return {
    init,
    completeSetup,
    setLogMode,
    submitFreeLog,
    confirmOvulation,
    logFood,
    logTemperature,
    renderTempHistory,
    toggleTick,
    toggleQuickTick,
    toggleEditMode,
    addItem,
    addHabitToGroup,
    deleteItem,
    nfcTickSupp,
    handleAppleHealthImport,
    handleUltrahumanImport,
  };

})();

document.addEventListener('DOMContentLoaded', App.init);
