/* =========================================================
 * main.js —— 游戏总入口（必须放在所有脚本的最后加载）
 * ---------------------------------------------------------
 * 它只做一件事：把"画布尺寸、物理引擎、场景清单"交给 Phaser，
 * 然后启动游戏。想加新场景，在下面的 scene 数组里加一项即可。
 * ========================================================= */

// CDN 加载失败时的兜底提示（网络不通 / 被墙时能看到原因，而不是一片空白）
if (typeof Phaser === 'undefined') {
  document.getElementById('game-root').innerHTML =
    '<p style="color:#ffffff;font-family:sans-serif;font-size:16px;' +
    'text-align:center;padding-top:80px;line-height:1.8;">' +
    'Phaser 引擎加载失败。<br>' +
    '请检查网络是否通畅，或把 phaser.min.js 下载到本地，' +
    '再把 index.html 里的 CDN 地址改成本地路径。</p>';
} else {

  const gameConfig = {
    // AUTO：优先用显卡渲染，不行就退回普通渲染
    type: Phaser.AUTO,

    // 挂到 index.html 里的 <div id="game-root"> 上
    parent: 'game-root',

    width: CFG.width,
    height: CFG.height,

    // 页面底色
    backgroundColor: CFG.color.bg,

    // 缩放模式：等比例放大缩小并居中，换任何屏幕都不会变形
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },

    // 物理引擎：arcade 是最简单好懂的 2D 物理，重力设为 0（俯视图不需要下落）
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false // 想看到碰撞框就把它改成 true，调试神器
      }
    },

    // 场景清单：数组里的顺序 = 启动顺序，第一个会被自动启动
    scene: [BootScene, MenuScene, GameScene, ResultScene]
  };

  // 启动！把实例挂到 window 上，方便在浏览器控制台里调戏它
  window.game = new Phaser.Game(gameConfig);
}
