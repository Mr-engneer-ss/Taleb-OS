// مساعدات للمواد الدراسية تُستخدم في أكثر من قسم.

export function subjectOptions(state, emptyLabel = '— بدون مادة —') {
  return [{ value: '', label: emptyLabel }, ...state.subjects.map((s) => ({ value: s.id, label: s.name }))];
}

export const findSubject = (state, id) => state.subjects.find((s) => s.id === id) || null;
export const subjectName = (state, id) => (findSubject(state, id) || { name: '' }).name;
export const subjectColor = (state, id, fallback = 'var(--primary)') => (findSubject(state, id) || { color: fallback }).color;

/** يزيل الإشارات إلى مادة محذوفة من باقي الأقسام */
export function detachSubject(state, id) {
  for (const t of state.tasks) if (t.subjectId === id) t.subjectId = '';
  for (const e of state.events) if (e.subjectId === id) e.subjectId = '';
  for (const s of state.sessions) if (s.subjectId === id) s.subjectId = '';
}
