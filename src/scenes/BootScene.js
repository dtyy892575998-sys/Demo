/* =========================================================
 * BootScene.js —— 启动场景（启动 + 预加载 合并成一个）
 * ---------------------------------------------------------
 * 它做三件事：
 *   1) 用代码"画"出草地 / 道路 / 终点的瓦片，以及金色道具
 *   2) 用"像素画"拼出主角和各关的怪物、BOSS
 *   3) 显示一句"加载中…"，然后跳到主菜单
 *
 * 为什么要用代码画、不用图片文件？
 *   因为这样双击 index.html 就能直接跑，不需要任何素材文件。
 *
 * 像素画是怎么"画"出来的？
 *   每个角色都写成一个 16 行 x 16 列的"字符格子画"（见 PIXEL_ART），
 *   每个字符代表一种颜色（查 PIXEL_PALETTE 表，'.' 表示透明），
 *   然后用 fillRect 把一个字符放大成 px x px 的小方块画上去，
 *   最后 generateTexture 把画好的内容"烤"成一张能反复使用的纹理。
 *
 * ★ 以后想换成真正的像素图片：把图片放进 assets/ 目录，
 *   打开 preload() 里对应的 this.load.image(...) 注释即可，
 *   纹理名字保持一致，其它代码一行都不用改。
 * ========================================================= */

// ---------------------------------------------------------
// 1. 像素画调色板：字符 → 颜色（0x 开头是十六进制色号）
//    '.' 表示透明（跳过不画），其它字符查这张表拿颜色
// ---------------------------------------------------------
const PIXEL_PALETTE = {
  '.': null,
  k: 0x14141f, // 黑（描边）
  d: 0x2b2b3a, // 深灰（嘴巴、阴影）
  w: 0xffffff, // 白（高光、尖牙）
  s: 0xf7c99b, // 浅肤色（勇者）
  h: 0xf2c84e, // 金发（勇者）
  b: 0x4d84e8, // 蓝（勇者衣服）
  B: 0x2b56a8, // 深蓝（勇者裤子）
  n: 0x7a5230, // 棕（靴子、哥布林的皮甲）
  N: 0x4a2f19, // 深棕（鞋底、腰带）
  r: 0xe0463c, // 红（眼睛）
  g: 0x63c74d, // 绿（史莱姆身体、哥布林皮肤）
  G: 0x2f8f34, // 深绿（阴影、哥布林的腰布）
  a: 0xb9c2cf, // 浅灰（岩石高光）
  A: 0x757f8c, // 灰（岩石中间色）
  z: 0x4a525e, // 深灰（岩石暗部）
  o: 0xffb43c, // 橙（岩石发光的眼睛）
  p: 0x9d6bff, // 浅紫（魅魔头发、翅膀）
  P: 0x5f2ab3, // 深紫（魅魔裙子、靴子）
  e: 0xff9ec4, // 粉（魅魔犄角、裙摆）
  q: 0xffd3e3 // 浅粉（魅魔皮肤）
};

// ---------------------------------------------------------
// 2. 像素画素材：每个角色 16 行，每行必须正好 16 个字符
// ---------------------------------------------------------

// 勇者：金发 + 蓝衣 + 棕靴
const ART_HERO = [
  '.....kkkkkk.....',
  '...kkhhhhhhkk...',
  '..khhhhhhhhhhk..',
  '..khhhhhhhhhhk..',
  '..khsssssssshk..',
  '..khsksssskshk..',
  '..khsssssssshk..',
  '..khsssssssshk..',
  '..khssskkssshk..',
  '...kbbbbbbbbk...',
  '..skbbbbbbbbks..',
  '..skbbbbbbbbks..',
  '...kNNNNNNNNk...',
  '...kbbbbbbbbk...',
  '...kBBk..kBBk...',
  '...knnk..knnk...'
];

// 史莱姆（第 1 关的小怪）：绿色果冻怪，两只大眼睛
const ART_SLIME = [
  '................',
  '................',
  '................',
  '.....kkkkkk.....',
  '...kkggggggkk...',
  '..kgwwgggggggk..',
  '..kgkkgggkkggk..',
  '..kgkwgggkwggk..',
  '..kggggkkggggk..',
  '..kggggggggggk..',
  '..kggggggggggk..',
  '..kgGGGGGGGGGk..',
  '...kkkkkkkkkk...',
  '................',
  '................',
  '................'
];

// 哥布林（第 1 关 BOSS / 第 2 关小怪）：绿皮 + 尖耳朵 + 红眼 + 皮甲
const ART_GOBLIN = [
  '................',
  '...kkkkkkkkkk...',
  '..kggggggggggk..',
  '.gkggggggggggkg.',
  'ggkggrrggrrggkgg',
  'ggkggggggggggkgg',
  'ggkggggggggggkgg',
  '.gkggwggggwggkg.',
  '..kggkkkkkkggk..',
  '...knnnnnnnnk...',
  '..gknnnnnnnnkg..',
  '..gknnnnnnnnkg..',
  '...knnnnnnnnk...',
  '...kGGGGGGGGk...',
  '...kggk..kggk...',
  '...kNNk..kNNk...'
];

// 岩石怪物（第 2 关 BOSS / 第 3 关小怪）：灰色石头 + 两只发光的眼睛
const ART_ROCK = [
  '................',
  '................',
  '................',
  '...kkkkkkkkkk...',
  '..kaaaaaaaaaak..',
  '..kaaooaaooaak..',
  '..kaaooaaooaak..',
  '..kaaaaaaaaaak..',
  '..kaazaaaazaak..',
  '..kAAAAAAAAAAk..',
  '..kzzzzzzzzzzk..',
  '..kzzzzzzzzzzk..',
  '...kkkkkkkkkk...',
  '................',
  '................',
  '................'
];

// 魅魔（第 3 关 BOSS）：紫发 + 粉脸 + 犄角 + 蝙蝠翅膀 + 紫裙
const ART_SUCCUBUS = [
  '................',
  '..kk........kk..',
  '..keek....keek..',
  '...kppppppppk...',
  '..kppppppppppk..',
  '..kppqqqqqqppk..',
  '..kpprrqqrrppk..',
  '..kppqqqqqqppk..',
  '..kpppqkkqpppk..',
  '....kPPPPPPk....',
  '...kPPPPPPPPk...',
  'ppkPPPPPPPPPPkpp',
  'ppkPPPPPPPPPPkpp',
  '..keeeeeeeeeek..',
  '...kqqk..kqqk...',
  '...kPPk..kPPk...'
];

class BootScene extends Phaser.Scene {

  constructor() {
    super('BootScene');
  }

  preload() {
    // ---- 进度条（现在没有外部素材，所以它是瞬间跑完的）----
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
    // this.load.image('tex-tiles',        'assets/tiles.png');      // 64x64 瓦片图集（草地/路/终点）
    // this.load.image('tex-player',       'assets/hero.png');       // 勇者
    // this.load.image('tex-slime',        'assets/slime.png');      // 史莱姆
    // this.load.image('tex-goblin',       'assets/goblin.png');     // 哥布林
    // this.load.image('tex-rock',         'assets/rock.png');       // 岩石怪物
    // this.load.image('tex-succubus',     'assets/succubus.png');   // 魅魔
    // this.load.image('tex-boss-goblin',  'assets/goblin.png');
    // this.load.image('tex-boss-rock',    'assets/rock.png');
    // this.load.image('tex-boss-succubus','assets/succubus.png');
    // this.load.image('tex-item',         'assets/item.png');       // 道具
  }

  create() {
    this.makeTileTextures();      // 草地 / 道路 / 终点 + 道具
    this.makeCharacterTextures(); // 主角 + 怪物 + BOSS

    // 稍微停 0.4 秒再进菜单，让玩家看清"启动页"
    this.time.delayedCall(400, () => {
      this.scene.start('MenuScene');
    });
  }

  /**
   * 用 Graphics（画笔）画出草地 / 道路 / 终点的瓦片图集
   * 瓦片图集：一张 192x64 的长条，横向排 3 个 64x64 的格子
   *   第 0 张（x=0）   = 草地（走不进去的墙）
   *   第 1 张（x=64）  = 道路
   *   第 2 张（x=128） = 终点
   * 顺序不能改！GameScene 里就是用 0/1/2 来引用它们的
   */
  makeTileTextures() {
    const g = this.add.graphics();
    const size = CFG.tileSize; // 一个格子 64 像素

    // ---- 草地：绿色底 + 撒点小杂草 ----
    g.fillStyle(0x2f7a3a, 1);
    g.fillRect(0, 0, size, size);
    g.fillStyle(0x3f9c4b, 1);
    for (let i = 0; i < 46; i++) {
      g.fillRect(Phaser.Math.Between(3, size - 5), Phaser.Math.Between(3, size - 5), 3, 3);
    }

    // ---- 道路：土黄底 + 撒点小石子 ----
    g.fillStyle(0x8a6b3f, 1);
    g.fillRect(size, 0, size, size);
    g.fillStyle(0x9c7c4a, 1);
    for (let i = 0; i < 46; i++) {
      g.fillRect(size + Phaser.Math.Between(3, size - 5), Phaser.Math.Between(3, size - 5), 3, 3);
    }

    // ---- 终点：金色底 + 白色方框，远远就能看见 ----
    g.fillStyle(0xd9a62b, 1);
    g.fillRect(size * 2, 0, size, size);
    g.lineStyle(4, 0xffffff, 0.85);
    g.strokeRect(size * 2 + 6, 6, size - 12, size - 12);

    g.generateTexture('tex-tiles', size * 3, size);
    g.destroy();
  }

  /**
   * 用"像素画"拼出主角、怪物、BOSS
   *   - 普通角色：每个像素画成 2x2 的小块 → 16x16 的格子画变成 32x32 的贴图
   *   - BOSS：每个像素画成 3x3 的小块 → 变成 48x48，看上去更大更凶
   */
  makeCharacterTextures() {
    // 主角：勇者
    this.bakePixelArt('tex-player', ART_HERO, 2);

    // 三种小怪（各关的普通怪）
    this.bakePixelArt('tex-slime', ART_SLIME, 2);
    this.bakePixelArt('tex-goblin', ART_GOBLIN, 2);
    this.bakePixelArt('tex-rock', ART_ROCK, 2);
    this.bakePixelArt('tex-succubus', ART_SUCCUBUS, 2);

    // BOSS：用同一张格子画，但画得更大
    this.bakePixelArt('tex-boss-goblin', ART_GOBLIN, 3);
    this.bakePixelArt('tex-boss-rock', ART_ROCK, 3);
    this.bakePixelArt('tex-boss-succubus', ART_SUCCUBUS, 3);

    // 金色道具：白色菱形占位图（运行时会被染成金色）
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillPoints([
      { x: 12, y: 0 },
      { x: 24, y: 12 },
      { x: 12, y: 24 },
      { x: 0, y: 12 }
    ], true);
    g.generateTexture('tex-item', 24, 24);
    g.destroy();
  }

  /**
   * 把一张"字符格子画"烤成纹理
   * @param {string} key  纹理名字（其它文件就用这个名字取图）
   * @param {string[]} art 字符格子画（每行等长）
   * @param {number} px   一个字符画成多少像素的正方形
   */
  bakePixelArt(key, art, px) {
    const g = this.add.graphics();

    for (let row = 0; row < art.length; row++) {
      for (let col = 0; col < art[row].length; col++) {
        const color = PIXEL_PALETTE[art[row][col]];
        if (color === undefined || color === null) continue; // 透明格子跳过

        g.fillStyle(color, 1);
        g.fillRect(col * px, row * px, px, px);
      }
    }

    g.generateTexture(key, art[0].length * px, art.length * px);
    g.destroy();
  }
}
