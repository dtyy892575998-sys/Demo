/* =========================================================
 * ResultScene.js —— 结算场景
 * ---------------------------------------------------------
 * 显示：通关成功 / 第 X 关失败、最终战力、本局用时、历史最佳
 * 按钮：重试本关 / 从第一关重来 / 返回主菜单
 * ========================================================= */

class ResultScene extends Phaser.Scene {

  constructor() {
    super('ResultScene');
  }

  /**
   * 接收 GameScene 传过来的本局结果
   * { win, level, power, time, elapsedBefore }
   * 注意：不要写成 this.data，那是 Phaser 的保留属性
   */
  init(data) {
    const d = data || {};
    this.result = {
      win: !!d.win,
      level: d.level || 1,
      power: d.power || CFG.player.startPower,
      time: d.time || 0,
      elapsedBefore: d.elapsedBefore || 0
    };
  }

  create() {
    const r = this.result;

    // 背景
    this.add.rectangle(0, 0, CFG.width, CFG.height, CFG.color.bg).setOrigin(0);

    // ---------- 大标题 ----------
    this.add.text(CFG.width / 2, 96, r.win ? '全部通关！' : `第 ${r.level} 关 失败`, {
      fontFamily: 'sans-serif',
      fontSize: '56px',
      color: r.win ? '#66e08a' : '#ff6b6b',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 8
    }).setOrigin(0.5);

    // ---------- 本局数据 ----------
    const lines = [
      `到达关卡：第 ${r.level} 关 / 共 ${CFG.levels.length} 关`,
      `最终战力：${r.power}`,
      `本局用时：${r.time} 秒`
    ];
    lines.forEach((text, i) => {
      this.add.text(CFG.width / 2, 190 + i * 40, text, {
        fontFamily: 'sans-serif',
        fontSize: '22px',
        color: '#c8d2e0'
      }).setOrigin(0.5);
    });

    // ---------- 历史最佳（顺手判断要不要刷新纪录）----------
    const record = { win: r.win, level: r.level, power: r.power, time: r.time };
    const prev = Save.load();
    let isNewRecord = false;

    if (Save.isBetter(record, prev)) {
      Save.save(record);
      isNewRecord = true;
    }
    const best = isNewRecord ? record : prev;

    this.add.text(CFG.width / 2, 336, '历史最佳：' + Save.describe(best), {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#ffd24d'
    }).setOrigin(0.5);

    if (isNewRecord) {
      this.add.text(CFG.width / 2, 372, '★ 新纪录 ★', {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: '#ffd24d',
        fontStyle: 'bold'
      }).setOrigin(0.5);
    }

    // ---------- 按钮 ----------
    if (r.win) {
      Utils.button(this, CFG.width / 2 - 130, 480, '再玩一次', () => this.retryAll());
      Utils.button(this, CFG.width / 2 + 130, 480, '返回主菜单', () => this.goMenu());
    } else {
      Utils.button(this, CFG.width / 2 - 260, 480, '重试本关', () => this.retryLevel());
      Utils.button(this, CFG.width / 2, 480, '从第一关重来', () => this.retryAll());
      Utils.button(this, CFG.width / 2 + 260, 480, '返回主菜单', () => this.goMenu());
    }

    // 一句小提示，避免玩家以为"重试本关"会保留战力
    this.add.text(CFG.width / 2, 556, '提示：每次重来，战力都会重置为 ' + CFG.player.startPower, {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#7d8aa5'
    }).setOrigin(0.5);
  }

  // 重试本关：关卡不变，用时回退到"进本关之前"
  retryLevel() {
    this.scene.start('GameScene', {
      levelIndex: this.result.level - 1,
      elapsedBefore: this.result.elapsedBefore
    });
  }

  // 从第一关重来：关卡和计时全部归零
  retryAll() {
    this.scene.start('GameScene', { levelIndex: 0, elapsedBefore: 0 });
  }

  // 回主菜单
  goMenu() {
    this.scene.start('MenuScene');
  }
}
