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
    // 0) 先看是不是还在"被弹开"的硬直时间里。
    //    如果是，就不读键盘（否则下一帧立刻把速度改回走路速度，
    //    刚才那一推就白推了），只同步一下头顶数字。
    if (this.scene.time.now < this.lockedUntil) {
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

  constructor(scene, x, y, value) {
    super(scene, x, y, 'tex-item');

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
