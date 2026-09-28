// 运行：node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
require('../js/core.js');
require('../data/text.js');
const Yi = globalThis.Yi;

test('六十四卦各不相同，卦名与原文一致', () => {
  assert.equal(Yi.HEXAGRAMS.length, 64);
  assert.equal(new Set(Yi.HEXAGRAMS.map(h => h.bits)).size, 64);
  Yi.HEXAGRAMS.forEach((h, i) => {
    assert.equal(Yi.TEXT[i].n, h.n);
    assert.equal(Yi.TEXT[i].name, h.name);
  });
});

test('卦的全称与卦符', () => {
  const by = n => Yi.HEXAGRAMS[n - 1];
  assert.equal(by(1).fullName, '乾为天');
  assert.equal(by(11).fullName, '地天泰');
  assert.equal(by(64).fullName, '火水未济');
  assert.equal(by(1).symbol, '䷀');
  assert.equal(by(64).symbol, '䷿');
  assert.equal(by(3).bits, '100010'); // 屯：震下坎上
});

test('爻名与原文一致', () => {
  Yi.HEXAGRAMS.forEach((h, i) => {
    Yi.TEXT[i].lines.forEach((l, j) => {
      assert.equal(Yi.lineName(j, h.bits[j] === '1'), l.pos, h.name + j);
    });
  });
});

test('本卦与之卦', () => {
  const r = Yi.reading([9, 7, 7, 7, 7, 7]);
  assert.equal(r.primary.name, '乾');
  assert.equal(r.relating.name, '姤');
  assert.deepEqual(r.changing, [0]);
  assert.equal(Yi.reading([8, 7, 8, 7, 8, 7]).relating, null);
  assert.equal(Yi.reading([6, 6, 6, 6, 6, 6]).relating.name, '乾');
});

const focus = v => Yi.reading(v).focus.items.map(x => [x.hex, x.kind, x.line, x.main]);

test('取占规则：0 至 6 个变爻', () => {
  assert.deepEqual(focus([7, 8, 7, 8, 7, 8]), [['primary', 'judgment', undefined, true]]);
  assert.deepEqual(focus([7, 8, 9, 8, 7, 8]), [['primary', 'line', 2, true]]);
  assert.deepEqual(focus([6, 8, 9, 8, 7, 8]), [['primary', 'line', 2, true], ['primary', 'line', 0, false]]);
  assert.deepEqual(focus([6, 8, 9, 6, 7, 8]), [['primary', 'judgment', undefined, true], ['relating', 'judgment', undefined, false]]);
  assert.deepEqual(focus([6, 8, 9, 6, 9, 8]), [['relating', 'line', 1, true], ['relating', 'line', 5, false]]);
  assert.deepEqual(focus([6, 6, 9, 6, 9, 8]), [['relating', 'line', 5, true]]);
  assert.deepEqual(focus([6, 9, 9, 6, 9, 6]), [['relating', 'judgment', undefined, true]]);
  assert.deepEqual(focus([9, 9, 9, 9, 9, 9]), [['primary', 'use', undefined, true]]);
  assert.deepEqual(focus([6, 6, 6, 6, 6, 6]), [['primary', 'use', undefined, true]]);
});

test('铜钱法：概率为 1/8、3/8、3/8、1/8', () => {
  const count = { 6: 0, 7: 0, 8: 0, 9: 0 };
  for (let m = 0; m < 8; m++) {
    let k = 0;
    count[Yi.tossCoins(() => (m >> k++) & 1).value]++;
  }
  assert.deepEqual(count, { 6: 1, 7: 3, 8: 3, 9: 1 });
});

test('蓍草法：精确概率为 1/16、5/16、7/16、3/16', () => {
  // 穷举三变的全部分法（每一变都是等可能的），用 yarrowLine 本身统计四种爻出现的次数
  const count = { 6: 0, 7: 0, 8: 0, 9: 0 };
  let paths = 0;
  (function walk(choices) {
    const widths = [];
    const r = Yi.yarrowLine(n => { widths.push(n); return choices[widths.length - 1] || 0; });
    if (choices.length === 3) { count[r.value]++; paths++; return; }
    for (let i = 0; i < widths[choices.length]; i++) walk(choices.concat(i));
  })([]);
  assert.deepEqual(
    Object.fromEntries(Object.entries(count).map(([v, c]) => [v, c * 16 / paths])),
    { 6: 1, 7: 5, 8: 7, 9: 3 });
  // 真实随机抽样也只会得到 6–9
  for (let i = 0; i < 200; i++) assert.ok([6, 7, 8, 9].includes(Yi.yarrowLine().value));
});

test('原文完整：每卦卦辞、彖、大象、六爻与小象齐全', () => {
  Yi.TEXT.forEach(t => {
    assert.ok(t.judgment && t.tuan && t.daxiang, t.name);
    assert.equal(t.lines.length, 6);
    t.lines.forEach(l => assert.ok(l.text && l.xiang, t.name + l.pos));
    assert.equal(!!t.use, t.n <= 2);
  });
});
