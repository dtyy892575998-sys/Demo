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
 *   第一步 Utils.parseMap 把它翻译成数字网格（0=草地 1=路 2=终点），
 *   第二步 Utils.decorateGrid 再从瓦片图集里给每一格挑一张具体瓦片
 *   （草地随机换变体、道路按四邻决定要不要画路缘），
 *   最后交给 Phaser 自带的 Tilemap（瓦片地图）渲染。
 *   其中 CFG.tiles.grass（0~3 号草地）会被设成"墙"，玩家走不进去。
 * ========================================================= */

class GameScene extends Phaser.Scene {

  constructor() {
    super('GameScene');
  }

  /**
   * init() 会在 create() 之前自动执行，用来接收"上一个场景传过来的数据"
   * data = {
   *   levelIndex:      第几关(从0开始),
   *   elapsedBefore:   之前各关累计用时(秒),
   *   carriedWeapon:   上一关结束时主角拿着的武器类型 ('fist'/'sword'/'bow')，
   *                    关卡之间武器不丢失，下一关开始时主角自动装备上
   * }
   * 注意：不要写成 this.data ，那是 Phaser 自己的保留属性！
   */
  init(data) {
    const d = data || {};
    this.levelIndex = d.levelIndex || 0;
    this.elapsedBefore = d.elapsedBefore || 0;
    // 关卡间继承武器——undefined 或 'fist' 都当作赤手空拳
    this.carriedWeapon = d.carriedWeapon && d.carriedWeapon !== 'fist'
      ? d.carriedWeapon
      : null;
  }

  create() {
    this.gameEnded = false;          // 本关是否已经结束（结束就冻结一切）
    this._levelCleared = false;      // BOSS 击杀大招的 callback 是否已经触发过（防重入）
    this.startTime = this.time.now;  // 记下本关开始的时间，用来算用时

    // ---- 弓远程攻击状态 ----
    // 同一时间只能有一支箭在飞（防止一秒射多支屏幕乱飞）
    this.currentArrow = null;
    // 弓攻击冷却结束时间戳（毫秒）。设成 0 = 一开始就能射
    this.arrowCooldownUntil = 0;
    // 弓射程：2 格 = 2 × 64 像素 = 128
    this.bowRange = CFG.tileSize * 2;

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

    // 【关键一步】再"选一次瓦片"：
    //   把 0/1/2 这种粗网格，换成"具体该用第几号瓦片"，
    //   草地会随机挑一张变体、道路会按四周是不是草地自动决定要不要画路缘。
    //   这样每格长得略有不同，整张地图就不是"一块方块反复贴"了。
    const painted = Utils.decorateGrid(data.grid);

    // make.tilemap：用"二维数字数组"直接生成一张瓦片地图
    this.map = this.make.tilemap({
      data: painted,
      tileWidth: CFG.tileSize,
      tileHeight: CFG.tileSize
    });

    // 把 BootScene 里"烤"好的瓦片图集注册给这张地图
    // 参数含义：瓦片名字, 纹理名, 单格宽, 单格高, 边距, 间距
    const tileset = this.map.addTilesetImage('tiles', 'tex-tiles', CFG.tileSize, CFG.tileSize, 0, 0);

    // createLayer：把第 0 层真正画到画面上，并整体偏移到居中位置
    this.mapLayer = this.map.createLayer(0, tileset, CFG.mapOffsetX, CFG.mapOffsetY);

    // ★关键：把"草地"的那几个编号（CFG.tiles.grass = 0~3）全部设成墙。
    //   这样主角撞上去就会被挡住，只能沿着路（带路缘的那几种）和终点（24 号）走。
    //   注意：草地现在有 4 种变体，所以要把 4 个编号一起传进去，不然随机换到别种变体的格子就变成能穿过去了。
    this.mapLayer.setCollision(CFG.tiles.grass);

    // ---------- 4) 主角：出生在字符画里的 'S' 格中心 ----------
    const startPos = Utils.cellCenter(data.start.col, data.start.row);
    this.player = new Player(this, startPos.x, startPos.y);

    // 关卡间继承武器：如果上一关结束时拿着剑或弓，
    // 下一关主角出生后立刻装备上（silent=true 不播"学会挥剑!"的飘字，
    // 因为玩家已经在上一关学会了，这里只是"继续使用"）
    if (this.carriedWeapon) {
      this.player.equipWeapon(this.carriedWeapon, true);
    }

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
        // 同时从 itemTextures 数组里取对应的纹理名（按道具出现顺序匹配武器图案）
        const texName = level.itemTextures && level.itemTextures[itemIndex]
          ? 'tex-item-' + level.itemTextures[itemIndex]
          : 'tex-item'; // 没配置就用旧的占位纹理（保底）
        itemIndex++;
        this.spawnPickup(value, s.col, s.row, texName);
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

    // ---- 弓远程攻击（自动扫描 + 自动射）----
    // 拿到弓之后，走到哪都会自动在 2 格射程内找怪射
    this.updateBowAttack();

    // 刷新顶部状态栏
    this.updateHUD();
  }

  /**
   * 弓远程攻击逻辑：
   *   1) 当前武器必须是 bow、游戏还没结束、没有箭在飞、冷却结束
   *   2) 扫描所有存活怪物，找出距离主角最近且在射程内的那只
   *   3) 发射 Projectile，飞到后回调 onArrowHit
   */
  updateBowAttack() {
    if (this.player.weaponType !== 'bow') return;      // 没拿弓就跳过
    if (this.currentArrow) return;                      // 有箭在飞就等
    if (this.time.now < this.arrowCooldownUntil) return; // 冷却没到就等

    // 扫描怪物组，找最近的
    const p = this.player;
    let bestTarget = null;
    let bestDist = Infinity;

    this.monsterGroup.getChildren().forEach((m) => {
      if (m.isDead) return; // 已死忽略
      const dx = m.x - p.x;
      const dy = m.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        bestTarget = m;
      }
    });

    if (!bestTarget) return; // 没怪就不射

    const dist = Math.sqrt(bestDist);
    if (dist > this.bowRange) return; // 射程外就不射

    // 发射！
    p.playShootAnim();
    this.currentArrow = new Projectile(
      this,
      p.x, p.y,
      bestTarget.x, bestTarget.y,
      () => this.onArrowHit(bestTarget) // 箭头飞到后回调
    );
    // 设置冷却：400ms 内不射第二箭
    this.arrowCooldownUntil = this.time.now + 400;
  }

  /**
   * 弓的箭命中了（飞行完毕）
   * 跟 onTouchMonster 用一样的战力对比逻辑，
   * 只是触发条件变成"箭飞到目标位置"而不是"物理碰撞"
   */
  onArrowHit(targetMonster) {
    this.currentArrow = null; // 箭飞完了，可以射下一支

    if (this.gameEnded || !targetMonster || targetMonster.isDead) return;

    const p = this.player;
    if (p.power > targetMonster.power) {
      // 打赢了：怪被射死
      const gain = targetMonster.power;
      const wasBoss = targetMonster.isBoss;

      // 远程攻击也播一下玩家的攻击动作（箭已经在空中了，
      // 这里补一下视觉反馈——玩家身体微微一振）
      const g = this.add.graphics();
      g.fillStyle(0x66e08a, 0.8);
      g.fillCircle(p.x, p.y, 14);
      this.tweens.add({
        targets: g, alpha: 0, scaleX: 1.5, scaleY: 1.5,
        duration: 200, onComplete: () => g.destroy()
      });

      targetMonster.kill();
      p.addPower(gain);
      Utils.floatText(this, targetMonster.x, targetMonster.y - 20, '+' + gain, '#66e08a');
      this.refreshThreatMarks();

      if (wasBoss) {
        // BOSS 击杀：先播"万箭齐发"特效，再过关
        this.playBossKillEffect('bow', { x: targetMonster.x, y: targetMonster.y }, () => this.levelClear());
      }

    } else if (p.power < targetMonster.power) {
      // 打不过：弓箭没伤害，目标闪一下红光表示"挡住了"
      this.cameras.main.shake(80, 0.003);
      Utils.floatText(this, targetMonster.x, targetMonster.y - 20, '无效!', '#ff5a5a');
      // 不取消游戏、不掉血——弓只是远程工具，打不过就打不过
      // 让玩家近战碰一碰自己就会死亡，或者绕过这个怪
    } else {
      // 数值一样：白圈撞不动，远程也射不死，闪一下白色"格挡"
      Utils.floatText(this, targetMonster.x, targetMonster.y - 20, '挡住!', '#ffffff');
    }
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

  // 在死路尽头放一个道具（武器/法器图案）
  // texture 是纹理 key，例如 'tex-item-sword'，由上面的 spawn 循环按 itemTextures 数组传入
  spawnPickup(value, col, row, texture = 'tex-item') {
    const pos = Utils.cellCenter(col, row);
    // 纹理名传给 Pickup 构造函数，武器画本身已经带颜色，不再需要 setTint 染金色
    const p = new Pickup(this, pos.x, pos.y, value, texture);
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
      // ---- 打赢了：先播攻击动画，再把怪干掉、增加战力 ----
      const gain = monster.power;
      const wasBoss = monster.isBoss;

      console.log('[onTouchMonster] 打赢了', { gain, wasBoss, weapon: player.weaponType });

      // 攻击动画（拳头冲一下 / 剑劈一下）
      player.playAttackAnim(monster.x, monster.y);

      monster.kill();
      player.addPower(gain);
      Utils.floatText(this, monster.x, monster.y - 20, '+' + gain, '#66e08a');
      this.refreshThreatMarks(); // 战力变了，所有怪物的状态光环要重新算

      if (wasBoss) {
        console.log('[onTouchMonster] BOSS 已死，开始播大招');
        // BOSS 击杀：先播对应武器的大招特效，再过关
        this.playBossKillEffect(this.player.weaponType, { x: monster.x, y: monster.y }, () => {
          console.log('[BOSS特效 callback] 被触发！');
          try {
            this.levelClear();
            console.log('[BOSS特效 callback] levelClear() 调用完毕');
          } catch (e) {
            console.error('[BOSS特效 callback] levelClear 炸了:', e);
          }
        });
        console.log('[onTouchMonster] playBossKillEffect 返回');
      }

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
  // 额外：如果这个道具是剑或弓，顺便装备对应的武器
  onTouchItem(player, item) {
    if (this.gameEnded || item.isDead) return;

    const v = item.value;
    item.kill();
    player.addPower(v);
    Utils.floatText(this, item.x, item.y - 20, '+' + v, '#ffd24d');
    this.refreshThreatMarks();

    // ---- 武器检测 ----
    // Pickup 构造函数把纹理名记成了 'tex-item-sword' / 'tex-item-bow' 等，
    // 所以看 item.texture.key 是否以 'tex-item-' 开头、后缀是 'sword'/'bow'
    const texKey = item.texture && item.texture.key ? item.texture.key : '';
    const weaponMap = {
      'tex-item-sword': 'sword',
      'tex-item-bow': 'bow'
    };
    if (weaponMap[texKey]) {
      player.equipWeapon(weaponMap[texKey]);
      this.updateHUD(); // HUD 立刻刷新武器名
    }
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

    this.cancelFlyingArrow();         // 取消正在飞的箭（否则箭飞一半场景就销毁了）
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
  // 注意：BOSS 击杀大招里会先设 gameEnded=true 冻结游戏，
  // 然后等大招播完再调 levelClear()。
  // 所以这里用独立的 _levelCleared 标记而不是 gameEnded——
  // 让 gameEnded 只管"冻结 update"，_levelCleared 只管"跳不跳转场景"。
  levelClear() {
    if (this._levelCleared) return; // 防重入（安全网 delayedCall 可能先到）
    this._levelCleared = true;

    this.cancelFlyingArrow();         // 取消正在飞的箭
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
        // 还有下一关 → 战力重置到 3，但武器不丢失
        this.scene.start('GameScene', {
          levelIndex: this.levelIndex + 1,
          elapsedBefore: total,
          carriedWeapon: this.player.weaponType // 武器带到下一关
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
    this.powerText = this.add.text(CFG.width / 2 - 70, 24, '', hudStyle).setOrigin(0.5, 0); // 中间偏左：战力
    this.weaponText = this.add.text(CFG.width / 2 + 60, 24, '', {
      ...hudStyle, fontSize: '20px', color: '#ffd24d'
    }).setOrigin(0.5, 0);                                                              // 中间偏右：当前武器
    this.timeText = this.add.text(CFG.width - 20, 24, '', hudStyle).setOrigin(1, 0);   // 右侧：用时

    // 底部操作提示
    this.add.text(CFG.width / 2, CFG.height - 10,
      'WASD / 方向键沿路走 · 绿圈紫圈=现在能打，红圈=打不过，白圈=数值相同 · R 键重开本关', {
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

    // 当前武器名（金色显示）
    const weaponNames = { fist: '拳头', sword: '⚔ 剑', bow: '🏹 弓' };
    this.weaponText.setText(weaponNames[this.player.weaponType] || '拳头');
  }

  /**
   * 清理：取消正在飞行的箭
   * 在关卡结束（死亡/过关）时必须调用，
   * 否则箭还在飞、tween 还没结束就会在销毁场景时报错
   */
  cancelFlyingArrow() {
    if (this.currentArrow) {
      this.currentArrow.cancel();
      this.currentArrow = null;
    }
  }

  /**
   * BOSS 击杀大招特效——像素版"万剑归宗"/"万箭齐发"/"万拳归宗"
   * @param {string} weaponType 'fist'/'sword'/'bow'
   * @param {{x:number, y:number}} bossPos BOSS 最后所在位置（在 kill() 之前存好的）
   * @param {Function} callback 特效播完后调用（一般是 levelClear）
   *
   * 【可靠性设计】
   *  - 开头立刻设 this.gameEnded = true → update() 冻结，弓不再射、键盘不再响应
   *  - 用 delayedCall 时间轴调度，所有 tween 只是"视觉装饰"，
   *    不再依赖 tween.onComplete 来触发 callback（tween 挂了不会卡死）
   *  - 2500ms 安全网：无论特效内部哪步挂了，到了时间无条件调 callback
   *
   * 时间轴：
   *   0ms     → gameEnded=true + physics.pause + 黑幕 + 闪白
   *   200ms   → 主特效开始（剑落下 / 箭飞来 / 拳头飞射）
   *   1200ms  → 爆光 + 屏幕抖 + callback() → levelClear()
   *   2500ms  → 安全网：如果还没调 callback，强制调
   */
  playBossKillEffect(weaponType, bossPos, callback) {
    console.log('[playBossKillEffect] START', { weaponType, bossPos });

    // ★ 第一步立刻冻结游戏——update() 会因为 gameEnded=true 而 return，
    // 弓不再自动射、键盘不再响应、怪物不再更新
    this.gameEnded = true;
    this.cancelFlyingArrow();     // 取消正在飞的箭（物理暂停了它们也动不了）
    this.physics.pause();         // 物理引擎冻结（但 tween / delayedCall / time 不受影响）

    const bx = bossPos.x;
    const by = bossPos.y;

    try {
      // ---------- 0ms: 黑幕 + 闪白 ----------
      const veil = this.add.rectangle(0, 0, CFG.width, CFG.height, 0x000000, 0.4).setOrigin(0).setDepth(100);
      const flash = this.add.rectangle(0, 0, CFG.width, CFG.height, 0xffffff, 0.9).setOrigin(0).setDepth(101);
      this.tweens.add({ targets: flash, alpha: 0, duration: 120, onComplete: () => flash.destroy() });

      // ---------- 200ms: 主特效 ----------
      this.time.delayedCall(200, () => {
        try {
          console.log('[playBossKillEffect] 200ms 开始主特效');
          switch (weaponType) {
            case 'sword':  this.doSwordStorm(bx, by);   break;
            case 'bow':    this.doArrowStorm(bx, by);    break;
            default:       this.doFistStorm(bx, by);
          }
          console.log('[playBossKillEffect] 200ms 主特效结束');
        } catch (e) {
          console.error('[playBossKillEffect] 200ms 主特效炸了:', e);
        }
      });

      // ---------- 1200ms: 收尾 + callback ----------
      this.time.delayedCall(1200, () => {
        console.log('[playBossKillEffect] 1200ms 到达');
        if (this._levelCleared) return;

        try {
          // 收尾特效（爆光 + 屏幕抖 + 黑幕淡出）
          const boom = this.add.graphics().setDepth(102);
          boom.fillStyle(weaponType === 'bow' ? 0xffd24d : 0xffffff, 0.9);
          boom.fillCircle(bx, by, 40);
          this.tweens.add({
            targets: boom,
            scaleX: 8, scaleY: 8, alpha: 0,
            duration: 300, ease: 'Quad.easeOut',
            onComplete: () => boom.destroy()
          });

          this.cameras.main.shake(160, 0.015);

          // 黑幕淡出（这只是视觉效果，callback 立刻就调，不等它）
          this.tweens.add({
            targets: veil, alpha: 0, duration: 300, onComplete: () => veil.destroy()
          });

          // ★ 直接调 callback → levelClear()，不等 veil tween 完成
          console.log('[playBossKillEffect] 1200ms 调 callback');
          if (callback) callback();
          console.log('[playBossKillEffect] 1200ms callback 返回');
        } catch (e) {
          console.error('[playBossKillEffect] 1200ms 收尾炸了:', e);
        }
      });

      // ---------- 2500ms 安全网 ----------
      this.time.delayedCall(2500, () => {
        console.log('[playBossKillEffect] 2500ms 安全网检查 _levelCleared=', this._levelCleared);
        if (!this._levelCleared) {
          console.warn('[BOSS特效] 安全网触发！强制 levelClear()');
          try {
            callback();
          } catch (e) {
            console.error('[BOSS特效] 安全网 callback 也炸了:', e);
            // 万不得已，直接跳结算页
            this.scene.start('ResultScene', {
              win: false,
              level: this.levelIndex + 1,
              power: this.player.power,
              time: Number(this.totalTime().toFixed(1)),
              elapsedBefore: this.elapsedBefore
            });
          }
        }
      });
    } catch (e) {
      console.error('[playBossKillEffect] 外层炸了:', e);
      // 立刻走安全网兜底
      this.scene.start('ResultScene', {
        win: false,
        level: this.levelIndex + 1,
        power: this.player.power,
        time: Number(this.totalTime().toFixed(1)),
        elapsedBefore: this.elapsedBefore
      });
    }
  }

  // ---------- 以下三种大招实现：用 Graphics 画物体、tween 让它们飞 ----------

  /**
   * 万剑归宗：10 把银剑从画面上方交错落下到 BOSS 位置
   */
  doSwordStorm(bx, by) {
    const swordCount = 10;
    const fallStartY = CFG.playTop; // 从 HUD 下面开始落下
    const fallEndY = by;
    const fallHeight = fallEndY - fallStartY;

    // 剑的宽度（Graphics 画的是 24×36 的三角形剑身 + 护手）
    for (let i = 0; i < swordCount; i++) {
      const delay = (i % 2 === 0 ? 0 : 150) + i * 20; // 交错延迟，让落下更有层次感
      const x0 = Phaser.Math.Between(30, CFG.width - 30);   // 初始 x 随机分布在画面顶部
      const y0 = fallStartY - 40;                           // 初始 y 在 HUD 上方一点
      // 终点微微左右散开（+/- 20px），让 10 把剑落到 BOSS 位置附近更有"剑阵"感
      const tx = bx + Phaser.Math.Between(-20, 20);
      const ty = fallEndY + Phaser.Math.Between(-15, 15);

      this.time.delayedCall(delay, () => {
        const g = this.add.graphics().setDepth(90);
        // 画一把剑：以 (0,0) 为中心绘制
        // 银灰剑身（尖头朝下的倒三角，顶点在 (0, 18)）
        g.fillStyle(0xc9cdd3, 1);
        g.fillTriangle(-12, -18, 0, 18, 12, -18);
        // 金色护手（水平短横线，在剑尖上方 y=-18 处）
        g.lineStyle(3, 0xd4af37, 1);
        g.beginPath();
        g.moveTo(-14, -18);
        g.lineTo(14, -18);
        g.strokePath();
        // 棕色剑柄（在护手上方）
        g.fillStyle(0x8b5a2b, 1);
        g.fillTriangle(-6, -30, 0, -20, 6, -30);
        // ★ Graphics 没有 setOrigin！直接 setPosition 到初始位置
        g.setPosition(x0, y0);

        // tween 落下 + 轻微左右摆动（用 yoyo 让它 overshoot 再回一下）
        this.tweens.add({
          targets: g,
          x: tx + Phaser.Math.Between(-8, 8),
          y: ty,
          duration: 500,
          ease: 'Quad.easeIn',
          // 到达后再抖动一下（类似"扎进去又弹一下"）
          onComplete: () => {
            this.tweens.add({
              targets: g,
              y: ty + 6, // 扎进去 6px
              duration: 60,
              yoyo: true,
              onComplete: () => g.destroy()
            });
          }
        });
      });
    }
  }

  /**
   * 万箭齐发：8 支箭从 BOSS 周围 8 个方向同时飞射到 BOSS 位置
   */
  doArrowStorm(bx, by) {
    const arrowCount = 8;

    for (let i = 0; i < arrowCount; i++) {
      // 8 个方向角（0°=右, 45°=右下, 90°=下 ...）
      const angle = (i * 360 / arrowCount) * Math.PI / 180; // 弧度
      const dist = Phaser.Math.Between(200, 280); // 起始距离（随机一下更自然）
      const x0 = bx + Math.cos(angle) * dist;
      const y0 = by + Math.sin(angle) * dist;

      // 箭方向角（度），箭头朝 BOSS
      const arrowAngle = Phaser.Math.RadToDeg(Math.atan2(by - y0, bx - x0));

      this.time.delayedCall(i * 30, () => {
        const g = this.add.graphics().setDepth(90);
        // 画一支箭：以 (0,0) 为中心绘制
        // 深灰箭身（水平线，长度 18px）
        g.lineStyle(3, 0x3a3a3a, 1);
        g.beginPath();
        g.moveTo(-10, 0);
        g.lineTo(8, 0);
        g.strokePath();
        // 银色箭头（朝右的三角形）
        g.fillStyle(0xc9cdd3, 1);
        g.fillTriangle(12, 0, 6, -4, 6, 4);
        // 棕色尾羽（朝左的小三角）
        g.fillStyle(0x8b5a2b, 1);
        g.fillTriangle(-10, 0, -12, -4, -6, -1);
        g.fillTriangle(-10, 0, -12, 4, -6, 1);
        // ★ Graphics 没有 setOrigin
        g.setPosition(x0, y0);
        g.setAngle(arrowAngle);

        // tween 飞向 BOSS（速度 1.2x 正常箭）
        this.tweens.add({
          targets: g,
          x: bx,
          y: by,
          duration: 280,
          ease: 'Quad.easeOut',
          onComplete: () => g.destroy()
        });
      });
    }
  }

  /**
   * 万拳归宗：14 个金色拳头圆圈从主角位置向 BOSS 飞射
   */
  doFistStorm(bx, by) {
    const p = this.player;
    const fistCount = 14;

    for (let i = 0; i < fistCount; i++) {
      // 分散在主角周围的随机起始位置（像是"同时打出 14 拳"）
      const spread = 40;
      const x0 = p.x + Phaser.Math.Between(-spread, spread);
      const y0 = p.y + Phaser.Math.Between(-spread, spread);
      // 终点随机散开（+/- 30px）
      const tx = bx + Phaser.Math.Between(-30, 30);
      const ty = by + Phaser.Math.Between(-30, 30);

      const delay = i * 25; // 错开发射，形成连发效果

      this.time.delayedCall(delay, () => {
        const g = this.add.graphics().setDepth(90);
        // 金色拳头（填充圆 + 深色边 + 内部小十字线代表"拳头"）
        g.fillStyle(0xffd24d, 1);
        g.fillCircle(0, 0, 10);
        g.lineStyle(2, 0x8b6914, 1);
        g.strokeCircle(0, 0, 10);
        g.lineStyle(1, 0x8b6914, 1);
        g.beginPath();
        g.moveTo(-4, -1); g.lineTo(4, -1);
        g.moveTo(0, -5); g.lineTo(0, 5);
        g.strokePath();

        g.setPosition(x0, y0);
        // 初始缩放 0.3，飞行中放大，到达后再缩小淡出
        g.setScale(0.3);

        this.tweens.add({
          targets: g,
          x: tx,
          y: ty,
          scaleX: 1,
          scaleY: 1,
          duration: 350,
          ease: 'Quad.easeIn',
          onComplete: () => {
            // 到达后爆一下小圆圈再销毁
            this.tweens.add({
              targets: g,
              scaleX: 1.8, scaleY: 1.8, alpha: 0,
              duration: 140, onComplete: () => g.destroy()
            });
          }
        });
      });
    }
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
