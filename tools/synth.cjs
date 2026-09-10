// Синтез звуковых петель. Раньше это крутилось в игре на старте, теперь
// живёт здесь и генерирует файлы: игра их просто грузит.
//
// Код остаётся в репозитории намеренно — это исходник звука. Захочется
// подкрутить мурчание, правится здесь и перегенерируется, а не подбирается
// на слух в редакторе.

const SR = 48000;

// Длительности и частоты подобраны так, чтобы петля была бесшовной:
// целое число пульсов и ровно один цикл дыхания.
const LOOPS = {
  'purr-deep': {
    duration: 3,
    cutoff: 210,
    seed: 8123,
    // Экспоненциальный «удар» на каждый пульс — ровная синусоида звучит
    // как гудение трансформатора.
    shape: (t) => {
      const rate = 26; // частота пульса кошачьего мурчания, Гц
      const phase = (t * rate) % 1;
      // Дно пульса высокое: между ударами должен оставаться корпус гула,
      // иначе мурчание при той же громкости слышно как редкие щелчки.
      const pulse = 0.34 + 0.66 * Math.exp(-phase * 5);
      return pulse * (0.7 + 0.3 * Math.sin((2 * Math.PI * t) / 3));
    },
  },
  'purr-breath': {
    duration: 3,
    cutoff: 900,
    seed: 4471,
    // Вдох короче выдоха.
    shape: (t) => {
      const ph = (t / 3) % 1;
      return Math.pow(Math.sin(Math.PI * Math.pow(ph, 0.7)), 2) * 0.9 + 0.05;
    },
  },
  'amb-hum': {
    duration: 6,
    cutoff: 110,
    seed: 991,
    // Гул еле дышит: ровная громкость выдаёт синтез.
    shape: (t) => 0.72 + 0.28 * Math.sin((2 * Math.PI * t) / 6),
  },
  // Два варианта мяуканья: одинаковое каждый раз звучит механически.
  'meow-1': { meow: true, duration: 0.8, f0: 500, fPeak: 720, fEnd: 430, open: 2600, seed: 5501 },
  'meow-2': { meow: true, duration: 0.66, f0: 560, fPeak: 640, fEnd: 400, open: 2100, seed: 8802 },

  'amb-clock': {
    duration: 4,
    noise: 'white',
    cutoff: 5200,
    highpass: 1400,
    seed: 337,
    // Щелчок раз в секунду, «тик» и «так» чуть разной силы.
    shape: (t) => {
      const ph = t % 1;
      return Math.exp(-ph * 190) * (Math.floor(t) % 2 === 0 ? 1 : 0.72);
    },
  },
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Мяуканье — не шум, а тон: пилообразная волна с огибающей высоты и
// открывающимся фильтром. Открытие фильтра к середине и есть переход
// «мя» → «ау»: так меняется тембр, когда кот раскрывает рот.
function renderMeow({ duration, f0, fPeak, fEnd, open, seed }) {
  const n = Math.floor(SR * duration);
  const out = new Float32Array(n);
  const rnd = mulberry32(seed);
  let phase = 0;
  let lo = 0;

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const u = t / duration;

    // Высота: быстрый подъём и долгий спад — так звучит вопросительное «мяу».
    const pitch = u < 0.22 ? f0 + (fPeak - f0) * (u / 0.22) : fPeak + (fEnd - fPeak) * ((u - 0.22) / 0.78);
    const vibrato = 1 + 0.02 * Math.sin(2 * Math.PI * 5.5 * t);
    phase += (pitch * vibrato) / SR;
    phase -= Math.floor(phase);

    // Пила плюс капля шума на дыхание.
    const saw = 2 * phase - 1;
    const x = saw * 0.92 + (rnd() * 2 - 1) * 0.08;

    // Фильтр открывается к середине и закрывается к концу — рот.
    const mouth = Math.sin(Math.PI * Math.min(1, Math.max(0, u))) ** 0.7;
    const cutoff = 620 + open * mouth;
    const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
    lo += a * (x - lo);

    // Громкость: быстрая атака, долгий спад.
    const env = Math.min(1, u / 0.07) * Math.pow(1 - u, 1.4);
    out[i] = lo * env;
  }

  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const norm = peak > 0 ? 0.9 / peak : 1;
  for (let i = 0; i < n; i++) out[i] *= norm;
  return out;
}

function render(spec) {
  if (spec.meow) return renderMeow(spec);
  const { duration, cutoff, highpass, seed, shape, noise = 'brown' } = spec;
  const n = Math.floor(SR * duration);
  const fade = Math.floor(SR * 0.05);
  const raw = new Float32Array(n + fade);
  const rnd = mulberry32(seed);

  // Коричневый шум — основа гула и дыхания, белый — щелчков часов.
  let last = 0;
  for (let i = 0; i < raw.length; i++) {
    const white = rnd() * 2 - 1;
    if (noise === 'white') raw[i] = white;
    else {
      last = (last + 0.02 * white) / 1.02;
      raw[i] = last * 3.2;
    }
  }

  // Однополюсный ФНЧ: тепло вместо шипения.
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  let y = 0;
  for (let i = 0; i < raw.length; i++) {
    y += a * (raw[i] - y);
    raw[i] = y;
  }

  // ФВЧ вычитанием низов: щелчку часов нужна верхняя середина.
  if (highpass) {
    const b = 1 - Math.exp((-2 * Math.PI * highpass) / SR);
    let lo = 0;
    for (let i = 0; i < raw.length; i++) {
      lo += b * (raw[i] - lo);
      raw[i] -= lo;
    }
  }

  // Огибающая накладывается ДО нормализации. Наоборот было ошибкой: пульс
  // мурчания в среднем сильно меньше единицы, и после него файл выходил
  // втрое тише своего запаса.
  for (let i = 0; i < raw.length; i++) raw[i] *= shape(i / SR);

  let peak = 0;
  for (let i = 0; i < raw.length; i++) peak = Math.max(peak, Math.abs(raw[i]));
  const norm = peak > 0 ? 0.92 / peak : 1;
  for (let i = 0; i < raw.length; i++) raw[i] *= norm;

  // Бесшовная петля: хвост подмешивается в начало.
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    raw[i] = raw[i] * k + raw[n + i] * (1 - k);
  }
  return raw.subarray(0, n);
}

// WAV — промежуточный формат для кодировщика, в игру не попадает.
function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVE', 8);
  head.write('fmt ', 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); // PCM
  head.writeUInt16LE(1, 22); // моно
  head.writeUInt32LE(SR, 24);
  head.writeUInt32LE(SR * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

module.exports = { LOOPS, render, toWav, SR };
