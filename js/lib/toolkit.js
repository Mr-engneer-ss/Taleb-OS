// منطق الأدوات التقنية النقي (بدون DOM) — قابل للاختبار في Node.

/* ───────── تحويل الوحدات ───────── */
// كل وحدة: [المفتاح، الاسم، معامل التحويل إلى الوحدة الأساسية]
export const UNIT_CATEGORIES = {
  length: { label: 'الطول', base: 'm', units: [['mm', 'مليمتر', 0.001], ['cm', 'سنتيمتر', 0.01], ['m', 'متر', 1], ['km', 'كيلومتر', 1000], ['in', 'بوصة', 0.0254], ['ft', 'قدم', 0.3048], ['yd', 'ياردة', 0.9144], ['mi', 'ميل', 1609.344]] },
  mass: { label: 'الكتلة', base: 'kg', units: [['mg', 'مليجرام', 1e-6], ['g', 'جرام', 0.001], ['kg', 'كيلوجرام', 1], ['t', 'طن', 1000], ['oz', 'أوقية', 0.028349523125], ['lb', 'رطل', 0.45359237]] },
  time: { label: 'الزمن', base: 's', units: [['ms', 'ملّي ثانية', 0.001], ['s', 'ثانية', 1], ['min', 'دقيقة', 60], ['h', 'ساعة', 3600], ['d', 'يوم', 86400], ['wk', 'أسبوع', 604800]] },
  area: { label: 'المساحة', base: 'm2', units: [['cm2', 'سم²', 0.0001], ['m2', 'م²', 1], ['km2', 'كم²', 1e6], ['ha', 'هكتار', 10000], ['feddan', 'فدان', 4200.833], ['ft2', 'قدم²', 0.09290304], ['ac', 'إيكر', 4046.8564224]] },
  volume: { label: 'الحجم', base: 'l', units: [['ml', 'مليلتر', 0.001], ['l', 'لتر', 1], ['m3', 'م³', 1000], ['cm3', 'سم³', 0.001], ['gal', 'جالون أمريكي', 3.785411784], ['cup', 'كوب أمريكي', 0.2365882365]] },
  speed: { label: 'السرعة', base: 'ms', units: [['ms', 'م/ث', 1], ['kmh', 'كم/س', 1 / 3.6], ['mph', 'ميل/س', 0.44704], ['kn', 'عقدة', 0.514444444]] },
  data: { label: 'البيانات', base: 'B', units: [['B', 'بايت', 1], ['KB', 'كيلوبايت', 1024], ['MB', 'ميجابايت', 1024 ** 2], ['GB', 'جيجابايت', 1024 ** 3], ['TB', 'تيرابايت', 1024 ** 4]] },
  temp: { label: 'درجة الحرارة', base: 'c', units: [['c', 'سيلزيوس °م', 0], ['f', 'فهرنهايت °ف', 0], ['k', 'كلفن K', 0]] },
};

const toC = { c: (v) => v, f: (v) => ((v - 32) * 5) / 9, k: (v) => v - 273.15 };
const fromC = { c: (v) => v, f: (v) => (v * 9) / 5 + 32, k: (v) => v + 273.15 };

export function convertUnit(category, from, to, value) {
  const cat = UNIT_CATEGORIES[category];
  if (!cat) throw new Error('فئة غير معروفة');
  if (!Number.isFinite(value)) throw new Error('أدخل رقمًا صحيحًا');
  if (category === 'temp') {
    if (!(from in toC) || !(to in fromC)) throw new Error('وحدة غير معروفة');
    const c = toC[from](value);
    if (c < -273.15 - 1e-9) throw new Error('أقل من الصفر المطلق');
    return fromC[to](c);
  }
  const f = cat.units.find((u) => u[0] === from);
  const t = cat.units.find((u) => u[0] === to);
  if (!f || !t) throw new Error('وحدة غير معروفة');
  return (value * f[2]) / t[2];
}

export function fmtNum(n) {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-6)) return n.toExponential(6);
  return String(Number(n.toPrecision(10)));
}

/* ───────── JSON ───────── */
export function parseJSON(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    let line = null, col = null;
    let pos = null;
    const m = /position (\d+)/i.exec(msg);
    if (m) pos = Number(m[1]);
    else if (text.length <= 20000) {
      // المتصفحات تختلف في ذكر الموضع: نبحث عن أول بادئة لا يمكن أن تكون بداية JSON صالح
      const endLike = /end of JSON|unterminated|unexpected end|end of data/i;
      for (let n = 1; n <= text.length; n++) {
        try { JSON.parse(text.slice(0, n)); } catch (err) {
          const em = String(err.message);
          const pm = /position (\d+)/i.exec(em);
          const atEnd = pm ? Number(pm[1]) >= n : false; // الخطأ عند نهاية البادئة = لم نصل للحرف المعيب بعد
          if (!endLike.test(em) && !atEnd) { pos = n - 1; break; }
        }
      }
    }
    if (pos === null) {
      const lm = /line (\d+) column (\d+)/i.exec(msg);
      if (lm) { line = Number(lm[1]); col = Number(lm[2]); }
    } else {
      const before = text.slice(0, pos).split('\n');
      line = before.length;
      col = before[before.length - 1].length + 1;
    }
    return { ok: false, error: msg, line, col };
  }
}

export function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeysDeep(v[k])]));
  return v;
}

/* ───────── النصوص ───────── */
const DIACRITICS = /[ً-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;

export function textStats(text) {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/u).filter((w) => /[\p{L}\p{N}]/u.test(w)).length : 0;
  const chars = [...text].length;
  const charsNoSpace = [...text.replace(/\s/gu, '')].length;
  const sentences = trimmed ? (trimmed.match(/[^.!?؟…\n]+[.!?؟…]*/gu) || []).filter((s) => /[\p{L}\p{N}]/u.test(s)).length : 0;
  const paragraphs = trimmed ? trimmed.split(/\n\s*\n/u).filter((p) => p.trim()).length : 0;
  const lines = text === '' ? 0 : text.split('\n').length;
  const readMin = words / 200; // متوسط قراءة ~200 كلمة/دقيقة
  const freq = new Map();
  for (const w of trimmed.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []) {
    const k = w.replace(DIACRITICS, '');
    if ([...k].length < 2) continue;
    freq.set(k, (freq.get(k) || 0) + 1);
  }
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ar')).slice(0, 8);
  return { words, chars, charsNoSpace, sentences, paragraphs, lines, readMin, top };
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export const TEXT_OPS = [
  { id: 'upper', label: 'أحرف إنجليزية كبيرة', fn: (t) => t.toUpperCase() },
  { id: 'lower', label: 'أحرف إنجليزية صغيرة', fn: (t) => t.toLowerCase() },
  { id: 'title', label: 'أول حرف كبير لكل كلمة', fn: (t) => t.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()) },
  { id: 'trim', label: 'إزالة المسافات الزائدة', fn: (t) => t.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n').trim() },
  { id: 'blank', label: 'حذف الأسطر الفارغة', fn: (t) => t.split('\n').filter((l) => l.trim()).join('\n') },
  { id: 'dedupe', label: 'حذف الأسطر المكررة', fn: (t) => { const s = new Set(); return t.split('\n').filter((l) => { const k = l.trim(); if (s.has(k)) return false; s.add(k); return true; }).join('\n'); } },
  { id: 'sort', label: 'ترتيب الأسطر أبجديًا', fn: (t) => t.split('\n').sort((a, b) => a.localeCompare(b, 'ar')).join('\n') },
  { id: 'reverse-lines', label: 'عكس ترتيب الأسطر', fn: (t) => t.split('\n').reverse().join('\n') },
  { id: 'reverse-text', label: 'عكس النص', fn: (t) => [...t].reverse().join('') },
  { id: 'number', label: 'ترقيم الأسطر', fn: (t) => t.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n') },
  { id: 'no-diac', label: 'إزالة التشكيل والتطويل', fn: (t) => t.replace(DIACRITICS, '').replace(TATWEEL, '') },
  { id: 'ar-digits', label: 'أرقام عربية ← إنجليزية', fn: (t) => t.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))) },
  { id: 'en-digits', label: 'أرقام إنجليزية ← عربية', fn: (t) => t.replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]) },
  { id: 'slug', label: 'تحويل إلى slug', fn: (t) => t.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\p{L}\p{N}-]+/gu, '').replace(/-+/g, '-').replace(/^-|-$/g, '') },
];

export function replaceAll(text, find, rep, { caseSensitive = false, regex = false } = {}) {
  if (!find) return { text, count: 0 };
  let re;
  try {
    re = new RegExp(regex ? find : find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'gu' : 'giu');
  } catch {
    throw new Error('تعبير نمطي (Regex) غير صالح');
  }
  let count = 0;
  const out = text.replace(re, (...a) => { count++; return rep; });
  return { text: out, count };
}

/* تنسيق النص عند النسخ */
export function formatText(text, o) {
  let lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (o.trimLines) lines = lines.map((l) => l.replace(/[ \t]+/g, ' ').trim());
  if (o.dropBlank) lines = lines.filter((l) => l.trim());
  else if (o.collapseBlank) lines = lines.filter((l, i) => l.trim() || (i > 0 && lines[i - 1].trim()));
  if (o.joinLines) lines = [lines.join(' ').replace(/ {2,}/g, ' ')];
  if (o.style === 'bullets') lines = lines.map((l) => (l.trim() ? `• ${l}` : l));
  else if (o.style === 'dash') lines = lines.map((l) => (l.trim() ? `- ${l}` : l));
  else if (o.style === 'numbered') { let n = 0; lines = lines.map((l) => (l.trim() ? `${++n}. ${l}` : l)); }
  else if (o.style === 'quote') lines = lines.map((l) => `> ${l}`);
  else if (o.style === 'code') lines = ['```', ...lines, '```'];
  return lines.join('\n');
}

/* ───────── كلمات المرور ───────── */
const SETS = {
  lower: 'abcdefghijkmnopqrstuvwxyz',
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  digits: '23456789',
  symbols: '!@#$%^&*-_=+?',
};
const SETS_FULL = { lower: 'abcdefghijklmnopqrstuvwxyz', upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', digits: '0123456789', symbols: SETS.symbols };

function randInt(max, rng) {
  // أخذ عينات بالرفض لتفادي الانحياز (modulo bias)
  const lim = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    rng(buf);
    if (buf[0] < lim) return buf[0] % max;
  }
}

export function generatePassword({ length = 16, lower = true, upper = true, digits = true, symbols = true, avoidAmbiguous = true } = {}, rng = (b) => crypto.getRandomValues(b)) {
  const src = avoidAmbiguous ? SETS : SETS_FULL;
  const pools = [];
  if (lower) pools.push(src.lower);
  if (upper) pools.push(src.upper);
  if (digits) pools.push(src.digits);
  if (symbols) pools.push(src.symbols);
  if (!pools.length) throw new Error('اختر نوعًا واحدًا على الأقل من الرموز');
  length = Math.round(length);
  if (!(length >= pools.length && length <= 128)) throw new Error(`الطول يجب أن يكون بين ${pools.length} و128`);
  const all = pools.join('');
  const chars = pools.map((p) => p[randInt(p.length, rng)]); // حرف واحد على الأقل من كل نوع
  while (chars.length < length) chars.push(all[randInt(all.length, rng)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = randInt(i + 1, rng); [chars[i], chars[j]] = [chars[j], chars[i]]; } // خلط Fisher–Yates
  return { password: chars.join(''), entropyBits: Math.round(length * Math.log2(all.length)) };
}

export function strengthLabel(bits) {
  if (bits < 40) return { label: 'ضعيفة', color: 'var(--danger)', pct: 20 };
  if (bits < 60) return { label: 'متوسطة', color: 'var(--warning)', pct: 50 };
  if (bits < 80) return { label: 'جيدة', color: 'var(--accent)', pct: 75 };
  return { label: 'قوية جدًا', color: 'var(--success)', pct: 100 };
}
