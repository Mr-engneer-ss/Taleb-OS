// محررات HTML / CSS / JavaScript مع معاينة حية في بيئة معزولة (sandbox).
// - HTML و CSS: داخل iframe بصلاحية allow-scripts فقط (بدون allow-same-origin) فلا تصل الشيفرة إلى بياناتك.
// - JavaScript: داخل Web Worker يُنهى تلقائيًا بعد 5 ثوانٍ لحمايتك من الحلقات اللانهائية.

import { html, render, esc } from '../lib/html.js';
import { delegate, copyText, debounce, toast } from '../lib/ui.js';
import { icon } from '../lib/icons.js';

const KEY = 'studentos.lab.v1';
const DEFAULTS = {
  html: '<h1>مرحبًا بك 👋</h1>\n<p>عدّل هذا الكود وشاهد النتيجة مباشرة.</p>\n<button onclick="this.textContent=\'تم الضغط!\'">اضغط هنا</button>\n',
  csshtml: '<div class="card">\n  <h2>بطاقة تجريبية</h2>\n  <p>غيّر أنماط CSS لترى التأثير.</p>\n  <button>زر</button>\n</div>\n',
  css: 'body {\n  font-family: system-ui, sans-serif;\n  background: #0f1932;\n  display: grid;\n  place-items: center;\n  min-height: 100vh;\n  margin: 0;\n}\n.card {\n  background: #fff;\n  color: #0e1a3a;\n  padding: 24px;\n  border-radius: 18px;\n  box-shadow: 0 10px 30px rgba(0,0,0,.35);\n  text-align: center;\n}\nbutton {\n  background: #2f6fe8;\n  color: #fff;\n  border: 0;\n  padding: 10px 18px;\n  border-radius: 10px;\n}\n',
  js: '// اكتب JavaScript هنا ثم اضغط «تشغيل»\nconst nums = [3, 7, 1, 9];\nconsole.log("المجموع:", nums.reduce((a, b) => a + b, 0));\nconsole.log("الأكبر:", Math.max(...nums));\n\nfunction fact(n) { return n <= 1 ? 1 : n * fact(n - 1); }\nfact(5); // آخر قيمة تُعرض تلقائيًا\n',
};

function load() {
  try { const o = JSON.parse(localStorage.getItem(KEY)); if (o && typeof o === 'object') return { ...DEFAULTS, ...o }; } catch { /* تجاهل */ }
  return { ...DEFAULTS };
}
const save = debounce((s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* تجاهل */ } }, 500);

const noScriptClose = (s) => s.replace(/<\/(script)/gi, '<\\/$1');
const BASE = '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';

function previewDoc(mode, s) {
  if (mode === 'html') {
    return /<html[\s>]/i.test(s.html) ? s.html : `<!doctype html><html lang="ar" dir="rtl"><head>${BASE}<style>body{font-family:system-ui,sans-serif;padding:16px;line-height:1.7}</style></head><body>${s.html}</body></html>`;
  }
  return `<!doctype html><html lang="ar" dir="rtl"><head>${BASE}<style>${s.css.replace(/<\/style/gi, '<\\/style')}</style></head><body>${s.csshtml}</body></html>`;
}

const WORKER_SRC = `
const fmt = (v) => { if (typeof v === 'string') return v; if (v === undefined) return 'undefined'; if (typeof v === 'function') return String(v);
  try { return JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x + 'n' : x), 2) ?? String(v); } catch { return String(v); } };
const send = (level, args) => postMessage({ level, text: args.map(fmt).join(' ') });
const console = { log: (...a) => send('log', a), info: (...a) => send('log', a), warn: (...a) => send('warn', a), error: (...a) => send('err', a) };
onmessage = async (e) => {
  try {
    const r = (0, eval)(e.data);
    const v = r instanceof Promise ? await r : r;
    if (v !== undefined) send('sys', ['⇐ ' + fmt(v)]);
  } catch (err) { send('err', [(err && err.name ? err.name + ': ' : '') + (err && err.message ? err.message : String(err))]); }
  postMessage({ done: true });
};`;

export function mount(root, ctx) {
  const mode = ['html', 'css', 'js'].includes(ctx.params[1]) ? ctx.params[1] : 'html';
  const state = load();
  let worker = null;
  let killTimer = null;

  const title = { html: 'محرر HTML', css: 'محرر CSS', js: 'محرر JavaScript' }[mode];

  const editor = (id, label, key, hint = '') => html`<div class="field"><label class="label" for="${id}">${label}</label>
    <textarea class="code-area" id="${id}" data-key="${key}" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" dir="ltr">${state[key]}</textarea>${hint ? html`<p class="field-hint">${hint}</p>` : ''}</div>`;

  render(root, html`<div class="stack">
    <div class="lab lab-split" style="display:grid;gap:14px">
      <div class="stack">
        ${mode === 'html' ? editor('ed-html', 'كود HTML', 'html') : ''}
        ${mode === 'css' ? html`${editor('ed-csshtml', 'HTML (الهيكل)', 'csshtml')}${editor('ed-css', 'CSS (التنسيق)', 'css')}` : ''}
        ${mode === 'js' ? editor('ed-js', 'كود JavaScript', 'js', 'يُنفَّذ في بيئة معزولة بدون وصول إلى الصفحة (لا document ولا window). للتجارب على الصفحات استخدم محرر HTML.') : ''}
        <div class="row">
          ${mode === 'js' ? html`<button class="btn btn-primary" type="button" data-act="run">${icon('play', { size: 18 })} تشغيل</button><button class="btn btn-ghost" type="button" data-act="clear">مسح الناتج</button>` : html`<button class="btn btn-primary" type="button" data-act="refresh">${icon('refresh', { size: 18 })} تحديث المعاينة</button>`}
          <button class="btn btn-ghost" type="button" data-act="copy">${icon('copy', { size: 16 })} نسخ الكود</button>
          <button class="btn btn-ghost" type="button" data-act="reset">استعادة المثال</button>
        </div>
      </div>
      <div class="stack">
        <div class="section-label">${mode === 'js' ? 'الناتج' : 'المعاينة الحية'}</div>
        ${mode === 'js' ? html`<div class="console" id="console" role="log" aria-live="polite"><div class="sys">اضغط «تشغيل» لتنفيذ الكود. (حد أقصى 5 ثوانٍ)</div></div>`
          : html`<iframe class="preview-frame" id="preview" title="${title}" sandbox="allow-scripts allow-forms allow-modals" referrerpolicy="no-referrer"></iframe>`}
      </div>
    </div>
  </div>`);

  const frame = root.querySelector('#preview');
  const cons = root.querySelector('#console');
  const refresh = () => { if (frame) frame.srcdoc = previewDoc(mode, state); };
  const refreshSoon = debounce(refresh, 450);

  const log = (level, text) => {
    const d = document.createElement('div');
    if (level !== 'log') d.className = level === 'err' ? 'err' : level === 'warn' ? 'warn' : 'sys';
    d.textContent = text;
    cons.appendChild(d);
    cons.scrollTop = cons.scrollHeight;
    while (cons.children.length > 300) cons.firstElementChild.remove();
  };

  function stopWorker() { clearTimeout(killTimer); if (worker) { worker.terminate(); worker = null; } }

  function run() {
    stopWorker();
    cons.textContent = '';
    let url;
    try {
      url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
      worker = new Worker(url);
    } catch (e) { log('err', 'تعذّر تشغيل بيئة التنفيذ في هذا المتصفح.'); return; }
    URL.revokeObjectURL(url);
    const w = worker;
    w.onmessage = (e) => {
      if (e.data && e.data.done) { clearTimeout(killTimer); if (worker === w) { w.terminate(); worker = null; } return; }
      if (e.data) log(e.data.level, e.data.text);
    };
    w.onerror = (e) => { log('err', e.message || 'خطأ غير معروف'); e.preventDefault(); };
    killTimer = setTimeout(() => { if (worker === w) { w.terminate(); worker = null; log('err', '⏱ تم إيقاف التنفيذ بعد 5 ثوانٍ (ربما توجد حلقة لا تنتهي).'); } }, 5000);
    w.postMessage(state.js);
  }

  const onInput = (e) => {
    const key = e.target.dataset && e.target.dataset.key;
    if (!key) return;
    state[key] = e.target.value;
    save(state);
    if (mode !== 'js') refreshSoon();
  };
  const onKey = (e) => {
    if (e.target.classList && e.target.classList.contains('code-area')) {
      if (e.key === 'Tab' && !e.shiftKey) { // إدراج مسافتين بدل التنقل
        e.preventDefault();
        const t = e.target; const s = t.selectionStart;
        t.setRangeText('  ', s, t.selectionEnd, 'end');
        t.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && mode === 'js') { e.preventDefault(); run(); }
    }
  };
  root.addEventListener('input', onInput);
  root.addEventListener('keydown', onKey);

  const off = delegate(root, 'click', '[data-act]', (e, el) => {
    const a = el.dataset.act;
    if (a === 'run') run();
    else if (a === 'clear') cons.textContent = '';
    else if (a === 'refresh') refresh();
    else if (a === 'copy') copyText(mode === 'js' ? state.js : mode === 'html' ? state.html : `${state.csshtml}\n\n<style>\n${state.css}\n</style>`, 'تم نسخ الكود');
    else if (a === 'reset') {
      const keys = mode === 'html' ? ['html'] : mode === 'css' ? ['csshtml', 'css'] : ['js'];
      for (const k of keys) { state[k] = DEFAULTS[k]; const ta = root.querySelector(`[data-key="${k}"]`); if (ta) ta.value = DEFAULTS[k]; }
      save(state); refresh(); toast('تمت استعادة المثال', { duration: 1500 });
    }
  });

  refresh();
  return () => { off(); stopWorker(); refreshSoon.cancel(); root.removeEventListener('input', onInput); root.removeEventListener('keydown', onKey); };
}

export { esc, noScriptClose };
