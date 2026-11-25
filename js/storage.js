// طبقة التخزين: LocalStorage للحالة الرئيسية + حفظ تلقائي + معالجة الأخطاء.
// الملفات الكبيرة والنسخ الاحتياطية الداخلية تُحفظ في IndexedDB (انظر lib/db.js).

import { STORAGE_KEY, SCHEMA_VERSION, LIMITS } from './config.js';
import { defaultState, normalizeState, uid } from './lib/schema.js';

let state = defaultState();
let saveTimer = null;
let dirty = false;
const externalSubs = new Set();
const statusSubs = new Set();
const meta = { lastSavedAt: null, error: null, memoryOnly: false, loadIssue: null, bytes: 0 };

function emitStatus() {
  for (const fn of statusSubs) {
    try { fn({ ...meta }); } catch { /* تجاهل */ }
  }
}

/** تحميل الحالة من LocalStorage. لا يرمي أخطاء أبدًا. */
export function initStorage() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    // اختبار الكتابة للتأكد من أن التخزين يعمل فعلًا (وضع التصفح الخاص قد يمنعه)
    localStorage.setItem(`${STORAGE_KEY}.probe`, '1');
    localStorage.removeItem(`${STORAGE_KEY}.probe`);
  } catch (e) {
    meta.memoryOnly = true;
    meta.error = 'التخزين المحلي غير متاح في هذا المتصفح. لن تُحفظ بياناتك بعد إغلاق التطبيق.';
  }

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const res = normalizeState(parsed);
      state = res.state;
      if (res.dropped > 0) meta.loadIssue = `تم تجاهل ${res.dropped} عنصرًا غير صالح أثناء تحميل بياناتك.`;
      meta.bytes = raw.length;
    } catch (e) {
      // بيانات تالفة: نحتفظ بنسخة خام للإنقاذ ثم نبدأ نظيفين
      try { localStorage.setItem(`${STORAGE_KEY}.corrupt`, raw); } catch { /* تجاهل */ }
      state = defaultState();
      meta.loadIssue = 'تعذّرت قراءة البيانات المحفوظة (تالفة). حُفظت نسخة خام للإنقاذ وبدأنا ببيانات جديدة.';
    }
  }

  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || e.storageArea !== localStorage) return;
    try {
      const res = e.newValue ? normalizeState(JSON.parse(e.newValue)) : { state: defaultState() };
      state = res.state;
      for (const fn of externalSubs) fn();
    } catch { /* تجاهل */ }
  });

  const flush = () => { if (dirty) flushSave(); };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  return meta;
}

export const getState = () => state;
export const getStorageMeta = () => ({ ...meta });

/** نافذة تعديل الحالة: يمرّر الحالة الحية إلى fn ثم يجدول الحفظ التلقائي. */
export function mutate(fn) {
  const result = fn(state);
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 250);
  return result;
}

export function flushSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  dirty = false;
  if (meta.memoryOnly) return false;
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, json);
    meta.bytes = json.length;
    meta.lastSavedAt = new Date().toISOString();
    if (meta.error) meta.error = null;
    emitStatus();
    return true;
  } catch (e) {
    const quota = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
    meta.error = quota
      ? 'مساحة التخزين ممتلئة — لم تُحفظ آخر التعديلات. صدّر نسخة احتياطية واحذف بعض المحتوى.'
      : 'تعذّر حفظ البيانات في هذا المتصفح.';
    emitStatus();
    return false;
  }
}

export function onSaveStatus(fn) {
  statusSubs.add(fn);
  return () => statusSubs.delete(fn);
}

/** يُستدعى عند تغيير البيانات من تبويب آخر */
export function subscribeExternal(fn) {
  externalSubs.add(fn);
  return () => externalSubs.delete(fn);
}

export function replaceState(next) {
  const res = normalizeState(next);
  state = res.state;
  dirty = true;
  return flushSave();
}

export function resetState() {
  state = defaultState();
  dirty = true;
  return flushSave();
}

/** إضافة سطر في سجل النشاط (يُستدعى داخل mutate) */
export function pushActivity(s, type, text) {
  s.activity.unshift({ id: uid(), type, text: String(text).slice(0, 200), at: new Date().toISOString() });
  if (s.activity.length > LIMITS.maxActivity) s.activity.length = LIMITS.maxActivity;
}

export { SCHEMA_VERSION };
