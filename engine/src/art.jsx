// حركات الموشن والرسومات الجاهزة. تنستورد من kit.jsx مع باقي العدّة.
import React from 'react';
import {rgba} from './theme.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (k) => 1 - Math.pow(1 - clamp(k), 3);
const backOut = (k) => {
  k = clamp(k);
  const c1 = 1.70158;
  return 1 + (c1 + 1) * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
};

// ——— حركات الموشن ———
// طفو هادي ومستمر: العنصر اللي ثبت يبقى فيه نفَس وما يتجمّد. يرجّع بكسلات تحطها بـ translateY
export const float = (t, amp = 8, speed = 1, phase = 0) => Math.sin(t * speed * 2 + phase) * amp;
// نزلة من فوق بارتداد خفيف. يرجّع الإزاحة بالبكسل: h فوق مكانه ثم صفر
export const drop = (t, at, h = 140, dur = 0.55) => {
  const k = clamp((t - at) / dur);
  const b = k < 0.6 ? 1 - Math.pow(k / 0.6, 2) : 0.12 * Math.sin(((k - 0.6) / 0.4) * Math.PI);
  return -h * b;
};
// جزء من حركة: يقسم k على مراحل. part(k, 0.3, 0.7) يمشي من 0 لـ1 بين 30٪ و70٪
export const part = (k, a, b) => ease((k - a) / (b - a));

// ——— رسومات موشن جاهزة ———
// كل رسمة لوحة 200×200 بألوان الباقة، وتنبني قدام العين: k من 0 (ما بدأت) إلى 1 (اكتملت)
const grow = (k, y = 180) => `translate(0 ${y}) scale(1 ${Math.max(0.001, k)}) translate(0 ${-y})`;
const about = (x, y, s) => `translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})`;

// محل: الجدار يطلع من الأرض، المظلة تنزل عليه، ثم اللوحة تنبض
const ArtShop = ({th, k}) => {
  const body = part(k, 0, 0.45);
  const awn = part(k, 0.3, 0.7);
  const sign = part(k, 0.6, 1);
  return (
    <>
      <ellipse cx={100} cy={183} rx={78 * body} ry={7} fill="rgba(0,0,0,0.25)" />
      <g transform={grow(body)}>
        <rect x={38} y={84} width={124} height={96} rx={6} fill={th.ink} />
        <rect x={50} y={106} width={46} height={40} rx={5} fill={th.bg} />
        <path d="M54 140l14-30h10l-14 30z" fill={rgba(th.ink, 0.25)} />
        <rect x={110} y={108} width={38} height={72} rx={5} fill={th.acc} />
        <circle cx={117} cy={146} r={3} fill={th.onAcc} />
      </g>
      <g opacity={awn} transform={`translate(0 ${(1 - awn) * -26})`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M${30 + i * 28} 62h28v22a14 14 0 0 1-28 0z`} fill={i % 2 ? th.ink : th.acc} stroke={th.bg} strokeWidth={2} />
        ))}
      </g>
      <g opacity={clamp(sign * 3)} transform={about(100, 44, 0.6 + 0.4 * backOut(sign))}>
        <rect x={66} y={32} width={68} height={24} rx={8} fill={th.acc} />
        <rect x={78} y={41} width={44} height={6} rx={3} fill={th.onAcc} />
      </g>
    </>
  );
};

// عمارة: تطلع من الأرض وشبابيكها تضوّي وحدة ورا وحدة
const ArtBuilding = ({th, k}) => {
  const body = part(k, 0, 0.45);
  const wing = part(k, 0.2, 0.6);
  return (
    <>
      <ellipse cx={100} cy={183} rx={82 * body} ry={7} fill="rgba(0,0,0,0.25)" />
      <g transform={grow(wing)}>
        <rect x={132} y={96} width={44} height={84} rx={5} fill={th.soft} />
      </g>
      <g transform={grow(body)}>
        <rect x={50} y={30} width={90} height={150} rx={6} fill={th.ink} />
        <rect x={84} y={150} width={22} height={30} rx={3} fill={th.bg} />
      </g>
      {Array.from({length: 12}).map((_, i) => {
        const row = 3 - Math.floor(i / 3);
        const on = part(k, 0.4 + i * 0.04, 0.55 + i * 0.04);
        return <rect key={i} x={62 + (i % 3) * 25} y={44 + row * 26} width={16} height={16} rx={3} fill={th.acc} opacity={0.12 + 0.88 * on} />;
      })}
    </>
  );
};

// عملات تتكدّس: كل وحدة تنزل على اللي تحتها
const ArtCoins = ({th, k}) => (
  <>
    <ellipse cx={100} cy={184} rx={62} ry={7} fill="rgba(0,0,0,0.25)" />
    {Array.from({length: 5}).map((_, i) => {
      const c = part(k, i * 0.16, i * 0.16 + 0.3);
      const y = 162 - i * 26 - (1 - c) * 70;
      const side = `M44 ${y}v18c0 8 25 14 56 14s56-6 56-14v-18z`;
      return (
        <g key={i} opacity={clamp(c * 3)}>
          <path d={side} fill={th.acc} />
          <path d={side} fill="rgba(0,0,0,0.22)" />
          <ellipse cx={100} cy={y} rx={56} ry={14} fill={th.acc} />
          <ellipse cx={100} cy={y} rx={40} ry={8} fill="none" stroke={th.onAcc} strokeWidth={3} opacity={0.35} />
        </g>
      );
    })}
  </>
);

// عملة وحدة: تدخل وهي تلف على نفسها ثم توقف وجهها لك
const ArtCoin = ({th, k}) => {
  const e = ease(k);
  const spin = Math.max(0.04, Math.abs(Math.cos((1 - e) * Math.PI * 2)));
  return (
    <g transform={`translate(100 100) scale(${spin * (0.5 + 0.5 * e)} ${0.5 + 0.5 * e}) translate(-100 -100)`} opacity={clamp(k * 4)}>
      <circle cx={100} cy={100} r={82} fill={th.acc} />
      <circle cx={100} cy={100} r={78} fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth={8} />
      <circle cx={100} cy={100} r={56} fill="none" stroke={th.onAcc} strokeWidth={5} opacity={0.4} />
      <path d="M100 66l24 34l-24 34l-24-34z" fill={th.onAcc} opacity={0.85} />
    </g>
  );
};

// ورق نقد: ثلاث ورقات تنفرش زي المروحة
const ArtBills = ({th, k}) => {
  const fan = part(k, 0.25, 1);
  return (
    <g opacity={clamp(k * 4)}>
      {[-1, 1, 0].map((i) => (
        <g key={i} transform={`translate(100 160) rotate(${i * 17 * fan}) translate(-100 -160)`}>
          <rect x={22} y={62} width={156} height={84} rx={12} fill={i === 0 ? th.acc : th.ink} stroke={th.bg} strokeWidth={3} />
          <circle cx={100} cy={104} r={22} fill={i === 0 ? th.onAcc : th.bg} opacity={0.3} />
          <rect x={36} y={76} width={18} height={8} rx={4} fill={i === 0 ? th.onAcc : th.bg} opacity={0.4} />
          <rect x={146} y={124} width={18} height={8} rx={4} fill={i === 0 ? th.onAcc : th.bg} opacity={0.4} />
        </g>
      ))}
    </g>
  );
};

// ورقة رسمية: تطلع، أسطرها تنكتب، ثم ينضرب عليها الختم
const ArtDoc = ({th, k}) => {
  const paper = part(k, 0, 0.35);
  const stamp = part(k, 0.75, 1);
  return (
    <>
      <g opacity={clamp(paper * 3)} transform={`translate(0 ${(1 - paper) * 30})`}>
        <path d="M48 18h74l32 32v126a8 8 0 0 1-8 8H48a8 8 0 0 1-8-8V26a8 8 0 0 1 8-8z" fill={th.ink} />
        <path d="M122 18l32 32h-24a8 8 0 0 1-8-8z" fill={th.soft} />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={58} y={72 + i * 22} width={(i === 3 ? 44 : 78) * part(k, 0.3 + i * 0.1, 0.5 + i * 0.1)} height={9} rx={4.5} fill={th.bg} opacity={0.45} />
        ))}
      </g>
      <g opacity={clamp(stamp * 3)} transform={about(128, 150, 0.5 + 0.5 * backOut(stamp))}>
        <circle cx={128} cy={150} r={26} fill={th.acc} />
        <path d="M116 150l9 9l16-18" fill="none" stroke={th.onAcc} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </>
  );
};

// شخص: يطلع من تحت بنبضة
const ArtPerson = ({th, k}) => (
  <g opacity={clamp(k * 3)} transform={about(100, 184, 0.7 + 0.3 * backOut(k))}>
    <ellipse cx={100} cy={184} rx={58} ry={7} fill="rgba(0,0,0,0.25)" />
    <path d="M40 184c0-40 26-66 60-66s60 26 60 66z" fill={th.acc} />
    <circle cx={100} cy={70} r={38} fill={th.ink} />
  </g>
);

// روزنامة: تنبض وأيامها تتعبّى يوم ورا يوم
const ArtCalendar = ({th, k}) => {
  const page = part(k, 0, 0.45);
  return (
    <g opacity={clamp(page * 3)} transform={about(100, 100, 0.7 + 0.3 * backOut(page))}>
      <rect x={30} y={38} width={140} height={140} rx={16} fill={th.ink} />
      <path d="M30 54a16 16 0 0 1 16-16h108a16 16 0 0 1 16 16v26H30z" fill={th.acc} />
      <rect x={62} y={22} width={12} height={34} rx={6} fill={th.soft} />
      <rect x={126} y={22} width={12} height={34} rx={6} fill={th.soft} />
      {Array.from({length: 8}).map((_, i) => (
        <rect key={i} x={46 + (i % 4) * 29} y={96 + Math.floor(i / 4) * 34} width={20} height={20} rx={5} fill={th.bg} opacity={0.2 + 0.6 * part(k, 0.4 + i * 0.06, 0.5 + i * 0.06)} />
      ))}
    </g>
  );
};

export const ARTS = {shop: ArtShop, building: ArtBuilding, coins: ArtCoins, coin: ArtCoin, bills: ArtBills, doc: ArtDoc, person: ArtPerson, calendar: ArtCalendar};

// k: اربطه بوقت الكلمة، مثلاً prog(t, scene.at, 0.9). الرسمة تنبني مرة وحدة ثم تثبت
export const Art = ({name, size = 200, th, k = 1}) => {
  const A = ARTS[name];
  if (!A) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{display: 'block', flexShrink: 0, overflow: 'visible'}}>
      <A th={th} k={clamp(k)} />
    </svg>
  );
};
