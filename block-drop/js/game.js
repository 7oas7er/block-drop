var BlockDrop = window.BlockDrop || {};

// Helpers stay inside this function so they do not become page-wide globals.
(function () {
  var LINE_SCORES = [0, 100, 300, 500, 800];

  function randomType() {
    var types = BlockDrop.TYPES;
    var index = Math.floor(Math.random() * types.length);
    return types[index];
  }

  function emptyRow() {
    var row = [];
    var c;
    for (c = 0; c < BlockDrop.COLS; c++) {
      row.push(0);
    }
    return row;
  }

  function emptyBoard() {
    var board = [];
    var r;
    for (r = 0; r < BlockDrop.ROWS; r++) {
      board.push(emptyRow());
    }
    return board;
  }

  function wipeBoard(board) {
    var r;
    var c;
    for (r = 0; r < board.length; r++) {
      for (c = 0; c < board[r].length; c++) {
        board[r][c] = 0;
      }
    }
  }

  function rowFull(row) {
    var c;
    for (c = 0; c < row.length; c++) {
      if (row[c] === 0) {
        return false;
      }
    }
    return true;
  }

  function clearFullRows(board) {
    var cleared = 0;
    var r = board.length - 1;
    while (r >= 0) {
      if (!rowFull(board[r])) {
        r -= 1;
        continue;
      }
      board.splice(r, 1);
      board.unshift(emptyRow());
      cleared += 1;
    }
    return cleared;
  }

  function typeValue(type) {
    return BlockDrop.TYPES.indexOf(type) + 1;
  }

  function canPlay(state) {
    return !state.paused && !state.gameOver && state.piece;
  }

  // Used by createState, lock, and restart. A blocked spawn stays visible.
  function spawnPiece(state) {
    var type = state.next;
    state.next = randomType();
    state.piece = {
      type: type,
      rotation: 0,
      x: 3,
      y: 0
    };
    if (BlockDrop.collides(state, state.piece)) {
      state.gameOver = true;
    }
  }

  BlockDrop.dropInterval = function (level) {
    return Math.max(100, 800 - (level - 1) * 70);
  };

  BlockDrop.cells = function (piece) {
    var shape = BlockDrop.SHAPES[piece.type][piece.rotation];
    var cells = [];
    var row;
    var col;
    for (row = 0; row < shape.length; row++) {
      for (col = 0; col < shape[row].length; col++) {
        if (shape[row][col]) {
          cells.push({ x: piece.x + col, y: piece.y + row });
        }
      }
    }
    return cells;
  };

  // y < 0 is above the visible board (spawn). That is legal when x is in range.
  BlockDrop.collides = function (state, piece) {
    var cells = BlockDrop.cells(piece);
    var i;
    var x;
    var y;
    for (i = 0; i < cells.length; i++) {
      x = cells[i].x;
      y = cells[i].y;
      if (x < 0 || x >= BlockDrop.COLS || y >= BlockDrop.ROWS) {
        return true;
      }
      if (y >= 0 && state.board[y][x] !== 0) {
        return true;
      }
    }
    return false;
  };

  BlockDrop.move = function (state, dx, dy) {
    var next;
    if (!canPlay(state)) {
      return false;
    }
    next = {
      type: state.piece.type,
      rotation: state.piece.rotation,
      x: state.piece.x + dx,
      y: state.piece.y + dy
    };
    if (BlockDrop.collides(state, next)) {
      return false;
    }
    state.piece.x = next.x;
    state.piece.y = next.y;
    if (dy > 0) {
      state.score += dy;
    }
    return true;
  };

  // Try the clockwise turn at x, then one column left, then one column right.
  BlockDrop.rotate = function (state) {
    var rotation;
    var kicks;
    var i;
    var candidate;
    if (!canPlay(state)) {
      return false;
    }
    rotation = (state.piece.rotation + 1) % 4;
    kicks = [0, -1, 1];
    for (i = 0; i < kicks.length; i++) {
      candidate = {
        type: state.piece.type,
        rotation: rotation,
        x: state.piece.x + kicks[i],
        y: state.piece.y
      };
      if (!BlockDrop.collides(state, candidate)) {
        state.piece.rotation = rotation;
        state.piece.x = candidate.x;
        return true;
      }
    }
    return false;
  };

  BlockDrop.hardDrop = function (state) {
    var moved;
    var next;
    if (!canPlay(state)) {
      return;
    }
    moved = 0;
    while (true) {
      next = {
        type: state.piece.type,
        rotation: state.piece.rotation,
        x: state.piece.x,
        y: state.piece.y + 1
      };
      if (BlockDrop.collides(state, next)) {
        break;
      }
      state.piece.y += 1;
      moved += 1;
    }
    state.score += moved * 2;
    BlockDrop.lock(state);
  };

  BlockDrop.lock = function (state) {
    var piece;
    var value;
    var cells;
    var i;
    var cell;
    var cleared;
    if (!state.piece) {
      return;
    }
    piece = state.piece;
    value = typeValue(piece.type);
    cells = BlockDrop.cells(piece);
    for (i = 0; i < cells.length; i++) {
      cell = cells[i];
      if (cell.y < 0) {
        continue;
      }
      state.board[cell.y][cell.x] = value;
    }
    cleared = clearFullRows(state.board);
    // Line points use the level from before this clear can raise it.
    state.score += LINE_SCORES[cleared] * state.level;
    state.lines += cleared;
    state.level = 1 + Math.floor(state.lines / 10);
    spawnPiece(state);
  };

  // Gravity. Unlike move(), a successful step does not add soft-drop points.
  BlockDrop.tick = function (state) {
    var next;
    if (!canPlay(state)) {
      return;
    }
    next = {
      type: state.piece.type,
      rotation: state.piece.rotation,
      x: state.piece.x,
      y: state.piece.y + 1
    };
    if (BlockDrop.collides(state, next)) {
      BlockDrop.lock(state);
      return;
    }
    state.piece.y += 1;
  };

  BlockDrop.createState = function () {
    var state = {
      board: emptyBoard(),
      piece: null,
      next: randomType(),
      score: 0,
      level: 1,
      lines: 0,
      paused: false,
      gameOver: false
    };
    spawnPiece(state);
    return state;
  };

  BlockDrop.togglePause = function (state) {
    if (state.gameOver) {
      return;
    }
    state.paused = !state.paused;
  };

  BlockDrop.restart = function (state) {
    wipeBoard(state.board);
    state.piece = null;
    state.score = 0;
    state.level = 1;
    state.lines = 0;
    state.paused = false;
    state.gameOver = false;
    state.next = randomType();
    spawnPiece(state);
    return state;
  };
})();
