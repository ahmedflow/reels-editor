import React from 'react';
import {rgba, clamp, ease, prog, enter, pop, slide, count, float, splitNumber, Card, Icon, Art} from './kit.jsx';
import {scenes as CUSTOM} from './custom.generated.jsx';
import {SPLIT_H, layoutOf} from './plan.js';

// مساحة الرسمة المالية للشاشة: نص الشاشة تقريباً. الفيديو يتغبّش وراها، فالمساحة كلها لها
export const CANVAS = {x: 70, y: 300, w: 940, h: 960};
// ومساحتها لما الشاشة مقسومة: تحت المتحدث، وفوق أزرار التطبيقات
export const CANVAS_SPLIT = {x: 70, y: SPLIT_H + 50, w: 940, h: 600};
export const canvasOf = (scene) => (layoutOf(scene) === 'split' ? CANVAS_SPLIT : CANVAS);

const fill = {position: 'absolute', inset: 0, display: 'flex'};
// خط يصغر لين النص يدخل بعرضه
const fit = (text, width, max, ratio = 1.75) => Math.min(max, (width / Math.max(3, String(text ?? '').length)) * ratio);
// رقم يعدّ لين يوصل للي انقال، واللي مو رقم ينعرض زي ما هو
const Counted = ({text, t, at}) => {
  const p = splitNumber(text);
  return <>{p ? p.pre + count(t, at, p.n) + p.post : text}</>;
};
// دائرة ملوّنة فيها أيقونة ترسم نفسها، أو رقم الترتيب
const Badge = ({icon, n, size, th, t, at}) => (
  <div style={{width: size, height: size, borderRadius: '50%', background: th.acc, color: th.onAcc, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: size * 0.5, fontWeight: 800, direction: 'ltr'}}>
    {icon ? <Icon name={icon} size={size * 0.58} color={th.onAcc} stroke={2.3} draw={prog(t, at + 0.12, 0.45)} /> : n}
  </div>
);

// شي يتحوّل لشي: بطاقات من اليمين لليسار، كل وحدة فيها أيقونة ترسم نفسها، وبينها سهم ينمد
function Flow({scene, t, th, W, H}) {
  const items = (scene.items || []).slice(0, 3);
  const n = Math.max(1, items.length);
  const big = H >= 900;
  const gap = n === 3 ? 84 : 130;
  const bw = Math.min(340, (W - (n - 1) * gap) / n);
  const ch = big ? 420 : 350;
  const artSize = Math.min(bw - 30, ch - 130);
  return (
    <div style={{...fill, flexDirection: 'row', direction: 'rtl', alignItems: 'center', justifyContent: 'center'}}>
      {items.map((it, i) => {
        const hot = it.hot ?? i === n - 1;
        const ak = i > 0 ? prog(t, it.at - 0.35, 0.35) : 0;
        const tip = gap - 14 - (gap - 34) * ak;
        return (
          <React.Fragment key={i}>
            {i > 0 ? (
              <svg width={gap} height={60} viewBox={`0 0 ${gap} 60`} style={{opacity: ak > 0.02 ? 1 : 0, flexShrink: 0, marginBottom: it.note || items[i - 1].note ? 80 : 0}}>
                <line x1={gap - 14} y1={30} x2={tip} y2={30} stroke={th.acc} strokeWidth={9} strokeLinecap="round" />
                <polygon points={`${tip - 12},30 ${tip + 14},12 ${tip + 14},48`} fill={th.acc} />
              </svg>
            ) : null}
            <div style={{width: bw, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, ...pop(t, it.at)}}>
              <Card hot={hot && !it.art} th={th} style={{width: bw, height: ch, flexDirection: 'column', gap: it.art ? 6 : 20, padding: 18, ...(hot && it.art ? {borderColor: th.acc, boxShadow: `0 18px 60px ${rgba(th.acc, 0.3)}`} : {})}}>
                {it.art ? (
                  <div style={{transform: `translateY(${float(t, 5, 1, i)}px)`}}>
                    <Art name={it.art} size={artSize} th={th} k={prog(t, it.at, 0.9)} />
                  </div>
                ) : it.icon ? <Icon name={it.icon} size={artSize * 0.72} stroke={1.7} draw={prog(t, it.at + 0.1, 0.5)} /> : <Badge n={i + 1} size={big ? 96 : 80} th={hot ? {acc: th.onAcc, onAcc: th.acc} : th} t={t} at={it.at} />}
                <div style={{fontSize: fit(it.text, bw - 36, 72, 2), whiteSpace: 'nowrap'}}>{it.text}</div>
              </Card>
              {it.note ? (
                <div style={{height: 62, padding: '0 26px', borderRadius: 31, display: 'flex', alignItems: 'center', fontSize: 36, fontWeight: 700, whiteSpace: 'nowrap', background: hot ? rgba(th.acc, 0.22) : rgba(th.ink, 0.1), color: hot ? th.acc : th.soft, ...enter(t, it.noteAt ?? it.at + 0.4)}}>
                  {it.note}
                </div>
              ) : null}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// أرقام تنقال: كل رقم عمود يطلع بطوله، فالفرق بينها ينشاف قبل ما ينقرا
function Numbers({scene, t, th, W, H}) {
  const items = (scene.items || []).slice(0, 4);
  const n = Math.max(1, items.length);
  const big = H >= 900;
  const parsed = items.map((it) => splitNumber(it.text));
  const bars = n > 1 && parsed.every(Boolean);
  const top = bars ? Math.max(1, ...parsed.map((p) => p.n)) : 1;
  const barMax = big ? 380 : 200;
  const colW = Math.min(250, (W - (n - 1) * 36) / n);
  return (
    <div style={{...fill, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: big ? 44 : 24}}>
      {scene.label ? <div style={{fontSize: big ? 68 : 54, fontWeight: 700, color: th.ink, ...enter(t, scene.labelAt ?? scene.s + 0.4)}}>{scene.label}</div> : null}
      <div style={{display: 'flex', flexDirection: 'row', direction: 'rtl', alignItems: 'flex-end', gap: 36}}>
        {items.map((it, i) => {
          const hot = it.hot ?? i === n - 1;
          const num = (
            <div style={{fontSize: fit(it.text, colW, big ? 130 : 104, 1.5), fontWeight: 800, lineHeight: 1.1, direction: 'ltr', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: bars ? (hot ? th.acc : th.ink) : 'inherit'}}>
              <Counted text={it.text} t={t} at={it.at} />
            </div>
          );
          return (
            <div key={i} style={{width: colW, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, ...pop(t, it.at)}}>
              {bars ? (
                <>
                  {num}
                  <div style={{width: colW, height: Math.max(26, (barMax * parsed[i].n) / top) * prog(t, it.at, 0.6), borderRadius: '24px 24px 8px 8px', background: hot ? th.acc : rgba(th.ink, 0.24), boxShadow: hot ? `0 12px 50px ${rgba(th.acc, 0.35)}` : 'none'}} />
                </>
              ) : (
                <Card hot={hot} th={th} style={{width: colW, height: big ? 220 : 180}}>
                  {num}
                </Card>
              )}
              {it.sub ? <div style={{fontSize: 38, fontWeight: 700, color: th.soft, whiteSpace: 'nowrap'}}>{it.sub}</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// نقاط ورا بعض: كل نقطة بطاقة تدخل من الجنب ومعها أيقونتها
function List({scene, t, th, W, H}) {
  const items = (scene.items || []).slice(0, 4);
  const n = Math.max(1, items.length);
  const big = H >= 900;
  const titleH = scene.title ? (big ? 130 : 100) : 0;
  const rowH = Math.min(big ? 150 : 118, (H - titleH - 20) / n - 18);
  const longest = Math.max(6, ...items.map((it) => String(it.text || '').length));
  const fs = Math.min(rowH * 0.5, ((W - 230) / longest) * 2.3);
  return (
    <div style={{...fill, flexDirection: 'column', direction: 'rtl', justifyContent: 'center', gap: 18, padding: '0 20px'}}>
      {scene.title ? (
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, marginBottom: 6, ...enter(t, scene.s + 0.4)}}>
          <div style={{fontSize: fit(scene.title, W - 80, big ? 70 : 56, 1.9), fontWeight: 800, color: th.acc, whiteSpace: 'nowrap'}}>{scene.title}</div>
          <div style={{height: 6, borderRadius: 3, background: th.acc, width: 180 * prog(t, scene.s + 0.55, 0.4)}} />
        </div>
      ) : null}
      {items.map((it, i) => (
        <div key={i} style={slide(t, it.at, 90)}>
          <Card hot={it.hot === true} th={th} style={{height: rowH, justifyContent: 'flex-start', gap: 26, padding: '0 24px', borderRadius: rowH * 0.3}}>
            <Badge icon={it.icon} n={i + 1} size={rowH * 0.66} th={it.hot === true ? {acc: th.onAcc, onAcc: th.acc} : th} t={t} at={it.at} />
            <div style={{fontSize: fs, whiteSpace: 'nowrap'}}>{it.text}</div>
          </Card>
        </div>
      ))}
    </div>
  );
}

// عبارة بحجم الشاشة: الكلمات تنبض وحدة وحدة، والملوّنة ينمد تحتها خط
function Word({scene, t, th, W, H}) {
  const words = String(scene.text || '').split(/\s+/).filter(Boolean);
  const at = scene.at || [];
  const hot = scene.hot || [];
  const fs = Math.min(H >= 900 ? 170 : 130, (W / Math.max(4, String(scene.text || '').length)) * 2.1);
  return (
    <div style={{...fill, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26}}>
      <div style={{display: 'flex', flexDirection: 'row', direction: 'rtl', flexWrap: 'wrap', justifyContent: 'center', gap: `10px ${fs * 0.26}px`, fontSize: fs, fontWeight: 800, lineHeight: 1.2}}>
        {words.map((w, i) => {
          const wa = at[i] ?? scene.s + 0.4 + i * 0.12;
          return (
            <span key={i} style={{display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', color: hot.includes(i) ? th.acc : th.ink, ...pop(t, wa)}}>
              {w}
              <span style={{height: Math.max(8, fs * 0.07), borderRadius: 6, background: th.acc, width: hot.includes(i) ? `${prog(t, wa + 0.2, 0.35) * 100}%` : 0}} />
            </span>
          );
        })}
      </div>
      {scene.sub ? <div style={{fontSize: H >= 900 ? 58 : 46, fontWeight: 700, color: th.soft, ...enter(t, scene.subAt ?? scene.s + 0.9)}}>{scene.sub}</div> : null}
    </div>
  );
}

// فاتورة: بنود التكلفة تنزل سطر سطر، وتحتها المجموع يعدّ لين يوصل
function Total({scene, t, th, W, H}) {
  const items = (scene.items || []).slice(0, 4);
  const n = Math.max(1, items.length);
  const big = H >= 900;
  const hasTotal = scene.total != null && scene.total !== '';
  const titleH = scene.title ? (big ? 110 : 84) : 0;
  const totalH = hasTotal ? (big ? 190 : 140) : 0;
  const rowH = Math.min(big ? 130 : 100, (H - titleH - totalH - 30) / n - 10);
  const longest = Math.max(6, ...items.map((it) => String(it.text || '').length + String(it.amount ?? '').length + 4));
  const fs = Math.min(rowH * 0.52, ((W - 170) / longest) * 2.5);
  const totalAt = scene.totalAt ?? (items.length ? items[items.length - 1].at + 0.8 : scene.s + 0.6);
  return (
    <div style={{...fill, flexDirection: 'column', direction: 'rtl', justifyContent: 'center', gap: 10, padding: '0 20px'}}>
      {scene.title ? <div style={{fontSize: fit(scene.title, W - 80, big ? 64 : 52, 1.9), fontWeight: 800, color: th.acc, marginBottom: 8, whiteSpace: 'nowrap', ...enter(t, scene.s + 0.4)}}>{scene.title}</div> : null}
      {items.map((it, i) => (
        <div key={i} style={{display: 'flex', alignItems: 'center', gap: 22, height: rowH, borderBottom: `3px dashed ${rgba(th.ink, 0.2)}`, ...slide(t, it.at, 80)}}>
          <Badge icon={it.icon} n={i + 1} size={rowH * 0.62} th={th} t={t} at={it.at} />
          <div style={{fontSize: fs, fontWeight: 700, color: th.ink, whiteSpace: 'nowrap', flex: 1}}>{it.text}</div>
          {it.amount != null ? (
            <div style={{fontSize: fs * 1.08, fontWeight: 800, color: th.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums'}}>
              <Counted text={it.amount} t={t} at={it.at} />
            </div>
          ) : null}
        </div>
      ))}
      {hasTotal ? (
        <div style={{marginTop: 14, ...pop(t, totalAt)}}>
          <Card hot th={th} style={{height: totalH - 30, justifyContent: 'space-between', padding: '0 34px', borderRadius: 30}}>
            <div style={{fontSize: big ? 66 : 54, whiteSpace: 'nowrap'}}>{scene.totalLabel || 'المجموع'}</div>
            <div style={{fontSize: fit(scene.total, W * 0.5, big ? 104 : 82, 1.9), fontWeight: 800, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums'}}>
              <Counted text={scene.total} t={t} at={totalAt} />
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

// مقارنة: جهتين جنب بعض، كل وحدة لها أيقونتها وتحتها نقاطها
function Compare({scene, t, th, W, H}) {
  const sides = [scene.right, scene.left].filter(Boolean);
  const big = H >= 900;
  const colW = (W - 70) / 2;
  const headH = big ? 380 : 230;
  const startAt = scene.s + 0.5;
  const maxRows = Math.max(0, ...sides.map((sd) => Math.min(3, (sd.items || []).length)));
  const rowFs = big ? 62 : 46;
  const blockH = headH + maxRows * (rowFs * 1.5 + (big ? 26 : 14));
  const topPad = Math.max(0, (H - blockH) / 2);
  return (
    <div style={{...fill, flexDirection: 'row', direction: 'rtl', alignItems: 'flex-start', justifyContent: 'center', gap: 70, paddingTop: topPad}}>
      {sides.map((sd, i) => {
        const hot = sd.hot ?? i === sides.length - 1;
        const at = sd.at ?? startAt + i * 0.8;
        const rows = (sd.items || []).slice(0, 3);
        return (
          <React.Fragment key={i}>
            {i > 0 ? <div style={{position: 'absolute', left: W / 2 - 3, top: topPad, width: 6, borderRadius: 3, background: rgba(th.ink, 0.25), height: blockH * prog(t, at - 0.3, 0.5)}} /> : null}
            <div style={{width: colW, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: big ? 26 : 16}}>
              <div style={pop(t, at)}>
                <Card hot={hot && !sd.art} th={th} style={{width: colW, height: headH, flexDirection: 'column', gap: sd.art ? 2 : 14, padding: 16, ...(hot && sd.art ? {borderColor: th.acc, boxShadow: `0 18px 60px ${rgba(th.acc, 0.3)}`} : {})}}>
                  {sd.art ? <Art name={sd.art} size={big ? 240 : 130} th={th} k={prog(t, at, 0.9)} /> : sd.icon ? <Icon name={sd.icon} size={big ? 170 : 96} stroke={1.8} draw={prog(t, at + 0.1, 0.5)} /> : null}
                  <div style={{fontSize: fit(sd.title, colW - 40, big ? 80 : 60, 2), whiteSpace: 'nowrap'}}>{sd.title}</div>
                </Card>
              </div>
              {rows.map((it, j) => (
                <div key={j} style={{display: 'flex', direction: 'rtl', alignItems: 'center', gap: 14, width: colW, ...enter(t, it.at)}}>
                  <Icon name={sd.mark === 'cross' ? 'cross' : 'check'} size={rowFs * 0.9} color={hot ? th.acc : th.soft} stroke={3} draw={prog(t, it.at + 0.1, 0.3)} />
                  <div style={{fontSize: fit(it.text, colW - 80, rowFs, 2.1), fontWeight: 700, color: th.ink, whiteSpace: 'nowrap'}}>{it.text}</div>
                </div>
              ))}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// رقم واحد كبير: يعدّ لين يوصل، وحوله حلقة تنقفل
function Stat({scene, t, th, W, H}) {
  const big = H >= 900;
  const at = scene.at ?? scene.s + 0.5;
  const ring = big ? 230 : 150;
  const r = ring / 2 - 8;
  const k = prog(t, at - 0.1, 0.7);
  return (
    <div style={{...fill, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: big ? 30 : 12}}>
      {scene.art ? (
        <div style={{transform: `translateY(${float(t, 7)}px)`}}>
          <Art name={scene.art} size={big ? 360 : 220} th={th} k={prog(t, at - 0.3, 1)} />
        </div>
      ) : scene.icon ? (
        <div style={{position: 'relative', width: ring, height: ring, display: 'flex', alignItems: 'center', justifyContent: 'center', color: th.ink, ...enter(t, at - 0.2)}}>
          <svg width={ring} height={ring} style={{position: 'absolute', inset: 0, transform: 'rotate(-90deg)'}}>
            <circle cx={ring / 2} cy={ring / 2} r={r} fill="none" stroke={rgba(th.ink, 0.16)} strokeWidth={10} />
            <circle cx={ring / 2} cy={ring / 2} r={r} fill="none" stroke={th.acc} strokeWidth={10} strokeLinecap="round" strokeDasharray={2 * Math.PI * r} strokeDashoffset={2 * Math.PI * r * (1 - k)} />
          </svg>
          <Icon name={scene.icon} size={ring * 0.5} stroke={1.9} draw={prog(t, at, 0.5)} />
        </div>
      ) : null}
      <div style={{display: 'flex', direction: 'rtl', alignItems: 'baseline', justifyContent: 'center', gap: 24, ...pop(t, at)}}>
        <div style={{fontSize: fit(scene.value, W * (scene.unit ? 0.55 : 0.9), big ? 300 : 200, 1.5), fontWeight: 800, lineHeight: 1, color: th.acc, direction: 'ltr', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}>
          <Counted text={scene.value} t={t} at={at} />
        </div>
        {scene.unit ? <div style={{fontSize: big ? 84 : 60, fontWeight: 700, color: th.ink, whiteSpace: 'nowrap'}}>{scene.unit}</div> : null}
      </div>
      {scene.label ? <div style={{fontSize: fit(scene.label, W - 60, big ? 64 : 50, 1.9), fontWeight: 700, color: th.soft, whiteSpace: 'nowrap', ...enter(t, scene.labelAt ?? at + 0.3)}}>{scene.label}</div> : null}
    </div>
  );
}

// ضوّين خفيفين يتحركون ببطء ورا الرسمة: يعطونها عمق وحياة بدون ما يسحبون العين
function Backdrop({t, th, W, H}) {
  const blob = (x, y, r) => ({position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', background: `radial-gradient(circle, ${rgba(th.acc, 0.2)}, ${rgba(th.acc, 0)} 68%)`});
  return (
    <>
      <div style={blob(W * 0.22 + Math.sin(t * 0.5) * 50, H * 0.3 + Math.cos(t * 0.4) * 36, H * 0.5)} />
      <div style={blob(W * 0.8 + Math.cos(t * 0.45) * 46, H * 0.72 + Math.sin(t * 0.55) * 30, H * 0.42)} />
    </>
  );
}

const TYPES = {flow: Flow, numbers: Numbers, list: List, word: Word, total: Total, compare: Compare, stat: Stat};

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
        <Backdrop t={t} th={th} W={cv.w} H={cv.h} />
        <C t={t} local={t - scene.s} scene={scene} th={th} W={cv.w} H={cv.h} layout={layoutOf(scene)} />
      </div>
    );
  }
  const C = TYPES[scene.type];
  if (!C) return null;
  return (
    <div style={base}>
      <Backdrop t={t} th={th} W={cv.w} H={cv.h} />
      <C scene={scene} t={t} th={th} W={cv.w} H={cv.h} />
    </div>
  );
}
