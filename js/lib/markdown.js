// محوّل Markdown مصغّر وآمن (يهرّب كل شيء أولًا ثم يضيف تنسيقًا محدودًا).
// يدعم: عناوين، قوائم، اقتباس، كود، غامق، مائل، كود مضمّن. لا يسمح بروابط أو HTML خام.

import { esc, raw } from './html.js';

function format(seg) {
  let t = esc(seg);
  t = t.replace(/\*\*(\S(?:.*?\S)?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[\s(])\*(\S(?:.*?\S)?)\*(?=[\s).,!?؟،:]|$)/g, '$1<em>$2</em>');
  return t;
}

function inline(s) {
  const segs = s.split('`');
  // عدد الأجزاء المغلقة بشكل صحيح بين علامتي backtick
  const closedCount = segs.length % 2 === 1 ? segs.length : segs.length - 1;
  return segs
    .map((seg, i) => {
      if (i % 2 === 1 && i < closedCount) return `<code>${esc(seg)}</code>`;
      return (i % 2 === 1 ? '`' : '') + format(seg); // backtick غير مغلق يُعرض كما هو
    })
    .join('');
}

function blocks(src) {
  const lines = src.split('\n');
  let out = '';
  let para = [];
  let list = null; // {type:'ul'|'ol', items:[]}

  const flushPara = () => {
    if (para.length) { out += `<p>${para.map(inline).join('<br>')}</p>`; para = []; }
  };
  const flushList = () => {
    if (list) {
      out += `<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.type}>`;
      list = null;
    }
  };

  for (const line of lines) {
    let m;
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if ((m = line.match(/^\s{0,3}(#{1,4})\s+(.+)$/))) {
      flushPara(); flushList();
      const lvl = Math.min(m[1].length + 2, 6);
      out += `<h${lvl}>${inline(m[2])}</h${lvl}>`;
    } else if ((m = line.match(/^\s*[-*•]\s+(.+)$/))) {
      flushPara();
      if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
      list.items.push(m[1]);
    } else if ((m = line.match(/^\s*(\d+)[.)]\s+(.+)$/))) {
      flushPara();
      if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
      list.items.push(m[2]);
    } else if ((m = line.match(/^\s*>\s?(.*)$/))) {
      flushPara(); flushList();
      out += `<blockquote>${inline(m[1])}</blockquote>`;
    } else if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flushPara(); flushList();
      out += '<hr>';
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara(); flushList();
  return out;
}

export function markdown(source) {
  const text = String(source ?? '').replace(/\r\n?/g, '\n');
  const parts = text.split('```');
  let out = '';
  parts.forEach((p, i) => {
    if (i % 2 === 1) {
      const nl = p.indexOf('\n');
      const first = nl >= 0 ? p.slice(0, nl).trim() : '';
      const code = nl >= 0 && /^[\w+#.-]*$/.test(first) ? p.slice(nl + 1) : p;
      out += `<pre class="code" dir="ltr"><code>${esc(code.replace(/\n$/, ''))}</code></pre>`;
    } else {
      out += blocks(p);
    }
  });
  return raw(out);
}
