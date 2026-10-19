/* =========================================================
 * MenuScene.js —— 主菜单
 * ---------------------------------------------------------
 * 显示：游戏标题、规则说明、历史最佳、开始按钮
 * ========================================================= */

class MenuScene extends Phaser.Scene {

  constructor() {
    super('MenuScene');
  }

  create() {
    this.started = false; // 防止"点按钮 + 按空格"同时触发两次开始

    // 背景
    this.add.rectangle(0, 0, CFG.width, CFG.height, CFG.color.bg).setOrigin(0);

    // ---- 标题 ----
    this.add.text(CFG.width / 2, 118, '数值吞噬', {
      fontFamily: 'sans-serif',
      fontSize: '72px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#2f6fed',
      strokeThickness: 10
    }).setOrigin(0.5);

    this.add.text(CFG.width / 2, 176, '三 关 挑 战', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#8be9fd'
    }).setOrigin(0.5);

    // ---- 玩法说明（看懂这 5 行就会玩）----
    const rules = [
      '① 主角头顶写着「战力」，开局是 3',
      '② 撞到战力比你【小】的敌人 → 吃掉它，战力加上它的数值',
      '③ 撞到战力比你【大】的敌人 → 立刻死亡，本局结束',
      '④ 金色道具不看大小，吃到就直接加战力',
      '⑤ 每关有一只紫色 BOSS，战力超过它就能撞死它 → 过关'
    ];
    rules.forEach((line, i) => {
      this.add.text(CFG.width / 2, 240 + i * 34, line, {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#c8d2e0'
      }).setOrigin(0.5);
    });

    // ---- 历史最佳（从本地存档里读）----
    this.add.text(CFG.width / 2, 448, '历史最佳：' + Save.describe(Save.load()), {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#ffd24d'
    }).setOrigin(0.5);

    // ---- 开始按钮 ----
    Utils.button(this, CFG.width / 2, 530, '开始游戏', () => this.startGame());

    // 顺手支持键盘：空格或回车也能开始
    this.input.keyboard.once('keydown-SPACE', () => this.startGame());
    this.input.keyboard.once('keydown-ENTER', () => this.startGame());
  }

  startGame() {
    if (this.started) return; // 已经启动过就不再重复启动
    this.started = true;

    // 跳到游戏场景：从第 0 关（也就是第 1 关）开始，之前用时为 0
    this.scene.start('GameScene', { levelIndex: 0, elapsedBefore: 0 });
  }
}
