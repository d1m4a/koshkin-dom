// Подстановка своих записей вместо синтезированных звуков.
//
//   node tools/import-audio.cjs <файл> <ключ> [--loop] [--trim] [--gain=1.2] [--presence]
//
// Пример: node tools/import-audio.cjs ~/purr.wav purr-deep --loop --trim
//
// Ключи, которые понимает игра:
//   purr-deep, purr-breath — мурчание, два слоя, ОБА зациклены
//   amb-hum, amb-clock     — фон комнаты, зациклены
//   meow-1, meow-2         — мяуканье, одиночные
//
// Что делает: приводит к моно 48 кГц, нормализует, по --trim срезает тишину
// по краям, по --loop делает петлю бесшовной (хвост подмешивается в начало)
// и кладёт рядом .ogg и .mp3 — OGG для всех, MP3 для Safari.
//
// --presence (только для purr-deep): из той же записи делается второй слой
// в purr-breath. Настоящее мурчание — это 25-50 Гц, а встроенные динамики
// ноутбуков и телефонов ниже 200 Гц почти ничего не выдают: запись честно
// играет, но её не слышно. Насыщение вытягивает гармоники основы в середину
// и поднимает слышимую полосу примерно на 14 дБ.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const { toWav, SR } = require('./synth.cjs');

const OUT = path.join('public', 'assets', 'audio');
const KEYS = ['purr-deep', 'purr-breath', 'amb-hum', 'amb-clock', 'meow-1', 'meow-2'];

// Декодируем чем угодно на входе в сырой моно-поток нужной частоты.
function decode(file) {
  const raw = execFileSync(
    ffmpeg,
    ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'],
    { maxBuffer: 1 << 28 }
  );
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}

// Тишина по краям мешает и петле, и одиночному звуку: мяу должно начинаться
// сразу, иначе задержка читается как лаг игры.
function trimSilence(d, threshold = 0.004) {
  let a = 0;
  let b = d.length - 1;
  while (a < b && Math.abs(d[a]) < threshold) a++;
  while (b > a && Math.abs(d[b]) < threshold) b--;
  return d.subarray(Math.max(0, a - 240), Math.min(d.length, b + 240));
}

function normalize(d, target = 0.92) {
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (!peak) return d;
  const k = target / peak;
  for (let i = 0; i < d.length; i++) d[i] *= k;
  return d;
}

// Живая запись почти никогда не сходится сама с собой на стыке. Хвост
// подмешивается в начало — тот же приём, что и в синтезе.
function makeLoopable(d, fadeSeconds = 0.08) {
  const fade = Math.min(Math.floor(SR * fadeSeconds), Math.floor(d.length / 4));
  const n = d.length - fade;
  const out = new Float32Array(n);
  out.set(d.subarray(0, n));
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    out[i] = out[i] * k + d[n + i] * (1 - k);
  }
  return out;
}

function main() {
  const [file, key] = process.argv.slice(2);
  const loop = process.argv.includes('--loop');
  const trim = process.argv.includes('--trim');
  const gainArg = process.argv.find((a) => a.startsWith('--gain='));
  const gain = gainArg ? Number(gainArg.slice(7)) : 1;

  if (!file || !key) {
    console.error('нужно: node tools/import-audio.cjs <файл> <ключ> [--loop] [--trim] [--gain=1.2]');
    console.error('ключи:', KEYS.join(', '));
    process.exit(1);
  }
  if (!KEYS.includes(key)) {
    console.error('неизвестный ключ:', key, '\nдоступны:', KEYS.join(', '));
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error('файл не найден:', file);
    process.exit(1);
  }

  let d = decode(file);
  const before = d.length / SR;
  if (trim) d = trimSilence(d);
  d = normalize(new Float32Array(d));
  if (loop) d = makeLoopable(d);
  if (gain !== 1) for (let i = 0; i < d.length; i++) d[i] = Math.max(-1, Math.min(1, d[i] * gain));

  const presence = process.argv.includes('--presence');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cat-import-'));
  const wav = path.join(tmp, key + '.wav');
  fs.writeFileSync(wav, toWav(d));
  fs.mkdirSync(OUT, { recursive: true });

  const ogg = path.join(OUT, key + '.ogg');
  const mp3 = path.join(OUT, key + '.mp3');
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libvorbis', '-qscale:a', '4', ogg]);
  // Тег Xing обязателен: без него MP3-декодер не знает про задержку
  // кодировщика и на стыке петли слышен щелчок.
  execFileSync(ffmpeg, [
    '-y', '-loglevel', 'error', '-i', wav,
    '-c:a', 'libmp3lame', '-qscale:a', '4', '-write_xing', '1', mp3,
  ]);
  // Слой присутствия из той же записи.
  if (presence && key === 'purr-deep') {
    const pw = path.join(tmp, 'presence.wav');
    execFileSync(ffmpeg, [
      '-y', '-loglevel', 'error', '-i', wav,
      '-af', "aeval='tanh(6*val(0))':c=same,highpass=f=180,volume=3",
      pw,
    ]);
    const pOgg = path.join(OUT, 'purr-breath.ogg');
    const pMp3 = path.join(OUT, 'purr-breath.mp3');
    execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', pw, '-c:a', 'libvorbis', '-qscale:a', '4', pOgg]);
    execFileSync(ffmpeg, [
      '-y', '-loglevel', 'error', '-i', pw,
      '-c:a', 'libmp3lame', '-qscale:a', '4', '-write_xing', '1', pMp3,
    ]);
    console.log('  purr-breath ← слой присутствия из той же записи');
  }

  fs.rmSync(tmp, { recursive: true, force: true });

  const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0) + ' КБ';
  console.log(key, '←', path.basename(file));
  console.log('  длительность', before.toFixed(2), 'с →', (d.length / SR).toFixed(2), 'с', loop ? '(петля сшита)' : '');
  console.log('  ogg', kb(ogg), ' mp3', kb(mp3));
  console.log('  дальше: npm run build');
}

main();
