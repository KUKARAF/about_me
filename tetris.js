(function () {
  'use strict';

  var CELL         = 60;
  var INSET        = 6;
  var SZ           = CELL - INSET * 2; // 48
  var ACCENT       = '#ff4d00';
  var DELAY_MS     = 10000;
  var FALL_MS      = 800;
  var FALL_MIN     = 200;
  var FALL_DEC     = 15;
  var SOFT_MS      = 150;
  var FLASH_FRAMES = 2;

  var PIECES = [
    [[0,0],[0,1],[0,2],[0,3]], // I
    [[0,0],[0,1],[1,0],[1,1]], // O
    [[0,0],[0,1],[0,2],[1,1]], // T
    [[0,1],[0,2],[1,0],[1,1]], // S
    [[0,0],[0,1],[1,1],[1,2]], // Z
    [[0,0],[1,0],[1,1],[1,2]], // J
    [[0,2],[1,0],[1,1],[1,2]], // L
  ];

  var canvas, ctx;
  var cols, rows;
  var board       = [];
  var piece       = null;
  var fallMs      = FALL_MS;
  var lastFall    = 0;
  var softDrop    = false;
  var flashRows   = [];
  var flashFrames = 0;
  var alive           = false;
  var gameOverOpacity = 1.0;
  var rafId           = null;

  function rotateCW(shape) {
    var N = 0;
    for (var i = 0; i < shape.length; i++) {
      if (shape[i][0] > N) N = shape[i][0];
      if (shape[i][1] > N) N = shape[i][1];
    }
    N += 1;
    return shape.map(function (p) { return [p[1], N - 1 - p[0]]; });
  }

  function makeBoard() {
    var b = [];
    for (var r = 0; r < rows; r++) {
      b.push(new Array(cols).fill(0));
    }
    return b;
  }

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    var w   = window.innerWidth;
    var h   = window.innerHeight;
    canvas.width  = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.floor(w / CELL);
    rows = Math.floor(h / CELL);
    if (cols < 1 || rows < 1) {
      if (alive) alive = false;
      return;
    }
    board = makeBoard();
    if (alive && piece) {
      var oob = false;
      for (var i = 0; i < piece.shape.length; i++) {
        if (piece.col + piece.shape[i][1] >= cols ||
            piece.row + piece.shape[i][0] >= rows) {
          oob = true;
          break;
        }
      }
      if (oob) {
        piece = null;
        spawnPiece();
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

  function canPlace(p) {
    for (var i = 0; i < p.shape.length; i++) {
      var gr = p.row + p.shape[i][0];
      var gc = p.col + p.shape[i][1];
      if (gr < 0 || gr >= rows) return false;
      if (gc < 0 || gc >= cols) return false;
      if (board[gr][gc] !== 0)  return false;
    }
    return true;
  }

  function spawnPiece() {
    var idx   = Math.floor(Math.random() * PIECES.length);
    var shape = PIECES[idx];
    var maxC  = 0;
    for (var i = 0; i < shape.length; i++) {
      if (shape[i][1] > maxC) maxC = shape[i][1];
    }
    var p = { shape: shape, row: 0, col: Math.floor((cols - maxC - 1) / 2) };
    if (canPlace(p)) {
      piece = p;
    } else {
      alive = false;
    }
  }

  function tryMove(dc) {
    if (!piece) return;
    var p = { shape: piece.shape, row: piece.row, col: piece.col + dc };
    if (canPlace(p)) piece.col += dc;
  }

  function tryRotate() {
    if (!piece) return;
    var rotated = rotateCW(piece.shape);
    var p = { shape: rotated, row: piece.row, col: piece.col };
    if (canPlace(p)) { piece.shape = rotated; return; }
    p.col = piece.col + 1;
    if (canPlace(p)) { piece.col += 1; piece.shape = rotated; return; }
    p.col = piece.col - 1;
    if (canPlace(p)) { piece.col -= 1; piece.shape = rotated; }
  }

  function clearLines() {
    flashRows = [];
    for (var r = 0; r < rows; r++) {
      var full = true;
      for (var c = 0; c < cols; c++) {
        if (board[r][c] === 0) { full = false; break; }
      }
      if (full) flashRows.push(r);
    }
    if (flashRows.length > 0) {
      flashFrames = FLASH_FRAMES;
      return true;
    }
    return false;
  }

  function applyClears() {
    flashRows.sort(function (a, b) { return b - a; });
    for (var i = 0; i < flashRows.length; i++) {
      board.splice(flashRows[i], 1);
      board.unshift(new Array(cols).fill(0));
    }
    flashRows = [];
    spawnPiece();
  }

  function lockPiece() {
    for (var i = 0; i < piece.shape.length; i++) {
      var gr = piece.row + piece.shape[i][0];
      var gc = piece.col + piece.shape[i][1];
      if (gr >= 0 && gr < rows && gc >= 0 && gc < cols) {
        board[gr][gc] = 1;
      }
    }
    piece  = null;
    fallMs = Math.max(FALL_MIN, fallMs - FALL_DEC);
    var hadClears = clearLines();
    if (!hadClears && alive) spawnPiece();
  }

  function step(ts) {
    if (flashFrames > 0) {
      flashFrames--;
      if (flashFrames === 0) applyClears();
      return;
    }
    if (!piece) return;
    var interval = softDrop ? SOFT_MS : fallMs;
    if (ts - lastFall < interval) return;
    lastFall = ts;
    var p = { shape: piece.shape, row: piece.row + 1, col: piece.col };
    if (canPlace(p)) {
      piece.row++;
    } else {
      lockPiece();
    }
  }

  function drawCell(gc, gr, alpha, blur) {
    ctx.save();
    if (blur > 0) {
      ctx.shadowColor = ACCENT;
      ctx.shadowBlur  = blur;
    }
    ctx.fillStyle = 'rgba(255,77,0,' + alpha + ')';
    ctx.fillRect(gc * CELL + INSET, gr * CELL + INSET, SZ, SZ);
    ctx.restore();
  }

  function drawBoard() {
    var flashSet = {};
    for (var i = 0; i < flashRows.length; i++) flashSet[flashRows[i]] = true;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (board[r][c] !== 0) {
          if (flashSet[r]) {
            ctx.save();
            ctx.fillStyle = 'rgba(255,220,200,0.75)';
            ctx.fillRect(c * CELL + INSET, r * CELL + INSET, SZ, SZ);
            ctx.restore();
          } else {
            drawCell(c, r, 0.28, 4);
          }
        }
      }
    }
  }

  function drawGhost() {
    if (!piece) return;
    var ghostRow = piece.row;
    while (canPlace({ shape: piece.shape, row: ghostRow + 1, col: piece.col })) {
      ghostRow++;
    }
    if (ghostRow === piece.row) return;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle  = 'rgba(255,77,0,0.10)';
    for (var i = 0; i < piece.shape.length; i++) {
      var gr = ghostRow + piece.shape[i][0];
      var gc = piece.col + piece.shape[i][1];
      if (gr >= 0) ctx.fillRect(gc * CELL + INSET, gr * CELL + INSET, SZ, SZ);
    }
    ctx.restore();
  }

  function drawPiece() {
    if (!piece) return;
    for (var i = 0; i < piece.shape.length; i++) {
      var gr = piece.row + piece.shape[i][0];
      var gc = piece.col + piece.shape[i][1];
      if (gr >= 0) drawCell(gc, gr, 0.65, 14);
    }
  }

  function draw() {
    drawBoard();
    if (piece) {
      drawGhost();
      drawPiece();
    }
  }

  function loop(ts) {
    if (!alive && gameOverOpacity <= 0) return;

    var dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    if (alive) step(ts);
    draw();

    if (!alive) {
      gameOverOpacity = Math.max(0, gameOverOpacity - 0.011);
      canvas.style.opacity = gameOverOpacity.toString();
    }

    requestAnimationFrame(loop);
  }

  function setupKeys() {
    window.addEventListener('keydown', function (e) {
      if (!alive) return;
      if (e.key === 'ArrowLeft')  tryMove(-1);
      if (e.key === 'ArrowRight') tryMove(+1);
      if (e.key === 'ArrowUp')    tryRotate();
      if (e.key === 'ArrowDown')  softDrop = true;
    });
    window.addEventListener('keyup', function (e) {
      if (e.key === 'ArrowDown') softDrop = false;
    });
  }

  function startGame() {
    if (cols < 1 || rows < 1) return;
    board           = makeBoard();
    fallMs          = FALL_MS;
    lastFall        = performance.now();
    softDrop        = false;
    flashRows       = [];
    flashFrames     = 0;
    alive           = true;
    gameOverOpacity = 1.0;
    canvas.style.opacity = '1';
    spawnPiece();
    if (!alive) return;
    rafId = requestAnimationFrame(loop);
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
