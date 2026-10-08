// أدوات مشتركة بين سكربتات المحرّك
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

export const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE = path.join(ENGINE, '.cache');
export const WHISPER_DIR = path.join(CACHE, 'whisper.cpp');
export const WHISPER_VERSION = '1.5.5';

export const readJson = (p, fallback) => {
  if (!fs.existsSync(p)) {
    if (fallback !== undefined) return fallback;
    throw new Error('ملف ناقص: ' + p);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};
export const writeJson = (p, data) => fs.writeFileSync(p, JSON.stringify(data, null, 1), 'utf8');

// ffmpeg و ffprobe يجون مع ريموشن — ندوّر الملف التنفيذي داخل حزمة المنصة
function bundledBinary(name) {
  const dir = path.join(ENGINE, 'node_modules', '@remotion');
  if (!fs.existsSync(dir)) return null;
  const exe = process.platform === 'win32' ? name + '.exe' : name;
  for (const d of fs.readdirSync(dir)) {
    if (!d.startsWith('compositor-')) continue;
    const p = path.join(dir, d, exe);
    if (fs.existsSync(p)) return {bin: p, dir: path.join(dir, d)};
  }
  return null;
}

export function ff(name, args, opts = {}) {
  const b = bundledBinary(name);
  if (!b) throw new Error(name + ' مفقود من حزمة Remotion — نفّذ setup.mjs --install');
  const env = {...process.env};
  // المكتبات المشتركة جنب الملف التنفيذي
  if (process.platform === 'darwin') env.DYLD_LIBRARY_PATH = b.dir;
  if (process.platform === 'linux') env.LD_LIBRARY_PATH = b.dir;
  const r = spawnSync(b.bin, args, {
    env,
    cwd: b.dir,
    encoding: opts.binary ? 'buffer' : 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  if (r.status !== 0 && !opts.allowFail) {
    const err = opts.binary ? r.stderr.toString('utf8') : r.stderr;
    throw new Error(name + ' فشل:\n' + err.split('\n').slice(-6).join('\n'));
  }
  return r;
}

export function probe(file) {
  const r = ff('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  const j = JSON.parse(r.stdout);
  const v = j.streams.find((s) => s.codec_type === 'video');
  const a = j.streams.find((s) => s.codec_type === 'audio');
  if (!v) throw new Error('الملف ما فيه فيديو');
  let rot = 0;
  for (const sd of v.side_data_list || []) if (typeof sd.rotation === 'number') rot = sd.rotation;
  if (v.tags && v.tags.rotate) rot = Number(v.tags.rotate);
  const swap = Math.abs(rot) % 180 === 90;
  const [n, d] = (v.avg_frame_rate || v.r_frame_rate || '30/1').split('/').map(Number);
  return {
    duration: Number(j.format.duration),
    width: swap ? v.height : v.width,
    height: swap ? v.width : v.height,
    fps: d ? n / d : 30,
    hasAudio: Boolean(a),
    hdr: /smpte2084|arib-std-b67/.test(v.color_transfer || ''),
  };
}

// يقرا WAV 16-bit mono ويرجّع العيّنات
export function readWav(file) {
  const b = fs.readFileSync(file);
  let off = 12;
  let rate = 16000;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') rate = b.readUInt32LE(off + 12);
    if (id === 'data') {
      const n = Math.floor(Math.min(size, b.length - off - 8) / 2);
      const s = new Int16Array(n);
      for (let i = 0; i < n; i++) s[i] = b.readInt16LE(off + 8 + i * 2);
      return {rate, samples: s};
    }
    off += 8 + size + (size % 2);
  }
  throw new Error('ملف الصوت مو مفهوم');
}

export const r3 = (x) => Math.round(x * 1000) / 1000;

// الرسمات المكتوبة خصوصي لهالفيديو تنسخ لداخل المحرّك عشان تنبني معه
export function syncCustom(work) {
  const src = path.join(work, 'custom.jsx');
  const head = '// ينكتب تلقائياً من <مجلد الشغل>/custom.jsx قبل كل رندر — لا تعدّله هنا\n';
  fs.writeFileSync(path.join(ENGINE, 'src', 'custom.generated.jsx'), head + (fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : 'export const scenes = {};\n'), 'utf8');
}
