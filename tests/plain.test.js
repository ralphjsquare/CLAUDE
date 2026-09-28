// 白话解读的完整性：字段齐全，且每条爻的白话开头引用的爻辞与原文一致
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../data/text.js');
const dir = path.join(__dirname, '..', 'data');
fs.readdirSync(dir).filter(f => /^plain(-\d+)?\.js$/.test(f)).forEach(f => require(path.join(dir, f)));
const Yi = globalThis.Yi;

const strip = s => s.replace(/[，。；：、！？\s]/g, '');
const quoted = s => (s.match(/^「(.+?)」/) || [])[1];

test('白话解读字段齐全，引用的爻辞与原文一致', () => {
  const nums = Object.keys(Yi.PLAIN).map(Number);
  assert.ok(nums.length > 0);
  for (const n of nums) {
    const p = Yi.PLAIN[n], t = Yi.TEXT[n - 1];
    for (const k of ['summary', 'judgment', 'tuan', 'daxiang']) assert.ok(p[k], `${t.name} 缺少 ${k}`);
    assert.equal(p.lines.length, 6, `${t.name} 爻数`);
    p.lines.forEach((s, i) => assert.equal(strip(quoted(s) || ''), strip(t.lines[i].text), `${t.name}${t.lines[i].pos}`));
    assert.equal(!!p.use, !!t.use, `${t.name} 用九/用六`);
    if (p.use) assert.equal(strip(quoted(p.use)), strip(t.use.pos + t.use.text), `${t.name}${t.use.pos}`);
  }
});

test('六十四卦的白话解读已全部完成', () => {
  assert.equal(Object.keys(Yi.PLAIN).length, 64);
});
