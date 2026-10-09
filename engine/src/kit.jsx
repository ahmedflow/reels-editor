// أدوات الرسم المشتركة بين القوالب والرسمات المكتوبة لكل تسجيل
import React from 'react';
import {rgba} from './theme.js';

export {rgba};
export {float, drop, part, Art, ARTS} from './art.jsx';
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const ease = (k) => 1 - Math.pow(1 - clamp(k), 3);
export const easeInOut = (k) => {
  k = clamp(k);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
};
// يوصل ويتعدّى شوي ثم يرجع: حركة فيها حياة بدون نطنطة
export const backOut = (k) => {
  k = clamp(k);
  const c1 = 1.70158;
  return 1 + (c1 + 1) * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
};
// رقم يطلع من صفر لواحد، بدايته at ومدّته dur
export const prog = (t, at, dur = 0.3) => ease((t - at) / dur);
// ظهور ناعم: يبان ويرتفع شوي ويكبر لحجمه ثم يثبت
export const enter = (t, at, dur = 0.28) => {
  const k = prog(t, at, dur);
  return {opacity: k, transform: `translateY(${(1 - k) * 18}px) scale(${0.96 + 0.04 * k})`};
};
// ظهور بنبضة: يكبر من صغير ويتعدّى حجمه شعرة ثم يستقر. للعنصر اللي عليه العين
export const pop = (t, at, dur = 0.42) => {
  const k = (t - at) / dur;
  return {opacity: clamp(k * 4), transform: `scale(${k <= 0 ? 0.6 : 0.6 + 0.4 * backOut(k)})`};
};
// دخول من الجنب: dx موجب يدخل من اليمين
export const slide = (t, at, dx = 70, dur = 0.38) => ({opacity: clamp(((t - at) / dur) * 3), transform: `translateX(${(1 - prog(t, at, dur)) * dx}px)`});
// عدّاد: رقم صحيح يمشي من from إلى to
export const count = (t, at, to, dur = 0.55, from = 0) => Math.round(lerp(from, to, prog(t, at, dur)));
// «80 ألف» أو «25%» ← {pre, n, post}. يرجّع null إذا ما فيه رقم صحيح واحد
export const splitNumber = (text) => {
  const m = /^(\D*?)(\d+)(\D*)$/.exec(String(text ?? '').trim());
  return m ? {pre: m[1], n: Number(m[2]), post: m[3]} : null;
};

export const Box = ({children, hot, th, style}) => (
  <div
    style={{
      background: hot ? th.acc : rgba(th.ink, 0.08),
      color: hot ? th.onAcc : th.ink,
      border: hot ? 'none' : `3px solid ${rgba(th.ink, 0.16)}`,
      borderRadius: 28,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      ...style,
    }}
  >
    {children}
  </div>
);

// بطاقة لها عمق: تدرّج خفيف وظل. الملوّنة تتوهّج بلون الباقة
export const Card = ({children, hot, th, style}) => (
  <div
    style={{
      background: hot ? th.acc : `linear-gradient(160deg, ${rgba(th.ink, 0.17)}, ${rgba(th.ink, 0.05)})`,
      color: hot ? th.onAcc : th.ink,
      border: `2px solid ${hot ? th.acc : rgba(th.ink, 0.22)}`,
      borderRadius: 34,
      boxShadow: hot ? `0 18px 60px ${rgba(th.acc, 0.35)}` : '0 18px 50px rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      ...style,
    }}
  >
    {children}
  </div>
);

// أيقونات خطّية مرسومة على شبكة 24. كل أيقونة مسارات، فتقدر ترسم نفسها قدام العين (draw)
export const ICONS = {
  shop: ['M3 9l1.5-5h15L21 9', 'M3 9a3 3 0 0 0 6 0a3 3 0 0 0 6 0a3 3 0 0 0 6 0', 'M5 12v8h14v-8', 'M10 20v-5h4v5'],
  building: ['M4 21V4h10v17', 'M14 9h6v12', 'M2 21h20', 'M8 8h2M8 12h2M8 16h2M17 13h.01M17 17h.01'],
  bank: ['M3 9l9-6l9 6', 'M4 9h16', 'M6 9v9M10 9v9M14 9v9M18 9v9', 'M4 18h16M3 21h18'],
  home: ['M3 11l9-8l9 8', 'M5 10v10h14V10', 'M10 20v-6h4v6'],
  money: ['M2 6h20v12H2z', 'M12 15a3 3 0 1 0 0-6a3 3 0 0 0 0 6z', 'M6 12h.01M18 12h.01'],
  coins: ['M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3s-3.6 3-8 3s-8-1.3-8-3z', 'M4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7', 'M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5'],
  wallet: ['M3 6h16v3', 'M3 6v13h18V9H5', 'M16 14h.01'],
  card: ['M2 5h20v14H2z', 'M2 10h20', 'M6 15h4'],
  receipt: ['M5 2h14v20l-3.5-2l-3.5 2l-3.5-2L5 22z', 'M9 8h6M9 12h6'],
  tag: ['M3 3h8l10 10l-8 8L3 11z', 'M7.5 7.5h.01'],
  percent: ['M19 5L5 19', 'M7 9a2 2 0 1 0 0-4a2 2 0 0 0 0 4z', 'M17 19a2 2 0 1 0 0-4a2 2 0 0 0 0 4z'],
  doc: ['M6 2h8l5 5v15H6z', 'M14 2v5h5', 'M9 12h7M9 16h7'],
  contract: ['M6 2h8l5 5v15H6z', 'M14 2v5h5', 'M9 15l2 2l4-4'],
  person: ['M12 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8z', 'M4 21c0-4 3.6-7 8-7s8 3 8 7'],
  team: ['M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7z', 'M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6', 'M16 4.5a3.5 3.5 0 0 1 0 6.5', 'M18 14.5c2.4.7 4 2.7 4 5.5'],
  calendar: ['M4 5h16v16H4z', 'M4 10h16', 'M8 3v4M16 3v4'],
  clock: ['M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  check: ['M4 12.5l5 5L20 6.5'],
  cross: ['M6 6l12 12', 'M18 6L6 18'],
  warning: ['M12 3L2 20h20z', 'M12 10v4', 'M12 17h.01'],
  chart: ['M2 20h20', 'M5 20V11', 'M11 20V4', 'M17 20v-7'],
  up: ['M4 17l6-6l4 4l6-8', 'M15 7h5v5'],
  down: ['M4 7l6 6l4-4l6 8', 'M15 17h5v-5'],
  scale: ['M12 3v18', 'M6 21h12', 'M4 7h16', 'M4 7l-2.5 6a2.5 2.5 0 0 0 5 0z', 'M20 7l-2.5 6a2.5 2.5 0 0 0 5 0z'],
  key: ['M8 18a4 4 0 1 0 0-8a4 4 0 0 0 0 8z', 'M11 11l9-9', 'M16 6l3 3'],
  lock: ['M6 11h12v10H6z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  shield: ['M12 3l8 3v6c0 5-3.5 8-8 9c-4.5-1-8-4-8-9V6z', 'M9 12l2 2l4-4'],
  cart: ['M3 4h2l2.5 11h10L20 7H6', 'M9 20a1 1 0 1 0 0-2a1 1 0 0 0 0 2z', 'M17 20a1 1 0 1 0 0-2a1 1 0 0 0 0 2z'],
  truck: ['M2 6h11v10H2z', 'M13 9h5l3 3v4h-8', 'M6 19a2 2 0 1 0 0-4a2 2 0 0 0 0 4z', 'M17 19a2 2 0 1 0 0-4a2 2 0 0 0 0 4z'],
  phone: ['M7 2h10v20H7z', 'M11 18h2'],
  pin: ['M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z', 'M12 12.5a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5z'],
  bulb: ['M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z', 'M9 18.5h6', 'M10 21.5h4'],
  target: ['M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18z', 'M12 17a5 5 0 1 0 0-10a5 5 0 0 0 0 10z', 'M12 13a1 1 0 1 0 0-2a1 1 0 0 0 0 2z'],
  star: ['M12 3l2.8 5.7l6.2.9l-4.5 4.4l1 6.2L12 17.3l-5.5 2.9l1-6.2L3 9.6l6.2-.9z'],
  gear: ['M12 15.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7z', 'M12 2v3M12 19v3M2 12h3M19 12h3', 'M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1'],
  swap: ['M4 8h14l-4-4', 'M20 16H6l4 4'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  equal: ['M5 9h14', 'M5 15h14'],
};

// draw من 0 إلى 1: الأيقونة ترسم نفسها. اربطه بـ prog(t, وقت الكلمة, 0.5)
export const Icon = ({name, size = 96, color = 'currentColor', stroke = 2, draw = 1}) => {
  const paths = ICONS[name];
  if (!paths) return null;
  const k = clamp(draw);
  const n = paths.length;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{display: 'block', flexShrink: 0, overflow: 'visible'}}>
      {paths.map((d, i) => {
        // المسارات تنرسم ورا بعض، كل واحد يبدأ قبل ما يخلص اللي قبله
        const kk = clamp((k * (n + 1) - i) / 2);
        return kk >= 1 ? <path key={i} d={d} /> : <path key={i} d={d} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - kk} opacity={kk > 0 ? 1 : 0} />;
      })}
    </svg>
  );
};
