// أيقونات SVG مضمّنة (أسلوب خطي موحّد 24×24) — لا تعتمد على أي مكتبة خارجية.

import { raw } from './html.js';

const P = (d) => `<path d="${d}"/>`;

const ICONS = {
  home: P('M3 11.5 12 4l9 7.5M5.5 10v10h4.5v-6h4v6h4.5V10'),
  book: P('M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2zM12 6.5v13'),
  sparkles: P('M11 3.5l1.9 5 5 1.9-5 1.9-1.9 5-1.9-5-5-1.9 5-1.9zM18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z'),
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/>' + P('M3.5 10h17M8 3v4M16 3v4'),
  timer: '<circle cx="12" cy="13.5" r="7.5"/>' + P('M12 9.5v4l2.5 1.5M9.5 2.5h5'),
  folder: P('M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z'),
  briefcase: P('M4 8.5h16a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1zM9 8.5V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2.5M3 13.5h18'),
  sliders: P('M4 7h9M17 7h3M4 17h3M11 17h9') + '<circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  grid: P('M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z'),
  plus: P('M12 5v14M5 12h14'),
  edit: P('M15.5 5.5l3 3M4.5 19.5l.8-3.8L16.4 4.6a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L8.3 18.7z'),
  trash: P('M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5h6V7'),
  check: P('M5 12.5l4.5 4.5L19 7.5'),
  x: P('M6 6l12 12M18 6L6 18'),
  search: '<circle cx="11" cy="11" r="6.5"/>' + P('M20 20l-4.2-4.2'),
  download: P('M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14'),
  upload: P('M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14'),
  moon: P('M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z'),
  sun: '<circle cx="12" cy="12" r="4"/>' + P('M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8'),
  wifi: P('M2.5 9a15 15 0 0 1 19 0M5.5 12.5a10.5 10.5 0 0 1 13 0M8.8 16a5.5 5.5 0 0 1 6.4 0M12 19.5h.01'),
  'wifi-off': P('M2.5 9a15 15 0 0 1 4-2.6M17.5 6.4A15 15 0 0 1 21.5 9M5.5 12.5a10.5 10.5 0 0 1 3-1.9M15.5 10.6a10.5 10.5 0 0 1 3 1.9M8.8 16a5.5 5.5 0 0 1 6.4 0M12 19.5h.01M3 3l18 18'),
  'chevron-left': P('M14.5 6l-6 6 6 6'),
  'chevron-right': P('M9.5 6l6 6-6 6'),
  'chevron-down': P('M6 9.5l6 6 6-6'),
  'arrow-right': P('M5 12h14M13 6l6 6-6 6'),
  'arrow-left': P('M19 12H5M11 6l-6 6 6 6'),
  play: P('M7.5 4.8v14.4a.6.6 0 0 0 .9.5l11.6-7.2a.6.6 0 0 0 0-1L8.4 4.3a.6.6 0 0 0-.9.5z'),
  pause: P('M8.5 5v14M15.5 5v14'),
  stop: P('M6.5 6.5h11v11h-11z'),
  reset: P('M4 12a8 8 0 1 0 2.5-5.8M4 4.5V9h4.5'),
  skip: P('M5.5 5.5v13l9-6.5zM18.5 5.5v13'),
  star: P('M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z'),
  clock: '<circle cx="12" cy="12" r="8.5"/>' + P('M12 7v5l3 2'),
  flag: P('M5 21V4M5 4h11l-2 4 2 4H5'),
  link: P('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'),
  file: P('M6 3.5h8l4.5 4.5v12.5H6zM14 3.5V8h4.5'),
  note: P('M5 4.5h14v11l-4.5 4.5H5zM14.5 20v-4.5H19M8.5 9h7M8.5 12.5h4'),
  paperclip: P('M20 11.5l-7.8 7.8a4.5 4.5 0 0 1-6.4-6.4l8.2-8.2a3 3 0 0 1 4.2 4.2l-8.2 8.2a1.5 1.5 0 0 1-2.1-2.1l7.4-7.4'),
  send: P('M20.5 3.5L10 14M20.5 3.5L14 20.5l-4-6.5-6.5-4z'),
  copy: P('M8.5 8.5h11v12h-11zM15.5 8.5v-4h-11v12h4'),
  menu: P('M4 7h16M4 12h16M4 17h16'),
  chart: P('M4 19.5V4.5M4 19.5h16M8 15v-3M12 15V8M16 15v-5'),
  tasks: P('M9 6.5h11M9 12h11M9 17.5h11M4 6.5l1 1 2-2M4 12l1 1 2-2M4 17.5l1 1 2-2'),
  user: '<circle cx="12" cy="8" r="4"/>' + P('M4.5 20.5a7.5 7.5 0 0 1 15 0'),
  alert: P('M12 4l9 16H3zM12 10v4M12 17h.01'),
  info: '<circle cx="12" cy="12" r="8.5"/>' + P('M12 11v5M12 8h.01'),
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.5"/>' + P('M4 17l5-5 4 4 3-3 4 4'),
  code: P('M8.5 8l-4 4 4 4M15.5 8l4 4-4 4M13.5 5.5l-3 13'),
  calculator: '<rect x="5" y="3" width="14" height="18" rx="2.5"/>' + P('M8.5 7.5h7v3h-7zM8.5 14h.01M12 14h.01M15.5 14h.01M8.5 17.5h.01M12 17.5h.01M15.5 17.5h.01'),
  braces: P('M8.5 4.5c-2 0-3 1-3 3v2c0 1.5-.8 2.5-2 2.5 1.2 0 2 1 2 2.5v2c0 2 1 3 3 3M15.5 4.5c2 0 3 1 3 3v2c0 1.5.8 2.5 2 2.5-1.2 0-2 1-2 2.5v2c0 2-1 3-3 3'),
  type: P('M5 6V4.5h14V6M12 4.5v15M9 19.5h6'),
  swap: P('M3.5 12h17M7 8.5L3.5 12 7 15.5M17 8.5l3.5 3.5-3.5 3.5'),
  key: '<circle cx="8.5" cy="15.5" r="4"/>' + P('M11.5 12.5L20 4M17 7l3 3'),
  hash: P('M9 4L7.5 20M16.5 4L15 20M4.5 9h16M3.5 15h16'),
  database: P('M12 5c4.4 0 8 1.1 8 2.5S16.4 10 12 10 4 8.9 4 7.5 7.6 5 12 5zM4 7.5v9C4 17.9 7.6 19 12 19s8-1.1 8-2.5v-9M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5'),
  cap: P('M2.5 9.5L12 5l9.5 4.5L12 14zM6.5 11.7V16c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4.3M21.5 9.5v6'),
  refresh: P('M20 11a8 8 0 0 0-14.5-3.5M4 4.5v4h4M4 13a8 8 0 0 0 14.5 3.5M20 19.5v-4h-4'),
  pin: P('M12 16.5V21M8 4.5h8l-1 6 3 3.5H6l3-3.5z'),
  external: P('M14 4.5h5.5V10M19.5 4.5L11 13M17.5 14v4.5a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1H10'),
  chat: P('M4.5 5.5h15v10h-8l-4.5 4v-4h-2.5z'),
  bookmark: P('M7 4.5h10v15l-5-3.5-5 3.5z'),
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".6"/>',
  history: P('M4 12a8 8 0 1 0 2.4-5.7M4 4.5V9h4.5M12 8v4.5l3 1.5'),
  layers: P('M12 4l9 4.5-9 4.5-9-4.5zM3 12.5l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5'),
  list: P('M8.5 6.5H20M8.5 12H20M8.5 17.5H20M4 6.5h.01M4 12h.01M4 17.5h.01'),
  eye: P('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z') + '<circle cx="12" cy="12" r="2.8"/>',
  shield: P('M12 3.5l7 2.5v5.5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z'),
  download2: P('M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14'),
};

export function icon(name, { size = 20, cls = '', label = '' } = {}) {
  const body = ICONS[name];
  if (!body) return raw('');
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return raw(
    `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${body}</svg>`,
  );
}

export const iconNames = () => Object.keys(ICONS);
