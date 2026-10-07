// المعاينة والرندر:
//   node tools/render.mjs <مجلد الشغل> preview [ثواني…]   ← ورقة لقطات وحدة preview.jpg
//   node tools/render.mjs <مجلد الشغل> final               ← reel.mp4 + reel.srt + reel.txt
import fs from 'node:fs';
import path from 'node:path';
import {ff, readJson, ENGINE} from './lib.mjs';

const WORK = path.resolve(process.argv[2] || '.');
const MODE = process.argv[3] || 'final';
const FPS = 30;

const meta = readJson(path.join(WORK, 'meta.json'));
const cut = readJson(path.join(WORK, 'cut.json'));
const face = readJson(path.join(WORK, 'face.json'), {found: false});
const caps = readJson(path.join(WORK, 'captions.json'));
const plan = readJson(path.join(WORK, 'plan.json'), {});
const inputProps = {meta, cut, face, sentences: caps.sentences, plan};

// فحص الخطة قبل الرندر — غلط بالتوقيت أرخص نكتشفه هنا
const problems = [];
for (const [i, sc] of (plan.scenes || []).entries()) {
  if (!['flow', 'numbers', 'list', 'word', 'custom'].includes(sc.type)) problems.push(`الرسمة ${i + 1}: نوع مو معروف "${sc.type}"`);
  if (sc.type === 'custom' && !sc.name) problems.push(`الرسمة ${i + 1}: نوعها custom وناقصها name`);
  if (sc.e - sc.s > 6) problems.push(`الرسمة ${i + 1}: أطول من 6 ثواني والمتحدث محجوب طولها، فقصّرها أو اقسمها`);
  if (!(sc.e > sc.s)) problems.push(`الرسمة ${i + 1}: النهاية لازم تكون بعد البداية`);
  if (sc.e - sc.s < 2) problems.push(`الرسمة ${i + 1}: أقصر من ثانيتين وما تلحق تنقرا`);
  if (sc.s < 0 || sc.e > cut.total + 0.05) problems.push(`الرسمة ${i + 1}: برّا مدة الفيديو (${cut.total} ث)`);
}
if (problems.length) {
  console.error('❌ plan.json فيه مشاكل:\n' + problems.join('\n'));
  process.exit(4);
}

// المشاهد المكتوبة خصوصي لهالفيديو تنسخ لداخل المحرّك عشان تنبني معه
const customSrc = path.join(WORK, 'custom.jsx');
const customDst = path.join(ENGINE, 'src', 'custom.generated.jsx');
const customHead = '// ينكتب تلقائياً من <مجلد الشغل>/custom.jsx قبل كل رندر — لا تعدّله هنا\n';
fs.writeFileSync(customDst, customHead + (fs.existsSync(customSrc) ? fs.readFileSync(customSrc, 'utf8') : 'export const scenes = {};\n'), 'utf8');

const {bundle} = await import('@remotion/bundler');
const {renderMedia, renderStill, selectComposition} = await import('@remotion/renderer');

const serveUrl = await bundle({entryPoint: path.join(ENGINE, 'src', 'index.jsx'), publicDir: WORK, onProgress: () => {}});
const composition = await selectComposition({serveUrl, id: 'Reel', inputProps});
const total = composition.durationInFrames / FPS;

if (MODE === 'preview') {
  let times = process.argv.slice(4).map(Number).filter((n) => Number.isFinite(n));
  if (!times.length) {
    // ما انحددت ثواني: ناخذ وسط كل رسمة ونكمّل الباقي على طول المقطع
    times = (plan.scenes || []).map((s) => (s.s + s.e) / 2 + 0.3);
    for (let i = 0; times.length < 6; i++) times.push((total * (i + 0.5)) / 6);
    times = times.slice(0, 6).sort((a, b) => a - b);
  }
  // ورقة وحدة: ريموشن نفسه يرسم اللقطات جنب بعض (ffmpeg الخفيف ما فيه فلتر tile)
  const frames = times.map((t) => Math.min(composition.durationInFrames - 1, Math.max(0, Math.round(t * FPS))));
  const sheetProps = {...inputProps, sheetFrames: frames};
  const sheet = await selectComposition({serveUrl, id: 'Sheet', inputProps: sheetProps});
  const out = path.join(WORK, 'preview.jpg');
  await renderStill({serveUrl, composition: sheet, inputProps: sheetProps, frame: 0, output: out, imageFormat: 'jpeg', jpegQuality: 82});
  console.log(`✅ ${out}\nاللقطات بالترتيب (سطر سطر من اليسار): ${times.map((t) => t.toFixed(1)).join(' · ')}`);
  process.exit(0);
}

const outFile = path.join(WORK, 'reel.mp4');
const rawFile = path.join(WORK, 'reel.raw.mp4');
let lastPct = -10;
await renderMedia({
  serveUrl,
  composition,
  inputProps,
  codec: 'h264',
  crf: 20,
  colorSpace: 'bt709',
  audioBitrate: '192k',
  outputLocation: rawFile,
  onProgress: ({progress}) => {
    const pct = Math.floor(progress * 100);
    if (pct >= lastPct + 10) {
      lastPct = pct;
      console.log(`الرندر ${pct}٪`);
    }
  },
});

// معايرة الصوت لمستوى المنصات (-14 LUFS) — الصورة تنسخ مثل ما هي بلا إعادة ترميز
console.log('أعاير الصوت…');
ff('ffmpeg', ['-v', 'error', '-y', '-i', rawFile, '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', outFile]);
fs.rmSync(rawFile, {force: true});

// ملف الترجمة والنص
const stamp = (t) => {
  const ms = Math.round(t * 1000);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const S = caps.sentences;
fs.writeFileSync(
  path.join(WORK, 'reel.srt'),
  S.map((s, i) => `${i + 1}\n${stamp(s.s)} --> ${stamp(Math.min(s.e + 0.3, S[i + 1] ? S[i + 1].s : s.e + 0.3))}\n${s.text}\n`).join('\n'),
  'utf8',
);
fs.writeFileSync(path.join(WORK, 'reel.txt'), S.map((s) => s.text).join('\n') + '\n', 'utf8');

// نقيس العلو الفعلي للناتج بدل ما نفترضه
let loud = '';
const r = ff('ffmpeg', ['-hide_banner', '-i', outFile, '-vn', '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], {allowFail: true});
const m = r.stderr.match(/\{[\s\S]*"input_i"[\s\S]*?\}/);
if (m) {
  const j = JSON.parse(m[0]);
  loud = ` · العلو ${j.input_i} LUFS · الذروة ${j.input_tp} dB`;
}
const mb = (fs.statSync(outFile).size / 1048576).toFixed(1);
console.log(`✅ ${outFile}\n${total.toFixed(1)} ث · ${mb} ميقا${loud}`);
