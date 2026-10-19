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

    // 背景（先画好，剧情覆盖层在它上面，播完就藏掉露出这个）
    this.add.rectangle(0, 0, CFG.width, CFG.height, CFG.color.bg).setOrigin(0);

    // ---- 第一次用户交互：resume AudioContext + 启动菜单 BGM ----
    // 浏览器安全策略要求 AudioContext 必须在用户交互（点/按键盘）后才能真正出声。
    // 所以不在 create() 里直接播 BGM，而是"等用户第一次碰键盘/鼠标"时再播。
    const firstInteract = () => {
      AudioUtils.resume();         // 把 AudioContext 从 suspended 状态拉起
      AudioUtils.playBgm('menu');  // 开始菜单 chiptune BGM
    };
    this.input.keyboard.once('keydown', firstInteract);
    this.input.once('pointerdown', firstInteract);

    // ---- 开场剧情覆盖层 ----
    // 深灰遮罩覆盖全画面 + 5 行剧情文字逐行淡入
    // 播完后覆盖层隐藏，露出底下的菜单（标题/规则/按钮都已经创建好了）
    this._storySkipped = false;
    this._storyLayer = this.add.container(0, 0).setDepth(50); // 放在最上层

    // 深灰半透明遮罩
    const veil = this.add.rectangle(0, 0, CFG.width, CFG.height, 0x0a0a14, 0.92).setOrigin(0);
    this._storyLayer.add(veil);

    // "序章" 标题
    const chapterTitle = this.add.text(CFG.width / 2, 120, '～ 序 章 ～', {
      fontFamily: 'sans-serif', fontSize: '36px', color: '#ffd24d', fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0);
    this._storyLayer.add(chapterTitle);

    // 剧情正文：STORY.intro 逐行淡入
    const introLines = STORY.intro;
    const textObjs = introLines.map((line, i) => {
      const y = 210 + i * 48; // 每行 48px 间距
      const t = this.add.text(CFG.width / 2, y, line, {
        fontFamily: 'sans-serif', fontSize: '22px', color: '#e8eaf0'
      }).setOrigin(0.5).setAlpha(0);
      this._storyLayer.add(t);
      return t;
    });

    // "按任意键跳过" 提示（最后出现）
    const skipHint = this.add.text(CFG.width / 2, 560, '（按任意键跳过）', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#6a7385'
    }).setOrigin(0.5).setAlpha(0);
    this._storyLayer.add(skipHint);

    // 逐行淡入 + 自动结束时间线
    this._storyTimers = [];
    const lineDelay = 600;   // 每行之间的间隔（毫秒）
    const fadeTime = 500;    // 每行淡入的动画时长

    // "序章" 标题先淡入
    this.tweens.add({ targets: chapterTitle, alpha: 1, duration: fadeTime, delay: 200 });

    // 剧情正文逐行淡入
    textObjs.forEach((t, i) => {
      this.tweens.add({
        targets: t,
        alpha: 1,
        duration: fadeTime,
        delay: 700 + i * lineDelay
      });
    });

    // "按任意键跳过" 提示最后淡入
    this.tweens.add({ targets: skipHint, alpha: 1, duration: fadeTime, delay: 700 + introLines.length * lineDelay + 300 });

    // 自动结束：剧情全播完后再等 1.2 秒自动隐藏覆盖层
    const autoEndTime = 900 + introLines.length * lineDelay + 1500;
    this.time.delayedCall(autoEndTime, () => {
      if (!this._storySkipped) this.hideStory();
    });

    // 按任意键 / 点击 = 立刻跳过剧情
    const skipStory = () => {
      if (this._storySkipped) return;
      this._storySkipped = true;
      this.hideStory();
    };
    this.input.keyboard.once('keydown', skipStory);
    this.input.once('pointerdown', skipStory);

    // ---- 以下是菜单本体（标题/规则/历史/按钮）----
    // 虽然剧情覆盖层盖在上面，但这些已经在 create 里创建好了，
    // 等 hideStory() 把覆盖层隐藏，它们立刻就露出来了

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

    // ---- 玩法说明（看懂这 7 行就会玩）----
    const rules = [
      '① 你头顶的「战力」就是你的大小，开局是 3',
      '② 沿着道路走：草地走不进去，从起点一路走到终点',
      '③ 撞到战力比你【小】的敌人 → 吃掉它（绿圈就是能吃的），战力加上它的数值',
      '④ 撞到战力比你【大】的敌人 → 立刻死亡（红圈）；数值相等 → 被弹开（白圈），无法通过',
      '⑤ 金色道具不看大小，吃到就直接加战力，它们藏在死路尽头',
      '⑥ 怪物会站在路上挡路，也有一些守在死路的尽头',
      '⑦ 终点守着紫色 BOSS，战力超过它就能撞死它 → 过关'
    ];
    rules.forEach((line, i) => {
      this.add.text(CFG.width / 2, 228 + i * 30, line, {
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

  /** 剧情播完 / 跳过时调用——隐藏覆盖层，露出底下的菜单界面 */
  hideStory() {
    // 覆盖层淡出 300ms，然后销毁
    this.tweens.add({
      targets: this._storyLayer,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        if (this._storyLayer) this._storyLayer.destroy();
      }
    });
  }

  startGame() {
    if (this.started) return; // 已经启动过就不再重复启动
    this.started = true;

    // 切到游戏场景前，把菜单 BGM 淡出，换成战斗 BGM（Battle Scene 里再主动切）
    AudioUtils.stopBgm();

    // 跳到游戏场景：从第 0 关（也就是第 1 关）开始，之前用时为 0
    this.scene.start('GameScene', { levelIndex: 0, elapsedBefore: 0 });
  }
}
