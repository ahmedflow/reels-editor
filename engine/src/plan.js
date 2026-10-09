// منطق الخطة المشترك بين الرندر والمحرّر: الطابع، شكل الكتابة، الأصوات، فحص الهدوء، وإعادة التوقيت.
// ملف جافاسكربت صافي بدون JSX عشان تقراه أدوات Node والمتصفح سوا.

export const W = 1080;
export const H = 1920;
// ارتفاع المتحدث لما الشاشة تنقسم، والباقي تحته للرسمة
export const SPLIT_H = 900;

// الطابع: قوة القربة عند كل قصّة، وحجم الكتابة وحركتها
export const STYLES = {
  calm: {zooms: [1, 1.05], capSize: 84, perPage: 3, chars: 18, reveal: false, pop: 0, tilt: 0},
  formal: {zooms: [1, 1.08], capSize: 92, perPage: 3, chars: 16, reveal: true, pop: 0.05, tilt: 0},
  hype: {zooms: [1, 1.16, 1.06, 1.2], capSize: 112, perPage: 2, chars: 12, reveal: true, pop: 0.12, tilt: -2},
};

export const styleOf = (plan) => STYLES[plan?.style] || STYLES.formal;
export const layoutOf = (sc) => (sc?.layout === 'split' ? 'split' : 'full');

// شكل الكتابة: الطابع يعطي الأساس، و plan.captions يبدّل اللي يبغاه صاحب المقطع
export function captionStyle(plan, th) {
  const st = styleOf(plan);
  const c = plan?.captions || {};
  const perPage = c.perPage ?? st.perPage;
  return {
    bg: c.bg || 'none', // none: حد حول الحروف · line: مربع ورا السطر · word: مربع ورا الكلمة اللي تنقال
    bgColor: c.bgColor || '#000000',
    bgOpacity: c.bgOpacity ?? 0.6,
    color: c.color || '#FFFFFF',
    activeColor: c.activeColor || th.acc,
    hotColor: c.hotColor || th.acc,
    size: c.size ?? st.capSize,
    weight: c.weight ?? 700,
    y: c.y ?? null, // مكانها كنسبة من طول الشاشة. null = تحت الذقن تلقائي
    perPage,
    chars: c.perPage ? perPage * 7 : st.chars,
    reveal: c.reveal ?? st.reveal,
    pop: c.pop ?? st.pop,
    tilt: st.tilt,
    outline: c.outline ?? true,
  };
}

// ——— الأصوات ———
// المؤثرات تتولّد بالكود (tools/sfx.mjs) وأسماؤها هنا. العلو مضبوط على كلام بقوة ‎-14 LUFS.
export const SFX = {
  whoosh: {label: 'نفخة', vol: 0.3, len: 0.5},
  pop: {label: 'طقّة', vol: 0.4, len: 0.2},
  tick: {label: 'تكّة', vol: 0.34, len: 0.1},
};
const SFX_GAP = 0.22; // أقل مسافة بين صوتين
const SFX_PER_30 = 12; // الحد الأعلى بكل ثلاثين ثانية

function sceneSounds(sc) {
  if (sc.sfx === false) return [];
  if (Array.isArray(sc.sfx)) return sc.sfx.filter((x) => x && SFX[x.name] && Number.isFinite(x.at));
  // التلقائي: نفخة عند دخول الرسمة، وصوت خفيف مع كل عنصر له وقت
  const out = [{at: sc.s, name: 'whoosh'}];
  const each = sc.type === 'numbers' ? 'tick' : 'pop';
  for (const it of sc.items || []) if (Number.isFinite(it?.at)) out.push({at: it.at, name: each});
  if (sc.type === 'word') for (const at of sc.at || []) if (Number.isFinite(at)) out.push({at, name: 'pop'});
  return out;
}

export function resolveSounds(plan, meta, total = Infinity) {
  const cfg = plan?.sfx;
  if (cfg === false || cfg?.enabled === false) return [];
  const master = cfg?.volume ?? 1;
  // صوت المصدر غالباً أوطى من ‎-14، والمعايرة تجي بعد الرندر على الخليط كله، فنوطّي المؤثرات بنفس الفرق
  const lufs = Number.isFinite(meta?.sourceLufs) ? meta.sourceLufs : -14;
  const match = Math.max(0.05, Math.min(1, Math.pow(10, (lufs + 14) / 20)));
  const all = [];
  for (const sc of plan?.scenes || []) for (const s of sceneSounds(sc)) all.push(s);
  all.sort((a, b) => a.at - b.at);
  const cap = Math.max(4, Math.round((Math.min(total, 600) / 30) * SFX_PER_30));
  const out = [];
  for (const s of all) {
    if (s.at < 0 || s.at > total) continue;
    if (out.length && s.at - out[out.length - 1].at < SFX_GAP) continue;
    if (out.length >= cap) break;
    out.push({at: s.at, name: s.name, vol: Math.min(1, SFX[s.name].vol * (s.vol ?? 1) * master * match)});
  }
  return out;
}

export function musicOf(plan, meta) {
  const m = plan?.music;
  if (!m || !m.file) return null;
  const lufs = Number.isFinite(meta?.sourceLufs) ? meta.sourceLufs : -14;
  const match = Math.max(0.05, Math.min(1, Math.pow(10, (lufs + 14) / 20)));
  return {file: m.file, vol: Math.min(1, (m.volume ?? 0.12) * match)};
}

// ——— فحص الهدوء ———
// المقطع ما يصدّع: الرسمات قليلة، بينها نفَس، ووجه المتحدث له أغلب الوقت.
export const LIMITS = {min: 2, maxFull: 6, maxSplit: 9, gap: 3, firstAt: 3, per30: 4, fullPer30: 2, cover: 0.5};

export function validatePlan(plan, total) {
  const problems = [];
  const scenes = (plan?.scenes || []).map((sc, i) => ({...sc, n: i + 1}));
  for (const sc of scenes) {
    const len = sc.e - sc.s;
    const split = layoutOf(sc) === 'split';
    if (!['flow', 'numbers', 'list', 'word', 'custom'].includes(sc.type)) problems.push(`الرسمة ${sc.n}: نوع مو معروف "${sc.type}"`);
    if (sc.type === 'custom' && !sc.name) problems.push(`الرسمة ${sc.n}: نوعها custom وناقصها name`);
    if (sc.layout && !['full', 'split'].includes(sc.layout)) problems.push(`الرسمة ${sc.n}: layout يا full يا split`);
    if (!(sc.e > sc.s)) problems.push(`الرسمة ${sc.n}: النهاية لازم تكون بعد البداية`);
    else if (len < LIMITS.min) problems.push(`الرسمة ${sc.n}: أقصر من ثانيتين وما تلحق تنقرا`);
    if (!split && len > LIMITS.maxFull) problems.push(`الرسمة ${sc.n}: مالية الشاشة أكثر من ${LIMITS.maxFull} ثواني والمتحدث محجوب، فقصّرها أو خلّها split`);
    if (split && len > LIMITS.maxSplit) problems.push(`الرسمة ${sc.n}: الشاشة مقسومة أكثر من ${LIMITS.maxSplit} ثواني، فقصّرها أو اقسمها`);
    if (sc.s < 0 || sc.e > total + 0.05) problems.push(`الرسمة ${sc.n}: برّا مدة الفيديو (${total} ث)`);
    if (sc.s < LIMITS.firstAt) problems.push(`الرسمة ${sc.n}: بداية المقطع لوجهه، فلا رسمة قبل الثانية ${LIMITS.firstAt}`);
  }
  const sorted = scenes.slice().sort((a, b) => a.s - b.s);
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].s - sorted[i - 1].e;
    if (gap < LIMITS.gap - 0.001) problems.push(`الرسمة ${sorted[i - 1].n} والرسمة ${sorted[i].n}: بينهم ${Math.max(0, gap).toFixed(1)} ث، والمطلوب ${LIMITS.gap} ثواني يرتاح فيها المشاهد`);
  }
  const units = Math.max(1, total / 30);
  const maxAll = Math.max(1, Math.round(units * LIMITS.per30));
  const maxFull = Math.max(1, Math.round(units * LIMITS.fullPer30));
  const nFull = scenes.filter((s) => layoutOf(s) === 'full').length;
  if (scenes.length > maxAll) problems.push(`الرسمات ${scenes.length} والحد لهالطول ${maxAll}: احذف الأضعف`);
  if (nFull > maxFull) problems.push(`الرسمات المالية للشاشة ${nFull} والحد ${maxFull}: حوّل وحدة لـsplit أو احذفها`);
  const covered = scenes.reduce((n, s) => n + Math.max(0, s.e - s.s), 0);
  if (total > 0 && covered / total > LIMITS.cover) problems.push(`الرسمات ماخذة ${Math.round((covered / total) * 100)}٪ من المقطع والحد ${LIMITS.cover * 100}٪`);
  return problems;
}

// تنبيهات ما تمنع الرندر: المقطع يطلع، بس الخطة تستاهل مراجعة
export function advisePlan(plan, total) {
  const notes = [];
  const n = (plan?.scenes || []).length;
  const want = Math.max(1, Math.round((total / 30) * 3));
  if (total >= 12 && n < want) notes.push(`الرسمات ${n} والمقطع ${Math.round(total)} ث: المتوقع ${want} على الأقل. ارجع للكلام ودوّر أي رقم أو تكلفة أو مقارنة أو تعداد ما انرسم.`);
  return notes;
}

// ——— الكلام ———
const r3 = (x) => Math.round(x * 1000) / 1000;

// يطبّق تصحيح الجمل {"رقم الجملة": "النص الصحيح"} على التفريغ الخام ويوزّع التوقيت على الكلمات
export function applyFix(rawSentences, fix = {}) {
  return rawSentences.map((sen) => {
    const txt = fix[String(sen.id)];
    if (typeof txt !== 'string' || !txt.trim()) return sen;
    const toks = txt.trim().split(/\s+/);
    let words;
    if (toks.length === sen.words.length) {
      // نفس العدد: كل كلمة تاخذ توقيت أختها
      words = sen.words.map((w, i) => ({t: toks[i], s: w.s, e: w.e}));
    } else {
      // العدد تغيّر: نوزّع وقت الجملة على الكلمات بحسب طولها
      const total = toks.reduce((n, x) => n + x.length, 0) || 1;
      let c = 0;
      words = toks.map((x) => {
        const s = sen.s + ((sen.e - sen.s) * c) / total;
        c += x.length;
        return {t: x, s: r3(s), e: r3(sen.s + ((sen.e - sen.s) * c) / total)};
      });
    }
    return {...sen, text: toks.join(' '), words};
  });
}

// ——— تغيير القص ———
// أي وقت بالمقطع المقصوص نرجّعه لوقته بالتسجيل الأصلي، ثم نحسبه على القص الجديد.
const starts = (keep) => {
  const out = [];
  let acc = 0;
  for (const k of keep) {
    out.push(acc);
    acc += k[1] - k[0];
  }
  return out;
};
export const keepTotal = (keep) => r3(keep.reduce((n, k) => n + (k[1] - k[0]), 0));

export function toSource(t, keep) {
  const st = starts(keep);
  for (let i = 0; i < keep.length; i++) {
    const len = keep[i][1] - keep[i][0];
    if (t <= st[i] + len || i === keep.length - 1) return keep[i][0] + Math.max(0, Math.min(len, t - st[i]));
  }
  return 0;
}

export function fromSource(src, keep) {
  const st = starts(keep);
  for (let i = 0; i < keep.length; i++) {
    if (src < keep[i][0]) return st[i];
    if (src <= keep[i][1]) return st[i] + (src - keep[i][0]);
  }
  return keepTotal(keep);
}

export const retime = (t, oldKeep, newKeep) => r3(fromSource(toSource(t, oldKeep), newKeep));

// يعيد توقيت كل شي له وقت: الكلام والرسمات وعناصرها
export function retimeProject({raw, plan}, oldKeep, newKeep) {
  const f = (t) => retime(t, oldKeep, newKeep);
  const inNew = (src) => newKeep.some((k) => src >= k[0] - 0.05 && src <= k[1] + 0.05);
  const isTime = (key) => key === 'at' || /At$/.test(key || '');
  const sentences = raw.sentences
    .map((sen) => {
      // الكلمة اللي وقتها الأصلي طاح برّا القص الجديد تروح
      const words = sen.words
        .filter((w) => inNew(toSource((w.s + w.e) / 2, oldKeep)))
        .map((w) => ({...w, s: f(w.s), e: r3(Math.max(f(w.s) + 0.08, f(w.e)))}));
      if (!words.length) return null;
      return {...sen, s: words[0].s, e: words[words.length - 1].e, text: words.map((w) => w.t).join(' '), words};
    })
    .filter(Boolean);
  const deep = (v, key) => {
    if (Array.isArray(v)) return v.map((x) => (typeof x === 'number' && isTime(key) ? f(x) : deep(x, key)));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x, k)]));
    if (typeof v === 'number' && (key === 's' || key === 'e' || isTime(key))) return f(v);
    return v;
  };
  const scenes = (plan.scenes || []).map((sc) => deep(sc));
  return {raw: {...raw, total: keepTotal(newKeep), sentences}, plan: {...plan, scenes}};
}
