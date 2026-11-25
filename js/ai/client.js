// واجهة موحّدة يستخدمها قسم المساعد: تجهّز الرسائل وتستدعي المزود المضبوط.
// هذه الوحدة لا تعرف شيئًا عن الواجهة (DOM).

import { getProvider, AIError } from './providers.js';
import { modeById } from './prompts.js';

const MAX_CONTEXT_MESSAGES = 16;

export function aiStatus(settings) {
  const ai = settings.ai || {};
  const provider = getProvider(ai.provider);
  if (!provider) return { ready: false, reason: 'لم يتم اختيار مزود.' };
  if (!provider.isConfigured(ai)) return { ready: false, reason: 'لم يتم ربط مزود ذكاء اصطناعي بعد.' };
  return { ready: true, provider: provider.name, endpoint: ai.endpoint };
}

/**
 * @param {object} p { settings, mode, history:[{role,content,attachments?}], signal }
 * @returns {Promise<{text:string}>}
 */
export async function ask({ settings, mode, history, signal }) {
  const ai = settings.ai || {};
  const provider = getProvider(ai.provider);
  if (!provider || !provider.isConfigured(ai)) throw new AIError('لم يتم ربط مزود ذكاء اصطناعي بعد.', 'config');
  const system = `${modeById(mode).system}\nالصف الدراسي للطالب: ${settings.grade}.`;
  const messages = history.slice(-MAX_CONTEXT_MESSAGES).map((m) => ({ role: m.role, content: m.content, ...(m.attachments && m.attachments.length ? { attachments: m.attachments } : {}) }));
  return provider.send({ system, messages, model: ai.model, endpoint: ai.endpoint, signal });
}

export async function testConnection(settings, signal) {
  const res = await ask({ settings, mode: 'explain', history: [{ role: 'user', content: 'اكتب كلمة واحدة فقط: جاهز' }], signal });
  return res.text;
}

export { AIError };
