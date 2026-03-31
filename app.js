/* ============================================================
   LUNA — APP CONTROLLER
   ============================================================ */

const App = (() => {

  let state, habits;

  /* ---- INIT ---- */
  function init() {
    state = Storage.load();
    habits = Storage.loadHabits();
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
    if (nfc) {
      const tag = LUNA_CONFIG.nfcTags.find(t => t.id === nfc);
      if (tag) {
        setTimeout(() => openNFCContext(tag), 100);
      }
    }
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
          p.classList.toggle('active', p.id === 'tab-' + tab);
        });
        if (tab === 'insights') renderInsights();
        if (tab === 'today') renderToday();
        if (tab === 'food') renderBatches();
      });
    });
  }

  /* ---- SETUP ---- */
  function completeSetup() {
    const val = document.getElementById('setup-period-date').value;
    if (!val) return;
    state.lastPeriod = val;
    Storage.save(state);
    showScreen('main');
    renderAll();
  }

  /* ---- PHASE BANNER ---- */
  function renderPhase() {
    const info = Cycle.getPhaseInfo(state.lastPeriod, state.ovulationDate);
    const banner = document.getElementById('phase-banner');
    if (!info) { banner.className = 'phase-banner'; return; }
    const meta = Cycle.getMeta(info.key);
    banner.className = 'phase-banner ' + info.key;
    document.getElementById('phase-label').textContent = meta.label;
    document.getElementById('phase-day-text').textContent = Cycle.formatDayLabel(info);
    document.getElementById('phase-note-text').textContent = meta.note;
    if (state.ovulationDate) {
      document.getElementById('ov-status').textContent = 'Ovulation confirmed — ' + formatDate(state.ovulationDate);
      document.getElementById('ov-status').classList.remove('hidden');
    }
  }

  /* ---- HABITS + SUPPS ---- */
  function renderHabits() {
    renderTickList('supps-list', LUNA_CONFIG.supplements.filter(s => s.active), 'supps');
    renderTickList('habits-list', LUNA_CONFIG.habits.filter(h => h.active), 'habits');
    renderTickList('skincare-list', LUNA_CONFIG.skincare.filter(s => s.active), 'skincare');
    renderQuickTicks();
  }

  function renderTickList(containerId, items, group) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = items.map(item => {
      const done = !!(habits[group] && habits[group][item.id]);
      return `<div class="tick-item ${done ? 'done' : ''}" onclick="App.toggleTick('${group}','${item.id}',this)">
        <div class="tick-dot"><div class="tick-dot-inner"></div></div>
        <span class="tick-name">${item.name}</span>
        ${item.note || item.meta ? `<span class="tick-meta">${item.note || item.meta}</span>` : ''}
      </div>`;
    }).join('');
  }

  function renderQuickTicks() {
    const grid = document.getElementById('quick-tick-grid');
    if (!grid) return;
    grid.innerHTML = LUNA_CONFIG.quickTicks.map(item => {
      const done = !!(habits.quickTicks && habits.quickTicks[item.id]);
      return `<div class="tick-card ${done ? 'done' : ''}" onclick="App.toggleTick('quickTicks','${item.id}',this)">
        <div class="tick-card-name">${item.name}</div>
      </div>`;
    }).join('');
  }

  function toggleTick(group, id, el) {
    if (!habits[group]) habits[group] = {};
    habits[group][id] = !habits[group][id];
    Storage.saveHabits(habits);
    el.classList.toggle('done', !!habits[group][id]);
    if (el.classList.contains('tick-item')) {
      const dot = el.querySelector('.tick-dot');
      if (dot) dot.style.background = habits[group][id] ? '#639922' : '';
    }
  }

  /* ---- LOG MODES ---- */
  function setLogMode(mode) {
    document.querySelectorAll('.mode-btn').forEach((b, i) => {
      b.classList.toggle('active', (i === 0 && mode === 'free') || (i === 1 && mode === 'quick'));
    });
    document.getElementById('log-free').classList.toggle('hidden', mode !== 'free');
    document.getElementById('log-quick').classList.toggle('hidden', mode !== 'quick');
    if (mode === 'quick') renderQuickTicks();
  }

  /* ---- FREE LOG ---- */
  async function submitFreeLog() {
    const text = document.getElementById('free-log-input').value.trim();
    if (!text) return;
    const feedback = document.getElementById('log-feedback');
    feedback.className = 'log-feedback';
    feedback.innerHTML = '<span class="loading">Parsing your log</span>';

    const info = Cycle.getPhaseInfo(state.lastPeriod, state.ovulationDate);
    const meta = info ? Cycle.getMeta(info.key) : null;
    const phaseCtx = info
      ? `Cycle day ${info.cycleDay}, phase: ${info.key}. ${meta ? meta.histamineNote : ''} PMDD risk: ${meta ? meta.pmddRisk : false}. Anchor: ${info.anchor}.`
      : 'No cycle data.';

    const prompt = `You are a health log parser for someone with formally diagnosed PCOS and PMDD, and ADHD managed with Elvanse (lisdexamfetamine, 30mg standard, 50mg in late luteal). They have histamine intolerance downstream of PCOS oestrogen dysregulation. ${phaseCtx}

Parse this free-text log and return ONLY valid JSON — no markdown, no explanation:
{
  "type": "mood"|"food"|"symptom"|"supplement"|"other",
  "summary": "one clear sentence summarising what was logged",
  "tags": ["short","relevant","tags"],
  "food_details": {
    "name": "food name or null",
    "prep_date": "YYYY-MM-DD or null",
    "freshness_day": number_or_null
  },
  "mood_note": "verbatim or near-verbatim emotional content if present — preserve the rawness",
  "symptoms": ["list if mentioned"],
  "flags": [
    {"type": "histamine"|"pmdd"|"pcos"|"insulin", "label": "short flag text"}
  ],
  "correlation_note": "optional — only if something is worth flagging against cycle phase"
}

Flag rules:
- histamine: batch day 2+, fermented food, aged cheese, onions/shallots, wine, cured meats, leftover cooked food
- pmdd: ONLY if in late luteal phase AND emotional content is present
- pcos: energy crash, blood sugar reference, androgen symptoms (acne flare, oily skin, hair changes)
- insulin: sugar craving, post-meal energy crash, skipped meal + brain fog, carb craving

Log entry: "${text}"`;

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: LUNA_CONFIG.aiModel,
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await resp.json();
      const raw = data.content.map(c => c.text || '').join('');
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

      const now = new Date();
      const entry = {
        date: now.toISOString(),
        time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        raw: text,
        cycleDay: info ? info.cycleDay : null,
        phase: info ? info.key : null,
        dpo: info ? info.dpo : null,
        anchor: info ? info.anchor : null,
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
      feedback.innerHTML = 'Saved as a raw note.';
      const now = new Date();
      state.entries.push({
        date: now.toISOString(),
        time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        raw: text, type: 'other', summary: text,
        cycleDay: info?.cycleDay || null, phase: info?.key || null,
      });
      Storage.save(state);
      document.getElementById('free-log-input').value = '';
    }
  }

  function buildFeedbackHTML(parsed) {
    let h = `<strong style="font-weight:500;">${parsed.summary}</strong>`;
    if (parsed.tags?.length) {
      h += `<br><span style="font-size:12px;color:var(--text-secondary);">${parsed.tags.join(' · ')}</span>`;
    }
    if (parsed.flags?.length) {
      h += `<div class="entry-flags" style="margin-top:6px;">`;
      parsed.flags.forEach(f => { h += `<span class="entry-flag flag-${f.type}">${f.label}</span>`; });
      h += `</div>`;
    }
    if (parsed.food_details?.freshness_day > 1) {
      h += `<div class="correlation-note">Day ${parsed.food_details.freshness_day} batch — histamine accumulating. Note any bloating or puffiness in the next 2hrs.</div>`;
    }
    if (parsed.correlation_note) {
      h += `<div class="correlation-note">Pattern note: ${parsed.correlation_note}</div>`;
    }
    return h;
  }

  /* ---- OVULATION ---- */
  function confirmOvulation() {
    const val = document.getElementById('ov-date-input').value;
    if (!val) return;
    state.ovulationDate = val;
    Storage.save(state);
    const status = document.getElementById('ov-status');
    status.textContent = 'Ovulation confirmed — ' + formatDate(val) + '. All phase dates updated.';
    status.classList.remove('hidden');
    renderPhase();
  }

  /* ---- FOOD ---- */
  function logFood() {
    const name = document.getElementById('food-name').value.trim();
    const prepDate = document.getElementById('food-prep-date').value;
    const time = document.getElementById('food-time').value;
    const notes = document.getElementById('food-notes').value.trim();
    if (!name) return;

    const info = Cycle.getPhaseInfo(state.lastPeriod, state.ovulationDate);
    const now = new Date();
    const entry = {
      date: now.toISOString(),
      time: time || now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      type: 'food',
      summary: name + (notes ? ' — ' + notes : ''),
      tags: ['food'],
      food_details: { name, prep_date: prepDate || now.toISOString().split('T')[0], freshness_day: 0 },
      cycleDay: info?.cycleDay || null,
      phase: info?.key || null,
      flags: [],
    };

    state.entries.push(entry);
    addBatch(name, prepDate || now.toISOString().split('T')[0]);
    Storage.save(state);
    Storage.syncToSheets(entry);

    document.getElementById('food-name').value = '';
    document.getElementById('food-prep-date').value = '';
    document.getElementById('food-time').value = '';
    document.getElementById('food-notes').value = '';
    renderBatches();
  }

  function addBatch(name, prepDate) {
    const existing = state.foodBatches.find(b => b.name === name && b.prepDate === prepDate);
    if (!existing) {
      state.foodBatches.push({ name, prepDate, id: Date.now() });
      if (state.foodBatches.length > 30) state.foodBatches.shift();
      Storage.save(state);
    }
  }

  function renderBatches() {
    const list = document.getElementById('batch-list');
    if (!list) return;
    const recent = [...state.foodBatches].reverse().slice(0, 10);
    if (!recent.length) {
      list.innerHTML = '<p class="empty-state">No batches logged yet.</p>';
      return;
    }
    list.innerHTML = recent.map(b => {
      const f = Cycle.batchFreshness(b.prepDate);
      return `<div class="batch-item">
        <div class="batch-item-name">${b.name}</div>
        <div class="batch-item-meta">Prepared ${formatDate(b.prepDate)}</div>
        ${f ? `<span class="batch-freshness batch-${f.level}">${f.label}</span>` : ''}
      </div>`;
    }).join('');
  }

  /* ---- TODAY ---- */
  function renderToday() {
    const list = document.getElementById('today-entries');
    const today = Storage.todayStr();
    const todayEntries = state.entries.filter(e => e.date && e.date.startsWith(today)).reverse();
    if (!todayEntries.length) {
      list.innerHTML = '<p class="empty-state">Nothing logged yet today.</p>';
      return;
    }
    list.innerHTML = todayEntries.map(e => {
      const tagCls = e.type || 'other';
      const flags = e.flags || [];
      return `<div class="entry-card">
        <div class="entry-meta">
          <span class="entry-time">${e.time || ''}</span>
          <span class="entry-tag ${tagCls}">${tagCls}</span>
          ${e.cycleDay ? `<span class="entry-tag other">day ${e.cycleDay}</span>` : ''}
        </div>
        <div class="entry-text">${e.summary || e.raw}</div>
        ${flags.length ? `<div class="entry-flags">${flags.map(f => `<span class="entry-flag flag-${f.type}">${f.label}</span>`).join('')}</div>` : ''}
      </div>`;
    }).join('');
  }

  /* ---- INSIGHTS ---- */
  function renderInsights() {
    const stats = Cycle.getStats(state.cycleHistory);
    const totalEntries = state.entries.length;
    const moodEntries = state.entries.filter(e => e.type === 'mood').length;

    document.getElementById('stats-grid').innerHTML = [
      { val: '33',                              label: 'Median cycle days' },
      { val: stats.avgOvDay ? stats.avgOvDay + '' : '—', label: 'Avg ovulation day' },
      { val: stats.avgLuteal ? stats.avgLuteal + '' : '—', label: 'Avg luteal days' },
      { val: totalEntries + '',                  label: 'Total entries' },
    ].map(s => `<div class="stat-card"><div class="stat-val">${s.val}</div><div class="stat-label">${s.label}</div></div>`).join('');

    document.getElementById('cycle-insights').innerHTML = [
      {
        title: 'Late ovulation (day 17–24)',
        body: 'Your ovulation lands significantly later than the textbook day 14 — typical of PCOS. Your PMDD window only starts after confirmed ovulation, which is why logging your Ultrahuman temp shift matters. Without it, phase dates are estimated.',
      },
      {
        title: 'Variable luteal phase (9–19 days)',
        body: 'Median 12 days — within healthy range. But your shortest (9 days) is borderline. A consistently short luteal phase can indicate progesterone insufficiency, which directly amplifies PMDD severity in late luteal.',
      },
      {
        title: 'Fall to Baseline (3 of 6 cycles)',
        body: 'Temperature starts elevated, drops early, then rises at ovulation. Ultrahuman links this to hormonal or metabolic disruption — consistent with PCOS. May correlate with follicular phase fatigue in those months.',
      },
      {
        title: 'False Start cycles (2 of 6)',
        body: 'Temperature rose mid-cycle without ovulation, dropped, then rose again. Your body geared up to ovulate, didn\'t complete it, tried again. Hormonally tiring — may explain unexpected fatigue in what should have been a high-energy phase.',
      },
    ].map(i => `<div class="insight-card"><div class="insight-title">${i.title}</div><div class="insight-body">${i.body}</div></div>`).join('');

    document.getElementById('pattern-insights').innerHTML = [
      {
        title: 'Histamine is downstream of PCOS, not separate',
        body: 'Elevated oestrogen relative to progesterone — a core PCOS dynamic — stimulates mast cells and triggers histamine release. Quercetin + nettle targets this loop. Pepcid AC treats the symptom; quercetin works on the trigger.',
      },
      {
        title: 'Blood sugar stability = Elvanse efficacy',
        body: 'PCOS-related insulin resistance reduces dopamine receptor sensitivity. Eating before your meds, with protein and complex carbs, directly affects how well Elvanse works that day — every day, not just in the PMDD window.',
      },
      {
        title: 'Vitex is your most important upcoming supplement',
        body: 'Chasteberry/Vitex in the Evelyn stack works on LH regulation — the exact pathway dysregulated in PCOS. Effects build over 3–6 months. It may reduce both PMDD severity and ovulation irregularity over time.',
      },
    ].map(i => `<div class="insight-card"><div class="insight-title">${i.title}</div><div class="insight-body">${i.body}</div></div>`).join('');
  }

  /* ---- NFC CONTEXT ---- */
  function openNFCContext(tag) {
    if (tag.mode === 'tick') {
      const items = LUNA_CONFIG[tag.items] || [];
      const group = tag.items === 'supplements' ? 'supps' : tag.items;
      let html = `<div class="nfc-screen">
        <div class="nfc-header">${tag.label}</div>
        <div class="nfc-sub">${tag.description}</div>
        <div class="tick-list" id="nfc-tick-list">`;
      items.filter(i => i.active !== false).forEach(item => {
        const done = !!(habits[group] && habits[group][item.id]);
        html += `<div class="tick-item ${done ? 'done' : ''}" onclick="App.nfcTick('${group}','${item.id}',this)">
          <div class="tick-dot"><div class="tick-dot-inner"></div></div>
          <span class="tick-name">${item.name}</span>
          ${item.note || item.meta ? `<span class="tick-meta">${item.note || item.meta}</span>` : ''}
        </div>`;
      });
      html += `</div><a href="/" class="nfc-back">← Back to Luna</a></div>`;
      document.getElementById('app').innerHTML = html;
    } else if (tag.mode === 'input') {
      showScreen('main');
      document.querySelector('[data-tab="' + (tag.tab || 'log') + '"]')?.click();
      if (tag.promptHint) {
        document.getElementById('free-log-input').placeholder = tag.promptHint;
        document.getElementById('free-log-input').focus();
      }
    }
  }

  function nfcTick(group, id, el) {
    if (!habits[group]) habits[group] = {};
    habits[group][id] = !habits[group][id];
    Storage.saveHabits(habits);
    el.classList.toggle('done', !!habits[group][id]);
  }

  /* ---- UTIL ---- */
  function formatDate(d) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function renderAll() {
    renderPhase();
    renderHabits();
  }

  return {
    init, completeSetup, setLogMode, submitFreeLog,
    confirmOvulation, logFood, toggleTick, nfcTick,
  };

})();

document.addEventListener('DOMContentLoaded', App.init);
