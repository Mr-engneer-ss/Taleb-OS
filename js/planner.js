// المخطط: جدول يومي وأسبوعي، تقويم شهري، امتحانات، وقائمة مهام بأولويات ومواعيد نهائية.

import { getState, mutate, pushActivity } from './storage.js';
import { html, render } from './lib/html.js';
import { icon } from './lib/icons.js';
import { delegate, emptyState, formDialog, confirmDialog, toast, pageHead, tabsHtml } from './lib/ui.js';
import { uid } from './lib/schema.js';
import {
  todayKey, toKey, parseKey, addDays, addDaysKey, startOfWeek, monthGrid, formatKeyFull, formatTimeRange, relativeDay,
  WEEKDAYS, WEEK_ORDER, MONTHS,
} from './lib/dates.js';
import { eventsOnDate, taskStats, isOverdue } from './lib/metrics.js';
import { subjectOptions, subjectName, subjectColor } from './lib/subjects.js';
import { PRIORITIES, EVENT_KINDS } from './config.js';

const TABS = [
  { id: 'day', label: 'اليوم', icon: 'clock' },
  { id: 'week', label: 'الأسبوع', icon: 'list' },
  { id: 'month', label: 'الشهر', icon: 'calendar' },
  { id: 'tasks', label: 'المهام', icon: 'tasks' },
];

function evHtml(state, e, today) {
  const exam = e.kind === 'exam';
  return html`<button class="ev ${exam ? 'is-exam' : ''}" type="button" style="--ev-color:${subjectColor(state, e.subjectId)}" data-action="edit-event" data-id="${e.id}">
    <b>${exam ? '📝 ' : ''}${e.title}</b>
    <small>${formatTimeRange(e.start, e.end) || 'طوال اليوم'}${e.place ? ` · ${e.place}` : ''}${e.subjectId ? ` · ${subjectName(state, e.subjectId)}` : ''}${exam && e.date ? ` · ${relativeDay(e.date, today)}` : ''}</small>
  </button>`;
}

function taskRow(state, t, today) {
  const over = isOverdue(t, today);
  return html`<div class="list-item ${t.done ? 'is-done' : ''}">
    <span class="prio prio-${t.priority}" title="أولوية ${PRIORITIES[t.priority].label}"></span>
    <button class="check check-hit ${t.done ? 'is-on' : ''}" type="button" data-action="toggle-task" data-id="${t.id}" aria-label="${t.done ? 'إلغاء إكمال' : 'إكمال'}: ${t.title}">${icon('check', { size: 16 })}</button>
    <div class="list-main" data-action="edit-task" data-id="${t.id}" style="cursor:pointer">
      <div class="list-title">${t.title}</div>
      <div class="list-sub">
        <span class="badge badge-${t.priority === 'high' ? 'danger' : t.priority === 'medium' ? 'warning' : 'success'}">${PRIORITIES[t.priority].label}</span>
        ${t.due ? html`<span class="${over ? 'badge badge-danger' : ''}">${icon('calendar', { size: 13 })} ${over ? 'متأخرة · ' : ''}${relativeDay(t.due, today)}</span>` : html`<span>بلا موعد</span>`}
        ${t.subjectId ? html`<span><i class="dot" style="background:${subjectColor(state, t.subjectId)}"></i> ${subjectName(state, t.subjectId)}</span>` : ''}
      </div>
    </div>
    <button class="icon-btn icon-btn-sm is-danger" type="button" data-action="delete-task" data-id="${t.id}" aria-label="حذف المهمة ${t.title}">${icon('trash', { size: 17 })}</button>
  </div>`;
}

const sortTasks = (a, b) =>
  PRIORITIES[a.priority].rank - PRIORITIES[b.priority].rank || (a.due || '9999').localeCompare(b.due || '9999');

function dayView(state, ui, today) {
  const key = ui.date;
  const events = eventsOnDate(state, key);
  const tasks = state.tasks.filter((t) => t.due === key).sort((a, b) => Number(a.done) - Number(b.done) || sortTasks(a, b));
  const overdue = key === today ? state.tasks.filter((t) => isOverdue(t, today)).sort(sortTasks) : [];
  return html`<div class="stack">
    <div class="row row-between">
      <button class="icon-btn" type="button" data-action="shift-day" data-n="1" aria-label="اليوم التالي">${icon('chevron-right')}</button>
      <div style="text-align:center"><strong>${formatKeyFull(key)}</strong><div class="muted small">${relativeDay(key, today)}</div></div>
      <button class="icon-btn" type="button" data-action="shift-day" data-n="-1" aria-label="اليوم السابق">${icon('chevron-left')}</button>
    </div>
    ${key !== today ? html`<div class="row row-center"><button class="chip" type="button" data-action="goto-today">العودة لليوم</button></div>` : ''}
    <section class="card"><div class="card-head"><h3 class="card-title">${icon('clock')} الحصص والمواعيد</h3><button class="btn btn-sm btn-ghost" type="button" data-action="add-event">${icon('plus', { size: 15 })} إضافة</button></div>
      ${events.length ? html`<div class="stack-sm">${events.map((e) => evHtml(state, e, today))}</div>` : html`<p class="muted">لا حصص أو مواعيد في هذا اليوم.</p>`}
    </section>
    ${overdue.length ? html`<section class="card"><div class="card-head"><h3 class="card-title" style="color:var(--danger)">${icon('alert')} مهام متأخرة</h3><span class="badge badge-danger">${overdue.length}</span></div><div class="list">${overdue.map((t) => taskRow(state, t, today))}</div></section>` : ''}
    <section class="card"><div class="card-head"><h3 class="card-title">${icon('tasks')} مهام هذا اليوم</h3><button class="btn btn-sm btn-ghost" type="button" data-action="add-task" data-date="${key}">${icon('plus', { size: 15 })} مهمة</button></div>
      ${tasks.length ? html`<div class="list">${tasks.map((t) => taskRow(state, t, today))}</div>` : html`<p class="muted">لا مهام مستحقة في هذا اليوم.</p>`}
    </section>
  </div>`;
}

function weekView(state, ui, today) {
  const start = addDays(startOfWeek(parseKey(ui.date)), 0);
  const days = WEEK_ORDER.map((_, i) => addDays(start, i));
  return html`<div class="stack">
    <div class="row row-between">
      <button class="icon-btn" type="button" data-action="shift-week" data-n="1" aria-label="الأسبوع التالي">${icon('chevron-right')}</button>
      <div style="text-align:center"><strong>${days[0].getDate()} ${MONTHS[days[0].getMonth()]} – ${days[6].getDate()} ${MONTHS[days[6].getMonth()]}</strong></div>
      <button class="icon-btn" type="button" data-action="shift-week" data-n="-1" aria-label="الأسبوع السابق">${icon('chevron-left')}</button>
    </div>
    <div class="week-grid">${days.map((d) => {
      const key = toKey(d);
      const ev = eventsOnDate(state, key);
      const tk = state.tasks.filter((t) => t.due === key && !t.done);
      return html`<div class="week-col ${key === today ? 'is-today' : ''}">
        <h4><button class="chip" type="button" data-action="open-day" data-date="${key}" style="border:0;padding:0;min-height:0">${WEEKDAYS[d.getDay()]}</button><small>${d.getDate()}</small></h4>
        ${ev.map((e) => evHtml(state, e, today))}
        ${tk.map((t) => html`<div class="ev" style="--ev-color:var(--warning);cursor:default"><b>✓ ${t.title}</b></div>`)}
        ${!ev.length && !tk.length ? html`<span class="muted tiny">—</span>` : ''}
      </div>`;
    })}</div>
  </div>`;
}

function monthView(state, ui, today) {
  const cur = parseKey(ui.date);
  const y = cur.getFullYear();
  const m = cur.getMonth();
  const cells = monthGrid(y, m);
  const firstOfMonth = toKey(new Date(y, m, 1));
  void firstOfMonth;
  return html`<div class="stack">
    <div class="row row-between">
      <button class="icon-btn" type="button" data-action="shift-month" data-n="1" aria-label="الشهر التالي">${icon('chevron-right')}</button>
      <strong>${MONTHS[m]} ${y}</strong>
      <button class="icon-btn" type="button" data-action="shift-month" data-n="-1" aria-label="الشهر السابق">${icon('chevron-left')}</button>
    </div>
    <div class="cal" role="grid" aria-label="التقويم الشهري">
      ${WEEK_ORDER.map((wd) => html`<div class="cal-h">${WEEKDAYS[wd].slice(0, 3)}</div>`)}
      ${cells.map((key) => {
        const d = parseKey(key);
        const ev = eventsOnDate(state, key);
        const hasExam = ev.some((e) => e.kind === 'exam');
        const hasEv = ev.some((e) => e.kind !== 'exam');
        const hasTask = state.tasks.some((t) => t.due === key && !t.done);
        return html`<button class="cal-day ${d.getMonth() !== m ? 'is-out' : ''} ${key === today ? 'is-today' : ''} ${key === ui.sel ? 'is-sel' : ''}" type="button" data-action="pick-date" data-date="${key}" aria-label="${formatKeyFull(key)}${hasExam ? ' — امتحان' : ''}">
          ${d.getDate()}<span class="cal-dots">${hasEv ? html`<i></i>` : ''}${hasExam ? html`<i class="ex"></i>` : ''}${hasTask ? html`<i class="tk"></i>` : ''}</span></button>`;
      })}
    </div>
    <div class="legend"><span class="legend-item"><i class="dot" style="background:var(--primary)"></i>حصة/موعد</span><span class="legend-item"><i class="dot" style="background:var(--danger)"></i>امتحان</span><span class="legend-item"><i class="dot" style="background:var(--warning)"></i>مهمة</span></div>
    ${ui.sel ? html`<section class="card"><div class="card-head"><h3 class="card-title">${formatKeyFull(ui.sel)}</h3>
      <div class="row"><button class="btn btn-sm btn-ghost" type="button" data-action="add-event" data-date="${ui.sel}">${icon('plus', { size: 15 })} موعد</button><button class="btn btn-sm btn-ghost" type="button" data-action="add-task" data-date="${ui.sel}">${icon('plus', { size: 15 })} مهمة</button></div></div>
      ${(() => {
        const ev = eventsOnDate(state, ui.sel);
        const tk = state.tasks.filter((t) => t.due === ui.sel);
        if (!ev.length && !tk.length) return html`<p class="muted">لا شيء في هذا اليوم.</p>`;
        return html`<div class="stack-sm">${ev.map((e) => evHtml(state, e, today))}</div>${tk.length ? html`<div class="list" style="margin-top:8px">${tk.map((t) => taskRow(state, t, today))}</div>` : ''}`;
      })()}
    </section>` : ''}
    ${(() => {
      const exams = state.events.filter((e) => e.kind === 'exam' && e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
      return exams.length ? html`<section class="card"><div class="card-head"><h3 class="card-title">${icon('flag')} الامتحانات القادمة</h3></div><div class="stack-sm">${exams.map((e) => evHtml(state, e, today))}</div></section>` : '';
    })()}
  </div>`;
}

function tasksView(state, ui, today) {
  const f = ui.filter;
  let list = state.tasks.slice();
  if (f === 'open') list = list.filter((t) => !t.done);
  else if (f === 'overdue') list = list.filter((t) => isOverdue(t, today));
  else if (f === 'done') list = list.filter((t) => t.done);
  list.sort((a, b) => Number(a.done) - Number(b.done) || sortTasks(a, b));
  const st = taskStats(state, today);
  const chips = [['open', `المفتوحة (${st.open})`], ['overdue', `المتأخرة (${st.overdue})`], ['done', `المكتملة (${st.doneTotal})`], ['all', 'الكل']];
  return html`<div class="stack">
    <div class="chips">${chips.map(([id, l]) => html`<button class="chip ${f === id ? 'is-active' : ''}" type="button" data-action="filter-tasks" data-f="${id}">${l}</button>`)}</div>
    ${list.length === 0
      ? html`<div class="card">${emptyState({ icon: 'tasks', title: state.tasks.length ? 'لا مهام في هذا التصنيف' : 'لا توجد مهام بعد', text: state.tasks.length ? '' : 'سجّل مهامك وحدّد الأولوية والموعد النهائي.', action: { id: 'add-task', label: 'مهمة جديدة', icon: 'plus' } })}</div>`
      : html`<section class="card"><div class="list">${list.map((t) => taskRow(state, t, today))}</div></section>`}
    ${st.doneTotal > 0 ? html`<div class="row row-center"><button class="btn btn-ghost btn-sm" type="button" data-action="clear-done">مسح المهام المكتملة</button></div>` : ''}
  </div>`;
}

const DUE_QUICK = [{ label: 'اليوم', days: 0 }, { label: 'غدًا', days: 1 }, { label: 'بعد 3 أيام', days: 3 }, { label: 'بعد أسبوع', days: 7 }];

export function mount(root, ctx) {
  const today0 = todayKey();
  const ui = {
    tab: TABS.some((t) => t.id === ctx.query.get('tab')) ? ctx.query.get('tab') : 'day',
    date: today0,
    sel: today0,
    filter: 'open',
  };

  const draw = () => {
    const state = getState();
    const today = todayKey();
    const body = ui.tab === 'day' ? dayView(state, ui, today) : ui.tab === 'week' ? weekView(state, ui, today) : ui.tab === 'month' ? monthView(state, ui, today) : tasksView(state, ui, today);
    const overdue = taskStats(state, today).overdue;
    render(root, html`<div class="page">
      ${pageHead({
        title: 'مخططي',
        subtitle: 'جدولك ومهامك وامتحاناتك في مكان واحد',
        actions: html`<button class="btn btn-ghost" type="button" data-action="add-event">${icon('calendar', { size: 18 })} حصة / امتحان</button><button class="btn btn-primary" type="button" data-action="add-task">${icon('plus', { size: 18 })} مهمة</button>`,
      })}
      ${tabsHtml(TABS.map((t) => (t.id === 'tasks' && overdue ? { ...t, badge: overdue } : t)), ui.tab)}
      ${body}
    </div>`);
  };

  const taskFields = [
    { name: 'title', label: 'عنوان المهمة', required: true, maxlength: 200 },
    { name: 'priority', label: 'الأولوية', type: 'select', full: false, options: Object.entries(PRIORITIES).map(([value, p]) => ({ value, label: p.label })) },
    { name: 'subjectId', label: 'المادة', type: 'select', full: false, options: subjectOptions(getState()) },
    { name: 'due', label: 'الموعد النهائي', type: 'date', quick: DUE_QUICK },
    { name: 'notes', label: 'ملاحظات', type: 'textarea', rows: 3, maxlength: 1000 },
  ];

  async function addTask(date = '') {
    const fields = taskFields.map((f) => (f.name === 'subjectId' ? { ...f, options: subjectOptions(getState()) } : f));
    const res = await formDialog({ title: 'مهمة جديدة', fields, values: { priority: 'medium', due: date }, submitText: 'إضافة المهمة' });
    if (!res) return;
    const v = res.values;
    mutate((s) => { s.tasks.push({ id: uid(), title: v.title, priority: v.priority, due: v.due, done: false, doneAt: '', subjectId: v.subjectId, notes: v.notes, createdAt: new Date().toISOString() }); });
    toast('أُضيفت المهمة', { type: 'success', duration: 1800 });
    draw();
  }

  async function editTask(id) {
    const t = getState().tasks.find((x) => x.id === id);
    if (!t) return;
    const fields = taskFields.map((f) => (f.name === 'subjectId' ? { ...f, options: subjectOptions(getState()) } : f));
    const res = await formDialog({ title: 'تعديل المهمة', fields, values: t, deleteText: 'حذف المهمة' });
    if (!res) return;
    if (res.action === 'delete') { mutate((s) => { s.tasks = s.tasks.filter((x) => x.id !== id); }); }
    else { const v = res.values; mutate((s) => { Object.assign(s.tasks.find((x) => x.id === id), { title: v.title, priority: v.priority, subjectId: v.subjectId, due: v.due, notes: v.notes }); }); }
    draw();
  }

  async function deleteTask(id) {
    const t = getState().tasks.find((x) => x.id === id);
    if (!t) return;
    const backup = { ...t };
    mutate((s) => { s.tasks = s.tasks.filter((x) => x.id !== id); });
    draw();
    toast('تم حذف المهمة', { duration: 5000, action: { label: 'تراجع', onClick: () => { mutate((s) => { s.tasks.push(backup); }); draw(); } } });
  }

  const eventFields = () => [
    { name: 'title', label: 'العنوان', required: true, maxlength: 160, placeholder: 'مثال: حصة الرياضيات' },
    { name: 'kind', label: 'النوع', type: 'select', options: Object.entries(EVENT_KINDS).map(([value, label]) => ({ value, label })) },
    { name: 'weekday', label: 'اليوم من الأسبوع', type: 'select', full: false, showIf: { field: 'kind', in: ['weekly'] }, options: WEEK_ORDER.map((d) => ({ value: String(d), label: WEEKDAYS[d] })) },
    { name: 'date', label: 'التاريخ', type: 'date', full: false, showIf: { field: 'kind', in: ['once', 'exam'] }, quick: [{ label: 'اليوم', days: 0 }, { label: 'غدًا', days: 1 }, { label: 'بعد أسبوع', days: 7 }] },
    { name: 'start', label: 'من الساعة', type: 'time', full: false },
    { name: 'end', label: 'إلى الساعة', type: 'time', full: false },
    { name: 'subjectId', label: 'المادة', type: 'select', full: false, options: subjectOptions(getState()) },
    { name: 'place', label: 'المكان', full: false, maxlength: 120 },
    { name: 'notes', label: 'ملاحظات', type: 'textarea', rows: 2, maxlength: 1000 },
  ];
  const eventValidate = (v) => {
    if (v.kind === 'weekly' && v.weekday === '') return 'اختر يوم الأسبوع.';
    if (v.kind !== 'weekly' && !v.date) return 'اختر التاريخ.';
    if (v.start && v.end && v.end <= v.start) return 'وقت النهاية يجب أن يكون بعد وقت البداية.';
    return '';
  };
  const toEvent = (v, id) => {
    const e = { id, kind: v.kind, title: v.title, subjectId: v.subjectId, start: v.start, end: v.end, place: v.place, notes: v.notes };
    if (v.kind === 'weekly') e.weekday = Number(v.weekday); else e.date = v.date;
    return e;
  };

  async function addEvent(date = '') {
    const res = await formDialog({ title: 'حصة أو موعد أو امتحان', fields: eventFields(), values: { kind: date ? 'once' : 'weekly', weekday: String(new Date().getDay()), date }, validate: eventValidate, submitText: 'إضافة' });
    if (!res) return;
    mutate((s) => { s.events.push(toEvent(res.values, uid())); });
    draw();
  }

  async function editEvent(id) {
    const e = getState().events.find((x) => x.id === id);
    if (!e) return;
    const res = await formDialog({ title: 'تعديل الحدث', fields: eventFields(), values: { ...e, weekday: String(e.weekday ?? 0) }, validate: eventValidate, deleteText: 'حذف' });
    if (!res) return;
    if (res.action === 'delete') {
      const ok = await confirmDialog({ title: 'حذف الحدث', message: e.kind === 'weekly' ? 'هذه حصة أسبوعية متكررة: سيُحذف تكرارها بالكامل.' : 'حذف هذا الموعد؟', confirmText: 'حذف', danger: true });
      if (!ok) return;
      mutate((s) => { s.events = s.events.filter((x) => x.id !== id); });
    } else {
      mutate((s) => { const i = s.events.findIndex((x) => x.id === id); s.events[i] = toEvent(res.values, id); });
    }
    draw();
  }

  const shift = (key, n) => addDaysKey(key, n);
  const off = delegate(root, 'click', '[data-action],[data-tab]', async (e, el) => {
    if (el.dataset.tab) { ui.tab = el.dataset.tab; draw(); return; }
    const a = el.dataset.action;
    const n = Number(el.dataset.n);
    if (a === 'add-task') addTask(el.dataset.date || '');
    else if (a === 'edit-task') editTask(el.dataset.id);
    else if (a === 'delete-task') deleteTask(el.dataset.id);
    else if (a === 'add-event') addEvent(el.dataset.date || '');
    else if (a === 'edit-event') editEvent(el.dataset.id);
    else if (a === 'toggle-task') {
      mutate((s) => { const t = s.tasks.find((x) => x.id === el.dataset.id); if (!t) return; t.done = !t.done; t.doneAt = t.done ? new Date().toISOString() : ''; if (t.done) pushActivity(s, 'task', `أنجزت المهمة: ${t.title}`); });
      draw();
    }
    else if (a === 'shift-day') { ui.date = shift(ui.date, n); draw(); }
    else if (a === 'shift-week') { ui.date = shift(ui.date, n * 7); draw(); }
    else if (a === 'shift-month') { const d = parseKey(ui.date); ui.date = toKey(new Date(d.getFullYear(), d.getMonth() + n, 1)); ui.sel = ''; draw(); }
    else if (a === 'goto-today') { ui.date = todayKey(); draw(); }
    else if (a === 'open-day') { ui.date = el.dataset.date; ui.tab = 'day'; draw(); }
    else if (a === 'pick-date') { ui.sel = el.dataset.date; const d = parseKey(ui.sel); if (d.getMonth() !== parseKey(ui.date).getMonth()) ui.date = ui.sel; draw(); }
    else if (a === 'filter-tasks') { ui.filter = el.dataset.f; draw(); }
    else if (a === 'clear-done') {
      const n2 = getState().tasks.filter((t) => t.done).length;
      if (await confirmDialog({ title: 'مسح المهام المكتملة', message: `سيتم حذف ${n2} مهمة مكتملة نهائيًا.`, confirmText: 'مسح', danger: true })) { mutate((s) => { s.tasks = s.tasks.filter((t) => !t.done); }); draw(); }
    }
  });

  draw();
  if (ctx.query.get('new') === 'task') { history.replaceState(null, '', '#/planner'); addTask(); }
  return off;
}
