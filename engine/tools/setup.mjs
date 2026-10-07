// فحص وتجهيز الأدوات:
//   node tools/setup.mjs            ← يفحص ويقول وش الناقص (ما ينزّل شي)
//   node tools/setup.mjs --install  ← يجيب اللي مو موجود. ما يتنفّذ إلا بموافقة صاحب الجهاز
// هالملف ما يستخدم إلا مكتبات Node الأساسية، لأنه يشتغل قبل ما ينزل أي شي.
// القاعدة: كل أداة نفحصها بتشغيلها فعلاً — وجود الملف ما يعني إنه يشتغل.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INSTALL = process.argv.includes('--install');
const MODEL = process.argv.includes('--model') ? process.argv[process.argv.indexOf('--model') + 1] : 'medium';
const WHISPER_DIR = path.join(ENGINE, '.cache', 'whisper.cpp');
const WHISPER_VERSION = '1.5.5';
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, {cwd: ENGINE, encoding: 'utf8', shell: isWin, ...opts});
const missing = [];
const ok = [];

// 1) Node — ريموشن يحتاج 18 أو أحدث
const major = Number(process.versions.node.split('.')[0]);
if (major < 18) {
  console.log(`❌ Node قديم (${process.versions.node}) — المطلوب 18 أو أحدث. حدّثه ثم أعد التشغيل.`);
  process.exit(20);
}
ok.push(`Node ${process.versions.node}`);

// 2) حزم المحرّك (ريموشن + التفريغ + رصد الوجه)
const depsWork = () => {
  const r = run(process.execPath, ['-e', "Promise.all(['@remotion/bundler','@remotion/renderer','@remotion/install-whisper-cpp','onnxruntime-node'].map(m=>import(m))).then(()=>console.log('DEPS_OK')).catch(e=>{console.error(e.message);process.exit(1)})"], {shell: false});
  return r.status === 0 && r.stdout.includes('DEPS_OK');
};
let deps = fs.existsSync(path.join(ENGINE, 'node_modules')) && depsWork();
if (!deps && INSTALL) {
  console.log('⏬ أنزّل ريموشن وحزمه (قرابة 600 ميقا)…');
  // مجلد ناقص من تنزيل قديم مقطوع يخرّب التنصيب، فنبدأ من نظيف
  fs.rmSync(path.join(ENGINE, 'node_modules'), {recursive: true, force: true});
  const r = run('npm', ['install', '--no-audit', '--no-fund'], {stdio: 'inherit'});
  deps = r.status === 0 && depsWork();
}
if (deps) ok.push('ريموشن');
else missing.push('ريموشن وحزمه (قرابة 600 ميقا)');

// 3) ffmpeg حق ريموشن — نشغّله فعلاً
const ffmpegWorks = () => {
  const dir = path.join(ENGINE, 'node_modules', '@remotion');
  if (!fs.existsSync(dir)) return false;
  for (const d of fs.readdirSync(dir)) {
    if (!d.startsWith('compositor-')) continue;
    const bin = path.join(dir, d, isWin ? 'ffmpeg.exe' : 'ffmpeg');
    if (!fs.existsSync(bin)) continue;
    const env = {...process.env, DYLD_LIBRARY_PATH: path.join(dir, d), LD_LIBRARY_PATH: path.join(dir, d)};
    const r = spawnSync(bin, ['-version'], {encoding: 'utf8', env, cwd: path.join(dir, d)});
    return r.status === 0 && /ffmpeg version/.test(r.stdout);
  }
  return false;
};
if (deps) {
  if (ffmpegWorks()) ok.push('ffmpeg');
  else missing.push('ffmpeg (المفروض يجي مع ريموشن — أعد التنصيب)');
}

// 4) المتصفح اللي يرسم الفريمات
const browserWorks = () => {
  const r = run(process.execPath, ['-e', "import('@remotion/renderer').then(async r=>{await r.ensureBrowser({logLevel:'error'});console.log('BROWSER_OK')}).catch(e=>{console.error(e.message);process.exit(1)})"], {shell: false, timeout: INSTALL ? 600000 : 20000});
  return r.status === 0 && r.stdout.includes('BROWSER_OK');
};
const browserDir = path.join(ENGINE, 'node_modules', '.remotion');
let browser = false;
if (deps) {
  // ensureBrowser ينزّله لو ناقص، فبوضع الفحص نكتفي بوجود مجلده
  browser = INSTALL ? browserWorks() : fs.existsSync(browserDir);
  if (browser) ok.push('متصفح الرسم');
  else missing.push('متصفح الرسم (120 ميقا)');
}

// 5) أداة التفريغ وموديلها
const whisperBin = path.join(WHISPER_DIR, isWin ? 'main.exe' : 'main');
const modelFile = path.join(WHISPER_DIR, `ggml-${MODEL}.bin`);
const whisperWorks = () => {
  if (!fs.existsSync(whisperBin)) return false;
  const r = spawnSync(whisperBin, ['--help'], {encoding: 'utf8', cwd: WHISPER_DIR});
  return /usage/i.test((r.stdout || '') + (r.stderr || ''));
};
let whisper = whisperWorks();
let model = fs.existsSync(modelFile) && fs.statSync(modelFile).size > 50 * 1048576;
if (deps && INSTALL && (!whisper || !model)) {
  if (!whisper && !isWin) {
    // على ماك ولينكس التفريغ ينبني من المصدر، فيحتاج أدوات البناء
    const have = (c) => spawnSync('which', [c], {encoding: 'utf8'}).status === 0;
    if (!have('make') || !have('git') || !(have('cc') || have('clang') || have('gcc'))) {
      console.log(
        isMac
          ? '❌ أدوات البناء حقت أبل ناقصة. شغّل:  xcode-select --install  ووافق على النافذة اللي تطلع، ثم أعد التشغيل.'
          : '❌ أدوات البناء ناقصة (git و make ومترجم C). نزّلها من مدير الحزم ثم أعد التشغيل.',
      );
      process.exit(21);
    }
  }
  console.log(`⏬ أنزّل أداة التفريغ وموديل ${MODEL} (قرابة 1.5 قيقا للمتوسط)…`);
  if (!whisper) fs.rmSync(WHISPER_DIR, {recursive: true, force: true});
  const code = `import('@remotion/install-whisper-cpp').then(async w=>{await w.installWhisperCpp({to:${JSON.stringify(WHISPER_DIR)},version:${JSON.stringify(WHISPER_VERSION)},printOutput:false});await w.downloadWhisperModel({folder:${JSON.stringify(WHISPER_DIR)},model:${JSON.stringify(MODEL)},printOutput:false});}).catch(e=>{console.error(e.message);process.exit(1)})`;
  run(process.execPath, ['-e', code], {shell: false, stdio: 'inherit'});
  whisper = whisperWorks();
  model = fs.existsSync(modelFile) && fs.statSync(modelFile).size > 50 * 1048576;
}
if (whisper) ok.push('أداة التفريغ');
else missing.push('أداة التفريغ');
if (model) ok.push(`موديل ${MODEL}`);
else missing.push(`موديل التفريغ ${MODEL}${MODEL === 'medium' ? ' (قرابة 1.5 قيقا)' : ''}`);

// 6) موديل الوجه — يجي مع المهارة
if (fs.existsSync(path.join(ENGINE, 'models', 'face.onnx'))) ok.push('رصد الوجه');
else missing.push('ملف models/face.onnx ناقص من المهارة');

console.log('الجاهز: ' + ok.join(' · '));
if (missing.length) {
  console.log('الناقص:\n' + missing.map((m) => '  - ' + m).join('\n'));
  if (!INSTALL) console.log('للتنزيل: node tools/setup.mjs --install');
  process.exit(10);
}
console.log('✅ كل شي جاهز');
