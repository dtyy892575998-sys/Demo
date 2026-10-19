/* =========================================================
 * config.js —— 全局配置 + 小工具 + 存档
 * ---------------------------------------------------------
 * 这个文件里全是"死数据"和"通用小函数"，一点游戏画面都不涉及。
 * 以后想调难度、改数值、加关卡，99% 的情况只需要改这个文件。
 * ========================================================= */

// ---------------------------------------------------------
// 1. 全局配置对象：所有可以调的数值都集中在这里
// ---------------------------------------------------------
const CFG = {
  // 画布尺寸（单屏固定地图，不做镜头滚动）
  width: 960,
  height: 640,

  // 顶部状态栏（HUD）占的高度，下面才是真正的"战场"
  playTop: 70,

  // 主角相关
  player: {
    startPower: 3,   // 每一关开始时主角的战力（每一关都会重置成 3）
    speed: 220       // 移动速度，单位：像素/秒
  },

  // 小怪相关（随机游荡，撞墙反弹）
  monster: {
    speedMin: 45,    // 最慢速度
    speedMax: 110,   // 最快速度
    spawnMinDist: 170 // 出生时至少离主角这么远，避免一开局就被撞死
  },

  // 道具相关
  item: {
    spawnMinDist: 120 // 道具出生时至少离主角这么远
  },

  // BOSS 的巡逻区域（左上角坐标 x1,y1 和右下角坐标 x2,y2）
  bossZone: { x1: 280, y1: 110, x2: 680, y2: 300 },

  // -----------------------------------------------------
  // 三关的数据表：想加关卡，就往这个数组后面继续加对象
  //   monsters : 场上小怪的数值列表（3 表示"战力 3 的小怪"）
  //   items    : 道具的加成分数列表
  //   boss     : BOSS 的战力（吃掉它 = 过关）
  //   bossSpeed: BOSS 的巡逻速度（越大越难）
  // -----------------------------------------------------
  levels: [
    {
      monsters: [1, 1, 2, 2, 3, 4],
      items: [1, 2, 3],
      boss: 10,
      bossSpeed: 55
    },
    {
      monsters: [1, 2, 3, 3, 4, 5, 5, 6, 8],
      items: [2, 3, 5],
      boss: 18,
      bossSpeed: 75
    },
    {
      monsters: [2, 3, 4, 5, 5, 6, 7, 8, 9],
      items: [3, 5, 8],
      boss: 30,
      bossSpeed: 95
    }
  ],

  // 配色表（全部用色号，方便以后换成像素素材）
  color: {
    bg: 0x0b0e14,        // 页面背景
    ground: 0x121724,    // 战场地面
    grid: 0x1e2740,      // 地面网格线
    hudBg: 0x000000,     // 顶部状态栏
    danger: 0xff5a5a,    // "吃不了"的怪物颜色（红）
    edible: 0x66e08a,    // "能吃"的怪物颜色（绿）
    item: 0xffd24d,      // 道具颜色（金）
    boss: 0x8b5cf6,      // BOSS 颜色（紫）
    bossLocked: 0x5b5b5b,// 打不过时的 BOSS 颜色（灰）
    button: 0x2f6fed,    // 按钮底色
    buttonHover: 0x4a8cff // 按钮悬停色
  }
};

// ---------------------------------------------------------
// 2. 小工具函数（和游戏逻辑无关，纯粹是"常用小帮手"）
// ---------------------------------------------------------
const Utils = {
  // 在 [min, max] 之间随机取一个整数
  randInt(min, max) {
    return Phaser.Math.Between(min, max);
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
    // 先把"能点"的矩形画出来
    const rect = scene.add.rectangle(x, y, width, height, CFG.color.button)
      .setStrokeStyle(2, 0xffffff, 0.7)
      .setInteractive({ useHandCursor: true }); // useHandCursor：鼠标移上去变小手

    // 再叠一层文字
    const label = scene.add.text(x, y, text, {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // 悬停变色，让玩家知道"这里可以点"
    rect.on('pointerover', () => rect.setFillStyle(CFG.color.buttonHover));
    rect.on('pointerout', () => rect.setFillStyle(CFG.color.button));
    rect.on('pointerdown', () => { if (onClick) onClick(); });

    return { rect, label };
  },

  /**
   * 飘字效果：在 (x, y) 处吐出一段文字，一边往上飘一边淡出
   * 比如吃到怪物时飘一个绿色的 "+3"
   */
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
      y: y - 46,      // 向上飘 46 像素
      alpha: 0,       // 同时淡出
      duration: 700,
      onComplete: () => t.destroy()  // 飘完就把这个文字销毁，避免内存越积越多
    });
  }
};

// ---------------------------------------------------------
// 3. 本地存档（用浏览器自带的 localStorage 记住历史最佳）
// ---------------------------------------------------------
const Save = {
  KEY: 'number-eater-best-v1',

  // 读取存档；读不到（第一次玩）就返回 null
  load() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || null;
    } catch (e) {
      // 某些浏览器在 file:// 下会禁止读写 localStorage，这里静默失败即可
      return null;
    }
  },

  // 写入存档
  save(rec) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(rec));
    } catch (e) {
      /* 存不了就不存，完全不影响游戏 */
    }
  },

  /**
   * 判断新成绩 a 是否比旧成绩 b 更好
   * 比较顺序：先看有没有通关 → 再看打到第几关 → 再看战力 → 最后看谁用时短
   */
  isBetter(a, b) {
    if (!b) return true;                       // 没有旧记录，直接算新纪录
    if (a.win !== b.win) return a.win === true; // 通关的永远更强
    if (a.level !== b.level) return a.level > b.level;
    if (a.power !== b.power) return a.power > b.power;
    return a.time < b.time;
  },

  // 把一条成绩变成一句人话，给菜单和结算页显示用
  describe(rec) {
    if (!rec) return '暂无记录';
    const head = rec.win ? '通关成功' : `到第 ${rec.level} 关`;
    return `${head} · 战力 ${rec.power} · 用时 ${rec.time}s`;
  }
};
