// بنية البيانات + التحقق + التطبيع. وحدة نقية (بدون DOM) حتى يمكن اختبارها في Node.

import { SCHEMA_VERSION, GRADES, LIMITS } from '../config.js';
import { isValidKey } from './dates.js';

let counter = 0;
export function uid() {
  counter = (counter + 1) % 46656;
  return Date.now().toString(36) + counter.toString(36).padStart(3, '0') + Math.random().toString(36).slice(2, 6);
}

export function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {
      name: '',
      grade: GRADES[0],
      theme: 'dark',
      focus: { focus: 25, short: 5, long: 15, cycles: 4 },
      ai: { provider: 'proxy', endpoint: '', model: '' },
    },
    subjects: [],
    tasks: [],
    events: [],
    sessions: [],
    notes: [],
    links: [],
    chats: [],
    activity: [],
  };
}

/* ───────── مُنقّيات القيم ───────── */
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v, max = 200, fb = '') => {
  if (typeof v === 'string') return v.trim().slice(0, max);
  if (typeof v === 'number' && Number.isFinite(v)) return String(v).slice(0, max);
  return fb;
};
const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const int = (v, min, max, fb) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fb;
};
const oneOf = (v, list, fb) => (list.includes(v) ? v : fb);
const dateKey = (v) => (isValidKey(v) ? v : '');
const timeKey = (v) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : '');
const isoOr = (v, fb) => {
  if (typeof v !== 'string') return fb;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? fb : d.toISOString();
};
const color = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : '#4c8dff');
const httpUrl = (v) => {
  if (typeof v !== 'string') return '';
  try {
    const u = new URL(v.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
};

function mapList(arr, ctx, fn, cap = Infinity) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of arr) {
    if (out.length >= cap) { ctx.dropped++; continue; }
    const item = isObj(raw) ? fn(raw, ctx) : null;
    if (!item) { ctx.dropped++; continue; }
    if (seen.has(item.id)) item.id = uid();
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

const idOf = (v) => (typeof v === 'string' && v.length > 0 && v.length <= 64 ? v : uid());

function normLesson(r) {
  const title = str(r.title, 160);
  if (!title) return null;
  return {
    id: idOf(r.id),
    title,
    status: oneOf(r.status, ['todo', 'learning', 'done'], 'todo'),
    mastery: int(r.mastery, 0, 5, 0),
    notes: text(r.notes, 5000),
    reviewDate: dateKey(r.reviewDate),
    updatedAt: isoOr(r.updatedAt, new Date().toISOString()),
    ...(r.demo === true ? { demo: true } : {}),
  };
}

function normUnit(r, ctx) {
  const name = str(r.name, 120);
  if (!name) return null;
  return {
    id: idOf(r.id),
    name,
    lessons: mapList(r.lessons, ctx, normLesson, 500),
    ...(r.demo === true ? { demo: true } : {}),
  };
}

function normSubject(r, ctx) {
  const name = str(r.name, 80);
  if (!name) return null;
  return {
    id: idOf(r.id),
    name,
    color: color(r.color),
    desc: str(r.desc, 300),
    units: mapList(r.units, ctx, normUnit, 100),
    createdAt: isoOr(r.createdAt, new Date().toISOString()),
    ...(r.demo === true ? { demo: true } : {}),
  };
}

function normTask(r) {
  const title = str(r.title, 200);
  if (!title) return null;
  const done = r.done === true;
  return {
    id: idOf(r.id),
    title,
    priority: oneOf(r.priority, ['high', 'medium', 'low'], 'medium'),
    due: dateKey(r.due),
    done,
    doneAt: done ? isoOr(r.doneAt, new Date().toISOString()) : '',
    subjectId: str(r.subjectId, 64),
    notes: text(r.notes, 1000),
    createdAt: isoOr(r.createdAt, new Date().toISOString()),
    ...(r.demo === true ? { demo: true } : {}),
  };
}

function normEvent(r) {
  const title = str(r.title, 160);
  const kind = oneOf(r.kind, ['weekly', 'once', 'exam'], null);
  if (!title || !kind) return null;
  const ev = {
    id: idOf(r.id),
    kind,
    title,
    subjectId: str(r.subjectId, 64),
    start: timeKey(r.start),
    end: timeKey(r.end),
    place: str(r.place, 120),
    notes: text(r.notes, 1000),
  };
  if (kind === 'weekly') {
    const wd = Number(r.weekday);
    if (!Number.isInteger(wd) || wd < 0 || wd > 6) return null;
    ev.weekday = wd;
  } else {
    ev.date = dateKey(r.date);
    if (!ev.date) return null;
  }
  if (r.demo === true) ev.demo = true;
  return ev;
}

function normSession(r) {
  const startedAt = isoOr(r.startedAt, '');
  const date = dateKey(r.date) || (startedAt ? dateKey(startedAt.slice(0, 10)) : '');
  if (!date) return null;
  return {
    id: idOf(r.id),
    date,
    startedAt: startedAt || `${date}T12:00:00.000Z`,
    minutes: int(r.minutes, 1, 1440, 1),
    subjectId: str(r.subjectId, 64),
    label: str(r.label, 120),
    manual: r.manual === true,
    ...(r.demo === true ? { demo: true } : {}),
  };
}

function normNote(r) {
  const title = str(r.title, 160);
  const body = text(r.body, 50000);
  if (!title && !body.trim()) return null;
  const now = new Date().toISOString();
  return {
    id: idOf(r.id),
    title: title || 'ملاحظة بدون عنوان',
    body,
    category: str(r.category, 40) || 'عام',
    pinned: r.pinned === true,
    createdAt: isoOr(r.createdAt, now),
    updatedAt: isoOr(r.updatedAt, now),
    ...(r.demo === true ? { demo: true } : {}),
  };
}

function normLink(r) {
  const url = httpUrl(r.url);
  if (!url) return null;
  return {
    id: idOf(r.id),
    url,
    title: str(r.title, 160) || url,
    category: str(r.category, 40) || 'عام',
    createdAt: isoOr(r.createdAt, new Date().toISOString()),
    ...(r.demo === true ? { demo: true } : {}),
  };
}

function normMessage(r) {
  const role = oneOf(r.role, ['user', 'assistant'], null);
  const content = text(r.content, 20000);
  if (!role || !content) return null;
  return {
    id: idOf(r.id),
    role,
    content,
    at: isoOr(r.at, new Date().toISOString()),
    ...(Array.isArray(r.attachments) ? { attachments: r.attachments.filter((a) => typeof a === 'string').slice(0, 8).map((a) => a.slice(0, 120)) } : {}),
    ...(r.error === true ? { error: true } : {}),
  };
}

function normChat(r, ctx) {
  const now = new Date().toISOString();
  const messages = mapList(r.messages, ctx, normMessage, LIMITS.maxMessagesPerChat);
  return {
    id: idOf(r.id),
    title: str(r.title, 80) || 'محادثة جديدة',
    mode: str(r.mode, 20) || 'explain',
    createdAt: isoOr(r.createdAt, now),
    updatedAt: isoOr(r.updatedAt, now),
    messages,
  };
}

function normActivity(r) {
  const t = str(r.text, 200);
  if (!t) return null;
  return { id: idOf(r.id), type: str(r.type, 20) || 'info', text: t, at: isoOr(r.at, new Date().toISOString()) };
}

export function aiEndpoint(v) {
  if (typeof v !== 'string') return '';
  const t = v.trim();
  if (!t) return '';
  try {
    const u = new URL(t);
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol === 'https:' || (u.protocol === 'http:' && local)) return u.href;
  } catch { /* تجاهل */ }
  return '';
}

/**
 * يحوّل أي كائن إلى حالة صالحة بالكامل.
 * @returns {{state:object, dropped:number, invalid:boolean}}
 */
export function normalizeState(raw) {
  const ctx = { dropped: 0 };
  const s = defaultState();
  if (!isObj(raw)) return { state: s, dropped: 0, invalid: true };

  const st = isObj(raw.settings) ? raw.settings : {};
  const f = isObj(st.focus) ? st.focus : {};
  const ai = isObj(st.ai) ? st.ai : {};
  s.settings = {
    name: str(st.name, 40),
    grade: oneOf(st.grade, GRADES, GRADES[0]),
    theme: oneOf(st.theme, ['dark', 'light'], 'dark'),
    focus: {
      focus: int(f.focus, 1, 180, 25),
      short: int(f.short, 1, 60, 5),
      long: int(f.long, 1, 90, 15),
      cycles: int(f.cycles, 2, 8, 4),
    },
    ai: { provider: 'proxy', endpoint: aiEndpoint(ai.endpoint), model: str(ai.model, 80) },
  };

  s.subjects = mapList(raw.subjects, ctx, normSubject, 60);
  s.tasks = mapList(raw.tasks, ctx, normTask, 2000);
  s.events = mapList(raw.events, ctx, normEvent, 1000);
  s.sessions = mapList(raw.sessions, ctx, normSession, 20000);
  s.notes = mapList(raw.notes, ctx, normNote, 3000);
  s.links = mapList(raw.links, ctx, normLink, 3000);
  s.chats = mapList(raw.chats, ctx, normChat, LIMITS.maxChats);
  s.activity = mapList(raw.activity, ctx, normActivity, LIMITS.maxActivity);

  return { state: s, dropped: ctx.dropped, invalid: false };
}

export function countsOf(state) {
  let lessons = 0;
  for (const sub of state.subjects) for (const u of sub.units) lessons += u.lessons.length;
  return {
    subjects: state.subjects.length,
    lessons,
    tasks: state.tasks.length,
    events: state.events.length,
    sessions: state.sessions.length,
    notes: state.notes.length,
    links: state.links.length,
    chats: state.chats.length,
  };
}

/** غلاف ملف النسخة الاحتياطية */
export function buildBackup(state, files = [], appVersion = '1.0.0') {
  const { schemaVersion, ...data } = state;
  return {
    app: 'student-os',
    schemaVersion: SCHEMA_VERSION,
    appVersion,
    exportedAt: new Date().toISOString(),
    data: { schemaVersion, ...data },
    files,
  };
}

function fail(error) {
  return { ok: false, error };
}

/** تحقق صارم من ملف نسخة احتياطية قبل استيراده */
export function validateBackup(obj) {
  if (!isObj(obj)) return fail('الملف ليس نسخة احتياطية صالحة (محتوى JSON غير متوقع).');
  if (obj.app !== 'student-os') return fail('هذا الملف ليس نسخة احتياطية من STUDENT OS.');
  if (!Number.isInteger(obj.schemaVersion) || obj.schemaVersion < 1) return fail('رقم إصدار النسخة غير صالح.');
  if (obj.schemaVersion > SCHEMA_VERSION) return fail('هذه النسخة أحدث من إصدار التطبيق الحالي. حدّث التطبيق أولًا.');
  if (!isObj(obj.data)) return fail('بيانات النسخة مفقودة أو تالفة.');

  const { state, dropped } = normalizeState(obj.data);

  const files = [];
  let droppedFiles = 0;
  if (obj.files !== undefined) {
    if (!Array.isArray(obj.files)) return fail('قسم الملفات في النسخة غير صالح.');
    for (const f of obj.files) {
      if (!isObj(f) || typeof f.dataBase64 !== 'string' || !f.dataBase64 || typeof f.name !== 'string' || !f.name.trim()) {
        droppedFiles++;
        continue;
      }
      files.push({
        id: idOf(f.id),
        name: str(f.name, 200),
        type: str(f.type, 100) || 'application/octet-stream',
        category: str(f.category, 40) || 'عام',
        createdAt: isoOr(f.createdAt, new Date().toISOString()),
        dataBase64: f.dataBase64,
      });
    }
  }

  return {
    ok: true,
    state,
    dropped,
    files,
    droppedFiles,
    counts: countsOf(state),
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : '',
  };
}
