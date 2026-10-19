import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadScores } from "../helpers/load-scripts.mjs";

describe("BlockDropScores.normalizeName", () => {
  const { BlockDropScores } = loadScores();

  it("uppercases and truncates to three alphanumeric characters", () => {
    assert.equal(BlockDropScores.normalizeName("ab"), "AB");
    assert.equal(BlockDropScores.normalizeName("frank!"), "FRA");
    assert.equal(BlockDropScores.normalizeName(""), "AAA");
    assert.equal(BlockDropScores.normalizeName("12-z"), "12Z");
  });
});

describe("BlockDropScores.qualifies", () => {
  const { BlockDropScores } = loadScores();

  it("rejects non-positive scores", () => {
    assert.equal(BlockDropScores.qualifies([], 0), false);
    assert.equal(BlockDropScores.qualifies([], -1), false);
  });

  it("accepts any positive score when the table is not full", () => {
    assert.equal(BlockDropScores.qualifies([{ name: "AAA", score: 10 }], 1), true);
  });

  it("requires matching or beating the lowest score when the table is full", () => {
    // Production lists are highest-first; qualifies() checks the last (lowest) entry.
    const list = [];
    for (let i = 0; i < BlockDropScores.MAX_SCORES; i++) {
      list.push({ name: "AAA", score: (BlockDropScores.MAX_SCORES - i) * 100 });
    }
    assert.equal(list[list.length - 1].score, 100);
    assert.equal(BlockDropScores.qualifies(list, 99), false);
    assert.equal(BlockDropScores.qualifies(list, 100), true);
    assert.equal(BlockDropScores.qualifies(list, 101), true);
  });
});

describe("BlockDropScores.load and save", () => {
  it("loads scores from GET /api/scores", async () => {
    const payload = {
      scores: [
        { name: "ACE", score: 900 },
        { name: "BOB", score: 100 },
      ],
    };
    const { BlockDropScores } = loadScores(async (url, options) => {
      assert.equal(url, "/api/scores");
      assert.equal(options && options.cache, "no-store");
      return {
        ok: true,
        json: async () => payload,
      };
    });
    const list = await BlockDropScores.load();
    assert.deepEqual(list, payload.scores);
  });

  it("posts a signed body when saving", async () => {
    let sawPost = false;
    const { BlockDropScores } = loadScores(async (url, options) => {
      assert.equal(url, "/api/scores");
      if (!options || options.method !== "POST") {
        return { ok: true, json: async () => ({ scores: [] }) };
      }
      sawPost = true;
      assert.equal(options.headers["Content-Type"], "application/json");
      assert.match(options.headers["x-amz-content-sha256"], /^[a-f0-9]{64}$/);
      assert.equal(JSON.parse(options.body).name, "ACE");
      assert.equal(JSON.parse(options.body).score, 420);
      return {
        ok: true,
        json: async () => ({
          scores: [{ name: "ACE", score: 420 }],
          index: 0,
          saved: true,
        }),
      };
    });
    const result = await BlockDropScores.save("ACE", 420);
    assert.equal(sawPost, true);
    assert.equal(result.saved, true);
    assert.equal(result.index, 0);
    assert.equal(result.list[0].name, "ACE");
  });
});
