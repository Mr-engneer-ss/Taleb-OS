// منسّق JSON: تنسيق، ضغط، تحقق مع موضع الخطأ، وترتيب المفاتيح.

import { html, render } from '../lib/html.js';
import { delegate, copyText, downloadFile, debounce } from '../lib/ui.js';
import { parseJSON, sortKeysDeep } from '../lib/toolkit.js';
import { icon } from '../lib/icons.js';

const SAMPLE = '{"الاسم":"أحمد","الصف":"أولى ثانوي","المواد":["رياضيات","فيزياء"],"نشط":true}';

export function mount(root) {
  render(root, html`<div class="stack">
    <div class="field"><label class="label" for="json-in">الصق JSON هنا</label>
      <textarea class="code-area" id="json-in" spellcheck="false" dir="ltr" placeholder='{"key": "value"}'></textarea></div>
    <div class="row">
      <button class="btn btn-primary" type="button" data-act="format">تنسيق</button>
      <button class="btn btn-ghost" type="button" data-act="minify">ضغط</button>
      <button class="btn btn-ghost" type="button" data-act="sort">ترتيب المفاتيح</button>
      <label class="check-row" style="margin-inline-start:6px"><span class="label">المسافة:</span>
        <select class="select" id="json-indent" style="min-height:38px;width:auto"><option value="2">2</option><option value="4">4</option><option value="tab">Tab</option></select></label>
      <button class="btn btn-ghost" type="button" data-act="sample">مثال</button>
    </div>
    <div id="json-status" role="status"></div>
    <div class="row"><button class="btn btn-ghost btn-sm" type="button" data-act="copy">${icon('copy', { size: 15 })} نسخ</button><button class="btn btn-ghost btn-sm" type="button" data-act="download">${icon('download', { size: 15 })} تنزيل .json</button></div>
  </div>`);

  const input = root.querySelector('#json-in');
  const status = root.querySelector('#json-status');

  const setStatus = (ok, msg) => {
    render(status, html`<div class="notice ${ok ? 'notice-ok' : ''}" style="padding:10px 14px"><span>${icon(ok ? 'check' : 'alert', { size: 18 })}</span><div><p>${msg}</p></div></div>`);
  };
  const clearStatus = () => { status.textContent = ''; };
  const indent = () => { const v = root.querySelector('#json-indent').value; return v === 'tab' ? '\t' : Number(v); };

  function apply(kind) {
    const text = input.value;
    if (!text.trim()) { setStatus(false, 'الصق نص JSON أولًا.'); return null; }
    const r = parseJSON(text);
    if (!r.ok) {
      setStatus(false, `JSON غير صالح${r.line ? ` — السطر ${r.line}، العمود ${r.col}` : ''}: ${r.error}`);
      if (r.line) {
        const lines = text.split('\n');
        let pos = 0;
        for (let i = 0; i < r.line - 1; i++) pos += lines[i].length + 1;
        pos += Math.max(0, r.col - 1);
        input.focus(); input.setSelectionRange(pos, Math.min(text.length, pos + 1));
      }
      return null;
    }
    let v = r.value;
    if (kind === 'sort') v = sortKeysDeep(v);
    input.value = kind === 'minify' ? JSON.stringify(v) : JSON.stringify(v, null, indent());
    setStatus(true, `JSON صالح ✓ — ${input.value.length.toLocaleString('en-US')} حرفًا`);
    return input.value;
  }

  const validateLive = debounce(() => {
    if (!input.value.trim()) { clearStatus(); return; }
    const r = parseJSON(input.value);
    if (r.ok) setStatus(true, 'JSON صالح ✓');
    else setStatus(false, `JSON غير صالح${r.line ? ` — السطر ${r.line}، العمود ${r.col}` : ''}`);
  }, 400);
  input.addEventListener('input', validateLive);

  const off = delegate(root, 'click', '[data-act]', (e, el) => {
    const a = el.dataset.act;
    if (a === 'format' || a === 'minify' || a === 'sort') apply(a);
    else if (a === 'sample') { input.value = SAMPLE; apply('format'); }
    else if (a === 'copy') { if (input.value) copyText(input.value, 'تم نسخ النص'); }
    else if (a === 'download') { if (input.value) downloadFile('data.json', input.value, 'application/json;charset=utf-8'); }
  });
  return () => { off(); validateLive.cancel(); };
}
