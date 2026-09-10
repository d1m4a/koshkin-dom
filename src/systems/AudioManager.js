// Мурчание и фон комнаты.
//
// Половина впечатления от игры идёт отсюда, поэтому мурчание собрано из двух
// слоёв, как в разделе 7 дизайн-документа: низкий гул и слой дыхания поверх,
// с чуть разной громкостью.
//
// Звук лежит файлами в public/assets/audio: OGG для всех и MP3 для Safari,
// который OGG не понимает. Phaser сам выбирает поддерживаемый формат.
// Исходник звука — не файлы, а tools/synth.cjs: он их и генерирует,
// а свою запись можно подставить через tools/import-audio.cjs.

import { CONFIG } from '../config.js';

export const PURR_DEEP = 'purr-deep';
export const PURR_BREATH = 'purr-breath';
export const AMB_HUM = 'amb-hum';
export const AMB_CLOCK = 'amb-clock';
// Два варианта мяуканья: одинаковое каждый раз звучит механически.
export const MEOWS = ['meow-1', 'meow-2'];

// Ключи и оба формата — этим же списком BootScene грузит файлы.
export const AUDIO_FILES = [PURR_DEEP, PURR_BREATH, AMB_HUM, AMB_CLOCK, ...MEOWS].map((key) => ({
  key,
  urls: ['assets/audio/' + key + '.ogg', 'assets/audio/' + key + '.mp3'],
}));

export class AudioManager {
  constructor(scene) {
    this.scene = scene;
    this.layers = [];
    this.ambient = [];
    this.available = scene.cache.audio.exists(PURR_DEEP);

    // Общая громкость приходит из настроек через реестр.
    const reg = scene.registry;
    this.master = reg.get('audioMaster');
    if (this.master === undefined) this.master = 0.6;
    this.onMaster = (parent, value) => this.setMaster(value);
    reg.events.on('changedata-audioMaster', this.onMaster);
    scene.events.once('shutdown', () => reg.events.off('changedata-audioMaster', this.onMaster));
  }

  // Плавность делается расписанием самого Web Audio, а не твином сцены.
  //
  // Твин крутится только когда идут кадры, а браузер душит кадры в фоновой
  // или неактивной вкладке. Громкость тогда навсегда застревает на нуле —
  // и звука нет вообще, хотя звук «играет». Расписание аудиоконтекста живёт
  // на своём потоке и от кадров не зависит.
  ramp(sound, target, ms) {
    const node = sound.volumeNode;
    const ctx = this.scene.sound.context;
    const value = Math.max(0, target);
    if (!node || !ctx) {
      sound.setVolume(value);
      return;
    }
    const now = ctx.currentTime;

    // Откуда ведём. Читать node.gain.value нельзя: он обновляется только
    // на следующем кванте обработки, и сразу после старта возвращает 1 —
    // тогда «нарастание» превращается в спад с полной громкости, то есть
    // в хлопок. Поэтому текущее значение считаем сами по своему расписанию.
    const f = sound.__fade;
    let from = value;
    if (f) {
      if (now <= f.t0) from = f.v0;
      else if (now >= f.t1) from = f.v1;
      else from = f.v0 + ((f.v1 - f.v0) * (now - f.t0)) / (f.t1 - f.t0);
    } else {
      from = node.gain.value;
    }

    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(from, now);
    if (ms > 0) node.gain.linearRampToValueAtTime(value, now + ms / 1000);
    else node.gain.setValueAtTime(value, now);

    sound.__fade = { t0: now, v0: from, t1: now + ms / 1000, v1: value };
    // Держим конфиг звука в согласии с узлом: по нему считает сам Phaser.
    sound.currentConfig.volume = value;
  }

  // Общая громкость из настроек: применяется ко всему, что сейчас звучит.
  setMaster(m) {
    this.master = m;
    for (const layer of this.layers) this.ramp(layer.sound, (layer.target || 0) * m, 120);
    for (const a of this.ambient) this.ramp(a.sound, a.base * m, 120);
  }

  ensureSounds() {
    if (!this.available || this.layers.length) return;
    // target — куда ведём громкость слоя; само ведение делает ramp().
    this.layers = [
      { sound: this.scene.sound.add(PURR_DEEP, { loop: true, volume: 0 }), base: CONFIG.PURR_VOLUME_DEEP, target: 0 },
      { sound: this.scene.sound.add(PURR_BREATH, { loop: true, volume: 0 }), base: CONFIG.PURR_VOLUME_BREATH, target: 0 },
    ];
  }

  // Резкий старт мурчания звучит фальшиво — только через нарастание.
  startPurr(comfort = 3) {
    this.ensureSounds();
    if (!this.layers.length) return;
    const gain = 0.7 + 0.1 * comfort; // мягкое место мурчит громче
    for (const layer of this.layers) {
      layer.target = layer.base * gain;
      clearTimeout(layer.stopTimer);
      if (!layer.sound.isPlaying) {
        this.ramp(layer.sound, 0, 0);
        layer.sound.play();
      }
      this.ramp(layer.sound, layer.target * this.master, CONFIG.PURR_FADE_IN);
    }
  }

  stopPurr() {
    if (!this.layers.length) return;
    for (const layer of this.layers) {
      layer.target = 0;
      this.ramp(layer.sound, 0, CONFIG.PURR_FADE_OUT);
      // setTimeout, а не таймер сцены: тот тоже ждёт кадров.
      clearTimeout(layer.stopTimer);
      layer.stopTimer = setTimeout(() => {
        if (layer.target === 0 && layer.sound.isPlaying) layer.sound.stop();
      }, CONFIG.PURR_FADE_OUT + 60);
    }
  }

  // Фон включается один раз за игру и дальше только меняет общую громкость.
  startAmbient() {
    if (this.ambient.length || !this.scene.cache.audio.exists(AMB_HUM)) return;
    this.ambient = [
      { key: AMB_HUM, base: CONFIG.AMBIENT_VOLUME_HUM },
      { key: AMB_CLOCK, base: CONFIG.AMBIENT_VOLUME_CLOCK },
    ].map(({ key, base }) => {
      const sound = this.scene.sound.add(key, { loop: true, volume: 0 });
      this.ramp(sound, 0, 0);
      sound.play();
      this.ramp(sound, base * this.master, 2500);
      return { sound, base };
    });
  }

  // Мяуканье: короткий одиночный звук, без петли и без нарастания.
  meow() {
    const key = MEOWS[Math.floor(Math.random() * MEOWS.length)];
    if (!this.scene.cache.audio.exists(key)) return;
    const sound = this.scene.sound.add(key);
    sound.once('complete', () => sound.destroy());
    sound.play();
    this.ramp(sound, CONFIG.MEOW_VOLUME * this.master, 0);
  }

  // Что реально приходит на узлы громкости Web Audio. Наши переменные могут
  // говорить одно, а звучать может другое — эти строки показывают второе.
  debugLines() {
    const gain = (snd) => (snd && snd.volumeNode ? snd.volumeNode.gain.value : -1);
    const fmt = (v) => (v < 0 ? '—' : v.toFixed(3));
    const one = (snd) => fmt(gain(snd)) + (snd.isPlaying ? '' : ' стоп');
    const ctx = this.scene.sound.context;
    return [
      'звук: мастер ' + this.master.toFixed(2) + '  контекст ' + (ctx ? ctx.state : '—'),
      'мур ' + (this.layers.map((l) => one(l.sound)).join(' ') || '—') +
        '   фон ' + (this.ambient.map((a) => one(a.sound)).join(' ') || '—'),
    ];
  }
}
