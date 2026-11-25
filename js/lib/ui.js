// أدوات الواجهة المشتركة: نوافذ، نماذج، إشعارات، نسخ وتنزيل، وتحويلات صغيرة.

import { html, raw, render, esc, Safe } from './html.js';
import { icon } from './icons.js';
import { SUBJECT_COLORS } from '../config.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** تفويض الأحداث: يمرّر (event, element) عند مطابقة المحدد */
export function delegate(root, type, selector, handler) {
  const fn = (e) => {
    const target = e.target instanceof Element ? e.target.closest(selector) : null;
    if (target && root.contains(target)) handler(e, target);
  };
  root.addEventListener(type, fn);
  return () => root.removeEventListener(type, fn);
}

export const debounce = (fn, ms = 250) => {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.cancel = () => clearTimeout(t);
  return d;
};
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/** صيغة العدد بالعربية: countLabel(3,{one:'درس',two:'درسان',few:'دروس',many:'درسًا'}) */
export function countLabel(n, f) {
  if (n === 1) return `${f.one} ${f.oneWord ?? 'واحد'}`;
  if (n === 2) return f.two;
  if (n >= 3 && n <= 10) return `${n} ${f.few}`;
  if (n === 0) return `0 ${f.few}`;
  return `${n} ${f.many}`;
}
export const lessonsLabel = (n) => countLabel(n, { one: 'درس', two: 'درسان', few: 'دروس', many: 'درسًا' });

export function fileSize(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/* ───────── الإشعارات ───────── */
export function toast(message, { type = 'info', duration = 3400, action = null } = {}) {
  const host = document.getElementById('toasts');
  if (!host) return null;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const iconName = type === 'success' ? 'check' : type === 'error' ? 'alert' : 'info';
  render(el, html`<span class="toast-ic">${icon(iconName, { size: 18 })}</span><span class="toast-msg">${message}</span>${action ? html`<button class="toast-act" type="button">${action.label}</button>` : ''}`);
  const remove = () => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 220);
  };
  if (action) {
    el.querySelector('.toast-act').addEventListener('click', () => { try { action.onClick(); } finally { remove(); } });
  }
  host.appendChild(el);
  while (host.children.length > 4) host.firstElementChild.remove();
  if (duration > 0) setTimeout(remove, duration);
  return { close: remove };
}

/* ───────── النوافذ ───────── */
let openCount = 0;

/**
 * يفتح نافذة <dialog>. يعيد { el, root, close(result) }
 * options: title, body (Safe), footer (Safe), size('sm'|'md'|'lg'), onClose(result)
 */
export function openDialog({ title = '', body = '', footer = null, size = 'md', onClose = null, className = '' } = {}) {
  const dlg = document.createElement('dialog');
  dlg.className = `modal modal-${size} ${className}`;
  const titleId = `dlg-${Math.random().toString(36).slice(2, 8)}`;
  dlg.setAttribute('aria-labelledby', titleId);
  render(dlg, html`<div class="modal-card">
    <header class="modal-head">
      <h2 id="${titleId}">${title}</h2>
      <button class="icon-btn" type="button" data-dlg-close aria-label="إغلاق">${icon('x')}</button>
    </header>
    <div class="modal-body">${body}</div>
    ${footer ? html`<footer class="modal-foot">${footer}</footer>` : ''}
  </div>`);
  document.body.appendChild(dlg);

  let result;
  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) document.documentElement.classList.remove('modal-open');
    dlg.remove();
    if (onClose) onClose(result);
  };
  dlg.addEventListener('close', finish);
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) api.close();
    else if (e.target instanceof Element && e.target.closest('[data-dlg-close]')) api.close();
  });
  const api = {
    el: dlg,
    root: dlg.querySelector('.modal-body'),
    close(res) {
      result = res;
      if (dlg.open) dlg.close();
      else finish();
    },
  };
  openCount++;
  document.documentElement.classList.add('modal-open');
  if (typeof dlg.showModal === 'function') dlg.showModal();
  else dlg.setAttribute('open', '');
  return api;
}

export function confirmDialog({ title = 'تأكيد', message = '', confirmText = 'تأكيد', cancelText = 'إلغاء', danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const dlg = openDialog({
      title,
      size: 'sm',
      body: html`<p class="confirm-msg">${message}</p>`,
      footer: html`<button class="btn btn-ghost" type="button" data-no>${cancelText}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="button" data-yes>${confirmText}</button>`,
      onClose: () => { if (!answered) resolve(false); },
    });
    dlg.el.querySelector('[data-yes]').addEventListener('click', () => { answered = true; resolve(true); dlg.close(true); });
    dlg.el.querySelector('[data-no]').addEventListener('click', () => { answered = true; resolve(false); dlg.close(false); });
    dlg.el.querySelector('[data-no]').focus();
  });
}

/** يطلب من المستخدم كتابة كلمة تأكيد (للعمليات الخطرة) */
export function typedConfirm({ title, message, word = 'حذف', confirmText = 'تأكيد الحذف' }) {
  return new Promise((resolve) => {
    let answered = false;
    const dlg = openDialog({
      title,
      size: 'sm',
      body: html`<p class="confirm-msg">${message}</p>
        <div class="field"><label for="tc-input">اكتب «${word}» للمتابعة</label>
        <input id="tc-input" class="input" autocomplete="off" /></div>`,
      footer: html`<button class="btn btn-ghost" type="button" data-no>إلغاء</button>
        <button class="btn btn-danger" type="button" data-yes disabled>${confirmText}</button>`,
      onClose: () => { if (!answered) resolve(false); },
    });
    const input = dlg.el.querySelector('#tc-input');
    const yes = dlg.el.querySelector('[data-yes]');
    input.addEventListener('input', () => { yes.disabled = input.value.trim() !== word; });
    yes.addEventListener('click', () => { answered = true; resolve(true); dlg.close(true); });
    dlg.el.querySelector('[data-no]').addEventListener('click', () => { answered = true; resolve(false); dlg.close(false); });
    input.focus();
  });
}

/* ───────── النماذج ───────── */
export const options = (items, selected) =>
  html`${items.map((o) => html`<option value="${o.value}" ${String(o.value) === String(selected ?? '') ? raw('selected') : ''}>${o.label}</option>`)}`;

function fieldHtml(f, value, uidp) {
  const id = `${uidp}_${f.name}`;
  const v = value ?? f.default ?? '';
  const req = f.required ? raw('required') : '';
  let control;
  switch (f.type) {
    case 'textarea':
      control = html`<textarea class="textarea" id="${id}" name="${f.name}" rows="${f.rows || 4}" maxlength="${f.maxlength || 5000}" placeholder="${f.placeholder || ''}" ${req}>${v}</textarea>`;
      break;
    case 'select':
      control = html`<select class="select" id="${id}" name="${f.name}" ${req}>${options(f.options || [], v)}</select>`;
      break;
    case 'checkbox':
      return html`<div class="field field-check" ${f.showIf ? raw(`data-showif-field="${esc(f.showIf.field)}" data-showif-in="${esc(f.showIf.in.join(','))}"`) : ''}>
        <label class="check-row"><input type="checkbox" id="${id}" name="${f.name}" ${v ? raw('checked') : ''} /><span>${f.label}</span></label>
        ${f.hint ? html`<p class="field-hint">${f.hint}</p>` : ''}</div>`;
    case 'color':
      control = html`<div class="swatches" role="radiogroup" aria-label="${f.label}">${(f.colors || SUBJECT_COLORS).map((c) => html`
        <label class="swatch"><input type="radio" name="${f.name}" value="${c}" ${String(v).toLowerCase() === c ? raw('checked') : ''} /><span style="background:${c}"></span></label>`)}</div>`;
      break;
    default:
      control = html`<input class="input" id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${v}" maxlength="${f.maxlength || 200}" placeholder="${f.placeholder || ''}" ${f.min !== undefined ? raw(`min="${esc(f.min)}"`) : ''} ${f.max !== undefined ? raw(`max="${esc(f.max)}"`) : ''} ${f.step ? raw(`step="${esc(f.step)}"`) : ''} ${f.type === 'number' ? raw('inputmode="decimal"') : ''} ${f.list ? raw(`list="${esc(id)}_list"`) : ''} ${req} />${f.list ? html`<datalist id="${id}_list">${f.list.map((x) => html`<option value="${x}"></option>`)}</datalist>` : ''}`;
  }
  const quick = f.quick
    ? html`<div class="chips chips-quick">${f.quick.map((q) => html`<button type="button" class="chip" data-quick-for="${f.name}" data-days="${q.days}">${q.label}</button>`)}<button type="button" class="chip chip-clear" data-quick-for="${f.name}" data-days="">مسح</button></div>`
    : '';
  return html`<div class="field ${f.full === false ? '' : 'field-full'}" ${f.showIf ? raw(`data-showif-field="${esc(f.showIf.field)}" data-showif-in="${esc(f.showIf.in.join(','))}"`) : ''}>
    ${f.type === 'color' ? html`<span class="label">${f.label}</span>` : html`<label class="label" for="${id}">${f.label}${f.required ? html`<i class="req" aria-hidden="true">*</i>` : ''}</label>`}
    ${control}${quick}
    ${f.hint ? html`<p class="field-hint">${f.hint}</p>` : ''}
  </div>`;
}

/**
 * نافذة نموذج عامة. تعيد Promise: { action:'submit'|'delete', values } أو null عند الإلغاء.
 * fields: [{name,label,type,required,options,default,showIf:{field,in:[]},quick:[{label,days}],...}]
 */
export function formDialog({ title, fields, values = {}, submitText = 'حفظ', deleteText = '', description = '', validate = null, size = 'md' }) {
  return new Promise((resolve) => {
    const uidp = `f${Math.random().toString(36).slice(2, 7)}`;
    let settled = false;
    const done = (res) => { if (!settled) { settled = true; resolve(res); } };

    const dlg = openDialog({
      title,
      size,
      body: html`<form class="form" id="${uidp}" novalidate>
        ${description ? html`<p class="form-desc">${description}</p>` : ''}
        <div class="form-grid">${fields.map((f) => fieldHtml(f, values[f.name], uidp))}</div>
        <p class="form-error" role="alert" hidden></p>
      </form>`,
      footer: html`${deleteText ? html`<button class="btn btn-danger-ghost" type="button" data-act="delete">${deleteText}</button><span class="spacer"></span>` : ''}
        <button class="btn btn-ghost" type="button" data-act="cancel">إلغاء</button>
        <button class="btn btn-primary" type="submit" form="${uidp}">${submitText}</button>`,
      onClose: () => done(null),
    });

    const form = dlg.el.querySelector('form');
    const errEl = form.querySelector('.form-error');

    const read = () => {
      const out = {};
      for (const f of fields) {
        const wrap = form.querySelector(`[data-name-wrap="${f.name}"]`);
        void wrap;
        const hidden = f.showIf && !isShown(f.showIf);
        if (f.type === 'checkbox') out[f.name] = hidden ? false : form.elements[f.name].checked;
        else if (f.type === 'color') {
          const c = form.querySelector(`input[name="${f.name}"]:checked`);
          out[f.name] = c ? c.value : (f.colors || SUBJECT_COLORS)[0];
        } else if (hidden) out[f.name] = '';
        else if (f.type === 'number') {
          const raw_ = form.elements[f.name].value;
          out[f.name] = raw_ === '' ? null : Number(raw_);
        } else if (f.type === 'textarea') out[f.name] = form.elements[f.name].value;
        else out[f.name] = form.elements[f.name].value.trim();
      }
      return out;
    };

    const isShown = (cond) => {
      const el = form.elements[cond.field];
      if (!el) return true;
      return cond.in.includes(el.value);
    };

    const applyShowIf = () => {
      for (const wrap of form.querySelectorAll('[data-showif-field]')) {
        const field = wrap.getAttribute('data-showif-field');
        const allowed = wrap.getAttribute('data-showif-in').split(',');
        const src = form.elements[field];
        const show = !src || allowed.includes(src.value);
        wrap.hidden = !show;
        for (const inp of wrap.querySelectorAll('input,select,textarea')) inp.disabled = !show;
      }
    };
    applyShowIf();
    form.addEventListener('change', applyShowIf);

    form.addEventListener('click', (e) => {
      const q = e.target instanceof Element ? e.target.closest('[data-quick-for]') : null;
      if (!q) return;
      const input = form.elements[q.getAttribute('data-quick-for')];
      const days = q.getAttribute('data-days');
      if (days === '') { input.value = ''; return; }
      const d = new Date();
      d.setDate(d.getDate() + Number(days));
      input.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      errEl.hidden = true;
      if (!form.reportValidity()) return;
      const vals = read();
      if (validate) {
        const msg = validate(vals);
        if (msg) { errEl.textContent = msg; errEl.hidden = false; return; }
      }
      done({ action: 'submit', values: vals });
      dlg.close();
    });
    dlg.el.querySelector('[data-act="cancel"]').addEventListener('click', () => dlg.close());
    const del = dlg.el.querySelector('[data-act="delete"]');
    if (del) del.addEventListener('click', () => { done({ action: 'delete', values: read() }); dlg.close(); });

    const first = form.querySelector('input:not([type=radio]):not([type=checkbox]):not([disabled]), textarea, select');
    if (first) setTimeout(() => first.focus(), 30);
  });
}

/* ───────── أدوات الملفات والحافظة ───────── */
export async function copyText(text, okMessage = 'تم النسخ') {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      throw new Error('fallback');
    }
    toast(okMessage, { type: 'success', duration: 1800 });
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    toast(ok ? okMessage : 'تعذّر النسخ — انسخ النص يدويًا', { type: ok ? 'success' : 'error', duration: 2200 });
    return ok;
  }
}

export function downloadFile(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/* ───────── مكوّنات صغيرة ───────── */
export function emptyState({ icon: ic = 'layers', title, text = '', action = null, secondary = null }) {
  return html`<div class="empty">
    <div class="empty-ic">${icon(ic, { size: 28 })}</div>
    <h3>${title}</h3>
    ${text ? html`<p>${text}</p>` : ''}
    <div class="row row-center">
      ${action ? html`<button class="btn btn-primary" type="button" data-action="${action.id}">${action.icon ? icon(action.icon, { size: 18 }) : ''}${action.label}</button>` : ''}
      ${secondary ? html`<button class="btn btn-ghost" type="button" data-action="${secondary.id}">${secondary.label}</button>` : ''}
    </div>
  </div>`;
}

export function pageHead({ title, subtitle = '', actions = '' }) {
  return html`<div class="page-head">
    <div class="page-head-text"><h2 class="page-title">${title}</h2>${subtitle ? html`<p class="page-sub">${subtitle}</p>` : ''}</div>
    <div class="page-actions">${actions}</div>
  </div>`;
}

export const tabsHtml = (tabs, active, attr = 'data-tab') =>
  html`<div class="tabs" role="tablist">${tabs.map((t) => html`<button type="button" role="tab" class="tab ${t.id === active ? 'is-active' : ''}" aria-selected="${t.id === active}" ${raw(`${attr}="${esc(t.id)}"`)}>${t.icon ? icon(t.icon, { size: 16 }) : ''}<span>${t.label}</span>${t.badge ? html`<em class="tab-badge">${t.badge}</em>` : ''}</button>`)}</div>`;

export { Safe, html, raw, render, esc };
