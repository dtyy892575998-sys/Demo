/* =========================================================
 * entities.js —— 游戏实体类（玩家 / 怪物 / 道具）
 * ---------------------------------------------------------
 * 每个类代表"一个会出现在画面上的东西"，
 * 它只管自己的行为，不关心关卡怎么结束、界面怎么显示。
 * ========================================================= */

// ---------------------------------------------------------
// 玩家
// ---------------------------------------------------------
class Player extends Phaser.Physics.Arcade.Sprite {

  constructor(scene, x, y) {
    super(scene, x, y, 'tex-player'); // 'tex-player' 是 BootScene 里用代码画出来的占位图

    // 把对象同时注册进"显示列表"和"物理系统"
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.power = CFG.player.startPower; // 头顶那个数值，就是他的"战力"
    this.setCollideWorldBounds(true);   // 撞到战场边界会被挡住，不会跑出屏幕

    // 两套键位：WASD 和 方向键，玩家用哪个都行
    this.keys = scene.input.keyboard.addKeys('W,A,S,D');
    this.cursors = scene.input.keyboard.createCursorKeys();

    // 头顶的战力数字
    this.label = scene.add.text(x, y - 30, String(this.power), {
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

    // 3) 把速度交给物理系统，主角就会动起来
    this.setVelocity(vx * CFG.player.speed, vy * CFG.player.speed);

    this.syncLabel();
  }

  // 增加战力（吃到怪物或道具时调用）
  addPower(value) {
    this.power += value;
    if (this.label) this.label.setText(String(this.power));
  }

  // 让头顶数字一直跟着自己
  syncLabel() {
    if (this.label) this.label.setPosition(this.x, this.y - 30);
  }

  // 覆写销毁方法：销毁主角时顺手把头顶数字也销毁，避免残留文字
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
// ---------------------------------------------------------
class Monster extends Phaser.Physics.Arcade.Sprite {

  /**
   * @param {Phaser.Scene} scene
   * @param {number} x,y   出生坐标
   * @param {number} power 头顶数值（战力）
   * @param {object} opts  { isBoss: 是否BOSS, speed: 移动速度 }
   */
  constructor(scene, x, y, power, opts = {}) {
    const isBoss = !!opts.isBoss;
    super(scene, x, y, isBoss ? 'tex-boss' : 'tex-monster');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.power = power;
    this.isBoss = isBoss;
    this.isDead = false;      // 防止同一帧里被重复判定
    this.speed = opts.speed || 60;
    this.patrolTarget = null; // BOSS 巡逻用的"下一个目标点"

    // 头顶数字：BOSS 的数字更大更醒目
    this.label = scene.add.text(x, y, String(power), {
      fontFamily: 'sans-serif',
      fontSize: isBoss ? '28px' : '18px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    this.syncLabel();
  }

  // 小怪开始随机游荡（注意：这个方法要在"加入怪物组"之后调用，
  // 这样速度不会被组的默认值覆盖掉）
  startRoaming() {
    this.setCollideWorldBounds(true);
    this.setBounce(1, 1); // 弹性 1 = 撞墙后原速反弹，天然实现"来回游荡"

    const angle = Math.random() * Math.PI * 2; // 随机方向
    this.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
  }

  // 每一帧被 GameScene 调用
  update() {
    if (this.isDead) return;      // 已经死了就什么都不做
    if (this.isBoss) this.patrol(); // BOSS 在区域内巡逻
    this.syncLabel();
  }

  // BOSS 的巡逻：在 CFG.bossZone 里随机挑一个点走过去，走到了就再挑一个
  patrol() {
    const zone = CFG.bossZone;
    const needNewTarget = !this.patrolTarget ||
      Phaser.Math.Distance.Between(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y) < 16;

    if (needNewTarget) {
      this.patrolTarget = {
        x: Phaser.Math.Between(zone.x1, zone.x2),
        y: Phaser.Math.Between(zone.y1, zone.y2)
      };
      // moveTo：以指定速度朝目标点移动
      this.scene.physics.moveTo(this, this.patrolTarget.x, this.patrolTarget.y, this.speed);
    }
  }

  // 被吃掉：缩小淡出后销毁
  kill() {
    if (this.isDead) return;      // 已经死过了，直接返回
    this.isDead = true;

    if (this.body) this.body.enable = false; // 立刻关掉碰撞体，防止同一帧重复触发
    if (this.label) {
      this.label.destroy();
      this.label = null;
    }

    this.scene.tweens.add({
      targets: this,
      scale: 0,
      alpha: 0,
      duration: 160,
      onComplete: () => this.destroy()
    });
  }

  syncLabel() {
    if (!this.label) return;
    const offset = this.isBoss ? 52 : 26; // BOSS 个头大，数字要放得更高
    this.label.setPosition(this.x, this.y - offset);
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
// 道具（金色菱形，碰到就直接加战力，不看大小）
// ---------------------------------------------------------
class Pickup extends Phaser.Physics.Arcade.Sprite {

  constructor(scene, x, y, value) {
    super(scene, x, y, 'tex-item');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.value = value;
    this.isDead = false;

    // 头顶显示 "+数字"，让玩家一眼知道能加多少
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
      yoyo: true,   // 来回摆动
      repeat: -1    // 无限循环
    });
  }

  // 固定住（要在"加入道具组"之后调用）
  freeze() {
    this.setImmovable(true);
    this.body.setAllowGravity(false);
    this.setVelocity(0, 0);
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
