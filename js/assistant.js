// المساعد الذكي: واجهة محادثة. منطق المزود في js/ai/ منفصل تمامًا.
// لا يعمل المساعد إلا بعد ربط خدمة حقيقية من الإعدادات؛ وإلا تظهر حالة «غير مربوط» بوضوح.

import { getState, mutate, pushActivity } from './storage.js';
import { html, render, raw } from './lib/html.js';
import { icon } from './lib/icons.js';
import { markdown } from './lib/markdown.js';
import { delegate, toast, copyText, confirmDialog, pageHead, fileSize } from './lib/ui.js';
import { uid } from './lib/schema.js';
import { timeAgo } from './lib/dates.js';
import { MODES, modeById } from './ai/prompts.js';
import { aiStatus, ask, AIError } from './ai/client.js';
import { LIMITS } from './config.js';

const TEXT_EXT = /\.(txt|md|csv|json|html?|css|js|py|java|c|cpp|xml)$/i;

function readAs(file, kind) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('تعذّرت قراءة الملف.'));
    if (kind === 'text') r.readAsText(file); else r.readAsDataURL(file);
  });
}

function msgHtml(m) {
  if (m.role === 'user') {
    return html`<div class="msg msg-user"><div class="bubble">${m.content}</div>${m.attachments && m.attachments.length ? html`<div class="msg-tools">${m.attachments.map((n) => html`<span class="badge badge-muted">${icon('paperclip', { size: 12 })} ${n}</span>`)}</div>` : ''}</div>`;
  }
  return html`<div class="msg msg-ai ${m.error ? 'msg-err' : ''}"><div class="bubble">${m.error ? html`<p>${m.content}</p>` : markdown(m.content)}</div>
    ${m.error ? '' : html`<div class="msg-tools"><button class="btn btn-sm btn-ghost" type="button" data-action="copy-msg" data-id="${m.id}">${icon('copy', { size: 14 })} نسخ</button><button class="btn btn-sm btn-ghost" type="button" data-action="save-note" data-id="${m.id}">${icon('note', { size: 14 })} حفظ في مكتبتي</button></div>`}</div>`;
}

export function mount(root, ctx) {
  const ui = { chatId: '', mode: 'explain', pending: null, attachments: [], draft: '', abort: null, showHistory: false };
  const first = getState().chats.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (first) { ui.chatId = first.id; ui.mode = first.mode; }

  const chat = () => getState().chats.find((c) => c.id === ui.chatId) || null;

  function draw() {
    const state = getState();
    const status = aiStatus(state.settings);
    const c = chat();
    const mode = modeById(ui.mode);
    const chats = state.chats.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    render(root, html`<div class="page">
      ${pageHead({
        title: 'المساعد الذكي',
        subtitle: status.ready ? `متصل عبر: ${status.provider}` : 'غير مربوط بأي مزود حاليًا',
        actions: html`<button class="btn btn-ghost" type="button" data-action="toggle-history">${icon('history', { size: 18 })} المحادثات (${chats.length})</button><button class="btn btn-primary" type="button" data-action="new-chat">${icon('plus', { size: 18 })} محادثة جديدة</button>`,
      })}

      ${status.ready ? '' : html`<div class="notice" role="status">
        <span>${icon('alert', { size: 22 })}</span>
        <div><h4>المساعد غير مربوط بعد</h4>
        <p>هذه الواجهة جاهزة، لكنها لا تُنتج أي إجابات إلا بعد ربطها بخدمة ذكاء اصطناعي حقيقية عبر خادم وسيط (يحفظ المفتاح السري بعيدًا عن التطبيق). لا يوجد هنا مساعد يعمل دون اتصال، ولن أتظاهر بذلك.</p>
        <div class="row" style="margin-top:10px"><a class="btn btn-primary btn-sm" href="#/settings?section=ai">ربط مزود من الإعدادات</a></div></div></div>`}

      ${ui.showHistory ? html`<section class="card"><div class="card-head"><h3 class="card-title">${icon('history')} محادثاتك</h3></div>${chats.length === 0 ? html`<p class="muted">لا محادثات محفوظة.</p>` : html`<div class="list">${chats.map((x) => html`<div class="list-item">
        <button class="list-main" type="button" data-action="open-chat" data-id="${x.id}" style="background:none;border:0;text-align:start;color:inherit;padding:0"><div class="list-title ellipsis">${x.title}</div><div class="list-sub"><span>${modeById(x.mode).label}</span><span>${timeAgo(x.updatedAt)}</span><span>${x.messages.length} رسالة</span></div></button>
        <button class="icon-btn icon-btn-sm is-danger" type="button" data-action="del-chat" data-id="${x.id}" aria-label="حذف المحادثة">${icon('trash', { size: 17 })}</button></div>`)}</div>`}</section>` : ''}

      <div class="chips chips-scroll" role="radiogroup" aria-label="نوع المساعدة">${MODES.map((m) => html`<button class="chip ${ui.mode === m.id ? 'is-active' : ''}" type="button" role="radio" aria-checked="${ui.mode === m.id}" data-action="mode" data-mode="${m.id}">${icon(m.icon, { size: 15 })}${m.label}</button>`)}</div>

      <div class="chat" id="chat" aria-live="polite">
        ${!c || c.messages.length === 0
          ? html`<div class="card empty"><div class="empty-ic">${icon(mode.icon, { size: 28 })}</div><h3>${mode.label}</h3><p>${mode.hint} اختر نوع المساعدة من الأعلى ثم اكتب رسالتك.</p>
              ${status.ready && mode.starters.length ? html`<div class="chips row-center">${mode.starters.map((s) => html`<button class="chip" type="button" data-action="starter" data-text="${s}">${s}</button>`)}</div>` : ''}</div>`
          : c.messages.map(msgHtml)}
        ${ui.pending ? html`<div class="msg msg-ai"><div class="bubble"><span class="typing" aria-label="المساعد يكتب"><i></i><i></i><i></i></span></div><div class="msg-tools"><button class="btn btn-sm btn-ghost" type="button" data-action="stop">${icon('stop', { size: 14 })} إيقاف</button></div></div>` : ''}
      </div>

      <form class="composer" data-form="send">
        ${ui.attachments.length ? html`<div class="chips">${ui.attachments.map((a, i) => html`<span class="attach-chip"><span class="ellipsis">${a.name}</span><button class="icon-btn icon-btn-sm" type="button" data-action="rm-attach" data-i="${i}" aria-label="إزالة ${a.name}">${icon('x', { size: 14 })}</button></span>`)}</div>` : ''}
        <div class="composer-row">
          <button class="icon-btn" type="button" data-action="attach" aria-label="إرفاق صورة أو ملف نصي" ${status.ready ? '' : raw('disabled')}>${icon('paperclip')}</button>
          <textarea id="msg-input" rows="1" maxlength="8000" placeholder="${status.ready ? mode.hint : 'اربط مزودًا من الإعدادات لتفعيل المحادثة'}" aria-label="رسالتك" ${status.ready ? '' : raw('disabled')}>${ui.draft}</textarea>
          <button class="btn btn-primary" type="submit" ${status.ready && !ui.pending ? '' : raw('disabled')} aria-label="إرسال">${icon('send', { size: 18 })}</button>
        </div>
        ${status.ready ? html`<div class="muted tiny">قد يخطئ المساعد. راجع الإجابات مع كتابك المدرسي ومعلمك. ما ترسله (بما فيه المرفقات) يُرسل إلى الخدمة التي ربطتها.</div>` : ''}
      </form>
    </div>`);
    const input = root.querySelector('#msg-input');
    if (input) autosize(input);
    scrollEnd();
  }

  const autosize = (el) => { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 180)}px`; };
  const scrollEnd = () => { const el = root.querySelector('.composer'); if (el && ui.pending) el.scrollIntoView({ block: 'end', behavior: 'smooth' }); };

  function ensureChat(firstText) {
    let c = chat();
    if (!c) {
      const now = new Date().toISOString();
      c = { id: uid(), title: firstText.slice(0, 50) || 'محادثة جديدة', mode: ui.mode, createdAt: now, updatedAt: now, messages: [] };
      mutate((s) => {
        s.chats.unshift(c);
        if (s.chats.length > LIMITS.maxChats) s.chats.length = LIMITS.maxChats;
      });
      ui.chatId = c.id;
    }
    return getState().chats.find((x) => x.id === ui.chatId);
  }

  async function send(text) {
    text = text.trim();
    const state = getState();
    if ((!text && !ui.attachments.length) || ui.pending) return;
    if (!aiStatus(state.settings).ready) { toast('اربط مزودًا أولًا من الإعدادات', { type: 'error' }); return; }
    if (!text) text = 'حلّل المرفقات.';

    ensureChat(text);
    const atts = ui.attachments.slice();
    const attachmentsPayload = atts.map((a) => (a.kind === 'image' ? { kind: 'image', mime: a.mime, dataUrl: a.dataUrl } : { kind: 'text', name: a.name, text: a.text }));
    const msg = { id: uid(), role: 'user', content: text.slice(0, 8000), at: new Date().toISOString(), attachments: atts.map((a) => a.name) };
    mutate((s) => {
      const c = s.chats.find((x) => x.id === ui.chatId);
      c.mode = ui.mode; c.messages.push(msg); c.updatedAt = msg.at;
      if (c.messages.length > LIMITS.maxMessagesPerChat) c.messages.splice(0, c.messages.length - LIMITS.maxMessagesPerChat);
    });
    ui.attachments = []; ui.draft = '';
    ui.abort = new AbortController();
    ui.pending = true;
    draw();

    const history = getState().chats.find((x) => x.id === ui.chatId).messages.map((m) => ({ role: m.role, content: m.content }));
    history[history.length - 1].attachments = attachmentsPayload;
    const chatId = ui.chatId;
    try {
      const { text: reply } = await ask({ settings: getState().settings, mode: ui.mode, history, signal: ui.abort.signal });
      mutate((s) => {
        const c = s.chats.find((x) => x.id === chatId);
        if (!c) return;
        c.messages.push({ id: uid(), role: 'assistant', content: reply.slice(0, 20000), at: new Date().toISOString() });
        c.updatedAt = new Date().toISOString();
        pushActivity(s, 'assistant', `سألت المساعد (${modeById(c.mode).label})`);
      });
    } catch (e) {
      const m = e instanceof AIError ? e.message : 'حدث خطأ غير متوقع أثناء الاتصال بالمساعد.';
      if (!(e instanceof AIError && e.code === 'aborted')) {
        mutate((s) => { const c = s.chats.find((x) => x.id === chatId); if (c) c.messages.push({ id: uid(), role: 'assistant', content: m, at: new Date().toISOString(), error: true }); });
      }
    } finally {
      ui.pending = null; ui.abort = null;
      if (ctx.route === 'assistant' && root.isConnected) draw();
    }
  }

  async function addAttachment() {
    const input = document.createElement('input');
    input.type = 'file'; input.multiple = true;
    input.accept = 'image/*,.txt,.md,.csv,.json,.html,.css,.js,.py,text/plain';
    input.addEventListener('change', async () => {
      for (const f of input.files) {
        if (ui.attachments.length >= LIMITS.maxAttachments) { toast(`الحد الأقصى ${LIMITS.maxAttachments} مرفقات`, { type: 'error' }); break; }
        try {
          if (f.type.startsWith('image/')) {
            if (f.size > LIMITS.maxAttachmentImageBytes) { toast(`الصورة «${f.name}» أكبر من ${fileSize(LIMITS.maxAttachmentImageBytes)}`, { type: 'error' }); continue; }
            ui.attachments.push({ kind: 'image', name: f.name, mime: f.type, dataUrl: await readAs(f, 'url') });
          } else if (f.type.startsWith('text/') || TEXT_EXT.test(f.name)) {
            if (f.size > LIMITS.maxAttachmentTextBytes) { toast(`الملف «${f.name}» أكبر من ${fileSize(LIMITS.maxAttachmentTextBytes)}`, { type: 'error' }); continue; }
            ui.attachments.push({ kind: 'text', name: f.name, text: await readAs(f, 'text') });
          } else {
            toast(`نوع الملف «${f.name}» غير مدعوم. المدعوم: الصور والملفات النصية.`, { type: 'error' });
          }
        } catch (e) { toast(e.message, { type: 'error' }); }
      }
      const ta = root.querySelector('#msg-input'); if (ta) ui.draft = ta.value;
      draw();
    });
    input.click();
  }

  const msgById = (id) => (chat() ? chat().messages.find((m) => m.id === id) : null);

  const off = delegate(root, 'click', '[data-action]', async (e, el) => {
    const a = el.dataset.action;
    if (a === 'mode') { ui.mode = el.dataset.mode; const ta = root.querySelector('#msg-input'); if (ta) ui.draft = ta.value; draw(); }
    else if (a === 'new-chat') { ui.chatId = ''; ui.attachments = []; ui.draft = ''; ui.showHistory = false; draw(); }
    else if (a === 'toggle-history') { ui.showHistory = !ui.showHistory; draw(); }
    else if (a === 'open-chat') { ui.chatId = el.dataset.id; ui.mode = chat().mode; ui.showHistory = false; draw(); }
    else if (a === 'del-chat') {
      if (!(await confirmDialog({ title: 'حذف المحادثة', message: 'ستُحذف هذه المحادثة نهائيًا من جهازك.', confirmText: 'حذف', danger: true }))) return;
      mutate((s) => { s.chats = s.chats.filter((c) => c.id !== el.dataset.id); });
      if (ui.chatId === el.dataset.id) ui.chatId = '';
      draw();
    }
    else if (a === 'attach') addAttachment();
    else if (a === 'rm-attach') { ui.attachments.splice(Number(el.dataset.i), 1); const ta = root.querySelector('#msg-input'); if (ta) ui.draft = ta.value; draw(); }
    else if (a === 'stop') { if (ui.abort) ui.abort.abort('user'); }
    else if (a === 'starter') send(el.dataset.text);
    else if (a === 'copy-msg') { const m = msgById(el.dataset.id); if (m) copyText(m.content, 'تم نسخ الإجابة'); }
    else if (a === 'save-note') {
      const m = msgById(el.dataset.id);
      if (!m) return;
      const now = new Date().toISOString();
      mutate((s) => { s.notes.push({ id: uid(), title: `من المساعد: ${chat().title}`.slice(0, 160), body: m.content, category: 'من المساعد', pinned: false, createdAt: now, updatedAt: now }); });
      toast('حُفظت في مكتبتي ← الملاحظات', { type: 'success' });
    }
  });

  const onSubmit = (e) => {
    if (!e.target.closest('[data-form="send"]')) return;
    e.preventDefault();
    send(root.querySelector('#msg-input').value);
  };
  const onKey = (e) => {
    if (e.target.id === 'msg-input' && e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(min-width: 720px)').matches) {
      e.preventDefault();
      send(e.target.value);
    }
  };
  const onInput = (e) => { if (e.target.id === 'msg-input') { ui.draft = e.target.value; autosize(e.target); } };
  root.addEventListener('submit', onSubmit);
  root.addEventListener('keydown', onKey);
  root.addEventListener('input', onInput);

  draw();
  return () => {
    off();
    root.removeEventListener('submit', onSubmit);
    root.removeEventListener('keydown', onKey);
    root.removeEventListener('input', onInput);
    if (ui.abort) ui.abort.abort('user');
  };
}
