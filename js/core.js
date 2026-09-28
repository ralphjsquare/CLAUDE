// 周易占卜核心逻辑：八卦、六十四卦、起卦（铜钱法 / 蓍草法）、变爻取占规则。
// 与界面无关，浏览器和 Node（测试）都可直接加载。
(function (Yi) {
  'use strict';

  // 八卦。bits 为自下而上三爻，1 = 阳，0 = 阴。
  var TRIGRAMS = {
    乾: { bits: '111', image: '天', symbol: '☰', nature: '健' },
    兑: { bits: '110', image: '泽', symbol: '☱', nature: '悦' },
    离: { bits: '101', image: '火', symbol: '☲', nature: '丽' },
    震: { bits: '100', image: '雷', symbol: '☳', nature: '动' },
    巽: { bits: '011', image: '风', symbol: '☴', nature: '入' },
    坎: { bits: '010', image: '水', symbol: '☵', nature: '陷' },
    艮: { bits: '001', image: '山', symbol: '☶', nature: '止' },
    坤: { bits: '000', image: '地', symbol: '☷', nature: '顺' }
  };

  // 文王卦序：[卦名, 上卦, 下卦]
  var KING_WEN = [
    ['乾', '乾', '乾'], ['坤', '坤', '坤'], ['屯', '坎', '震'], ['蒙', '艮', '坎'],
    ['需', '坎', '乾'], ['讼', '乾', '坎'], ['师', '坤', '坎'], ['比', '坎', '坤'],
    ['小畜', '巽', '乾'], ['履', '乾', '兑'], ['泰', '坤', '乾'], ['否', '乾', '坤'],
    ['同人', '乾', '离'], ['大有', '离', '乾'], ['谦', '坤', '艮'], ['豫', '震', '坤'],
    ['随', '兑', '震'], ['蛊', '艮', '巽'], ['临', '坤', '兑'], ['观', '巽', '坤'],
    ['噬嗑', '离', '震'], ['贲', '艮', '离'], ['剥', '艮', '坤'], ['复', '坤', '震'],
    ['无妄', '乾', '震'], ['大畜', '艮', '乾'], ['颐', '艮', '震'], ['大过', '兑', '巽'],
    ['坎', '坎', '坎'], ['离', '离', '离'], ['咸', '兑', '艮'], ['恒', '震', '巽'],
    ['遯', '乾', '艮'], ['大壮', '震', '乾'], ['晋', '离', '坤'], ['明夷', '坤', '离'],
    ['家人', '巽', '离'], ['睽', '离', '兑'], ['蹇', '坎', '艮'], ['解', '震', '坎'],
    ['损', '艮', '兑'], ['益', '巽', '震'], ['夬', '兑', '乾'], ['姤', '乾', '巽'],
    ['萃', '兑', '坤'], ['升', '坤', '巽'], ['困', '兑', '坎'], ['井', '坎', '巽'],
    ['革', '兑', '离'], ['鼎', '离', '巽'], ['震', '震', '震'], ['艮', '艮', '艮'],
    ['渐', '巽', '艮'], ['归妹', '震', '兑'], ['丰', '震', '离'], ['旅', '离', '艮'],
    ['巽', '巽', '巽'], ['兑', '兑', '兑'], ['涣', '巽', '坎'], ['节', '坎', '兑'],
    ['中孚', '巽', '兑'], ['小过', '震', '艮'], ['既济', '坎', '离'], ['未济', '离', '坎']
  ];

  var HEXAGRAMS = [];
  var BY_BITS = {};
  KING_WEN.forEach(function (row, i) {
    var name = row[0], upper = row[1], lower = row[2];
    var hex = {
      n: i + 1,
      name: name,
      upper: upper,
      lower: lower,
      bits: TRIGRAMS[lower].bits + TRIGRAMS[upper].bits, // 自下而上六爻
      fullName: upper === lower
        ? name + '为' + TRIGRAMS[upper].image
        : TRIGRAMS[upper].image + TRIGRAMS[lower].image + name,
      symbol: String.fromCodePoint(0x4DC0 + i)
    };
    HEXAGRAMS.push(hex);
    BY_BITS[hex.bits] = hex;
  });

  // ---- 随机数 ----

  // 返回 [0, n) 的均匀随机整数，使用浏览器 / Node 的密码学随机源。
  function randomInt(n) {
    var buf = new Uint32Array(1);
    var limit = Math.floor(0x100000000 / n) * n; // 拒绝采样，避免取模偏差
    do { globalThis.crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % n;
  }

  // ---- 铜钱法 ----
  // 三枚铜钱，字面记 2，背面记 3；和为 6 老阴、7 少阳、8 少阴、9 老阳。
  function tossCoins(rand) {
    rand = rand || randomInt;
    var coins = [0, 1, 2].map(function () { return rand(2) ? 3 : 2; });
    return { coins: coins, value: coins[0] + coins[1] + coins[2] };
  }

  // ---- 蓍草法（大衍筮法） ----
  // 大衍之数五十，其用四十有九。每一变：分二、挂一、揲四、归奇；三变成一爻。
  var SPLIT_WIDTH = 20;

  function yarrowLine(rand) {
    rand = rand || randomInt;
    var total = 49;
    var steps = [];
    for (var k = 0; k < 3; k++) {
      // 分二：像真人一样大致从中间分开，落点在中点附近 20 根范围内随机。
      // 范围宽度是 4 的倍数，使揲四的余数均匀分布，从而得到传统概率 1/16、5/16、7/16、3/16。
      var left = Math.floor(total / 2) - 10 + rand(SPLIT_WIDTH);
      var right = total - left;
      var remLeft = left % 4 || 4;       // 揲四：以四数之，余数为 1–4
      var remRight = (right - 1) % 4 || 4;
      var removed = 1 + remLeft + remRight; // 归奇：挂一与两堆余数放在一旁
      steps.push({ total: total, left: left, right: right, remLeft: remLeft, remRight: remRight, removed: removed });
      total -= removed;
    }
    return { steps: steps, rest: total, value: total / 4 };
  }

  // ---- 卦象 ----

  function isYang(v) { return v === 7 || v === 9; }
  function isChanging(v) { return v === 6 || v === 9; }

  // values: 自下而上六个数（6/7/8/9）
  function reading(values) {
    if (values.length !== 6) throw new Error('需要六爻');
    var primaryBits = values.map(function (v) { return isYang(v) ? '1' : '0'; }).join('');
    var relatingBits = values.map(function (v) {
      return (isYang(v) !== isChanging(v)) ? '1' : '0';
    }).join('');
    var changing = [];
    values.forEach(function (v, i) { if (isChanging(v)) changing.push(i); });
    var primary = BY_BITS[primaryBits];
    var relating = changing.length ? BY_BITS[relatingBits] : null;
    return {
      values: values.slice(),
      primary: primary,
      relating: relating,
      changing: changing,
      focus: interpret(primary, relating, changing)
    };
  }

  var POS = ['初', '二', '三', '四', '五', '上'];

  // 变爻取占，依朱熹《易学启蒙·考变占》。
  // 返回 { rule, items: [{ hex: 'primary'|'relating', kind: 'judgment'|'line'|'use', line?, main }] }
  function interpret(primary, relating, changing) {
    var c = changing.length;
    var unchanged = [0, 1, 2, 3, 4, 5].filter(function (i) { return changing.indexOf(i) < 0; });
    var J = function (hex, main) { return { hex: hex, kind: 'judgment', main: main }; };
    var L = function (hex, i, main) { return { hex: hex, kind: 'line', line: i, main: main }; };

    if (c === 0) {
      return { rule: '六爻皆不变，以本卦卦辞断之。', items: [J('primary', true)] };
    }
    if (c === 1) {
      return { rule: '一爻变，以本卦变爻（' + POS[changing[0]] + '爻）爻辞断之。',
        items: [L('primary', changing[0], true)] };
    }
    if (c === 2) {
      return { rule: '二爻变，以本卦两个变爻的爻辞断之，以上面的一爻（' + POS[changing[1]] + '爻）为主。',
        items: [L('primary', changing[1], true), L('primary', changing[0], false)] };
    }
    if (c === 3) {
      return { rule: '三爻变，以本卦与之卦的卦辞断之，本卦为主（贞），之卦为辅（悔）。',
        items: [J('primary', true), J('relating', false)] };
    }
    if (c === 4) {
      return { rule: '四爻变，以之卦中两个不变爻的爻辞断之，以下面的一爻（' + POS[unchanged[0]] + '爻）为主。',
        items: [L('relating', unchanged[0], true), L('relating', unchanged[1], false)] };
    }
    if (c === 5) {
      return { rule: '五爻变，以之卦中唯一不变的爻（' + POS[unchanged[0]] + '爻）爻辞断之。',
        items: [L('relating', unchanged[0], true)] };
    }
    if (primary.n === 1 || primary.n === 2) {
      return { rule: '六爻皆变，' + primary.name + '卦以「' + (primary.n === 1 ? '用九' : '用六') + '」断之。',
        items: [{ hex: 'primary', kind: 'use', main: true }] };
    }
    return { rule: '六爻皆变，以之卦卦辞断之。', items: [J('relating', true)] };
  }

  // 爻名，如「初九」「六二」「上六」
  function lineName(i, yang) {
    var num = yang ? '九' : '六';
    if (i === 0) return '初' + num;
    if (i === 5) return '上' + num;
    return num + POS[i];
  }

  Yi.TRIGRAMS = TRIGRAMS;
  Yi.HEXAGRAMS = HEXAGRAMS;
  Yi.byBits = function (bits) { return BY_BITS[bits]; };
  Yi.randomInt = randomInt;
  Yi.tossCoins = tossCoins;
  Yi.yarrowLine = yarrowLine;
  Yi.reading = reading;
  Yi.interpret = interpret;
  Yi.lineName = lineName;
  Yi.isYang = isYang;
  Yi.isChanging = isChanging;
})(globalThis.Yi = globalThis.Yi || {});
