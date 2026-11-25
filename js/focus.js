// التركيز: مؤقت Pomodoro (المحرك في lib/timer.js)، تسجيل الجلسات، وإحصائيات يومية وأسبوعية.

import { getState, mutate } from './storage.js';
import { html, render } from './lib/html.js';
import { icon } from './lib/icons.js';
import { delegate, formDialog, confirmDialog, toast, pageHead, options } from './lib/ui.js';
import { vbars, hbars } from './lib/charts.js';
import { uid } from './lib/schema.js';
import * as timer from './lib/timer.js';
import { todayKey, formatClock, formatMinutes, formatShort, formatTime, WEEKDAYS, toKey } from './lib/dates.js';
import { focusSummary, focusCurrentWeek, focusBySubject, focusLastDays } from './lib/metrics.js';
import { subjectOptions, subjectName, subjectColor } from './lib/subjects.js';

const R = 118;
const C = 2 * Math.PI * R;

function timerCard(snap, state) {
  const running = snap.status === 'running';
  const paused = snap.status === 'paused';
  const idle = snap.status === 'idle';
  const label = snap.phase === 'focus' ? 'تركيز' : snap.phase === 'short' ? 'استراحة قصيرة' : 'استراحة طويلة';
  return html`<section class="card">
    <div class="timer-wrap">
      <div class="chips row-center" role="tablist" aria-label="نوع الجلسة">
        ${[['focus', 'تركيز'], ['short', 'استراحة قصيرة'], ['long', 'استراحة طويلة']].map(([id, l]) => html`<button class="chip ${snap.phase === id ? 'is-active' : ''}" type="button" data-action="phase" data-phase="${id}" ${idle ? '' : html`disabled style="opacity:.5"`}>${l}</button>`)}
      </div>
      <div class="timer-ring ${snap.isBreak ? 'is-break' : ''}" id="ring">
        <svg viewBox="0 0 260 260" aria-hidden="true"><circle class="ring-track" cx="130" cy="130" r="${R}" stroke-width="14"/><circle class="ring-fill" id="ring-fill" cx="130" cy="130" r="${R}" stroke-width="14" transform="rotate(-90 130 130)" style="stroke-dasharray:${C.toFixed(2)};stroke-dashoffset:${(C * (1 - snap.progress)).toFixed(2)}"/></svg>
        <div class="timer-center"><div class="timer-time" id="timer-time" role="timer" aria-live="off">${formatClock(snap.remainingMs / 1000)}</div><div class="timer-phase" id="timer-phase">${label}${paused ? ' (متوقف مؤقتًا)' : ''}</div></div>
      </div>
      <div class="cycle-dots" title="الدورات المكتملة" aria-label="الدورة ${snap.cycle + 1} من ${snap.cycles}">${Array.from({ length: snap.cycles }, (_, i) => html`<i class="${i < snap.cycle ? 'on' : ''}"></i>`)}</div>
      <div class="timer-ctrl">
        ${running ? html`<button class="btn btn-lg btn-primary" type="button" data-action="pause">${icon('pause')} إيقاف مؤقت</button>` : html`<button class="btn btn-lg btn-primary" type="button" data-action="start">${icon('play')} ${paused ? 'استئناف' : 'ابدأ'}</button>`}
        ${!idle && snap.phase === 'focus' ? html`<button class="btn btn-lg btn-ghost" type="button" data-action="finish">${icon('check')} إنهاء وتسجيل</button>` : ''}
        ${!idle ? html`<button class="btn btn-lg btn-ghost" type="button" data-action="cancel">${icon('x')} إلغاء</button>` : ''}
        ${idle && snap.isBreak ? html`<button class="btn btn-lg btn-ghost" type="button" data-action="skip">${icon('skip')} تخطي الاستراحة</button>` : ''}
      </div>
      ${snap.phase === 'focus' ? html`<div class="form-grid" style="width:100%;max-width:520px">
        <div class="field"><label class="label" for="f-subject">المادة (اختياري)</label><select class="select" id="f-subject" data-ctx="subjectId">${options(subjectOptions(state), snap.subjectId)}</select></div>
        <div class="field"><label class="label" for="f-label">ماذا تذاكر؟ (اختياري)</label><input class="input" id="f-label" data-ctx="label" maxlength="120" value="${snap.label}" placeholder="مثال: مراجعة الدرس الثالث"></div>
      </div>` : ''}
      <p class="muted tiny" style="text-align:center">يستمر المؤقت في الخلفية حتى لو انتقلت لقسم آخر أو أعدت فتح التطبيق. تُسجَّل الجلسة تلقائيًا عند اكتمال وقت التركيز.</p>
    </div>
  </section>`;
}

function statsCards(state, today) {
  const fs = focusSummary(state, today);
  const week = focusCurrentWeek(state, today);
  const by = focusBySubject(state);
  const maxBy = Math.max(1, ...by.map((b) => b.minutes));
  const avg = (() => { const l = focusLastDays(state, today, 7); return Math.round(l.reduce((a, b) => a + b.minutes, 0) / 7); })();
  return html`
    <section class="stats-row">
      <div class="card stat"><span class="stat-label">${icon('clock', { size: 15 })} اليوم</span><div class="stat-value">${formatMinutes(fs.today)}</div></div>
      <div class="card stat"><span class="stat-label">${icon('calendar', { size: 15 })} هذا الأسبوع</span><div class="stat-value">${formatMinutes(fs.week)}</div><div class="stat-sub">متوسط يومي (7 أيام): ${formatMinutes(avg)}</div></div>
      <div class="card stat"><span class="stat-label">${icon('chart', { size: 15 })} الإجمالي</span><div class="stat-value">${formatMinutes(fs.total)}</div></div>
      <div class="card stat"><span class="stat-label">${icon('target', { size: 15 })} عدد الجلسات</span><div class="stat-value">${fs.count}</div></div>
    </section>
    <div class="grid grid-2">
      <section class="card"><div class="card-head"><h3 class="card-title">${icon('chart')} أسبوعك (دقائق/يوم)</h3></div>
        ${fs.week === 0 ? html`<p class="muted">لا جلسات هذا الأسبوع بعد.</p>` : vbars(week.map((d) => ({ label: WEEKDAYS[d.weekday].slice(0, 3), value: d.minutes, text: d.minutes, highlight: d.key === today })))}
      </section>
      <section class="card"><div class="card-head"><h3 class="card-title">${icon('book')} حسب المادة</h3></div>
        ${by.length === 0 ? html`<p class="muted">سيظهر توزيع وقتك على المواد هنا.</p>` : hbars(by.slice(0, 6).map((b) => ({ label: b.subjectId ? (subjectName(state, b.subjectId) || 'مادة محذوفة') : 'بدون مادة', value: b.minutes, max: maxBy, color: b.subjectId ? subjectColor(state, b.subjectId, 'var(--border-strong)') : 'var(--border-strong)', dot: true, text: formatMinutes(b.minutes) })))}
      </section>
    </div>`;
}

function sessionsList(state) {
  const list = state.sessions.slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 12);
  return html`<section class="card"><div class="card-head"><h3 class="card-title">${icon('history')} آخر الجلسات</h3><button class="btn btn-sm btn-ghost" type="button" data-action="manual">${icon('plus', { size: 15 })} تسجيل يدوي</button></div>
    ${list.length === 0 ? html`<p class="muted">لا جلسات مسجّلة. ابدأ المؤقت أو سجّل جلسة يدويًا.</p>` : html`<div class="list">${list.map((s) => html`<div class="list-item">
      <i class="dot" style="background:${s.subjectId ? subjectColor(state, s.subjectId) : 'var(--border-strong)'}"></i>
      <div class="list-main"><div class="list-title">${formatMinutes(s.minutes)}${s.label ? ` — ${s.label}` : ''}</div><div class="list-sub"><span>${formatShort(s.date)}</span>${s.subjectId ? html`<span>${subjectName(state, s.subjectId)}</span>` : ''}${s.manual ? html`<span class="badge badge-muted">يدوي</span>` : ''}</div></div>
      <button class="icon-btn icon-btn-sm is-danger" type="button" data-action="del-session" data-id="${s.id}" aria-label="حذف الجلسة">${icon('trash', { size: 17 })}</button></div>`)}</div>`}
  </section>`;
}

function settingsCard(state) {
  const f = state.settings.focus;
  return html`<section class="card"><div class="card-head"><h3 class="card-title">${icon('sliders')} إعدادات المؤقت</h3></div>
    <form class="form" data-form="focus-settings">
      <div class="form-grid">
        <div class="field"><label class="label" for="fs-focus">مدة التركيز (دقيقة)</label><input class="input" id="fs-focus" name="focus" type="number" inputmode="numeric" min="1" max="180" value="${f.focus}"></div>
        <div class="field"><label class="label" for="fs-short">استراحة قصيرة (دقيقة)</label><input class="input" id="fs-short" name="short" type="number" inputmode="numeric" min="1" max="60" value="${f.short}"></div>
        <div class="field"><label class="label" for="fs-long">استراحة طويلة (دقيقة)</label><input class="input" id="fs-long" name="long" type="number" inputmode="numeric" min="1" max="90" value="${f.long}"></div>
        <div class="field"><label class="label" for="fs-cycles">جلسات قبل الاستراحة الطويلة</label><input class="input" id="fs-cycles" name="cycles" type="number" inputmode="numeric" min="2" max="8" value="${f.cycles}"></div>
      </div>
      <div class="row"><button class="btn btn-primary" type="submit">حفظ الإعدادات</button><button class="btn btn-ghost" type="button" data-action="preset" data-p="25,5,15,4">25/5 (كلاسيكي)</button><button class="btn btn-ghost" type="button" data-action="preset" data-p="50,10,20,3">50/10</button></div>
      <p class="field-hint">التغيير يسري على الجلسة التالية، ولا يؤثر على جلسة جارية.</p>
    </form></section>`;
}

export function mount(root, ctx) {
  const drawAll = () => {
    const state = getState();
    const snap = timer.snapshot();
    render(root, html`<div class="page">
      ${pageHead({ title: 'التركيز والمذاكرة', subtitle: 'طريقة Pomodoro: تركيز كامل ثم استراحة قصيرة' })}
      <div id="timer-slot">${timerCard(snap, state)}</div>
      <div id="stats-slot" class="stack">${statsCards(state, todayKey())}${sessionsList(state)}${settingsCard(state)}</div>
    </div>`);
  };
  const drawTimer = () => { const slot = root.querySelector('#timer-slot'); if (slot) render(slot, timerCard(timer.snapshot(), getState())); };
  const drawStats = () => { const slot = root.querySelector('#stats-slot'); if (slot) render(slot, html`${statsCards(getState(), todayKey())}${sessionsList(getState())}${settingsCard(getState())}`); };

  const unsub = timer.subscribe((type, snap) => {
    if (type === 'tick') {
      const t = root.querySelector('#timer-time');
      const fill = root.querySelector('#ring-fill');
      if (t) t.textContent = formatClock(snap.remainingMs / 1000);
      if (fill) fill.style.strokeDashoffset = (C * (1 - snap.progress)).toFixed(2);
    } else {
      drawTimer();
      if (type === 'complete') drawStats();
    }
  });

  const off = delegate(root, 'click', '[data-action]', async (e, el) => {
    const a = el.dataset.action;
    if (a === 'start') timer.start();
    else if (a === 'pause') timer.pause();
    else if (a === 'cancel') {
      if (await confirmDialog({ title: 'إلغاء الجلسة', message: 'سيتم إلغاء الجلسة الحالية دون تسجيل أي وقت.', confirmText: 'إلغاء الجلسة', cancelText: 'متابعة', danger: true })) timer.cancel();
    }
    else if (a === 'finish') {
      const logged = timer.finishEarly();
      toast(logged > 0 ? `سُجّلت جلسة ${logged} دقيقة` : 'الجلسة أقصر من دقيقة — لم تُسجَّل', { type: logged > 0 ? 'success' : 'info' });
      drawStats();
    }
    else if (a === 'skip') timer.skipBreak();
    else if (a === 'phase') timer.setPhase(el.dataset.phase);
    else if (a === 'preset') {
      const [f, s, l, c] = el.dataset.p.split(',').map(Number);
      mutate((st) => { st.settings.focus = { focus: f, short: s, long: l, cycles: c }; });
      toast('تم تطبيق الإعداد', { type: 'success', duration: 1500 });
      drawAll();
    }
    else if (a === 'del-session') {
      mutate((s) => { s.sessions = s.sessions.filter((x) => x.id !== el.dataset.id); });
      drawStats();
    }
    else if (a === 'manual') {
      const res = await formDialog({
        title: 'تسجيل جلسة يدويًا',
        fields: [
          { name: 'minutes', label: 'المدة (دقيقة)', type: 'number', required: true, min: 1, max: 600, full: false },
          { name: 'date', label: 'التاريخ', type: 'date', required: true, full: false },
          { name: 'subjectId', label: 'المادة', type: 'select', options: subjectOptions(getState()) },
          { name: 'label', label: 'ماذا ذاكرت؟', maxlength: 120 },
        ],
        values: { date: todayKey(), minutes: 30 },
        validate: (v) => (!Number.isFinite(v.minutes) || v.minutes < 1 ? 'أدخل مدة صحيحة.' : v.date > todayKey() ? 'لا يمكن تسجيل جلسة في المستقبل.' : ''),
        submitText: 'تسجيل',
      });
      if (!res) return;
      const v = res.values;
      mutate((s) => { s.sessions.push({ id: uid(), date: v.date, startedAt: `${v.date}T12:00:00.000Z`, minutes: Math.round(v.minutes), subjectId: v.subjectId, label: v.label, manual: true }); });
      drawStats();
    }
  });

  const onChange = (e) => {
    const c = e.target.closest && e.target.closest('[data-ctx]');
    if (c) timer.setContext({ [c.dataset.ctx]: c.value.trim() });
  };
  const onSubmit = (e) => {
    const form = e.target.closest('[data-form="focus-settings"]');
    if (!form) return;
    e.preventDefault();
    const fd = new FormData(form);
    const clampN = (k, lo, hi, fb) => { const n = Math.round(Number(fd.get(k))); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fb; };
    mutate((s) => { s.settings.focus = { focus: clampN('focus', 1, 180, 25), short: clampN('short', 1, 60, 5), long: clampN('long', 1, 90, 15), cycles: clampN('cycles', 2, 8, 4) }; });
    toast('حُفظت إعدادات المؤقت', { type: 'success', duration: 1800 });
    drawAll();
  };
  root.addEventListener('change', onChange);
  root.addEventListener('submit', onSubmit);

  drawAll();
  return () => { off(); unsub(); root.removeEventListener('change', onChange); root.removeEventListener('submit', onSubmit); };
}

export { formatTime, toKey };
