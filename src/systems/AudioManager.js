// Мурчание и фон комнаты.
//
// Половина впечатления от игры идёт отсюда, поэтому мурчание собрано из двух
// слоёв, как в разделе 7 дизайн-документа: низкий гул и слой дыхания поверх,
// с чуть разной громкостью.
//
// Звук лежит файлами в public/assets/audio: OGG для всех и MP3 для Safari,
// который OGG не понимает. Phaser сам выбирает поддерживаемый формат.
// Исходник звука — не файлы, а tools/synth.cjs: он их и генерирует.

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

  setMaster(m) {
    this.master = m;
    for (const layer of this.layers) layer.sound.setVolume(layer.level.v * m);
    for (const a of this.ambient) a.sound.setVolume(a.base * m);
  }

  // Фон включается один раз за игру и больше не трогается.
  startAmbient() {
    if (this.ambient.length || !this.scene.cache.audio.exists(AMB_HUM)) return;
    this.ambient = [
      { key: AMB_HUM, base: CONFIG.AMBIENT_VOLUME_HUM },
      { key: AMB_CLOCK, base: CONFIG.AMBIENT_VOLUME_CLOCK },
    ].map(({ key, base }) => {
      const sound = this.scene.sound.add(key, { loop: true, volume: 0 });
      sound.setVolume(0);
      sound.play();
      const entry = { sound, base };
      this.scene.tweens.add({
        targets: { v: 0 },
        v: base,
        duration: 2500,
        ease: 'Sine.easeOut',
        onUpdate: (tw, t) => sound.setVolume(t.v * this.master),
      });
      return entry;
    });
  }

  ensureSounds() {
    if (!this.available || this.layers.length) return;
    // level — собственный счётчик громкости. Напрямую твинить sound.volume
    // нельзя: в Phaser 3.90 сеттер работает, а геттер всегда возвращает 1,
    // и твин берёт стартовое значение оттуда. Появление звука превращалось
    // в падение с полной громкости — тот самый резкий старт, которого
    // не должно быть.
    this.layers = [
      { sound: this.scene.sound.add(PURR_DEEP, { loop: true, volume: 0 }), base: CONFIG.PURR_VOLUME_DEEP, level: { v: 0 } },
      { sound: this.scene.sound.add(PURR_BREATH, { loop: true, volume: 0 }), base: CONFIG.PURR_VOLUME_BREATH, level: { v: 0 } },
    ];
  }

  // Резкий старт мурчания звучит фальшиво — только через fade in.
  startPurr(comfort = 3) {
    this.ensureSounds();
    if (!this.layers.length) return;
    const gain = 0.7 + 0.1 * comfort; // мягкое место мурчит громче
    for (const layer of this.layers) {
      if (layer.tween) layer.tween.remove();
      if (!layer.sound.isPlaying) {
        layer.level.v = 0;
        layer.sound.setVolume(0);
        layer.sound.play();
      }
      layer.tween = this.scene.tweens.add({
        targets: layer.level,
        v: layer.base * gain,
        duration: CONFIG.PURR_FADE_IN,
        ease: 'Sine.easeOut',
        onUpdate: () => layer.sound.setVolume(layer.level.v * this.master),
      });
    }
  }

  // Мяуканье: короткий одиночный звук, без петли и без затухания.
  // Голос звучит поверх фона, поэтому громкость считается от общей.
  meow() {
    const key = MEOWS[Math.floor(Math.random() * MEOWS.length)];
    if (!this.scene.cache.audio.exists(key)) return;
    const sound = this.scene.sound.add(key);
    sound.setVolume(CONFIG.MEOW_VOLUME * this.master);
    sound.once('complete', () => sound.destroy());
    sound.play();
  }

  stopPurr() {
    if (!this.layers.length) return;
    for (const layer of this.layers) {
      if (layer.tween) layer.tween.remove();
      layer.tween = this.scene.tweens.add({
        targets: layer.level,
        v: 0,
        duration: CONFIG.PURR_FADE_OUT,
        ease: 'Sine.easeIn',
        onUpdate: () => layer.sound.setVolume(layer.level.v * this.master),
        onComplete: () => layer.sound.stop(),
      });
    }
  }
}
