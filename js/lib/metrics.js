// حسابات الإحصاءات — دوال نقية تعتمد على الحالة فقط.

import { addDays, addDaysKey, daysBetween, parseKey, startOfWeek, toKey } from './dates.js';

export function subjectStats(subject) {
  const byMastery = [0, 0, 0, 0, 0, 0];
  let total = 0, done = 0, learning = 0, todo = 0, mSum = 0, mCount = 0;
  for (const u of subject.units) {
    for (const l of u.lessons) {
      total++;
      if (l.status === 'done') done++;
      else if (l.status === 'learning') learning++;
      else todo++;
      byMastery[l.mastery]++;
      if (l.mastery > 0) { mSum += l.mastery; mCount++; }
    }
  }
  return {
    total, done, learning, todo,
    percent: total ? Math.round((done / total) * 100) : 0,
    avgMastery: mCount ? mSum / mCount : 0,
    byMastery,
    units: subject.units.length,
  };
}

export function unitStats(unit) {
  const total = unit.lessons.length;
  const done = unit.lessons.filter((l) => l.status === 'done').length;
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function overallStats(state) {
  let total = 0, done = 0, learning = 0, todo = 0;
  for (const s of state.subjects) {
    const st = subjectStats(s);
    total += st.total; done += st.done; learning += st.learning; todo += st.todo;
  }
  return { total, done, learning, todo, percent: total ? Math.round((done / total) * 100) : 0, subjects: state.subjects.length };
}

/** دروس موعد مراجعتها حل (أو فات) */
export function reviewsDue(state, today) {
  const out = [];
  for (const s of state.subjects) {
    for (const u of s.units) {
      for (const l of u.lessons) {
        if (l.reviewDate && l.reviewDate <= today) out.push({ subject: s, unit: u, lesson: l });
      }
    }
  }
  return out.sort((a, b) => a.lesson.reviewDate.localeCompare(b.lesson.reviewDate));
}

export function eventsOnDate(state, key) {
  const wd = parseKey(key).getDay();
  const list = state.events.filter((e) => (e.kind === 'weekly' ? e.weekday === wd : e.date === key));
  return list.sort((a, b) => (a.start || '').localeCompare(b.start || '') || a.title.localeCompare(b.title, 'ar'));
}

export function nextExam(state, today) {
  const upcoming = state.events
    .filter((e) => e.kind === 'exam' && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || ''));
  if (!upcoming.length) return null;
  return { event: upcoming[0], daysLeft: daysBetween(today, upcoming[0].date) };
}

export function taskStats(state, today) {
  let dueToday = 0, dueTodayDone = 0, overdue = 0, open = 0, doneTotal = 0, upcoming = 0;
  for (const t of state.tasks) {
    if (t.done) doneTotal++;
    else open++;
    if (t.due === today) {
      dueToday++;
      if (t.done) dueTodayDone++;
    }
    if (!t.done && t.due && t.due < today) overdue++;
    if (!t.done && t.due && t.due > today) upcoming++;
  }
  return { dueToday, dueTodayDone, overdue, open, doneTotal, upcoming };
}

export const isOverdue = (t, today) => !t.done && !!t.due && t.due < today;

export function focusMinutesOn(state, key) {
  let m = 0;
  for (const s of state.sessions) if (s.date === key) m += s.minutes;
  return m;
}

export function focusSummary(state, today) {
  const weekStart = toKey(startOfWeek(parseKey(today)));
  let todayMin = 0, weekMin = 0, total = 0;
  for (const s of state.sessions) {
    total += s.minutes;
    if (s.date === today) todayMin += s.minutes;
    if (s.date >= weekStart && s.date <= today) weekMin += s.minutes;
  }
  return { today: todayMin, week: weekMin, total, count: state.sessions.length };
}

/** دقائق التركيز لآخر n يومًا تنتهي بـ today */
export function focusLastDays(state, today, n = 7) {
  const out = [];
  const byDate = new Map();
  for (const s of state.sessions) byDate.set(s.date, (byDate.get(s.date) || 0) + s.minutes);
  for (let i = n - 1; i >= 0; i--) {
    const key = addDaysKey(today, -i);
    out.push({ key, minutes: byDate.get(key) || 0 });
  }
  return out;
}

/** دقائق كل يوم في الأسبوع الحالي (من السبت) */
export function focusCurrentWeek(state, today) {
  const start = startOfWeek(parseKey(today));
  const byDate = new Map();
  for (const s of state.sessions) byDate.set(s.date, (byDate.get(s.date) || 0) + s.minutes);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const key = toKey(d);
    out.push({ key, weekday: d.getDay(), minutes: byDate.get(key) || 0 });
  }
  return out;
}

export function focusBySubject(state) {
  const map = new Map();
  for (const s of state.sessions) {
    const k = s.subjectId || '';
    map.set(k, (map.get(k) || 0) + s.minutes);
  }
  return [...map.entries()].map(([subjectId, minutes]) => ({ subjectId, minutes })).sort((a, b) => b.minutes - a.minutes);
}

export function findLesson(state, lessonId) {
  for (const s of state.subjects) for (const u of s.units) for (const l of u.lessons) if (l.id === lessonId) return { subject: s, unit: u, lesson: l };
  return null;
}
