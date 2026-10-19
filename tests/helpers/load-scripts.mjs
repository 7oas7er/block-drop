import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const jsRoot = path.join(repoRoot, "block-drop", "js");

function runScript(context, filename) {
  const code = fs.readFileSync(path.join(jsRoot, filename), "utf8");
  vm.runInContext(code, context, { filename });
}

/**
 * Load browser game scripts into an isolated VM (no DOM).
 * Top-level `var BlockDrop = …` becomes a property on the VM context
 * (same object the scripts mutate), not necessarily on `window`.
 * @returns {{ BlockDrop: object }}
 */
export function loadGame() {
  // Seed window so pieces.js and game.js share one BlockDrop object
  // (`var BlockDrop = window.BlockDrop || {}` in each file).
  const window = { BlockDrop: {} };
  const context = { window, console };
  vm.createContext(context);
  runScript(context, "pieces.js");
  runScript(context, "game.js");
  return { BlockDrop: window.BlockDrop };
}

/**
 * Load high-score helpers with injectable fetch.
 * @param {typeof fetch} [fetchImpl]
 * @returns {{ BlockDropScores: object }}
 */
export function loadScores(fetchImpl = globalThis.fetch) {
  const window = { BlockDropScores: {} };
  const context = {
    window,
    console,
    fetch: fetchImpl,
    TextEncoder,
    crypto: webcrypto,
  };
  vm.createContext(context);
  runScript(context, "highscores.js");
  return { BlockDropScores: window.BlockDropScores };
}

export { repoRoot };
