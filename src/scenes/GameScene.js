import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { PALETTE } from '../palette.js';
import { LAYERS } from '../data/roomLiving.js';
import { SPOTS } from '../data/spots.js';
import { ParallaxLayers } from '../systems/ParallaxLayers.js';
import { CameraRig } from '../systems/CameraRig.js';
import { PaperOverlay } from '../systems/PaperOverlay.js';
import { InputController } from '../systems/InputController.js';
import { SpotManager } from '../systems/SpotManager.js';
import { SpotMarkers } from '../systems/SpotMarkers.js';
import { AudioManager } from '../systems/AudioManager.js';
import { IdleSystem } from '../systems/IdleSystem.js';
import { AmbientEvents } from '../systems/AmbientEvents.js';
import { DayCycle } from '../systems/DayCycle.js';
import { AlbumStore } from '../systems/AlbumStore.js';
import { Cat, STATE } from '../entities/Cat.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.layers = new ParallaxLayers(this, LAYERS).build();

    this.spots = new SpotManager(SPOTS);
    this.day = new DayCycle(9); // начинаем утром, когда открыт подоконник
    this.album = new AlbumStore();
    this.audio = new AudioManager(this);
    this.markers = new SpotMarkers(this, this.spots);
    this.ambient = new AmbientEvents(this);

    this.cat = new Cat(this, 300, {
      spots: this.spots,
      onPrompt: (spot) => this.events.emit('prompt-show', spot),
      onPromptHide: () => this.events.emit('prompt-hide'),
      onSleepStart: (spot) => {
        this.audio.startPurr(spot.comfort);
        this.markers.setOccupied(spot);
        if (this.album.unlock(spot.id)) this.events.emit('pose-unlocked', spot);
      },
      onSleepEnd: () => {
        this.audio.stopPurr();
        this.markers.setOccupied(null);
      },
      // Фоновые события идут только пока кот залип у стены.
      onWallStare: (active) => (active ? this.ambient.arm() : this.ambient.disarm()),
      onMeow: () => this.audio.meow(),
    });

    this.input1 = new InputController(this);
    // Клик рядом с местом для сна подтягивается к нему, чтобы кот не
    // останавливался в полушаге от подушки.
    this.input1.snapTarget = (x) => this.spots.snap(x);
    this.input1.bindActionTarget(this.cat.sprite);

    // Уходить в стену можно только стоя: спящего будить незачем,
    // идущего перебивать нельзя.
    this.idle = new IdleSystem(this.input1, () => this.cat.setState(STATE.GOING_TO_WALL));

    this.rig = new CameraRig(this, this.cat.sprite);
    this.cat.onFacingChange = (dir) => this.rig.setFacing(dir);

    this.audio.startAmbient();
    this.paper = new PaperOverlay(this);

    this.scene.launch('UI');

    this.testNote = null;
    this.debug = this.add
      .text(10, 8, '', {
        fontFamily: 'Consolas, monospace',
        fontSize: '12px',
        color: PALETTE.GRAPHITE_2,
      })
      .setScrollFactor(0)
      .setDepth(CONFIG.DEPTH.UI)
      .setVisible(false);

    // T — проверка звукового тракта в обход всей игровой логики.
    this.input.keyboard.on('keydown-T', () => {
      this.testNote = this.audio.test();
      this.debug.setVisible(true);
    });

    // F1 перехватывает браузер, поэтому отладка на клавише I.
    this.input.keyboard.on('keydown-I', () => this.debug.setVisible(!this.debug.visible));
    if (import.meta.env.DEV) {
      // Ждать фоновое событие по 2-5 минут при отладке невозможно.
      this.input.keyboard.on('keydown-F', () => this.ambient.trigger());
    }
  }

  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000; // защита от прыжка после смены вкладки

    this.day.update(dt);
    this.spots.hour = this.day.hour;
    this.paper.setDayTone(this.day.tone());

    this.cat.update(dt, this.input1);
    this.idle.update(this.cat.state, [STATE.IDLE_STAND, STATE.PROMPT]);
    this.ambient.update(dt);
    this.markers.update(time);
    this.layers.update(this.cameras.main);

    if (this.cat.state === STATE.PROMPT) {
      const cam = this.cameras.main;
      this.events.emit('prompt-move', this.cat.x - cam.scrollX, this.cat.sprite.y - 110);
    }

    if (this.debug.visible) {
      const cam = this.cameras.main;
      this.debug.setText(
        [
          'fps ' + Math.round(this.game.loop.actualFps),
          'cat.x ' + Math.round(this.cat.x) + '  ' + this.cat.state,
          'scrollX ' + Math.round(cam.scrollX) + '  offset ' + Math.round(cam.followOffset.x),
          'target ' + (this.input1.target === null ? '—' : Math.round(this.input1.target)),
          'idle ' + this.input1.idleSeconds().toFixed(1) + ' с',
          'время ' + this.day.label + '  альбом ' + this.album.count + '/' + SPOTS.length,
          ...this.audio.debugLines(),
          this.testNote || 'T — проверить звук, I — скрыть',
        ].join('\n')
      );
    }
  }
}
