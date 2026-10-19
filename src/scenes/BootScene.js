/* =========================================================
 * BootScene.js —— 启动场景（启动 + 预加载 合并成一个）
 * ---------------------------------------------------------
 * 它做两件事：
 *   1) 用代码"画"出游戏要用的占位图（彩色方块 / 圆形 / 菱形）
 *   2) 显示一句"加载中…"，然后跳到主菜单
 *
 * 以后你要换成真正的像素素材时，只需要在 preload() 里
 * 加上 this.load.image(...) 那几行，其它代码一行都不用改。
 * ========================================================= */

class BootScene extends Phaser.Scene {

  constructor() {
    super('BootScene'); // 场景的名字，后面用 this.scene.start('BootScene') 来跳转
  }

  preload() {
    // ---- 进度条（现在没有外部素材，所以它是瞬间跑完的）----
    // 以后加了图片素材，这条进度条就会自动动起来
    const barWidth = 420;
    const barX = (CFG.width - barWidth) / 2;
    const barY = CFG.height / 2;

    this.add.text(CFG.width / 2, barY - 44, '加载中…', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#c8d2e0'
    }).setOrigin(0.5);

    this.add.rectangle(barX, barY, barWidth, 18, 0x1b2233).setOrigin(0);
    const bar = this.add.rectangle(barX, barY, 0, 18, 0x2f6fed).setOrigin(0);

    // 每当加载进度变化，就把蓝条拉长
    this.load.on('progress', (v) => { bar.width = barWidth * v; });

    // ★★★ 换素材的地方：把图片放进 assets/ 目录，然后打开下面的注释 ★★★
    // this.load.image('tex-player',  'assets/player.png');
    // this.load.image('tex-monster', 'assets/monster.png');
    // this.load.image('tex-boss',    'assets/boss.png');
    // this.load.image('tex-item',    'assets/item.png');
  }

  create() {
    this.makePlaceholderTextures();

    // 稍微停 0.4 秒再进菜单，让玩家看清"启动页"，也方便你以后插素材
    this.time.delayedCall(400, () => {
      this.scene.start('MenuScene');
    });
  }

  /**
   * 用 Graphics（画笔）画出四个占位图，并"烤"成纹理
   * 好处：完全不需要图片文件，双击 index.html 就能跑
   * 注意：除了主角，其它纹理都画成白色，这样运行时可以用 tint 染色
   */
  makePlaceholderTextures() {
    const g = this.add.graphics(); // 一支临时画笔

    // 1) 主角：蓝色圆角方块 + 两只眼睛
    g.fillStyle(0x4da3ff, 1);
    g.fillRoundedRect(0, 0, 34, 34, 8);
    g.fillStyle(0x0b2440, 1);
    g.fillRect(9, 13, 5, 8);   // 左眼
    g.fillRect(20, 13, 5, 8);  // 右眼
    g.generateTexture('tex-player', 34, 34);
    g.clear();

    // 2) 小怪：白色圆形（运行时染成红=危险 / 绿=能吃）
    g.fillStyle(0xffffff, 1);
    g.fillCircle(15, 15, 15);
    g.generateTexture('tex-monster', 30, 30);
    g.clear();

    // 3) BOSS：白色大方块（运行时染成紫=能打 / 灰=打不过）
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, 68, 68, 12);
    g.generateTexture('tex-boss', 68, 68);
    g.clear();

    // 4) 道具：白色菱形（运行时染成金色）
    g.fillStyle(0xffffff, 1);
    g.fillPoints([
      { x: 12, y: 0 },
      { x: 24, y: 12 },
      { x: 12, y: 24 },
      { x: 0, y: 12 }
    ], true);
    g.generateTexture('tex-item', 24, 24);

    // 画笔用完就销毁，不然它会一直留在画面上
    g.destroy();
  }
}
