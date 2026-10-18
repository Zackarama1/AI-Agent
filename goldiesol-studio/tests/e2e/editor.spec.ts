import { expect, test, type Page } from '@playwright/test';

// The demo store is shared by the server process, so each test makes its own design.
async function newDesign(page: Page, name: string) {
  await page.goto('/designs/new');
  await page.getByRole('radio', { name: /Goldie Lace Tri/ }).click();
  await page.getByRole('radio', { name: /Goldie Tie-Side/ }).click();
  await page.getByPlaceholder('e.g. Riviera Pearl Tri').fill(name);
  await page.getByRole('button', { name: 'Start designing' }).click();
  await expect(page.getByLabel('Design name')).toHaveValue(name);
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
}

const versionCount = (page: Page) => page.getByTestId('version-list').locator('li').count();

test('a new design autosaves each change as a version', async ({ page }) => {
  await newDesign(page, `Autosave ${Date.now()}`);
  await page.getByLabel('Cup height value').fill('17');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 10_000 });
  await page.getByRole('tab', { name: 'Versions' }).click();
  await expect(page.getByTestId('version-list')).toContainText('Top cup height 15 cm → 17 cm');
  expect(await versionCount(page)).toBe(2);

  // Reload: the change persisted as the current version.
  await page.reload();
  await expect(page.getByLabel('Cup height value')).toHaveValue('17');
});

test('undo and redo with the keyboard', async ({ page }) => {
  await newDesign(page, `Undo ${Date.now()}`);
  const cup = page.getByLabel('Cup height value');
  await cup.fill('19');
  await page.locator('[data-testid=garment-canvas]').click({ position: { x: 5, y: 5 } });
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+z`);
  await expect(cup).toHaveValue('15');
  await page.keyboard.press(`${mod}+Shift+z`);
  await expect(cup).toHaveValue('19');
});

test('embellishments can be added, duplicated and removed', async ({ page }) => {
  await newDesign(page, `Beads ${Date.now()}`);
  await page.getByRole('button', { name: 'Beading & Hardware' }).click();
  await page.getByRole('button', { name: 'Pearls' }).click();
  await expect(page.getByRole('heading', { name: 'Pearl' })).toBeVisible();
  await page.getByRole('button', { name: 'Duplicate (⌘D)' }).click();
  await expect(page.locator('[data-embellishment]')).toHaveCount(2);
  await page.getByRole('button', { name: 'Remove (Delete)' }).click();
  await expect(page.locator('[data-embellishment]')).toHaveCount(1);
});

test('a tuned top can be saved as a named shape and reused', async ({ page }) => {
  const name = `Riviera Tri ${Date.now()}`;
  await newDesign(page, `Shape ${Date.now()}`);
  await page.getByLabel('Cup width value').fill('16');
  await page.getByLabel('Shape name').fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(`Saved as "${name}".`)).toBeVisible();

  await page.goto('/shapes');
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await page.goto('/designs/new');
  await expect(page.getByRole('radio', { name: new RegExp(name) })).toBeVisible();
});

test('flat sketch, back view and grid toggle render', async ({ page }) => {
  await newDesign(page, `Views ${Date.now()}`);
  await page.getByRole('radio', { name: 'Flat sketch' }).click();
  await page.getByRole('radio', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Grid (1 cm)' }).click();
  await expect(page.locator('[data-testid=garment-canvas] svg [data-grid]')).toHaveCount(1);
  await expect(page.locator('[data-testid=garment-canvas] svg')).toHaveAttribute('aria-label', /back view/);
});

test('create a new shape from the Shape Library', async ({ page }) => {
  const name = `Soleil Cheeky ${Date.now()}`;
  await page.goto('/shapes/new');
  await page.getByRole('radio', { name: 'Bottom' }).click();
  await page.getByLabel('Silhouette').selectOption('cheeky');
  await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Save shape' }).click();
  await expect(page).toHaveURL(/\/shapes$/);
  await expect(page.getByRole('heading', { name })).toBeVisible();
});
