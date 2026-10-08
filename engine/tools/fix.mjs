// يطبّق تصحيح التفريغ:  node tools/fix.mjs <مجلد الشغل> [--times]
// يقرا fix.json بالشكل {"3": "النص الصحيح للجملة 3", "7": "…"} ويعيد توزيع التوقيت على الكلمات.
// التصحيح دايم ينطبق على النسخة الخام، فتقدر تعدّل fix.json وتعيده كم مرة.
import fs from 'node:fs';
import path from 'node:path';
import {readJson, writeJson} from './lib.mjs';
import {applyFix} from '../src/plan.js';

const WORK = path.resolve(process.argv[2] || '.');
const rawPath = path.join(WORK, 'captions.raw.json');
const capPath = path.join(WORK, 'captions.json');
if (!fs.existsSync(rawPath)) fs.copyFileSync(capPath, rawPath);
const raw = readJson(rawPath);
const fix = readJson(path.join(WORK, 'fix.json'), {});

const sentences = applyFix(raw.sentences, fix);
writeJson(capPath, {...raw, sentences});

const showTimes = process.argv.includes('--times');
for (const s of sentences) {
  console.log(`${String(s.id).padStart(2)}  [${s.s.toFixed(2)}–${s.e.toFixed(2)}]  ${s.text}`);
  if (showTimes) console.log('      ' + s.words.map((w) => `${w.t}@${w.s.toFixed(2)}`).join('  '));
}
fs.writeFileSync(path.join(WORK, 'script.txt'), sentences.map((s) => s.text).join('\n') + '\n', 'utf8');
console.log(`✅ ${Object.keys(fix).length} جملة مصحّحة`);
