// التجهيز كله بأمر واحد:  node tools/prep.mjs <الفيديو> <مجلد الشغل> [--model medium] [--keep-silence]
// يطلّع داخل مجلد الشغل: source.* · meta.json · cut.json · face.json · captions.json · script.txt
import fs from 'node:fs';
import path from 'node:path';
import {ff, probe, readWav, readJson, writeJson, r3, ENGINE, WHISPER_DIR, WHISPER_VERSION} from './lib.mjs';

const args = process.argv.slice(2);
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const pos = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').match(/^--(model|lang)$/));
if (pos.length < 2) {
  console.error('طريقة التشغيل: node tools/prep.mjs <الفيديو> <مجلد الشغل>');
  process.exit(2);
}
const SRC = path.resolve(pos[0]);
const WORK = path.resolve(pos[1]);
const MODEL = flag('--model', 'medium');
const LANG = flag('--lang', 'ar');
const KEEP_SILENCE = args.includes('--keep-silence');
fs.mkdirSync(WORK, {recursive: true});

// 1) انسخ المصدر
const srcName = 'source' + path.extname(SRC).toLowerCase();
const srcCopy = path.join(WORK, srcName);
if (!fs.existsSync(srcCopy) || fs.statSync(srcCopy).size !== fs.statSync(SRC).size) fs.copyFileSync(SRC, srcCopy);
const info = probe(srcCopy);
if (!info.hasAudio) {
  console.error('الفيديو ما فيه صوت — هالمهارة لفيديو فيه كلام.');
  process.exit(3);
}
console.log(`التسجيل: ${info.width}×${info.height} · طوله ${info.duration.toFixed(1)} ثانية · ${info.fps.toFixed(0)} إطار بالثانية`);

// 2) الصوت
const wav = path.join(WORK, 'audio.wav');
ff('ffmpeg', ['-v', 'error', '-y', '-i', srcCopy, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);

// 3) العلو الأصلي — للعلم بس. المعايرة الفعلية تصير بعد الرندر (render.mjs)
let sourceLufs = null;
{
  const r = ff('ffmpeg', ['-hide_banner', '-i', wav, '-af', 'loudnorm=I=-14:TP=-1.5:print_format=json', '-f', 'null', '-'], {allowFail: true});
  const m = r.stderr.match(/\{[\s\S]*"input_i"[\s\S]*?\}/);
  if (m) {
    const j = JSON.parse(m[0]);
    const i = Number(j.input_i);
    const tp = Number(j.input_tp);
    if (Number.isFinite(i) && Number.isFinite(tp)) sourceLufs = i;
  }
}

// 4) السكتات — من طاقة الصوت مباشرة
const {rate, samples} = readWav(wav);
const HOP = Math.round(rate * 0.02);
const nFrames = Math.floor(samples.length / HOP);
const db = new Float32Array(nFrames);
for (let f = 0; f < nFrames; f++) {
  let s = 0;
  for (let i = f * HOP; i < (f + 1) * HOP; i++) s += samples[i] * samples[i];
  db[f] = 10 * Math.log10(s / HOP / (32768 * 32768) + 1e-12);
}
const sorted = Array.from(db).sort((a, b) => a - b);
const speech = sorted[Math.floor(sorted.length * 0.95)];
const floor = sorted[Math.floor(sorted.length * 0.1)];
// العتبة بين أرضية الضجيج ومستوى الكلام، أقرب للأرضية
const thr = Math.max(floor + 6, Math.min(speech - 26, floor + (speech - floor) * 0.35));
const MIN_SIL = 0.45;
const PAD_IN = 0.1;
const PAD_OUT = 0.16;
let keep = [];
if (KEEP_SILENCE) keep = [[0, info.duration]];
else {
  let start = null;
  let lastLoud = -1;
  for (let f = 0; f < nFrames; f++) {
    const t = f * 0.02;
    if (db[f] > thr) {
      if (start === null) start = t;
      lastLoud = t;
    } else if (start !== null && t - lastLoud >= MIN_SIL) {
      keep.push([Math.max(0, start - PAD_IN), Math.min(info.duration, lastLoud + 0.02 + PAD_OUT)]);
      start = null;
    }
  }
  if (start !== null) keep.push([Math.max(0, start - PAD_IN), Math.min(info.duration, lastLoud + 0.02 + PAD_OUT)]);
  // ادمج المتلاصق، واحذف النتف (نفَس أو طقّة)
  const merged = [];
  for (const k of keep) {
    const last = merged[merged.length - 1];
    if (last && k[0] - last[1] < 0.12) last[1] = k[1];
    else merged.push(k);
  }
  keep = merged.filter((k) => k[1] - k[0] >= 0.25);
  if (!keep.length) keep = [[0, info.duration]];
}
const total = keep.reduce((s, k) => s + (k[1] - k[0]), 0);
writeJson(path.join(WORK, 'cut.json'), {keep: keep.map((k) => [r3(k[0]), r3(k[1])]), total: r3(total), source: r3(info.duration)});
console.log(`الوقفات: انقصّ ${(info.duration - total).toFixed(1)} ثانية والباقي ${total.toFixed(1)} ثانية على ${keep.length} مقطع`);

// 5) الوجه — لقطة كل نص ثانية (نسخة ffmpeg حقت ريموشن خفيفة: ما فيها فلتر fps ولا مخرج rawvideo، فنستخدم -r و image2pipe)
const FW = 320;
const FH = 240;
let face = {found: false};
try {
  const ort = await import('onnxruntime-node');
  const session = await ort.InferenceSession.create(path.join(ENGINE, 'models', 'face.onnx'), {logSeverityLevel: 3});
  const r = ff('ffmpeg', ['-v', 'error', '-i', srcCopy, '-vf', `scale=${FW}:${FH}`, '-r', '2', '-pix_fmt', 'rgb24', '-c:v', 'rawvideo', '-f', 'image2pipe', '-'], {binary: true});
  const buf = r.stdout;
  const n = Math.floor(buf.length / (FW * FH * 3));
  const boxes = [];
  for (let k = 0; k < n; k++) {
    const x = new Float32Array(3 * FW * FH);
    const base = k * FW * FH * 3;
    for (let i = 0; i < FW * FH; i++) {
      x[i] = (buf[base + i * 3] - 127) / 128;
      x[FW * FH + i] = (buf[base + i * 3 + 1] - 127) / 128;
      x[2 * FW * FH + i] = (buf[base + i * 3 + 2] - 127) / 128;
    }
    const out = await session.run({[session.inputNames[0]]: new ort.Tensor('float32', x, [1, 3, FH, FW])});
    const sc = out.scores.data;
    const bx = out.boxes.data;
    let best = -1;
    let bs = 0.75;
    for (let i = 0; i < sc.length / 2; i++) {
      // أكبر وجه واثقين منه = المتحدث
      const area = (bx[i * 4 + 2] - bx[i * 4]) * (bx[i * 4 + 3] - bx[i * 4 + 1]);
      const score = sc[i * 2 + 1] > 0.75 ? sc[i * 2 + 1] + area : 0;
      if (score > bs) {
        bs = score;
        best = i;
      }
    }
    if (best >= 0) boxes.push({t: k / 2, x0: bx[best * 4], y0: bx[best * 4 + 1], x1: bx[best * 4 + 2], y1: bx[best * 4 + 3]});
  }
  if (boxes.length >= Math.max(2, n * 0.3)) {
    const med = (arr) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)];
    const x0 = med(boxes.map((b) => b.x0));
    const x1 = med(boxes.map((b) => b.x1));
    const y0 = med(boxes.map((b) => b.y0));
    const y1 = med(boxes.map((b) => b.y1));
    const ys = boxes.map((b) => b.y0).sort((a, b) => a - b);
    const ye = boxes.map((b) => b.y1).sort((a, b) => a - b);
    face = {
      found: true,
      cx: r3((x0 + x1) / 2),
      cy: r3((y0 + y1) / 2),
      w: r3(x1 - x0),
      h: r3(y1 - y0),
      // أعلى وأنزل نقطة وصلها وجهه (نتجاهل 5٪ شواذ)
      top: r3(ys[Math.floor(ys.length * 0.05)]),
      bottom: r3(ye[Math.floor(ye.length * 0.95)]),
      samples: boxes.length,
      of: n,
    };
  }
} catch (e) {
  console.log('⚠️ رصد الوجه ما اشتغل (' + String(e.message).split('\n')[0] + ') — نكمل بالوسط');
}
writeJson(path.join(WORK, 'face.json'), face);
console.log(face.found ? `الوجه: مرصود بـ${face.samples} من ${face.of} لقطة` : 'الوجه: ما انرصد — التخطيط على وسط الكادر');

writeJson(path.join(WORK, 'meta.json'), {
  source: srcName,
  width: info.width,
  height: info.height,
  fps: info.fps,
  duration: r3(info.duration),
  sourceLufs,
  hdr: info.hdr,
});

// 6) التفريغ
const {installWhisperCpp, downloadWhisperModel, transcribe} = await import('@remotion/install-whisper-cpp');
await installWhisperCpp({to: WHISPER_DIR, version: WHISPER_VERSION, printOutput: false});
await downloadWhisperModel({folder: WHISPER_DIR, model: MODEL, printOutput: false});
console.log('أكتب الكلام…');
const {transcription} = await transcribe({
  inputPath: wav,
  whisperPath: WHISPER_DIR,
  whisperCppVersion: WHISPER_VERSION,
  model: MODEL,
  language: LANG,
  tokenLevelTimestamps: false,
  printOutput: false,
  // كلمة بكل سطر = توقيت لكل كلمة بلا ما تنكسر الحروف العربية
  additionalArgs: [
    ['--max-len', '1'],
    ['--split-on-word', 'true'],
  ],
});
writeJson(path.join(WORK, 'whisper.json'), transcription);

// كلمات بتوقيت المصدر
let words = [];
for (const it of transcription) {
  const t = it.text.trim();
  if (!t || /^\[.*\]$/.test(t) || /^[\p{P}\s]+$/u.test(t)) {
    // علامة ترقيم لحالها تلصق بالكلمة اللي قبلها
    if (words.length && /^[\p{P}]+$/u.test(t)) words[words.length - 1].t += t;
    continue;
  }
  words.push({t, s: it.offsets.from / 1000, e: it.offsets.to / 1000});
}

// من توقيت المصدر لتوقيت الفيديو بعد القص
const starts = [];
let acc = 0;
for (const k of keep) {
  starts.push(acc);
  acc += k[1] - k[0];
}
const segOf = (t) => {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < keep.length; i++) {
    if (t >= keep[i][0] && t <= keep[i][1]) return i;
    const d = Math.min(Math.abs(t - keep[i][0]), Math.abs(t - keep[i][1]));
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
};
const toCut = (t, seg) => starts[seg] + Math.min(Math.max(t, keep[seg][0]), keep[seg][1]) - keep[seg][0];
words = words.map((w) => {
  const seg = segOf((w.s + w.e) / 2);
  const s = toCut(w.s, seg);
  const e = Math.max(s + 0.08, toCut(w.e, seg));
  return {t: w.t, s: r3(s), e: r3(e), seg};
});

// جُمل: نقطع عند سكتة واضحة بالمصدر، أو علامة وقف، أو لما تطول
const sentences = [];
let cur = [];
const flush = () => {
  if (cur.length) sentences.push(cur);
  cur = [];
};
for (let i = 0; i < words.length; i++) {
  const w = words[i];
  const prev = cur[cur.length - 1];
  const pause = prev && w.seg !== prev.seg ? keep[w.seg][0] - keep[prev.seg][1] : 0;
  if (prev && (pause >= 0.7 || cur.length >= 10)) flush();
  cur.push(w);
  if (/[.؟?!،,]$/.test(w.t) && cur.length >= 2) flush();
}
flush();
const strip = (t) => t.replace(/[.،,]+$/u, '');
const out = sentences.map((ws, i) => ({
  id: i + 1,
  s: ws[0].s,
  e: ws[ws.length - 1].e,
  text: ws.map((w) => strip(w.t)).join(' '),
  words: ws.map((w) => ({t: strip(w.t), s: w.s, e: w.e})),
}));
writeJson(path.join(WORK, 'captions.json'), {total: r3(total), sentences: out});

const stamp = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const script = out.map((s) => `${String(s.id).padStart(2)}  [${stamp(s.s)}]  ${s.text}`).join('\n');
fs.writeFileSync(path.join(WORK, 'script.txt'), script + '\n', 'utf8');
console.log('\n' + script + '\n');
console.log(`✅ جاهز: ${out.length} جملة · ${total.toFixed(1)} ث`);
