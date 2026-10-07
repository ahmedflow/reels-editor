import React from 'react';
import {AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont as loadPlex} from '@remotion/google-fonts/IBMPlexSansArabic';
import {loadFont as loadReadex} from '@remotion/google-fonts/ReadexPro';
import {loadFont as loadAlmarai} from '@remotion/google-fonts/Almarai';
import {resolveTheme} from './theme.js';
import {clamp, lerp, ease, easeInOut, rgba} from './kit.jsx';
import {ScenePanel} from './scenes.jsx';

const FONTS = {
  plex: () => loadPlex('normal', {weights: ['500', '700'], subsets: ['arabic', 'latin']}),
  readex: () => loadReadex('normal', {weights: ['500', '700'], subsets: ['arabic', 'latin']}),
  almarai: () => loadAlmarai('normal', {weights: ['400', '700', '800'], subsets: ['arabic']}),
};

// الطابع: قوة القربة عند كل قصّة، وحجم الكتابة وحركتها
const STYLES = {
  calm: {zooms: [1, 1.05], capSize: 84, perPage: 3, chars: 18, reveal: false, pop: 0, tilt: 0},
  formal: {zooms: [1, 1.08], capSize: 92, perPage: 3, chars: 16, reveal: true, pop: 0.05, tilt: 0},
  hype: {zooms: [1, 1.16, 1.06, 1.2], capSize: 112, perPage: 2, chars: 12, reveal: true, pop: 0.12, tilt: -2},
};

const W = 1080;
const H = 1920;

// وين ينحط الفيديو: يغطي الشاشة كاملة، والزوم حول وجه المتحدث
function place(meta, face, zoom) {
  const vw = meta.width;
  const vh = meta.height;
  const s0 = Math.max(W / vw, H / vh);
  const fx = (face.found ? face.cx : 0.5) * vw;
  const fy = (face.found ? face.cy : 0.4) * vh;
  const ox0 = clamp(W / 2 - fx * s0, W - vw * s0, 0);
  const oy0 = clamp(H * 0.4 - fy * s0, H - vh * s0, 0);
  const s = s0 * zoom;
  const ox = clamp(ox0 + fx * s0 - fx * s, W - vw * s, 0);
  const oy = clamp(oy0 + fy * s0 - fy * s, H - vh * s, 0);
  return {s, ox, oy, chin: (face.found ? face.bottom : 0.6) * vh * s + oy};
}

function pages(sentences, st) {
  const out = [];
  for (const sen of sentences) {
    let cur = [];
    let chars = 0;
    for (const w of sen.words) {
      if (cur.length && (cur.length >= st.perPage || chars + w.t.length > st.chars)) {
        out.push(cur);
        cur = [];
        chars = 0;
      }
      cur.push(w);
      chars += w.t.length + 1;
    }
    if (cur.length) out.push(cur);
  }
  return out.map((ws) => ({words: ws, s: ws[0].s, e: ws[ws.length - 1].e}));
}

const norm = (w) => w.replace(/[ً-ْـ]/g, '').replace(/[^\p{L}\p{N}]/gu, '');

// حد غامق حول الحروف عشان تنقرا فوق أي خلفية
const outline = (px, c) => {
  const sh = [];
  for (let a = 0; a < 16; a++) sh.push(`${(Math.cos((a * Math.PI) / 8) * px).toFixed(1)}px ${(Math.sin((a * Math.PI) / 8) * px).toFixed(1)}px 0 ${c}`);
  sh.push(`0 ${px * 1.5}px ${px * 3}px rgba(0,0,0,0.45)`);
  return sh.join(',');
};

// الكتابة: حروف كبيرة مباشرة على الصورة، والكلمة تضوّي لحظة نطقها
function Caption({page, next, t, th, y, hot, st}) {
  if (!page) return null;
  const end = Math.min(next ? next.s : Infinity, page.e + 0.9);
  if (t < page.s - 0.04 || t >= end) return null;
  return (
    <div style={{position: 'absolute', left: 0, width: W, top: y, transform: 'translateY(-50%)', display: 'flex', justifyContent: 'center'}}>
      <div
        style={{
          maxWidth: 800,
          display: 'flex',
          flexWrap: 'wrap',
          direction: 'rtl',
          justifyContent: 'center',
          alignItems: 'baseline',
          gap: `0 ${Math.round(st.capSize * 0.32)}px`,
          fontSize: st.capSize,
          fontWeight: 700,
          lineHeight: 1.3,
          textShadow: outline(Math.max(5, st.capSize / 15), 'rgba(0,0,0,0.9)'),
        }}
      >
        {page.words.map((w, i) => {
          const said = t >= w.s - 0.04;
          const active = t >= w.s - 0.04 && t < w.e + 0.06;
          const isHot = hot.has(norm(w.t));
          const k = ease((t - (w.s - 0.04)) / 0.16);
          const scale = (st.reveal ? 0.86 + 0.14 * k : 1) * (active ? 1 + st.pop : 1) * (isHot ? 1.08 : 1);
          return (
            <span
              key={i}
              style={{
                whiteSpace: 'nowrap',
                display: 'inline-block',
                color: isHot || active ? th.acc : '#FFFFFF',
                // اللي ما انقال باهت بمكانه، فالسطر يبقى بالنص وما يتحرك
                opacity: said ? (st.reveal ? 0.35 + 0.65 * k : 1) : st.reveal ? 0.35 : 0.55,
                transform: `scale(${scale}) rotate(${isHot ? st.tilt : 0}deg)`,
              }}
            >
              {w.t}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export const Reel = ({meta, cut, face, sentences, plan}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const th = resolveTheme(plan);
  const st = STYLES[plan?.style] || STYLES.formal;
  const {fontFamily} = (FONTS[plan?.font] || FONTS.plex)();
  const scenes = plan?.scenes || [];
  const pg = React.useMemo(() => pages(sentences, st), [sentences, st]);
  const hot = React.useMemo(() => new Set((plan?.hot || []).map(norm)), [plan]);

  // المقاطع بعد القص، وكل مقطع له مستوى زوم: يتغيّر عند كل قصّة واضحة فتبان مقصودة مو قفزة
  const segs = React.useMemo(() => {
    let acc = 0;
    let zi = 0;
    return cut.keep.map(([a, b], i) => {
      if (i > 0 && a - cut.keep[i - 1][1] >= 0.35) zi++;
      const from = Math.round(acc * fps);
      acc += b - a;
      return {from, dur: Math.max(1, Math.round(acc * fps) - from), trim: Math.round(a * fps), zoom: st.zooms[zi % st.zooms.length]};
    });
  }, [cut, fps, st]);
  const cur = segs.find((sg) => frame >= sg.from && frame < sg.from + sg.dur) || segs[segs.length - 1];

  // وقت الرسمة: الصورة وراها تتضبّب وتعتم
  let take = 0;
  for (const sc of scenes) take = Math.max(take, Math.min(easeInOut((t - sc.s) / 0.3), 1 - easeInOut((t - (sc.e - 0.3)) / 0.3)));

  // البداية: الكادر يقرب عليه بالتدريج طول أول مقطع
  const hook = plan?.hookZoom === false || cur !== segs[0] ? 0 : 0.07 * ease(t / Math.max(1, segs[0].dur / fps));
  const zoom = (cur.zoom + hook) * (1 + 0.1 * take);
  const p = place(meta, face, zoom);

  // الكتابة مكانها تحت الذقن، بعيد عن ملامحه
  const capY = lerp(clamp(place(meta, face, 1.1).chin + 170, 1000, 1400), 1400, take);
  const pi = pg.findIndex((x, i) => t >= x.s - 0.04 && (i === pg.length - 1 || t < pg[i + 1].s - 0.04));

  return (
    <AbsoluteFill style={{background: '#000', fontFamily}}>
      <AbsoluteFill style={{filter: take > 0.01 ? `blur(${(take * 28).toFixed(1)}px)` : 'none'}}>
        {segs.map((sg, i) => (
          <Sequence key={i} from={sg.from} durationInFrames={sg.dur} layout="none">
            <OffthreadVideo
              src={staticFile(meta.source)}
              trimBefore={sg.trim}
              style={{position: 'absolute', left: p.ox, top: p.oy, width: meta.width * p.s, height: meta.height * p.s, maxWidth: 'none'}}
            />
          </Sequence>
        ))}
      </AbsoluteFill>
      {take > 0.01 ? <AbsoluteFill style={{background: rgba(th.bg, 0.82 * take)}} /> : null}
      {scenes.map((sc, i) => (t >= sc.s && t <= sc.e ? <ScenePanel key={i} scene={sc} t={t} th={th} /> : null))}
      <Caption page={pg[pi]} next={pg[pi + 1]} t={t} th={th} y={capY} hot={hot} st={st} />
    </AbsoluteFill>
  );
};
