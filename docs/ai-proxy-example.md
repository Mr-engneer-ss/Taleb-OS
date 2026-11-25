# ربط المساعد الذكي بمزود API

المساعد في STUDENT OS **غير مربوط افتراضيًا**. التطبيق يعمل على GitHub Pages (موقع ثابت)، وأي مفتاح API يوضع في ملفات الواجهة يراه كل زائر. لذلك المفتاح السري يجب ألا يكون في التطبيق أبدًا، ويوضع في **خادم وسيط صغير** (Proxy) ترسل إليه الواجهة الطلب.

```
التطبيق (المتصفح)  ──POST──▶  خادم وسيط (يحمل المفتاح السري)  ──▶  مزود الذكاء الاصطناعي
```

## 1) العقد بين التطبيق والخادم الوسيط

يرسل التطبيق `POST` بصيغة JSON إلى الرابط الذي تحدده في **الإعدادات ← ربط المساعد الذكي**:

```json
{
  "model": "اختياري — الاسم الذي كتبته في الإعدادات",
  "system": "تعليمات المساعد حسب النمط المختار (شرح، حل، تلخيص...)",
  "messages": [
    { "role": "user", "content": "نص الطالب",
      "attachments": [
        { "kind": "image", "mime": "image/png", "dataUrl": "data:image/png;base64,..." },
        { "kind": "text", "name": "notes.txt", "text": "محتوى الملف" }
      ] },
    { "role": "assistant", "content": "رد سابق" }
  ]
}
```

ويجب أن يعيد الخادم:

```json
{ "reply": "نص الإجابة (يُعرض بتنسيق Markdown مبسّط)" }
```

يُقبل أيضًا الشكل `{ "choices": [{ "message": { "content": "..." } }] }`. عند الخطأ أعد رمز HTTP مناسبًا (مثل 429) و`{ "error": "..." }` ليظهر للطالب.

الشروط الأمنية المطلوبة في الخادم الوسيط:
- تفعيل **CORS** لنطاق تطبيقك فقط (مثل `https://USERNAME.github.io`) وليس `*` في الإنتاج.
- وضع **حد للاستخدام** (Rate limit) وحد لحجم الطلب، وإلا يستغل الآخرون مفتاحك.
- المفتاح في متغيرات البيئة السرية للخدمة، لا في الكود.

## 2) مثال: Cloudflare Worker

> هذا مثال توضيحي **لم يُجرَّب على مزود حقيقي** ضمن هذا المشروع. عدّل عنوان المزود وشكل الطلب حسب وثائق المزود الذي تختاره، وراجع أسعاره وحدوده المجانية الحالية بنفسك.

```js
// worker.js  — المتغيرات السرية: UPSTREAM_URL ، UPSTREAM_KEY ، ALLOWED_ORIGIN
export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });
    if (request.headers.get('Origin') !== env.ALLOWED_ORIGIN) return new Response('Forbidden', { status: 403 });

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.messages)) return Response.json({ error: 'طلب غير صالح' }, { status: 400, headers: cors });

    // مثال لمزود متوافق مع شكل OpenAI Chat Completions (تجاهل المرفقات هنا للتبسيط)
    const upstream = await fetch(env.UPSTREAM_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.UPSTREAM_KEY}` },
      body: JSON.stringify({
        model: body.model || 'اسم-النموذج',
        messages: [{ role: 'system', content: body.system || '' }, ...body.messages.map(({ role, content }) => ({ role, content }))],
      }),
    });
    if (!upstream.ok) return Response.json({ error: `خطأ من المزود (${upstream.status})` }, { status: upstream.status, headers: cors });
    const data = await upstream.json();
    return Response.json({ reply: data.choices?.[0]?.message?.content ?? '' }, { headers: cors });
  },
};
```

بعد النشر انسخ رابط الـ Worker إلى الإعدادات واضغط **اختبار الاتصال**.

## 3) إضافة مزود جديد في الكود

الفصل بين الذكاء الاصطناعي وبقية التطبيق في المجلد `js/ai/`:

| الملف | المسؤولية |
|---|---|
| `providers.js` | تعريف المزودين وتنفيذ الاتصال. أضف كائن مزود جديد (`id`, `name`, `isConfigured`, `send`) وسجّله في `PROVIDERS`. |
| `client.js` | واجهة موحّدة يستخدمها قسم المساعد: `aiStatus` و`ask` و`testConnection`. |
| `prompts.js` | أنماط المساعد وتعليماته. |

واجهة المساعد (`js/assistant.js`) لا تعرف أي مزود بعينه، فلا تحتاج لتعديلها عند إضافة مزود.
