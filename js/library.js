// مكتبتي: ملاحظات مصنفة، روابط، وملفات (تُحفظ في IndexedDB على الجهاز)، مع بحث موحّد.

import { getState, mutate, pushActivity } from './storage.js';
import { html, render } from './lib/html.js';
import { icon } from './lib/icons.js';
import { delegate, emptyState, formDialog, confirmDialog, toast, pageHead, tabsHtml, fileSize, copyText, downloadFile, debounce } from './lib/ui.js';
import { uid } from './lib/schema.js';
import { filesDB } from './lib/db.js';
import { timeAgo, formatShort, toKey } from './lib/dates.js';
import { LIMITS } from './config.js';

const BASE_CATEGORIES = ['عام', 'ملخصات', 'أسئلة', 'مراجعة', 'أفكار', 'مصادر'];
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[ً-ٰٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
const match = (q, ...fields) => !q || fields.some((f) => norm(f).includes(q));

const categories = (state, kind) => {
  const set = new Set(kind === 'notes' ? BASE_CATEGORIES : ['عام']);
  const list = kind === 'notes' ? state.notes : kind === 'links' ? state.links : [];
  for (const x of list) set.add(x.category);
  return [...set];
};

function fileIcon(type) {
  if (type.startsWith('image/')) return 'image';
  if (type === 'application/pdf') return 'file';
  return 'file';
}

export async function mount(root, ctx) {
  const ui = { tab: ['notes', 'links', 'files'].includes(ctx.query.get('tab')) ? ctx.query.get('tab') : 'notes', q: '', cat: '' };
  let files = [];
  let filesError = '';
  const urls = new Map();

  async function loadFiles() {
    try { files = (await filesDB.all()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); filesError = ''; }
    catch (e) { files = []; filesError = e.message; }
  }
  const thumbUrl = (f) => {
    if (!f.type.startsWith('image/') || !f.blob) return '';
    if (!urls.has(f.id)) urls.set(f.id, URL.createObjectURL(f.blob));
    return urls.get(f.id);
  };
  const revokeAll = () => { for (const u of urls.values()) URL.revokeObjectURL(u); urls.clear(); };

  function catChips(kind, state) {
    const cats = categories(state, kind);
    if (cats.length < 2) return '';
    return html`<div class="chips chips-scroll"><button class="chip ${ui.cat === '' ? 'is-active' : ''}" type="button" data-action="cat" data-cat="">الكل</button>${cats.map((c) => html`<button class="chip ${ui.cat === c ? 'is-active' : ''}" type="button" data-action="cat" data-cat="${c}">${c}</button>`)}</div>`;
  }

  function notesView(state) {
    let list = state.notes.filter((n) => (!ui.cat || n.category === ui.cat) && match(ui.q, n.title, n.body, n.category));
    list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
    if (!state.notes.length) return html`<div class="card">${emptyState({ icon: 'note', title: 'دفتر ملاحظاتك فارغ', text: 'اكتب ملخصات دروسك وأفكارك وصنّفها لتجدها بسرعة.', action: { id: 'add-note', label: 'ملاحظة جديدة', icon: 'plus' } })}</div>`;
    return html`<div class="stack">${catChips('notes', state)}
      ${list.length === 0 ? html`<div class="card"><p class="muted" style="text-align:center">لا نتائج مطابقة.</p></div>` : html`<div class="grid grid-auto">${list.map((n) => html`<button class="card card-link note-card" type="button" data-action="edit-note" data-id="${n.id}">
        <div class="row row-between row-nowrap"><h3 class="ellipsis">${n.pinned ? html`<span style="color:var(--warning)">${icon('pin', { size: 15 })}</span> ` : ''}${n.title}</h3><span class="badge badge-primary">${n.category}</span></div>
        <div class="note-prev">${n.body || 'بلا نص'}</div>
        <div class="muted tiny">${timeAgo(n.updatedAt)}</div></button>`)}</div>`}</div>`;
  }

  function linksView(state) {
    const list = state.links.filter((l) => (!ui.cat || l.category === ui.cat) && match(ui.q, l.title, l.url, l.category)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!state.links.length) return html`<div class="card">${emptyState({ icon: 'link', title: 'لا روابط محفوظة', text: 'احفظ روابط الفيديوهات والمصادر التي تفيدك في المذاكرة.', action: { id: 'add-link', label: 'إضافة رابط', icon: 'plus' } })}</div>`;
    return html`<div class="stack">${catChips('links', state)}<section class="card">${list.length === 0 ? html`<p class="muted">لا نتائج مطابقة.</p>` : html`<div class="list">${list.map((l) => {
      let host = '';
      try { host = new URL(l.url).hostname; } catch { host = ''; }
      return html`<div class="list-item"><span class="stat-ic">${icon('link', { size: 18 })}</span>
        <div class="list-main"><a class="list-title" href="${l.url}" target="_blank" rel="noopener noreferrer" style="color:var(--text)">${l.title}</a><div class="list-sub"><span class="ltr">${host}</span><span class="badge badge-muted">${l.category}</span></div></div>
        <button class="icon-btn icon-btn-sm" type="button" data-action="copy-link" data-id="${l.id}" aria-label="نسخ الرابط">${icon('copy', { size: 17 })}</button>
        <button class="icon-btn icon-btn-sm" type="button" data-action="edit-link" data-id="${l.id}" aria-label="تعديل">${icon('edit', { size: 17 })}</button></div>`;
    })}</div>`}</section></div>`;
  }

  function filesView(state) {
    const cats = [...new Set(['عام', ...files.map((f) => f.category)])];
    const list = files.filter((f) => (!ui.cat || f.category === ui.cat) && match(ui.q, f.name, f.category));
    const total = files.reduce((a, f) => a + (f.size || 0), 0);
    return html`<div class="stack">
      ${filesError ? html`<div class="notice"><span>${icon('alert')}</span><div><h4>تعذّر الوصول لتخزين الملفات</h4><p>${filesError}</p></div></div>` : ''}
      <div class="notice notice-info"><span>${icon('info')}</span><div><p>الملفات تُحفظ على جهازك فقط (لا تُرفع لأي خادم)، وتدخل في النسخة الاحتياطية JSON. الحد الأقصى للملف ${fileSize(LIMITS.maxFileBytes)}. ${files.length ? `المستخدم الآن: ${fileSize(total)}.` : ''}</p></div></div>
      <div class="row"><button class="btn btn-primary" type="button" data-action="add-file">${icon('upload', { size: 18 })} رفع ملفات</button></div>
      ${cats.length > 1 ? html`<div class="chips chips-scroll"><button class="chip ${ui.cat === '' ? 'is-active' : ''}" type="button" data-action="cat" data-cat="">الكل</button>${cats.map((c) => html`<button class="chip ${ui.cat === c ? 'is-active' : ''}" type="button" data-action="cat" data-cat="${c}">${c}</button>`)}</div>` : ''}
      ${files.length === 0 && !filesError ? html`<div class="card">${emptyState({ icon: 'folder', title: 'لا ملفات بعد', text: 'ارفع صورًا أو ملفات PDF أو مستندات لتنظيمها هنا.' })}</div>` :
        html`<section class="card">${list.length === 0 ? html`<p class="muted">لا نتائج مطابقة.</p>` : html`<div class="list">${list.map((f) => html`<div class="list-item">
          <span class="file-ic">${thumbUrl(f) ? html`<img src="${thumbUrl(f)}" alt="">` : icon(fileIcon(f.type), { size: 20 })}</span>
          <div class="list-main"><div class="list-title ellipsis">${f.name}</div><div class="list-sub"><span>${fileSize(f.size)}</span><span>${formatShort(toKey(new Date(f.createdAt)))}</span><span class="badge badge-muted">${f.category}</span></div></div>
          <button class="icon-btn icon-btn-sm" type="button" data-action="open-file" data-id="${f.id}" aria-label="فتح ${f.name}">${icon('external', { size: 17 })}</button>
          <button class="icon-btn icon-btn-sm" type="button" data-action="dl-file" data-id="${f.id}" aria-label="تنزيل ${f.name}">${icon('download', { size: 17 })}</button>
          <button class="icon-btn icon-btn-sm" type="button" data-action="edit-file" data-id="${f.id}" aria-label="تعديل ${f.name}">${icon('edit', { size: 17 })}</button></div>`)}</div>`}</section>`}
    </div>`;
  }

  function draw(keepFocus = false) {
    const state = getState();
    const counts = {
      notes: state.notes.filter((n) => match(ui.q, n.title, n.body, n.category)).length,
      links: state.links.filter((l) => match(ui.q, l.title, l.url, l.category)).length,
      files: files.filter((f) => match(ui.q, f.name, f.category)).length,
    };
    const addAction = ui.tab === 'notes' ? 'add-note' : ui.tab === 'links' ? 'add-link' : 'add-file';
    const addLabel = ui.tab === 'notes' ? 'ملاحظة' : ui.tab === 'links' ? 'رابط' : 'ملف';
    const body = ui.tab === 'notes' ? notesView(state) : ui.tab === 'links' ? linksView(state) : filesView(state);
    render(root, html`<div class="page">
      ${pageHead({ title: 'مكتبتي', subtitle: 'ملاحظاتك وروابطك وملفاتك', actions: html`<button class="btn btn-primary" type="button" data-action="${addAction}">${icon('plus', { size: 18 })} ${addLabel}</button>` })}
      <div class="searchbox">${icon('search', { size: 18 })}<input class="input" id="lib-search" type="search" placeholder="ابحث في كل المكتبة..." value="${ui.q}" aria-label="بحث في المكتبة" autocomplete="off"></div>
      ${tabsHtml([{ id: 'notes', label: 'الملاحظات', icon: 'note', badge: ui.q ? counts.notes : 0 }, { id: 'links', label: 'الروابط', icon: 'link', badge: ui.q ? counts.links : 0 }, { id: 'files', label: 'الملفات', icon: 'folder', badge: ui.q ? counts.files : 0 }], ui.tab)}
      ${body}
    </div>`);
    if (keepFocus) { const s = root.querySelector('#lib-search'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }
  }

  /* ───── ملاحظات ───── */
  const noteFields = (state) => [
    { name: 'title', label: 'العنوان', maxlength: 160, placeholder: 'عنوان الملاحظة' },
    { name: 'category', label: 'التصنيف', list: categories(state, 'notes'), maxlength: 40, hint: 'اختر تصنيفًا موجودًا أو اكتب تصنيفًا جديدًا.' },
    { name: 'body', label: 'المحتوى', type: 'textarea', rows: 10, maxlength: 50000 },
    { name: 'pinned', label: 'تثبيت في الأعلى', type: 'checkbox' },
  ];
  async function addNote() {
    const res = await formDialog({ title: 'ملاحظة جديدة', fields: noteFields(getState()), values: { category: ui.cat || 'عام' }, submitText: 'حفظ الملاحظة', size: 'lg', validate: (v) => (!v.title && !v.body.trim() ? 'اكتب عنوانًا أو محتوى.' : '') });
    if (!res) return;
    const v = res.values;
    const now = new Date().toISOString();
    mutate((s) => { s.notes.push({ id: uid(), title: v.title || 'ملاحظة بدون عنوان', body: v.body, category: v.category || 'عام', pinned: v.pinned, createdAt: now, updatedAt: now }); });
    ui.tab = 'notes'; draw();
  }
  async function editNote(id) {
    const n = getState().notes.find((x) => x.id === id);
    if (!n) return;
    const res = await formDialog({ title: 'تعديل الملاحظة', fields: noteFields(getState()), values: n, deleteText: 'حذف', size: 'lg' });
    if (!res) return;
    if (res.action === 'delete') {
      if (!(await confirmDialog({ title: 'حذف الملاحظة', message: `حذف «${n.title}» نهائيًا؟`, confirmText: 'حذف', danger: true }))) return;
      mutate((s) => { s.notes = s.notes.filter((x) => x.id !== id); });
    } else {
      const v = res.values;
      mutate((s) => { Object.assign(s.notes.find((x) => x.id === id), { title: v.title || 'ملاحظة بدون عنوان', body: v.body, category: v.category || 'عام', pinned: v.pinned, updatedAt: new Date().toISOString() }); });
    }
    draw();
  }

  /* ───── روابط ───── */
  const linkFields = (state) => [
    { name: 'url', label: 'الرابط', type: 'url', required: true, maxlength: 2000, placeholder: 'https://...' },
    { name: 'title', label: 'العنوان (اختياري)', maxlength: 160 },
    { name: 'category', label: 'التصنيف', list: categories(state, 'links'), maxlength: 40 },
  ];
  const checkUrl = (v) => { try { const u = new URL(v.url); return u.protocol === 'http:' || u.protocol === 'https:' ? '' : 'الرابط يجب أن يبدأ بـ http أو https.'; } catch { return 'الرابط غير صالح. مثال: https://example.com'; } };
  async function addLink() {
    const res = await formDialog({ title: 'رابط جديد', fields: linkFields(getState()), values: { category: ui.cat || 'عام' }, validate: checkUrl, submitText: 'حفظ الرابط' });
    if (!res) return;
    const v = res.values; const url = new URL(v.url).href;
    mutate((s) => { s.links.push({ id: uid(), url, title: v.title || url, category: v.category || 'عام', createdAt: new Date().toISOString() }); });
    ui.tab = 'links'; draw();
  }
  async function editLink(id) {
    const l = getState().links.find((x) => x.id === id);
    if (!l) return;
    const res = await formDialog({ title: 'تعديل الرابط', fields: linkFields(getState()), values: l, validate: checkUrl, deleteText: 'حذف' });
    if (!res) return;
    if (res.action === 'delete') mutate((s) => { s.links = s.links.filter((x) => x.id !== id); });
    else { const v = res.values; const url = new URL(v.url).href; mutate((s) => { Object.assign(s.links.find((x) => x.id === id), { url, title: v.title || url, category: v.category || 'عام' }); }); }
    draw();
  }

  /* ───── ملفات ───── */
  async function addFiles() {
    const input = document.createElement('input');
    input.type = 'file'; input.multiple = true;
    input.addEventListener('change', async () => {
      let ok = 0; const errs = [];
      for (const f of input.files) {
        if (f.size > LIMITS.maxFileBytes) { errs.push(`«${f.name}» أكبر من ${fileSize(LIMITS.maxFileBytes)}`); continue; }
        try {
          await filesDB.put({ id: uid(), name: f.name.slice(0, 200), type: f.type || 'application/octet-stream', size: f.size, category: ui.cat || 'عام', createdAt: new Date().toISOString(), blob: f });
          ok++;
        } catch (e) { errs.push(`«${f.name}»: ${e.message}`); }
      }
      if (ok) { mutate((s) => pushActivity(s, 'library', `أضفت ${ok} ملف إلى مكتبتي`)); toast(`تم رفع ${ok} ملف`, { type: 'success' }); }
      if (errs.length) toast(errs.join(' — '), { type: 'error', duration: 7000 });
      await loadFiles(); ui.tab = 'files'; draw();
    });
    input.click();
  }
  const getFile = (id) => files.find((f) => f.id === id);
  async function editFile(id) {
    const f = getFile(id);
    if (!f) return;
    const res = await formDialog({ title: 'تعديل الملف', fields: [{ name: 'name', label: 'اسم الملف', required: true, maxlength: 200 }, { name: 'category', label: 'التصنيف', list: [...new Set(['عام', ...files.map((x) => x.category)])], maxlength: 40 }], values: f, deleteText: 'حذف الملف' });
    if (!res) return;
    try {
      if (res.action === 'delete') {
        if (!(await confirmDialog({ title: 'حذف الملف', message: `حذف «${f.name}» من جهازك نهائيًا؟`, confirmText: 'حذف', danger: true }))) return;
        await filesDB.remove(id);
        if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
      } else {
        await filesDB.put({ ...f, name: res.values.name, category: res.values.category || 'عام' });
      }
    } catch (e) { toast(e.message, { type: 'error' }); }
    await loadFiles(); draw();
  }

  await loadFiles();
  draw();

  const doSearch = debounce((v) => { ui.q = norm(v.trim()); draw(true); }, 180);
  const onInput = (e) => { if (e.target.id === 'lib-search') { ui.qRaw = e.target.value; doSearch(e.target.value); } };
  root.addEventListener('input', onInput);

  const off = delegate(root, 'click', '[data-action],[data-tab]', async (e, el) => {
    if (el.dataset.tab) { ui.tab = el.dataset.tab; ui.cat = ''; draw(); return; }
    const a = el.dataset.action; const id = el.dataset.id;
    if (a === 'add-note') addNote();
    else if (a === 'edit-note') editNote(id);
    else if (a === 'add-link') addLink();
    else if (a === 'edit-link') editLink(id);
    else if (a === 'copy-link') copyText(getState().links.find((l) => l.id === id).url, 'تم نسخ الرابط');
    else if (a === 'add-file') addFiles();
    else if (a === 'edit-file') editFile(id);
    else if (a === 'cat') { ui.cat = el.dataset.cat; draw(); }
    else if (a === 'dl-file') { const f = getFile(id); if (f) downloadFile(f.name, f.blob); }
    else if (a === 'open-file') {
      const f = getFile(id);
      if (!f) return;
      const safe = f.type.startsWith('image/') || f.type === 'application/pdf' || f.type.startsWith('text/plain');
      if (!safe) { downloadFile(f.name, f.blob); return; }
      const u = URL.createObjectURL(f.blob);
      const w = window.open(u, '_blank', 'noopener');
      if (!w) downloadFile(f.name, f.blob);
      setTimeout(() => URL.revokeObjectURL(u), 60000);
    }
  });

  return () => { off(); root.removeEventListener('input', onInput); doSearch.cancel(); revokeAll(); };
}

export { timeAgo };
