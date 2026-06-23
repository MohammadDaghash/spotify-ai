import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const baseUrl = process.env.SEARCH_OVERLAY_BASE_URL || "http://127.0.0.1:5174";

function searchPanel(page) {
  return page.getByTestId("topbar-search-panel");
}

async function typeSearch(page, query) {
  const searchInput = page.getByLabel(
    "Search songs, artists, albums, and recommendations",
  );

  await searchInput.fill("");
  await searchInput.fill(query);
  await searchPanel(page).waitFor({
    state: "visible",
    timeout: 15_000,
  });

  return searchInput;
}

async function assertSearchPanelIsTopLayer(page, resultText) {
  const resultButton = page
    .getByTestId("topbar-search-panel")
    .getByRole("button")
    .filter({ hasText: resultText })
    .first();
  const box = await resultButton.boundingBox();

  assert.ok(box, "Expected a visible search result button");

  const topLayerText = await page.evaluate(
    ({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return element?.closest("button")?.textContent || element?.textContent || "";
    },
    {
      x: box.x + Math.min(box.width / 2, 160),
      y: box.y + Math.min(box.height / 2, 24),
    },
  );

  assert.match(
    topLayerText,
    new RegExp(resultText, "i"),
    "Expected the search result to be the top interactive layer",
  );
}

async function assertOutsideClickCloses(page) {
  await page.mouse.click(12, 220);
  await searchPanel(page).waitFor({
    state: "hidden",
    timeout: 5_000,
  });
}

async function assertDesktop(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  const searchInput = await typeSearch(page, "Billie");

  const inputBox = await searchInput.boundingBox();
  const panelBox = await searchPanel(page).boundingBox();

  assert.ok(inputBox, "Expected search input bounds");
  assert.ok(panelBox, "Expected search panel bounds");
  assert.ok(
    panelBox.y >= inputBox.y + inputBox.height - 2,
    "Expected desktop panel to open directly under the search input",
  );

  await assertSearchPanelIsTopLayer(page, "Billie");
  await assertOutsideClickCloses(page);

  await typeSearch(page, "Billie");
  await searchInput.press("Enter");
  await page.waitForURL(/\/dashboard\?/, { timeout: 15_000 });

  await page.close();
}

async function assertMobile(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  const searchInput = await typeSearch(page, "Billie");

  const panelBox = await searchPanel(page).boundingBox();

  assert.ok(panelBox, "Expected mobile search panel bounds");
  assert.ok(panelBox.x <= 16, "Expected mobile panel to start near viewport edge");
  assert.ok(
    panelBox.width >= 358,
    "Expected mobile panel to use a near full-width sheet",
  );

  await assertSearchPanelIsTopLayer(page, "Billie");
  await searchInput.press("Escape");
  await searchPanel(page).waitFor({
    state: "hidden",
    timeout: 5_000,
  });

  await page.close();
}

const browser = await chromium.launch({ headless: true });

try {
  await assertDesktop(browser);
  await assertMobile(browser);
  console.log("Search overlay tests passed");
} finally {
  await browser.close();
}
