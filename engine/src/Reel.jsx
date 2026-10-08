import React from 'react';
import {AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont as loadPlex} from '@remotion/google-fonts/IBMPlexSansArabic';
import {loadFont as loadReadex} from '@remotion/google-fonts/ReadexPro';
import {loadFont as loadAlmarai} from '@remotion/google-fonts/Almarai';
import {resolveTheme} from './theme.js';
import {clamp, lerp, ease, easeInOut, rgba} from './kit.jsx';
import {ScenePanel} from './scenes.jsx';
import {W, H, SPLIT_H, SFX, styleOf, layoutOf, captionStyle, resolveSounds, musicOf} from './plan.js';

const FONTS = {
  plex: () => loadPlex('normal', {weights: ['500', '700'], subsets: ['arabic', 'latin']}),
  readex: () => loadReadex('normal', {weights: ['500', '700'], subsets: ['arabic', 'latin']}),
  almarai: () => loadAlmarai('normal', {weights: ['400', '700', '800'], subsets: ['arabic']}),
};

// وين ينحط الفيديو داخل مساحة طولها hv: يغطيها كاملة، والزوم حول وجه المتحدث.
// الحجم الأساسي مربوط بالشاشة الكاملة، فلما تنقسم الشاشة الصورة تنقص وما تتمطط.
function place(meta, face, zoom, hv = H, faceAt = 0.4) {
  const vw = meta.width;
  const vh = meta.height;
  const s0 = Math.max(W / vw, H / vh);
  const fx = (face.found ? face.cx : 0.5) * vw;
  const fy = (face.found ? face.cy : 0.4) * vh;
  const ox0 = clamp(W / 2 - fx * s0, W - vw * s0, 0);
  const oy0 = clamp(hv * faceAt - fy * s0, hv - vh * s0, 0);
  const s = s0 * zoom;
  const ox = clamp(ox0 + fx * s0 - fx * s, W - vw * s, 0);
  const oy = clamp(oy0 + fy * s0 - fy * s, hv - vh * s, 0);
  return {s, ox, oy, chin: (face.found ? face.bottom : 0.6) * vh * s + oy};
}

function pages(sentences, cs) {
  const out = [];
  for (const sen of sentences) {
    let cur = [];
    let chars = 0;
    for (const w of sen.words) {
      if (cur.length && (cur.length >= cs.perPage || chars + w.t.length > cs.chars)) {
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
function Caption({page, next, t, th, y, hot, cs, scale = 1}) {
  if (!page) return null;
  const end = Math.min(next ? next.s : Infinity, page.e + 0.9);
  if (t < page.s - 0.04 || t >= end) return null;
  const size = cs.size * scale;
  const boxed = cs.bg === 'line';
  const shadow = cs.outline && !boxed ? outline(Math.max(5, size / 15), 'rgba(0,0,0,0.9)') : 'none';
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
          gap: `0 ${Math.round(size * 0.32)}px`,
          fontSize: size,
          fontWeight: cs.weight,
          lineHeight: 1.3,
          textShadow: shadow,
          ...(boxed ? {background: rgba(cs.bgColor, cs.bgOpacity), padding: `${Math.round(size * 0.16)}px ${Math.round(size * 0.42)}px`, borderRadius: Math.round(size * 0.3)} : {}),
        }}
      >
        {page.words.map((w, i) => {
          const said = t >= w.s - 0.04;
          const active = t >= w.s - 0.04 && t < w.e + 0.06;
          const isHot = hot.has(norm(w.t));
          const k = ease((t - (w.s - 0.04)) / 0.16);
          const grow = (cs.reveal ? 0.86 + 0.14 * k : 1) * (active ? 1 + cs.pop : 1) * (isHot ? 1.08 : 1);
          // مربع ورا الكلمة اللي تنقال: هي اللي تاخذ الخلفية ولونها ينقلب
          const chip = cs.bg === 'word' && active;
          return (
            <span
              key={i}
              style={{
                whiteSpace: 'nowrap',
                display: 'inline-block',
                color: chip ? th.onAcc : active ? cs.activeColor : isHot ? cs.hotColor : cs.color,
                // اللي ما انقال باهت بمكانه، فالسطر يبقى بالنص وما يتحرك
                opacity: said ? (cs.reveal ? 0.35 + 0.65 * k : 1) : cs.reveal ? 0.35 : 0.55,
                transform: `scale(${grow}) rotate(${isHot ? cs.tilt : 0}deg)`,
                ...(cs.bg === 'word'
                  ? {padding: `0 ${Math.round(size * 0.16)}px`, margin: `0 -${Math.round(size * 0.16)}px`, borderRadius: Math.round(size * 0.2), background: chip ? cs.activeColor : 'transparent', textShadow: chip ? 'none' : shadow}
                  : {}),
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
  const {fps, durationInFrames} = useVideoConfig();
  const t = frame / fps;
  const th = resolveTheme(plan);
  const st = styleOf(plan);
  const cs = captionStyle(plan, th);
  const {fontFamily} = (FONTS[plan?.font] || FONTS.plex)();
  const scenes = plan?.scenes || [];
  const pg = React.useMemo(() => pages(sentences, cs), [sentences, cs.perPage, cs.chars]);
  const hot = React.useMemo(() => new Set((plan?.hot || []).map(norm)), [plan]);
  const sounds = React.useMemo(() => resolveSounds(plan, meta, cut.total), [plan, meta, cut.total]);
  const music = musicOf(plan, meta);

  // المقاطع بعد القص، وكل مقطع له مستوى زوم: يتغيّر عند كل قصّة واضحة فتبان مقصودة مو قفزة
  const segs = React.useMemo(() => {
    let acc = 0;
    let zi = 0;
    const strength = plan?.zoom ?? 1;
    return cut.keep.map(([a, b], i) => {
      if (i > 0 && a - cut.keep[i - 1][1] >= 0.35) zi++;
      const from = Math.round(acc * fps);
      acc += b - a;
      return {from, dur: Math.max(1, Math.round(acc * fps) - from), trim: Math.round(a * fps), zoom: 1 + (st.zooms[zi % st.zooms.length] - 1) * strength};
    });
  }, [cut, fps, st, plan?.zoom]);
  const cur = segs.find((sg) => frame >= sg.from && frame < sg.from + sg.dur) || segs[segs.length - 1];

  // الرسمة المالية للشاشة: الصورة وراها تتضبّب وتعتم. والمقسومة: المتحدث يطلع فوق والرسمة تحته
  let take = 0;
  let split = 0;
  for (const sc of scenes) {
    const k = Math.min(easeInOut((t - sc.s) / 0.35), 1 - easeInOut((t - (sc.e - 0.35)) / 0.35));
    if (layoutOf(sc) === 'split') split = Math.max(split, k);
    else take = Math.max(take, k);
  }

  // البداية: الكادر يقرب عليه بالتدريج طول أول مقطع
  const hook = plan?.hookZoom === false || cur !== segs[0] ? 0 : 0.07 * ease(t / Math.max(1, segs[0].dur / fps));
  const zoom = (cur.zoom + hook) * (1 + 0.1 * take);
  const hv = lerp(H, SPLIT_H, split);
  const p = place(meta, face, zoom, hv, lerp(0.4, 0.42, split));

  // الكتابة مكانها تحت الذقن، بعيد عن ملامحه. وقت القسمة تطلع لآخر صورته وتصغر، ووقت الرسمة الكاملة تنزل تحتها
  const rest = cs.y != null ? cs.y * H : clamp(place(meta, face, 1.1).chin + 170, 1000, 1400);
  const capY = lerp(lerp(rest, 1400, take), SPLIT_H - 120, split);
  const capScale = lerp(1, 0.8, split);
  const pi = pg.findIndex((x, i) => t >= x.s - 0.04 && (i === pg.length - 1 || t < pg[i + 1].s - 0.04));

  return (
    <AbsoluteFill style={{background: split > 0.01 ? th.bg : '#000', fontFamily}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: hv, overflow: 'hidden', filter: take > 0.01 ? `blur(${(take * 28).toFixed(1)}px)` : 'none'}}>
        {segs.map((sg, i) => (
          // المقطع الجاي يتجهّز قبل وقته بثانية، فالقصّة تطلع نظيفة بالمعاينة بدون شاشة سودا
          <Sequence key={i} from={sg.from} durationInFrames={sg.dur} premountFor={fps}>
            <OffthreadVideo
              src={staticFile(meta.source)}
              trimBefore={sg.trim}
              style={{position: 'absolute', left: p.ox, top: p.oy, width: meta.width * p.s, height: meta.height * p.s, maxWidth: 'none'}}
            />
          </Sequence>
        ))}
      </div>
      {split > 0.01 ? <div style={{position: 'absolute', left: 0, top: hv - 3, width: W, height: 6, background: th.acc, opacity: split}} /> : null}
      {take > 0.01 ? <AbsoluteFill style={{background: rgba(th.bg, 0.82 * take)}} /> : null}
      {scenes.map((sc, i) => (t >= sc.s && t <= sc.e ? <ScenePanel key={i} scene={sc} t={t} th={th} shiftY={layoutOf(sc) === 'split' ? hv - SPLIT_H : 0} /> : null))}
      <Caption page={pg[pi]} next={pg[pi + 1]} t={t} th={th} y={capY} hot={hot} cs={cs} scale={capScale} />
      {sounds.map((s, i) => (
        <Sequence key={'s' + i} from={Math.round(s.at * fps)} durationInFrames={Math.ceil(SFX[s.name].len * fps) + 2} layout="none">
          <Audio src={staticFile('sfx/' + s.name + '.wav')} volume={s.vol} />
        </Sequence>
      ))}
      {music ? (
        <Audio
          src={staticFile(music.file)}
          loop
          // تدخل وتطلع بهدوء
          volume={(f) => music.vol * Math.min(1, f / fps, (durationInFrames - f) / (fps * 1.5))}
        />
      ) : null}
    </AbsoluteFill>
  );
};
