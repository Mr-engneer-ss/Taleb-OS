// موجّه بسيط يعتمد على hash (#/section/param) — يعمل على GitHub Pages داخل أي مسار فرعي.
// كل قسم وحدة مستقلة تُحمَّل عند الحاجة وتصدّر mount(root, ctx).

import { NAV, MORE_ITEM } from './config.js';
import { html, render } from './lib/html.js';
import { icon } from './lib/icons.js';

const LOADERS = {
  dashboard: () => import('./dashboard.js'),
  curriculum: () => import('./curriculum.js'),
  assistant: () => import('./assistant.js'),
  planner: () => import('./planner.js'),
  focus: () => import('./focus.js'),
  library: () => import('./library.js'),
  toolbox: () => import('./toolbox.js'),
  settings: () => import('./settings.js'),
  more: () => import('./more.js'),
};

const TITLES = Object.fromEntries([...NAV, MORE_ITEM].map((n) => [n.id, n.title]));

let container = null;
let current = null;
let token = 0;
let hooks = {};

export function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  const parts = path.split('/').filter(Boolean).map((p) => {
    try { return decodeURIComponent(p); } catch { return p; }
  });
  return { name: parts[0] || 'dashboard', params: parts.slice(1), query: new URLSearchParams(query) };
}

export function navigate(hash) {
  if (location.hash === hash) renderRoute();
  else location.hash = hash;
}

export const reload = () => renderRoute();

export function setTitle(title) {
  const h1 = document.getElementById('page-title');
  if (h1) h1.textContent = title;
  document.title = `${title} — STUDENT OS`;
}

function runCleanups() {
  if (!current) return;
  for (const fn of current.cleanups.splice(0)) {
    try { fn(); } catch (e) { console.warn('cleanup error', e); }
  }
  current = null;
}

function showError(err, retry) {
  console.error(err);
  render(container, html`<div class="page"><div class="card empty">
    <div class="empty-ic" style="background:var(--danger-soft);color:var(--danger)">${icon('alert', { size: 28 })}</div>
    <h3>تعذّر فتح هذه الصفحة</h3>
    <p>حدث خطأ غير متوقع. بياناتك المحفوظة لم تتأثر. جرّب إعادة المحاولة أو العودة للرئيسية.</p>
    <p class="tiny muted ltr">${String(err && err.message ? err.message : err)}</p>
    <div class="row row-center">
      <button class="btn btn-primary" type="button" id="route-retry">إعادة المحاولة</button>
      <a class="btn btn-ghost" href="#/dashboard">الرئيسية</a>
    </div></div></div>`);
  const btn = container.querySelector('#route-retry');
  if (btn) btn.addEventListener('click', retry);
}

async function renderRoute() {
  const my = ++token;
  const { name, params, query } = parseHash();
  if (!LOADERS[name]) {
    location.replace('#/dashboard');
    return;
  }
  runCleanups();
  setTitle(TITLES[name] || 'STUDENT OS');
  render(container, html`<div class="loader"><div class="spinner" role="status" aria-label="جارٍ التحميل"></div></div>`);
  if (hooks.onRoute) hooks.onRoute(name, params);

  const cleanups = [];
  try {
    const mod = await LOADERS[name]();
    if (my !== token) return;
    const ctx = {
      route: name,
      params,
      query,
      navigate,
      setTitle,
      onCleanup: (fn) => cleanups.push(fn),
    };
    container.textContent = '';
    const ret = await mod.mount(container, ctx);
    if (typeof ret === 'function') cleanups.push(ret);
    if (my !== token) {
      for (const fn of cleanups) { try { fn(); } catch { /* تجاهل */ } }
      return;
    }
    current = { cleanups };
    window.scrollTo({ top: 0 });
    if (document.activeElement === document.body || !container.contains(document.activeElement)) {
      container.focus({ preventScroll: true });
    }
  } catch (err) {
    for (const fn of cleanups) { try { fn(); } catch { /* تجاهل */ } }
    if (my === token) showError(err, renderRoute);
  }
}

export function startRouter(el, h = {}) {
  container = el;
  hooks = h;
  window.addEventListener('hashchange', renderRoute);
  renderRoute();
}
