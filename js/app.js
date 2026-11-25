// نقطة الدخول: تهيئة التخزين والمظهر والتنقل والـ PWA ومؤشرات الحالة.

import { NAV, MORE_ITEM, APP } from './config.js';
import { initStorage, getState, mutate, subscribeExternal, onSaveStatus } from './storage.js';
import { startRouter, reload } from './router.js';
import { html, render } from './lib/html.js';
import { icon } from './lib/icons.js';
import { toast } from './lib/ui.js';
import { applyTheme } from './lib/theme.js';
import { formatClock } from './lib/dates.js';
import * as timer from './lib/timer.js';
import { registerServiceWorker, initInstallPrompt, onInstallChange, getInstallState, promptInstall } from './lib/pwa.js';

const SECONDARY = new Set(NAV.filter((n) => !n.primary).map((n) => n.id).concat('more'));

function buildNav() {
  const side = document.getElementById('side-nav');
  render(side, html`${NAV.map((n) => html`<a class="nav-link" href="#/${n.id}" data-route="${n.id}">${icon(n.icon, { size: 20 })}<span>${n.label}</span></a>`)}`);

  const bottom = document.getElementById('bottom-nav');
  const primary = NAV.filter((n) => n.primary);
  render(bottom, html`${primary.map((n) => html`<a class="bn-item" href="#/${n.id}" data-route="${n.id}"><span class="bn-ic">${icon(n.icon, { size: 23 })}</span><span>${n.label}</span></a>`)}
    <a class="bn-item" href="#/more" data-route="more"><span class="bn-ic">${icon(MORE_ITEM.icon, { size: 23 })}</span><span>${MORE_ITEM.label}</span></a>`);
}

function markActive(route) {
  document.querySelectorAll('#side-nav [data-route]').forEach((a) => {
    const on = a.dataset.route === route || (route === 'more' && false);
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.querySelectorAll('#bottom-nav [data-route]').forEach((a) => {
    const id = a.dataset.route;
    const on = id === route || (id === 'more' && SECONDARY.has(route));
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function setupTheme() {
  const btn = document.getElementById('theme-btn');
  const paint = () => {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    render(btn, icon(light ? 'moon' : 'sun', { size: 20 }));
    btn.setAttribute('aria-label', light ? 'التبديل إلى المظهر الداكن' : 'التبديل إلى المظهر الفاتح');
  };
  paint();
  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    mutate((s) => { s.settings.theme = next; });
    paint();
    window.dispatchEvent(new CustomEvent('studentos:theme', { detail: next }));
  });
  window.addEventListener('studentos:theme', paint);
}

function setupConnection() {
  const paint = () => {
    const online = navigator.onLine;
    document.querySelectorAll('[data-conn]').forEach((el) => {
      el.classList.toggle('is-offline', !online);
      el.querySelector('span').textContent = online ? 'متصل' : 'غير متصل';
      el.title = online ? '' : 'أنت غير متصل — التطبيق يعمل من الذاكرة المحلية وبياناتك محفوظة على جهازك';
    });
  };
  paint();
  window.addEventListener('online', () => { paint(); toast('عاد الاتصال بالإنترنت', { type: 'success', duration: 2200 }); });
  window.addEventListener('offline', () => { paint(); toast('أنت غير متصل — كل شيء يعمل محليًا', { type: 'info', duration: 3200 }); });
}

function setupInstall() {
  const btn = document.getElementById('install-side');
  const paint = () => {
    const st = getInstallState();
    btn.hidden = !(st.canPrompt && !st.installed);
    if (!btn.hidden) render(btn, html`${icon('download', { size: 16 })} تثبيت التطبيق`);
  };
  initInstallPrompt();
  onInstallChange(paint);
  btn.addEventListener('click', async () => {
    const out = await promptInstall();
    if (out === 'accepted') toast('جارٍ تثبيت التطبيق', { type: 'success' });
  });
  paint();
}

function setupTimerChip() {
  const chip = document.getElementById('timer-chip');
  const paint = (snap) => {
    const show = snap.status !== 'idle';
    chip.hidden = !show;
    if (!show) return;
    chip.classList.toggle('is-paused', snap.status === 'paused');
    chip.classList.toggle('is-break', snap.isBreak);
    render(chip, html`${icon(snap.status === 'paused' ? 'pause' : snap.isBreak ? 'sparkles' : 'timer', { size: 16 })}<span class="ltr">${formatClock(snap.remainingMs / 1000)}</span>`);
    chip.setAttribute('aria-label', `${snap.isBreak ? 'استراحة' : 'جلسة تركيز'} — المتبقي ${formatClock(snap.remainingMs / 1000)}`);
  };
  timer.subscribe((type, snap, extra) => {
    paint(snap);
    if (type === 'complete') {
      if (extra.finished === 'focus') {
        toast(`أحسنت! انتهت جلسة التركيز وسُجّل ${extra.logged} د. ${extra.next === 'long' ? 'حان وقت استراحة طويلة.' : 'خذ استراحة قصيرة.'}`, { type: 'success', duration: 6000 });
      } else {
        toast('انتهت الاستراحة — جاهز لجلسة تركيز جديدة؟', { type: 'info', duration: 5000 });
      }
    }
  });
  paint(timer.snapshot());
}

function setupErrorNet() {
  let last = 0;
  const report = (msg) => {
    console.error(msg);
    const now = Date.now();
    if (now - last < 4000) return;
    last = now;
    toast('حدث خطأ غير متوقع. إن تكرر، أعد تحميل الصفحة — بياناتك محفوظة.', { type: 'error', duration: 5000 });
  };
  window.addEventListener('error', (e) => report(e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => report(e.reason));
}

async function boot() {
  const meta = initStorage();
  applyTheme(getState().settings.theme);
  setupErrorNet();
  buildNav();
  setupTheme();
  setupConnection();
  setupInstall();
  timer.initTimer();
  setupTimerChip();

  startRouter(document.getElementById('view'), { onRoute: markActive });
  subscribeExternal(() => {
    applyTheme(getState().settings.theme);
    window.dispatchEvent(new CustomEvent('studentos:theme'));
    reload();
  });

  if (meta.memoryOnly) toast(meta.error, { type: 'error', duration: 8000 });
  else if (meta.loadIssue) toast(meta.loadIssue, { type: 'error', duration: 8000 });

  let lastErr = '';
  onSaveStatus((m) => {
    if (m.error && m.error !== lastErr) toast(m.error, { type: 'error', duration: 8000 });
    lastErr = m.error || '';
  });

  registerServiceWorker((applyUpdate) => {
    toast('يتوفر إصدار جديد من التطبيق.', {
      duration: 0,
      action: { label: 'تحديث الآن', onClick: applyUpdate },
    });
  });

  document.documentElement.dataset.appVersion = APP.version;
}

boot();
