var state = BlockDrop.createState();

var boardCanvas = document.getElementById("board");
var boardContext = boardCanvas.getContext("2d");
var nextCanvas = document.getElementById("next");
var nextContext = nextCanvas.getContext("2d");
var scoreNode = document.getElementById("score");
var levelNode = document.getElementById("level");
var linesNode = document.getElementById("lines");
var overlayNode = document.getElementById("overlay");
var overlayTextNode = document.getElementById("overlay-text");
var pauseButton = document.getElementById("pause");

var lastFrameTime = null;
var accumulator = 0;

function blockColor(type) {
  return BlockDrop.COLORS[type];
}

function lockedColor(value) {
  return BlockDrop.COLORS[BlockDrop.TYPES[value - 1]];
}

function fillBlock(context, pixelX, pixelY, color) {
  var cell = BlockDrop.CELL;
  context.fillStyle = color;
  context.fillRect(pixelX + 1, pixelY + 1, cell - 2, cell - 2);
}

function drawGrid(context) {
  var cell = BlockDrop.CELL;
  var width = BlockDrop.COLS * cell;
  var height = BlockDrop.ROWS * cell;
  var line;

  context.strokeStyle = "rgba(255,255,255,0.08)";
  context.beginPath();
  for (line = 0; line <= BlockDrop.COLS; line++) {
    context.moveTo(line * cell + 0.5, 0);
    context.lineTo(line * cell + 0.5, height);
  }
  for (line = 0; line <= BlockDrop.ROWS; line++) {
    context.moveTo(0, line * cell + 0.5);
    context.lineTo(width, line * cell + 0.5);
  }
  context.stroke();
}

function drawLockedCells(context) {
  var cell = BlockDrop.CELL;
  var row;
  var col;
  var value;

  for (row = 0; row < BlockDrop.ROWS; row++) {
    for (col = 0; col < BlockDrop.COLS; col++) {
      value = state.board[row][col];
      if (value === 0) {
        continue;
      }
      fillBlock(context, col * cell, row * cell, lockedColor(value));
    }
  }
}

function drawActivePiece(context) {
  var cell = BlockDrop.CELL;
  var cells;
  var index;
  var block;

  if (!state.piece) {
    return;
  }
  cells = BlockDrop.cells(state.piece);
  for (index = 0; index < cells.length; index++) {
    block = cells[index];
    if (block.y < 0) {
      continue;
    }
    fillBlock(context, block.x * cell, block.y * cell, blockColor(state.piece.type));
  }
}

function drawBoard() {
  boardContext.fillStyle = "#1a1a2e";
  boardContext.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  drawGrid(boardContext);
  drawLockedCells(boardContext);
  drawActivePiece(boardContext);
}

function drawNext() {
  var shape = BlockDrop.SHAPES[state.next][0];
  var cell = BlockDrop.CELL;
  var minCol = shape[0].length;
  var minRow = shape.length;
  var maxCol = -1;
  var maxRow = -1;
  var row;
  var col;
  var originX;
  var originY;

  nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextContext.fillStyle = "#1a1a2e";
  nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  for (row = 0; row < shape.length; row++) {
    for (col = 0; col < shape[row].length; col++) {
      if (!shape[row][col]) {
        continue;
      }
      if (col < minCol) {
        minCol = col;
      }
      if (row < minRow) {
        minRow = row;
      }
      if (col > maxCol) {
        maxCol = col;
      }
      if (row > maxRow) {
        maxRow = row;
      }
    }
  }

  originX = (nextCanvas.width - (maxCol - minCol + 1) * cell) / 2 - minCol * cell;
  originY = (nextCanvas.height - (maxRow - minRow + 1) * cell) / 2 - minRow * cell;

  for (row = 0; row < shape.length; row++) {
    for (col = 0; col < shape[row].length; col++) {
      if (!shape[row][col]) {
        continue;
      }
      fillBlock(nextContext, originX + col * cell, originY + row * cell, blockColor(state.next));
    }
  }
}

function writeStats() {
  scoreNode.textContent = String(state.score);
  levelNode.textContent = String(state.level);
  linesNode.textContent = String(state.lines);
}

function writeOverlay() {
  if (state.gameOver) {
    overlayNode.classList.remove("hidden");
    overlayTextNode.textContent = "Game over";
  } else if (state.paused) {
    overlayNode.classList.remove("hidden");
    overlayTextNode.textContent = "Paused";
  } else {
    overlayNode.classList.add("hidden");
  }
  pauseButton.textContent = state.paused ? "Resume" : "Pause";
}

function render() {
  drawBoard();
  drawNext();
  writeStats();
  writeOverlay();
}

function applyGravity(elapsed) {
  var interval;

  if (state.paused || state.gameOver) {
    return;
  }
  accumulator += elapsed;
  interval = BlockDrop.dropInterval(state.level);
  while (accumulator >= interval) {
    accumulator -= interval;
    BlockDrop.tick(state);
    if (state.paused || state.gameOver) {
      break;
    }
    interval = BlockDrop.dropInterval(state.level);
  }
}

function onFrame(now) {
  var elapsed = 0;

  if (lastFrameTime !== null) {
    elapsed = now - lastFrameTime;
  }
  lastFrameTime = now;
  applyGravity(elapsed);
  render();
  requestAnimationFrame(onFrame);
}

function blocksRepeat(code) {
  return code === "ArrowUp" || code === "Space" || code === "KeyP" || code === "KeyR";
}

function onKeyDown(event) {
  var code = event.code;

  if (code === "ArrowLeft" || code === "ArrowRight" || code === "ArrowUp" || code === "ArrowDown" || code === "Space") {
    event.preventDefault();
  }
  if (event.repeat && blocksRepeat(code)) {
    return;
  }
  if (code === "ArrowLeft") {
    BlockDrop.move(state, -1, 0);
  } else if (code === "ArrowRight") {
    BlockDrop.move(state, 1, 0);
  } else if (code === "ArrowUp") {
    BlockDrop.rotate(state);
  } else if (code === "ArrowDown") {
    BlockDrop.move(state, 0, 1);
  } else if (code === "Space") {
    BlockDrop.hardDrop(state);
  } else if (code === "KeyP") {
    BlockDrop.togglePause(state);
  } else if (code === "KeyR") {
    BlockDrop.restart(state);
    accumulator = 0;
  }
}

pauseButton.addEventListener("click", function () {
  BlockDrop.togglePause(state);
});

document.getElementById("restart").addEventListener("click", function () {
  BlockDrop.restart(state);
  accumulator = 0;
});

document.addEventListener("keydown", onKeyDown);
requestAnimationFrame(onFrame);
