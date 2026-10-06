# Block Drop

Block Drop is a falling-block game in the spirit of that kind of puzzle. Pieces drop on a grid. You move and rotate them so they fill horizontal lines. Filled lines clear, the score increases, and later pieces fall faster.

The game is a static page made of HTML, CSS, and JavaScript. The board and the next-piece preview are drawn on canvas elements. There is no framework, no bundler, no package manager, no backend, and no build step.

## How to run

Open `block-drop/index.html` directly in a browser.

The page loads three classic script tags, in this order: `js/pieces.js`, then `js/game.js`, then `js/main.js`. Each file attaches its data and functions to one shared `BlockDrop` object (`window.BlockDrop`). `pieces.js` defines the board size and the shapes. `game.js` defines the rules and calls those shapes. `main.js` creates the game state, draws the canvases, and handles the keyboard and buttons.

## How to play

A piece appears at the top of a 10 by 20 board and falls on its own. You move it left or right, rotate it clockwise, soft-drop it one row, or hard-drop it to the bottom. When it cannot fall any farther, it locks into the board. Every completely filled row is removed, and the rows above it move down.

The side panel shows the next piece, the score, the level, and the number of lines cleared. The next piece is a uniform random choice among the seven shapes: I, O, T, S, Z, J, and L.

If a new piece has nowhere to spawn, the game ends and the board overlay reads "Game over". Pressing P, or the Pause button, freezes the game and shows "Paused". The button label switches to Resume. Pressing either again continues. Pause does nothing after the game is over. Pressing R, or the Restart button, clears the board and starts a new game at score 0, level 1.

A clockwise rotation is tried in place, then one column left, then one column right. If all three positions overlap the wall or a locked block, the piece does not turn.

## Controls

- Arrow Left and Arrow Right move the piece one column.
- Arrow Up rotates it clockwise.
- Arrow Down soft-drops it one row.
- Space hard-drops it.
- P pauses or resumes.
- R restarts.

The Pause and Restart buttons do the same as P and R. Holding Left, Right, or Down repeats that move. Rotate, hard drop, pause, and restart do not repeat while the key is held.

## Score, level, and speed

Clearing lines adds 100, 300, 500, or 800 points times the current level, for 1, 2, 3, or 4 lines. The bonus uses the level from before that clear, so a clear that crosses a 10-line boundary does not use the new level. Soft drop adds 1 point per row. Hard drop adds 2 points per row. The automatic fall does not add points.

The level is `1 + floor(lines / 10)`, so it increases by one every 10 lines. The time between automatic drops starts at 800 ms on level 1 and shortens by 70 ms each level, with a floor of 100 ms: `max(100, 800 - (level - 1) * 70)`.

## Files

- `index.html` is the page: the board canvas, the next-piece canvas, the score, level, and lines, the Pause and Restart buttons, the on-page key list, and the three script tags.
- `css/styles.css` is the layout and appearance. The board and side panel sit next to each other, and they stack on a narrow window.
- `js/pieces.js` is the piece data: a 10 by 20 board, a 30-pixel cell, the seven shapes, their colors, and the four rotation grids for each shape.
- `js/game.js` is the rules: spawning, collision, move, rotate, soft drop, hard drop, locking, line clears, score, level, pause, and restart.
- `js/main.js` is the browser loop. It draws both canvases, updates the stats and overlay, advances gravity with `requestAnimationFrame`, and connects the keyboard and buttons to the rules.
