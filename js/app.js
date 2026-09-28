// 周易占卜 — 界面与流程
(function (Yi) {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var PLAIN = Yi.PLAIN || {};
  var HISTORY_KEY = 'yi.history.v1';

  // 创建元素：h('p', {class: 'x'}, '文字', child…)
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') el.className = attrs[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) el.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      [].concat(c).forEach(function (x) {
        el.appendChild(typeof x === 'string' ? document.createTextNode(x) : x);
      });
    }
    return el;
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ---- 本机记录 ----

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) { return []; }
  }
  function saveHistory(list) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 200))); } catch (e) { /* 无痕模式等 */ }
  }

  // 找最近 3 天内问过的相似问题
  function findSimilar(q) {
    var norm = function (s) { return s.replace(/[\s，。？！、,.?!；;：:“”"'‘’]/g, ''); };
    var grams = function (s) {
      var out = {};
      for (var i = 0; i < s.length - 1; i++) out[s.slice(i, i + 2)] = 1;
      return out;
    };
    var a = norm(q), ga = grams(a);
    var since = Date.now() - 3 * 24 * 3600 * 1000;
    return loadHistory().find(function (r) {
      if (r.t < since) return false;
      var b = norm(r.q);
      if (a === b) return true;
      var gb = grams(b), inter = 0, union = 0, k;
      for (k in ga) { union++; if (gb[k]) inter++; }
      for (k in gb) if (!ga[k]) union++;
      return union > 0 && inter / union >= 0.6;
    });
  }

  // ---- 视图切换 ----

  var state = { method: null, question: '', values: [], busy: false };

  function show(id) {
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === id); });
    window.scrollTo(0, 0);
    if (id === 'history') renderHistory();
    if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
  }

  document.addEventListener('click', function (e) {
    var go = e.target.closest('[data-go]');
    if (go) { e.preventDefault(); if (!state.busy) show(go.getAttribute('data-go')); }
  });

  // ---- 简介里的八卦表 ----

  (function renderTrigrams() {
    var grid = $('#trigram-grid');
    ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'].forEach(function (name) {
      var t = Yi.TRIGRAMS[name];
      grid.appendChild(h('div', { class: 'trigram' },
        h('span', { class: 'trigram-symbol' }, t.symbol),
        h('b', null, name), h('span', null, t.image + ' · ' + t.nature)));
    });
  })();

  // ---- 选方法与占前准备 ----

  var PREP_COMMON = [
    ['净手整衣', '洗净双手，衣着整齐，端正坐好。'],
    ['环境清静', '找一个安静的地方，把手机调成勿扰。有条件的话可以焚一炷香（可选）。'],
    ['三不占', '不诚不占：心不诚，不占；不义不占：所问之事不正当，不占；不疑不占：心中已有答案、并无疑惑的事，不占。'],
    ['一事一占', '只问一件具体的事。问题越清楚，得到的启发越清楚。'],
    ['不可再三', '「初筮告，再三渎，渎则不告。」同一件事只问一次，不要因为结果不合心意就重来。']
  ];
  var PREP_METHOD = {
    coin: ['铜钱', '传统上用三枚铜钱，本应用替你模拟。每掷一次之前，在心中默念一遍所问之事。'],
    yarrow: ['蓍草', '传统用五十根蓍草，先取出一根放在一旁不用，象征太极，实际用四十九根。一爻要经过三变，全卦共十八变，过程较长，请全程专心。']
  };

  document.querySelectorAll('[data-method]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.method = btn.getAttribute('data-method');
      renderPrep();
      show('prep');
    });
  });

  function renderPrep() {
    var list = $('#prep-list');
    list.textContent = '';
    var items = PREP_COMMON.concat([PREP_METHOD[state.method]]);
    items.forEach(function (it, i) {
      var id = 'prep-' + i;
      list.appendChild(h('li', null,
        h('input', { type: 'checkbox', id: id, onchange: updatePrep }),
        h('label', { for: id }, h('b', null, it[0]), h('span', null, it[1]))));
    });
    updatePrep();
  }
  function updatePrep() {
    var boxes = document.querySelectorAll('#prep-list input');
    $('#prep-next').disabled = [].some.call(boxes, function (b) { return !b.checked; });
  }
  $('#prep-next').addEventListener('click', function () {
    $('#repeat-warn').hidden = true;
    show('question');
    $('#question-input').focus();
  });

  // ---- 写下问题 ----

  var qInput = $('#question-input');
  qInput.addEventListener('input', function () {
    $('#question-next').disabled = qInput.value.trim().length < 2;
    $('#repeat-warn').hidden = true;
  });
  $('#question-next').addEventListener('click', function () {
    var q = qInput.value.trim();
    var prev = findSimilar(q);
    if (prev && $('#repeat-warn').hidden) {
      $('#repeat-prev').textContent = '「' + prev.q + '」（' + formatTime(prev.t) + '）';
      $('#repeat-view').onclick = function () { showRecord(prev); };
      $('#repeat-warn').hidden = false;
      return;
    }
    startCalm(q);
  });
  $('#repeat-continue').addEventListener('click', function () { startCalm(qInput.value.trim()); });

  // ---- 静心 ----

  var calmToken = 0;
  function startCalm(q) {
    state.question = q;
    $('#calm-question').textContent = '「' + q + '」';
    show('calm');
    var token = ++calmToken;
    var circle = $('#breath-circle'), text = $('#breath-text');
    var seq = [];
    for (var i = 0; i < 3; i++) seq.push(['吸气', 'in'], ['呼气', 'out']);
    (function step(k) {
      if (token !== calmToken) return;
      if (k === seq.length) { text.textContent = '好'; setTimeout(function () { if (token === calmToken) startCast(); }, 800); return; }
      text.textContent = seq[k][0] + '……';
      circle.className = 'breath-circle ' + seq[k][1];
      setTimeout(function () { step(k + 1); }, 4000);
    })(0);
  }
  $('#calm-skip').addEventListener('click', function () { calmToken++; startCast(); });

  // ---- 起卦 ----

  var castBtn = $('#cast-btn'), stage = $('#cast-stage'), builder = $('#builder');

  function startCast() {
    state.values = [];
    builder.textContent = '';
    for (var i = 5; i >= 0; i--) builder.appendChild(h('div', { class: 'slot', 'data-i': i }, h('span', { class: 'slot-label' }, ['初', '二', '三', '四', '五', '上'][i])));
    $('#cast-done').hidden = true;
    castBtn.hidden = false;
    stage.textContent = '';
    if (state.method === 'coin') {
      $('#cast-title').textContent = '铜钱法起卦';
      $('#cast-hint').textContent = '默念所问之事，点击按钮（或按空格键）掷出三枚铜钱。共掷六次，从最下面一爻开始。';
      stage.appendChild(h('div', { class: 'coins' }, [0, 1, 2].map(function () { return coinEl(); })));
      stage.appendChild(h('p', { class: 'cast-note', id: 'cast-note' }, '字面记 2，背面记 3，三枚相加'));
    } else {
      $('#cast-title').textContent = '蓍草法起卦';
      $('#cast-hint').textContent = '四十九根蓍草，三变成一爻。第一爻会慢慢演示每一步，之后五爻加快。';
      stage.appendChild(yarrowStageEl());
    }
    updateCastBtn();
    show('cast');
  }

  function updateCastBtn() {
    var n = state.values.length;
    castBtn.textContent = state.method === 'coin' ? '掷铜钱（第 ' + (n + 1) + ' 次）' : '起第 ' + (n + 1) + ' 爻';
  }

  castBtn.addEventListener('click', castOne);
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && $('#cast').classList.contains('active') && !castBtn.hidden && document.activeElement !== castBtn) {
      e.preventDefault(); castOne();
    }
  });

  function castOne() {
    if (state.busy || state.values.length >= 6) return;
    state.busy = true;
    castBtn.disabled = true;
    var p = state.method === 'coin' ? castCoin() : castYarrow();
    p.then(function (value) {
      state.values.push(value);
      drawLine(state.values.length - 1, value);
      state.busy = false;
      castBtn.disabled = false;
      if (state.values.length === 6) { castBtn.hidden = true; $('#cast-done').hidden = false; $('#cast-done').focus(); }
      else updateCastBtn();
    });
  }

  var VALUE_NAME = { 6: '老阴', 7: '少阳', 8: '少阴', 9: '老阳' };

  function coinEl() {
    return h('div', { class: 'coin' }, h('div', { class: 'coin-inner' },
      h('div', { class: 'coin-face front' }, h('span', null, '字')),
      h('div', { class: 'coin-face back' }, h('span', null, '背'))));
  }

  function castCoin() {
    var r = Yi.tossCoins();
    var coins = stage.querySelectorAll('.coin');
    coins.forEach(function (c, i) {
      c.classList.remove('show-front', 'show-back');
      void c.offsetWidth; // 重新触发动画
      c.classList.add('spinning');
      setTimeout(function () {
        c.classList.remove('spinning');
        c.classList.add(r.coins[i] === 2 ? 'show-front' : 'show-back');
      }, 700 + i * 120);
    });
    return wait(1100).then(function () {
      $('#cast-note').textContent = r.coins.map(function (v) { return v === 2 ? '字(2)' : '背(3)'; }).join(' + ') +
        ' = ' + r.value + '，' + VALUE_NAME[r.value];
      return r.value;
    });
  }

  // 蓍草演示
  function yarrowStageEl() {
    return h('div', { class: 'yarrow' },
      h('div', { class: 'yarrow-piles' },
        h('div', { class: 'pile-box' }, h('div', { class: 'pile', id: 'pile-left' }), h('span', { id: 'pile-left-n' }, '')),
        h('div', { class: 'pile-box' }, h('div', { class: 'pile', id: 'pile-right' }), h('span', { id: 'pile-right-n' }, '')),
        h('div', { class: 'pile-box aside' }, h('div', { class: 'pile', id: 'pile-aside' }), h('span', { id: 'pile-aside-n' }, ''))),
      h('ol', { class: 'yarrow-log', id: 'yarrow-log' }));
  }

  function setPile(id, n, label) {
    $('#' + id).style.setProperty('--n', n);
    $('#' + id + '-n').textContent = label;
  }

  function castYarrow() {
    var r = Yi.yarrowLine();
    var slow = state.values.length === 0;
    var d = slow ? 1400 : 350;
    var log = $('#yarrow-log');
    log.textContent = '';
    var say = function (text) { log.appendChild(h('li', null, text)); log.scrollTop = log.scrollHeight; };
    var chain = Promise.resolve();
    r.steps.forEach(function (s, k) {
      var name = ['第一变', '第二变', '第三变'][k];
      var aside = 0;
      chain = chain
        .then(function () {
          setPile('pile-left', s.total, '共 ' + s.total + ' 根'); setPile('pile-right', 0, ''); setPile('pile-aside', 0, '');
          if (slow) say(name + '：手中共 ' + s.total + ' 根蓍草。');
          return wait(d * 0.6);
        })
        .then(function () {
          setPile('pile-left', s.left, '左 ' + s.left); setPile('pile-right', s.right, '右 ' + s.right);
          say(slow ? '分二：随手分成左右两堆，左 ' + s.left + ' 根，右 ' + s.right + ' 根，象征天地。' : name + '：分为 ' + s.left + ' 与 ' + s.right);
          return wait(d);
        })
        .then(function () {
          aside = 1;
          setPile('pile-right', s.right - 1, '右 ' + (s.right - 1)); setPile('pile-aside', aside, '挂一 1');
          if (slow) say('挂一：从右堆取一根，夹在指间，象征人。');
          return wait(d);
        })
        .then(function () {
          if (slow) say('揲四：两堆各以四根一数，左余 ' + s.remLeft + ' 根，右余 ' + s.remRight + ' 根，象征四时。');
          return wait(d);
        })
        .then(function () {
          aside += s.remLeft + s.remRight;
          setPile('pile-left', s.left - s.remLeft, ''); setPile('pile-right', s.right - 1 - s.remRight, '');
          setPile('pile-aside', aside, '归奇 ' + aside);
          say(slow ? '归奇：把挂一与余数共 ' + s.removed + ' 根放在一旁，剩下 ' + (s.total - s.removed) + ' 根。'
            : '去 ' + s.removed + '，余 ' + (s.total - s.removed));
          return wait(d);
        });
    });
    return chain.then(function () {
      setPile('pile-left', r.rest, '余 ' + r.rest); setPile('pile-right', 0, ''); setPile('pile-aside', 0, '');
      say('三变完毕，余 ' + r.rest + ' 根，以四除之得 ' + r.value + '：' + VALUE_NAME[r.value] + '。');
      return wait(slow ? 1200 : 500).then(function () { return r.value; });
    });
  }

  function lineEl(value, extra) {
    var yang = Yi.isYang(value);
    return h('div', { class: 'line ' + (yang ? 'yang' : 'yin') + (Yi.isChanging(value) ? ' changing' : '') + (extra ? ' ' + extra : '') },
      h('span', { class: 'bar' }), yang ? null : h('span', { class: 'bar' }),
      Yi.isChanging(value) ? h('span', { class: 'mark' }, value === 9 ? '○' : '×') : null);
  }

  function drawLine(i, value) {
    var slot = builder.querySelector('[data-i="' + i + '"]');
    slot.appendChild(lineEl(value, 'appear'));
    var mark = value === 9 ? ' ○' : value === 6 ? ' ×' : '';
    slot.appendChild(h('span', { class: 'slot-value' + (mark ? ' changing' : '') }, VALUE_NAME[value] + mark));
  }

  $('#cast-done').addEventListener('click', function () {
    var rec = { id: Date.now().toString(36), t: Date.now(), q: state.question, method: state.method, values: state.values.slice() };
    var list = loadHistory();
    list.unshift(rec);
    saveHistory(list);
    showRecord(rec);
  });

  // ---- 结果 ----

  function formatTime(t) {
    var d = new Date(t);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function hexFigure(hex, values, title, changingMarks) {
    var lines = h('div', { class: 'hex-lines' });
    for (var i = 5; i >= 0; i--) {
      var yang = hex.bits[i] === '1';
      var v = changingMarks ? values[i] : (yang ? 7 : 8);
      lines.appendChild(lineEl(v));
    }
    var up = Yi.TRIGRAMS[hex.upper], low = Yi.TRIGRAMS[hex.lower];
    return h('div', { class: 'hex-figure' },
      h('div', { class: 'hex-title' }, title),
      lines,
      h('div', { class: 'hex-name' }, hex.name),
      h('div', { class: 'hex-full' }, '第' + hex.n + '卦 · ' + hex.fullName),
      h('div', { class: 'hex-tri' }, '上' + hex.upper + up.image + ' · 下' + hex.lower + low.image));
  }

  function plainOf(hex) { return PLAIN[hex.n] || null; }
  var PENDING = '（白话解读撰写中）';

  function focusBlock(item, r) {
    var hex = item.hex === 'primary' ? r.primary : r.relating;
    var text = Yi.TEXT[hex.n - 1], plain = plainOf(hex) || {};
    var label, orig, xiang, bai;
    if (item.kind === 'judgment') {
      label = hex.name + '卦 · 卦辞'; orig = text.judgment; bai = plain.judgment;
    } else if (item.kind === 'use') {
      label = hex.name + '卦 · ' + text.use.pos; orig = text.use.text; xiang = text.use.xiang; bai = plain.use;
    } else {
      var l = text.lines[item.line];
      label = hex.name + '卦 · ' + l.pos; orig = l.text; xiang = l.xiang; bai = plain.lines && plain.lines[item.line];
    }
    return h('div', { class: 'focus-item' + (item.main ? ' main' : '') },
      h('div', { class: 'focus-label' }, label, item.main ? h('span', { class: 'tag' }, '主') : h('span', { class: 'tag subtle' }, '辅')),
      h('p', { class: 'classic big' }, orig),
      xiang ? h('p', { class: 'classic xiang' }, '《象》曰：' + xiang) : null,
      h('p', { class: 'plain' }, bai || PENDING));
  }

  function isFocus(r, which, kind, line) {
    return r.focus.items.some(function (x) { return x.hex === which && x.kind === kind && (kind !== 'line' || x.line === line); });
  }

  function fullText(hex, r, which, open) {
    var text = Yi.TEXT[hex.n - 1], plain = plainOf(hex) || {};
    var body = h('div', { class: 'full' });
    if (plain.summary) body.appendChild(h('p', { class: 'summary' }, plain.summary));
    var sec = function (title, orig, bai, hl) {
      return h('div', { class: 'sec' + (hl ? ' hl' : '') },
        h('h4', null, title), h('p', { class: 'classic' }, orig), h('p', { class: 'plain' }, bai || PENDING));
    };
    body.appendChild(sec('卦辞', hex.name + '：' + text.judgment, plain.judgment, isFocus(r, which, 'judgment')));
    body.appendChild(sec('彖传', '《彖》曰：' + text.tuan, plain.tuan));
    body.appendChild(sec('大象', '《象》曰：' + text.daxiang, plain.daxiang));
    var lines = h('div', { class: 'sec' }, h('h4', null, '六爻'));
    var all = text.lines.map(function (l, i) { return { l: l, i: i, bai: plain.lines && plain.lines[i], hl: isFocus(r, which, 'line', i) }; });
    if (text.use) all.push({ l: text.use, i: 6, bai: plain.use, hl: isFocus(r, which, 'use') });
    all.forEach(function (x) {
      var changed = which === 'primary' && r.changing.indexOf(x.i) >= 0;
      lines.appendChild(h('div', { class: 'yao' + (x.hl ? ' hl' : '') },
        h('div', { class: 'yao-head' }, h('b', null, x.l.pos), changed ? h('span', { class: 'tag subtle' }, '变爻') : null),
        h('p', { class: 'classic' }, x.l.text),
        h('p', { class: 'classic xiang' }, '《象》曰：' + x.l.xiang),
        h('p', { class: 'plain' }, x.bai || PENDING)));
    });
    body.appendChild(lines);
    return h('details', { class: 'card fulltext', open: open ? '' : false },
      h('summary', null, (which === 'primary' ? '本卦 · ' : '之卦 · ') + hex.fullName + ' 全文'), body);
  }

  function showRecord(rec) {
    var r = Yi.reading(rec.values);
    var out = $('#result-body');
    out.textContent = '';
    out.appendChild(h('div', { class: 'result-head' },
      h('p', { class: 'muted' }, formatTime(rec.t) + ' · ' + (rec.method === 'coin' ? '铜钱法' : '蓍草法')),
      h('h2', null, '「' + rec.q + '」')));

    var figs = h('div', { class: 'figures' }, hexFigure(r.primary, rec.values, '本卦', true));
    if (r.relating) {
      figs.appendChild(h('div', { class: 'arrow' }, '→'));
      figs.appendChild(hexFigure(r.relating, rec.values, '之卦', false));
    }
    out.appendChild(figs);
    out.appendChild(h('p', { class: 'center muted' },
      r.changing.length ? '变爻：' + r.changing.map(function (i) { return Yi.lineName(i, Yi.isYang(rec.values[i])); }).join('、') : '六爻皆不变'));

    out.appendChild(h('div', { class: 'card focus' },
      h('h3', null, '这次看哪一句'),
      h('p', { class: 'rule' }, r.focus.rule),
      r.focus.items.map(function (it) { return focusBlock(it, r); }),
      h('p', { class: 'reflect' }, '读完之后，不妨把这句话和你的问题放在一起想一想：它提醒你留意什么？下一步可以做什么？')));

    out.appendChild(fullText(r.primary, r, 'primary', false));
    if (r.relating) out.appendChild(fullText(r.relating, r, 'relating', false));
    show('result');
  }

  // ---- 记录列表 ----

  function renderHistory() {
    var box = $('#history-list');
    box.textContent = '';
    var list = loadHistory();
    if (!list.length) { box.appendChild(h('p', { class: 'muted' }, '还没有记录。')); return; }
    list.forEach(function (rec) {
      var r = Yi.reading(rec.values);
      box.appendChild(h('button', { class: 'history-item', onclick: function () { showRecord(rec); } },
        h('span', { class: 'history-symbol' }, r.primary.symbol),
        h('span', { class: 'history-main' },
          h('b', null, rec.q),
          h('span', { class: 'muted' }, formatTime(rec.t) + ' · ' + r.primary.name + (r.relating ? ' 之 ' + r.relating.name : '')))));
    });
    box.appendChild(h('div', { class: 'actions' }, h('button', { class: 'btn subtle', onclick: function () {
      if (confirm('确定清空全部占卜记录吗？')) { saveHistory([]); renderHistory(); }
    } }, '清空记录')));
  }

  // ---- 启动 ----

  // 只有这几页可以直接通过网址进入，其余步骤必须按流程走
  function route() {
    var id = location.hash.slice(1);
    if (!state.busy) show(['intro', 'history', 'method'].indexOf(id) >= 0 ? id : 'home');
  }
  window.addEventListener('hashchange', route);
  route();

  // 通过网址访问时，注册离线缓存，可「安装为应用」
  if (/^https?:$/.test(location.protocol) && 'serviceWorker' in navigator) {
    var link = document.createElement('link');
    link.rel = 'manifest'; link.href = 'manifest.webmanifest';
    document.head.appendChild(link);
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})(globalThis.Yi);
