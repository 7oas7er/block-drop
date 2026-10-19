import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadGame } from "../helpers/load-scripts.mjs";

const { BlockDrop } = loadGame();

function withPiece(state, overrides) {
  state.piece = Object.assign(
    {
      type: "T",
      rotation: 0,
      x: 3,
      y: 0,
    },
    overrides
  );
  return state;
}

describe("BlockDrop board basics", () => {
  it("creates a playable state with a piece and next type", () => {
    const state = BlockDrop.createState();
    assert.equal(state.board.length, BlockDrop.ROWS);
    assert.equal(state.board[0].length, BlockDrop.COLS);
    assert.ok(state.piece);
    assert.ok(BlockDrop.TYPES.includes(state.piece.type));
    assert.ok(BlockDrop.TYPES.includes(state.next));
    assert.equal(state.score, 0);
    assert.equal(state.level, 1);
    assert.equal(state.paused, false);
    assert.equal(state.gameOver, false);
  });

  it("reports collision outside the board", () => {
    const state = BlockDrop.createState();
    // O occupies columns x+1 and x+2 in its 4x4 matrix.
    withPiece(state, { type: "O", x: -2, y: 0 });
    assert.equal(BlockDrop.collides(state, state.piece), true);
    withPiece(state, { type: "O", x: 9, y: 0 });
    assert.equal(BlockDrop.collides(state, state.piece), true);
  });
});

describe("BlockDrop.move", () => {
  it("moves the active piece left and right", () => {
    const state = BlockDrop.createState();
    withPiece(state, { type: "O", x: 4, y: 2 });
    assert.equal(BlockDrop.move(state, -1, 0), true);
    assert.equal(state.piece.x, 3);
    assert.equal(BlockDrop.move(state, 1, 0), true);
    assert.equal(state.piece.x, 4);
  });

  it("soft-drops and awards score", () => {
    const state = BlockDrop.createState();
    withPiece(state, { type: "O", x: 4, y: 2 });
    assert.equal(BlockDrop.move(state, 0, 1), true);
    assert.equal(state.piece.y, 3);
    assert.equal(state.score, 1);
  });

  it("rejects moves that collide", () => {
    const state = BlockDrop.createState();
    withPiece(state, { type: "O", x: -1, y: 0 });
    assert.equal(BlockDrop.move(state, -1, 0), false);
    assert.equal(state.piece.x, -1);
  });

  it("does nothing while paused", () => {
    const state = BlockDrop.createState();
    withPiece(state, { type: "O", x: 4, y: 2 });
    state.paused = true;
    assert.equal(BlockDrop.move(state, -1, 0), false);
    assert.equal(state.piece.x, 4);
  });
});

describe("BlockDrop.rotate", () => {
  it("rotates a T piece clockwise", () => {
    const state = BlockDrop.createState();
    withPiece(state, { type: "T", rotation: 0, x: 3, y: 2 });
    assert.equal(BlockDrop.rotate(state), true);
    assert.equal(state.piece.rotation, 1);
  });

  it("does not rotate the O piece shape (rotation index still advances when free)", () => {
    const state = BlockDrop.createState();
    withPiece(state, { type: "O", rotation: 0, x: 4, y: 2 });
    const before = BlockDrop.cells(state.piece).map((c) => `${c.x},${c.y}`).sort().join("|");
    assert.equal(BlockDrop.rotate(state), true);
    const after = BlockDrop.cells(state.piece).map((c) => `${c.x},${c.y}`).sort().join("|");
    assert.equal(before, after);
  });
});

describe("BlockDrop.hardDrop, lock, tick", () => {
  it("hard-drops onto the floor and locks a new piece", () => {
    const state = BlockDrop.createState();
    withPiece(state, { type: "O", x: 4, y: 0 });
    const cleared = BlockDrop.hardDrop(state);
    assert.ok(cleared >= 0);
    assert.ok(state.piece);
    assert.ok(state.score > 0);
    // O occupies columns x+1 and x+2 (here 5 and 6) on the bottom rows.
    assert.notEqual(state.board[BlockDrop.ROWS - 1][5], 0);
    assert.notEqual(state.board[BlockDrop.ROWS - 1][6], 0);
  });

  it("clears a full row when a piece locks", () => {
    const state = BlockDrop.createState();
    const bottom = BlockDrop.ROWS - 1;
    for (let c = 0; c < BlockDrop.COLS; c++) {
      state.board[bottom][c] = 1;
    }
    withPiece(state, { type: "O", x: 4, y: 5 });
    const cleared = BlockDrop.lock(state);
    assert.equal(cleared, 1);
    assert.equal(state.lines, 1);
    assert.ok(state.score >= 100);
    assert.equal(state.board[bottom].every((v) => v === 0), true);
  });

  it("tick soft-falls one row without soft-drop points", () => {
    const state = BlockDrop.createState();
    withPiece(state, { type: "O", x: 4, y: 2 });
    const scoreBefore = state.score;
    assert.equal(BlockDrop.tick(state), -1);
    assert.equal(state.piece.y, 3);
    assert.equal(state.score, scoreBefore);
  });
});

describe("BlockDrop.pause and restart", () => {
  it("toggles pause", () => {
    const state = BlockDrop.createState();
    assert.equal(BlockDrop.togglePause(state), true);
    assert.equal(state.paused, true);
    assert.equal(BlockDrop.togglePause(state), true);
    assert.equal(state.paused, false);
  });

  it("restart clears score and board", () => {
    const state = BlockDrop.createState();
    state.score = 500;
    state.lines = 12;
    state.level = 2;
    state.board[10][3] = 2;
    BlockDrop.restart(state);
    assert.equal(state.score, 0);
    assert.equal(state.lines, 0);
    assert.equal(state.level, 1);
    assert.equal(state.board[10][3], 0);
    assert.ok(state.piece);
    assert.equal(state.gameOver, false);
  });
});
