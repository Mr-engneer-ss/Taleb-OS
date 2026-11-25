// أدوات التاريخ والوقت — أرقام لاتينية موحدة، والأسبوع يبدأ يوم السبت.

export const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5]; // السبت أولًا
export const MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const pad = (n) => String(n).padStart(2, '0');

export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function isValidKey(k) {
  if (typeof k !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(k)) return false;
  const [y, m, d] = k.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function parseKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = () => toKey(new Date());

export function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
}

export function addDaysKey(key, n) {
  return toKey(addDays(parseKey(key), n));
}

/** بداية الأسبوع (السبت) لتاريخ معيّن */
export function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (d.getDay() + 1) % 7; // السبت=0 ... الجمعة=6
  d.setDate(d.getDate() - diff);
  return d;
}

/** فرق الأيام بين مفتاحين (b - a) بدون تأثر بتوقيت الصيف */
export function daysBetween(aKey, bKey) {
  const [ay, am, ad] = aKey.split('-').map(Number);
  const [by, bm, bd] = bKey.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function formatLong(date) {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatShort(key) {
  const d = parseKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatKeyFull(key) {
  const d = parseKey(key);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function relativeDay(key, today = todayKey()) {
  const n = daysBetween(today, key);
  if (n === 0) return 'اليوم';
  if (n === 1) return 'غدًا';
  if (n === 2) return 'بعد غد';
  if (n === -1) return 'أمس';
  if (n === -2) return 'أول أمس';
  if (n > 2 && n <= 10) return `بعد ${n} أيام`;
  if (n > 10) return `بعد ${n} يومًا`;
  if (n < -2 && n >= -10) return `منذ ${-n} أيام`;
  return `منذ ${-n} يومًا`;
}

/** 14:30 → 2:30 م */
export function formatTime(t) {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'م' : 'ص';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

export function formatTimeRange(start, end) {
  if (start && end) return `${formatTime(start)} – ${formatTime(end)}`;
  return formatTime(start) || formatTime(end) || '';
}

/** دقائق → "1 س 30 د" */
export function formatMinutes(min) {
  min = Math.max(0, Math.round(min || 0));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} س ${m} د`;
  if (h) return `${h} س`;
  return `${m} د`;
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

export function timeAgo(isoString, now = Date.now()) {
  const t = new Date(isoString).getTime();
  if (!Number.isFinite(t)) return '';
  const sec = Math.round((now - t) / 1000);
  if (sec < 45) return 'الآن';
  const min = Math.round(sec / 60);
  if (min < 60) return min === 1 ? 'منذ دقيقة' : min === 2 ? 'منذ دقيقتين' : `منذ ${min} دقائق`;
  const hr = Math.round(min / 60);
  if (hr < 24) return hr === 1 ? 'منذ ساعة' : hr === 2 ? 'منذ ساعتين' : `منذ ${hr} ساعات`;
  const day = Math.round(hr / 24);
  if (day < 30) return day === 1 ? 'منذ يوم' : day === 2 ? 'منذ يومين' : `منذ ${day} أيام`;
  return formatShort(toKey(new Date(t)));
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'مساء الخير';
  if (h < 12) return 'صباح الخير';
  if (h < 18) return 'مساء الخير';
  return 'مساء النور';
}

/** شبكة شهر كاملة تبدأ بالسبت: مصفوفة من مفاتيح التواريخ (6×7 أو 5×7) */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = startOfWeek(first);
  const last = new Date(year, month + 1, 0);
  const cells = [];
  let cur = start;
  while (cells.length < 42) {
    cells.push(toKey(cur));
    cur = addDays(cur, 1);
    if (cells.length >= 35 && cur > last && cells.length % 7 === 0) break;
  }
  return cells;
}
