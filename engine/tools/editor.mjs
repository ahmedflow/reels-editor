// المحرّر: صفحة محلية فيها المقطع وتايم لاين، والتعديل فيها ينحفظ بملفات مجلد الشغل مباشرة.
//   node tools/editor.mjs <مجلد الشغل> [--port 4173] [--no-open]
// يشتغل على الجهاز نفسه وما يطلع منه شي للنت.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {readJson, writeJson, syncCustom, ff, ENGINE, CACHE} from './lib.mjs';
import {writeSfx} from './sfx.mjs';
import {applyFix, keepTotal} from '../src/plan.js';

const args = process.argv.slice(2);
const WORK = path.resolve(args.find((a) => !a.startsWith('--')) || '.');
const PORT = Number(args.includes('--port') ? args[args.indexOf('--port') + 1] : 4173);
const STYLES_FILE = path.join(os.homedir(), '.reels-editor', 'styles.json');

for (const f of ['meta.json', 'cut.json', 'captions.json']) {
  if (!fs.existsSync(path.join(WORK, f))) {
    console.error(`❌ ${f} مو موجود بـ ${WORK}\nجهّز المقطع أول: node tools/prep.mjs <الفيديو> <مجلد الشغل>`);
    process.exit(2);
  }
}
const rawPath = path.join(WORK, 'captions.raw.json');
if (!fs.existsSync(rawPath)) fs.copyFileSync(path.join(WORK, 'captions.json'), rawPath);

syncCustom(WORK);
writeSfx(WORK);

// المتصفح ما يشغّل كل صيغة. اللي مو h264 نسوّي له نسخة خفيفة للمعاينة بس، والتصدير يبقى من الأصل
const meta = readJson(path.join(WORK, 'meta.json'));
let previewSource = meta.source;
{
  const r = ff('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,pix_fmt', '-of', 'csv=p=0', path.join(WORK, meta.source)], {allowFail: true});
  const [codec, pix] = String(r.stdout || '').trim().split(',');
  if (codec !== 'h264' || !/^yuvj?420p$/.test(pix || '')) {
    const proxy = path.join(WORK, 'proxy.mp4');
    if (!fs.existsSync(proxy)) {
      console.log('أجهّز نسخة معاينة خفيفة…');
      ff('ffmpeg', ['-v', 'error', '-y', '-i', path.join(WORK, meta.source), '-vf', 'scale=-2:960', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', proxy]);
    }
    previewSource = 'proxy.mp4';
  }
}

// واجهة المحرّر تنبني مرة عند التشغيل
console.log('أبني المحرّر…');
const esbuild = await import('esbuild');
const outDir = path.join(CACHE, 'editor');
fs.mkdirSync(outDir, {recursive: true});
await esbuild.build({
  entryPoints: [path.join(ENGINE, 'editor', 'app.jsx')],
  outfile: path.join(outDir, 'app.js'),
  bundle: true,
  format: 'iife',
  minify: true,
  jsx: 'transform',
  loader: {'.js': 'jsx'},
  define: {'process.env.NODE_ENV': '"production"'},
  logLevel: 'error',
});

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.mov': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};
const MUSIC_EXT = ['.mp3', '.m4a', '.wav', '.aac', '.ogg'];

function sendFile(req, res, file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end('not found');
    return;
  }
  const size = fs.statSync(file).size;
  const head = {'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store'};
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m) {
    // الفيديو ينطلب قطع، وبدونها التقديم والترجيع ما يشتغل
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      res.writeHead(416, {'Content-Range': `bytes */${size}`}).end();
      return;
    }
    res.writeHead(206, {...head, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1});
    fs.createReadStream(file, {start, end}).pipe(res);
    return;
  }
  res.writeHead(200, {...head, 'Content-Length': size});
  fs.createReadStream(file).pipe(res);
}

const json = (res, data, code = 200) => {
  res.writeHead(code, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify(data));
};
const body = (req, limit = 80 * 1024 * 1024) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on('data', (c) => {
      n += c.length;
      if (n > limit) {
        reject(new Error('الملف أكبر من المسموح'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const project = () => ({
  name: path.basename(WORK),
  work: WORK,
  meta: {...readJson(path.join(WORK, 'meta.json')), source: previewSource},
  cut: readJson(path.join(WORK, 'cut.json')),
  face: readJson(path.join(WORK, 'face.json'), {found: false}),
  raw: readJson(rawPath),
  fix: readJson(path.join(WORK, 'fix.json'), {}),
  plan: readJson(path.join(WORK, 'plan.json'), {}),
  hasCustom: fs.existsSync(path.join(WORK, 'custom.jsx')),
});

// التصدير: نفس أمر الرندر، ونقرا تقدّمه من مخرجاته
const job = {running: false, pct: 0, lines: [], ok: null};
function startRender() {
  if (job.running) return;
  Object.assign(job, {running: true, pct: 0, lines: [], ok: null});
  const p = spawn(process.execPath, [path.join(ENGINE, 'tools', 'render.mjs'), WORK, 'final', '--force', '--fine'], {cwd: ENGINE});
  const onData = (d) => {
    for (const line of String(d).split(/\r?\n/)) {
      if (!line.trim()) continue;
      const m = /(\d+)٪/.exec(line);
      if (m) job.pct = Number(m[1]);
      else job.lines.push(line);
    }
    job.lines = job.lines.slice(-12);
  };
  p.stdout.on('data', onData);
  p.stderr.on('data', onData);
  p.on('close', (code) => Object.assign(job, {running: false, ok: code === 0, pct: code === 0 ? 100 : job.pct}));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = decodeURIComponent(url.pathname);
    // الطلبات تنقبل من نفس الصفحة بس: موقع ثاني مفتوح بالمتصفح ما يقدر يكتب على ملفاتك
    const host = String(req.headers.host || '');
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return res.writeHead(403).end();
    if (req.method !== 'GET' && req.headers['x-reels-editor'] !== '1') return res.writeHead(403).end();

    if (req.method === 'GET') {
      if (p === '/') return sendFile(req, res, path.join(ENGINE, 'editor', 'index.html'));
      if (p === '/app.js') return sendFile(req, res, path.join(outDir, 'app.js'));
      if (p === '/api/project') return json(res, project());
      if (p === '/api/render') return json(res, job);
      if (p === '/api/styles') return json(res, readJson(STYLES_FILE, {}));
      if (p.startsWith('/work/')) {
        const file = path.resolve(WORK, p.slice(6));
        if (!file.startsWith(WORK + path.sep)) return res.writeHead(403).end();
        return sendFile(req, res, file);
      }
      return res.writeHead(404).end('not found');
    }

    if (req.method === 'POST') {
      if (p === '/api/save') {
        const d = JSON.parse((await body(req, 5 * 1024 * 1024)).toString('utf8'));
        if (d.cut) writeJson(path.join(WORK, 'cut.json'), {...d.cut, total: keepTotal(d.cut.keep)});
        if (d.raw) writeJson(rawPath, d.raw);
        if (d.fix) writeJson(path.join(WORK, 'fix.json'), d.fix);
        if (d.plan) fs.writeFileSync(path.join(WORK, 'plan.json'), JSON.stringify(d.plan, null, 2) + '\n', 'utf8');
        // captions.json هو اللي يقراه الرندر: الخام بعد التصحيح
        const raw = readJson(rawPath);
        const sentences = applyFix(raw.sentences, readJson(path.join(WORK, 'fix.json'), {}));
        writeJson(path.join(WORK, 'captions.json'), {...raw, sentences});
        fs.writeFileSync(path.join(WORK, 'script.txt'), sentences.map((s) => s.text).join('\n') + '\n', 'utf8');
        return json(res, {ok: true});
      }
      if (p === '/api/music') {
        const ext = path.extname(String(url.searchParams.get('name') || '')).toLowerCase();
        if (!MUSIC_EXT.includes(ext)) return json(res, {error: 'الصيغ المقبولة: ' + MUSIC_EXT.join(' ')}, 400);
        for (const e of MUSIC_EXT) fs.rmSync(path.join(WORK, 'music' + e), {force: true});
        fs.writeFileSync(path.join(WORK, 'music' + ext), await body(req));
        return json(res, {file: 'music' + ext});
      }
      if (p === '/api/styles') {
        const d = JSON.parse((await body(req, 1024 * 1024)).toString('utf8'));
        fs.mkdirSync(path.dirname(STYLES_FILE), {recursive: true});
        writeJson(STYLES_FILE, d);
        return json(res, {ok: true});
      }
      if (p === '/api/render') {
        startRender();
        return json(res, job);
      }
      if (p === '/api/reveal') {
        const file = path.join(WORK, 'reel.mp4');
        if (process.platform === 'win32') spawn('explorer.exe', ['/select,', file], {detached: true, stdio: 'ignore'}).unref();
        else if (process.platform === 'darwin') spawn('open', ['-R', file], {detached: true, stdio: 'ignore'}).unref();
        else spawn('xdg-open', [WORK], {detached: true, stdio: 'ignore'}).unref();
        return json(res, {ok: true});
      }
    }
    res.writeHead(404).end('not found');
  } catch (e) {
    json(res, {error: String(e.message || e)}, 500);
  }
});

server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `❌ المنفذ ${PORT} مشغول. جرّب: --port ${PORT + 1}` : '❌ ' + e.message);
  process.exit(1);
});
server.listen(PORT, '127.0.0.1', () => {
  const link = `http://localhost:${PORT}`;
  console.log(`✅ المحرّر شغّال: ${link}\nسكّره بـ Ctrl+C لما تخلص.`);
  if (!args.includes('--no-open')) {
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', link], {detached: true, stdio: 'ignore'}).unref();
    else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [link], {detached: true, stdio: 'ignore'}).unref();
  }
});
