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
  q: 0xffd3e3, // 浅粉（魅魔皮肤）
  // ---- 6 种武器道具专用颜色 ----
  m: 0xc9cdd3, // 金属银（剑刃、箭头、玻璃高光、宝石高光）
  F: 0xb08a5a, // 青铜色（鼎身、剑柄装饰）
  x: 0xf5e6b0, // 卷轴纸色（泛黄的古卷纸）
  u: 0xd4af37, // 真金色（护符外框、剑护手、卷轴装饰边）
  i: 0x4aa34a, // 深青绿（药瓶里的神秘液体）
  v: 0x9966cc  // 紫色宝石（护符中心的魔晶）
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

// ---- 以下 6 种是武器/道具图案，每种 16×16 字符画 ----

// 剑（sword）：垂直长剑，剑尖朝上。银色剑身、金色护手、木质剑柄
const ART_SWORD = [
  '................',
  '.......kmk......',
  '......kmmmk.....',
  '......kmmmk.....',
  '......kmmmk.....',
  '......kmmmk.....',
  '......kmmmk.....',
  '......kmmmk.....',
  '......kmmmk.....',
  '......kmmmk.....',
  '.....kmmmmmk....',
  '....kuuuuuuuuk..',
  '.....kmmmmk.....',
  '......knnnk.....',
  '......knnnk.....',
  '......kFFFk.....'
];

// 弓（bow）：C 形弓身朝右开口，中间穿过一支银箭头的箭
const ART_BOW = [
  '................',
  '......kk........',
  '.....knnk.......',
  '....knNNnk......',
  '...knNNNNnk.....',
  '...kNmmmmmmmm...',
  '...kNwwwwwwww...',
  '...kNwwwwwwww...',
  '...kNwwwwwwww...',
  '...kNwwwwwwww...',
  '...kNwwwwwwww...',
  '...kNwwwwwwww...',
  '....knNNnk......',
  '.....knnk.......',
  '......kk........',
  '................'
];

// 鼎（ding）：古代方形青铜鼎，左右两只耳、四条腿、鼎内有深色
const ART_DING = [
  '................',
  '..kFk......kFk..',
  '..kFkkkkkkkFk...',
  '.kFFFFFFFFFFFk..',
  '.kFdddddddFFk...',
  '.kFdddddddFFk...',
  '.kFdddddddFFk...',
  '.kFFFFFFFFFFFk..',
  '.kFFFFFFFFFFFk..',
  '.kuuuuuuuuuuuk..',
  '.kFFFFFFFFFFFk..',
  '.kFkkkkkkkkFk...',
  '.kkkkkkkkkkkkk..',
  '.kk........kk...',
  '.kk........kk...',
  '.kk........kk...'
];

// 卷轴（scroll）：横向放置的古卷轴，两端深棕色轴，泛黄纸身写有深色字
const ART_SCROLL = [
  '................',
  '................',
  '................',
  '................',
  '..kNNuuuuuuNNk..',
  '..kNxxxxxxxxNNk.',
  '..kNxdxxdxdxNNk.',
  '..kNxddddddxNNk.',
  '..kNxdxxdxdxNNk.',
  '..kNxxxxxxxxNNk.',
  '..kNNuuuuuuNNk..',
  '................',
  '................',
  '................',
  '................',
  '................'
];

// 药瓶（potion）：玻璃瓶 + 绿色神秘液体 + 软木塞，有气泡和高光
const ART_POTION = [
  '................',
  '......kkk.......',
  '.....kuuuuk.....',
  '.....kuuuuk.....',
  '......kNk.......',
  '......kmk.......',
  '.....kiiiiik....',
  '....kiiiwwiiik..',
  '....kiwwwwwwik..',
  '....kiiiiiiiiiik',
  '....kiiiiiiiiiik',
  '....kiiiiiiiiiik',
  '....kiiiiiiiiiik',
  '.....kkkkkkk....',
  '......kkk.......',
  '................'
];

// 护符（amulet）：圆形金色外框吊坠 + 中心紫色魔晶 + 深棕挂绳
const ART_AMULET = [
  '......NkNk......',
  '......kNk.......',
  '......NkNk......',
  '.....kNNNNNk....',
  '....kuuuuuuuuk..',
  '...kuvvvvvvvvuk.',
  '...kuvvwmwvvwuk.',
  '...kuvvvvvvvvuk.',
  '...kuvvvvvvvvuk.',
  '...kuvvvvvvvvuk.',
  '....kuuuuuuuuk..',
  '.....kNNNNNk....',
  '................',
  '................',
  '................',
  '................'
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
   * 用 Graphics（画笔）画出草地 / 道路 / 终点的"瓦片图集"
   * 瓦片图集：一张很长的横条，每 64 像素一张瓦片，编号从左到右 0、1、2、3……
   *   编号 0~3   = 4 种草地变体（稍微不同的绿色和草叶分布，走不进去的墙）
   *   编号 4~7   = 4 种"四面都是路"时用的纯路面
   *   编号 8~23  = 16 张"带路缘"的路面（哪一侧挨着草地，哪一侧就画一道深深的马路牙子）
   *   编号 24    = 终点
   *
   * 为什么要搞这么多张？
   *   如果整张地图只用 1 张草地 + 1 张道路，120 个格子就会长得一模一样，
   *   一眼就看得出"同一块方块反复贴"，很廉价。
   *   现在：草地随机换变体、道路自动按"四邻"决定要不要画路缘，
   *   路和草地的衔接就自然多了（而且相邻的格子不会因为随机而闪动，因为纹理只生成一次）。
   *
   * ★ 编号顺序由 config.js 的 CFG.tiles 决定，两边共用一张表，不会对不上。
   */
  makeTileTextures() {
    const g = this.add.graphics();
    const size = CFG.tileSize;

    // ---- 1) 草地变体：深浅略微不同的 4 种绿 ----
    const grassTones = [0x2f7a3a, 0x337f40, 0x2b7536, 0x3a8845];
    CFG.tiles.grass.forEach((idx, i) => {
      this.drawGrassTile(g, idx * size, grassTones[i % grassTones.length], i);
    });

    // ---- 2) 纯路面变体：四面都是路时随机挑一张 ----
    const roadTones = [0x8a6b3f, 0x8f7043, 0x85663b, 0x94764a];
    CFG.tiles.road.forEach((idx, i) => {
      // 掩码 15 = 四面都挨着路 → 不画路缘，就是一张纯路面
      this.drawRoadTile(g, idx * size, roadTones[i % roadTones.length], 15, i);
    });

    // ---- 3) 16 张带路缘的路面：编号 = curbStart + 掩码(0~15) ----
    for (let mask = 0; mask < 16; mask++) {
      this.drawRoadTile(
        g,
        (CFG.tiles.curbStart + mask) * size,
        roadTones[mask % roadTones.length],
        mask,
        mask
      );
    }

    // ---- 4) 终点格 ----
    this.drawGoalTile(g, CFG.tiles.goal * size);

    // 整张图集的宽度 = (最后一号瓦片 + 1) * 64
    g.generateTexture('tex-tiles', (CFG.tiles.goal + 1) * size, size);
    g.destroy();
  }

  /**
   * 画一张草地瓦片
   * @param {Phaser.GameObjects.Graphics} g 画笔
   * @param {number} x0 这张瓦片在图集里的起始 x
   * @param {number} tone 底色（不同的绿）
   * @param {number} seed 变体编号（0~3）：用它算出不同的斑块/草叶位置
   */
  drawGrassTile(g, x0, tone, seed) {
    const size = CFG.tileSize;

    // 底色
    g.fillStyle(tone, 1);
    g.fillRect(x0, 0, size, size);

    // 深色斑块（像草地上的一小片阴影/杂草）
    g.fillStyle(0x26672e, 0.6);
    for (let i = 0; i < 3; i++) {
      const px = (seed * 17 + i * 23) % (size - 20);
      const py = (seed * 11 + i * 31) % (size - 16);
      g.fillRect(x0 + px, py, 16, 12);
    }

    // 亮色小草叶（用"假装随机"的算式定位，保证每次生成都在同一处，不会闪）
    g.fillStyle(0x4cae5a, 1);
    for (let i = 0; i < 18 + seed * 4; i++) {
      const px = (i * 37 + seed * 19) % (size - 4);
      const py = (i * 53 + seed * 29) % (size - 8);
      g.fillRect(x0 + px, py, 3, 6); // 竖着的小草叶
    }
    for (let i = 0; i < 10; i++) {
      const px = (i * 43 + seed * 13) % (size - 3);
      const py = (i * 61 + seed * 41) % (size - 3);
      g.fillRect(x0 + px, py, 3, 3); // 零星的小点
    }
  }

  /**
   * 画一张道路瓦片
   * @param {number} mask 四邻掩码：某一位是 1 表示"那一面也是路"、不用画路缘
   *                      +1=东(右)  +2=南(下)  +4=西(左)  +8=北(上)
   * @param {number} seed 变体编号：用来让石子分布不一样
   */
  drawRoadTile(g, x0, tone, mask, seed) {
    const size = CFG.tileSize;

    // 土色底
    g.fillStyle(tone, 1);
    g.fillRect(x0, 0, size, size);

    // 浅色小石子
    g.fillStyle(0xa3855a, 1);
    for (let i = 0; i < 16; i++) {
      const px = (i * 41 + seed * 23) % (size - 6);
      const py = (i * 59 + seed * 17) % (size - 6);
      g.fillRect(x0 + px, py, 4, 3);
    }
    // 深色小坑洼
    g.fillStyle(0x6f5430, 1);
    for (let i = 0; i < 10; i++) {
      const px = (i * 29 + seed * 11) % (size - 5);
      const py = (i * 47 + seed * 37) % (size - 5);
      g.fillRect(x0 + px, py, 3, 3);
    }

    // ---- 路缘（马路牙子）：只在"挨着草地"的那一侧画 ----
    const w = 7;            // 路缘宽度
    const curbColor = 0x5b472a; // 路缘本体
    const edgeColor = 0x3a2c18; // 最外圈更深的一条线

    if (!(mask & 1)) { // 东边是草地 → 在右边缘画
      g.fillStyle(curbColor, 1);
      g.fillRect(x0 + size - w, 0, w, size);
      g.fillStyle(edgeColor, 1);
      g.fillRect(x0 + size - 2, 0, 2, size);
    }
    if (!(mask & 2)) { // 南边是草地 → 在下边缘画
      g.fillStyle(curbColor, 1);
      g.fillRect(x0, size - w, size, w);
      g.fillStyle(edgeColor, 1);
      g.fillRect(x0, size - 2, size, 2);
    }
    if (!(mask & 4)) { // 西边是草地 → 在左边缘画
      g.fillStyle(curbColor, 1);
      g.fillRect(x0, 0, w, size);
      g.fillStyle(edgeColor, 1);
      g.fillRect(x0, 0, 2, size);
    }
    if (!(mask & 8)) { // 北边是草地 → 在上边缘画
      g.fillStyle(curbColor, 1);
      g.fillRect(x0, 0, size, w);
      g.fillStyle(edgeColor, 1);
      g.fillRect(x0, 0, size, 2);
    }
  }

  // 画一张终点瓦片：金光闪闪的台子，一眼就能认出"这是终点"
  drawGoalTile(g, x0) {
    const size = CFG.tileSize;

    g.fillStyle(0xd9a62b, 1);
    g.fillRect(x0, 0, size, size);

    // 中间亮一点，显得有厚度
    g.fillStyle(0xf0c24a, 1);
    g.fillRect(x0 + 7, 7, size - 14, size - 14);

    // 白色方框
    g.lineStyle(4, 0xffffff, 0.9);
    g.strokeRect(x0 + 10, 10, size - 20, size - 20);
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

    // ---- 6 种不同图案的道具（武器/法器）----
    // 统一命名为 'tex-item-xxx'，GameScene 按 config.js 里的 itemTextures 数组取对应图案
    // 像素大小用 px=1.5（16×1.5=24 像素），比角色小一号，正好适合摆在道路格子里
    this.bakePixelArt('tex-item-sword', ART_SWORD, 1.5);  // 剑：银色剑身 + 金色护手
    this.bakePixelArt('tex-item-bow', ART_BOW, 1.5);      // 弓：C 形弓身 + 穿过的箭
    this.bakePixelArt('tex-item-ding', ART_DING, 1.5);    // 鼎：青铜方鼎 + 双耳四足
    this.bakePixelArt('tex-item-scroll', ART_SCROLL, 1.5); // 卷轴：古卷 + 深棕轴 + 上面有字
    this.bakePixelArt('tex-item-potion', ART_POTION, 1.5); // 药瓶：玻璃瓶 + 绿色液体 + 气泡
    this.bakePixelArt('tex-item-amulet', ART_AMULET, 1.5); // 护符：金框 + 紫色魔晶 + 挂绳

    // 箭投射物纹理：用 Graphics 画一支向右的箭（28×8 像素）
    // 放在这里一次性生成，避免 Projectile 每发射一支箭就 regenerate 一次（key 冲突报错）
    const arrow = this.add.graphics();
    // 深灰箭身（水平线）
    arrow.lineStyle(3, 0x3a3a3a, 1);
    arrow.beginPath();
    arrow.moveTo(2, 4);
    arrow.lineTo(20, 4);
    arrow.strokePath();
    // 银色箭头（三角形）
    arrow.fillStyle(0xc9cdd3, 1);
    arrow.fillTriangle(24, 4, 18, 0, 18, 8);
    // 棕色尾羽
    arrow.fillStyle(0x8b5a2b, 1);
    arrow.fillTriangle(2, 4, 0, 0, 6, 3);
    arrow.fillTriangle(2, 4, 0, 8, 6, 5);
    arrow.generateTexture('tex-arrow-proj', 28, 8);
    arrow.destroy();
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
