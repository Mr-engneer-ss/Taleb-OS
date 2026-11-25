// قوالب HTML آمنة: كل قيمة تُهرَّب تلقائيًا ما لم تكن مُعلَّمة كـ raw().
// هذا يمنع حقن HTML من بيانات المستخدم (ملاحظات، أسماء، روابط ...).

export class Safe {
  constructor(value) { this.value = String(value); }
  toString() { return this.value; }
}

export const raw = (s) => new Safe(s);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

function part(v) {
  if (v === null || v === undefined || v === false || v === true) return '';
  if (v instanceof Safe) return v.value;
  if (Array.isArray(v)) return v.map(part).join('');
  return esc(v);
}

export function html(strings, ...vals) {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < vals.length) out += part(vals[i]);
  }
  return new Safe(out);
}

export function render(el, safe) {
  el.innerHTML = safe instanceof Safe ? safe.value : esc(safe);
  return el;
}
