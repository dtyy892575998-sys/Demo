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
  //   '1'~'9' = 路上或死路尽头的怪物，数字就是它的战力（1~9）
  //   'a'~'z' = 更大的怪物，字母就是它的战力（'a'=10, 'b'=11 … 'z'=35）
  //             后两关用字母来表达 BOSS 和"现在打不过、变强后再回来"的大怪
  //   '*' = 死路尽头的道具，加多少由 itemValues 按出现顺序分配
  //
  // 每一行必须正好 15 个字符、每关必须正好 8 行，否则地图会错位！
  //
  // 【难度设计思路】每关都是"主路 + 岔路口"：
  //   · 主路上一串怪战力严格递增（吃掉前一个就够打后一个），
  //     保证主角"只走主路"就能走完所有路、但会比 BOSS 少几个点战力。
  //   · 岔路口给玩家做选择：两条支路都"现在就能走"，
  //     但一条收益多、一条收益少（或藏了小陷阱），选对一条就能补够 BOSS 的战力，
  //     选了那条赚得少的就会卡在 BOSS 前面白圈过不去。
  //   · 不要求你把所有支路都绕一遍——想省时间就选"好支路"，
  //     想多赚点也可以把不好的那条也吃了（反正只是绕点路）。
  // -----------------------------------------------------
  levels: [
    {
      name: '第 1 关',
      // 第 1 关：主路 + 2 个岔路口（上/下各有支路）
      //   主路战力链：2 → 4 → 7 → a(10)（吃满 26），BOSS 34 差 8
      //   岔路口 1：上=怪4(+4) / 下=怪3(+3) —— 两条都好走
      //   岔路口 2：上=怪5(+5) / 下=道具+5
      //   正确走法：主路 + 岔1上 + 岔2 任一 = 26+4+5 = 35 > 34 ✓
      map: [
        '...............',
        '...4.....5.....',
        '...#.....#.....',
        '...#.....#.....',
        'S#2##4##7#a##B.',
        '...#.....#.....',
        '...3.....*.....',
        '...............'
      ],
      itemValues: [5],
      itemTextures: ['sword'],
      boss: 34,
      mob: 'tex-slime',
      bossTex: 'tex-boss-goblin'
    },
    {
      name: '第 2 关',
      // 第 2 关：上横(BOSS右端) + 中横(主路) + 下横支路 + 两竖路连通
      //   中横战力链：2 → 5 → 7 → 9 → 4（吃满 31），BOSS 40 差 9
      //   上横：5 → 4 → 6（吃满 = +15）
      //   岔路口 1 往下：怪 6（到达战力 7，7>6 ✓ 但上横收益更大）
      //   岔路口 2 往下：怪 5 + 道具
      //   正确走法：中横 + 岔1上 + 上横吃到底 = 31+15 = 46 > 40 ✓
      map: [
        '5###4#########B', // row 0: 上横路，左侧怪 5、中间怪 4、右端 BOSS
        '..#....#....#..', // row 1: 三条竖路（col2、col7、col12）连通上下
        '..#....#....#..', // row 2: 竖路延续
        'S#2##5##7##9##4', // row 3: 中横主路，S→怪2→怪5→怪7→怪9→怪4
        '..#....#....#..', // row 4: 竖路继续向下
        '..4....5.......', // row 5: 下端岔路口的怪（col2=4 已调低，确保早期能拿到弓；col7=5）
        '..*....*.......', // row 6: 下端岔路的道具（col2=弓、col7=鼎）
        '...............'  // row 7: 全草地封底
      ],
      itemValues: [4, 3],
      itemTextures: ['bow', 'ding'],
      boss: 40,
      mob: 'tex-goblin',
      bossTex: 'tex-boss-rock'
    },
    {
      name: '第 3 关',
      // 第 3 关：主路(左S→右B) + 三条竖路(上大怪下道具)
      //   主路战力链：2 → 5 → 7 → 9（吃满 27），BOSS 48 差 21
      //   三条竖路顶端怪：6 / 9 / d(13)，底端道具：+4 / +5 / +6
      //   col3 竖路：顶端怪 6（到达战力 5，打不过，先吃 5 再来）
      //   col7 竖路：顶端怪 9（到达战力 13，13>9 ✓）
      //   col11 竖路：顶端怪 d(13)（到达战力 20，20>13 ✓）
      //   正确走法：主路 + 中竖 + 右竖 = 27+(9+4)+(13+6) = 59 > 48 ✓
      map: [
        '..6....9....d..',
        '..#....#....#..',
        '..#....#....#..',
        'S#2##5##7##9##B',
        '..#....#....#..',
        '..#....#....#..',
        '..*....*....*..',
        '...............'
      ],
      itemValues: [4, 5, 6],
      itemTextures: ['scroll', 'potion', 'amulet'],
      boss: 48,
      mob: 'tex-rock',
      bossTex: 'tex-boss-succubus'
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
// 瓦片编号表（★ 想加/减草地变体，只改这里的数字就能决定"用几张"）
// BootScene 按这张表去"烤"瓦片图集，GameScene 按这张表去挑该用第几号瓦片，
// 两边共用一张表，编号就不会对不上。
// ---------------------------------------------------------
CFG.tiles = {
  grass: [0, 1, 2, 3], // 4 张草地变体（编号 0~3），它们都会被设成"墙"
  road: [4, 5, 6, 7],  // 4 张"四面都是路"时用的纯路面
  curbStart: 8,        // 从 8 开始是 16 张"带路缘（马路牙子）"的路面：
                       // 编号 = 8 + 四邻掩码，掩码 0~15 表示四面各挨着谁
  goal: 24             // 终点格
};

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
        } else if (ch >= 'a' && ch <= 'z') {
          // 小写字母 = 战力 10~35 的大怪（'a' = 10, 'b' = 11, 'c' = 12 … 'z' = 35）
          // 写地图时想让某只怪很厉害（现在打不过）就用字母代替数字，
          // 这样关卡才能出现"必须先变强、再回来打开"的大卡口。
          // 用 charCodeAt 把字母换算成编号：'a' 的编码是 97，所以减去 97 再加 10。
          lineData.push(1);
          spawns.push({ col: col, row: row, type: 'monster', power: 10 + (ch.charCodeAt(0) - 97) });
        } else {
          lineData.push(0);                       // 其它字符一律当草地
        }
      }
      grid.push(lineData);
    });

    return { grid: grid, start: start, spawns: spawns };
  },

  /**
   * 【选瓦片】把 parseMap 的"粗网格"(0草地/1路/2终点)
   * 换成"具体该用第几号瓦片"的网格，这样地图就不会是"一块方块反复贴"。
   * 规则：
   *   · 草地 → 从 CFG.tiles.grass 里随机挑一张变体
   *   · 路   → 先看四个方向挨着的是不是路：
   *             四面都是路 → 随机挑一张纯路面
   *             只要有一面挨着草地 → 换成"那一面带路缘"的那张（编号 = curbStart + 掩码）
   *   · 终点 → 固定用终点瓦片
   */
  decorateGrid(grid) {
    const out = [];

    for (let row = 0; row < grid.length; row++) {
      const line = [];
      for (let col = 0; col < grid[row].length; col++) {
        const v = grid[row][col];

        if (v === 1) {
          // 四邻掩码：一位代表一个方向，值是 1 表示"那一面也是路"
          //   +1 = 东(右)   +2 = 南(下)   +4 = 西(左)   +8 = 北(上)
          let mask = 0;
          if (this.isRoad(grid, col + 1, row)) mask += 1;
          if (this.isRoad(grid, col, row + 1)) mask += 2;
          if (this.isRoad(grid, col - 1, row)) mask += 4;
          if (this.isRoad(grid, col, row - 1)) mask += 8;

          if (mask === 15) {
            line.push(Utils.pick(CFG.tiles.road)); // 四面都是路：纯路面
          } else {
            line.push(CFG.tiles.curbStart + mask); // 有挨着草地的一面：用对应的路缘瓦片
          }
        } else if (v === 2) {
          line.push(CFG.tiles.goal);
        } else {
          line.push(Utils.pick(CFG.tiles.grass)); // 草地：随机变体
        }
      }
      out.push(line);
    }

    return out;
  },

  // 判断某个格子算不算"路"（终点也算路；超出地图外也按路处理，
  // 这样地图最边上的一圈不会莫名其妙长出"路缘"）
  isRoad(grid, col, row) {
    if (row < 0 || row >= grid.length) return true;
    if (col < 0 || col >= grid[0].length) return true;
    const v = grid[row][col];
    return v === 1 || v === 2;
  },

  // 从一个数组里随机取一个元素（挑瓦片变体用）
  pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
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
