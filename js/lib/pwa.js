// PWA: تسجيل Service Worker، التحديث الآمن، وزر التثبيت.

let deferredPrompt = null;
let installed = false;
const installSubs = new Set();
let updateRequested = false;

const notifyInstall = () => installSubs.forEach((fn) => fn(getInstallState()));

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

export function getInstallState() {
  return { canPrompt: !!deferredPrompt, installed: installed || isStandalone(), ios: isIOS() };
}

export function onInstallChange(fn) {
  installSubs.add(fn);
  return () => installSubs.delete(fn);
}

export function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notifyInstall();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    notifyInstall();
  });
}

export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice.catch(() => ({ outcome: 'dismissed' }));
  deferredPrompt = null;
  notifyInstall();
  return choice.outcome;
}

/**
 * يسجّل الـ Service Worker. عند توفر نسخة جديدة يُستدعى onUpdate(applyFn).
 * لا يتم التبديل تلقائيًا: يطبّق المستخدم التحديث بنفسه لتفادي خلط ملفات قديمة وجديدة.
 */
export async function registerServiceWorker(onUpdate) {
  if (!('serviceWorker' in navigator)) return null;
  if (!window.isSecureContext) return null;
  try {
    const url = new URL('sw.js', document.baseURI).href;
    const reg = await navigator.serviceWorker.register(url);

    const offer = (worker) => onUpdate && onUpdate(() => {
      updateRequested = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    });

    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) offer(nw);
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (updateRequested) location.reload();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    return reg;
  } catch (e) {
    console.warn('تعذّر تسجيل Service Worker:', e);
    return null;
  }
}

/** تقدير المساحة المستخدمة (إن دعمه المتصفح) */
export async function storageEstimate() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      return { usage, quota };
    }
  } catch { /* تجاهل */ }
  return null;
}

/** طلب تخزين دائم لتقليل احتمال حذف البيانات تلقائيًا عند امتلاء مساحة الجهاز */
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return 'already';
      return (await navigator.storage.persist()) ? 'granted' : 'denied';
    }
  } catch { /* تجاهل */ }
  return 'unsupported';
}
