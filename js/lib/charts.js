// رسوم بيانية خفيفة (SVG + CSS) بدون مكتبات — تدعم RTL والحركة الخفيفة.

import { html } from './html.js';

const clampPct = (n) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

/** دائرة تقدم */
export function donut({ percent = 0, size = 132, stroke = 12, color = 'var(--primary)', label = '', sub = '' }) {
  const p = clampPct(percent);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - p / 100);
  const mid = size / 2;
  return html`<div class="donut" style="width:${size}px;height:${size}px" role="img" aria-label="${label} ${Math.round(p)}%">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      <circle class="donut-track" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${stroke}"/>
      <circle class="donut-fill" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${stroke}" transform="rotate(-90 ${mid} ${mid})"
        style="stroke:${color};stroke-dasharray:${c.toFixed(2)};stroke-dashoffset:${off.toFixed(2)};--c:${c.toFixed(2)}"/>
    </svg>
    <div class="donut-center"><strong>${Math.round(p)}%</strong>${sub ? html`<span>${sub}</span>` : ''}</div>
  </div>`;
}

/** أعمدة أفقية: [{label, value, max, color, text}] */
export function hbars(items) {
  return html`<div class="hbars">${items.map((it) => {
    const pct = it.max > 0 ? clampPct((it.value / it.max) * 100) : 0;
    return html`<div class="hbar">
      <div class="hbar-head"><span class="hbar-label">${it.dot ? html`<i class="dot" style="background:${it.color || 'var(--primary)'}"></i>` : ''}${it.label}</span><span class="hbar-text">${it.text ?? ''}</span></div>
      <div class="bar"><i style="width:${pct}%;background:${it.color || 'var(--primary)'}"></i></div>
    </div>`;
  })}</div>`;
}

/** أعمدة رأسية: [{label, value, text, highlight}] */
export function vbars(items, { max, height = 132 } = {}) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return html`<div class="vbars" style="--h:${height}px">${items.map((it) => {
    const pct = clampPct((it.value / top) * 100);
    return html`<div class="vbar ${it.highlight ? 'is-hl' : ''}">
      <span class="vbar-val">${it.value > 0 ? (it.text ?? it.value) : ''}</span>
      <div class="vbar-col"><i style="height:${it.value > 0 ? Math.max(pct, 4) : 0}%"></i></div>
      <span class="vbar-label">${it.label}</span>
    </div>`;
  })}</div>`;
}

/** شريط مجزأ: [{label, value, color}] */
export function stacked(segments) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  return html`<div class="stacked-wrap">
    <div class="stacked" role="img" aria-label="${segments.map((s) => `${s.label}: ${s.value}`).join('، ')}">
      ${total > 0 ? segments.filter((s) => s.value > 0).map((s) => html`<i style="width:${(s.value / total) * 100}%;background:${s.color}"></i>`) : ''}
    </div>
    <div class="legend">${segments.map((s) => html`<span class="legend-item"><i class="dot" style="background:${s.color}"></i>${s.label} <b>${s.value}</b></span>`)}</div>
  </div>`;
}
