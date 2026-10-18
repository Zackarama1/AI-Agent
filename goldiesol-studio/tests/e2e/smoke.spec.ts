import { expect, test } from '@playwright/test';

const ROUTES: [path: string, heading: RegExp][] = [
  ['/', /Welcome back to the atelier/],
  ['/designs', /^Designs$/],
  ['/designs/new', /Which top and bottom/],
  ['/shapes', /^Shapes$/],
  ['/shapes/new', /Create a new shape/],
  ['/materials', /^Materials$/],
  ['/colours', /^Colours$/],
  ['/insights', /^Insights$/],
  ['/suppliers', /^Suppliers$/],
  ['/collections', /^Collections$/],
  ['/designs/compare', /Compare designs/],
  ['/settings', /^Settings$/],
  ['/login', /Welcome to the atelier/],
];

for (const [path, heading] of ROUTES) {
  test(`${path} renders`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    // No horizontal scroll at any viewport (founder reviews on phone).
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

test('seed design opens in the editor, with its seeded shapes', async ({ page }) => {
  await page.goto('/designs');
  await page.getByRole('link', { name: /Blush Lace Triangle/ }).click();
  await expect(page.getByLabel('Design name')).toHaveValue('Blush Lace Triangle');
  await expect(page.locator('[data-testid=garment-canvas] svg')).toBeVisible();
  await expect(page.getByRole('button', { name: /Lace overlay/ })).toBeVisible();
  await page.goto('/shapes');
  await expect(page.getByRole('heading', { name: 'Goldie Lace Tri' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Goldie Tie-Side' })).toBeVisible();
});

test('supplier profile flags unverified terms', async ({ page }) => {
  await page.goto('/suppliers');
  await page.getByRole('link', { name: /Bali Swim/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Bali Swim' })).toBeVisible();
  await expect(page.getByText('Terms unverified')).toBeVisible();
});

test('unknown design shows the branded 404', async ({ page }) => {
  const res = await page.goto('/designs/00000000-0000-4000-8000-00000000dead');
  expect(res?.status()).toBe(404);
  await expect(page.getByText("This piece isn't in the atelier")).toBeVisible();
});

test('brand name is always spelled Goldiesol', async ({ page }) => {
  for (const path of ['/', '/settings', '/suppliers']) {
    await page.goto(path);
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/Goldie[\s-]?So[ul]|GoldieSol/);
  }
});
