// يطبّق تصحيح التفريغ:  node tools/fix.mjs <مجلد الشغل> [--times]
// يقرا fix.json بالشكل {"3": "النص الصحيح للجملة 3", "7": "…"} ويعيد توزيع التوقيت على الكلمات.
// التصحيح دايم ينطبق على النسخة الخام، فتقدر تعدّل fix.json وتعيده كم مرة.
import fs from 'node:fs';
import path from 'node:path';
import {readJson, writeJson, r3} from './lib.mjs';

const WORK = path.resolve(process.argv[2] || '.');
const rawPath = path.join(WORK, 'captions.raw.json');
const capPath = path.join(WORK, 'captions.json');
if (!fs.existsSync(rawPath)) fs.copyFileSync(capPath, rawPath);
const raw = readJson(rawPath);
const fix = readJson(path.join(WORK, 'fix.json'), {});

const sentences = raw.sentences.map((sen) => {
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
writeJson(capPath, {...raw, sentences});

const showTimes = process.argv.includes('--times');
for (const s of sentences) {
  console.log(`${String(s.id).padStart(2)}  [${s.s.toFixed(2)}–${s.e.toFixed(2)}]  ${s.text}`);
  if (showTimes) console.log('      ' + s.words.map((w) => `${w.t}@${w.s.toFixed(2)}`).join('  '));
}
fs.writeFileSync(path.join(WORK, 'script.txt'), sentences.map((s) => s.text).join('\n') + '\n', 'utf8');
console.log(`✅ ${Object.keys(fix).length} جملة مصحّحة`);
