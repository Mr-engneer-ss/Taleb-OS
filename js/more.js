// صفحة «المزيد» على الموبايل: الأقسام غير الموجودة في الشريط السفلي.

import { NAV, APP } from './config.js';
import { html, render } from './lib/html.js';
import { icon } from './lib/icons.js';
import { pageHead } from './lib/ui.js';

const DESC = {
  focus: 'مؤقت Pomodoro وإحصاءات المذاكرة',
  library: 'ملاحظاتك وروابطك وملفاتك',
  toolbox: 'حاسبة ومحررات وأدوات تقنية',
  settings: 'المظهر والنسخ الاحتياطي والبيانات',
};

export function mount(root) {
  const items = NAV.filter((n) => !n.primary);
  render(root, html`<div class="page">
    ${pageHead({ title: 'المزيد', subtitle: 'باقي أقسام STUDENT OS' })}
    <div class="grid grid-2">
      ${items.map((n) => html`<a class="card card-link row row-nowrap" href="#/${n.id}">
        <span class="stat-ic">${icon(n.icon, { size: 22 })}</span>
        <span class="stack-sm"><strong>${n.title}</strong><span class="muted small">${DESC[n.id] || ''}</span></span>
      </a>`)}
    </div>
    <p class="muted tiny" style="text-align:center">STUDENT OS ${APP.version} — بياناتك محفوظة على جهازك فقط</p>
  </div>`);
}
