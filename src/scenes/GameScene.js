/* =========================================================
 * GameScene.js —— 游戏主场景（核心玩法都在这里）
 * ---------------------------------------------------------
 * 职责：
 *   1) 按关卡数据生成主角 / 小怪 / BOSS / 道具
 *   2) 每帧更新主角与怪物的行为
 *   3) 处理"撞上了"的判定：吃 / 死 / 两不相伤
 *   4) 维护顶部状态栏（关卡、战力、用时）
 *   5) 过关 → 下一关 或 通关结算；死亡 → 失败结算
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

    // ---------- 1) 战场背景 ----------
    this.add.rectangle(0, CFG.playTop, CFG.width, CFG.height - CFG.playTop, CFG.color.ground).setOrigin(0);

    // 画一层网格线，让它看起来像"格子战场"（纯装饰）
    const grid = this.add.graphics();
    grid.lineStyle(1, CFG.color.grid, 1);
    for (let x = 0; x <= CFG.width; x += 64) grid.lineBetween(x, CFG.playTop, x, CFG.height);
    for (let y = CFG.playTop; y <= CFG.height; y += 64) grid.lineBetween(0, y, CFG.width, y);

    // ---------- 2) 把物理世界的边界设成"战场区域" ----------
    // 这样谁都不会跑到顶部状态栏里去
    this.physics.world.setBounds(0, CFG.playTop, CFG.width, CFG.height - CFG.playTop);

    // ---------- 3) 主角 ----------
    this.player = new Player(this, CFG.width / 2, CFG.height - 60);

    // ---------- 4) 两个容器组：怪物组 和 道具组 ----------
    // 组的作用：一次就能把"主角 vs 所有怪物"的碰撞全检测完
    this.monsterGroup = this.physics.add.group();
    this.itemGroup = this.physics.add.group();

    // ---------- 5) 按关卡数据生成内容 ----------
    level.monsters.forEach((v) => this.spawnMonster(v));
    this.spawnBoss(level.boss, level.bossSpeed);
    level.items.forEach((v) => this.spawnPickup(v));

    // ---------- 6) 碰撞判定（overlap = 只判定重叠，不产生推挤） ----------
    this.physics.add.overlap(this.player, this.monsterGroup, this.onTouchMonster, null, this);
    this.physics.add.overlap(this.player, this.itemGroup, this.onTouchItem, null, this);

    // ---------- 7) 界面 ----------
    this.createHUD();
    this.applyDangerColors(); // 给怪物上色：红=打不过，绿=能吃

    // ---------- 8) 调试用：按 R 键重开本关 ----------
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

    // 所有怪物各自更新（小怪同步头顶数字，BOSS 顺便巡逻）
    this.monsterGroup.getChildren().forEach((m) => m.update());

    // 刷新顶部状态栏
    this.updateHUD();
  }

  // ======================= 生成物体 =======================

  /**
   * 随机找一个"离主角足够远"的坐标，避免一出生就撞死主角
   */
  randomPos(minDist, zone) {
    for (let i = 0; i < 60; i++) {
      const x = Utils.randInt(zone.x1, zone.x2);
      const y = Utils.randInt(zone.y1, zone.y2);
      const d = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y);
      if (d > minDist) return { x, y };
    }
    return { x: zone.x1, y: zone.y1 }; // 兜底：实在找不到就不挑了
  }

  // 生成一只小怪
  spawnMonster(power) {
    const pos = this.randomPos(CFG.monster.spawnMinDist, {
      x1: 40,
      y1: CFG.playTop + 40,
      x2: CFG.width - 40,
      y2: CFG.height - 40
    });
    const speed = Utils.randInt(CFG.monster.speedMin, CFG.monster.speedMax);

    const m = new Monster(this, pos.x, pos.y, power, { speed });
    this.monsterGroup.add(m);
    m.startRoaming(); // 注意：必须在 add() 之后给初速度
  }

  // 生成 BOSS（也是 Monster，只是 isBoss = true）
  spawnBoss(power, speed) {
    const z = CFG.bossZone;
    const b = new Monster(this, (z.x1 + z.x2) / 2, (z.y1 + z.y2) / 2, power, {
      isBoss: true,
      speed: speed
    });
    this.monsterGroup.add(b);
    this.boss = b; // 存一份引用，方便以后扩展（比如加 BOSS 血条）
  }

  // 生成一个道具
  spawnPickup(value) {
    const pos = this.randomPos(CFG.item.spawnMinDist, {
      x1: 40,
      y1: CFG.playTop + 40,
      x2: CFG.width - 40,
      y2: CFG.height - 40
    });
    const p = new Pickup(this, pos.x, pos.y, value);
    this.itemGroup.add(p);
    p.freeze(); // 同样：加入组之后再固定住
  }

  // ======================= 碰撞判定 =======================

  /**
   * 主角撞到怪物
   * 规则：战力更大 → 吃掉；战力更小 → 死亡；相等 → 两不相伤
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
      this.applyDangerColors(); // 战力变了，所有怪物的颜色要重新算

      if (wasBoss) this.levelClear(); // 吃掉 BOSS = 过关

    } else if (player.power < monster.power) {
      // ---- 打不过：主角死亡 ----
      this.playerDead(monster);
    }
    // ---- 相等：什么都不做，两人擦肩而过 ----
  }

  // 主角撞到道具：不看大小，直接加战力
  onTouchItem(player, item) {
    if (this.gameEnded || item.isDead) return;

    const v = item.value;
    item.kill();
    player.addPower(v);
    Utils.floatText(this, item.x, item.y - 20, '+' + v, '#ffd24d');
    this.applyDangerColors();
  }

  /**
   * 根据主角当前战力，给所有怪物重新上色
   * 绿 = 能吃，红 = 会死，BOSS 则是 紫 = 能打 / 灰 = 打不过
   * 这样玩家一眼就能看出该吃谁、该躲谁
   */
  applyDangerColors() {
    const p = this.player.power;
    this.monsterGroup.getChildren().forEach((m) => {
      if (m.isDead) return;

      if (m.isBoss) {
        m.setTint(p > m.power ? CFG.color.boss : CFG.color.bossLocked);
      } else {
        m.setTint(p > m.power ? CFG.color.edible : CFG.color.danger);
      }
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

  // 吃掉 BOSS = 过关
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
    this.add.text(CFG.width / 2, CFG.height - 14,
      'WASD / 方向键移动 · 吃掉数值更小的敌人 · R 键重开本关', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
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
