// الحاسبة العلمية — تعتمد على محلّل آمن (lib/mathexpr.js) بدون eval.

import { html, render } from '../lib/html.js';
import { delegate, copyText } from '../lib/ui.js';
import { evaluate, formatResult, MathError } from '../lib/mathexpr.js';

const SCI = [
  ['sin(', 'sin'], ['cos(', 'cos'], ['tan(', 'tan'], ['asin(', 'sin⁻¹'], ['acos(', 'cos⁻¹'],
  ['atan(', 'tan⁻¹'], ['log(', 'log'], ['ln(', 'ln'], ['sqrt(', '√'], ['^', 'xʸ'],
  ['!', 'n!'], ['pi', 'π'], ['e', 'e'], ['(', '('], [')', ')'],
];
const PAD = [
  ['AC', 'clr'], ['⌫', 'clr'], ['%', 'op'], ['÷', 'op'],
  ['7'], ['8'], ['9'], ['×', 'op'],
  ['4'], ['5'], ['6'], ['−', 'op'],
  ['1'], ['2'], ['3'], ['+', 'op'],
  ['ANS', 'fn'], ['0'], ['.'], ['=', 'eq'],
];

export function mount(root, ctx) {
  let expr = '';
  let ans = null;
  let angle = 'deg';
  let history = [];

  const draw = () => {
    render(root, html`<div class="calc">
      <div class="calc-screen">
        <input class="calc-expr" id="calc-expr" value="${expr}" inputmode="none" autocomplete="off" spellcheck="false" aria-label="التعبير الحسابي" placeholder="0">
        <div class="calc-res" id="calc-res" aria-live="polite"></div>
      </div>
      <div class="row row-between">
        <div class="chips"><button class="chip ${angle === 'deg' ? 'is-active' : ''}" type="button" data-act="angle" data-v="deg">درجات</button><button class="chip ${angle === 'rad' ? 'is-active' : ''}" type="button" data-act="angle" data-v="rad">راديان</button></div>
        <button class="btn btn-sm btn-ghost" type="button" data-act="copy">نسخ النتيجة</button>
      </div>
      <div class="calc-sci">${SCI.map(([v, l]) => html`<button class="ck ck-fn" type="button" data-ins="${v}">${l}</button>`)}</div>
      <div class="calc-pad">${PAD.map(([l, k]) => html`<button class="ck ${k ? `ck-${k}` : ''}" type="button" ${['AC', '⌫', '=', 'ANS'].includes(l) ? html`data-key="${l}"` : html`data-ins="${l}"`}>${l}</button>`)}</div>
      ${history.length ? html`<div class="section-label">السجل (اضغط لإعادة الاستخدام)</div><div class="calc-hist card card-flat" style="padding:6px 10px">${history.map((h, i) => html`<button type="button" data-hist="${i}"><span>${h.e}</span><b>= ${h.r}</b></button>`)}</div>` : ''}
      <p class="muted tiny" style="text-align:center">يمكنك الكتابة بلوحة المفاتيح مباشرة. الضرب الضمني مدعوم: 2π ، 3(4+1).</p>
    </div>`);
    update();
  };

  function update(commit = false) {
    const out = root.querySelector('#calc-res');
    if (!out) return;
    out.classList.remove('is-err');
    if (!expr.trim()) { out.textContent = ''; return; }
    try {
      const v = evaluate(expr, { angle, ans: ans ?? undefined });
      out.textContent = formatResult(v);
      if (commit) { ans = v; history.unshift({ e: expr, r: formatResult(v) }); history = history.slice(0, 20); expr = formatResult(v); draw(); }
    } catch (e) {
      if (commit) { out.classList.add('is-err'); out.textContent = e instanceof MathError ? e.message : 'خطأ في العملية'; }
      else out.textContent = '';
    }
  }

  const input = () => root.querySelector('#calc-expr');
  const insert = (txt) => {
    const el = input();
    const s = el.selectionStart ?? expr.length;
    const e = el.selectionEnd ?? expr.length;
    expr = expr.slice(0, s) + txt + expr.slice(e);
    el.value = expr;
    const pos = s + txt.length;
    el.setSelectionRange(pos, pos);
    update();
  };

  const off = delegate(root, 'click', 'button', (e, el) => {
    if (el.dataset.ins !== undefined) { insert(el.dataset.ins.replace('×', '*').replace('÷', '/').replace('−', '-')); return; }
    if (el.dataset.key === 'AC') { expr = ''; input().value = ''; update(); }
    else if (el.dataset.key === '⌫') {
      const inp = input(); const s = inp.selectionStart ?? expr.length;
      if (inp.selectionStart !== inp.selectionEnd) { insert(''); return; }
      if (s > 0) { expr = expr.slice(0, s - 1) + expr.slice(s); inp.value = expr; inp.setSelectionRange(s - 1, s - 1); update(); }
    }
    else if (el.dataset.key === 'ANS') insert('ans');
    else if (el.dataset.key === '=') update(true);
    else if (el.dataset.act === 'angle') { angle = el.dataset.v; draw(); }
    else if (el.dataset.act === 'copy') { const r = root.querySelector('#calc-res').textContent; if (r) copyText(r, 'تم نسخ النتيجة'); }
    else if (el.dataset.hist !== undefined) { expr = history[Number(el.dataset.hist)].e; draw(); }
  });
  const onInput = (e) => { if (e.target.id === 'calc-expr') { expr = e.target.value; update(); } };
  const onKey = (e) => { if (e.target.id === 'calc-expr' && e.key === 'Enter') { e.preventDefault(); update(true); } };
  root.addEventListener('input', onInput);
  root.addEventListener('keydown', onKey);
  draw();
  return () => { off(); root.removeEventListener('input', onInput); root.removeEventListener('keydown', onKey); };
}
