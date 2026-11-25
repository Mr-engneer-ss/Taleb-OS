// أدوات معالجة النصوص + أداة تنسيق النص ونسخه (وضعان في وحدة واحدة: ?mode=format).

import { html, render } from '../lib/html.js';
import { delegate, copyText, toast, downloadFile } from '../lib/ui.js';
import { TEXT_OPS, replaceAll, formatText } from '../lib/toolkit.js';
import { icon } from '../lib/icons.js';

export function mount(root, ctx) {
  const fmtMode = ctx.params[1] === 'format';
  render(root, fmtMode ? formatUI() : processUI());
  const ta = root.querySelector('#tt-text');
  const info = root.querySelector('#tt-info');
  const undoStack = [];

  const push = () => { undoStack.push(ta.value); if (undoStack.length > 30) undoStack.shift(); };
  const setText = (t) => { push(); ta.value = t; };

  const off = delegate(root, 'click', '[data-op],[data-act]', (e, el) => {
    if (el.dataset.op) {
      const op = TEXT_OPS.find((x) => x.id === el.dataset.op);
      if (ta.value && op) { setText(op.fn(ta.value)); toast(`تم: ${op.label}`, { duration: 1400 }); }
      return;
    }
    const a = el.dataset.act;
    if (a === 'copy') { if (ta.value) copyText(ta.value, 'تم نسخ النص'); }
    else if (a === 'undo') { if (undoStack.length) ta.value = undoStack.pop(); }
    else if (a === 'clear') { setText(''); ta.focus(); }
    else if (a === 'paste') {
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then((t) => { setText(t); }).catch(() => toast('لم يُسمح بقراءة الحافظة. الصق يدويًا في الحقل.', { type: 'error' }));
      } else toast('المتصفح لا يدعم اللصق المباشر. الصق يدويًا.', { type: 'error' });
    }
    else if (a === 'download') { if (ta.value) downloadFile('text.txt', ta.value); }
    else if (a === 'replace') {
      try {
        const r = replaceAll(ta.value, root.querySelector('#tt-find').value, root.querySelector('#tt-rep').value, { caseSensitive: root.querySelector('#tt-case').checked, regex: root.querySelector('#tt-re').checked });
        if (r.count) setText(r.text);
        info.textContent = r.count ? `تم استبدال ${r.count} موضع` : 'لم يُعثر على النص المطلوب';
      } catch (err) { info.textContent = err.message; }
    }
    else if (a === 'format') {
      if (!ta.value) return;
      const g = (id) => root.querySelector(id).checked;
      setText(formatText(ta.value, { trimLines: g('#f-trim'), dropBlank: g('#f-blank'), collapseBlank: g('#f-collapse'), joinLines: g('#f-join'), style: root.querySelector('#f-style').value }));
      toast('تم التنسيق', { duration: 1400 });
    }
    else if (a === 'format-copy') {
      root.querySelector('[data-act="format"]').click();
      if (ta.value) copyText(ta.value, 'تم التنسيق والنسخ');
    }
  });
  return off;
}

function processUI() {
  return html`<div class="stack">
    <div class="field"><label class="label" for="tt-text">النص</label><textarea class="textarea" id="tt-text" rows="8" maxlength="500000" placeholder="اكتب أو الصق النص هنا ثم اختر عملية..."></textarea></div>
    <div class="row"><button class="btn btn-ghost btn-sm" type="button" data-act="paste">لصق من الحافظة</button><button class="btn btn-ghost btn-sm" type="button" data-act="undo">تراجع</button><button class="btn btn-ghost btn-sm" type="button" data-act="copy">${icon('copy', { size: 14 })} نسخ</button><button class="btn btn-ghost btn-sm" type="button" data-act="download">${icon('download', { size: 14 })} حفظ .txt</button><button class="btn btn-danger-ghost btn-sm" type="button" data-act="clear">مسح</button></div>
    <section class="card"><div class="section-label">عمليات سريعة</div><div class="btn-grid">${TEXT_OPS.map((o) => html`<button class="btn btn-sm btn-ghost" type="button" data-op="${o.id}" style="white-space:normal;line-height:1.4;padding-block:8px">${o.label}</button>`)}</div></section>
    <section class="card stack"><div class="section-label">بحث واستبدال</div>
      <div class="form-grid"><div class="field"><label class="label" for="tt-find">ابحث عن</label><input class="input" id="tt-find"></div><div class="field"><label class="label" for="tt-rep">استبدل بـ</label><input class="input" id="tt-rep"></div></div>
      <div class="row"><label class="check-row"><input type="checkbox" id="tt-case"><span>مطابقة حالة الأحرف</span></label><label class="check-row"><input type="checkbox" id="tt-re"><span>تعبير نمطي (Regex)</span></label></div>
      <div class="row"><button class="btn btn-primary btn-sm" type="button" data-act="replace">استبدال الكل</button><span class="muted small" id="tt-info" role="status"></span></div>
    </section>
  </div>`;
}

function formatUI() {
  return html`<div class="stack">
    <div class="field"><label class="label" for="tt-text">النص المراد تنسيقه</label><textarea class="textarea" id="tt-text" rows="8" maxlength="500000" placeholder="الصق النص المنسوخ من أي مكان..."></textarea></div>
    <section class="card stack"><div class="section-label">خيارات التنسيق</div>
      <label class="check-row"><input type="checkbox" id="f-trim" checked><span>إزالة المسافات الزائدة في الأسطر</span></label>
      <label class="check-row"><input type="checkbox" id="f-collapse" checked><span>دمج الأسطر الفارغة المتتالية في سطر واحد</span></label>
      <label class="check-row"><input type="checkbox" id="f-blank"><span>حذف كل الأسطر الفارغة</span></label>
      <label class="check-row"><input type="checkbox" id="f-join"><span>دمج كل الأسطر في فقرة واحدة</span></label>
      <div class="field"><label class="label" for="f-style">شكل الأسطر</label><select class="select" id="f-style"><option value="none">كما هي</option><option value="bullets">نقاط •</option><option value="dash">شرطات -</option><option value="numbered">ترقيم 1. 2. 3.</option><option value="quote">اقتباس &gt;</option><option value="code">كتلة كود (Markdown)</option></select></div>
      <div class="row"><button class="btn btn-primary" type="button" data-act="format">تنسيق</button><button class="btn btn-ghost" type="button" data-act="format-copy">${icon('copy', { size: 16 })} تنسيق ونسخ</button><button class="btn btn-ghost" type="button" data-act="undo">تراجع</button></div>
    </section>
    <div class="row"><button class="btn btn-ghost btn-sm" type="button" data-act="paste">لصق من الحافظة</button><button class="btn btn-ghost btn-sm" type="button" data-act="copy">${icon('copy', { size: 14 })} نسخ النتيجة</button><button class="btn btn-danger-ghost btn-sm" type="button" data-act="clear">مسح</button></div>
    <span class="muted small" id="tt-info" role="status"></span>
  </div>`;
}
