/* =========================================================
 * config.js —— 全局配置 + 地图数据 + 小工具 + 存档
 * ---------------------------------------------------------
 * 这个文件里全是"死数据"和"通用小函数"，一点游戏画面都不涉及。
 * 以后想调难度、改地图、加关卡，99% 的情况只需要改这个文件。
 * ========================================================= */

// ---------------------------------------------------------
// 1. 全局配置对象
// ---------------------------------------------------------
const CFG = {
  // 画布尺寸
  width: 960,
  height: 640,

  // 顶部状态栏（HUD）占的高度，下面才是战场
  playTop: 70,

  // 地图格子大小（像素）。地图宽 15 格、高 8 格 = 960 x 512
  tileSize: 64,
  mapCols: 15,
  mapRows: 8,

  // 主角
  player: {
    startPower: 3, // 每关开始时主角的战力（每关都会重置成 3）
    speed: 220     // 移动速度，单位：像素/秒
  },

  // -----------------------------------------------------
  // 三关的地图（字符画）
  //   '.' = 草地（走不进去，是墙）
  //   '#' = 路（可以走）
  //   'S' = 起点（主角出生在这里）
  //   'B' = 终点（BOSS 站在这里，撞死它 = 过关）
  //   '1'~'9' = 路上或死路尽头的怪物，数字就是它的战力
  //   '*' = 死路尽头的道具，加多少由 itemValues 按出现顺序分配
  //
  // 每一行必须正好 15 个字符、每关必须正好 8 行，否则地图会错位！
  // -----------------------------------------------------
  levels: [
    {
      name: '第 1 关',
      // 第 1 关：一条主路 + 上下四条支路，其中两条是死路（尽头有东西）
      map: [
        '.2.....B.......',
        '.1.....4.......',
        '.1.....4.......',
        '3#1##2#S#3##5#*',
        '...#.......#...',
        '...2.......5...',
        '...*.......3...',
        '...............'
      ],
      itemValues: [3, 2], // 依次分配给地图上出现的 '*'
      boss: 10,           // BOSS 战力
      mob: 'tex-slime',        // 这一关的小怪长什么样（史莱姆）
      bossTex: 'tex-boss-goblin' // 这一关的 BOSS 长什么样（哥布林）
    },
    {
      name: '第 2 关',
      // 第 2 关：上中下三条横路 + 三条竖路，形成多个岔路口
      map: [
        '5###2#######6B.',
        '..1....#....#..',
        '..#....#....#..',
        '.*##4###3#5##2.',
        '..#....#....#..',
        '..2....2....#..',
        '.S#1##2##3####.',
        '.....*.........'
      ],
      itemValues: [5, 3],
      boss: 18,
      mob: 'tex-goblin',         // 这一关的小怪：哥布林
      bossTex: 'tex-boss-rock'   // 这一关的 BOSS：岩石怪物
    },
    {
      name: '第 3 关',
      // 第 3 关：一条横贯全图的主路 + 三条竖路，
      // 三个岔路口各通往上下两条支路，支路尽头藏道具、也埋伏怪物
      map: [
        '..1...3...5....',
        '..#...#...#....',
        '..#...#...#....',
        '2##6##S2#8##97B',
        '..#...#...#....',
        '..#...#...#....',
        '..#...#...#....',
        '..*...4...*....'
      ],
      itemValues: [8, 5],
      boss: 30,
      mob: 'tex-rock',             // 这一关的小怪：岩石怪物
      bossTex: 'tex-boss-succubus' // 这一关的 BOSS：魅魔
    }
  ],

  // 配色表（全部用色号，方便以后换成像素素材）
  color: {
    bg: 0x0b0e14,        // 页面背景
    ground: 0x0a1a10,    // 地图外的底色
    hudBg: 0x000000,     // 顶部状态栏
    danger: 0xff5a5a,    // "吃不了"的怪物颜色（红）
    edible: 0x66e08a,    // "能吃"的怪物颜色（绿）
    equal: 0xffffff,     // "数值和你一样"的怪物颜色（白）：撞上去会被弹开，走不过去
    item: 0xffd24d,      // 道具颜色（金）
    boss: 0x8b5cf6,      // BOSS 颜色（紫）
    bossLocked: 0x5b5b5b,// 打不过时的 BOSS 颜色（灰）
    button: 0x2f6fed,    // 按钮底色
    buttonHover: 0x4a8cff // 按钮悬停色
  }
};

// 地图在画面上的摆放位置（自动算出居中偏下一点点）
CFG.mapOffsetX = (CFG.width - CFG.mapCols * CFG.tileSize) / 2;
CFG.mapOffsetY = CFG.playTop + ((CFG.height - CFG.playTop) - CFG.mapRows * CFG.tileSize) / 2;

// ---------------------------------------------------------
// 2. 小工具函数
// ---------------------------------------------------------
const Utils = {

  /**
   * 把"字符画地图"翻译成程序能用的数据
   * 返回：{
   *   grid:   [ [0,1,0...], ... ]  0=草地(墙) 1=路 2=终点
   *   start:  { col, row }         起点坐标（格子坐标）
   *   spawns: [ {col,row,type,power} ... ]  怪物/道具/BOSS 的位置
   * }
   */
  parseMap(rows) {
    const grid = [];
    const start = { col: 0, row: 0 };
    const spawns = [];

    rows.forEach((line, row) => {
      const lineData = [];
      for (let col = 0; col < line.length; col++) {
        const ch = line[col];

        if (ch === '.') {
          lineData.push(0);                       // 草地 = 墙
        } else if (ch === '#') {
          lineData.push(1);                       // 路
        } else if (ch === 'S') {
          lineData.push(1);
          start.col = col;
          start.row = row;                        // 记录起点
        } else if (ch === 'B') {
          lineData.push(2);                       // 终点
          spawns.push({ col: col, row: row, type: 'boss' });
        } else if (ch === '*') {
          lineData.push(1);
          spawns.push({ col: col, row: row, type: 'item' });
        } else if (ch >= '1' && ch <= '9') {
          lineData.push(1);
          spawns.push({ col: col, row: row, type: 'monster', power: Number(ch) });
        } else {
          lineData.push(0);                       // 其它字符一律当草地
        }
      }
      grid.push(lineData);
    });

    return { grid: grid, start: start, spawns: spawns };
  },

  // 把"格子坐标"换算成"画面像素坐标"（格子中心点）
  cellCenter(col, row) {
    return {
      x: CFG.mapOffsetX + col * CFG.tileSize + CFG.tileSize / 2,
      y: CFG.mapOffsetY + row * CFG.tileSize + CFG.tileSize / 2
    };
  },

  // 把 0xRRGGBB 色号转成 CSS 能用的 '#rrggbb' 字符串（给文字上色用）
  hex(n) {
    return '#' + n.toString(16).padStart(6, '0');
  },

  /**
   * 创建一个圆角按钮
   * @param {Phaser.Scene} scene 在哪个场景里创建
   * @param {number} x,y        按钮中心坐标
   * @param {string} text       按钮上的文字
   * @param {Function} onClick  点击后执行的函数
   * @param {number} width,height 按钮尺寸
   */
  button(scene, x, y, text, onClick, width = 240, height = 64) {
    const rect = scene.add.rectangle(x, y, width, height, CFG.color.button)
      .setStrokeStyle(2, 0xffffff, 0.7)
      .setInteractive({ useHandCursor: true });

    const label = scene.add.text(x, y, text, {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    rect.on('pointerover', () => rect.setFillStyle(CFG.color.buttonHover));
    rect.on('pointerout', () => rect.setFillStyle(CFG.color.button));
    rect.on('pointerdown', () => { if (onClick) onClick(); });

    return { rect: rect, label: label };
  },

  // 飘字效果：吐出一段文字，一边往上飘一边淡出
  floatText(scene, x, y, str, color = '#ffffff') {
    const t = scene.add.text(x, y, str, {
      fontFamily: 'sans-serif',
      fontSize: '24px',
      color: color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    scene.tweens.add({
      targets: t,
      y: y - 46,
      alpha: 0,
      duration: 700,
      onComplete: () => t.destroy()
    });
  }
};

// ---------------------------------------------------------
// 3. 本地存档（用浏览器自带的 localStorage 记住历史最佳）
// ---------------------------------------------------------
const Save = {
  KEY: 'number-eater-best-v2',

  load() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || null;
    } catch (e) {
      // 某些浏览器在 file:// 下会禁止读写 localStorage，静默失败即可
      return null;
    }
  },

  save(rec) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(rec));
    } catch (e) {
      /* 存不了就不存，不影响游戏 */
    }
  },

  // 新成绩 a 是否比旧成绩 b 更好：通关优先 → 关数 → 战力 → 用时短
  isBetter(a, b) {
    if (!b) return true;
    if (a.win !== b.win) return a.win === true;
    if (a.level !== b.level) return a.level > b.level;
    if (a.power !== b.power) return a.power > b.power;
    return a.time < b.time;
  },

  // 把一条成绩变成一句人话
  describe(rec) {
    if (!rec) return '暂无记录';
    const head = rec.win ? '通关成功' : `到第 ${rec.level} 关`;
    return `${head} · 战力 ${rec.power} · 用时 ${rec.time}s`;
  }
};
