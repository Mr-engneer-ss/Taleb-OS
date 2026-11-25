// الإعدادات: الملف الشخصي، المظهر، ربط المساعد، النسخ الاحتياطي (تصدير/استيراد/داخلي)، وحذف البيانات.

import { getState, mutate, replaceState, resetState, flushSave, getStorageMeta } from './storage.js';
import { html, render } from './lib/html.js';
import { icon } from './lib/icons.js';
import { delegate, toast, confirmDialog, typedConfirm, openDialog, downloadFile, fileSize, pageHead, options } from './lib/ui.js';
import { buildBackup, validateBackup, countsOf, normalizeState, aiEndpoint, uid } from './lib/schema.js';
import { filesDB, backupsDB } from './lib/db.js';
import { applyTheme } from './lib/theme.js';
import { getInstallState, onInstallChange, promptInstall, storageEstimate, requestPersistence, isStandalone } from './lib/pwa.js';
import { testConnection, aiStatus } from './ai/client.js';
import { timeAgo, formatShort, toKey } from './lib/dates.js';
import { clearTimerStorage } from './lib/timer.js';
import { GRADES, APP, TIMER_KEY, STORAGE_KEY, LIMITS } from './config.js';

/* ───── تحويلات base64 ───── */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('تعذّرت قراءة أحد الملفات.'));
    r.readAsDataURL(blob);
  });
}
function base64ToBlob(b64, type) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

const countsText = (c) => [`${c.subjects} مادة`, `${c.lessons} درس`, `${c.tasks} مهمة`, `${c.events} موعد`, `${c.sessions} جلسة تركيز`, `${c.notes} ملاحظة`, `${c.links} رابط`, `${c.chats} محادثة`].join(' · ');

/* ───── العمليات ───── */
async function createInternalBackup(reason) {
  const state = getState();
  const rec = { id: uid(), createdAt: new Date().toISOString(), reason, counts: countsOf(state), json: JSON.stringify(state) };
  await backupsDB.put(rec);
  const all = (await backupsDB.all()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const old of all.slice(LIMITS.maxInternalBackups)) await backupsDB.remove(old.id);
  return rec;
}

async function exportBackup(includeFiles) {
  flushSave();
  let files = [];
  let skipped = 0;
  if (includeFiles) {
    try {
      for (const f of await filesDB.all()) {
        try { files.push({ id: f.id, name: f.name, type: f.type, category: f.category, createdAt: f.createdAt, dataBase64: await blobToBase64(f.blob) }); }
        catch { skipped++; }
      }
    } catch (e) { toast(`تعذّر تضمين الملفات: ${e.message}`, { type: 'error', duration: 6000 }); files = []; }
  }
  const backup = buildBackup(getState(), files, APP.version);
  const name = `student-os-backup-${toKey(new Date())}.json`;
  downloadFile(name, JSON.stringify(backup), 'application/json;charset=utf-8');
  toast(`تم تصدير النسخة (${files.length} ملف)${skipped ? ` — تعذّر ${skipped}` : ''}`, { type: 'success' });
}

async function applyImport(res) {
  try { await createInternalBackup('قبل الاستيراد'); } catch { /* غير حرج */ }
  const ok = replaceState(res.state);
  if (!ok) throw new Error('تعذّر حفظ البيانات المستوردة (مساحة التخزين ممتلئة؟). لم يتغيّر شيء مهم: يمكنك التراجع من النسخ الداخلية.');
  // لا نمسّ الملفات الحالية إلا إذا كانت النسخة تتضمن ملفات (حتى لا يضيع شيء عند استيراد نسخة بدون ملفات)
  if (res.files.length > 0) {
    try {
      await filesDB.clear();
      for (const f of res.files) await filesDB.put({ id: f.id, name: f.name, type: f.type, size: 0, category: f.category, createdAt: f.createdAt, blob: base64ToBlob(f.dataBase64, f.type) });
    } catch (e) { toast(`تم استيراد البيانات لكن تعذّرت الملفات: ${e.message}`, { type: 'error', duration: 7000 }); }
  }
  applyTheme(getState().settings.theme);
  window.dispatchEvent(new CustomEvent('studentos:theme'));
}

async function pickAndImport() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) { toast('الملف كبير جدًا.', { type: 'error' }); return; }
    let obj;
    try { obj = JSON.parse(await file.text()); } catch { toast('الملف ليس JSON صالحًا — لم يتغيّر شيء.', { type: 'error', duration: 6000 }); return; }
    const res = validateBackup(obj);
    if (!res.ok) { toast(res.error, { type: 'error', duration: 7000 }); return; }
    const cur = countsOf(getState());
    const dlg = openDialog({
      title: 'استيراد نسخة احتياطية',
      body: html`<div class="stack">
        <div class="notice notice-ok" style="padding:10px 14px"><span>${icon('check', { size: 18 })}</span><div><p>الملف صالح${res.exportedAt ? ` — صُدّر ${timeAgo(res.exportedAt)}` : ''}.</p></div></div>
        <div class="kv"><span>محتوى النسخة</span><span style="text-align:end">${countsText(res.counts)}${res.files.length ? ` · ${res.files.length} ملف` : ''}</span></div>
        <div class="kv"><span>بياناتك الحالية</span><span style="text-align:end">${countsText(cur)}</span></div>
        ${res.dropped || res.droppedFiles ? html`<p class="muted small">تم تجاهل ${res.dropped + res.droppedFiles} عنصرًا تالفًا أو غير صالح داخل الملف.</p>` : ''}
        <p class="small" style="color:var(--warning)">سيتم <b>استبدال</b> بياناتك الحالية بمحتوى النسخة. تُحفظ نسخة داخلية تلقائيًا قبل الاستبدال لتتمكن من التراجع.</p>
      </div>`,
      footer: html`<button class="btn btn-ghost" type="button" data-dlg-close>إلغاء</button><button class="btn btn-primary" type="button" id="do-import">استبدال واستيراد</button>`,
    });
    dlg.el.querySelector('#do-import').addEventListener('click', async (ev) => {
      ev.target.disabled = true;
      try { await applyImport(res); dlg.close(); toast('تم الاستيراد بنجاح', { type: 'success' }); location.reload(); }
      catch (e) { ev.target.disabled = false; toast(e.message, { type: 'error', duration: 8000 }); }
    });
  });
  input.click();
}

async function deleteEverything() {
  const ok = await typedConfirm({ title: 'حذف كل البيانات', message: 'سيتم حذف كل شيء من هذا الجهاز نهائيًا: المنهج والمهام والجلسات والملاحظات والروابط والملفات والمحادثات والإعدادات والنسخ الداخلية. لا يمكن التراجع. يُنصح بتصدير نسخة احتياطية أولًا.', word: 'حذف', confirmText: 'حذف كل شيء' });
  if (!ok) return;
  const failures = [];
  try { clearTimerStorage(); } catch { /* تجاهل */ }
  resetState();
  try { await filesDB.clear(); } catch (e) { failures.push('الملفات'); }
  try { await backupsDB.clear(); } catch (e) { failures.push('النسخ الداخلية'); }
  try { localStorage.removeItem('studentos.lab.v1'); localStorage.removeItem(`${STORAGE_KEY}.corrupt`); localStorage.removeItem(TIMER_KEY); } catch { /* تجاهل */ }
  if (failures.length) toast(`حُذفت البيانات الأساسية، وتعذّر حذف: ${failures.join('، ')}`, { type: 'error', duration: 7000 });
  else toast('تم حذف كل البيانات', { type: 'success' });
  setTimeout(() => { location.hash = '#/dashboard'; location.reload(); }, 700);
}

/* ───── الأقسام ───── */
function profileCard(s) {
  return html`<section class="card" id="sec-profile"><div class="card-head"><h3 class="card-title">${icon('user')} الملف الشخصي</h3></div>
    <form class="form" data-form="profile"><div class="form-grid">
      <div class="field"><label class="label" for="s-name">الاسم</label><input class="input" id="s-name" name="name" value="${s.name}" maxlength="40" autocomplete="given-name" placeholder="اسمك"></div>
      <div class="field"><label class="label" for="s-grade">الصف الدراسي</label><select class="select" id="s-grade" name="grade">${options(GRADES.map((g) => ({ value: g, label: g })), s.grade)}</select></div>
    </div><div><button class="btn btn-primary" type="submit">حفظ</button></div></form></section>`;
}

function appearanceCard(s) {
  return html`<section class="card" id="sec-appearance"><div class="card-head"><h3 class="card-title">${icon('moon')} المظهر</h3></div>
    <div class="chips" role="radiogroup" aria-label="المظهر">
      <button class="chip ${s.theme === 'dark' ? 'is-active' : ''}" type="button" role="radio" aria-checked="${s.theme === 'dark'}" data-theme="dark">${icon('moon', { size: 15 })} داكن (الافتراضي)</button>
      <button class="chip ${s.theme === 'light' ? 'is-active' : ''}" type="button" role="radio" aria-checked="${s.theme === 'light'}" data-theme="light">${icon('sun', { size: 15 })} فاتح</button>
    </div></section>`;
}

function aiCard(s) {
  const st = aiStatus(s);
  return html`<section class="card" id="sec-ai"><div class="card-head"><h3 class="card-title">${icon('sparkles')} ربط المساعد الذكي</h3><span class="badge ${st.ready ? 'badge-success' : 'badge-warning'}">${st.ready ? 'مربوط' : 'غير مربوط'}</span></div>
    <p class="muted small" style="margin-bottom:12px">يتصل المساعد بخدمة ذكاء اصطناعي عبر <b>خادم وسيط</b> تنشره أنت أو جهة موثوقة. المفتاح السري يبقى في الخادم الوسيط ولا يُكتب هنا أبدًا. التفاصيل في ملف <span class="ltr">docs/ai-proxy-example.md</span> داخل المشروع.</p>
    <form class="form" data-form="ai"><div class="form-grid">
      <div class="field field-full"><label class="label" for="ai-url">رابط الخدمة (Endpoint)</label><input class="input input-ltr" id="ai-url" name="endpoint" type="url" value="${s.ai.endpoint}" placeholder="https://your-worker.example.workers.dev/chat" autocomplete="off" spellcheck="false"><p class="field-hint">يجب أن يبدأ بـ https:// (أو http://localhost للتجربة المحلية).</p></div>
      <div class="field field-full"><label class="label" for="ai-model">اسم النموذج (اختياري)</label><input class="input input-ltr" id="ai-model" name="model" value="${s.ai.model}" maxlength="80" autocomplete="off" spellcheck="false"></div>
    </div>
    <div class="row"><button class="btn btn-primary" type="submit">حفظ</button><button class="btn btn-ghost" type="button" data-act="ai-test" ${st.ready ? '' : html`disabled`}>اختبار الاتصال</button><button class="btn btn-ghost" type="button" data-act="ai-clear" ${s.ai.endpoint ? '' : html`disabled`}>فصل المزود</button></div>
    <p class="field-hint" id="ai-test-out" role="status"></p></form></section>`;
}

function dataCard(backups, storage, files) {
  return html`<section class="card" id="sec-data"><div class="card-head"><h3 class="card-title">${icon('database')} النسخ الاحتياطي والبيانات</h3></div>
    <p class="muted small" style="margin-bottom:12px">كل بياناتك محفوظة على هذا الجهاز فقط وتُحفظ تلقائيًا. صدّر نسخة احتياطية بانتظام لحمايتها من فقدان الجهاز أو مسح بيانات المتصفح.</p>
    <div class="stack">
      <label class="check-row"><input type="checkbox" id="exp-files" checked><span>تضمين الملفات المرفوعة في مكتبتي (${files} ملف) — قد يكبر حجم النسخة</span></label>
      <div class="row"><button class="btn btn-primary" type="button" data-act="export">${icon('download', { size: 18 })} تصدير نسخة احتياطية (JSON)</button><button class="btn btn-ghost" type="button" data-act="import">${icon('upload', { size: 18 })} استيراد / استعادة من ملف</button></div>
      <hr class="divider">
      <div class="row row-between"><strong class="small">النسخ الداخلية على الجهاز (آخر ${LIMITS.maxInternalBackups})</strong><button class="btn btn-ghost btn-sm" type="button" data-act="snapshot">إنشاء نسخة الآن</button></div>
      <p class="field-hint">النسخ الداخلية لا تتضمن الملفات المرفوعة، وتُحذف إن مسحت بيانات المتصفح؛ لذا لا تغني عن التصدير.</p>
      ${backups.length === 0 ? html`<p class="muted small">لا نسخ داخلية بعد.</p>` : html`<div class="list">${backups.map((b) => html`<div class="list-item"><div class="list-main"><div class="list-title">${b.reason || 'نسخة يدوية'} · ${timeAgo(b.createdAt)}</div><div class="list-sub"><span>${countsText(b.counts)}</span></div></div>
        <button class="btn btn-sm btn-ghost" type="button" data-act="restore" data-id="${b.id}">استعادة</button>
        <button class="icon-btn icon-btn-sm is-danger" type="button" data-act="del-backup" data-id="${b.id}" aria-label="حذف النسخة">${icon('trash', { size: 16 })}</button></div>`)}</div>`}
      <hr class="divider">
      <div class="kv"><span>حجم البيانات الأساسية</span><b>${fileSize(storage.meta.bytes * 2)}</b></div>
      ${storage.est ? html`<div class="kv"><span>المساحة المستخدمة (المتصفح)</span><b>${fileSize(storage.est.usage)} من ${fileSize(storage.est.quota)}</b></div>` : ''}
      <div class="kv"><span>آخر حفظ تلقائي</span><b>${storage.meta.lastSavedAt ? timeAgo(storage.meta.lastSavedAt) : 'عند أول تعديل'}</b></div>
      <div class="row"><button class="btn btn-ghost btn-sm" type="button" data-act="persist">طلب تخزين دائم</button><span class="muted tiny" id="persist-out" role="status"></span></div>
    </div></section>`;
}

function appCard() {
  const inst = getInstallState();
  return html`<section class="card" id="sec-app"><div class="card-head"><h3 class="card-title">${icon('download')} التطبيق</h3></div>
    <div class="stack">
      <div class="kv"><span>الإصدار</span><b class="ltr">${APP.version}</b></div>
      <div class="kv"><span>الحالة</span><b>${navigator.onLine ? 'متصل' : 'غير متصل'}</b></div>
      <div class="kv"><span>وضع التشغيل</span><b>${isStandalone() ? 'تطبيق مثبّت' : 'داخل المتصفح'}</b></div>
      ${inst.installed ? '' : inst.canPrompt ? html`<button class="btn btn-primary" type="button" data-act="install">${icon('download', { size: 18 })} تثبيت التطبيق على جهازك</button>`
        : html`<p class="muted small">${inst.ios ? 'للتثبيت على iPhone: اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».' : 'للتثبيت على أندرويد: من قائمة Chrome (⋮) اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». يظهر الخيار بعد فتح التطبيق عبر https.'}</p>`}
    </div></section>`;
}

function dangerCard() {
  return html`<section class="card" id="sec-danger" style="border-color:color-mix(in srgb,var(--danger) 45%,transparent)"><div class="card-head"><h3 class="card-title" style="color:var(--danger)">${icon('alert')} منطقة الخطر</h3></div>
    <p class="muted small" style="margin-bottom:12px">حذف كل بياناتك من هذا الجهاز. تُطلب منك كتابة كلمة تأكيد.</p>
    <button class="btn btn-danger" type="button" data-act="wipe">${icon('trash', { size: 18 })} حذف كل البيانات</button></section>`;
}

export async function mount(root, ctx) {
  let backups = [];
  let est = null;
  let fileCount = 0;
  let dbError = '';

  async function refreshData() {
    try { backups = (await backupsDB.all()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); dbError = ''; } catch (e) { backups = []; dbError = e.message; }
    try { fileCount = (await filesDB.all()).length; } catch { fileCount = 0; }
    est = await storageEstimate();
  }

  function draw() {
    const s = getState().settings;
    render(root, html`<div class="page">
      ${pageHead({ title: 'الإعدادات', subtitle: 'تحكم في بياناتك ومظهر التطبيق' })}
      ${dbError ? html`<div class="notice"><span>${icon('alert')}</span><div><h4>التخزين المتقدم غير متاح</h4><p>${dbError} — الملفات والنسخ الداخلية لن تعمل، لكن بقية التطبيق سليم.</p></div></div>` : ''}
      <div class="grid grid-2">
        <div class="stack">${profileCard(s)}${appearanceCard(s)}${aiCard(s)}${appCard()}</div>
        <div class="stack">${dataCard(backups, { meta: getStorageMeta(), est }, fileCount)}${dangerCard()}</div>
      </div>
      <p class="muted tiny" style="text-align:center">STUDENT OS ${APP.version} — لا حسابات ولا تتبّع. بياناتك لا تغادر جهازك إلا إذا ربطت مساعدًا (ما ترسله له) أو صدّرت نسخة بنفسك.</p>
    </div>`);
  }

  await refreshData();
  draw();
  const target = ctx.query.get('section');
  if (target) setTimeout(() => { const el = root.querySelector(`#sec-${target}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);

  const unsubInstall = onInstallChange(() => draw());
  const aiAbort = { c: null };

  const off = delegate(root, 'click', '[data-theme],[data-act]', async (e, el) => {
    if (el.dataset.theme) {
      applyTheme(el.dataset.theme);
      mutate((s) => { s.settings.theme = el.dataset.theme; });
      window.dispatchEvent(new CustomEvent('studentos:theme'));
      draw();
      return;
    }
    const a = el.dataset.act;
    try {
      if (a === 'export') await exportBackup(root.querySelector('#exp-files').checked);
      else if (a === 'import') await pickAndImport();
      else if (a === 'snapshot') { await createInternalBackup('نسخة يدوية'); toast('تم إنشاء نسخة داخلية', { type: 'success' }); await refreshData(); draw(); }
      else if (a === 'restore') {
        const b = backups.find((x) => x.id === el.dataset.id);
        if (!b) return;
        if (!(await confirmDialog({ title: 'استعادة نسخة داخلية', message: `سيتم استبدال بياناتك الحالية بنسخة (${countsText(b.counts)}). تُحفظ نسخة من حالتك الحالية أولًا. الملفات المرفوعة لا تتأثر.`, confirmText: 'استعادة', danger: true }))) return;
        let parsed;
        try { parsed = JSON.parse(b.json); } catch { toast('هذه النسخة تالفة ولا يمكن استعادتها.', { type: 'error' }); return; }
        await createInternalBackup('قبل الاستعادة');
        if (!replaceState(normalizeState(parsed).state)) { toast('تعذّر حفظ البيانات المستعادة.', { type: 'error' }); return; }
        applyTheme(getState().settings.theme);
        toast('تمت الاستعادة', { type: 'success' });
        setTimeout(() => location.reload(), 500);
      }
      else if (a === 'del-backup') { await backupsDB.remove(el.dataset.id); await refreshData(); draw(); }
      else if (a === 'wipe') await deleteEverything();
      else if (a === 'persist') { const r = await requestPersistence(); root.querySelector('#persist-out').textContent = { granted: 'تم منح التخزين الدائم ✓', already: 'التخزين الدائم مفعّل بالفعل ✓', denied: 'لم يمنحه المتصفح (يُمنح عادةً للتطبيقات المثبّتة)', unsupported: 'غير مدعوم في هذا المتصفح' }[r]; }
      else if (a === 'install') { await promptInstall(); }
      else if (a === 'ai-clear') { mutate((s) => { s.settings.ai.endpoint = ''; s.settings.ai.model = ''; }); toast('تم فصل المزود', { duration: 1800 }); draw(); }
      else if (a === 'ai-test') {
        const out = root.querySelector('#ai-test-out');
        out.textContent = 'جارٍ الاختبار...';
        el.disabled = true;
        const ctrl = new AbortController(); aiAbort.c = ctrl;
        try { const t = await testConnection(getState().settings, ctrl.signal); out.textContent = `✓ ردّت الخدمة: «${t.slice(0, 80)}»`; out.style.color = 'var(--success)'; }
        catch (err) { out.textContent = `✗ ${err.message}`; out.style.color = 'var(--danger)'; }
        finally { el.disabled = false; aiAbort.c = null; }
      }
    } catch (err) {
      toast(err && err.message ? err.message : 'حدث خطأ غير متوقع.', { type: 'error', duration: 6000 });
    }
  });

  const onSubmit = (e) => {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    const fd = new FormData(form);
    if (form.dataset.form === 'profile') {
      mutate((s) => { s.settings.name = String(fd.get('name') || '').trim().slice(0, 40); s.settings.grade = GRADES.includes(fd.get('grade')) ? fd.get('grade') : GRADES[0]; });
      toast('تم حفظ الملف الشخصي', { type: 'success', duration: 1800 });
    } else if (form.dataset.form === 'ai') {
      const raw = String(fd.get('endpoint') || '').trim();
      const url = aiEndpoint(raw);
      if (raw && !url) { toast('رابط غير صالح: استخدم https:// (أو http://localhost).', { type: 'error', duration: 5000 }); return; }
      mutate((s) => { s.settings.ai.endpoint = url; s.settings.ai.model = String(fd.get('model') || '').trim().slice(0, 80); });
      toast(url ? 'تم حفظ إعدادات الربط. جرّب «اختبار الاتصال».' : 'تم الحفظ (لا يوجد مزود مربوط)', { type: 'success' });
      draw();
    }
  };
  root.addEventListener('submit', onSubmit);

  return () => { off(); unsubInstall(); root.removeEventListener('submit', onSubmit); if (aiAbort.c) aiAbort.c.abort(); };
}

export { formatShort };
