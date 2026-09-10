// Намерение движения из двух источников: клавиши (движение удержанием)
// и клик/тап по комнате (кот идёт к точке и сам останавливается).
// Клавиша всегда сильнее — она отменяет цель клика.

import Phaser from 'phaser';
import { CONFIG } from '../config.js';

// Tab — альбом, Escape — закрыть панель, M — выключить звук.
const UI_KEYS = new Set(['Tab', 'Escape', 'm', 'M', 'ь', 'Ь']);

export class InputController {
  constructor(scene) {
    this.scene = scene;
    this.target = null; // мировая X-координата цели клика
    this.lastInputAt = scene.time.now;
    // Счётчик любого ввода: спящий кот просыпается от факта нажатия,
    // а не от конкретной клавиши.
    this.seq = 0;
    this.action = false; // «лечь» — пробел или тап по коту
    this.snapTarget = null; // подтягивание цели к месту для сна ставит GameScene

    const kb = scene.input.keyboard;
    this.keys = kb.addKeys({
      left: 'LEFT',
      right: 'RIGHT',
      a: 'A',
      d: 'D',
      space: 'SPACE',
    });

    scene.input.on('pointerdown', (pointer) => {
      // Клик по кнопкам интерфейса или при открытой панели не должен
      // отправлять кота гулять — на телефоне это единственный способ
      // отличить «нажал кнопку» от «ткнул в комнату».
      if (this.overUI(pointer)) return;
      const x = Phaser.Math.Clamp(pointer.worldX, CONFIG.WORLD_LEFT, CONFIG.WORLD_RIGHT);
      this.target = this.snapTarget ? this.snapTarget(x) : x;
      this.bump();
    });

    // Tab открывает альбом и не считается вводом: иначе взгляд на только что
    // открытую позу немедленно будил бы кота.
    kb.addCapture('TAB');
    kb.on('keydown', (event) => {
      // Клавиши интерфейса вводом не считаются: иначе взгляд на альбом
      // или правка громкости будили бы кота.
      if (event && UI_KEYS.has(event.key)) return;
      this.target = null;
      this.bump();
    });

    // Именно событие, а не опрос JustDown в update: если нажатие и отпускание
    // попали в один кадр (подтормаживающая вкладка, быстрый тап), опрос
    // теряет нажатие — Key.onUp успевает сбросить флаг до проверки.
    kb.on('keydown-SPACE', () => {
      this.action = true;
    });
  }

  // Верхний правый угол занят кнопками, плюс любая открытая панель.
  overUI(pointer) {
    if (this.scene.registry.get('uiOpen')) return true;
    return pointer.y < 44 && pointer.x > CONFIG.WIDTH - 100;
  }

  bump() {
    this.seq += 1;
    this.lastInputAt = this.scene.time.now;
  }

  // Тап по самому коту — то же, что пробел. Нужно для мобильных,
  // где клавиатуры нет вовсе.
  bindActionTarget(gameObject) {
    gameObject.setInteractive();
    gameObject.on('pointerdown', () => {
      this.action = true;
      this.bump();
    });
  }

  get keyDir() {
    const k = this.keys;
    const left = k.left.isDown || k.a.isDown;
    const right = k.right.isDown || k.d.isDown;
    if (left && !right) return -1;
    if (right && !left) return 1;
    return 0;
  }

  consumeAction() {
    const was = this.action;
    this.action = false;
    return was;
  }

  clearTarget() {
    this.target = null;
  }

  // Секунд без ввода — для IdleSystem (Фаза 3).
  idleSeconds() {
    return (this.scene.time.now - this.lastInputAt) / 1000;
  }
}
