// 神経衰弱（イラスト版）
(function () {
  'use strict';

  // 設定
  const FLIP_BACK_DELAY_MS = 1000; // ミスマッチ表示時間

  // 10種類のイラスト（絵文字で初期実装）
  const CARD_SET = [
    { key: 'apple', emoji: '🍎', label: 'りんご' },
    { key: 'banana', emoji: '🍌', label: 'バナナ' },
    { key: 'grape', emoji: '🍇', label: 'ぶどう' },
    { key: 'cherry', emoji: '🍒', label: 'さくらんぼ' },
    { key: 'car', emoji: '🚗', label: '車' },
    { key: 'bus', emoji: '🚌', label: 'バス' },
    { key: 'train', emoji: '🚆', label: '電車' },
    { key: 'ship', emoji: '🚢', label: '船' },
    { key: 'dog', emoji: '🐶', label: 'いぬ' },
    { key: 'cat', emoji: '🐱', label: 'ねこ' }
  ];

  // DOM 参照
  const startScreen = document.getElementById('start-screen');
  const gameScreen = document.getElementById('game-screen');
  const resultScreen = document.getElementById('result-screen');

  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');

  const boardEl = document.getElementById('board');
  const currentPlayerEl = document.getElementById('current-player');
  const scoreP1El = document.getElementById('score-p1');
  const scoreP2El = document.getElementById('score-p2');
  const remainingPairsEl = document.getElementById('remaining-pairs');
  const hudEl = document.querySelector('.hud');

  const resultTitleEl = document.getElementById('result-title');
  const finalP1El = document.getElementById('final-p1');
  const finalP2El = document.getElementById('final-p2');

  // 状態
  let deck = []; // { id, key, matched, el }
  let flipped = []; // 要素参照 2枚まで
  let lock = false;
  let scores = [0, 0];
  let currentPlayer = 0; // 0: P1, 1: P2
  let remainingPairs = 10; // 10ペア

  // ユーティリティ
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function setScreen(active) {
    // active: 'start' | 'game' | 'result'
    startScreen.hidden = active !== 'start';
    gameScreen.hidden = active !== 'game';
    resultScreen.hidden = active !== 'result';
    startScreen.classList.toggle('active', active === 'start');
    gameScreen.classList.toggle('active', active === 'game');
    resultScreen.classList.toggle('active', active === 'result');
  }

  function updateHUD() {
    currentPlayerEl.textContent = currentPlayer === 0 ? 'プレイヤー1' : 'プレイヤー2';
    scoreP1El.textContent = String(scores[0]);
    scoreP2El.textContent = String(scores[1]);
    remainingPairsEl.textContent = String(remainingPairs);
  }

  function createDeck() {
    const pairs = CARD_SET.map((c) => [
      { key: c.key, emoji: c.emoji, label: c.label },
      { key: c.key, emoji: c.emoji, label: c.label }
    ]).flat();
    const withIds = pairs.map((c, idx) => ({ id: idx + '_' + c.key, key: c.key, emoji: c.emoji, label: c.label, matched: false }));
    return shuffle(withIds);
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    deck.forEach((card, index) => {
      const cardEl = document.createElement('button');
      cardEl.type = 'button';
      cardEl.className = 'card';
      cardEl.setAttribute('aria-label', card.label + 'のカード');
      cardEl.dataset.index = String(index);

      const inner = document.createElement('div');
      inner.className = 'card-inner';

      const back = document.createElement('div');
      back.className = 'card-face card-back';

      const front = document.createElement('div');
      front.className = 'card-face card-front';
      front.innerHTML = `<span class="emoji" aria-hidden="true">${card.emoji}</span><span class="sr-only">${card.label}</span>`;

      inner.appendChild(back);
      inner.appendChild(front);
      cardEl.appendChild(inner);

      cardEl.addEventListener('click', onCardClick);
      card.el = cardEl;
      frag.appendChild(cardEl);
    });
    boardEl.appendChild(frag);
    // 盤面サイズを再計算
    requestAnimationFrame(resizeBoard);
  }

  function resetState() {
    deck = createDeck();
    flipped = [];
    lock = false;
    scores = [0, 0];
    currentPlayer = 0; // プレイヤー1先攻
    remainingPairs = 10;
    updateHUD();
  }

  function startGame() {
    resetState();
    renderBoard();
    setScreen('game');
    resizeBoard();
  }

  function endGame() {
    finalP1El.textContent = String(scores[0]);
    finalP2El.textContent = String(scores[1]);
    if (scores[0] > scores[1]) {
      resultTitleEl.textContent = '勝者: プレイヤー1';
    } else if (scores[1] > scores[0]) {
      resultTitleEl.textContent = '勝者: プレイヤー2';
    } else {
      resultTitleEl.textContent = '引き分け';
    }
    setScreen('result');
  }

  function currentPairPoint() {
    return remainingPairs <= 5 ? 2 : 1;
  }

  function onCardClick(e) {
    if (lock) return;
    const target = e.currentTarget;
    const idx = Number(target.dataset.index);
    const card = deck[idx];
    if (!card || card.matched) return;

    // 同じカードを2回クリックするのを禁止
    if (flipped.some((c) => c.idx === idx)) return;

    target.classList.add('flipped');
    flipped.push({ idx, card, el: target });

    if (flipped.length < 2) return;

    const [a, b] = flipped;
    // 判定中はロック
    lock = true;

    if (a.card.key === b.card.key) {
      // マッチ
      deck[a.idx].matched = true;
      deck[b.idx].matched = true;
      a.el.classList.add('matched');
      b.el.classList.add('matched');

      const point = currentPairPoint();
      scores[currentPlayer] += point;
      remainingPairs -= 1;
      updateHUD();

      flipped = [];
      lock = false; // 同一プレイヤー続行

      if (remainingPairs === 0) {
        // 少しだけアニメ時間を待ってから終了画面へ
        setTimeout(endGame, 300);
      }
    } else {
      // ミスマッチ → 1秒表示して伏せる → 手番交代
      setTimeout(() => {
        a.el.classList.remove('flipped');
        b.el.classList.remove('flipped');
        flipped = [];
        // 手番交代
        currentPlayer = currentPlayer === 0 ? 1 : 0;
        updateHUD();
        lock = false;
      }, FLIP_BACK_DELAY_MS);
    }
  }

  // イベント
  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', () => {
    // ゲーム再スタートは新たに初期化
    startGame();
  });

  function resizeBoard() {
    if (gameScreen.hidden) return;

    const gap = 8; // px
    const opts = [
      { cols: 5, rows: 4 },
      { cols: 4, rows: 5 }
    ];

    const boardRectTop = boardEl.getBoundingClientRect().top;
    const viewportH = window.innerHeight;
    const availH = Math.max(100, viewportH - boardRectTop - 8); // 下余白 8px
    const availW = boardEl.clientWidth; // #appのパディング込みの横幅

    let best = { size: 0, cols: 5, rows: 4 };
    for (const o of opts) {
      const maxW = (availW - gap * (o.cols - 1)) / o.cols;
      const maxFromH = ((availH - gap * (o.rows - 1)) / o.rows) * (3 / 4); // width制約
      const size = Math.floor(Math.max(0, Math.min(maxW, maxFromH)));
      if (size > best.size) best = { size, cols: o.cols, rows: o.rows };
    }

    // セーフガード（極端に小さい画面）
    const finalSize = Math.max(40, best.size); // 最小幅 40px

    boardEl.style.setProperty('--cols', String(best.cols));
    boardEl.style.setProperty('--card-size', finalSize + 'px');
    boardEl.style.setProperty('--gap', gap + 'px');
  }

  window.addEventListener('resize', () => resizeBoard());
  window.addEventListener('orientationchange', () => setTimeout(resizeBoard, 50));

  // 初期画面
  setScreen('start');

  // 互換性重視のPNGファビコンを動的生成（SVG未対応・キャッシュ問題対策）
  (function setFavicon() {
    try {
      const emoji = '🍏';
      function makeIcon(size) {
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const g = c.getContext('2d');
        // 背景（丸）
        g.fillStyle = '#1f7a3a';
        g.beginPath(); g.arc(size/2, size/2, size*0.48, 0, Math.PI*2); g.fill();
        // 文字（絵文字）
        g.font = `${Math.round(size*0.64)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(emoji, size/2, size/2 + size*0.02);
        return c.toDataURL('image/png');
      }
      const icon32 = makeIcon(32);
      const icon180 = makeIcon(180);

      function upsertLink(sel, rel, sizes, type, href) {
        let link = document.querySelector(sel);
        if (!link) {
          link = document.createElement('link');
          document.head.appendChild(link);
        }
        link.rel = rel; if (sizes) link.sizes = sizes; if (type) link.type = type; link.href = href;
      }

      upsertLink('link[rel="icon"][sizes="32x32"]', 'icon', '32x32', 'image/png', icon32);
      upsertLink('link[rel="apple-touch-icon"]', 'apple-touch-icon', '180x180', 'image/png', icon180);
    } catch (_) {
      // 失敗時は既存のSVGリンクにフォールバック
    }
  })();
})();
