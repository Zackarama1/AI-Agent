import { expect, test, type Page } from "@playwright/test";

async function command(page: Page, text: string, newPanel = false) {
  const input = page.getByRole("combobox", { name: "Command line" });
  await input.fill(text);
  await input.press(newPanel ? "Shift+Enter" : "Enter");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("QUARRY").first()).toBeVisible();
});

test("health endpoint is green", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect((await res.json()).status).toBe("ok");
});

test("unknown commands are handled gracefully", async ({ page }) => {
  await command(page, "FOOBAR");
  const alert = page.getByRole("alert").filter({ hasText: "Unknown command" });
  await expect(alert).toBeVisible();
  await expect(alert.getByRole("button", { name: "HELP" })).toBeVisible();
});

test("HELP lists functions and planned functions explain their phase", async ({ page }) => {
  await command(page, "HELP");
  await expect(page.getByRole("button", { name: /DES\s+Description/ }).first()).toBeVisible();
  await command(page, "vod ln des");
  await expect(page.getByText("Arrives in Phase 1.").first()).toBeVisible();
});

test("Tab completes function codes", async ({ page }) => {
  const input = page.getByRole("combobox", { name: "Command line" });
  await input.fill("VOD LN DE");
  await expect(page.getByRole("option", { name: /DES/ })).toBeVisible();
  await input.press("Tab");
  await expect(input).toHaveValue("VOD LN DES ");
});

test("layouts save and restore across reloads", async ({ page }) => {
  const ws = page.getByRole("group", { name: "Workspaces" });
  await ws.getByRole("button", { name: "Macro" }).click();
  await command(page, "KEYS", true);
  await expect(page.getByText("Keyboard", { exact: true })).toBeVisible();
  await page.keyboard.press("Control+s");
  await expect(page.getByText("Layout: saved")).toBeVisible();
  // Clear local copies so the restore must come from the server.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page
    .getByRole("group", { name: "Workspaces" })
    .getByRole("button", { name: "Macro" })
    .click();
  await expect(page.getByText("Keyboard", { exact: true })).toBeVisible();
});
