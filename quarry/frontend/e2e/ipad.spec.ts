import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("iPad gets the touch layout with large targets", async ({ page }) => {
  const panes = page.getByRole("group", { name: "Panes" });
  await expect(panes).toBeVisible();
  const chips = page.getByRole("navigation", { name: "Functions" }).getByRole("button");
  await expect(chips.first()).toBeVisible();
  for (const chip of await chips.all()) {
    const box = await chip.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test("tapping a chip runs it in the focused pane", async ({ page }) => {
  await page
    .getByRole("navigation", { name: "Functions" })
    .getByRole("button", { name: "STAT" })
    .tap();
  await expect(page.getByRole("columnheader", { name: "Provider" }).first()).toBeVisible();
});

test("security chips appear once a security is loaded", async ({ page }) => {
  const input = page.getByRole("combobox", { name: "Command line" });
  await input.fill("VOD LN DES");
  await input.press("Enter");
  const nav = page.getByRole("navigation", { name: "Functions" });
  await expect(nav.getByText("VOD LN")).toBeVisible();
  await nav.getByRole("button", { name: "GP" }).tap();
  await expect(page.getByText("VOD LN GP").first()).toBeVisible();
});

test("pane count switches between 1, 2 and 3", async ({ page }) => {
  await page.getByRole("button", { name: "3 panes" }).tap();
  await expect(page.locator("main [data-pane]")).toHaveCount(3);
  await page.getByRole("button", { name: "1 pane" }).tap();
  await expect(page.locator("main [data-pane]")).toHaveCount(1);
});

test("the app is installable (manifest + service worker)", async ({ page, request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect((await request.get("/sw.js")).status()).toBe(200);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/apple-touch-icon.png",
  );
});
