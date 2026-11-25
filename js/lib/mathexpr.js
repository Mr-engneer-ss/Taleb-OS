// محلّل تعبيرات رياضية آمن (بدون eval). يدعم: + − × ÷ ^ % ! والأقواس والدوال والثوابت.
// دالة نقية قابلة للاختبار في Node.

const FUNCS = {
  sin: (x, t) => Math.sin(t.toRad(x)),
  cos: (x, t) => Math.cos(t.toRad(x)),
  tan: (x, t) => Math.tan(t.toRad(x)),
  asin: (x, t) => t.fromRad(Math.asin(x)),
  acos: (x, t) => t.fromRad(Math.acos(x)),
  atan: (x, t) => t.fromRad(Math.atan(x)),
  sqrt: (x) => Math.sqrt(x),
  cbrt: (x) => Math.cbrt(x),
  abs: (x) => Math.abs(x),
  ln: (x) => Math.log(x),
  log: (x) => Math.log10(x),
  exp: (x) => Math.exp(x),
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
  round: (x) => Math.round(x),
};
const CONSTS = { pi: Math.PI, e: Math.E };

export class MathError extends Error {}

function tokenize(src) {
  const s = src
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/٫/g, '.')
    .replace(/π/g, ' pi ')
    .replace(/√/g, ' sqrt ');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      if (s[j] === 'e' || s[j] === 'E') {
        const m = /^[eE][+-]?\d+/.exec(s.slice(j));
        if (m) j += m[0].length;
      }
      const txt = s.slice(i, j);
      if (!/^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(txt)) throw new MathError('رقم غير صالح');
      out.push({ t: 'num', v: Number(txt) });
      i = j;
    } else if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      out.push({ t: 'id', v: s.slice(i, j).toLowerCase() });
      i = j;
    } else if ('+-*/^%!(),'.includes(c)) {
      out.push({ t: c });
      i++;
    } else {
      throw new MathError(`رمز غير مدعوم: ${c}`);
    }
  }
  return out;
}

function factorial(n) {
  if (!Number.isInteger(n) || n < 0) throw new MathError('المضروب للأعداد الصحيحة غير السالبة فقط');
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/**
 * @param {string} src
 * @param {{angle?:'deg'|'rad', ans?:number}} opts
 */
export function evaluate(src, opts = {}) {
  const angle = opts.angle === 'rad' ? 'rad' : 'deg';
  const trig = {
    toRad: (x) => (angle === 'deg' ? (x * Math.PI) / 180 : x),
    fromRad: (x) => (angle === 'deg' ? (x * 180) / Math.PI : x),
  };
  const tokens = tokenize(String(src));
  if (!tokens.length) throw new MathError('اكتب عملية حسابية');
  let p = 0;
  const peek = () => (tokens[p] ? tokens[p].t : null);
  const eat = (t) => { if (peek() !== t) throw new MathError('تعبير غير مكتمل أو غير صحيح'); return tokens[p++]; };

  // expr := term (('+'|'-') term)*
  function expr() {
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const op = tokens[p++].t;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  // term := unary (('*'|'/'|'%') unary | implicit-mul)*
  function term() {
    let v = unary();
    for (;;) {
      const k = peek();
      if (k === '*') { p++; v *= unary(); }
      else if (k === '/') { p++; const d = unary(); if (d === 0) throw new MathError('لا يمكن القسمة على صفر'); v /= d; }
      else if (k === '%' ) {
        // % كنسبة مئوية إن لم يتبعها معامل، وكباقي قسمة إن تبعها رقم/قوس
        const nxt = tokens[p + 1] ? tokens[p + 1].t : null;
        if (nxt === 'num' || nxt === '(' || nxt === 'id') { p++; const d = unary(); if (d === 0) throw new MathError('لا يمكن القسمة على صفر'); v %= d; }
        else break;
      }
      else if (k === 'num' || k === '(' || k === 'id') { v *= unary(); } // ضرب ضمني: 2π ، 3(4+1)
      else break;
    }
    return v;
  }
  // unary := ('+'|'-') unary | power
  function unary() {
    if (peek() === '-') { p++; return -unary(); }
    if (peek() === '+') { p++; return unary(); }
    return power();
  }
  // power := postfix ('^' unary)?   (يمين الترابط)
  function power() {
    const base = postfix();
    if (peek() === '^') { p++; return Math.pow(base, unary()); }
    return base;
  }
  // postfix := primary ('!' | '%')*
  function postfix() {
    let v = primary();
    for (;;) {
      if (peek() === '!') { p++; v = factorial(v); }
      else if (peek() === '%') {
        const nxt = tokens[p + 1] ? tokens[p + 1].t : null;
        if (nxt === 'num' || nxt === '(' || nxt === 'id') break; // باقي قسمة
        p++; v /= 100;
      } else break;
    }
    return v;
  }
  function primary() {
    const k = peek();
    if (k === 'num') return tokens[p++].v;
    if (k === '(') {
      p++;
      const v = expr();
      eat(')');
      return v;
    }
    if (k === 'id') {
      const name = tokens[p++].v;
      if (name === 'ans') {
        if (!Number.isFinite(opts.ans)) throw new MathError('لا توجد نتيجة سابقة');
        return opts.ans;
      }
      if (name in CONSTS) return CONSTS[name];
      if (name in FUNCS) {
        let arg;
        if (peek() === '(') { p++; arg = expr(); eat(')'); } else arg = unary();
        return FUNCS[name](arg, trig);
      }
      throw new MathError(`دالة أو ثابت غير معروف: ${name}`);
    }
    throw new MathError('تعبير غير مكتمل أو غير صحيح');
  }

  const result = expr();
  if (p < tokens.length) throw new MathError('تعبير غير صحيح قرب النهاية');
  if (Number.isNaN(result)) throw new MathError('نتيجة غير معرّفة رياضيًا');
  if (!Number.isFinite(result)) throw new MathError('النتيجة كبيرة جدًا');
  return result;
}

/** تنسيق الناتج: يزيل أخطاء الفاصلة العائمة مثل 0.1+0.2 */
export function formatResult(n) {
  if (Object.is(n, -0)) return '0';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) return n.toExponential(8).replace(/\.?0+e/, 'e');
  const r = Number(n.toPrecision(12));
  return String(r);
}
