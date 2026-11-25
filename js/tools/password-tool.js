// مولّد كلمات مرور عشوائية آمنة (crypto.getRandomValues) — لا تُحفظ ولا تُرسل لأي مكان.

import { html, render } from '../lib/html.js';
import { delegate, copyText } from '../lib/ui.js';
import { generatePassword, strengthLabel } from '../lib/toolkit.js';
import { icon } from '../lib/icons.js';

export function mount(root) {
  const o = { length: 16, lower: true, upper: true, digits: true, symbols: true, avoidAmbiguous: true };
  let current = null;

  render(root, html`<div class="stack" style="max-width:560px;margin-inline:auto;width:100%">
    <div class="card stack">
      <div class="pw-out" id="pw" aria-live="polite">—</div>
      <div><div class="meter"><i id="pw-meter" style="width:0"></i></div><div class="row row-between small" style="margin-top:6px"><span id="pw-strength" class="muted"></span><span id="pw-bits" class="muted ltr"></span></div></div>
      <div class="row"><button class="btn btn-primary" type="button" data-act="gen">${icon('refresh', { size: 18 })} توليد جديدة</button><button class="btn btn-ghost" type="button" data-act="copy">${icon('copy', { size: 16 })} نسخ</button></div>
    </div>
    <div class="card stack">
      <div class="field"><label class="label" for="pw-len">الطول: <b id="pw-len-v" class="num">${o.length}</b></label><input type="range" id="pw-len" min="8" max="64" value="${o.length}"></div>
      ${[['lower', 'أحرف صغيرة (a-z)'], ['upper', 'أحرف كبيرة (A-Z)'], ['digits', 'أرقام (0-9)'], ['symbols', 'رموز (!@#$...)'], ['avoidAmbiguous', 'تجنّب الأحرف المتشابهة (O 0 l 1 I)']].map(([k, l]) => html`<label class="check-row"><input type="checkbox" data-opt="${k}" ${o[k] ? html`checked` : ''}><span>${l}</span></label>`)}
    </div>
    <p class="muted tiny" style="text-align:center">تُولَّد الكلمة على جهازك فقط باستخدام مولّد عشوائي آمن تشفيريًا، ولا تُخزَّن في أي مكان.</p>
  </div>`);

  const gen = () => {
    try {
      current = generatePassword(o);
      const s = strengthLabel(current.entropyBits);
      root.querySelector('#pw').textContent = current.password;
      const m = root.querySelector('#pw-meter'); m.style.width = `${s.pct}%`; m.style.background = s.color;
      root.querySelector('#pw-strength').textContent = `القوة: ${s.label}`;
      root.querySelector('#pw-bits').textContent = `≈ ${current.entropyBits} bits`;
    } catch (e) {
      current = null;
      root.querySelector('#pw').textContent = e.message;
      root.querySelector('#pw-meter').style.width = '0';
      root.querySelector('#pw-strength').textContent = '';
      root.querySelector('#pw-bits').textContent = '';
    }
  };
  const onInput = (e) => { if (e.target.id === 'pw-len') { o.length = Number(e.target.value); root.querySelector('#pw-len-v').textContent = o.length; gen(); } };
  const onChange = (e) => { const k = e.target.dataset && e.target.dataset.opt; if (k) { o[k] = e.target.checked; gen(); } };
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  const off = delegate(root, 'click', '[data-act]', (e, el) => {
    if (el.dataset.act === 'gen') gen();
    else if (el.dataset.act === 'copy' && current) copyText(current.password, 'تم نسخ كلمة المرور');
  });
  gen();
  return () => { off(); root.removeEventListener('input', onInput); root.removeEventListener('change', onChange); };
}
