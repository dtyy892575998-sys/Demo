function pw(c) {
  if (c >= '1' && c <= '9') return Number(c);
  if (c >= 'a' && c <= 'z') return 10 + (c.charCodeAt(0) - 97);
  if (c >= 'A' && c <= 'Z') return 36 + (c.charCodeAt(0) - 65);
  return 0;
}

const levels = [
  { name: 'L1', r4: 'S#2##5##7##x##*##fB.', r1: '....4....5.....7....', r7: '....j....n.....r....', items: [10, 11, 11, 8], boss: 174 },
  { name: 'L2', r4: 'S#2##5##h##J##w##zB.', r1: '....4....6.....8....', r7: '....r....u.....y....', items: [15, 12, 10], boss: 262 },
  { name: 'L3', r4: 'S#2##5##p##T##Z##MB.', r1: '....4....7.....9....', r7: '....n....G.....K....', items: [20, 15, 15], boss: 248 }
];

let allOk = true;
levels.forEach(L => {
  console.log('======== ' + L.name + ' ========');
  
  // 长度检查
  [['r4', L.r4], ['r1', L.r1], ['r7', L.r7]].forEach(item => {
    const ok = item[1].length === 20;
    console.log('  ' + item[0] + ' len=' + item[1].length + (ok ? ' ✓' : ' ✗'));
    if (!ok) allOk = false;
  });
  
  // 完整路径
  let p = 3;
  p += pw(L.r4[2]);
  console.log('  Step1: 3+2=' + p + ' (撞col5=5白圈)');
  
  const up1 = pw(L.r1[4]), up2 = pw(L.r1[9]), up3 = pw(L.r1[15]);
  p += up1 + up2 + up3;
  console.log('  Step2: 上岔' + up1 + '+' + up2 + '+' + up3 + '=' + (up1+up2+up3) + ' → ' + p);
  
  p += 5;
  console.log('  Step3: 打拦路1=5 → ' + p);
  
  const col8 = pw(L.r4[8]);
  p += col8;
  console.log('  Step4: col8怪(' + col8 + ') → ' + p);
  
  const block2 = pw(L.r4[11]);
  const b2ok = p === block2;
  console.log('  Step5: 撞拦路2=col11(' + block2 + ') 战力=' + p + (b2ok ? ' ⚪完美白圈✓' : ' ✗'));
  if (!b2ok) allOk = false;
  
  const lo1 = pw(L.r7[4]), lo2 = pw(L.r7[9]), lo3 = pw(L.r7[15]);
  p += lo1 + lo2 + lo3;
  console.log('  Step6: 下岔' + lo1 + '+' + lo2 + '+' + lo3 + '=' + (lo1+lo2+lo3) + ' → ' + p);
  
  // 道具
  const itemsSum = L.items.reduce((a,b) => a+b, 0);
  p += itemsSum;
  console.log('  Step7: 道具+' + itemsSum + ' → ' + p);
  
  p += block2;
  console.log('  Step8: 打拦路2(' + block2 + ') → ' + p);
  
  // 拦路2之后 col12-20
  let extra = 0;
  for (let c = 12; c < 20; c++) {
    const ppw = pw(L.r4[c]);
    if (ppw > 0) extra += ppw;
  }
  p += extra;
  console.log('  Step9: 主路后段(' + extra + ') → ' + p);
  
  const win = p > L.boss;
  console.log('  最终=' + p + ' BOSS=' + L.boss + ' → ' + (win ? '✓通关' : '✗必死'));
  if (!win) allOk = false;
  console.log('');
});

console.log(allOk ? '=== ALL 3 LEVELS PASS ===' : '=== SOME LEVELS FAIL ===');
