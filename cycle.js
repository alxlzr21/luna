/* ============================================================
   LUNA — CYCLE LOGIC
   PCOS-adjusted phase calculation.
   Ovulation-anchored when confirmed; estimated when not.
   ============================================================ */

const Cycle = (() => {

  function daysBetween(a, b) {
    const da = new Date(a + 'T12:00:00');
    const db = new Date(b + 'T12:00:00');
    return Math.floor((db - da) / (1000 * 60 * 60 * 24));
  }

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function getPhaseInfo(lastPeriod, ovulationDate) {
    if (!lastPeriod) return null;
    const today = todayStr();
    const cycleDay = daysBetween(lastPeriod, today) + 1;
    const cfg = LUNA_CONFIG.cycle;

    /* --- Ovulation confirmed: anchor all phases to it --- */
    if (ovulationDate) {
      const dpo = daysBetween(ovulationDate, today);

      if (cycleDay <= cfg.periodLength) {
        return phase('menstrual', cycleDay, dpo, 'confirmed');
      }
      if (dpo < -2) {
        return phase('follicular', cycleDay, dpo, 'confirmed');
      }
      if (dpo >= -2 && dpo <= 0) {
        return phase('ovulation', cycleDay, dpo, 'confirmed');
      }
      if (dpo <= 6) {
        return phase('luteal-early', cycleDay, dpo, 'confirmed');
      }
      return phase('luteal-late', cycleDay, dpo, 'confirmed');
    }

    /* --- No confirmed ovulation: PCOS-adjusted estimate --- */
    if (cycleDay <= cfg.periodLength) {
      return phase('menstrual', cycleDay, null, 'estimated');
    }
    if (cycleDay < cfg.ovulationWindowStart) {
      return phase('follicular', cycleDay, null, 'estimated');
    }
    const midOv = Math.round((cfg.ovulationWindowStart + cfg.ovulationWindowEnd) / 2);
    if (cycleDay <= cfg.ovulationWindowEnd) {
      return phase('ovulation', cycleDay, null, 'estimated');
    }
    const estimatedDpo = cycleDay - midOv;
    if (estimatedDpo <= 6) {
      return phase('luteal-early', cycleDay, estimatedDpo, 'estimated');
    }
    return phase('luteal-late', cycleDay, estimatedDpo, 'estimated');
  }

  function phase(key, cycleDay, dpo, anchor) {
    return { key, cycleDay, dpo, anchor };
  }

  const PHASE_META = {
    menstrual: {
      label: 'Menstrual',
      note: 'Rest, iron-rich foods, gentle movement',
      pmddRisk: false,
      histamineNote: 'Histamine can peak — favour fresh food',
    },
    follicular: {
      label: 'Follicular',
      note: 'Energy rising — good window for new habits',
      pmddRisk: false,
      histamineNote: 'Lower histamine sensitivity this phase',
    },
    ovulation: {
      label: 'Ovulation',
      note: 'Peak energy. Log temp shift when it appears.',
      pmddRisk: false,
      histamineNote: 'Oestrogen peaks — watch histamine threshold',
    },
    'luteal-early': {
      label: 'Early luteal',
      note: 'Stable energy. Watch histamine — threshold rising.',
      pmddRisk: false,
      histamineNote: 'Increasing sensitivity — avoid batch day 3+ food',
    },
    'luteal-late': {
      label: 'Late luteal',
      note: 'PMDD window. Go gentle. Elvanse → 50mg if needed.',
      pmddRisk: true,
      histamineNote: 'Highest sensitivity. Fresh food, low-histamine days.',
    },
  };

  function getMeta(phaseKey) {
    return PHASE_META[phaseKey] || PHASE_META['follicular'];
  }

  function formatDayLabel(info) {
    let s = `Cycle day ${info.cycleDay}`;
    if (info.dpo !== null && info.dpo !== undefined && info.dpo >= 0) {
      s += ` · ${info.dpo} DPO`;
    }
    if (info.anchor === 'estimated') s += ' · estimated';
    return s;
  }

  /* Histamine risk for a food batch */
  function batchFreshness(prepDateStr) {
    if (!prepDateStr) return null;
    const days = daysBetween(prepDateStr, todayStr());
    if (days <= 0) return { days: 0, level: 'fresh',   label: 'Fresh today' };
    if (days === 1) return { days: 1, level: 'ok',     label: 'Day 1 — fine' };
    if (days === 2) return { days: 2, level: 'ok',     label: 'Day 2 — still ok' };
    if (days === 3) return { days: 3, level: 'caution',label: 'Day 3 — histamine building' };
    if (days === 4) return { days: 4, level: 'caution',label: 'Day 4 — watch for symptoms' };
    return { days, level: 'high', label: `Day ${days} — high histamine risk` };
  }

  /* Cycle stats from history */
  function getStats(cycleHistory) {
    const confirmed = cycleHistory.filter(c => c.ovDay);
    const avgOvDay = confirmed.length
      ? Math.round(confirmed.reduce((a, c) => a + c.ovDay, 0) / confirmed.length)
      : null;
    const withLuteal = cycleHistory.filter(c => c.lutealLen);
    const avgLuteal = withLuteal.length
      ? Math.round(withLuteal.reduce((a, c) => a + c.lutealLen, 0) / withLuteal.length)
      : null;
    return { avgOvDay, avgLuteal };
  }

  return { getPhaseInfo, getMeta, formatDayLabel, batchFreshness, getStats };

})();
