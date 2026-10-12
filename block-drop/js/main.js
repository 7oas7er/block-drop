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
var overlayScoreNode = document.getElementById("overlay-score");
var highScoreForm = document.getElementById("high-score-form");
var nameInput = document.getElementById("player-name");
var highScoreList = document.getElementById("high-score-list");
var pauseButton = document.getElementById("pause");

var lastFrameTime = null;
var accumulator = 0;
var scores = [];
var scoresReady = false;
var sawGameOver = false;
var enteringName = false;
var latestIndex = -1;
var savePromise = null;
var statusNode = document.getElementById("high-score-status");
var saveButton = highScoreForm.querySelector("button");

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

function setText(node, value) {
  if (node.textContent !== value) {
    node.textContent = value;
  }
}

function writeStats() {
  setText(scoreNode, String(state.score));
  setText(levelNode, String(state.level));
  setText(linesNode, String(state.lines));
}

function writeHighScores() {
  var rows = [];
  var index;
  var entry;
  var item;
  var rank;
  var name;
  var points;

  highScoreList.textContent = "";
  for (index = 0; index < BlockDropScores.MAX_SCORES; index += 1) {
    entry = scores[index];
    item = document.createElement("li");
    if (index === latestIndex) {
      item.className = "latest";
    }
    rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = String(index + 1);
    name = document.createElement("span");
    name.className = "name";
    name.textContent = entry ? entry.name : "---";
    points = document.createElement("span");
    points.className = "points";
    points.textContent = entry ? String(entry.score) : "0";
    item.appendChild(rank);
    item.appendChild(name);
    item.appendChild(points);
    rows.push(item);
  }
  for (index = 0; index < rows.length; index += 1) {
    highScoreList.appendChild(rows[index]);
  }
}

function setStatus(message) {
  statusNode.textContent = message;
}

function beginNameEntry() {
  enteringName = true;
  highScoreForm.classList.remove("hidden");
  nameInput.value = "";
  nameInput.focus();
}

function commitPendingScore() {
  var name;
  var score;
  if (savePromise) {
    return savePromise;
  }
  if (!enteringName) {
    return Promise.resolve(true);
  }
  name = nameInput.value;
  score = state.score;
  enteringName = false;
  saveButton.disabled = true;
  saveButton.textContent = "Saving...";
  highScoreForm.classList.add("hidden");
  savePromise = BlockDropScores.save(name, score).then(function (result) {
    scores = result.list;
    latestIndex = result.saved ? result.index : -1;
    writeHighScores();
    setStatus(result.saved ? "" : "That score did not make the table.");
    return true;
  }).catch(function () {
    enteringName = true;
    nameInput.value = name;
    highScoreForm.classList.remove("hidden");
    setStatus("Could not save this score.");
    nameInput.focus();
    return false;
  }).finally(function () {
    savePromise = null;
    saveButton.disabled = false;
    saveButton.textContent = "Save";
  });
  return savePromise;
}

function writeOverlay() {
  if (state.gameOver && !sawGameOver) {
    overlayScoreNode.textContent = "Score " + state.score;
    overlayScoreNode.classList.remove("hidden");
    if (scoresReady) {
      sawGameOver = true;
      if (BlockDropScores.qualifies(scores, state.score)) {
        beginNameEntry();
      }
    }
  }
  if (!state.gameOver) {
    sawGameOver = false;
    enteringName = false;
    highScoreForm.classList.add("hidden");
    overlayScoreNode.classList.add("hidden");
  }
  if (state.gameOver) {
    overlayNode.classList.remove("hidden");
    setText(overlayTextNode, "Game over");
  } else if (state.paused) {
    overlayNode.classList.remove("hidden");
    setText(overlayTextNode, "Paused");
  } else {
    overlayNode.classList.add("hidden");
  }
  setText(pauseButton, state.paused ? "Resume" : "Pause");
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

function restartGame() {
  commitPendingScore().then(function (saved) {
    if (!saved) {
      return;
    }
    setStatus("");
    BlockDrop.restart(state);
    accumulator = 0;
  });
}

function bindPress(button, action) {
  var suppressClick = false;

  button.addEventListener("pointerdown", function (event) {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }
    event.preventDefault();
    suppressClick = true;
    action();
    requestAnimationFrame(function () {
      suppressClick = false;
    });
  });

  button.addEventListener("click", function () {
    if (suppressClick) {
      return;
    }
    action();
  });
}

function bindHold(button, action) {
  var pointerId = null;
  var delayTimer = 0;
  var repeatTimer = 0;

  function stop(event) {
    if (pointerId === null) {
      return;
    }
    if (event && event.pointerId !== pointerId) {
      return;
    }
    window.clearTimeout(delayTimer);
    window.clearInterval(repeatTimer);
    delayTimer = 0;
    repeatTimer = 0;
    if (button.hasPointerCapture(pointerId)) {
      button.releasePointerCapture(pointerId);
    }
    pointerId = null;
  }

  button.addEventListener("pointerdown", function (event) {
    if (!event.isPrimary || event.button !== 0 || pointerId !== null) {
      return;
    }
    event.preventDefault();
    pointerId = event.pointerId;
    try {
      button.setPointerCapture(pointerId);
    } catch (error) {
      // A pointer the browser will not capture can still repeat until pointerup.
    }
    action();
    delayTimer = window.setTimeout(function () {
      repeatTimer = window.setInterval(action, 50);
    }, 170);
  });

  button.addEventListener("pointerup", stop);
  button.addEventListener("pointercancel", stop);
  button.addEventListener("lostpointercapture", stop);
}

function onKeyDown(event) {
  var code = event.code;

  if (event.target === nameInput) {
    return;
  }
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
    restartGame();
  }
}

bindPress(pauseButton, function () {
  BlockDrop.togglePause(state);
});

bindPress(document.getElementById("restart"), restartGame);

bindHold(document.getElementById("move-left"), function () {
  BlockDrop.move(state, -1, 0);
});
bindHold(document.getElementById("soft-drop"), function () {
  BlockDrop.move(state, 0, 1);
});
bindHold(document.getElementById("move-right"), function () {
  BlockDrop.move(state, 1, 0);
});
bindPress(document.getElementById("rotate"), function () {
  BlockDrop.rotate(state);
});
bindPress(document.getElementById("hard-drop"), function () {
  BlockDrop.hardDrop(state);
});
document.querySelector(".touch-pad").addEventListener("contextmenu", function (event) {
  event.preventDefault();
});

nameInput.addEventListener("input", function () {
  var cleaned = nameInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  nameInput.value = cleaned.slice(0, BlockDropScores.NAME_LENGTH);
});

highScoreForm.addEventListener("submit", function (event) {
  event.preventDefault();
  commitPendingScore();
});

document.addEventListener("keydown", onKeyDown);
writeHighScores();
BlockDropScores.load().then(function (list) {
  scores = list;
  scoresReady = true;
  writeHighScores();
}).catch(function () {
  scoresReady = true;
  setStatus("Could not load high scores.");
});
requestAnimationFrame(onFrame);
