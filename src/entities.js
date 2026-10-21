/* =========================================================
 * entities.js —— 游戏实体类（玩家 / 怪物 / 道具）
 * ---------------------------------------------------------
 * 每个类代表"一个会出现在画面上的东西"，
 * 它只管自己的行为，不关心关卡怎么结束、界面怎么显示。
 * ========================================================= */

// ---------------------------------------------------------
// 玩家（像素风勇者）
// ---------------------------------------------------------
class Player extends Phaser.Physics.Arcade.Sprite {

  constructor(scene, x, y) {
    super(scene, x, y, 'tex-player'); // 'tex-player' 是 BootScene 里画出来的像素勇者

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.power = CFG.player.startPower; // 头顶那个数字，就是他的"战力"
    this.setCollideWorldBounds(true);   // 撞到世界边界会被挡住（草地墙是靠地图碰撞实现的）

    // ---- 武器状态 ----
    // 'fist' = 赤手空拳（初始）
    // 'sword' = 第一关拿到剑后，近战带挥剑特效
    // 'bow' = 第二关拿到弓后，可远程射箭（2 格内）
    this.weaponType = 'fist';
    this.weaponGfx = null;  // 武器图标的 Graphics 对象（画在玩家身上）

    // 攻击动画中（true 时不再触发新的攻击动画，避免重复叠加）
    this.isAttacking = false;

    // 被撞开时的"硬直"结束时间戳（用毫秒时间表示）。
    // 这个时间里键盘输入会被忽略，主角只能顺着刚才那一推滑出去。
    this.lockedUntil = 0;

    // 两套键位：WASD 和 方向键
    this.keys = scene.input.keyboard.addKeys('W,A,S,D');
    this.cursors = scene.input.keyboard.createCursorKeys();

    // 头顶的战力数字
    this.label = scene.add.text(x, y - 26, String(this.power), {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#8be9fd',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    this.syncLabel();
  }

  // 每一帧都会被 GameScene 调用一次
  update() {
    // ★ 武器图标每帧跟着玩家位置（必须第一行就调，因为后面可能有 early return）
    this._syncWeaponGfx();

    // 0) 先看是不是还在"被弹开"的硬直时间里。
    //    如果是，就不读键盘（否则下一帧立刻把速度改回走路速度，
    //    刚才那一推就白推了），只同步一下头顶数字。
    if (this.scene.time.now < this.lockedUntil) {
      this.syncLabel();
      return;
    }

    // 0.5) 正在播放近战攻击动画时，也暂时不管键盘输入。
    //      因为 playAttackAnim 里是用 tween 把主角"推出去再弹回来"，
    //      如果这时 update 还在 setVelocity，会跟 tween 的位置变化打架，
    //      导致攻击动作中途被拉回来、或者抖动。
    if (this.isAttacking) {
      this.setVelocity(0, 0);
      this.syncLabel();
      return;
    }

    // 1) 读键盘，得到方向（-1 / 0 / 1）
    let vx = 0;
    let vy = 0;
    if (this.keys.A.isDown || this.cursors.left.isDown) vx -= 1;
    if (this.keys.D.isDown || this.cursors.right.isDown) vx += 1;
    if (this.keys.W.isDown || this.cursors.up.isDown) vy -= 1;
    if (this.keys.S.isDown || this.cursors.down.isDown) vy += 1;

    // 2) 斜着走要乘 0.7071，否则斜向速度会比直线快 1.41 倍（经典新手坑）
    if (vx !== 0 && vy !== 0) {
      vx *= 0.7071;
      vy *= 0.7071;
    }

    // 3) 把速度交给物理系统，主角就会动起来；草地是墙，会自动把他挡住
    this.setVelocity(vx * CFG.player.speed, vy * CFG.player.speed);

    this.syncLabel();
  }

  // 增加战力（吃到怪物或道具时调用）
  addPower(value) {
    this.power += value;
    if (this.label) this.label.setText(String(this.power));
  }

  /**
   * 装备武器（拾取到剑或弓时调用；也在关卡间恢复时调用）
   * @param {string} wType 'sword' 或 'bow'
   * @param {boolean} silent 为 true 时不播金色闪光和飘字提示——
   *   用于关卡间"继承已有武器"（玩家已经在 L1 学会挥剑，L2 开始就有剑，
   *   不需要再播一次"学会挥剑!"的提示）
   */
  equipWeapon(wType, silent = false) {
    this.weaponType = wType;

    // ★ 给玩家身上画出武器图标（赤手时清除）
    this._drawWeaponOnBody();

    if (!silent) {
      // 装备特效：整个角色闪一下金色，表示"学到新技能"
      this.setTintFill(0xffd24d);
      this.scene.time.delayedCall(200, () => {
        if (this && this.active) this.clearTint();
      });

      // 头顶飘字提示
      const label = { sword: '学会挥剑!', bow: '学会射箭!' }[wType] || '';
      if (label) Utils.floatText(this.scene, this.x, this.y - 40, label, '#ffd24d');
    }
  }

  /**
   * 在玩家身上画武器小图标（剑/弓），让玩家一眼看到自己装备了什么
   * 图标的 Graphics 对象定位在玩家身上，update() 里 setPosition 跟着走
   */
  _drawWeaponOnBody() {
    // 先清掉旧的（如果有）
    if (this.weaponGfx) { this.weaponGfx.destroy(); this.weaponGfx = null; }

    if (this.weaponType === 'fist') return;

    // ★ Graphics 定位在玩家中心，所有绘制用相对坐标（12,4 = 右侧腰间）
    const g = this.scene.add.graphics().setDepth(this.depth + 1).setPosition(this.x, this.y);
    const ox = 12;
    const oy = 4;

    if (this.weaponType === 'sword') {
      // 小剑：金色剑锋 + 深色剑柄，斜向挂在身上
      g.lineStyle(3, 0xffe066, 1);  // 金色剑锋
      g.beginPath();
      g.moveTo(ox - 10, oy + 10);   // 剑尖（下）
      g.lineTo(ox + 8, oy - 8);     // 剑柄（上）
      g.strokePath();
      // 剑柄（深色）
      g.lineStyle(3, 0x3d2817, 1);
      g.beginPath();
      g.moveTo(ox + 6, oy - 6);
      g.lineTo(ox + 10, oy - 10);
      g.strokePath();
      // 护手（金色剑格）
      g.lineStyle(2, 0xc9a227, 1);
      g.beginPath();
      g.moveTo(ox + 4, oy - 4);
      g.lineTo(ox + 8, oy - 8);
      g.strokePath();
    } else if (this.weaponType === 'bow') {
      // 小弓：弧形弓身 + 弓弦 + 搭在上面的箭
      g.lineStyle(3, 0x8b5a2b, 1);  // 棕色弓身
      g.beginPath();
      g.arc(ox + 2, oy - 2, 10, Math.PI * 0.25, Math.PI * 0.75, false);
      g.strokePath();
      // 弓弦（白色）
      g.lineStyle(1, 0xeeeeee, 0.9);
      g.beginPath();
      g.moveTo(ox + 9, oy - 8);
      g.lineTo(ox + 9, oy + 5);
      g.strokePath();
      // 一支小箭搭在弓上
      g.lineStyle(1, 0xaaaaaa, 1);
      g.beginPath();
      g.moveTo(ox - 2, oy - 1);
      g.lineTo(ox + 10, oy - 1);
      g.strokePath();
    }

    this.weaponGfx = g;
  }

  /** 让武器图标跟着玩家位置移动（每帧 update 调用） */
  _syncWeaponGfx() {
    if (this.weaponGfx) {
      this.weaponGfx.setPosition(this.x, this.y);
      // 武器图标在玩家上层绘制
      this.weaponGfx.setDepth(this.depth + 1);
    }
  }

  /**
   * 近战攻击动画（拳头 / 剑）
   * 每次近战击杀时先播放一下动画再把怪干掉
   * @param {number} targetX 目标（被击杀的怪物）的 x
   * @param {number} targetY 目标（被击杀的怪物）的 y
   */
  playAttackAnim(targetX, targetY) {
    if (this.isAttacking) return; // 正在攻击中就不重复触发
    this.isAttacking = true;

    // 1) 计算朝向（从主角指向怪物的单位向量）
    let dx = targetX - this.x;
    let dy = targetY - this.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= len;
    dy /= len;

    // 2) 先向前冲一小段距离（lunge），再弹回来
    //    duration 180ms 够快，不会觉得卡顿
    //    剑冲更远（劈砍动作幅度大），弓和拳头短（近身/远程不需要大动作）
    const lungeDist = this.weaponType === 'sword' ? 26
                    : this.weaponType === 'bow' ? 6
                    : 10;
    const startX = this.x;
    const startY = this.y;

    this.scene.tweens.add({
      targets: this,
      x: startX + dx * lungeDist,
      y: startY + dy * lungeDist,
      duration: 90,
      yoyo: true,       // 冲出去再弹回来
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.isAttacking = false;
      }
    });

    // 3) 武器特效
    if (this.weaponType === 'sword') {
      // 剑劈砍：主角身体先缩一下再弹回来（"挥剑"的肢体感）
      this.scene.tweens.add({
        targets: this,
        scaleX: 1.3, scaleY: 0.8, duration: 60, yoyo: true, ease: 'Quad.easeOut'
      });

      // 剑光特效组
      this.scene.time.delayedCall(50, () => {
        const g = this.scene.add.graphics().setDepth(90);

        // ---- 金色剑锋（内弧，亮金）----
        g.lineStyle(5, 0xffe066, 1);
        g.beginPath();
        g.moveTo(targetX - 24, targetY - 12);
        g.lineTo(targetX + 24, targetY + 12);
        g.strokePath();

        // ---- 白色剑光（外弧，交叉）----
        g.lineStyle(4, 0xffffff, 0.95);
        g.beginPath();
        g.moveTo(targetX + 20, targetY - 20);
        g.lineTo(targetX - 20, targetY + 20);
        g.strokePath();

        // ---- 剑锋闪光（两圈叠加：内实外虚）----
        g.fillStyle(0xffffff, 0.85);
        g.fillCircle(targetX, targetY, 14);
        g.fillStyle(0xffe066, 0.5);
        g.fillCircle(targetX, targetY, 22);

        // ---- 十字星芒爆炸 ----
        g.lineStyle(2, 0xffffff, 0.9);
        const stars = 8;
        for (let i = 0; i < stars; i++) {
          const ang = (i / stars) * Math.PI * 2;
          const r1 = 18, r2 = 36;
          g.beginPath();
          g.moveTo(targetX + Math.cos(ang) * r1, targetY + Math.sin(ang) * r1);
          g.lineTo(targetX + Math.cos(ang) * r2, targetY + Math.sin(ang) * r2);
          g.strokePath();
        }

        // 快速放大+淡出+销毁
        this.scene.tweens.add({
          targets: g,
          alpha: 0,
          scaleX: 1.6,
          scaleY: 1.6,
          angle: 18,
          duration: 220,
          ease: 'Quad.easeIn',
          onComplete: () => g.destroy()
        });
      });

      // 剑光"咔嚓"的屏幕闪白（一个小矩形覆盖画面）
      this.scene.time.delayedCall(60, () => {
        const flash = this.scene.add.rectangle(0, 0, CFG.width, CFG.height, 0xffffff, 0.35)
          .setOrigin(0).setDepth(95);
        this.scene.tweens.add({
          targets: flash, alpha: 0, duration: 80, onComplete: () => flash.destroy()
        });
      });
    } else if (this.weaponType === 'bow') {
      // 弓击杀：命中时在怪物位置画一个靶心（小+大两个圈 + 十字准星）
      this.scene.time.delayedCall(50, () => {
        const g = this.scene.add.graphics().setDepth(90);
        g.lineStyle(3, 0xffd24d, 0.9);
        g.strokeCircle(targetX, targetY, 16);
        g.lineStyle(2, 0xffffff, 0.9);
        g.strokeCircle(targetX, targetY, 8);
        // 十字准星
        g.lineStyle(1, 0xffffff, 0.7);
        g.beginPath();
        g.moveTo(targetX - 12, targetY); g.lineTo(targetX + 12, targetY);
        g.moveTo(targetX, targetY - 12); g.lineTo(targetX, targetY + 12);
        g.strokePath();

        this.scene.tweens.add({
          targets: g, alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 200,
          onComplete: () => g.destroy()
        });
      });
    } else {
      // 拳头：怪物位置闪一个小拳头标记（"啪"的一下）
      this.scene.time.delayedCall(50, () => {
        const g = this.scene.add.graphics().setDepth(90);
        g.fillStyle(0xffffff, 0.7);
        g.fillCircle(targetX, targetY, 8);
        this.scene.tweens.add({
          targets: g,
          alpha: 0,
          scaleX: 1.8,
          scaleY: 1.8,
          duration: 140,
          onComplete: () => g.destroy()
        });
      });
    }
  }

  /**
   * 弓射击动画：角色拉弓（身体微微一缩）然后发射
   * 箭本身由 Projectile 类单独负责飞行和命中
   */
  playShootAnim() {
    // 身体先缩一下（scaleY 压到 0.9）然后立刻弹回来，表示"拉弓+放箭"
    this.scene.tweens.add({
      targets: this,
      scaleY: 0.85,
      scaleX: 1.05,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut'
    });

    // 整个角色微微闪一下白（放箭瞬间的冲击力）
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (this && this.active) this.clearTint();
    });
  }

  // 锁住键盘输入一小段时间（毫秒）
  // 撞到"和自己一样大"的怪物时用：先让他被弹开一小段，这段时间玩家按键没用
  lockInput(ms) {
    this.lockedUntil = this.scene.time.now + ms;
  }

  // 让头顶数字一直跟着自己
  syncLabel() {
    if (this.label) this.label.setPosition(this.x, this.y - 26);
  }

  // 覆写销毁方法：销毁主角时顺手把头顶数字也销毁
  destroy(fromScene) {
    if (this.label) {
      this.label.destroy();
      this.label = null;
    }
    super.destroy(fromScene);
  }
}

// ---------------------------------------------------------
// 怪物（小怪和 BOSS 共用一个类，用 isBoss 区分）
//   - 站在路上挡路：不会移动，速度永远为 0
//   - 用 texture 决定长相（史莱姆 / 哥布林 / 岩石怪 / 魅魔）
//   - 外面套一圈"状态光环"：告诉玩家这只现在能不能打
//     绿圈 = 能吃   红圈 = 会死   紫圈 = BOSS 能打   灰圈 = BOSS 打不过
// ---------------------------------------------------------
class Monster extends Phaser.Physics.Arcade.Sprite {

  /**
   * @param {Phaser.Scene} scene
   * @param {number} x,y   所在格子的中心坐标
   * @param {number} power 头顶数值（战力）
   * @param {object} opts  { isBoss: 是否BOSS, texture: 用哪张纹理 }
   */
  constructor(scene, x, y, power, opts = {}) {
    const isBoss = !!opts.isBoss;
    super(scene, x, y, opts.texture || (isBoss ? 'tex-boss-goblin' : 'tex-slime'));

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.power = power;
    this.isBoss = isBoss;
    this.isDead = false;  // 防止同一帧里被重复判定

    // 挡路怪：原地不动
    this.setImmovable(true);
    this.setVelocity(0, 0);

    // 头顶数字：BOSS 的数字更大更醒目
    this.label = scene.add.text(x, y, String(power), {
      fontFamily: 'sans-serif',
      fontSize: isBoss ? '26px' : '18px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    // 状态光环：一圈彩色描边（本身就是"空心的圆"，只有描边会显示出来）
    this.halo = scene.add.circle(x, y, isBoss ? 29 : 21, 0xffffff, 0)
      .setStrokeStyle(isBoss ? 4 : 3, 0xffffff, 0.95);

    this.setThreat(false); // 先按"打不过"上色，GameScene 之后会重新算
    this.syncLabel();
  }

  /**
   * 更新状态颜色
   * @param {boolean} canBeat 主角战力是否【大于】它（大于 = 能吃）
   * @param {boolean} isEqual 主角战力是否【等于】它（相等 = 撞上去会被弹开）
   * 绿圈 = 能吃，红圈 = 会死，白圈 = 数值相同（撞不动），
   * BOSS 则是 紫圈 = 能打 / 灰圈 = 打不过
   */
  setThreat(canBeat, isEqual) {
    let color;
    if (isEqual) {
      color = CFG.color.equal;                 // 白圈：数值一样，撞上去只会被弹开
    } else if (this.isBoss) {
      color = canBeat ? CFG.color.boss : CFG.color.bossLocked;
    } else {
      color = canBeat ? CFG.color.edible : CFG.color.danger;
    }

    if (this.halo) this.halo.setStrokeStyle(this.isBoss ? 4 : 3, color, 0.95);
    if (this.label) this.label.setColor(Utils.hex(color)); // 数字也染成同一个颜色
  }

  // 每一帧被 GameScene 调用（目前只用来同步头顶数字和光环的位置）
  update() {
    if (this.isDead) return;
    this.syncLabel();
  }

  // 被吃掉：缩小淡出后销毁
  kill() {
    if (this.isDead) return;
    this.isDead = true;

    if (this.body) this.body.enable = false; // 立刻关掉碰撞体，防止同一帧重复触发
    if (this.label) {
      this.label.destroy();
      this.label = null;
    }
    if (this.halo) {
      this.halo.destroy();
      this.halo = null;
    }

    this.scene.tweens.add({
      targets: this,
      scale: 0,
      alpha: 0,
      duration: 160,
      onComplete: () => this.destroy()
    });
  }

  // 让数字浮在自己头顶上方，光环套在自己外面
  syncLabel() {
    const offset = this.isBoss ? 40 : 26; // BOSS 个头大，数字要放得更高
    if (this.label) this.label.setPosition(this.x, this.y - offset);
    if (this.halo) this.halo.setPosition(this.x, this.y);
  }

  destroy(fromScene) {
    if (this.label) {
      this.label.destroy();
      this.label = null;
    }
    if (this.halo) {
      this.halo.destroy();
      this.halo = null;
    }
    super.destroy(fromScene);
  }
}

// ---------------------------------------------------------
// 道具（金色菱形，碰到就直接加战力，不看大小）
// ---------------------------------------------------------
class Pickup extends Phaser.Physics.Arcade.Sprite {

  /**
   * @param {Phaser.Scene} scene
   * @param {number} x,y   所在格子的中心坐标
   * @param {number} value 捡到后主角加多少战力
   * @param {string} texture 道具纹理 key，例如 'tex-item-sword'。
   *                         默认 'tex-item'（旧版金色菱形），
   *                         实际运行时 GameScene 会按关卡 itemTextures 数组传进来
   */
  constructor(scene, x, y, value, texture = 'tex-item') {
    super(scene, x, y, texture);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.value = value;
    this.isDead = false;

    this.setImmovable(true);
    this.setVelocity(0, 0);

    // 头顶显示 "+数字"
    this.label = scene.add.text(x, y - 22, '+' + value, {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#ffd24d',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    // 上下轻微浮动，视觉上更"活"
    scene.tweens.add({
      targets: this,
      y: y - 8,
      duration: 900,
      yoyo: true,
      repeat: -1
    });
  }

  // 被捡到
  kill() {
    if (this.isDead) return;
    this.isDead = true;

    if (this.body) this.body.enable = false;
    if (this.label) {
      this.label.destroy();
      this.label = null;
    }

    // 先停掉浮动动画再销毁，否则可能报"找不到对象"的错
    this.scene.tweens.killTweensOf(this);
    this.destroy();
  }

  destroy(fromScene) {
    if (this.label) {
      this.label.destroy();
      this.label = null;
    }
    super.destroy(fromScene);
  }
}

// ---------------------------------------------------------
// 箭（远程投射物，弓武器发射）
//   - 用 Graphics 画一支简单的箭：银灰色箭头 + 深色箭身 + 两根尾羽
//   - 不是 Sprite，没有物理碰撞体（箭穿过草地/墙也没关系）
//   - 创建后直接用 tween 飞向目标点，到达时调用回调
// ---------------------------------------------------------
class Projectile {

  /**
   * @param {Phaser.Scene} scene
   * @param {number} x0 起点（主角中心）
   * @param {number} y0 起点
   * @param {number} tx 目标 x（通常是被瞄准的怪物中心）
   * @param {number} ty 目标 y
   * @param {Function} onHit 到达目标后回调，参数：() => void
   */
  constructor(scene, x0, y0, tx, ty, onHit) {
    this.scene = scene;
    this.onHit = onHit;
    this.destroyed = false;

    // 计算方向角（弧度），用来旋转整支箭
    const angle = Math.atan2(ty - y0, tx - x0);

    // 箭纹理已经在 BootScene.makeCharacterTextures() 里一次性生成好了，
    // 名字是 'tex-arrow-proj'，直接用就行，不用每次 generateTexture。
    this.sprite = scene.add.sprite(x0, y0, 'tex-arrow-proj');
    // 旋转：generateTexture 时箭朝右画的，所以角度直接用 atan2 转度数
    this.sprite.setAngle(Phaser.Math.RadToDeg(angle));

    // tween 飞到目标点：距离决定速度——近的快、远的稍慢，但都 <= 250ms
    const dist = Math.sqrt((tx - x0) ** 2 + (ty - y0) ** 2);
    const duration = Math.min(Math.max(80, dist * 1.6), 240);

    scene.tweens.add({
      targets: this.sprite,
      x: tx,
      y: ty,
      duration: duration,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // 飞到了 → 播放命中特效 + 回调 + 销毁
        this.playHitEffect(tx, ty);
        if (this.onHit) this.onHit();
        this.destroy();
      }
    });
  }

  /**
   * 在 Graphics 上画一支向右的箭（generateTexture 之后会成为 tex-arrow-proj）
   *   箭头朝右 → 旋转时方向 = Math.atan2 结果
   */
  drawArrow(g) {
    // 深灰箭身（水平线，左到右）
    g.lineStyle(3, 0x3a3a3a, 1);
    g.beginPath();
    g.moveTo(2, 4);
    g.lineTo(20, 4);
    g.strokePath();

    // 银色箭头（三角形）
    g.fillStyle(0xc9cdd3, 1);
    g.fillTriangle(24, 4, 18, 0, 18, 8);

    // 两根尾羽（左侧的小三角）
    g.fillStyle(0x8b5a2b, 1);     // 棕色尾羽
    g.fillTriangle(2, 4, 0, 0, 6, 3);
    g.fillTriangle(2, 4, 0, 8, 6, 5);
  }

  // 命中特效：目标点闪一下金色星花 + 小圆圈扩散
  playHitEffect(x, y) {
    const g = this.scene.add.graphics();
    g.fillStyle(0xffd24d, 0.9);
    g.fillCircle(x, y, 14);
    g.lineStyle(3, 0xffffff, 1);
    g.strokeCircle(x, y, 10);

    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 1.6,
      scaleY: 1.6,
      duration: 200,
      onComplete: () => g.destroy()
    });
  }

  // 外部可以用来取消箭飞行（比如主角刚发射、还没飞到，场景就结束了）
  cancel() {
    if (this.destroyed) return;
    this.scene.tweens.killTweensOf(this.sprite);
    this.destroy();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}
