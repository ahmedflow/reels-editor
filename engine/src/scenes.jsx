import React from 'react';
import {rgba, clamp, ease, enter, Box} from './kit.jsx';
import {scenes as CUSTOM} from './custom.generated.jsx';
import {SPLIT_H, layoutOf} from './plan.js';

// مساحة الرسمة المالية للشاشة: نص الشاشة تقريباً. الفيديو يتغبّش وراها، فالمساحة كلها لها
export const CANVAS = {x: 70, y: 300, w: 940, h: 960};
// ومساحتها لما الشاشة مقسومة: تحت المتحدث، وفوق أزرار التطبيقات
export const CANVAS_SPLIT = {x: 70, y: SPLIT_H + 50, w: 940, h: 600};
export const canvasOf = (scene) => (layoutOf(scene) === 'split' ? CANVAS_SPLIT : CANVAS);
// القوالب الجاهزة مرسومة على لوحة 940×400 وتتكبّر عشان تملى المساحة
const PANEL = {w: 940, h: 400};
const BUILTIN_SCALE = 1.0;

// شي يتحوّل لشي: صناديق من اليمين لليسار وبينها سهم
function Flow({scene, t, th}) {
  const items = scene.items || [];
  const n = Math.max(1, items.length);
  const gap = 120;
  const bw = Math.min(330, (PANEL.w - (n - 1) * gap) / n);
  const fs = Math.min(68, bw / 4.4);
  return (
    <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'row', direction: 'rtl', alignItems: 'center', justifyContent: 'center'}}>
      {items.map((it, i) => {
        const hot = it.hot ?? i === n - 1;
        const arrowK = i > 0 ? ease((t - (it.at - 0.3)) / 0.3) : 0;
        return (
          <React.Fragment key={i}>
            {i > 0 ? (
              <svg width={gap} height={60} viewBox={`0 0 ${gap} 60`} style={{opacity: arrowK > 0 ? 1 : 0}}>
                <line x1={gap - 18} y1={30} x2={gap - 18 - (gap - 44) * arrowK} y2={30} stroke={th.acc} strokeWidth={9} strokeLinecap="round" />
                <polygon
                  points={`${gap - 26 - (gap - 44) * arrowK},30 ${gap - (gap - 44) * arrowK},12 ${gap - (gap - 44) * arrowK},48`}
                  fill={th.acc}
                />
              </svg>
            ) : null}
            <div style={{width: bw, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, ...enter(t, it.at)}}>
              <Box hot={hot} th={th} style={{width: bw, height: 140, fontSize: fs}}>
                {it.text}
              </Box>
              <div
                style={{
                  height: 62,
                  padding: '0 26px',
                  borderRadius: 31,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 36,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  background: it.note ? (hot ? rgba(th.acc, 0.22) : rgba(th.ink, 0.1)) : 'transparent',
                  color: hot ? th.acc : th.soft,
                  ...(it.note ? enter(t, it.noteAt ?? it.at + 0.4) : {opacity: 0}),
                }}
              >
                {it.note || '.'}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// أرقام تطلع وحدة وحدة مع نطقها
function Numbers({scene, t, th}) {
  const items = scene.items || [];
  const n = Math.max(1, items.length);
  const bw = Math.min(270, (PANEL.w - (n - 1) * 36) / n);
  return (
    <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30}}>
      {scene.label ? <div style={{fontSize: 46, fontWeight: 700, color: th.soft, ...enter(t, scene.labelAt ?? scene.s + 0.4)}}>{scene.label}</div> : null}
      <div style={{display: 'flex', flexDirection: 'row', direction: 'rtl', gap: 36}}>
        {items.map((it, i) => (
          <div key={i} style={{...enter(t, it.at), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12}}>
            <Box hot={it.hot ?? i === n - 1} th={th} style={{width: bw, height: 170, fontSize: Math.min(104, (bw / Math.max(2, String(it.text).length)) * 1.15), direction: 'ltr', fontVariantNumeric: 'tabular-nums'}}>
              {it.text}
            </Box>
            {it.sub ? <div style={{fontSize: 34, fontWeight: 700, color: th.soft}}>{it.sub}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// قائمة: سطر مع كل نقطة يقولها
function List({scene, t, th}) {
  const items = (scene.items || []).slice(0, 4);
  const rowH = Math.min(92, (PANEL.h - (scene.title ? 80 : 0)) / Math.max(1, items.length) - 12);
  // القائمة القصيرة تتكبّر لين تملى مساحتها، بحد أطول سطر فيها
  const longest = Math.max(4, String(scene.title || '').length, ...items.map((it) => String(it.text || '').length + 3));
  const z = Math.max(1, Math.min(1.5, 540 / ((scene.title ? 90 : 0) + items.length * (rowH + 12)), 860 / (longest * 27)));
  return (
    <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', direction: 'rtl', justifyContent: 'center', gap: 12, padding: '0 40px', transform: `scale(${z.toFixed(3)})`, transformOrigin: 'right center'}}>
      {scene.title ? <div style={{fontSize: 50, fontWeight: 800, color: th.acc, marginBottom: 8, ...enter(t, scene.s + 0.4)}}>{scene.title}</div> : null}
      {items.map((it, i) => (
        <div key={i} style={{display: 'flex', alignItems: 'center', gap: 22, height: rowH, ...enter(t, it.at)}}>
          <div style={{width: 56, height: 56, borderRadius: 28, background: th.acc, color: th.onAcc, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800, flexShrink: 0, direction: 'ltr'}}>
            {i + 1}
          </div>
          <div style={{fontSize: Math.min(52, rowH * 0.56), fontWeight: 700, color: th.ink, whiteSpace: 'nowrap'}}>{it.text}</div>
        </div>
      ))}
    </div>
  );
}

// كلمة أو جملة قصيرة كبيرة — للحظة اللي تستاهل وقفة
function Word({scene, t, th}) {
  const words = String(scene.text || '').split(/\s+/).filter(Boolean);
  const at = scene.at || [];
  const fs = Math.min(150, (PANEL.w / Math.max(4, String(scene.text || '').length)) * 1.9);
  return (
    <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16}}>
      <div style={{display: 'flex', flexDirection: 'row', direction: 'rtl', flexWrap: 'wrap', justifyContent: 'center', gap: '0 28px', fontSize: fs, fontWeight: 800, lineHeight: 1.25}}>
        {words.map((w, i) => (
          <span key={i} style={{color: (scene.hot || []).includes(i) ? th.acc : th.ink, display: 'inline-block', ...enter(t, at[i] ?? scene.s + 0.4 + i * 0.12)}}>
            {w}
          </span>
        ))}
      </div>
      {scene.sub ? <div style={{fontSize: 44, fontWeight: 700, color: th.soft, ...enter(t, scene.subAt ?? scene.s + 0.9)}}>{scene.sub}</div> : null}
    </div>
  );
}

const TYPES = {flow: Flow, numbers: Numbers, list: List, word: Word};

// shiftY: وقت القسمة الرسمة تطلع وتنزل مع الخط الفاصل، فما تركب على صورة المتحدث
export function ScenePanel({scene, t, th, shiftY = 0}) {
  const k = Math.min(ease((t - scene.s - 0.12) / 0.25), 1 - clamp((t - (scene.e - 0.25)) / 0.25));
  const cv = canvasOf(scene);
  const base = {position: 'absolute', left: cv.x, top: cv.y + shiftY, width: cv.w, height: cv.h, opacity: k};
  if (scene.type === 'custom') {
    const C = CUSTOM[scene.name];
    if (!C) return <div style={{...base, color: '#ff5555', fontSize: 50, fontWeight: 700, direction: 'rtl'}}>الرسمة مو موجودة بـcustom.jsx: {String(scene.name)}</div>;
    return (
      <div style={base}>
        <C t={t} local={t - scene.s} scene={scene} th={th} W={cv.w} H={cv.h} layout={layoutOf(scene)} />
      </div>
    );
  }
  const C = TYPES[scene.type];
  if (!C) return null;
  return (
    <div style={{...base, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{position: 'relative', width: PANEL.w, height: PANEL.h, transform: 'scale(' + BUILTIN_SCALE + ')'}}>
        <C scene={scene} t={t} th={th} />
      </div>
    </div>
  );
}
