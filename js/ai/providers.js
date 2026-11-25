// طبقة مزودي الذكاء الاصطناعي — منفصلة تمامًا عن واجهة التطبيق.
//
// لإضافة مزود جديد (مثلًا مزود مجاني مستقبلًا):
//   1) أنشئ كائنًا يطبّق الواجهة:
//        { id, name, isConfigured(aiSettings) -> bool,
//          send({ system, messages, model, signal }) -> Promise<{ text }> }
//   2) سجّله في PROVIDERS أدناه.
// لا تضع مفاتيح API السرية في هذا الملف أبدًا: الواجهة الأمامية عامة.
// المفاتيح تبقى في خادم وسيط (انظر docs/ai-proxy-example.md).

import { aiEndpoint } from '../lib/schema.js';

export class AIError extends Error {
  constructor(message, code = 'error') { super(message); this.name = 'AIError'; this.code = code; }
}

const TIMEOUT_MS = 60000;

function pickText(data) {
  if (data && typeof data.reply === 'string') return data.reply;
  if (data && typeof data.text === 'string') return data.text;
  const c = data && data.choices && data.choices[0];
  if (c && c.message && typeof c.message.content === 'string') return c.message.content;
  return '';
}

/**
 * مزود «خادم وسيط»: يرسل الطلب إلى رابط يحدده المستخدم (HTTPS أو localhost).
 *
 * العقد (Request):  POST JSON
 *   { model?: string, system: string, messages: [{ role:'user'|'assistant', content: string,
 *       attachments?: [{ kind:'image', mime, dataUrl } | { kind:'text', name, text }] }] }
 * العقد (Response): JSON  { reply: string }  (يُقبل أيضًا { choices:[{message:{content}}] })
 */
const proxyProvider = {
  id: 'proxy',
  name: 'خادم وسيط (API)',
  isConfigured: (ai) => !!aiEndpoint(ai && ai.endpoint),
  async send({ system, messages, model, endpoint, signal }) {
    const url = aiEndpoint(endpoint);
    if (!url) throw new AIError('رابط الخدمة غير صالح. يجب أن يبدأ بـ https:// (أو http://localhost للتجربة).', 'config');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort('timeout'), TIMEOUT_MS);
    const onAbort = () => ctrl.abort('user');
    if (signal) signal.addEventListener('abort', onAbort);

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model || undefined, system, messages }),
        signal: ctrl.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
    } catch (e) {
      if (ctrl.signal.aborted) {
        throw new AIError(ctrl.signal.reason === 'user' ? 'تم إيقاف الطلب.' : 'انتهت مهلة الاتصال بالخدمة. حاول مرة أخرى.', ctrl.signal.reason === 'user' ? 'aborted' : 'timeout');
      }
      if (!navigator.onLine) throw new AIError('لا يوجد اتصال بالإنترنت.', 'offline');
      throw new AIError('تعذّر الوصول إلى الخدمة. تحقق من الرابط وإعدادات CORS في الخادم الوسيط.', 'network');
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }

    if (!res.ok) {
      let detail = '';
      try { const j = await res.json(); detail = (j && (j.error && (j.error.message || j.error))) || j.message || ''; } catch { /* تجاهل */ }
      const msg = res.status === 429 ? 'تم تجاوز حد الاستخدام. انتظر قليلًا ثم أعد المحاولة.'
        : res.status === 401 || res.status === 403 ? 'الخدمة رفضت الطلب (غير مصرّح). راجع إعدادات الخادم الوسيط.'
        : `ردّت الخدمة بخطأ (${res.status}).`;
      throw new AIError(detail && typeof detail === 'string' ? `${msg} ${detail.slice(0, 200)}` : msg, 'http');
    }

    let data;
    try { data = await res.json(); } catch { throw new AIError('رد الخدمة ليس JSON صالحًا.', 'format'); }
    const text = pickText(data).trim();
    if (!text) throw new AIError('ردّت الخدمة بدون نص. تحقق من تنسيق الاستجابة المتوقع { "reply": "..." }.', 'format');
    return { text };
  },
};

const PROVIDERS = { [proxyProvider.id]: proxyProvider };

export const listProviders = () => Object.values(PROVIDERS);
export const getProvider = (id) => PROVIDERS[id] || null;
