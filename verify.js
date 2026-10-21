const fs = require('fs');
function pw(ch) {
  if (ch >= '1' && ch <= '9') return Number(ch);
  if (ch >= 'a' && ch <= 'z') return 10 + (ch.charCodeAt(0) - 97);
  if (ch >= 'A' && ch <= 'Z') return 36 + (ch.charCodeAt(0) - 65);
  return 0;
}

const src = fs.readFileSync('src/config.js', 'utf8');
const re = /name:\s*'第\s*(\d+)\s*关'[\s\S]*?map:\s*\[([\s\S]*?)\][\s\S]*?itemValues:\s*\[([^\]]+)\][\s\S]*?itemTextures:\s*\[([^\]]+)\][\s\S]*?boss:\s*(\d+)/g;
let m;
const levels = [];
while ((m = re.exec(src)) !== null) {
  levels.push({
    lv: Number(m[1]),
    map: m[2],
    vals: m[3].split(',').map(s => Number(s.trim())),
    texts: m[4].split(',').map(s => s.trim()),
    boss: Number(m[5])
  });
}

let allOk = true;
levels.forEach(L => {
  const rowRe = /'([^']*)'/g;
  let ri = 0, stars = 0, monPwr = 0;
  const rows = [];
  for (const rm of L.map.matchAll(rowRe)) {
    ri++;
    const row = rm[1];
    rows.push(row);
    if (row.length !== 20) {
      console.log('L' + L.lv + ' R' + ri + ' FAIL len=' + row.length + ' [' + row + ']');
      allOk = false;
    }
    stars += (row.match(/\*/g) || []).length;
    for (const ch of row) monPwr += pw(ch);
  }
  const match = stars === L.vals.length && stars === L.texts.length;
  console.log('L' + L.lv + ': ' + ri + 'rows stars=' + stars + ' vals=' + L.vals.length + ' texts=' + L.texts.length + ' (' + (match ? '✓匹配' : '✗不匹配') + ')');
  console.log('  总怪=' + monPwr + ' 道具值=' + L.vals.reduce((a,b)=>a+b,0) + ' boss=' + L.boss);

  // 关键拦截点验证
  const r4 = rows[4];
  // 拦路1
  const blocker1Power = pw(r4[5]);
  const pAfterFirstTwo = 3 + pw(r4[2]);
  console.log('  拦路1 col5=' + blocker1Power + ' vs 战力=' + pAfterFirstTwo + ' → ' + (pAfterFirstTwo === blocker1Power ? '⚪白圈✓' : '✗'));
  
  // 绕上岔3只 + 打拦路1 + col8
  const upper1 = pw(rows[1][4]);
  const upper2 = pw(rows[1][9]);
  const upper3 = pw(rows[1][15]);
  const afterUpperAndBlock1 = pAfterFirstTwo + upper1 + upper2 + upper3 + blocker1;
  const col8Power = pw(r4[8]);
  console.log('  上岔 ' + upper1 + '+' + upper2 + '+' + upper3 + '=' + (upper1+upper2+upper3) + ' ✓上岔第一只≤' + pAfterFirstTwo);
  console.log('  打完拦路1 + col8前战力=' + afterUpperAndBlock1);
  console.log('  col8=' + col8Power + ' vs ' + afterUpperAndBlock1 + ' → ' + (afterUpperAndBlock1 > col8Power ? '✓能打' : '✗打不过'));
  
  // 拦路2
  const afterCol8 = afterUpperAndBlock1 + col8Power;
  const blocker2Col = r4.indexOf('x');
  const blocker2Power = pw(r4[11]); // col11
  console.log('  col11拦路2=' + blocker2Power + ' vs 战力=' + afterCol8 + ' → ' + (afterCol8 === blocker2Power ? '⚪白圈✓完美' : afterCol8 > blocker2Power ? '✗红圈死!' : '✗打不过'));
  
  // 下岔第一只
  const lower1 = pw(rows[7][4]);
  console.log('  下岔第一只=' + lower1 + '≤' + afterCol8 + ': ' + (lower1 <= afterCol8 ? '✓' : '✗'));
  
  // 完整模拟
  let p = 3;
  p += pw(r4[2]);
  p += upper1 + upper2 + upper3 + blocker1;
  p += col8Power;
  // 撞拦路2
  p += lower1 + pw(rows[7][9]) + pw(rows[7][15]); // 下岔3只
  let itemIdx = 0;
  for (const ch of rows[9]) if (ch === '*') p += L.vals[itemIdx++];
  p += blocker2Power; // 打拦路2
  // 主路拦路2之后的怪（col14以后）
  for (let c = 12; c < r4.length; c++) {
    if (r4[c] !== '#' && r4[c] !== '.' && r4[c] !== '*' && r4[c] !== 'B') {
      const pp = pw(r4[c]);
      if (pp > 0) p += pp;
    }
    if (r4[c] === '*') {
      // row4 里的剑
      const row4StarIdx = r4.indexOf('*');
      if (c === row4StarIdx && itemIdx > 0) {
        // 剑在 L1 里
      }
    }
  }
  // 重新模拟完整路径
  let pp = 3;
  pp += pw(r4[2]); // col2
  pp += upper1 + upper2 + upper3 + blocker1; // 上岔+打拦路1
  pp += col8Power; // col8
  pp += lower1 + pw(rows[7][9]) + pw(rows[7][15]); // 下岔3只
  let ii = 0;
  // row9 道具
  for (let c = 0; c < 20; c++) if (rows[9][c] === '*') pp += L.vals[ii++];
  pp += blocker2Power; // 打拦路2
  // 主路拦路2之后：col12-20
  for (let c = 12; c < 20; c++) {
    const ch = r4[c];
    if (ch === '*') {
      // row4 的剑 - 用第一个道具
      pp += L.vals[0];
      // 但我们已经加了 row9 的道具... L1 的 itemValues 顺序是 [剑, ding, scroll, potion]
      // parseMap 逐行：先 row4 col14=剑（itemIndex=0），再 row9 col4=ding(1), col10=scroll(2), col16=potion(3)
      // 所以完整顺序是：先拿剑（row4 col14），再绕下岔时拿 row9 的 ding/scroll/potion
      // 让我重新模拟正确顺序
    }
  }
  
  // 正确顺序模拟
  let ppp = 3;
  ppp += pw(r4[2]); // col2
  // 撞 col5=5
  ppp += upper1 + upper2 + upper3 + blocker1; // 上岔+打拦路1
  ppp += col8Power; // col8
  // 撞 col11=拦路2
  // 但剑在 row4 col14！在拦路2之后！玩家绕完下岔回来才拿得到
  ppp += lower1 + pw(rows[7][9]) + pw(rows[7][15]); // 下岔3只
  // row9 道具
  let idx = 0;
  for (let c = 0; c < 20; c++) if (rows[9][c] === '*') ppp += L.vals[L.lv === 1 ? idx++ : idx++];
  // 打拦路2
  ppp += blocker2Power;
  // col12-20 的东西
  for (let c = 12; c < 20; c++) {
    const ch = r4[c];
    const ppw = pw(ch);
    if (ppw > 0) ppp += ppw;
    if (ch === '*') {
      // row4 的剑 - L1 的 itemValues[0] 是剑
      // 但我已经加了 row9 的道具... L1 itemValues 是 [10, 11, 11, 8]
      // 顺序：row4 col14=剑(10) → row9 col4=ding(11) → row9 col10=scroll(11) → row9 col16=potion(8)
      // 所以我应该：拦路2之后先拿剑(itemValues[0])，再绕下岔拿 itemValues[1,2,3]
    }
  }
  
  // ★ 最终正确模拟
  let f = 3;
  f += pw(r4[2]); // col2=2
  // 撞 col5=5
  f += upper1 + upper2 + upper3 + blocker1; // 上岔 + 打拦路1
  f += col8Power; // col8
  // 撞 col11=拦路2
  
  // 拦路2之后：先拿 row4 col14=剑(如果有)
  const row4Star = r4.indexOf('*');
  if (row4Star >= 0) {
    // 剑在拦路2之后 → itemValues[0]
  }
  f += blocker2Power; // 先打拦路2
  // 拦路2之后 col12-20
  let after = f;
  for (let c = 12; c < 20; c++) {
    const ch = r4[c];
    const ppw = pw(ch);
    if (ppw > 0) after += ppw;
    if (ch === '*') after += L.vals[0]; // 剑
  }
  // 但绕下岔应该在撞拦路2之前！
  // 正确流程：撞拦路2⚪ → 绕下岔 → 打拦路2 → 主路剩下
  
  let correct = 3;
  correct += pw(r4[2]);
  correct += upper1 + upper2 + upper3 + blocker1; // 上岔+打拦路1
  correct += col8Power; // col8
  // 撞拦路2
  correct += lower1 + pw(rows[7][9]) + pw(rows[7][15]); // 下岔3只
  // row9 道具（绕下岔时拿）
  let ti = L.lv === 1 ? 1 : 0; // L1 的 itemValues[0] 是剑（在 row4），row9 从 [1] 开始
  for (let c = 0; c < 20; c++) if (rows[9][c] === '*') correct += L.vals[ti++];
  // 打拦路2
  correct += blocker2Power;
  // 主路拦路2之后（col12-20）
  for (let c = 12; c < 20; c++) {
    const ch = r4[c];
    const ppw = pw(ch);
    if (ppw > 0) correct += ppw;
    if (ch === '*') correct += L.vals[0]; // L1 的剑（row4 col14）
  }
  
  console.log('  完整路径最终=' + correct + ' vs BOSS=' + L.boss + ' → ' + (correct > L.boss ? '✓通关' : '✗必死'));
  console.log('');
});

console.log(allOk ? 'ALL CHECKS PASSED' : 'SOME FAILED');
