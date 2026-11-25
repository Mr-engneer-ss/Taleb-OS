// عدّاد الكلمات والحروف مع إحصاءات القراءة وأكثر الكلمات تكرارًا.

import { html, render } from '../lib/html.js';
import { debounce, copyText, delegate } from '../lib/ui.js';
import { textStats } from '../lib/toolkit.js';

export function mount(root) {
  render(root, html`<div class="stack">
    <div class="field"><label class="label" for="tc-text">اكتب أو الصق النص</label>
      <textarea class="textarea" id="tc-text" rows="9" maxlength="500000" placeholder="ابدأ الكتابة..."></textarea></div>
    <div class="row"><label class="label" for="tc-limit">حد أقصى للحروف (اختياري):</label><input class="input" id="tc-limit" type="number" inputmode="numeric" min="1" style="width:130px"><button class="btn btn-ghost btn-sm" type="button" data-act="copy">نسخ النص</button><button class="btn btn-ghost btn-sm" type="button" data-act="clear">مسح</button></div>
    <div id="tc-out" aria-live="polite"></div>
  </div>`);
  const ta = root.querySelector('#tc-text');
  const limit = root.querySelector('#tc-limit');
  const out = root.querySelector('#tc-out');
  const n = (x) => x.toLocaleString('en-US');

  const calc = () => {
    const s = textStats(ta.value);
    const lim = Number(limit.value);
    const mins = s.readMin;
    const read = s.words === 0 ? '—' : mins < 1 ? 'أقل من دقيقة' : `${Math.ceil(mins)} دقيقة`;
    render(out, html`<div class="stat-grid">
      <div class="stat-box"><b>${n(s.words)}</b><span>كلمة</span></div>
      <div class="stat-box"><b>${n(s.chars)}</b><span>حرف (بالمسافات)</span></div>
      <div class="stat-box"><b>${n(s.charsNoSpace)}</b><span>حرف (بدون مسافات)</span></div>
      <div class="stat-box"><b>${n(s.sentences)}</b><span>جملة</span></div>
      <div class="stat-box"><b>${n(s.paragraphs)}</b><span>فقرة</span></div>
      <div class="stat-box"><b>${read}</b><span>وقت القراءة التقريبي</span></div>
    </div>
    ${lim > 0 ? html`<div style="margin-top:12px"><div class="row row-between small"><span>${n(s.chars)} / ${n(lim)}</span><span style="color:${s.chars > lim ? 'var(--danger)' : 'var(--success)'}">${s.chars > lim ? `زيادة ${n(s.chars - lim)}` : `متبقي ${n(lim - s.chars)}`}</span></div><div class="meter"><i style="width:${Math.min(100, (s.chars / lim) * 100)}%;background:${s.chars > lim ? 'var(--danger)' : 'var(--primary)'}"></i></div></div>` : ''}
    ${s.top.length ? html`<div class="section-label" style="margin-top:14px">أكثر الكلمات تكرارًا</div><div class="chips">${s.top.map(([w, c]) => html`<span class="badge badge-primary">${w} × ${c}</span>`)}</div>` : ''}`);
  };
  const soon = debounce(calc, 120);
  ta.addEventListener('input', soon);
  limit.addEventListener('input', calc);
  const off = delegate(root, 'click', '[data-act]', (e, el) => {
    if (el.dataset.act === 'copy' && ta.value) copyText(ta.value, 'تم نسخ النص');
    if (el.dataset.act === 'clear') { ta.value = ''; calc(); ta.focus(); }
  });
  calc();
  return () => { off(); soon.cancel(); };
}
