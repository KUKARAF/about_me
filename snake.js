(function () {
  'use strict';

  var CELL      = 60;
  var STEP_MS   = 150;
  var DELAY_MS  = 10000;
  var SNAKE_LEN = 4;
  var INSET     = 6;
  var SZ        = CELL - INSET * 2; // 48
  var ACCENT    = '#ff4d00';

  var canvas, ctx;
  var cols, rows;
  var snake        = [];
  var dir          = { x: -1, y: 0 };
  var nextDir      = { x: -1, y: 0 };
  var food         = null;
  var alive        = false;
  var lastStep     = 0;
  var pulseT       = 0;
  var rafId        = null;
  var gameOverOpacity = 1.0;

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    var w   = window.innerWidth;
    var h   = window.innerHeight;
    canvas.width  = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.floor(w / CELL);
    rows = Math.floor(h / CELL);
    if (alive && snake.length) {
      var head = snake[0];
      if (head.x >= cols || head.y >= rows) {
        console.warn('[snake] viewport shrink pushed snake out of bounds — ending game');
        alive = false;
      }
    }
  }

  function init() {
    canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;' +
      'pointer-events:none;z-index:0;';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function placeFood() {
    var occupied = new Set(snake.map(function (s) { return s.x + ',' + s.y; }));
    var c, attempts = 0;
    do {
      c = {
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows),
      };
      attempts++;
    } while (occupied.has(c.x + ',' + c.y) && attempts < 200);
    if (occupied.has(c.x + ',' + c.y)) {
      console.warn('[snake] placeFood exhausted 200 attempts — board nearly full');
    }
    food = c;
  }

  function startGame() {
    if (cols < 1 || rows < 1) {
      console.warn('[snake] viewport too small to start (' + cols + 'x' + rows + ' cells)');
      return;
    }
    var startRow = Math.floor(Math.random() * rows);
    snake = [];
    for (var i = 0; i < SNAKE_LEN; i++) {
      snake.push({ x: cols - 1 + i, y: startRow });
    }
    dir          = { x: -1, y: 0 };
    nextDir      = { x: -1, y: 0 };
    alive        = true;
    gameOverOpacity = 1.0;
    canvas.style.opacity = '1';
    placeFood();
    lastStep = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function setupKeys() {
    var MAP = {
      ArrowUp:    { x:  0, y: -1 },
      ArrowDown:  { x:  0, y:  1 },
      ArrowLeft:  { x: -1, y:  0 },
      ArrowRight: { x:  1, y:  0 },
    };
    window.addEventListener('keydown', function (e) {
      var d = MAP[e.key];
      if (!d || !alive) return;
      if (d.x === -dir.x && d.y === -dir.y) return;
      nextDir = d;
    });
  }

  function step() {
    dir = nextDir;
    var head    = snake[0];
    var newHead = { x: head.x + dir.x, y: head.y + dir.y };

    if (newHead.x < 0 || newHead.x >= cols || newHead.y < 0 || newHead.y >= rows) {
      alive = false;
      return;
    }
    for (var i = 0; i < snake.length - 1; i++) {
      if (snake[i].x === newHead.x && snake[i].y === newHead.y) {
        alive = false;
        return;
      }
    }

    snake.unshift(newHead);
    if (food && newHead.x === food.x && newHead.y === food.y) {
      food = null;
      placeFood();
    } else {
      snake.pop();
    }
  }

  function drawSegment(x, y, alpha) {
    ctx.save();
    ctx.shadowColor = ACCENT;
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = 'rgba(255,77,0,' + alpha + ')';
    ctx.fillRect(x * CELL + INSET, y * CELL + INSET, SZ, SZ);
    ctx.restore();
  }

  function drawSnake() {
    for (var i = 0; i < snake.length; i++) {
      var s = snake[i];
      if (s.x < 0 || s.x >= cols || s.y < 0 || s.y >= rows) continue;
      var t     = snake.length > 1 ? i / (snake.length - 1) : 0;
      var alpha = 0.55 - t * 0.37;
      drawSegment(s.x, s.y, alpha.toFixed(3));
    }
  }

  function drawFood() {
    if (!food) return;
    var pulse = Math.sin(pulseT / 750) * 0.5 + 0.5;
    var blur  = 12 + pulse * 16;
    var core  = 10;

    ctx.save();
    ctx.shadowColor = ACCENT;
    ctx.shadowBlur  = blur;
    ctx.fillStyle   = 'rgba(255,77,0,0.85)';
    ctx.fillRect(food.x * CELL + INSET, food.y * CELL + INSET, SZ, SZ);
    ctx.shadowBlur  = 4;
    ctx.fillStyle   = 'rgba(255,180,100,0.6)';
    ctx.fillRect(
      food.x * CELL + INSET + core,
      food.y * CELL + INSET + core,
      SZ - core * 2,
      SZ - core * 2
    );
    ctx.restore();
  }

  function draw() {
    drawSnake();
    drawFood();
  }

  function loop(ts) {
    if (!alive && gameOverOpacity <= 0) return;

    var dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    if (alive && ts - lastStep >= STEP_MS) {
      step();
      lastStep = ts;
    }
    pulseT = ts;
    draw();

    if (!alive) {
      gameOverOpacity = Math.max(0, gameOverOpacity - 0.011);
      canvas.style.opacity = gameOverOpacity.toString();
    }

    requestAnimationFrame(loop);
  }

  function bootstrap() {
    init();
    setupKeys();
    setTimeout(startGame, DELAY_MS);
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}());
