// Громкость и выключение звука. Хранится между запусками там же,
// где альбом — в localStorage, с той же защитой от запрета на данные сайтов.

// Версия ключа поднята намеренно: старые сохранённые настройки могли
// остаться с тихой громкостью, а по умолчанию теперь полная.
const KEY = 'cat-audio-v2';
const STEPS = 5;

export class AudioSettings {
  constructor(game) {
    this.game = game;
    const saved = this.load();
    this.level = saved.level === undefined ? 5 : saved.level; // 0..5, по умолчанию полная
    this.muted = !!saved.muted;
    this.apply();
  }

  load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ level: this.level, muted: this.muted }));
    } catch (e) {
      /* без сохранения тоже играется */
    }
  }

  // Через свойства менеджера Phaser громкость не идёт: в 3.90 у него,
  // как и у отдельного звука, сеттер и геттер расходятся. Поэтому общий
  // множитель кладётся в реестр, а AudioManager домножает на него каждый
  // звук вручную.
  apply() {
    this.game.registry.set('audioMaster', this.on ? this.level / STEPS : 0);
  }

  setLevel(v) {
    this.level = Math.max(0, Math.min(STEPS, v));
    if (this.level > 0) this.muted = false;
    this.apply();
    this.save();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (!this.muted && this.level === 0) this.level = 3;
    this.apply();
    this.save();
  }

  get steps() {
    return STEPS;
  }

  get on() {
    return !this.muted && this.level > 0;
  }
}
