/* =========================================================
 * config.js —— 全局配置 + 地图数据 + 小工具 + 存档
 * ---------------------------------------------------------
 * 这个文件里全是"死数据"和"通用小函数"，一点游戏画面都不涉及。
 * 以后想调难度、改地图、加关卡，99% 的情况只需要改这个文件。
 * ========================================================= */

// ---------------------------------------------------------
// 0. 剧情文本（开场 + 通关结局 + 死亡结局）
//    每行 ≤ 30 字，适配 960px 宽的画面
// ---------------------------------------------------------
const STORY = {
  // 开场剧情：在 MenuScene 开始按钮之前，逐行淡入展示
  intro: [
    '很久以前，勇者在宁静的小村庄里幸福地生活着。',
    '直到有一天，魔女降下诅咒，怪物如潮水般涌出，',
    '村庄陷入了前所未有的危机。',
    '为了拯救心爱的家人和伙伴，勇者拿起武器，',
    '踏上了讨伐魔女的艰难旅途……'
  ],

  // 通关结局：ResultScene win=true 时追加在结算信息之后
  win: [
    '魔女倒下了，诅咒消散。',
    '阳光重新洒回大地，怪物化为尘埃。',
    '勇者带着荣耀回到了村庄，',
    '村民们欢呼着迎接英雄的归来，',
    '从此，村庄恢复了往日的宁静与幸福。'
  ],

  // 死亡结局：ResultScene win=false 时追加
  lose: [
    '勇者倒下了……',
    '魔女的诅咒越发猖獗，怪物横行无忌。',
    '村庄的村民一个接一个地倒下，',
    '曾经充满欢笑的家园，变成了无人问津的荒村。',
    '只有风还在废墟中低声诉说着勇者的故事……'
  ]
};

// ---------------------------------------------------------
// 1. 全局配置对象
// ---------------------------------------------------------
const CFG = {
  // 画布尺寸（视口窗口：让视角显小，大地图需要摄像机跟随滚动）
  width: 960,
  height: 540,

  // 顶部状态栏（HUD）占的高度。HUD 设 scrollFactor=0 不跟摄像机滚，始终固定在画面顶部。
  playTop: 48,

  // 地图格子大小（像素）。
  // 地图真实尺寸：20×64 = 1280 宽，10×64 = 640 高
  // 视口窗口：960×540 → 摄像机只看到地图的一部分，跟随玩家滚动
  tileSize: 64,
  mapCols: 20,
  mapRows: 10,

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
  // 每一行必须正好 20 个字符、每关必须正好 10 行，否则地图会错位！
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
  // 三关的地图（字符画，20 列 × 10 行）
  // -----------------------------------------------------
  levels: [
    {
      name: '第 1 关',
      // ====== L1：双拦路 + 全部岔路连通 ======
      // 所有岔路行都是 ################# 的整行路！
      // 拦路1 col5=5 (3+2=5⚪) 拦路2 col11=x(33) (绕完上岔=33⚪)
      map: [
        '....................',
        '####4####5#####7####',   // row1 上岔路：整行连通！怪在 col4,9,15
        '....#....#.....#....',   // row2 垂直通道 col4,9,15
        '....#....#.....#....',   // row3
        'S#2##5##7##x##*##fB.',   // row4 主路
        '....#....#.....#....',   // row5 垂直通道
        '....#....#.....#....',   // row6
        '####j####n#####r####',   // row7 下岔路：整行连通！怪在 col4,9,15
        '....#....#.....#....',   // row8
        '####*####*#####*####'    // row9 道具行：整行连通！
      ],
      itemValues: [10, 11, 11, 8],
      itemTextures: ['sword', 'ding', 'scroll', 'potion'],
      boss: 174,  // floor(0.92 × 总资源190) = 174（全吃190>174）
      mob: 'tex-slime',
      bossTex: 'tex-boss-goblin'
    },
    {
      name: '第 2 关',
      // ====== L2：双拦路 + 整行连通 ======
      // 拦路1 col5=5 (3+2=5⚪) 拦路2 col11=J(45) (绕完上岔+h=45⚪)
      map: [
        '....................',
        '####4####6#####8####',   // row1 上岔：整行连通
        '....#....#.....#....',
        '....#....#.....#....',
        'S#2##5##h##J##w##zB.',   // row4 主路
        '....#....#.....#....',
        '....#....#.....#....',
        '####r####u#####y####',   // row7 下岔：整行连通
        '....#....#.....#....',
        '####*####*#####*####'    // row9 道具：整行连通
      ],
      itemValues: [15, 12, 10],
      itemTextures: ['bow', 'ding', 'scroll'],
      boss: 262,  // floor(0.92 × 总资源285) = 262
      mob: 'tex-goblin',
      bossTex: 'tex-boss-rock'
    },
    {
      name: '第 3 关',
      // ====== L3：双拦路 + 整行连通 ======
      // 拦路1 col5=5 (3+2=5⚪) 拦路2 col11=T(55) (绕完上岔+p=55⚪)
      map: [
        '....................',
        '####4####7#####9####',   // row1 上岔：整行连通
        '....#....#.....#....',
        '....#....#.....#....',
        'S#2##5##p##T##Z##MB.',   // row4 主路
        '....#....#.....#....',
        '....#....#.....#....',
        '####n####G#####K####',   // row7 下岔：整行连通
        '....#....#.....#....',
        '####*####*#####*####'    // row9 道具：整行连通
      ],
      itemValues: [20, 15, 15],
      itemTextures: ['scroll', 'potion', 'amulet'],
      boss: 349,  // floor(0.92 × 总资源380) = 349
      mob: 'tex-rock',
      bossTex: 'tex-boss-succubus'
    }
  ],
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

// 地图直接从世界原点开始（摄像机跟随滚动），不需要居中偏移
CFG.mapOffsetX = 0;
CFG.mapOffsetY = 0;

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
          // 小写字母 = 战力 10~35（'a'=10, 'b'=11 … 'z'=35）
          lineData.push(1);
          spawns.push({ col: col, row: row, type: 'monster', power: 10 + (ch.charCodeAt(0) - 97) });
        } else if (ch >= 'A' && ch <= 'Z') {
          // 大写字母 = 战力 36~61（'A'=36, 'B'=37 … 'Z'=61）—— 后期数值膨胀用
          lineData.push(1);
          spawns.push({ col: col, row: row, type: 'monster', power: 36 + (ch.charCodeAt(0) - 65) });
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

// =========================================================
// AudioUtils —— 纯 Web Audio API 合成 chiptune（8-bit）音乐 + 音效
// ---------------------------------------------------------
// 为什么用 Web Audio API 纯代码合成？
//   项目约束不能引入外部素材（mp3/ogg），也不能增加文件数。
//   用浏览器原生 Web Audio API 从零合成 chiptune 音乐，
//   像素风游戏配上 8-bit 方波音乐，那叫一个对味。
//
//   合成的 BGM / 音效 都不需要任何外部音频文件，
//   整个游戏还是 8 个文件就能跑。
// =========================================================
const AudioUtils = {

  ctx: null,              // AudioContext（浏览器音频的总入口）
  masterGain: null,       // 主音量节点（所有声音过这一层再输出）
  bgmTimer: null,         // BGM 调度器的 setInterval
  bgmGain: null,          // BGM 专用音量节点（可以单独淡入淡出）
  sfxGain: null,          // 音效专用音量节点（和 BGM 分开控制）
  currentBgm: null,       // 当前在播的 BGM 名
  noteIndex: 0,           // 当前旋律播到第几拍
  bgmStartTime: 0,        // BGM 循环起点时间戳

  /**
   * 初始化 AudioContext。浏览器要求必须在用户交互（点击/按键）之后才能创建。
   * 所以 BootScene 在 preload 结束等用户按 Enter 时调 init()
   */
  init() {
    if (this.ctx) return; // 已经初始化过就别重复
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) {
        console.warn('[Audio] 浏览器不支持 Web Audio API');
        return;
      }
      this.ctx = new AC();
      // 主音量节点（输出到 destination）
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5; // 主音量 50%
      this.masterGain.connect(this.ctx.destination);

      // BGM 通道（默认 40% 音量）
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.4;
      this.bgmGain.connect(this.masterGain);

      // 音效通道（默认 70% 音量，比 BGM 响）
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.7;
      this.sfxGain.connect(this.masterGain);

      console.log('[Audio] AudioContext 初始化成功');
    } catch (e) {
      console.warn('[Audio] 初始化失败:', e.message);
    }
  },

  /**
   * 用户第一次交互后，把 AudioContext 从 suspended 状态拉起。
   * 浏览器安全策略规定：页面刚加载时 AudioContext 是挂起的，
   * 必须等用户点一下/按一下键盘才能真正开始出声。
   */
  resume() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  /** 音符名 → 频率（Hz）。A4 = 440Hz，其他按 12 音程公式算 */
  noteFreq(name) {
    // 先解析："C#4" → 根音 C、升降号 #、八度 4
    const m = name.match(/^([A-G])(#|b)?(\d)$/);
    if (!m) return 440;
    const [, letter, acc, octave] = m;
    // 每个音到 A 的半音偏移
    const semitoneMap = { A: 0, B: 2, C: 3, D: 5, E: 7, F: 8, G: 10 };
    let n = semitoneMap[letter] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0);
    // 八度差（A4=440，八度每差 1 差 12 个半音）
    n += (parseInt(octave) - 4) * 12;
    return 440 * Math.pow(2, n / 12);
  },

  /**
   * 合成一个纯方波音符并播放（chiptune 灵魂音色）
   * @param {string} note 比如 'C4'
   * @param {number} duration 秒
   * @param {number} volume 0~1
   * @param {GainNode} output 往哪个通道输出（BGM 或 SFX）
   */
  playNote(note, duration, volume, output, type = 'square') {
    if (!this.ctx || output === null) return;
    const freq = typeof note === 'number' ? note : this.noteFreq(note);
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = type;            // square = 8-bit 方波，chiptune 灵魂
    osc.frequency.setValueAtTime(freq, now);

    // ADSR 包络：快速 attack + 快速 release，8-bit 干净利落
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(volume, now + 0.01);  // 极快 attack
    g.gain.setValueAtTime(volume, now + duration - 0.05);
    g.gain.linearRampToValueAtTime(0, now + duration);   // release

    osc.connect(g);
    g.connect(output);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  },

  /**
   * 播放 BGM（循环）。先把旧的停掉再换。
   * 实现：每拍 setInterval 一次，播当前拍的音符，index 自增到结尾则重头循环。
   * 设计得很朴素——chiptune 循环音乐不需要复杂的预调度，拍子准就行。
   * @param {string} name 'menu' / 'battle' / 'result'
   */
  playBgm(name) {
    if (!this.ctx) return;
    if (this.currentBgm === name) return; // 已经在播了就别重复
    this.stopBgm();

    const mel = BGM_MELDIES[name];
    if (!mel) { console.warn('[Audio] 未知 BGM:', name); return; }

    this.currentBgm = name;
    this.noteIndex = 0;
    const beatMs = mel.beatMs || 280; // 每拍多少毫秒，决定节奏快慢
    const dur = mel.duration || 0.22; // 每个音符持续秒数

    // 每拍播一个音符（null = 空拍/休止，跳过）
    this.bgmTimer = setInterval(() => {
      const n = mel.notes[this.noteIndex];
      if (n) this.playNote(n, dur, 0.35, this.bgmGain);
      this.noteIndex = (this.noteIndex + 1) % mel.notes.length;
    }, beatMs);
  },

  /** 停掉当前 BGM（带 200ms 淡出，别太突然） */
  stopBgm() {
    if (this.bgmTimer) { clearInterval(this.bgmTimer); this.bgmTimer = null; }
    this.currentBgm = null;
    // 淡出：把 bgmGain 音量慢慢降到 0
    if (this.ctx && this.bgmGain) {
      const now = this.ctx.currentTime;
      this.bgmGain.gain.cancelScheduledValues(now);
      this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, now);
      this.bgmGain.gain.linearRampToValueAtTime(0, now + 0.25);
      this.bgmGain.gain.setValueAtTime(0.4, now + 0.26); // 恢复音量以备下次用
    }
  },

  /** 停一切（切场景前调用） */
  stopAll() {
    this.stopBgm();
  },

  // ---------- 音效 ----------

  /** 击杀音效：短促下行 3 个方波音（8-bit 经典"杀怪"感） */
  sfxKill() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [660, 523, 392]; // E5 → C5 → G4 下行
    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, now + i * 0.06);
      const g = this.ctx.createGain();
      const t = now + i * 0.06;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.005);
      g.gain.linearRampToValueAtTime(0, t + 0.14);
      osc.connect(g); g.connect(this.sfxGain);
      osc.start(t); osc.stop(t + 0.15);
    });
  },

  /** 吃道具音效：上扬三连音（"叮"的感觉） */
  sfxPickup() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523, 659, 784].forEach((f, i) => { // C → E → G 上扬
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, now + i * 0.05);
      const g = this.ctx.createGain();
      const t = now + i * 0.05;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.55, t + 0.005);
      g.gain.linearRampToValueAtTime(0, t + 0.12);
      osc.connect(g); g.connect(this.sfxGain);
      osc.start(t); osc.stop(t + 0.13);
    });
  },

  /** BOSS 大招音效：强低频"嗡鸣" + 爆炸噪声 */
  sfxBossFinisher() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 1) 低频方波轰鸣（110Hz → 60Hz 下坠）
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.linearRampToValueAtTime(60, now + 0.6);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.5, now + 0.1);
    g.gain.linearRampToValueAtTime(0, now + 0.8);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.85);

    // 2) 高频爆裂（白噪声 + 快速衰减）
    const bufferSize = this.ctx.sampleRate * 0.3;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // 快速衰减的噪声
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const ng = this.ctx.createGain();
    ng.gain.value = 0.4;
    noise.connect(ng); ng.connect(this.sfxGain);
    noise.start(now + 0.6);
  },

  /** 射箭发射声：高频短促的"嗖"（正弦波快速下滑 + 一点白噪声模拟弓弦） */
  sfxShoot() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 弓弦音：正弦波 1200Hz → 600Hz 快速下滑（0.08 秒）
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.45, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.12);

    // 再加一点点白噪声模拟箭划破空气的"嘶"声
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.06, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) * 0.5;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const ng = this.ctx.createGain();
    ng.gain.value = 0.2;
    noise.connect(ng); ng.connect(this.sfxGain);
    noise.start(now);
  },

  /** 射箭击中声：短促的"噗"（方波双音 + 白噪声冲击）—— 8-bit 经典射中感 */
  sfxArrowHit() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 命中冲击音：方波 400Hz → 250Hz 快速下滑（0.06 秒）
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(250, now + 0.06);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.1);

    // 高频小噪声模拟"击中的脆响"
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.04, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2000; // 高通滤波让噪声更像"击中金属/肉"的脆响
    const ng = this.ctx.createGain();
    ng.gain.value = 0.3;
    noise.connect(bp); bp.connect(ng); ng.connect(this.sfxGain);
    noise.start(now);
  },

  /**
   * 万箭齐发音效（弓 BOSS 大招专属）
   *   设计：8 声连续的高频"嗖"（模拟多箭同时发射） + 最后一次低频"轰"（BOSS 爆炸）
   *   时长 ~0.8s，带空间感的连续冲击
   */
  sfxArrowStorm() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 8 声连续的"嗖"——高频白噪声 + 快速衰减，每声错开 60ms
    for (let i = 0; i < 8; i++) {
      const t = now + i * 0.06;

      // 第 i 声：带通滤波白噪声模拟箭破空
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.1, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < d.length; j++) {
        d[j] = (Math.random() * 2 - 1) * (1 - j / d.length) * 0.6;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1500 + i * 80; // 每声高频略有不同，更立体
      const g = this.ctx.createGain();
      g.gain.value = 0.35;
      noise.connect(bp); bp.connect(g); g.connect(this.sfxGain);
      noise.start(t);

      // 箭飞行的正弦波尾音
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800 + i * 60, t);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.08);
      const og = this.ctx.createGain();
      og.gain.setValueAtTime(0.25, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(og); og.connect(this.sfxGain);
      osc.start(t); osc.stop(t + 0.1);
    }

    // 最后一击的低频爆炸（0.7 秒后）
    const boomT = now + 0.55;
    const boom = this.ctx.createOscillator();
    boom.type = 'sawtooth';
    boom.frequency.setValueAtTime(160, boomT);
    boom.frequency.exponentialRampToValueAtTime(40, boomT + 0.3);
    const bg2 = this.ctx.createGain();
    bg2.gain.setValueAtTime(0.55, boomT);
    bg2.gain.exponentialRampToValueAtTime(0.001, boomT + 0.35);
    boom.connect(bg2); bg2.connect(this.sfxGain);
    boom.start(boomT); boom.stop(boomT + 0.38);

    // 再加一层白噪声爆炸
    const nbuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.35, this.ctx.sampleRate);
    const nd = nbuf.getChannelData(0);
    for (let j = 0; j < nd.length; j++) {
      nd[j] = (Math.random() * 2 - 1) * (1 - j / nd.length);
    }
    const noise2 = this.ctx.createBufferSource();
    noise2.buffer = nbuf;
    const ng2 = this.ctx.createGain();
    ng2.gain.value = 0.5;
    noise2.connect(ng2); ng2.connect(this.sfxGain);
    noise2.start(boomT + 0.02);
  },

  /** 死亡音效：长下行（"啊~~~"的感觉） */
  sfxDeath() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 1.2);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.6, now + 0.1);
    g.gain.linearRampToValueAtTime(0, now + 1.3);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 1.35);
  }
};

// =========================================================
// BGM 旋律数据（纯 chiptune，方波合成）
//   null 表示空拍（休止），让节奏有呼吸感
// =========================================================
const BGM_MELDIES = {

  // 菜单 BGM：轻松愉快的大调旋律，慢节奏（每拍 320ms）
  // 一个循环 32 拍 ≈ 10 秒
  menu: {
    beatMs: 320,
    duration: 0.28,
    notes: [
      'C4','E4','G4','E4','F4','A4','G4','E4',
      'C4','E4','G4','C5','A4','G4','E4','C4',
      // 副歌（略微上扬）
      'D4','F4','A4','F4','G4','C5','A4','F4',
      'D4','F4','A4','D5','C5','A4','F4','D4'
    ]
  },

  // 战斗 BGM：紧张的小调旋律，快节奏（每拍 220ms）
  // 一个循环 24 拍 ≈ 5.3 秒
  battle: {
    beatMs: 220,
    duration: 0.18, // 更短，更紧凑
    notes: [
      'E4',null,'G4','A4','G4','E4',null,'E4',
      'E4',null,'G4','A4','C5','B4','A4','G4',
      // 升调进入 BOSS 感
      'F4',null,'A4','C5','A4','F4',null,'F4'
    ]
  },

  // 结算 BGM：胜利后的悠扬大调，中速（每拍 280ms）
  result: {
    beatMs: 280,
    duration: 0.26,
    notes: [
      'C5','E5','G5','E5','C5','E5','G5','C6',
      'B4','D5','F5','D5','A4','C5','E5','C5',
      'G4','B4','D5','B4','C5','E5','G5','C6',
      'A4','C5','E5','G5','C6',null,null,null
    ]
  }
};
