// المؤثرات الصوتية تتولّد بالكود: لا ملفات تنزل ولا حقوق لأحد.
//   node tools/sfx.mjs <مجلد الشغل>   ← يكتب sfx/*.wav
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const RATE = 44100;

function wav(samples) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + samples.length * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(RATE, 24);
  b.writeUInt32LE(RATE * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return b;
}

// ضجيج ثابت البذرة: نفس الملف يطلع بكل جهاز
function noise(seed) {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 2147483648 - 1;
  };
}

// نفخة هوا: ضجيج يمر بفلتر يطلع وينزل، يبدأ ناعم ويخلص ناعم
function whoosh() {
  const n = Math.round(RATE * 0.45);
  const out = new Float32Array(n);
  const rnd = noise(7);
  let low = 0;
  let band = 0;
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const fc = 350 + 2300 * Math.sin(Math.PI * Math.pow(k, 0.8));
    const f = 2 * Math.sin((Math.PI * fc) / RATE);
    const high = rnd() - low - 0.9 * band;
    band += f * high;
    low += f * band;
    out[i] = band * Math.pow(Math.sin(Math.PI * k), 2) * 0.7;
  }
  return out;
}

// طقّة ناعمة: نغمة تنزل بسرعة
function pop() {
  const n = Math.round(RATE * 0.14);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    ph += (2 * Math.PI * (300 + 320 * Math.exp(-t * 38))) / RATE;
    out[i] = Math.sin(ph) * Math.min(1, t / 0.004) * Math.exp(-t * 30) * 0.8;
  }
  return out;
}

// تكّة قصيرة للأرقام
function tick() {
  const n = Math.round(RATE * 0.06);
  const out = new Float32Array(n);
  const rnd = noise(3);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    out[i] = (Math.sin(2 * Math.PI * 1500 * t) * 0.8 + rnd() * 0.12) * Math.min(1, t / 0.001) * Math.exp(-t * 95) * 0.7;
  }
  return out;
}

const MAKERS = {whoosh, pop, tick};

export function writeSfx(work) {
  const dir = path.join(work, 'sfx');
  fs.mkdirSync(dir, {recursive: true});
  for (const [name, make] of Object.entries(MAKERS)) fs.writeFileSync(path.join(dir, name + '.wav'), wav(make()));
  return dir;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('✅ ' + writeSfx(path.resolve(process.argv[2] || '.')));
}
