// المنهج الدراسي: مواد ← وحدات ← دروس، مع الحالة والإتقان والملاحظات والمراجعة والإحصاءات.
// لا يحتوي أي محتوى رسمي للمنهج: كل شيء يضيفه المستخدم.

import { getState, mutate, pushActivity } from './storage.js';
import { html, render } from './lib/html.js';
import { icon } from './lib/icons.js';
import { delegate, emptyState, formDialog, confirmDialog, toast, lessonsLabel, pageHead, options } from './lib/ui.js';
import { donut, hbars, stacked } from './lib/charts.js';
import { uid } from './lib/schema.js';
import { subjectStats, unitStats, overallStats, reviewsDue } from './lib/metrics.js';
import { detachSubject } from './lib/subjects.js';
import { todayKey, relativeDay, formatShort } from './lib/dates.js';
import { SUBJECT_COLORS, LESSON_STATUS, LESSON_STATUS_ORDER, MASTERY_LABELS } from './config.js';

// أسماء مقترحة فقط لتسريع الإضافة — لا تحمل أي محتوى دراسي
const SUGGESTED_NAMES = [
  'اللغة العربية', 'اللغة الإنجليزية', 'لغة أجنبية ثانية', 'الرياضيات', 'الفيزياء', 'الكيمياء',
  'الأحياء', 'التاريخ', 'الجغرافيا', 'الفلسفة والمنطق', 'الحاسب الآلي',
];

const nextColor = (state) => SUBJECT_COLORS[state.subjects.length % SUBJECT_COLORS.length];
const masteryDots = (m) => html`<span class="mastery" title="الإتقان: ${MASTERY_LABELS[m]}" aria-label="الإتقان: ${MASTERY_LABELS[m]}">${[1, 2, 3, 4, 5].map((i) => html`<i class="${i <= m ? 'on' : ''}"></i>`)}</span>`;

/* ───────── صفحة قائمة المواد ───────── */
function listView(state) {
  const ov = overallStats(state);
  if (state.subjects.length === 0) {
    return html`<div class="page">
      ${pageHead({ title: 'منهجي الدراسي', subtitle: 'أنشئ موادك ووحداتك ودروسك وتابع تقدمك.' })}
      <div class="card">
        ${emptyState({ icon: 'book', title: 'ابدأ بإضافة أول مادة', text: 'المنهج قابل للتخصيص بالكامل: أضف المواد والوحدات والدروس بنفسك كما في كتبك.', action: { id: 'add-subject', label: 'إضافة مادة', icon: 'plus' } })}
        <hr class="divider">
        <div class="section-label" style="text-align:center;margin-top:12px">أو أضف بنقرة واحدة (أسماء مقترحة فقط — يمكنك تعديلها لاحقًا)</div>
        <div class="chips row-center">${SUGGESTED_NAMES.map((n) => html`<button class="chip" type="button" data-action="quick-subject" data-name="${n}">${icon('plus', { size: 14 })}${n}</button>`)}</div>
      </div>
    </div>`;
  }

  return html`<div class="page">
    ${pageHead({
      title: 'منهجي الدراسي',
      subtitle: `${state.subjects.length} ${state.subjects.length > 2 ? 'مواد' : 'مادة'} · ${lessonsLabel(ov.total)}`,
      actions: html`<button class="btn btn-primary" type="button" data-action="add-subject">${icon('plus', { size: 18 })} مادة جديدة</button>`,
    })}

    <div class="grid grid-2">
      <section class="card">
        <div class="card-head"><h3 class="card-title">${icon('chart')} الإنجاز الكلي</h3></div>
        <div class="row row-nowrap" style="gap:20px">
          ${donut({ percent: ov.percent, size: 132, label: 'إنجاز المنهج', sub: 'مكتمل' })}
          <div style="flex:1;min-width:0">
            ${stacked([
              { label: 'مكتمل', value: ov.done, color: 'var(--success)' },
              { label: 'قيد الدراسة', value: ov.learning, color: 'var(--warning)' },
              { label: 'لم يبدأ', value: ov.todo, color: 'var(--border-strong)' },
            ])}
            <p class="muted tiny" style="margin-top:10px">النسبة = الدروس المكتملة ÷ إجمالي الدروس.</p>
          </div>
        </div>
      </section>
      <section class="card">
        <div class="card-head"><h3 class="card-title">${icon('layers')} التقدم حسب المادة</h3></div>
        ${hbars(state.subjects.map((s) => {
          const st = subjectStats(s);
          return { label: s.name, value: st.done, max: st.total || 1, color: s.color, dot: true, text: st.total ? `${st.done}/${st.total} · ${st.percent}%` : 'بلا دروس' };
        }))}
      </section>
    </div>

    <div class="grid grid-auto">
      ${state.subjects.map((s) => {
        const st = subjectStats(s);
        return html`<a class="card card-link subject-card" href="#/curriculum/${s.id}" style="--accent-color:${s.color}">
          <div class="subject-top">
            <span class="subject-badge" style="background:${s.color}">${[...s.name][0]}</span>
            <div style="min-width:0;flex:1"><h3 class="ellipsis">${s.name}</h3><div class="muted small">${st.units} ${st.units > 2 ? 'وحدات' : 'وحدة'} · ${lessonsLabel(st.total)}</div></div>
            <span class="badge badge-primary num">${st.percent}%</span>
          </div>
          <div class="bar"><i style="width:${st.percent}%;background:${s.color}"></i></div>
          <div class="row row-between small muted"><span>${st.done} مكتمل · ${st.learning} قيد الدراسة</span>${st.avgMastery ? html`<span>${masteryDots(Math.round(st.avgMastery))}</span>` : ''}</div>
        </a>`;
      })}
    </div>
  </div>`;
}

/* ───────── صفحة مادة ───────── */
function lessonRow(l, today) {
  const st = LESSON_STATUS[l.status];
  const due = l.reviewDate && l.reviewDate <= today;
  return html`<div class="lesson">
    <button class="check check-hit ${l.status === 'done' ? 'is-on' : l.status === 'learning' ? 'is-learning' : ''}" type="button" data-action="cycle-lesson" data-id="${l.id}"
      aria-label="حالة الدرس ${l.title}: ${st.label} — اضغط للتغيير" title="${st.label} — اضغط للتغيير">${icon(l.status === 'learning' ? 'clock' : 'check', { size: 15 })}</button>
    <div class="lesson-main ${l.status === 'done' ? 'is-done' : ''}" data-action="edit-lesson" data-id="${l.id}" role="button" tabindex="0">
      <div class="list-title">${l.title}</div>
      <div class="list-sub">
        <span class="badge badge-${st.tone === 'muted' ? 'muted' : st.tone}">${st.label}</span>
        ${l.mastery ? masteryDots(l.mastery) : ''}
        ${l.reviewDate ? html`<span class="badge ${due ? 'badge-warning' : 'badge-muted'}">${icon('refresh', { size: 12 })} مراجعة ${due ? 'مستحقة' : relativeDay(l.reviewDate, today)}</span>` : ''}
        ${l.notes ? html`<span title="لديه ملاحظات">${icon('note', { size: 14 })}</span>` : ''}
      </div>
    </div>
  </div>`;
}

function subjectView(state, subject) {
  const today = todayKey();
  const st = subjectStats(subject);
  const due = reviewsDue({ subjects: [subject] }, today);

  return html`<div class="page">
    <div><a class="back-link" href="#/curriculum">${icon('arrow-right', { size: 18 })} كل المواد</a></div>
    ${pageHead({
      title: html`<span class="row row-nowrap"><i class="dot" style="background:${subject.color};width:14px;height:14px"></i>${subject.name}</span>`,
      subtitle: subject.desc || `${lessonsLabel(st.total)} في ${st.units} ${st.units > 2 ? 'وحدات' : 'وحدة'}`,
      actions: html`<button class="btn btn-ghost" type="button" data-action="edit-subject">${icon('edit', { size: 18 })} تعديل المادة</button>
        <button class="btn btn-primary" type="button" data-action="add-unit">${icon('plus', { size: 18 })} وحدة جديدة</button>`,
    })}

    <div class="grid grid-2">
      <section class="card">
        <div class="card-head"><h3 class="card-title">${icon('chart')} تقدم المادة</h3></div>
        <div class="row row-nowrap" style="gap:20px">
          ${donut({ percent: st.percent, size: 124, color: subject.color, label: 'إنجاز المادة', sub: 'مكتمل' })}
          <div style="flex:1;min-width:0">${stacked([
            { label: 'مكتمل', value: st.done, color: 'var(--success)' },
            { label: 'قيد الدراسة', value: st.learning, color: 'var(--warning)' },
            { label: 'لم يبدأ', value: st.todo, color: 'var(--border-strong)' },
          ])}</div>
        </div>
      </section>
      <section class="card">
        <div class="card-head"><h3 class="card-title">${icon('target')} مستوى الإتقان</h3>${st.avgMastery ? html`<span class="badge badge-primary">المتوسط ${st.avgMastery.toFixed(1)}/5</span>` : ''}</div>
        ${st.total === 0 ? html`<p class="muted">أضف دروسًا لتظهر هنا توزيعات الإتقان.</p>` : hbars([5, 4, 3, 2, 1, 0].map((m) => ({
          label: MASTERY_LABELS[m], value: st.byMastery[m], max: Math.max(1, ...st.byMastery), color: m === 0 ? 'var(--border-strong)' : 'var(--accent)', text: st.byMastery[m],
        })))}
      </section>
    </div>

    ${due.length ? html`<section class="card">
      <div class="card-head"><h3 class="card-title">${icon('refresh')} مراجعات مستحقة</h3><span class="badge badge-warning">${due.length}</span></div>
      <div class="list">${due.map((r) => html`<div class="list-item"><div class="list-main"><div class="list-title">${r.lesson.title}</div><div class="list-sub"><span>${r.unit.name}</span><span>${relativeDay(r.lesson.reviewDate, today)}</span></div></div>
        <button class="btn btn-sm btn-ghost" type="button" data-action="edit-lesson" data-id="${r.lesson.id}">تحديث</button></div>`)}</div>
    </section>` : ''}

    ${subject.units.length === 0
      ? html`<div class="card">${emptyState({ icon: 'layers', title: 'لا توجد وحدات بعد', text: 'قسّم المادة إلى وحدات (أبواب أو فصول) ثم أضف الدروس داخل كل وحدة.', action: { id: 'add-unit', label: 'إضافة وحدة', icon: 'plus' } })}</div>`
      : subject.units.map((u) => {
        const us = unitStats(u);
        return html`<section class="unit" data-unit="${u.id}">
          <div class="unit-head">
            <div class="unit-title">${u.name}<div class="muted tiny">${us.done} من ${us.total} · ${us.percent}%</div></div>
            <button class="btn btn-sm btn-ghost" type="button" data-action="add-lesson" data-unit="${u.id}">${icon('plus', { size: 15 })} درس</button>
            <button class="icon-btn icon-btn-sm" type="button" data-action="edit-unit" data-unit="${u.id}" aria-label="تعديل الوحدة ${u.name}">${icon('edit', { size: 17 })}</button>
          </div>
          <div class="bar" style="border-radius:0;height:4px"><i style="width:${us.percent}%;background:${subject.color};border-radius:0"></i></div>
          <div class="unit-body">${u.lessons.length === 0
            ? html`<p class="muted small" style="padding:14px 0">لا دروس في هذه الوحدة. <button class="chip" type="button" data-action="add-lesson" data-unit="${u.id}">إضافة درس</button></p>`
            : u.lessons.map((l) => lessonRow(l, today))}</div>
        </section>`;
      })}
  </div>`;
}

/* ───────── النماذج ───────── */
const subjectFields = [
  { name: 'name', label: 'اسم المادة', required: true, maxlength: 80, placeholder: 'مثال: الفيزياء' },
  { name: 'color', label: 'اللون', type: 'color' },
  { name: 'desc', label: 'وصف مختصر (اختياري)', maxlength: 300 },
];

const lessonFields = [
  { name: 'title', label: 'عنوان الدرس', required: true, maxlength: 160 },
  { name: 'status', label: 'الحالة', type: 'select', full: false, options: LESSON_STATUS_ORDER.map((k) => ({ value: k, label: LESSON_STATUS[k].label })) },
  { name: 'mastery', label: 'مستوى الإتقان', type: 'select', full: false, options: MASTERY_LABELS.map((l, i) => ({ value: String(i), label: i ? `${i} — ${l}` : l })) },
  { name: 'reviewDate', label: 'موعد المراجعة', type: 'date', quick: [{ label: 'غدًا', days: 1 }, { label: 'بعد 3 أيام', days: 3 }, { label: 'بعد أسبوع', days: 7 }, { label: 'بعد أسبوعين', days: 14 }] },
  { name: 'notes', label: 'ملاحظات', type: 'textarea', rows: 4, maxlength: 5000, placeholder: 'نقاط مهمة، أسئلة، صعوبات...' },
];

/* ───────── التركيب ───────── */
export function mount(root, ctx) {
  const subjectId = ctx.params[0] || '';

  const draw = () => {
    const state = getState();
    if (subjectId) {
      const subject = state.subjects.find((s) => s.id === subjectId);
      if (!subject) {
        render(root, html`<div class="page"><div class="card">${emptyState({ icon: 'alert', title: 'المادة غير موجودة', text: 'ربما حُذفت. عد إلى قائمة المواد.', action: { id: 'back', label: 'كل المواد' } })}</div></div>`);
        return;
      }
      ctx.setTitle(subject.name);
      render(root, subjectView(state, subject));
    } else {
      render(root, listView(state));
    }
  };

  const withSubject = (fn) => mutate((s) => { const sub = s.subjects.find((x) => x.id === subjectId); if (sub) return fn(sub, s); });
  const findLessonIn = (sub, id) => { for (const u of sub.units) { const l = u.lessons.find((x) => x.id === id); if (l) return { unit: u, lesson: l }; } return null; };

  async function addSubject(name) {
    let vals = { name, color: nextColor(getState()), desc: '' };
    if (!name) {
      const res = await formDialog({ title: 'مادة جديدة', fields: subjectFields, values: vals, submitText: 'إضافة المادة' });
      if (!res) return;
      vals = res.values;
    }
    const id = uid();
    mutate((s) => {
      s.subjects.push({ id, name: vals.name, color: vals.color, desc: vals.desc, units: [], createdAt: new Date().toISOString() });
      pushActivity(s, 'curriculum', `أضفت مادة ${vals.name}`);
    });
    toast(`أُضيفت المادة «${vals.name}»`, { type: 'success' });
    draw();
  }

  async function editSubject() {
    const sub = getState().subjects.find((s) => s.id === subjectId);
    const res = await formDialog({ title: 'تعديل المادة', fields: subjectFields, values: sub, submitText: 'حفظ', deleteText: 'حذف المادة' });
    if (!res) return;
    if (res.action === 'delete') {
      const lessons = subjectStats(sub).total;
      const ok = await confirmDialog({ title: 'حذف المادة', message: `سيتم حذف «${sub.name}» مع ${sub.units.length} وحدة و${lessons} درس نهائيًا. لن تُحذف مهامك وجلساتك، لكنها ستفقد ارتباطها بالمادة.`, confirmText: 'حذف المادة', danger: true });
      if (!ok) return;
      mutate((s) => { s.subjects = s.subjects.filter((x) => x.id !== subjectId); detachSubject(s, subjectId); pushActivity(s, 'curriculum', `حذفت مادة ${sub.name}`); });
      toast('تم حذف المادة');
      ctx.navigate('#/curriculum');
      return;
    }
    withSubject((x) => { x.name = res.values.name; x.color = res.values.color; x.desc = res.values.desc; });
    draw();
  }

  async function addUnit() {
    const res = await formDialog({ title: 'وحدة جديدة', fields: [{ name: 'name', label: 'اسم الوحدة', required: true, maxlength: 120, placeholder: 'مثال: الوحدة الأولى' }], submitText: 'إضافة الوحدة' });
    if (!res) return;
    withSubject((sub) => { sub.units.push({ id: uid(), name: res.values.name, lessons: [] }); });
    draw();
  }

  async function editUnit(unitId) {
    const unit = getState().subjects.find((s) => s.id === subjectId).units.find((u) => u.id === unitId);
    const res = await formDialog({ title: 'تعديل الوحدة', fields: [{ name: 'name', label: 'اسم الوحدة', required: true, maxlength: 120 }], values: unit, deleteText: 'حذف الوحدة' });
    if (!res) return;
    if (res.action === 'delete') {
      const ok = await confirmDialog({ title: 'حذف الوحدة', message: `سيتم حذف «${unit.name}» وجميع دروسها (${unit.lessons.length}) نهائيًا.`, confirmText: 'حذف الوحدة', danger: true });
      if (!ok) return;
      withSubject((sub) => { sub.units = sub.units.filter((u) => u.id !== unitId); });
    } else {
      withSubject((sub) => { sub.units.find((u) => u.id === unitId).name = res.values.name; });
    }
    draw();
  }

  async function addLesson(unitId) {
    const res = await formDialog({ title: 'درس جديد', fields: lessonFields, values: { status: 'todo', mastery: '0' }, submitText: 'إضافة الدرس' });
    if (!res) return;
    const v = res.values;
    withSubject((sub, s) => {
      const unit = sub.units.find((u) => u.id === unitId);
      unit.lessons.push({ id: uid(), title: v.title, status: v.status, mastery: Number(v.mastery) || 0, notes: v.notes, reviewDate: v.reviewDate, updatedAt: new Date().toISOString() });
      if (v.status === 'done') pushActivity(s, 'lesson', `أكملت درس ${v.title}`);
    });
    draw();
  }

  async function editLesson(lessonId) {
    const sub = getState().subjects.find((s) => s.id === subjectId);
    const found = findLessonIn(sub, lessonId);
    if (!found) return;
    const l = found.lesson;
    const res = await formDialog({ title: 'تعديل الدرس', fields: lessonFields, values: { ...l, mastery: String(l.mastery) }, deleteText: 'حذف الدرس' });
    if (!res) return;
    if (res.action === 'delete') {
      const ok = await confirmDialog({ title: 'حذف الدرس', message: `حذف «${l.title}» نهائيًا؟`, confirmText: 'حذف', danger: true });
      if (!ok) return;
      withSubject((s2) => { const f = findLessonIn(s2, lessonId); f.unit.lessons = f.unit.lessons.filter((x) => x.id !== lessonId); });
    } else {
      const v = res.values;
      withSubject((s2, st) => {
        const f = findLessonIn(s2, lessonId);
        const wasDone = f.lesson.status === 'done';
        Object.assign(f.lesson, { title: v.title, status: v.status, mastery: Number(v.mastery) || 0, notes: v.notes, reviewDate: v.reviewDate, updatedAt: new Date().toISOString() });
        if (!wasDone && v.status === 'done') pushActivity(st, 'lesson', `أكملت درس ${v.title}`);
      });
    }
    draw();
  }

  function cycleLesson(lessonId) {
    withSubject((sub, s) => {
      const f = findLessonIn(sub, lessonId);
      if (!f) return;
      const i = LESSON_STATUS_ORDER.indexOf(f.lesson.status);
      f.lesson.status = LESSON_STATUS_ORDER[(i + 1) % LESSON_STATUS_ORDER.length];
      f.lesson.updatedAt = new Date().toISOString();
      if (f.lesson.status === 'done') pushActivity(s, 'lesson', `أكملت درس ${f.lesson.title}`);
    });
    draw();
  }

  const off = delegate(root, 'click', '[data-action]', (e, el) => {
    const a = el.dataset.action;
    if (a === 'add-subject') addSubject();
    else if (a === 'quick-subject') addSubject(el.dataset.name);
    else if (a === 'edit-subject') editSubject();
    else if (a === 'add-unit') addUnit();
    else if (a === 'edit-unit') editUnit(el.dataset.unit);
    else if (a === 'add-lesson') addLesson(el.dataset.unit);
    else if (a === 'edit-lesson') editLesson(el.dataset.id);
    else if (a === 'cycle-lesson') cycleLesson(el.dataset.id);
    else if (a === 'back') ctx.navigate('#/curriculum');
  });
  const onKey = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target instanceof Element && e.target.matches('[data-action="edit-lesson"]')) {
      e.preventDefault();
      editLesson(e.target.dataset.id);
    }
  };
  root.addEventListener('keydown', onKey);

  draw();
  return () => { off(); root.removeEventListener('keydown', onKey); };
}

export { formatShort, options };
