// Генерация звуковых файлов игры: OGG + MP3 из синтезированных петель.
//
// Запуск: node tools/make-audio.cjs
// Результат: public/assets/audio/<имя>.ogg и .mp3
//
// Два формата нужны потому, что Safari не понимает OGG, а Phaser сам выберет
// поддерживаемый, если передать оба.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const { LOOPS, render, toWav } = require('./synth.cjs');

const OUT = path.join('public', 'assets', 'audio');

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cat-audio-'));

  for (const [name, spec] of Object.entries(LOOPS)) {
    const wav = path.join(tmp, name + '.wav');
    fs.writeFileSync(wav, toWav(render(spec)));

    const ogg = path.join(OUT, name + '.ogg');
    const mp3 = path.join(OUT, name + '.mp3');

    // Vorbis качества 3 хватает для шумовых петель с головой.
    execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libvorbis', '-qscale:a', '3', ogg]);
    // MP3 пишется с тегом Xing: без него декодер не знает про задержку
    // кодировщика и на стыке петли слышен щелчок.
    execFileSync(ffmpeg, [
      '-y', '-loglevel', 'error', '-i', wav,
      '-c:a', 'libmp3lame', '-qscale:a', '5', '-write_xing', '1', mp3,
    ]);

    const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0) + ' КБ';
    console.log(name.padEnd(12), spec.duration + ' с', ' ogg', kb(ogg), ' mp3', kb(mp3));
  }

  fs.rmSync(tmp, { recursive: true, force: true });
}

main();
