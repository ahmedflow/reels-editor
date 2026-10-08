// واجهة المحرّر: معاينة حيّة + تايم لاين + لوحة تعديل. كل تغيير ينحفظ بملفات مجلد الشغل.
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Player} from '@remotion/player';
import {Reel} from '../src/Reel.jsx';
import {PALETTES, resolveTheme} from '../src/theme.js';
import {STYLES, SFX, H, layoutOf, captionStyle, resolveSounds, validatePlan, applyFix, retimeProject, keepTotal, toSource} from '../src/plan.js';

const FPS = 30;
const r2 = (x) => Math.round(x * 100) / 100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const norm = (w) => w.replace(/[ً-ْـ]/g, '').replace(/[^\p{L}\p{N}]/gu, '');
const stamp = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`;

const api = (url, opt = {}) =>
  fetch(url, {...opt, headers: {'x-reels-editor': '1', ...(opt.headers || {})}}).then(async (r) => {
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'تعذّر الطلب');
    return j;
  });

// ——— أدوات صغيرة ———
const isTime = (k) => k === 'at' || /At$/.test(k || '');
// يزحّف كل وقت داخل الرسمة بنفس المقدار، فعناصرها تمشي معها
const shift = (v, k, d) => {
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'number' && isTime(k) ? r2(x + d) : shift(x, k, d)));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([kk, x]) => [kk, shift(x, kk, d)]));
  if (typeof v === 'number' && (k === 's' || k === 'e' || isTime(k))) return r2(v + d);
  return v;
};

const KEY_LABELS = {text: 'النص', at: 'الوقت', note: 'تعليق', noteAt: 'وقت التعليق', title: 'العنوان', label: 'العنوان', labelAt: 'وقت العنوان', sub: 'سطر تحتي', subAt: 'وقت السطر', items: 'العناصر', hot: 'ملوّن', before: 'قبل', after: 'بعد', tag: 'البطاقة', steps: 'الخطوات', n: 'الرقم'};
const TYPE_LABELS = {list: 'قائمة', numbers: 'أرقام', flow: 'تحويل', word: 'عبارة', custom: 'رسمة خاصة'};
const sceneTitle = (sc) => (sc.type === 'custom' ? sc.name : TYPE_LABELS[sc.type]) + (sc.title || sc.text || sc.label ? ' · ' + (sc.title || sc.text || sc.label) : '');

const newScene = (type, t) => {
  const s = r2(t);
  const base = {
    list: {type, layout: 'split', s, e: r2(s + 4.5), title: 'العنوان', items: [{text: 'النقطة الأولى', at: r2(s + 0.6)}, {text: 'النقطة الثانية', at: r2(s + 1.8)}]},
    numbers: {type, layout: 'full', s, e: r2(s + 3.5), label: '', items: [{text: '10', at: r2(s + 0.6)}, {text: '20', at: r2(s + 1.6)}]},
    flow: {type, layout: 'split', s, e: r2(s + 4), items: [{text: 'قبل', at: r2(s + 0.6)}, {text: 'بعد', at: r2(s + 1.8)}]},
    word: {type, layout: 'full', s, e: r2(s + 3), text: 'العبارة هنا', at: [r2(s + 0.5), r2(s + 0.9)], hot: [1]},
  };
  return base[type];
};

function useHistory(initial) {
  const [h, setH] = useState({past: [], now: initial, future: []});
  const last = useRef({tag: null, at: 0});
  // tag يجمع التغييرات المتتالية (سحب، سلايدر) بخطوة تراجع وحدة
  const set = useCallback((fn, tag) => {
    setH((cur) => {
      const next = typeof fn === 'function' ? fn(cur.now) : fn;
      if (next === cur.now) return cur;
      const merge = tag && last.current.tag === tag && Date.now() - last.current.at < 900;
      last.current = {tag, at: Date.now()};
      return {past: merge ? cur.past : [...cur.past.slice(-80), cur.now], now: next, future: []};
    });
  }, []);
  const undo = useCallback(() => {
    last.current = {tag: null, at: 0};
    setH((c) => (c.past.length ? {past: c.past.slice(0, -1), now: c.past[c.past.length - 1], future: [c.now, ...c.future]} : c));
  }, []);
  const redo = useCallback(() => {
    last.current = {tag: null, at: 0};
    setH((c) => (c.future.length ? {past: [...c.past, c.now], now: c.future[0], future: c.future.slice(1)} : c));
  }, []);
  return {doc: h.now, set, undo, redo, canUndo: h.past.length > 0, canRedo: h.future.length > 0};
}

// سحب بالماوس: يعطيك الفرق بالبكسل من نقطة البداية
function drag(e, onMove, onEnd) {
  e.preventDefault();
  e.stopPropagation();
  const x0 = e.clientX;
  const y0 = e.clientY;
  const move = (ev) => onMove(ev.clientX - x0, ev.clientY - y0, ev);
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    onEnd && onEnd();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

// ——— عناصر اللوحة ———
const Row = ({label, children}) => (
  <div className="row">
    <label>{label}</label>
    <div className="val">{children}</div>
  </div>
);
const Seg = ({value, options, onChange}) => (
  <div className="seg">
    {options.map(([v, l]) => (
      <button key={String(v)} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
        {l}
      </button>
    ))}
  </div>
);
const Slider = ({value, min, max, step = 1, onChange, show}) => (
  <>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    <span className="num">{show ? show(value) : value}</span>
  </>
);
const Num = ({value, step = 0.05, min, max, onChange}) => (
  <input
    type="number"
    step={step}
    min={min}
    max={max}
    value={Number.isFinite(value) ? value : ''}
    onChange={(e) => {
      const v = parseFloat(e.target.value);
      if (Number.isFinite(v)) onChange(v);
    }}
  />
);
const Color = ({value, fallback, onChange}) => (
  <>
    <input type="color" value={value || fallback} onChange={(e) => onChange(e.target.value)} />
    {value ? (
      <button className="ghost" onClick={() => onChange(undefined)}>
        تلقائي
      </button>
    ) : (
      <span className="num" style={{minWidth: 0}}>
        تلقائي
      </span>
    )}
  </>
);

// حقول الرسمة: تنبني من بياناتها، فتشتغل مع القوالب ومع أي رسمة خاصة
function Fields({value, onChange, skip = []}) {
  return Object.entries(value)
    .filter(([k]) => !skip.includes(k))
    .map(([k, v]) => {
      const label = KEY_LABELS[k] || k;
      const put = (nv) => onChange({...value, [k]: nv});
      if (typeof v === 'string')
        return (
          <Row key={k} label={label}>
            <input type="text" value={v} onChange={(e) => put(e.target.value)} />
          </Row>
        );
      if (typeof v === 'number')
        return (
          <Row key={k} label={label}>
            <Num value={v} step={isTime(k) ? 0.05 : 1} onChange={put} />
          </Row>
        );
      if (typeof v === 'boolean')
        return (
          <Row key={k} label={label}>
            <input type="checkbox" checked={v} onChange={(e) => put(e.target.checked)} />
          </Row>
        );
      if (Array.isArray(v) && v.every((x) => typeof x === 'number'))
        return (
          <Row key={k} label={label}>
            {v.map((x, i) => (
              <Num key={i} value={x} step={isTime(k) ? 0.05 : 1} onChange={(nv) => put(v.map((y, j) => (j === i ? nv : y)))} />
            ))}
          </Row>
        );
      if (Array.isArray(v) && v.every((x) => x && typeof x === 'object'))
        return (
          <div className="group" key={k}>
            <h4>{label}</h4>
            {v.map((it, i) => (
              <div className="card" key={i}>
                <div className="head">
                  <span>{i + 1}</span>
                  <button className="ghost danger" disabled={v.length <= 1} onClick={() => put(v.filter((_, j) => j !== i))}>
                    حذف
                  </button>
                </div>
                <Fields value={it} onChange={(nv) => put(v.map((y, j) => (j === i ? nv : y)))} />
              </div>
            ))}
            <button onClick={() => put([...v, shift(v[v.length - 1], '', 0.8)])}>＋ عنصر</button>
          </div>
        );
      return null;
    });
}

// ——— لوحة: العنصر المحدد ———
function SelectionPanel({doc, set, sel, setSel, sentences, total, seek}) {
  const {plan, cut, fix, raw} = doc;
  if (!sel) return <div className="empty">اضغط على رسمة أو جملة أو مقطع بالتايم لاين عشان تعدّله</div>;

  if (sel.kind === 'scene') {
    const sc = plan.scenes?.[sel.i];
    if (!sc) return null;
    const put = (nv, tag) => set((d) => ({...d, plan: {...d.plan, scenes: d.plan.scenes.map((x, j) => (j === sel.i ? nv : x))}}), tag);
    const sfxMode = sc.sfx === false ? 'off' : Array.isArray(sc.sfx) ? 'custom' : 'auto';
    return (
      <>
        <div className="group">
          <h4>{sceneTitle(sc)}</h4>
          <Row label="الوضع">
            <Seg value={layoutOf(sc)} options={[['split', 'الشاشة مقسومة'], ['full', 'مالية الشاشة']]} onChange={(v) => put({...sc, layout: v})} />
          </Row>
          <Row label="تبدأ">
            <Num value={sc.s} min={0} max={total} onChange={(v) => put(shift(sc, '', v - sc.s), 'scene-s')} />
          </Row>
          <Row label="تخلص">
            <Num value={sc.e} min={0} max={total} onChange={(v) => put({...sc, e: v}, 'scene-e')} />
          </Row>
          <Row label="الصوت">
            <Seg
              value={sfxMode}
              options={[['auto', 'تلقائي'], ['custom', 'مخصص'], ['off', 'بدون']]}
              onChange={(v) => {
                const {sfx, ...rest} = sc;
                if (v === 'auto') put(rest);
                else if (v === 'off') put({...rest, sfx: false});
                else put({...rest, sfx: resolveSounds({scenes: [rest]}, {}, total).map((x) => ({at: r2(x.at), name: x.name}))});
              }}
            />
          </Row>
        </div>
        {Array.isArray(sc.sfx) ? (
          <div className="group">
            <h4>مؤثرات الرسمة</h4>
            {sc.sfx.map((x, i) => (
              <div className="row" key={i} style={{gridTemplateColumns: '1fr 90px 34px'}}>
                <select value={x.name} onChange={(e) => put({...sc, sfx: sc.sfx.map((y, j) => (j === i ? {...y, name: e.target.value} : y))})}>
                  {Object.entries(SFX).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <Num value={x.at} onChange={(v) => put({...sc, sfx: sc.sfx.map((y, j) => (j === i ? {...y, at: v} : y))}, 'sfx-at')} />
                <button className="icon ghost danger" onClick={() => put({...sc, sfx: sc.sfx.filter((_, j) => j !== i)})}>
                  ✕
                </button>
              </div>
            ))}
            <button onClick={() => put({...sc, sfx: [...sc.sfx, {at: r2(sc.s + 0.5), name: 'pop'}]})}>＋ مؤثر</button>
          </div>
        ) : null}
        <div className="group">
          <h4>المحتوى</h4>
          <Fields value={sc} onChange={(nv) => put(nv, 'scene-fields')} skip={['type', 'name', 'layout', 's', 'e', 'sfx']} />
        </div>
        <div className="btns">
          <button
            onClick={() => {
              const copy = shift(sc, '', r2(sc.e - sc.s + 3));
              set((d) => ({...d, plan: {...d.plan, scenes: [...d.plan.scenes, copy]}}));
              setSel({kind: 'scene', i: plan.scenes.length});
            }}
          >
            تكرار
          </button>
          <button
            className="danger"
            onClick={() => {
              set((d) => ({...d, plan: {...d.plan, scenes: d.plan.scenes.filter((_, j) => j !== sel.i)}}));
              setSel(null);
            }}
          >
            حذف الرسمة
          </button>
        </div>
      </>
    );
  }

  if (sel.kind === 'sentence') {
    const sen = sentences.find((s) => s.id === sel.id);
    if (!sen) return null;
    const hot = new Set((plan.hot || []).map(norm));
    const toggle = (w) => {
      const n = norm(w);
      set((d) => {
        const cur = d.plan.hot || [];
        return {...d, plan: {...d.plan, hot: cur.some((x) => norm(x) === n) ? cur.filter((x) => norm(x) !== n) : [...cur, w]}};
      });
    };
    const original = raw.sentences.find((s) => s.id === sel.id)?.text;
    return (
      <>
        <div className="group">
          <h4>
            الجملة {sen.id} · {stamp(sen.s)}
          </h4>
          <textarea
            dir="rtl"
            value={fix[String(sen.id)] ?? sen.text}
            onChange={(e) => set((d) => ({...d, fix: {...d.fix, [String(sen.id)]: e.target.value}}), 'sentence-' + sen.id)}
          />
          <p className="hint">عدّل النص مباشرة. إذا تغيّر عدد الكلمات، الوقت يتوزّع على الجملة بالتساوي تقريباً.</p>
          {fix[String(sen.id)] != null && fix[String(sen.id)] !== original ? (
            <button
              onClick={() =>
                set((d) => {
                  const {[String(sen.id)]: _, ...rest} = d.fix;
                  return {...d, fix: rest};
                })
              }
            >
              رجّع اللي كتبه البرنامج
            </button>
          ) : null}
        </div>
        <div className="group">
          <h4>الكلمات البارزة (اضغط الكلمة)</h4>
          <div className="chips">
            {sen.words.map((w, i) => (
              <span key={i} className={'chip' + (hot.has(norm(w.t)) ? ' on' : '')} onClick={() => toggle(w.t)}>
                {w.t}
              </span>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (sel.kind === 'seg') {
    const k = cut.keep[sel.i];
    if (!k) return null;
    const lo = sel.i > 0 ? cut.keep[sel.i - 1][1] : 0;
    const hi = sel.i < cut.keep.length - 1 ? cut.keep[sel.i + 1][0] : cut.source;
    const recut = (keep, tag) => {
      set((d) => {
        const out = retimeProject({raw: d.raw, plan: d.plan}, d.cut.keep, keep);
        return {...d, cut: {...d.cut, keep, total: keepTotal(keep)}, raw: out.raw, plan: out.plan};
      }, tag);
    };
    const edge = (side, v) => {
      const nk = cut.keep.map((x) => x.slice());
      if (side === 0) nk[sel.i][0] = r2(clamp(v, lo, k[1] - 0.2));
      else nk[sel.i][1] = r2(clamp(v, k[0] + 0.2, hi));
      recut(nk, 'seg-edge');
    };
    return (
      <>
        <div className="group">
          <h4>
            المقطع {sel.i + 1} من {cut.keep.length} · طوله {(k[1] - k[0]).toFixed(2)} ث
          </h4>
          <p className="hint">الأوقات هنا بتوقيت التسجيل الأصلي. وسّع الطرف عشان ترجّع جزء انقص، وضيّقه عشان تقص زيادة.</p>
          <Row label="يبدأ من">
            <button className="icon" onClick={() => edge(0, k[0] - 0.1)}>
              −
            </button>
            <Num value={k[0]} step={0.05} onChange={(v) => edge(0, v)} />
            <button className="icon" onClick={() => edge(0, k[0] + 0.1)}>
              +
            </button>
          </Row>
          <Row label="يخلص عند">
            <button className="icon" onClick={() => edge(1, k[1] - 0.1)}>
              −
            </button>
            <Num value={k[1]} step={0.05} onChange={(v) => edge(1, v)} />
            <button className="icon" onClick={() => edge(1, k[1] + 0.1)}>
              +
            </button>
          </Row>
        </div>
        <div className="btns">
          <button
            className="danger"
            disabled={cut.keep.length <= 1}
            onClick={() => {
              recut(cut.keep.filter((_, j) => j !== sel.i));
              setSel(null);
            }}
          >
            حذف المقطع كله
          </button>
        </div>
      </>
    );
  }
  return null;
}

// ——— لوحة: الكتابة ———
function CaptionsPanel({plan, setPlan}) {
  const th = resolveTheme(plan);
  const cs = captionStyle(plan, th);
  const c = plan.captions || {};
  const put = (patch, tag) =>
    setPlan((p) => {
      const next = {...(p.captions || {}), ...patch};
      for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
      return {...p, captions: next};
    }, tag);
  return (
    <>
      <div className="group">
        <h4>الخلفية</h4>
        <Row label="شكلها">
          <Seg value={cs.bg} options={[['none', 'بدون'], ['line', 'ورا السطر'], ['word', 'ورا الكلمة']]} onChange={(v) => put({bg: v})} />
        </Row>
        {cs.bg === 'line' ? (
          <>
            <Row label="لونها">
              <Color value={c.bgColor} fallback="#000000" onChange={(v) => put({bgColor: v}, 'c-bgc')} />
            </Row>
            <Row label="شفافيتها">
              <Slider value={cs.bgOpacity} min={0.1} max={1} step={0.05} onChange={(v) => put({bgOpacity: v}, 'c-bgo')} show={(v) => Math.round(v * 100) + '٪'} />
            </Row>
          </>
        ) : null}
        {cs.bg !== 'line' ? (
          <Row label="حد حول الحروف">
            <input type="checkbox" checked={cs.outline} onChange={(e) => put({outline: e.target.checked})} />
          </Row>
        ) : null}
      </div>
      <div className="group">
        <h4>الألوان</h4>
        <Row label="لون الخط">
          <Color value={c.color} fallback="#ffffff" onChange={(v) => put({color: v}, 'c-col')} />
        </Row>
        <Row label="الكلمة اللي تنقال">
          <Color value={c.activeColor} fallback={th.acc} onChange={(v) => put({activeColor: v}, 'c-act')} />
        </Row>
        <Row label="الكلمات البارزة">
          <Color value={c.hotColor} fallback={th.acc} onChange={(v) => put({hotColor: v}, 'c-hot')} />
        </Row>
      </div>
      <div className="group">
        <h4>الخط</h4>
        <Row label="نوعه">
          <Seg value={plan.font || 'plex'} options={[['plex', 'بلكس'], ['readex', 'ريدكس'], ['almarai', 'المراعي']]} onChange={(v) => setPlan((p) => ({...p, font: v}))} />
        </Row>
        <Row label="حجمه">
          <Slider value={cs.size} min={50} max={150} step={2} onChange={(v) => put({size: v}, 'c-size')} />
        </Row>
        <Row label="سماكته">
          <Seg value={cs.weight} options={[[500, 'عادي'], [700, 'عريض']]} onChange={(v) => put({weight: v})} />
        </Row>
      </div>
      <div className="group">
        <h4>العرض</h4>
        <Row label="كلمات بالمرة">
          <Slider value={cs.perPage} min={1} max={5} onChange={(v) => put({perPage: v}, 'c-pp')} />
        </Row>
        <Row label="المكان">
          <Seg value={c.y == null ? 'auto' : 'manual'} options={[['auto', 'تحت الذقن'], ['manual', 'أحدده أنا']]} onChange={(v) => put({y: v === 'auto' ? undefined : 0.68})} />
        </Row>
        {c.y != null ? (
          <Row label="الارتفاع">
            <Slider value={c.y} min={0.12} max={0.86} step={0.01} onChange={(v) => put({y: v}, 'c-y')} show={(v) => Math.round(v * 100) + '٪'} />
          </Row>
        ) : null}
        {c.y != null ? <p className="hint">أو اسحب الخط المنقّط فوق المقطع.</p> : null}
        <Row label="الكلام يبان تدريجي">
          <input type="checkbox" checked={cs.reveal} onChange={(e) => put({reveal: e.target.checked})} />
        </Row>
        <Row label="نبضة الكلمة">
          <Slider value={cs.pop} min={0} max={0.2} step={0.01} onChange={(v) => put({pop: v}, 'c-pop')} show={(v) => Math.round(v * 100) + '٪'} />
        </Row>
      </div>
      <button onClick={() => setPlan((p) => {
        const {captions, ...rest} = p;
        return rest;
      })}>
        رجّع الكتابة لشكلها الأساسي
      </button>
    </>
  );
}

// ——— لوحة: الشكل العام ———
function LookPanel({plan, setPlan}) {
  const th = resolveTheme(plan);
  const colors = plan.colors || {};
  const putColor = (k, v) =>
    setPlan((p) => {
      const next = {...(p.colors || {})};
      if (v === undefined) delete next[k];
      else next[k] = v;
      return {...p, colors: next};
    }, 'color-' + k);
  return (
    <>
      <div className="group">
        <h4>الباقة</h4>
        <div className="swatches">
          {Object.entries(PALETTES).map(([k, p]) => (
            <div key={k} className={'swatch' + ((plan.palette || 'mono') === k ? ' on' : '')} style={{background: p.bg, color: p.ink}} onClick={() => setPlan((x) => ({...x, palette: k}))}>
              {p.name}
              <i style={{background: p.acc}} />
            </div>
          ))}
        </div>
      </div>
      <div className="group">
        <h4>ألوان خاصة (تغلب الباقة)</h4>
        {[['bg', 'الخلفية'], ['ink', 'النص'], ['acc', 'البارز'], ['onAcc', 'النص فوق البارز'], ['soft', 'الثانوي']].map(([k, l]) => (
          <Row key={k} label={l}>
            <Color value={colors[k]} fallback={th[k]} onChange={(v) => putColor(k, v)} />
          </Row>
        ))}
      </div>
      <div className="group">
        <h4>الحركة</h4>
        <Row label="الطابع">
          <Seg value={STYLES[plan.style] ? plan.style : 'formal'} options={[['calm', 'هادي'], ['formal', 'رسمي'], ['hype', 'حماسي']]} onChange={(v) => setPlan((p) => ({...p, style: v}))} />
        </Row>
        <Row label="قوة القربة">
          <Slider value={plan.zoom ?? 1} min={0} max={2} step={0.1} onChange={(v) => setPlan((p) => ({...p, zoom: v}), 'zoom')} show={(v) => (v === 0 ? 'بدون' : '×' + v.toFixed(1))} />
        </Row>
        <Row label="قربة البداية">
          <input type="checkbox" checked={plan.hookZoom !== false} onChange={(e) => setPlan((p) => ({...p, hookZoom: e.target.checked}))} />
        </Row>
      </div>
    </>
  );
}

// ——— لوحة: الصوت ———
function SoundPanel({plan, setPlan}) {
  const sfx = plan.sfx && typeof plan.sfx === 'object' ? plan.sfx : {enabled: plan.sfx !== false};
  const on = sfx.enabled !== false;
  const input = useRef(null);
  const [err, setErr] = useState('');
  const upload = async (file) => {
    setErr('');
    try {
      const r = await api('/api/music?name=' + encodeURIComponent(file.name), {method: 'POST', body: file});
      setPlan((p) => ({...p, music: {file: r.file, volume: p.music?.volume ?? 0.12}}));
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <>
      <div className="group">
        <h4>المؤثرات</h4>
        <Row label="مشغّلة">
          <input type="checkbox" checked={on} onChange={(e) => setPlan((p) => ({...p, sfx: {...sfx, enabled: e.target.checked}}))} />
        </Row>
        <Row label="علوّها">
          <Slider value={sfx.volume ?? 1} min={0.2} max={2.5} step={0.1} onChange={(v) => setPlan((p) => ({...p, sfx: {...sfx, volume: v}}), 'sfx-vol')} show={(v) => '×' + v.toFixed(1)} />
        </Row>
        <p className="hint">الأصوات تتولّد بالكود: نفخة عند دخول الرسمة، وطقّة أو تكّة مع كل عنصر. تقدر تعدّل مؤثرات كل رسمة من تبويب «العنصر».</p>
      </div>
      <div className="group">
        <h4>الموسيقى</h4>
        {plan.music?.file ? (
          <>
            <Row label="الملف">
              <span>{plan.music.file}</span>
            </Row>
            <Row label="علوّها">
              <Slider value={plan.music.volume ?? 0.12} min={0.02} max={0.5} step={0.01} onChange={(v) => setPlan((p) => ({...p, music: {...p.music, volume: v}}), 'music-vol')} show={(v) => Math.round(v * 100) + '٪'} />
            </Row>
            <button className="danger" onClick={() => setPlan((p) => {
              const {music, ...rest} = p;
              return rest;
            })}>
              شيل الموسيقى
            </button>
          </>
        ) : (
          <>
            <button onClick={() => input.current.click()}>＋ اختر ملف موسيقى</button>
            <p className="hint">تأكد إن لك حق استخدامها. وإذا بتنشر على إنستقرام أو تيك توك، الأسلم تضيفها من مكتبتهم.</p>
          </>
        )}
        <input ref={input} type="file" accept=".mp3,.m4a,.wav,.aac,.ogg" hidden onChange={(e) => e.target.files[0] && upload(e.target.files[0])} />
        {err ? <p className="hint" style={{color: 'var(--bad)'}}>{err}</p> : null}
      </div>
    </>
  );
}

// ——— لوحة: الستايلات المحفوظة ———
const STYLE_KEYS = ['palette', 'colors', 'font', 'style', 'captions', 'zoom', 'hookZoom', 'sfx'];
function StylesPanel({plan, setPlan}) {
  const [styles, setStyles] = useState({});
  const [name, setName] = useState('');
  useEffect(() => {
    api('/api/styles').then(setStyles).catch(() => {});
  }, []);
  const store = (next) => {
    setStyles(next);
    api('/api/styles', {method: 'POST', body: JSON.stringify(next)}).catch(() => {});
  };
  return (
    <>
      <div className="group">
        <h4>احفظ شكل هالمقطع</h4>
        <p className="hint">يحفظ الألوان والخط وشكل الكتابة والحركة، وتطبّقه على أي مقطع ثاني بضغطة.</p>
        <div className="val" style={{display: 'flex', gap: 8}}>
          <input type="text" placeholder="اسم الستايل" value={name} onChange={(e) => setName(e.target.value)} />
          <button
            className="primary"
            disabled={!name.trim()}
            onClick={() => {
              store({...styles, [name.trim()]: Object.fromEntries(STYLE_KEYS.filter((k) => plan[k] !== undefined).map((k) => [k, plan[k]]))});
              setName('');
            }}
          >
            حفظ
          </button>
        </div>
      </div>
      <div className="group">
        <h4>المحفوظة</h4>
        {Object.keys(styles).length === 0 ? <div className="empty">ما فيه ستايلات محفوظة</div> : null}
        {Object.entries(styles).map(([k, v]) => (
          <div className="card" key={k} style={{paddingBottom: 10}}>
            <div className="head" style={{marginBottom: 0}}>
              <b style={{color: 'var(--ink)', fontSize: 14}}>{k}</b>
              <span className="btns">
                <button
                  onClick={() =>
                    setPlan((p) => {
                      const base = Object.fromEntries(Object.entries(p).filter(([key]) => !STYLE_KEYS.includes(key)));
                      return {...base, ...v};
                    })
                  }
                >
                  طبّقه
                </button>
                <button
                  className="ghost danger"
                  onClick={() => {
                    const {[k]: _, ...rest} = styles;
                    store(rest);
                  }}
                >
                  حذف
                </button>
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ——— التايم لاين ———
function Timeline({doc, set, sentences, total, t, seek, sel, setSel, pps}) {
  const {plan, cut} = doc;
  const scenes = plan.scenes || [];
  const sounds = useMemo(() => resolveSounds(plan, {}, total), [plan, total]);
  const width = Math.max(600, total * pps + 40);
  const lanes = useRef(null);
  const step = pps >= 90 ? 1 : pps >= 40 ? 2 : 5;

  const scrub = (e) => {
    const rect = lanes.current.getBoundingClientRect();
    const at = (x) => seek(clamp((x - rect.left) / pps, 0, total));
    at(e.clientX);
    drag(e, (dx, dy, ev) => at(ev.clientX));
  };

  const putScene = (i, nv, tag) => set((d) => ({...d, plan: {...d.plan, scenes: d.plan.scenes.map((x, j) => (j === i ? nv : x))}}), tag);
  const moveScene = (e, i) => {
    const sc = scenes[i];
    setSel({kind: 'scene', i});
    drag(e, (dx) => {
      const d = clamp(dx / pps, -sc.s, total - sc.e);
      putScene(i, shift(sc, '', r2(d)), 'drag-scene-' + i);
    });
  };
  const sizeScene = (e, i, side) => {
    const sc = scenes[i];
    setSel({kind: 'scene', i});
    drag(e, (dx) => {
      const d = dx / pps;
      if (side === 0) putScene(i, {...sc, s: r2(clamp(sc.s + d, 0, sc.e - 1))}, 'size-scene-' + i);
      else putScene(i, {...sc, e: r2(clamp(sc.e + d, sc.s + 1, total))}, 'size-scene-' + i);
    });
  };
  const restore = (i) => {
    const keep = cut.keep.map((x) => x.slice());
    keep.splice(i, 2, [keep[i][0], keep[i + 1][1]]);
    set((d) => {
      const out = retimeProject({raw: d.raw, plan: d.plan}, d.cut.keep, keep);
      return {...d, cut: {...d.cut, keep, total: keepTotal(keep)}, raw: out.raw, plan: out.plan};
    });
    setSel(null);
  };

  let acc = 0;
  const segs = cut.keep.map((k, i) => {
    const s = acc;
    acc += k[1] - k[0];
    return {i, s, e: acc, gap: i < cut.keep.length - 1 ? cut.keep[i + 1][0] - k[1] : 0};
  });

  return (
    <div className="tlbody">
      <div className="labels">
        <div>الرسمات</div>
        <div>الكتابة</div>
        <div>القصّات</div>
        <div>المؤثرات</div>
      </div>
      <div className="scroll">
        <div className="lanes" ref={lanes} style={{width}}>
          <div className="ruler" onPointerDown={scrub}>
            {Array.from({length: Math.floor(total / step) + 1}).map((_, i) => (
              <span key={i} style={{left: i * step * pps}}>
                {i * step}
              </span>
            ))}
          </div>
          <div className="lane" onPointerDown={scrub}>
            {scenes.map((sc, i) => (
              <div
                key={i}
                className={'blk scene ' + layoutOf(sc) + (sel?.kind === 'scene' && sel.i === i ? ' sel' : '')}
                style={{left: sc.s * pps, width: Math.max(14, (sc.e - sc.s) * pps)}}
                title={(layoutOf(sc) === 'split' ? 'مقسومة' : 'مالية الشاشة') + ' · ' + sceneTitle(sc)}
                onPointerDown={(e) => moveScene(e, i)}
              >
                <i className="h l" onPointerDown={(e) => sizeScene(e, i, 0)} />
                {layoutOf(sc) === 'split' ? '◫ ' : '▣ '}
                {sceneTitle(sc)}
                <i className="h r" onPointerDown={(e) => sizeScene(e, i, 1)} />
              </div>
            ))}
          </div>
          <div className="lane" onPointerDown={scrub}>
            {sentences.map((sen) => (
              <div
                key={sen.id}
                className={'blk cap' + (sel?.kind === 'sentence' && sel.id === sen.id ? ' sel' : '')}
                style={{left: sen.s * pps, width: Math.max(10, (sen.e - sen.s) * pps - 2)}}
                title={sen.text}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSel({kind: 'sentence', id: sen.id});
                  seek(sen.s);
                }}
              >
                {sen.text}
              </div>
            ))}
          </div>
          <div className="lane" onPointerDown={scrub}>
            {segs.map((sg) => (
              <React.Fragment key={sg.i}>
                <div
                  className={'blk seg' + (sel?.kind === 'seg' && sel.i === sg.i ? ' sel' : '')}
                  style={{left: sg.s * pps + 1, width: Math.max(6, (sg.e - sg.s) * pps - 2)}}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSel({kind: 'seg', i: sg.i});
                  }}
                >
                  {sg.i + 1}
                </div>
                {sg.gap > 0 ? (
                  <div
                    className="gap"
                    style={{left: sg.e * pps}}
                    title={`انقصّت هنا وقفة ${sg.gap.toFixed(1)} ث — اضغط عشان ترجّعها`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      restore(sg.i);
                    }}
                  >
                    ✂
                  </div>
                ) : null}
              </React.Fragment>
            ))}
          </div>
          <div className="lane" onPointerDown={scrub}>
            {sounds.map((s, i) => (
              <div key={i} className={'dot ' + s.name} style={{left: s.at * pps}} title={SFX[s.name].label + ' · ' + s.at.toFixed(2)} />
            ))}
          </div>
          <div className="head-line" style={{left: t * pps}} />
        </div>
      </div>
    </div>
  );
}

// ——— التطبيق ———
function Editor({project}) {
  const {doc, set, undo, redo, canUndo, canRedo} = useHistory({plan: project.plan, fix: project.fix, cut: project.cut, raw: project.raw});
  const {plan, fix, cut, raw} = doc;
  const total = keepTotal(cut.keep);
  const frames = Math.max(1, Math.round(total * FPS));
  const sentences = useMemo(() => applyFix(raw.sentences, fix), [raw, fix]);
  const problems = useMemo(() => validatePlan(plan, total), [plan, total]);
  const setPlan = useCallback((fn, tag) => set((d) => ({...d, plan: typeof fn === 'function' ? fn(d.plan) : fn}), tag), [set]);

  const player = useRef(null);
  const frameBox = useRef(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState('captions');
  const [pps, setPps] = useState(48);
  const [saved, setSaved] = useState('محفوظ');
  const [showWarn, setShowWarn] = useState(false);
  const [job, setJob] = useState(null);

  // الحفظ التلقائي: بعد كل تغيير بنص ثانية
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaved('يحفظ…');
    const id = setTimeout(() => {
      api('/api/save', {method: 'POST', body: JSON.stringify(doc)})
        .then(() => setSaved('محفوظ'))
        .catch((e) => setSaved('ما انحفظ: ' + e.message));
    }, 500);
    return () => clearTimeout(id);
  }, [doc]);

  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const onFrame = (e) => setT(e.detail.frame / FPS);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener('frameupdate', onFrame);
    p.addEventListener('play', onPlay);
    p.addEventListener('pause', onPause);
    return () => {
      p.removeEventListener('frameupdate', onFrame);
      p.removeEventListener('play', onPlay);
      p.removeEventListener('pause', onPause);
    };
  }, []);

  const seek = useCallback((sec) => player.current?.seekTo(Math.round(clamp(sec, 0, total) * FPS)), [total]);
  const toggle = useCallback(() => (player.current?.isPlaying() ? player.current.pause() : player.current?.play()), []);

  const pick = (s) => {
    setSel(s);
    if (s) setTab('item');
  };

  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !typing) {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY' && !typing) {
        e.preventDefault();
        redo();
      } else if (typing) return;
      else if (e.code === 'Space') {
        e.preventDefault();
        toggle();
      } else if (e.code === 'ArrowLeft') seek(t - (e.shiftKey ? 1 : 1 / FPS));
      else if (e.code === 'ArrowRight') seek(t + (e.shiftKey ? 1 : 1 / FPS));
      else if ((e.code === 'Delete' || e.code === 'Backspace') && sel?.kind === 'scene') {
        set((d) => ({...d, plan: {...d.plan, scenes: d.plan.scenes.filter((_, j) => j !== sel.i)}}));
        setSel(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, toggle, seek, t, sel, set]);

  const addScene = (type) => {
    const sc = newScene(type, clamp(t, 0, Math.max(0, total - 3)));
    sc.e = Math.min(sc.e, r2(total));
    set((d) => ({...d, plan: {...d.plan, scenes: [...(d.plan.scenes || []), sc]}}));
    pick({kind: 'scene', i: (plan.scenes || []).length});
  };

  const splitHere = () => {
    const src = toSource(t, cut.keep);
    const i = cut.keep.findIndex((k) => src > k[0] + 0.2 && src < k[1] - 0.2);
    if (i < 0) return;
    const keep = cut.keep.map((x) => x.slice());
    keep.splice(i, 1, [keep[i][0], r2(src - 0.05)], [r2(src + 0.05), keep[i][1]]);
    set((d) => {
      const out = retimeProject({raw: d.raw, plan: d.plan}, d.cut.keep, keep);
      return {...d, cut: {...d.cut, keep, total: keepTotal(keep)}, raw: out.raw, plan: out.plan};
    });
    pick({kind: 'seg', i});
  };

  const exportNow = async () => {
    player.current?.pause();
    // نتأكد إن آخر تعديل نزل على الملفات قبل ما يبدأ الرندر
    await api('/api/save', {method: 'POST', body: JSON.stringify(doc)});
    setSaved('محفوظ');
    setJob(await api('/api/render', {method: 'POST'}));
  };
  useEffect(() => {
    if (!job?.running) return;
    const id = setInterval(() => api('/api/render').then(setJob).catch(() => {}), 700);
    return () => clearInterval(id);
  }, [job?.running]);

  const inputProps = useMemo(() => ({meta: project.meta, cut: {...cut, total}, face: project.face, sentences, plan}), [project, cut, total, sentences, plan]);
  const capY = plan.captions?.y;

  return (
    <div className="app">
      <div className="top">
        <span className="name">محرّر الريلز</span>
        <span className="status" style={{textAlign: 'start'}}>
          {project.name}
        </span>
        <span className="grow" />
        <span className="status">{saved}</span>
        <button className="icon" title="تراجع (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
          ↶
        </button>
        <button className="icon" title="إعادة (Ctrl+Y)" disabled={!canRedo} onClick={redo}>
          ↷
        </button>
        {problems.length ? (
          <span className="badge">
            <button onClick={() => setShowWarn((v) => !v)}>⚠ {problems.length} تنبيه</button>
            {showWarn ? (
              <div className="popover">
                <b>عشان المقطع ما يصدّع المشاهد:</b>
                <ul>
                  {problems.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
                <p className="hint">تنبيهات مو منع. تقدر تصدّر والقرار لك.</p>
              </div>
            ) : null}
          </span>
        ) : null}
        <button className="primary" onClick={exportNow}>
          صدّر المقطع
        </button>
      </div>

      <div className="main">
        <div className="stage">
          <div className="frame" ref={frameBox}>
            <Player
              ref={player}
              component={Reel}
              inputProps={inputProps}
              durationInFrames={frames}
              compositionWidth={1080}
              compositionHeight={H}
              fps={FPS}
              style={{width: '100%', height: '100%'}}
              numberOfSharedAudioTags={8}
              acknowledgeRemotionLicense
              clickToPlay={false}
            />
            {tab === 'captions' && capY != null ? (
              <div
                className="guide"
                style={{top: capY * 100 + '%'}}
                onPointerDown={(e) => {
                  const rect = frameBox.current.getBoundingClientRect();
                  drag(e, (dx, dy, ev) => setPlan((p) => ({...p, captions: {...(p.captions || {}), y: r2(clamp((ev.clientY - rect.top) / rect.height, 0.12, 0.86))}}), 'c-y'));
                }}
              >
                <span>مكان الكتابة</span>
              </div>
            ) : null}
          </div>
          <div className="transport">
            <button className="icon" title="إطار ورا (←)" onClick={() => seek(t - 1 / FPS)}>
              ‹
            </button>
            <button className="primary" style={{minWidth: 84}} onClick={toggle}>
              {playing ? 'وقّف' : 'شغّل'}
            </button>
            <button className="icon" title="إطار قدام (→)" onClick={() => seek(t + 1 / FPS)}>
              ›
            </button>
            <span className="time">
              {stamp(t)} / {stamp(total)}
            </span>
          </div>
        </div>

        <div className="side">
          <div className="tabs">
            {[['item', 'العنصر'], ['captions', 'الكتابة'], ['look', 'الشكل'], ['sound', 'الصوت'], ['styles', 'ستايلاتي']].map(([k, l]) => (
              <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </div>
          <div className="body">
            {tab === 'item' ? <SelectionPanel doc={doc} set={set} sel={sel} setSel={setSel} sentences={sentences} total={total} seek={seek} /> : null}
            {tab === 'captions' ? <CaptionsPanel plan={plan} setPlan={setPlan} /> : null}
            {tab === 'look' ? <LookPanel plan={plan} setPlan={setPlan} /> : null}
            {tab === 'sound' ? <SoundPanel plan={plan} setPlan={setPlan} /> : null}
            {tab === 'styles' ? <StylesPanel plan={plan} setPlan={setPlan} /> : null}
          </div>
        </div>
      </div>

      <div className="tl">
        <div className="tlbar">
          <span className="status" style={{minWidth: 0}}>
            أضف رسمة عند المؤشر:
          </span>
          {['list', 'numbers', 'flow', 'word'].map((k) => (
            <button key={k} onClick={() => addScene(k)}>
              ＋ {TYPE_LABELS[k]}
            </button>
          ))}
          <button onClick={splitHere} title="يقسم المقطع عند المؤشر، وبعدها تقدر تضيّق الطرفين وتقص اللي بينهم">
            ✂ اقسم عند المؤشر
          </button>
          <span className="grow" />
          <span className="status" style={{minWidth: 0}}>
            تكبير
          </span>
          <input type="range" min={16} max={160} value={pps} onChange={(e) => setPps(Number(e.target.value))} />
        </div>
        <Timeline doc={doc} set={set} sentences={sentences} total={total} t={t} seek={seek} sel={sel} setSel={pick} pps={pps} />
      </div>

      {job ? (
        <div className="modal">
          <div className="box">
            <h3 style={{margin: 0}}>{job.running ? 'يصدّر المقطع…' : job.ok ? 'المقطع جاهز ✅' : 'التصدير ما كمل'}</h3>
            <div className="bar">
              <i style={{width: job.pct + '%', background: job.ok === false ? 'var(--bad)' : undefined}} />
            </div>
            <div className="log">{job.running ? job.pct + '٪' : job.lines.slice(-4).join('\n')}</div>
            {!job.running ? (
              <div className="btns" style={{marginTop: 16, justifyContent: 'flex-end'}}>
                {job.ok ? (
                  <button className="primary" onClick={() => api('/api/reveal', {method: 'POST'})}>
                    افتح مكان الملف
                  </button>
                ) : null}
                <button onClick={() => setJob(null)}>سكّر</button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function App() {
  const [project, setProject] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api('/api/project').then(setProject).catch((e) => setErr(e.message));
  }, []);
  if (err) return <div className="load">ما قدرت أفتح المشروع: {err}</div>;
  if (!project) return <div className="load">يحمّل…</div>;
  return <Editor project={project} />;
}

createRoot(document.getElementById('root')).render(<App />);
