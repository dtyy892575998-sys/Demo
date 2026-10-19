/* =========================================================
 * GameScene.js —— 游戏主场景（核心玩法都在这里）
 * ---------------------------------------------------------
 * 职责：
 *   1) 把 config.js 里的「字符画地图」画成真正的草地 + 道路
 *   2) 在道路指定的格子上摆好主角 / 怪物 / 道具 / 终点 BOSS
 *   3) 每帧更新主角的移动，并处理"撞上了"的判定：吃 / 死 / 被弹开
 *   4) 维护顶部状态栏（关卡、战力、用时）
 *   5) 吃掉守在终点的 BOSS → 过关；被更强的怪撞到 → 失败结算
 *
 * 地图是怎么画出来的？
 *   config.js 里每关都是一张"字符画"（'.'草地 '#'路 'S'起点 'B'终点 …），
 *   先用 Utils.parseMap 把它翻译成数字网格，再交给 Phaser 自带的 Tilemap
 *   （瓦片地图）渲染。其中 0 = 草地，会被设成"墙"，玩家走不进去。
 * ========================================================= */

class GameScene extends Phaser.Scene {

  constructor() {
    super('GameScene');
  }

  /**
   * init() 会在 create() 之前自动执行，用来接收"上一个场景传过来的数据"
   * data = { levelIndex: 第几关(从0开始), elapsedBefore: 之前各关累计用时(秒) }
   * 注意：不要写成 this.data ，那是 Phaser 自己的保留属性！
   */
  init(data) {
    const d = data || {};
    this.levelIndex = d.levelIndex || 0;
    this.elapsedBefore = d.elapsedBefore || 0;
  }

  create() {
    this.gameEnded = false;          // 本关是否已经结束（结束就冻结一切）
    this.startTime = this.time.now;  // 记下本关开始的时间，用来算用时

    const level = CFG.levels[this.levelIndex];

    // ---------- 1) 地图外的底色 ----------
    // 地图只占画面中间那一块（960 x 512），上下留白用深色铺满
    this.add.rectangle(0, CFG.playTop, CFG.width, CFG.height - CFG.playTop, CFG.color.ground).setOrigin(0);

    // ---------- 2) 把物理世界的边界设成"战场区域" ----------
    // 这样谁都不会跑到顶部状态栏里去
    this.physics.world.setBounds(0, CFG.playTop, CFG.width, CFG.height - CFG.playTop);

    // ---------- 3) 解析字符画，并渲染成瓦片地图 ----------
    const data = Utils.parseMap(level.map); // { grid, start, spawns }
    this.mapData = data;

    // make.tilemap：用"二维数字数组"直接生成一张瓦片地图
    this.map = this.make.tilemap({
      data: data.grid,
      tileWidth: CFG.tileSize,
      tileHeight: CFG.tileSize
    });

    // 把 BootScene 里"烤"好的瓦片图集（192x64，横向 3 格）注册给这张地图
    // 参数含义：瓦片名字, 纹理名, 单格宽, 单格高, 边距, 间距
    const tileset = this.map.addTilesetImage('tiles', 'tex-tiles', CFG.tileSize, CFG.tileSize, 0, 0);

    // createLayer：把第 0 层真正画到画面上，并整体偏移到居中位置
    this.mapLayer = this.map.createLayer(0, tileset, CFG.mapOffsetX, CFG.mapOffsetY);

    // ★关键：把"草地"（瓦片编号 0）设成墙。
    //   这样主角撞上去就会被挡住，只能沿着路（编号 1）和终点（编号 2）走。
    this.mapLayer.setCollision([0]);

    // ---------- 4) 主角：出生在字符画里的 'S' 格中心 ----------
    const startPos = Utils.cellCenter(data.start.col, data.start.row);
    this.player = new Player(this, startPos.x, startPos.y);

    // ---------- 5) 两个容器组：怪物组 和 道具组 ----------
    // 组的作用：一次就能把"主角 vs 所有怪物"的碰撞全检测完
    this.monsterGroup = this.physics.add.group();
    this.itemGroup = this.physics.add.group();

    // ---------- 6) 按字符画里的标记，把怪物 / 道具 / BOSS 摆到对应格子 ----------
    let itemIndex = 0; // 道具的加值按"从左到右、从上到下"的顺序从 itemValues 里取
    data.spawns.forEach((s) => {
      if (s.type === 'boss') {
        this.spawnBoss(level.boss, s.col, s.row, level.bossTex);
      } else if (s.type === 'monster') {
        this.spawnMonster(s.power, s.col, s.row, level.mob);
      } else {
        const value = level.itemValues[itemIndex] !== undefined ? level.itemValues[itemIndex] : 1;
        itemIndex++;
        this.spawnPickup(value, s.col, s.row);
      }
    });

    // ---------- 7) 碰撞设置 ----------
    // 主角 vs 草地墙：真实碰撞（会被挡住）
    this.physics.add.collider(this.player, this.mapLayer);

    // 主角 vs 怪物：也用"真实碰撞（collider）"而不是"只判定（overlap）"。
    //   这样怪物就像一堵墙：
    //     · 战力比你小 → 回调里立刻把它吃掉，你最多被顿一下就走过去了
    //     · 战力比你大 → 回调里立刻判定死亡
    //     · 战力和你一样 → 每帧都会把你推开（撞不动），这条路你就过不去
    this.physics.add.collider(this.player, this.monsterGroup, this.onTouchMonster, null, this);

    // 主角 vs 道具：只判定重叠就行，道具不需要挡住路
    this.physics.add.overlap(this.player, this.itemGroup, this.onTouchItem, null, this);

    // ---------- 8) 界面 ----------
    this.createHUD();
    this.refreshThreatMarks(); // 给每只怪套上状态光环：绿/紫=能打，红/灰=打不过，白=数值相同

    // ---------- 9) 调试用：按 R 键重开本关 ----------
    this.input.keyboard.on('keydown-R', () => {
      if (this.gameEnded) return;
      this.scene.restart({ levelIndex: this.levelIndex, elapsedBefore: this.elapsedBefore });
    });
  }

  // ======================= 每帧更新 =======================
  update() {
    if (this.gameEnded) return; // 已经结束了就不再做任何更新

    // 主角动起来
    this.player.update();

    // 所有怪物各自更新（目前就是同步一下头顶数字）
    this.monsterGroup.getChildren().forEach((m) => m.update());

    // 刷新顶部状态栏
    this.updateHUD();
  }

  // ======================= 生成物体 =======================

  // 在路上（或死路尽头）放一只站着不动的怪
  // texture 决定它的长相（史莱姆 / 哥布林 / 岩石怪…），由 config.js 的 mob 指定
  spawnMonster(power, col, row, texture) {
    const pos = Utils.cellCenter(col, row);
    const m = new Monster(this, pos.x, pos.y, power, { isBoss: false, texture: texture });
    this.monsterGroup.add(m);

    // ★ 注意顺序：必须在 group.add() 之后再设"不可推动"！
    //   因为物理组在 add() 的时候，会用组自己的默认值把物体的 immovable 改回 false。
    //   如果写在 Monster 的构造函数里（add 之前），就会被覆盖掉，
    //   结果就是怪物能被主角推着走 —— 那就不是"挡路"了。
    m.setImmovable(true);
    m.setVelocity(0, 0);
    return m;
  }

  // 在终点格放 BOSS（也是 Monster，只是 isBoss = true）
  spawnBoss(power, col, row, texture) {
    const pos = Utils.cellCenter(col, row);
    const b = new Monster(this, pos.x, pos.y, power, { isBoss: true, texture: texture });
    this.monsterGroup.add(b);

    b.setImmovable(true); // 同上：必须在 add() 之后再设
    b.setVelocity(0, 0);

    this.boss = b; // 存一份引用，方便以后扩展（比如加 BOSS 血条）
    return b;
  }

  // 在死路尽头放一个道具
  spawnPickup(value, col, row) {
    const pos = Utils.cellCenter(col, row);
    const p = new Pickup(this, pos.x, pos.y, value);
    p.setTint(CFG.color.item); // 占位图是白色的，染成金色更好认
    this.itemGroup.add(p);

    p.setImmovable(true); // 同上：必须在 add() 之后再设
    p.setVelocity(0, 0);
    return p;
  }

  // ======================= 碰撞判定 =======================

  /**
   * 主角撞到怪物（这是个 collider 回调，物理引擎会先把两个人分开，再来叫我们）
   * 规则：战力更大 → 吃掉；战力更小 → 死亡；战力相等 → 互相撞不动，主角被弹开
   */
  onTouchMonster(player, monster) {
    if (this.gameEnded || monster.isDead) return; // 已结束 / 已死，忽略

    if (player.power > monster.power) {
      // ---- 打赢了：吃掉它，战力增加 ----
      const gain = monster.power;
      const wasBoss = monster.isBoss;

      monster.kill();
      player.addPower(gain);
      Utils.floatText(this, monster.x, monster.y - 20, '+' + gain, '#66e08a');
      this.refreshThreatMarks(); // 战力变了，所有怪物的状态光环要重新算

      if (wasBoss) this.levelClear(); // 吃掉守在终点的 BOSS = 过关

    } else if (player.power < monster.power) {
      // ---- 打不过：主角死亡 ----
      this.playerDead(monster);

    } else {
      // ---- 数值一样：谁也吃不了谁，主角被弹回去，这条路暂时走不通 ----
      this.knockBack(player, monster);
    }
  }

  /**
   * 撞到"数值相同"的怪物时，把主角往反方向弹开一小段
   * @param {Player} player
   * @param {Monster} monster
   */
  knockBack(player, monster) {
    // 防重复触发：上一推还没结束就忽略（否则一帧会被叫好几次，弹得太远）
    if (this.time.now < player.lockedUntil) return;

    // 方向 = 从怪物指向主角（也就是"主角该往哪边退"）
    let dx = player.x - monster.x;
    let dy = player.y - monster.y;
    if (dx === 0 && dy === 0) dy = 1; // 万一两个人中心点完全重合，就统一往下方弹
    const len = Math.sqrt(dx * dx + dy * dy);
    dx /= len;
    dy /= len;

    player.lockInput(180);                        // 锁键盘 180 毫秒（这段时间按键无效）
    player.setVelocity(dx * 300, dy * 300);       // 顺着反方向弹出去
    player.setTintFill(0xffffff);                 // 整个人闪一下白，表示"撞上了"

    this.cameras.main.shake(90, 0.004);           // 屏幕轻轻抖一下
    Utils.floatText(this, monster.x, monster.y - 34, '撞不动', '#ffffff');

    // 150 毫秒后去掉白色，恢复原本的像素配色
    this.time.delayedCall(150, () => {
      if (player && player.active) player.clearTint();
    });
  }

  // 主角撞到道具：不看大小，直接加战力
  onTouchItem(player, item) {
    if (this.gameEnded || item.isDead) return;

    const v = item.value;
    item.kill();
    player.addPower(v);
    Utils.floatText(this, item.x, item.y - 20, '+' + v, '#ffd24d');
    this.refreshThreatMarks();
  }

  /**
   * 根据主角当前战力，刷新每一只怪物的"状态光环"
   * 绿圈 = 能吃，红圈 = 会死，白圈 = 数值和你一样（撞不动、走不过去），
   * BOSS 则是 紫圈 = 能打 / 灰圈 = 打不过
   * 这样玩家一眼就能看出该吃谁、该躲谁
   */
  refreshThreatMarks() {
    const p = this.player.power;
    this.monsterGroup.getChildren().forEach((m) => {
      if (m.isDead) return;
      m.setThreat(p > m.power, p === m.power); // 大 = 能吃；相等 = 白色（撞不动）
    });
  }

  // ======================= 结束流程 =======================

  // 本关（含之前各关）累计用时，单位：秒
  totalTime() {
    return this.elapsedBefore + (this.time.now - this.startTime) / 1000;
  }

  // 主角死亡
  playerDead(killer) {
    if (this.gameEnded) return;
    this.gameEnded = true;

    this.physics.pause();            // 冻结所有物体
    this.player.setVelocity(0, 0);
    this.player.setTintFill(0xff2020); // 整个变红（tintFill 是"覆盖色"，不是混色）
    this.cameras.main.shake(220, 0.01);// 屏幕抖一下

    this.showCenterTip(`你被 ${killer.power} 点战力的敌人撞死了！`, '#ff6b6b');

    const total = Number(this.totalTime().toFixed(1));
    const power = this.player.power;

    // 停 1 秒再跳结算页，让玩家看清发生了什么
    this.time.delayedCall(1000, () => {
      this.scene.start('ResultScene', {
        win: false,
        level: this.levelIndex + 1,
        power: power,
        time: total,
        elapsedBefore: this.elapsedBefore
      });
    });
  }

  // 吃掉守在终点的 BOSS = 过关
  levelClear() {
    if (this.gameEnded) return;
    this.gameEnded = true;

    this.physics.pause();
    this.player.setVelocity(0, 0);

    const total = Number(this.totalTime().toFixed(1));
    const power = this.player.power;
    const isLast = this.levelIndex >= CFG.levels.length - 1;

    this.showCenterTip(isLast ? '全部通关！' : `第 ${this.levelIndex + 1} 关 通过！`, '#66e08a');

    this.time.delayedCall(1400, () => {
      if (isLast) {
        // 最后一关也过了 → 胜利结算
        this.scene.start('ResultScene', {
          win: true,
          level: CFG.levels.length,
          power: power,
          time: total,
          elapsedBefore: this.elapsedBefore
        });
      } else {
        // 还有下一关 → 注意：下一关的战力会重置回 3
        this.scene.start('GameScene', {
          levelIndex: this.levelIndex + 1,
          elapsedBefore: total
        });
      }
    });
  }

  // ======================= 界面 =======================

  // 创建顶部状态栏 + 底部提示 + 屏幕中央的大提示
  createHUD() {
    // 顶部黑色半透明条
    this.add.rectangle(0, 0, CFG.width, CFG.playTop, CFG.color.hudBg, 0.55).setOrigin(0);

    const hudStyle = {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold'
    };

    this.levelText = this.add.text(20, 24, '', hudStyle);                              // 左侧：第几关
    this.powerText = this.add.text(CFG.width / 2, 24, '', hudStyle).setOrigin(0.5, 0); // 中间：战力
    this.timeText = this.add.text(CFG.width - 20, 24, '', hudStyle).setOrigin(1, 0);   // 右侧：用时

    // 底部操作提示
    this.add.text(CFG.width / 2, CFG.height - 10,
      'WASD / 方向键沿路走 · 绿圈紫圈=现在能打，红圈=打不过，白圈=数值相同（撞不动） · R 键重开本关', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#7d8aa5'
    }).setOrigin(0.5, 1);

    // 屏幕中央的大提示（过关 / 死亡时显示），depth 设大一点保证盖在最上层
    this.tipText = this.add.text(CFG.width / 2, CFG.height / 2, '', {
      fontFamily: 'sans-serif',
      fontSize: '44px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(10);
  }

  // 每帧刷新状态栏
  updateHUD() {
    this.levelText.setText(`第 ${this.levelIndex + 1} / ${CFG.levels.length} 关`);
    this.powerText.setText(`战力 ${this.player.power}`);
    this.timeText.setText(`用时 ${this.totalTime().toFixed(1)}s`);
  }

  // 屏幕中央弹出大字
  showCenterTip(text, color) {
    this.tipText.setText(text).setColor(color).setAlpha(0).setScale(0.8);

    // 从 0.8 倍放大到 1 倍，同时淡入
    this.tweens.add({
      targets: this.tipText,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: 'Back.easeOut'
    });
  }
}
