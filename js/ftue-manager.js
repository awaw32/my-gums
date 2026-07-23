"use strict";

import { ENEMY_TYPES } from "./enemies.js";

/**
 * js/ftue-manager.js
 * ============================================================================
 * 🏜️ قصة البداية FTUE — تجربة اللاعب الجديد الموجَّهة داخل الخريطة الحقيقية
 * (وليست سينماتيك نصي منفصل فقط). تسلسل: حوار الشيخ -> تحرّك 30 ثانية ->
 * اقتل لصاً واحداً -> ابنِ خيمة -> اصمد أمام هجوم 3 لصوص -> ينتهي ويفتح العالم.
 * كل خطوة تُتابَع عبر أحداث حقيقية من WorldMap/Village الموجودين فعلاً —
 * لا تكرار لأي منطق قتل/بناء، فقط ربط HUD توجيهي فوقها.
 * ============================================================================
 */

const FTUE_STEPS = {
  MOVE: "move",
  KILL: "kill",
  BUILD: "build",
  SURVIVE: "survive",
  DONE: "done",
};

const MOVE_DURATION_SEC = 30;
const SURVIVE_BANDIT_COUNT = 3;

export class FTUEManager {
  constructor(world, village) {
    this.world = world;
    this.village = village;
    this.step = null;
    this._moveElapsed = 0;
    this._surviveMonsterIds = [];
    this._surviveKilled = 0;
    this._active = false;
    this._onStepChanged = null;
    this._onComplete = null;
  }

  start() {
    this._active = true;
    this.step = FTUE_STEPS.MOVE;
    this._moveElapsed = 0;
    this._notifyStep();
  }

  get active() { return this._active; }

  _notifyStep() {
    if (this._onStepChanged) this._onStepChanged(this.step);
  }

  /** يُستدعى من حلقة تحديث العالم كل إطار أثناء نشاط FTUE فقط */
  update(dt) {
    if (!this._active) return;
    const w = this.world;
    if (this.step === FTUE_STEPS.MOVE) {
      this._moveElapsed += dt;
      if (this._moveElapsed >= MOVE_DURATION_SEC) {
        this._spawnSingleBandit();
        this.step = FTUE_STEPS.KILL;
        this._notifyStep();
      }
    } else if (this.step === FTUE_STEPS.SURVIVE) {
      // نجاة: يكفي أن يبقى اللاعب حياً حتى يُقتل الثلاثة أو يمر وقت كافٍ
      const anyAlive = this._surviveMonsterIds.some(id => w.monsters.find(m => m.id === id && m.alive));
      if (!anyAlive) {
        this._finish();
      }
    }
  }

  /** يُستدعى من world._onMonsterKilled الموجودة أصلاً — لا نضيف حدثاً جديداً */
  onMonsterKilled(monster) {
    if (!this._active) return;
    if (this.step === FTUE_STEPS.KILL && monster?._ftueBandit) {
      this.step = FTUE_STEPS.BUILD;
      this._notifyStep();
    } else if (this.step === FTUE_STEPS.SURVIVE) {
      this._surviveKilled++;
    }
  }

  /** يُستدعى من village.setBuildingCallbacks(onBuilt) الموجودة أصلاً */
  onBuildingBuilt() {
    if (!this._active || this.step !== FTUE_STEPS.BUILD) return;
    this.step = FTUE_STEPS.SURVIVE;
    this._notifyStep();
    this._spawnSurviveBandits();
  }

  _spawnSingleBandit() {
    const w = this.world;
    const enemyDef = ENEMY_TYPES.desert_thief;
    const x = w.leader.x + 120;
    const y = w.leader.y;
    const id = `ftue_bandit_${Date.now()}`;
    const m = w.createMonster(id, x, y, enemyDef);
    m._ftueBandit = true;
    m.hp = 30; m.maxHp = 30; // لص ضعيف — الهدف تعليمي وليس تحدياً
    w.monsters.push(m);
  }

  _spawnSurviveBandits() {
    const w = this.world;
    const enemyDef = ENEMY_TYPES.desert_thief;
    this._surviveMonsterIds = [];
    for (let i = 0; i < SURVIVE_BANDIT_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / SURVIVE_BANDIT_COUNT;
      const x = w.leader.x + Math.cos(angle) * 100;
      const y = w.leader.y + Math.sin(angle) * 100;
      const id = `ftue_survive_${Date.now()}_${i}`;
      const m = w.createMonster(id, x, y, enemyDef);
      m._ftueBandit = true;
      m.hp = 40; m.maxHp = 40;
      w.monsters.push(m);
      this._surviveMonsterIds.push(id);
    }
  }

  _finish() {
    this.step = FTUE_STEPS.DONE;
    this._active = false;
    this._notifyStep();
    if (this._onComplete) this._onComplete();
  }
}

export { FTUE_STEPS };
