// محرّك مؤقت Pomodoro عام: يعمل في الخلفية بين الصفحات ويستمر بعد إعادة تحميل الصفحة.
// يعتمد على الطوابع الزمنية (وليس على عدّاد) فلا ينحرف عند تقييد المتصفح للتبويبات الخلفية.

import { TIMER_KEY } from '../config.js';
import { getState, mutate, pushActivity } from '../storage.js';
import { uid } from './schema.js';
import { toKey } from './dates.js';

const listeners = new Set();
let t = load();
let interval = null;
let lastSecond = -1;
let audioCtx = null;
let wakeLock = null;

function defaults() {
  return {
    phase: 'focus', status: 'idle', plannedMs: 0, endsAt: 0, remainingMs: 0,
    phaseStartedAt: '', cycle: 0, subjectId: '', label: '',
  };
}

function load() {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && ['focus', 'short', 'long'].includes(p.phase) && ['idle', 'running', 'paused'].includes(p.status)) {
        return { ...defaults(), ...p };
      }
    }
  } catch { /* تجاهل */ }
  return defaults();
}

function persist() {
  try { localStorage.setItem(TIMER_KEY, JSON.stringify(t)); } catch { /* تجاهل */ }
}

export function phaseMs(phase) {
  const f = getState().settings.focus;
  const min = phase === 'focus' ? f.focus : phase === 'short' ? f.short : f.long;
  return min * 60 * 1000;
}

export const PHASE_LABEL = { focus: 'تركيز', short: 'استراحة قصيرة', long: 'استراحة طويلة' };

export function snapshot() {
  const now = Date.now();
  const total = t.plannedMs || phaseMs(t.phase);
  let remaining;
  if (t.status === 'running') remaining = Math.max(0, t.endsAt - now);
  else if (t.status === 'paused') remaining = t.remainingMs;
  else remaining = phaseMs(t.phase);
  const cycles = getState().settings.focus.cycles;
  return {
    phase: t.phase,
    status: t.status,
    isBreak: t.phase !== 'focus',
    remainingMs: remaining,
    totalMs: t.status === 'idle' ? phaseMs(t.phase) : total,
    progress: total > 0 ? 1 - remaining / (t.status === 'idle' ? phaseMs(t.phase) : total) : 0,
    cycle: t.cycle,
    cycles,
    subjectId: t.subjectId,
    label: t.label,
    startedAt: t.phaseStartedAt,
  };
}

function emit(type, extra = {}) {
  const snap = snapshot();
  for (const fn of listeners) {
    try { fn(type, snap, extra); } catch (e) { console.warn(e); }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function startTicking() {
  if (interval) return;
  interval = setInterval(tick, 250);
}
function stopTicking() {
  clearInterval(interval);
  interval = null;
  lastSecond = -1;
}

function tick() {
  if (t.status !== 'running') { stopTicking(); return; }
  if (Date.now() >= t.endsAt) { complete(); return; }
  const sec = Math.ceil((t.endsAt - Date.now()) / 1000);
  if (sec !== lastSecond) { lastSecond = sec; emit('tick'); }
}

/* ───── الصوت والاهتزاز وإبقاء الشاشة مضاءة ───── */
function ensureAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* تجاهل */ }
}

function beep() {
  try {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    [0, 0.25, 0.5].forEach((off) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, now + off);
      g.gain.exponentialRampToValueAtTime(0.25, now + off + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + off + 0.2);
      o.connect(g).connect(audioCtx.destination);
      o.start(now + off);
      o.stop(now + off + 0.22);
    });
  } catch { /* تجاهل */ }
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch { /* تجاهل */ }
}

async function acquireWakeLock() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible' && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch { wakeLock = null; }
}
function releaseWakeLock() {
  try { if (wakeLock) wakeLock.release(); } catch { /* تجاهل */ }
  wakeLock = null;
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && t.status === 'running') acquireWakeLock();
});

/* ───── التسجيل ───── */
function logSession(minutes, startedAtIso) {
  if (minutes < 1) return 0;
  const startedAt = startedAtIso || new Date().toISOString();
  mutate((s) => {
    s.sessions.push({
      id: uid(),
      date: toKey(new Date(startedAt)),
      startedAt,
      minutes,
      subjectId: t.subjectId || '',
      label: t.label || '',
      manual: false,
    });
    pushActivity(s, 'focus', `أنهيت جلسة تركيز ${minutes} دقيقة`);
  });
  return minutes;
}

function nextPhaseAfter(phase) {
  if (phase !== 'focus') return { phase: 'focus', cycle: t.cycle };
  const cycles = getState().settings.focus.cycles;
  const done = t.cycle + 1;
  if (done >= cycles) return { phase: 'long', cycle: 0 };
  return { phase: 'short', cycle: done };
}

function complete() {
  // حماية من التسجيل المزدوج عند فتح التطبيق في أكثر من تبويب
  const fresh = load();
  if (fresh.status !== 'running' || fresh.phaseStartedAt !== t.phaseStartedAt) {
    t = fresh;
    if (t.status !== 'running') stopTicking();
    emit('change');
    return;
  }
  const finished = t.phase;
  let logged = 0;
  if (finished === 'focus') {
    const startMs = t.endsAt - t.plannedMs;
    logged = logSession(Math.round(t.plannedMs / 60000), new Date(startMs).toISOString());
  }
  const next = nextPhaseAfter(finished);
  t = { ...t, phase: next.phase, cycle: next.cycle, status: 'idle', plannedMs: 0, endsAt: 0, remainingMs: 0, phaseStartedAt: '' };
  persist();
  stopTicking();
  releaseWakeLock();
  beep();
  emit('complete', { finished, logged, next: next.phase });
}

/* ───── الأوامر ───── */
export function setContext({ subjectId, label }) {
  if (subjectId !== undefined) t.subjectId = subjectId;
  if (label !== undefined) t.label = label;
  persist();
  emit('change');
}

export function setPhase(phase) {
  if (t.status !== 'idle') return;
  t.phase = phase;
  persist();
  emit('change');
}

export function start() {
  ensureAudio();
  const now = Date.now();
  if (t.status === 'idle') {
    t.plannedMs = phaseMs(t.phase);
    t.endsAt = now + t.plannedMs;
    t.phaseStartedAt = new Date(now).toISOString();
  } else if (t.status === 'paused') {
    t.endsAt = now + t.remainingMs;
  } else {
    return;
  }
  t.status = 'running';
  persist();
  startTicking();
  acquireWakeLock();
  emit('change');
}

export function pause() {
  if (t.status !== 'running') return;
  t.remainingMs = Math.max(0, t.endsAt - Date.now());
  t.status = 'paused';
  persist();
  stopTicking();
  releaseWakeLock();
  emit('change');
}

/** إلغاء الجلسة الحالية دون تسجيل */
export function cancel() {
  t = { ...t, phase: 'focus', status: 'idle', plannedMs: 0, endsAt: 0, remainingMs: 0, phaseStartedAt: '' };
  persist();
  stopTicking();
  releaseWakeLock();
  emit('change');
}

/** إنهاء جلسة تركيز مبكرًا وتسجيل الوقت المنقضي (دقيقة واحدة على الأقل) */
export function finishEarly() {
  if (t.phase !== 'focus' || t.status === 'idle') return 0;
  const remaining = t.status === 'running' ? Math.max(0, t.endsAt - Date.now()) : t.remainingMs;
  const elapsedMin = Math.floor((t.plannedMs - remaining) / 60000);
  const logged = logSession(elapsedMin, t.phaseStartedAt);
  t = { ...t, phase: 'focus', status: 'idle', plannedMs: 0, endsAt: 0, remainingMs: 0, phaseStartedAt: '' };
  persist();
  stopTicking();
  releaseWakeLock();
  emit('change');
  return logged;
}

/** تخطي الاستراحة والعودة لجلسة تركيز */
export function skipBreak() {
  if (t.phase === 'focus') return;
  t = { ...t, phase: 'focus', status: 'idle', plannedMs: 0, endsAt: 0, remainingMs: 0, phaseStartedAt: '' };
  persist();
  stopTicking();
  emit('change');
}

export function resetCycle() {
  t.cycle = 0;
  persist();
  emit('change');
}

export function clearTimerStorage() {
  t = defaults();
  try { localStorage.removeItem(TIMER_KEY); } catch { /* تجاهل */ }
  stopTicking();
  releaseWakeLock();
  emit('change');
}

/** يُستدعى عند فتح التطبيق: يستأنف المؤقت أو يُنهي ما انتهى أثناء غياب الصفحة */
export function initTimer() {
  window.addEventListener('storage', (e) => {
    if (e.key !== TIMER_KEY) return;
    t = load();
    if (t.status === 'running') startTicking(); else stopTicking();
    emit('change');
  });
  if (t.status === 'running') {
    if (Date.now() >= t.endsAt) complete();
    else { startTicking(); acquireWakeLock(); }
  }
}
