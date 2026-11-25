// صندوق الأدوات: شبكة أدوات تُحمَّل كل منها عند الحاجة فقط (#/toolbox/<id>).

import { html, render } from './lib/html.js';
import { icon } from './lib/icons.js';
import { pageHead } from './lib/ui.js';

const TOOLS = [
  { id: 'calculator', title: 'الحاسبة العلمية', desc: 'دوال مثلثية ولوغاريتمية وأسس وجذور', icon: 'calculator', load: () => import('./tools/calculator.js') },
  { id: 'html', title: 'محرر HTML', desc: 'اكتب HTML وشاهد النتيجة فورًا', icon: 'code', load: () => import('./tools/code-lab.js') },
  { id: 'css', title: 'محرر CSS', desc: 'جرّب التنسيقات على عناصر حية', icon: 'layers', load: () => import('./tools/code-lab.js') },
  { id: 'js', title: 'محرر JavaScript', desc: 'نفّذ الأكواد وشاهد الناتج', icon: 'braces', load: () => import('./tools/code-lab.js') },
  { id: 'json', title: 'منسّق JSON', desc: 'تنسيق وضغط وتحقق مع تحديد الخطأ', icon: 'database', load: () => import('./tools/json-tool.js') },
  { id: 'counter', title: 'عدّاد الكلمات والحروف', desc: 'إحصاءات النص ووقت القراءة', icon: 'hash', load: () => import('./tools/text-counter.js') },
  { id: 'units', title: 'تحويل الوحدات', desc: 'طول، كتلة، زمن، مساحة، حرارة وأكثر', icon: 'swap', load: () => import('./tools/unit-converter.js') },
  { id: 'password', title: 'مولّد كلمات المرور', desc: 'عشوائية آمنة تُولَّد على جهازك', icon: 'key', load: () => import('./tools/password-tool.js') },
  { id: 'text', title: 'معالجة النصوص', desc: 'تغيير الحالة، ترتيب، حذف تكرار، استبدال', icon: 'type', load: () => import('./tools/text-tools.js') },
  { id: 'format', title: 'تنسيق النص ونسخه', desc: 'نظّف النص ونسّقه ثم انسخه', icon: 'copy', load: () => import('./tools/text-tools.js') },
];

export async function mount(root, ctx) {
  const id = ctx.params[0] || '';
  const tool = TOOLS.find((t) => t.id === id);

  if (!tool) {
    render(root, html`<div class="page">
      ${pageHead({ title: 'الأدوات التقنية', subtitle: 'أدوات تعمل بالكامل على جهازك، حتى دون اتصال' })}
      <div class="grid grid-auto">${TOOLS.map((t) => html`<a class="card card-link tool-tile" href="#/toolbox/${t.id}">
        <span class="stat-ic">${icon(t.icon, { size: 24 })}</span><h3>${t.title}</h3><p>${t.desc}</p></a>`)}</div>
    </div>`);
    return;
  }

  ctx.setTitle(tool.title);
  // لتجنب تمرير params كاملة للأدوات: الأداة تقرأ ctx.params[1] لوضعها الفرعي
  const sub = tool.id === 'format' ? ['text', 'format'] : tool.id === 'text' ? ['text'] : ['code', tool.id];
  const innerCtx = { ...ctx, params: tool.id === 'html' || tool.id === 'css' || tool.id === 'js' ? [tool.id, tool.id] : sub };

  render(root, html`<div class="page">
    <div><a class="back-link" href="#/toolbox">${icon('arrow-right', { size: 18 })} كل الأدوات</a></div>
    ${pageHead({ title: tool.title, subtitle: tool.desc })}
    <div class="card" id="tool-host"></div>
  </div>`);

  const host = root.querySelector('#tool-host');
  const mod = await tool.load();
  const cleanup = await mod.mount(host, innerCtx);
  return typeof cleanup === 'function' ? cleanup : undefined;
}
