import { test, expect } from "@playwright/test";

const mockScores = {
  scores: [
    { name: "ACE", score: 1200 },
    { name: "BOB", score: 800 },
    { name: "CAT", score: 400 },
  ],
};

async function openGame(page) {
  await page.route("**/api/scores", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockScores),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ scores: mockScores.scores, index: -1, saved: false }),
    });
  });

  await page.goto("./index.html");
  await page.waitForFunction(() => window.BlockDropApp && window.BlockDropApp.getState);
}

test.describe("Block Drop smoke", () => {
  test("shows chrome, high scores, and starting stats", async ({ page }) => {
    await openGame(page);

    await expect(page.locator("h1")).toHaveText("Block Drop");
    await expect(page.locator("#score")).toHaveText("0");
    await expect(page.locator("#level")).toHaveText("1");
    await expect(page.locator("#lines")).toHaveText("0");
    await expect(page.locator("#high-score-list li")).toHaveCount(10);
    await expect(page.locator("#high-score-list li").first()).toContainText("ACE");
    await expect(page.locator("#high-score-list li").first()).toContainText("1200");
    await expect(page.locator("#pause")).toBeVisible();
    await expect(page.locator("#board")).toBeVisible();
  });

  test("moves the piece with arrow keys", async ({ page }) => {
    await openGame(page);
    const before = await page.evaluate(() => {
      const piece = window.BlockDropApp.getState().piece;
      return { x: piece.x, y: piece.y, type: piece.type };
    });

    await page.keyboard.press("ArrowLeft");
    const afterLeft = await page.evaluate(() => window.BlockDropApp.getState().piece.x);
    expect(afterLeft).toBe(before.x - 1);

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    const afterRight = await page.evaluate(() => window.BlockDropApp.getState().piece.x);
    expect(afterRight).toBe(before.x + 1);
  });

  test("rotates the piece with ArrowUp", async ({ page }) => {
    await openGame(page);
    // Prefer a non-O piece so rotation is visible in rotation index / cells.
    await page.evaluate(() => {
      const state = window.BlockDropApp.getState();
      state.piece.type = "T";
      state.piece.rotation = 0;
      state.piece.x = 3;
      state.piece.y = 2;
    });

    await page.keyboard.press("ArrowUp");
    const rotation = await page.evaluate(() => window.BlockDropApp.getState().piece.rotation);
    expect(rotation).toBe(1);
  });

  test("pauses and resumes from the button", async ({ page }) => {
    await openGame(page);
    await page.locator("#pause").click();
    await expect(page.locator("#overlay-text")).toHaveText("Paused");
    expect(await page.evaluate(() => window.BlockDropApp.getState().paused)).toBe(true);

    await page.locator("#pause").click();
    await expect(page.locator("#overlay")).toHaveClass(/hidden/);
    expect(await page.evaluate(() => window.BlockDropApp.getState().paused)).toBe(false);
  });
});
