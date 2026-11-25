// محوّل الوحدات: طول، كتلة، زمن، مساحة، حجم، سرعة، بيانات، حرارة.

import { html, render } from '../lib/html.js';
import { options, delegate, copyText } from '../lib/ui.js';
import { UNIT_CATEGORIES, convertUnit, fmtNum } from '../lib/toolkit.js';
import { icon } from '../lib/icons.js';

export function mount(root) {
  const st = { cat: 'length', from: 'km', to: 'm', value: '1' };

  const unitOpts = (cat) => UNIT_CATEGORIES[cat].units.map(([value, label]) => ({ value, label }));

  function draw() {
    const cat = UNIT_CATEGORIES[st.cat];
    render(root, html`<div class="stack" style="max-width:560px;margin-inline:auto;width:100%">
      <div class="chips chips-scroll" role="radiogroup" aria-label="نوع القياس">${Object.entries(UNIT_CATEGORIES).map(([id, c]) => html`<button class="chip ${st.cat === id ? 'is-active' : ''}" type="button" role="radio" aria-checked="${st.cat === id}" data-cat="${id}">${c.label}</button>`)}</div>
      <div class="card stack">
        <div class="field"><label class="label" for="u-val">القيمة</label><input class="input input-ltr" id="u-val" type="text" inputmode="decimal" value="${st.value}" autocomplete="off"></div>
        <div class="grid grid-2 keep-2" style="align-items:end">
          <div class="field"><label class="label" for="u-from">من</label><select class="select" id="u-from">${options(unitOpts(st.cat), st.from)}</select></div>
          <div class="field"><label class="label" for="u-to">إلى</label><select class="select" id="u-to">${options(unitOpts(st.cat), st.to)}</select></div>
        </div>
        <div class="row row-center"><button class="btn btn-ghost btn-sm" type="button" data-swap>${icon('swap', { size: 16 })} تبديل</button></div>
        <div class="pw-out" id="u-out" aria-live="polite"></div>
        <button class="btn btn-ghost btn-sm" type="button" data-copy>${icon('copy', { size: 15 })} نسخ النتيجة</button>
      </div>
      <div class="card card-flat"><div class="section-label">جدول سريع: ${st.value || 0} ${cat.units.find((u) => u[0] === st.from)[1]}</div><div id="u-all"></div></div>
    </div>`);
    calc();
  }

  function calc() {
    const out = root.querySelector('#u-out');
    const all = root.querySelector('#u-all');
    const cat = UNIT_CATEGORIES[st.cat];
    const v = Number(String(st.value).replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x660).replace('٫', '.').replace(',', '.'));
    if (st.value.trim() === '' || !Number.isFinite(v)) { out.textContent = 'أدخل رقمًا صحيحًا'; all.textContent = ''; return; }
    try {
      out.textContent = `${fmtNum(convertUnit(st.cat, st.from, st.to, v))} ${cat.units.find((u) => u[0] === st.to)[1]}`;
      render(all, html`${cat.units.filter((u) => u[0] !== st.from).map((u) => html`<div class="kv"><span>${u[1]}</span><b class="ltr">${fmtNum(convertUnit(st.cat, st.from, u[0], v))}</b></div>`)}`);
    } catch (e) { out.textContent = e.message; all.textContent = ''; }
  }

  const onInput = (e) => { if (e.target.id === 'u-val') { st.value = e.target.value; calc(); } };
  const onChange = (e) => {
    if (e.target.id === 'u-from') { st.from = e.target.value; calc(); }
    if (e.target.id === 'u-to') { st.to = e.target.value; calc(); }
  };
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  const off = delegate(root, 'click', '[data-cat],[data-swap],[data-copy]', (e, el) => {
    if (el.dataset.cat) { st.cat = el.dataset.cat; const u = UNIT_CATEGORIES[st.cat].units; st.from = u[0][0]; st.to = (u[1] || u[0])[0]; if (st.cat === 'length') { st.from = 'km'; st.to = 'm'; } draw(); }
    else if ('swap' in el.dataset) { [st.from, st.to] = [st.to, st.from]; draw(); }
    else if ('copy' in el.dataset) { const t = root.querySelector('#u-out').textContent; if (t) copyText(t, 'تم نسخ النتيجة'); }
  });
  draw();
  return () => { off(); root.removeEventListener('input', onInput); root.removeEventListener('change', onChange); };
}
