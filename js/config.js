// الإعدادات الثابتة للتطبيق — لا تحتوي على أي أسرار.

export const APP = Object.freeze({
  name: 'STUDENT OS',
  version: '1.0.0',
});

export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'studentos.v1';
export const TIMER_KEY = 'studentos.timer.v1';

export const GRADES = ['أولى ثانوي', 'ثانية ثانوي', 'ثالثة ثانوي'];

export const SUBJECT_COLORS = [
  '#4c8dff', '#22d3ee', '#34d399', '#a3e635',
  '#fbbf24', '#fb923c', '#fb7185', '#e879f9',
  '#a78bfa', '#94a3b8',
];

export const LESSON_STATUS = Object.freeze({
  todo: { label: 'لم يبدأ', tone: 'muted' },
  learning: { label: 'قيد الدراسة', tone: 'warning' },
  done: { label: 'مكتمل', tone: 'success' },
});
export const LESSON_STATUS_ORDER = ['todo', 'learning', 'done'];

export const MASTERY_LABELS = ['غير مقيَّم', 'ضعيف', 'مقبول', 'جيد', 'جيد جدًا', 'متقن'];

export const PRIORITIES = Object.freeze({
  high: { label: 'عالية', rank: 0 },
  medium: { label: 'متوسطة', rank: 1 },
  low: { label: 'منخفضة', rank: 2 },
});

export const EVENT_KINDS = Object.freeze({
  weekly: 'حصة أسبوعية متكررة',
  once: 'موعد لمرة واحدة',
  exam: 'امتحان',
});

export const LIMITS = Object.freeze({
  maxFileBytes: 25 * 1024 * 1024,
  maxChats: 30,
  maxMessagesPerChat: 200,
  maxActivity: 100,
  maxAttachmentImageBytes: 4 * 1024 * 1024,
  maxAttachmentTextBytes: 200 * 1024,
  maxAttachments: 4,
  maxInternalBackups: 5,
});

export const NAV = [
  { id: 'dashboard', label: 'الرئيسية', title: 'لوحة التحكم', icon: 'home', primary: true },
  { id: 'curriculum', label: 'المنهج', title: 'منهجي الدراسي', icon: 'book', primary: true },
  { id: 'assistant', label: 'المساعد', title: 'المساعد الذكي', icon: 'sparkles', primary: true },
  { id: 'planner', label: 'المخطط', title: 'مخططي', icon: 'calendar', primary: true },
  { id: 'focus', label: 'التركيز', title: 'التركيز والمذاكرة', icon: 'timer' },
  { id: 'library', label: 'مكتبتي', title: 'مكتبتي', icon: 'folder' },
  { id: 'toolbox', label: 'الأدوات', title: 'الأدوات التقنية', icon: 'briefcase' },
  { id: 'settings', label: 'الإعدادات', title: 'الإعدادات', icon: 'sliders' },
];
export const MORE_ITEM = { id: 'more', label: 'المزيد', title: 'المزيد', icon: 'grid' };
