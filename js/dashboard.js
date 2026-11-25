// لوحة التحكم: ملخص اليوم والمنهج والتركيز والنشاط.

import { getState, mutate, pushActivity } from './storage.js';
import { html, render } from './lib/html.js';
import { icon } from './lib/icons.js';
import { delegate, emptyState } from './lib/ui.js';
import { donut, hbars, vbars } from './lib/charts.js';
import {
  todayKey, formatLong, formatMinutes, formatShort, formatTimeRange, relativeDay, timeAgo, greeting, WEEKDAYS,
} from './lib/dates.js';
import {
  overallStats, subjectStats, taskStats, nextExam, focusSummary, focusCurrentWeek, reviewsDue, eventsOnDate, isOverdue,
} from './lib/metrics.js';
import { subjectName, subjectColor } from './lib/subjects.js';
import { PRIORITIES, NAV } from './config.js';

const SHORTCUT_IDS = ['curriculum', 'planner', 'focus', 'assistant', 'library', 'toolbox', 'settings'];

function todaysTasks(state, today) {
  return state.tasks
    .filter((t) => (t.due === today) || isOverdue(t, today))
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.due || '').localeCompare(b.due || '') || PRIORITIES[a.priority].rank - PRIORITIES[b.priority].rank);
}

function view(state) {
  const today = todayKey();
  const now = new Date();
  const ov = overallStats(state);
  const ts = taskStats(state, today);
  const exam = nextExam(state, today);
  const fs = focusSummary(state, today);
  const week = focusCurrentWeek(state, today);
  const tasks = todaysTasks(state, today);
  const events = eventsOnDate(state, today);
  const reviews = reviewsDue(state, today);
  const name = state.settings.name;
  const isFresh = state.subjects.length === 0 && state.tasks.length === 0 && state.sessions.length === 0;

  return html`<div class="page">
    <section class="hero" aria-label="الترحيب">
      <h2>${greeting(now)}${name ? `، ${name}` : ''} 👋</h2>
      <p>${state.settings.grade} — ${ts.dueToday + ts.overdue > 0 ? `لديك ${ts.open} مهمة مفتوحة، منها ${ts.dueToday - ts.dueTodayDone} مستحقة اليوم.` : 'يوم هادئ — خطّط لما تريد إنجازه.'}</p>
      <span class="hero-date">${icon('calendar', { size: 16 })} ${formatLong(now)}</span>
      ${name ? '' : html`<form class="name-form" data-form="name">
        <input class="input" name="name" placeholder="اكتب اسمك ليظهر هنا" maxlength="40" aria-label="اسمك" autocomplete="given-name">
        <button class="btn btn-primary btn-sm" type="submit">حفظ الاسم</button>
      </form>`}
    </section>

    ${isFresh ? html`<section class="card">
      <div class="card-head"><h3 class="card-title">${icon('target')} ابدأ من هنا</h3></div>
      <p class="muted small" style="margin-bottom:12px">ثلاث خطوات سريعة لتجهيز STUDENT OS. كل بياناتك تُحفظ على جهازك فقط.</p>
      <div class="grid grid-3">
        <a class="card card-link card-flat" href="#/curriculum"><div class="stack-sm"><span class="stat-ic">${icon('book')}</span><strong>١. أضف موادك</strong><span class="muted small">أنشئ المواد والوحدات والدروس كما يناسبك.</span></div></a>
        <a class="card card-link card-flat" href="#/planner?new=task"><div class="stack-sm"><span class="stat-ic is-warning">${icon('tasks')}</span><strong>٢. سجّل أول مهمة</strong><span class="muted small">حدّد أولوية وموعدًا نهائيًا.</span></div></a>
        <a class="card card-link card-flat" href="#/focus"><div class="stack-sm"><span class="stat-ic is-success">${icon('timer')}</span><strong>٣. ابدأ جلسة تركيز</strong><span class="muted small">مؤقت Pomodoro يسجّل وقت مذاكرتك.</span></div></a>
      </div>
    </section>` : ''}

    <section class="stats-row" aria-label="ملخص سريع">
      <div class="card stat">
        <div class="row row-nowrap"><span class="stat-ic is-warning">${icon('tasks', { size: 20 })}</span><span class="stat-label">مهام اليوم</span></div>
        <div class="stat-value">${ts.dueTodayDone}<span class="muted" style="font-size:1rem">/${ts.dueToday}</span></div>
        <div class="stat-sub">${ts.overdue > 0 ? html`<span style="color:var(--danger)">${ts.overdue} متأخرة</span>` : 'لا مهام متأخرة'}</div>
      </div>
      <div class="card stat">
        <div class="row row-nowrap"><span class="stat-ic is-success">${icon('check', { size: 20 })}</span><span class="stat-label">دروس مكتملة</span></div>
        <div class="stat-value">${ov.done}<span class="muted" style="font-size:1rem">/${ov.total}</span></div>
        <div class="stat-sub">${ov.total ? `${ov.percent}% من المنهج` : 'لم تضف دروسًا بعد'}</div>
      </div>
      <div class="card stat">
        <div class="row row-nowrap"><span class="stat-ic is-danger">${icon('flag', { size: 20 })}</span><span class="stat-label">أقرب امتحان</span></div>
        <div class="stat-value">${exam ? (exam.daysLeft === 0 ? 'اليوم' : `${exam.daysLeft} يوم`) : '—'}</div>
        <div class="stat-sub ellipsis">${exam ? `${exam.event.title} · ${formatShort(exam.event.date)}` : 'لا امتحانات مضافة'}</div>
      </div>
      <div class="card stat">
        <div class="row row-nowrap"><span class="stat-ic">${icon('timer', { size: 20 })}</span><span class="stat-label">وقت المذاكرة اليوم</span></div>
        <div class="stat-value">${formatMinutes(fs.today)}</div>
        <div class="stat-sub">هذا الأسبوع: ${formatMinutes(fs.week)}</div>
      </div>
    </section>

    <section class="grid-dash">
      <div class="card c-5">
        <div class="card-head"><h3 class="card-title">${icon('chart')} تقدم المنهج</h3><a class="btn btn-ghost btn-sm" href="#/curriculum">عرض</a></div>
        ${ov.subjects === 0
          ? emptyState({ icon: 'book', title: 'لم تضف مواد بعد', text: 'ابدأ بإضافة موادك ودروسك لترى نسبة الإنجاز هنا.', action: { id: 'goto-curriculum', label: 'إضافة مادة', icon: 'plus' } })
          : html`<div class="row row-nowrap" style="gap:18px;align-items:center">
              ${donut({ percent: ov.percent, size: 124, stroke: 12, label: 'نسبة إنجاز المنهج', sub: 'مكتمل' })}
              <div style="flex:1;min-width:0">${hbars(state.subjects.slice(0, 4).map((s) => {
                const st = subjectStats(s);
                return { label: s.name, value: st.done, max: st.total || 1, color: s.color, dot: true, text: `${st.percent}%` };
              }))}</div>
            </div>`}
      </div>

      <div class="card c-7">
        <div class="card-head"><h3 class="card-title">${icon('tasks')} مهام اليوم والمتأخرة</h3><a class="btn btn-ghost btn-sm" href="#/planner?tab=tasks">كل المهام</a></div>
        ${tasks.length === 0
          ? html`<p class="muted" style="padding:14px 0">لا توجد مهام مستحقة اليوم. ${state.tasks.length === 0 ? html`<a href="#/planner?new=task">أضف مهمة</a>` : 'أحسنت!'}</p>`
          : html`<div class="list">${tasks.slice(0, 6).map((t) => html`
            <div class="list-item ${t.done ? 'is-done' : ''}">
              <span class="prio prio-${t.priority}" title="أولوية ${PRIORITIES[t.priority].label}"></span>
              <button class="check check-hit ${t.done ? 'is-on' : ''}" type="button" data-action="toggle-task" data-id="${t.id}" aria-label="${t.done ? 'إلغاء الإكمال' : 'إكمال المهمة'}: ${t.title}">${icon('check', { size: 16 })}</button>
              <div class="list-main"><div class="list-title">${t.title}</div>
                <div class="list-sub">${t.due && t.due < today && !t.done ? html`<span class="badge badge-danger">متأخرة ${relativeDay(t.due, today)}</span>` : ''}${t.subjectId ? html`<span><i class="dot" style="background:${subjectColor(state, t.subjectId)}"></i> ${subjectName(state, t.subjectId)}</span>` : ''}</div></div>
            </div>`)}</div>`}
      </div>

      <div class="card c-4">
        <div class="card-head"><h3 class="card-title">${icon('clock')} جدول اليوم</h3><span class="muted small">${WEEKDAYS[now.getDay()]}</span></div>
        ${events.length === 0
          ? html`<p class="muted" style="padding:10px 0">لا حصص أو مواعيد اليوم.</p>`
          : html`<div class="stack-sm">${events.slice(0, 5).map((e) => html`<div class="ev ${e.kind === 'exam' ? 'is-exam' : ''}" style="--ev-color:${subjectColor(state, e.subjectId)};cursor:default"><b>${e.title}</b><small>${formatTimeRange(e.start, e.end) || 'طوال اليوم'}${e.place ? ` · ${e.place}` : ''}</small></div>`)}</div>`}
      </div>

      <div class="card c-4">
        <div class="card-head"><h3 class="card-title">${icon('timer')} تركيز هذا الأسبوع</h3><a class="btn btn-ghost btn-sm" href="#/focus">ابدأ</a></div>
        ${fs.week === 0 && fs.total === 0
          ? html`<p class="muted" style="padding:10px 0">لم تسجّل جلسات بعد. ابدأ أول جلسة تركيز!</p>`
          : vbars(week.map((d) => ({ label: WEEKDAYS[d.weekday].slice(0, 3), value: d.minutes, text: d.minutes, highlight: d.key === today })), { height: 96 })}
      </div>

      <div class="card c-4">
        <div class="card-head"><h3 class="card-title">${icon('refresh')} مراجعات مستحقة</h3>${reviews.length ? html`<span class="badge badge-warning">${reviews.length}</span>` : ''}</div>
        ${reviews.length === 0
          ? html`<p class="muted" style="padding:10px 0">لا مراجعات مستحقة. حدّد موعد مراجعة لأي درس من صفحة المنهج.</p>`
          : html`<div class="list">${reviews.slice(0, 4).map((r) => html`<a class="list-item" href="#/curriculum/${r.subject.id}" style="color:inherit;text-decoration:none">
              <i class="dot" style="background:${r.subject.color}"></i>
              <div class="list-main"><div class="list-title">${r.lesson.title}</div><div class="list-sub"><span>${r.subject.name}</span><span>${relativeDay(r.lesson.reviewDate, today)}</span></div></div></a>`)}</div>`}
      </div>

      <div class="card c-6">
        <div class="card-head"><h3 class="card-title">${icon('history')} النشاط الأخير</h3></div>
        ${state.activity.length === 0
          ? html`<p class="muted" style="padding:10px 0">سيظهر هنا ما تنجزه: دروس مكتملة، مهام، جلسات تركيز.</p>`
          : html`<div>${state.activity.slice(0, 6).map((a) => html`<div class="activity-item"><span class="activity-dot"></span><div style="flex:1;min-width:0">${a.text}<div class="muted tiny">${timeAgo(a.at)}</div></div></div>`)}</div>`}
      </div>

      <div class="card c-6">
        <div class="card-head"><h3 class="card-title">${icon('grid')} اختصارات</h3></div>
        <div class="shortcuts">${SHORTCUT_IDS.map((id) => { const n = NAV.find((x) => x.id === id); return html`<a class="shortcut" href="#/${id}">${icon(n.icon, { size: 24 })}<span>${n.label}</span></a>`; })}
          <a class="shortcut" href="#/planner?new=task">${icon('plus', { size: 24 })}<span>مهمة جديدة</span></a></div>
      </div>
    </section>
  </div>`;
}

export function mount(root, ctx) {
  const draw = () => render(root, view(getState()));

  const off = delegate(root, 'click', '[data-action]', (e, el) => {
    const act = el.dataset.action;
    if (act === 'goto-curriculum') ctx.navigate('#/curriculum');
    if (act === 'toggle-task') {
      mutate((s) => {
        const t = s.tasks.find((x) => x.id === el.dataset.id);
        if (!t) return;
        t.done = !t.done;
        t.doneAt = t.done ? new Date().toISOString() : '';
        if (t.done) pushActivity(s, 'task', `أنجزت المهمة: ${t.title}`);
      });
      draw();
    }
  });

  const onSubmit = (e) => {
    const form = e.target.closest('[data-form="name"]');
    if (!form) return;
    e.preventDefault();
    const name = new FormData(form).get('name').toString().trim().slice(0, 40);
    if (!name) return;
    mutate((s) => { s.settings.name = name; });
    draw();
  };
  root.addEventListener('submit', onSubmit);
  draw();
  return () => { off(); root.removeEventListener('submit', onSubmit); };
}
