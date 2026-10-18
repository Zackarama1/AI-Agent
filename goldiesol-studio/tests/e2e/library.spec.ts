import { expect, test, type Page } from '@playwright/test';

async function newDesign(page: Page, name: string, onePiece = false) {
  await page.goto('/designs/new');
  if (onePiece) await page.getByRole('radio', { name: 'One-piece' }).click();
  await page.getByPlaceholder('e.g. Riviera Pearl Tri').fill(name);
  await page.getByRole('button', { name: 'Start designing' }).click();
  // Creating a design renders and saves v1 server-side; allow for a busy test server.
  await expect(page.getByLabel('Design name')).toHaveValue(name, { timeout: 15_000 });
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  return page.url();
}

// On phones the filter panel is collapsed behind a button.
async function openFilters(page: Page) {
  const toggle = page.getByRole('button', { name: /^Filters/ });
  if (await toggle.isVisible()) await toggle.click();
}

test('pin a change request on the garment and resolve it', async ({ page }) => {
  await newDesign(page, `Pins ${Date.now()}`);
  await page.getByRole('button', { name: 'Pin a note' }).click();
  const box = (await page.locator('[data-testid=garment-canvas] svg').boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.7);
  await page.getByLabel('Type').last().selectOption('change_request');
  await page.getByLabel('Note text').fill('Lower the front rise by 2 cm');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('button', { name: /Note 1: Lower the front rise/ })).toBeVisible();
  await expect(page.getByTestId('note-list')).toContainText('Lower the front rise by 2 cm');

  // Persisted across reloads, and resolving moves it out of "Open".
  await page.reload();
  await page.getByRole('tab', { name: /Notes/ }).click();
  // Resolving removes it from the Open list straight away.
  await page.getByTestId('note-list').getByLabel('Resolved').click();
  await expect(page.getByText('Nothing open — lovely.')).toBeVisible();
  await page.getByRole('radio', { name: 'Resolved' }).click();
  await expect(page.getByTestId('note-list')).toContainText('Lower the front rise by 2 cm');
  await page.reload();
  await page.getByRole('tab', { name: /Notes/ }).click();
  await expect(page.getByText('Nothing open — lovely.')).toBeVisible();
});

test('restore an earlier version and branch from it', async ({ page }) => {
  await newDesign(page, `Restore ${Date.now()}`);
  await page.getByLabel('Cup height value').fill('20');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 10_000 });
  await page.getByRole('tab', { name: 'Versions' }).click();
  await expect(page.getByTestId('version-list').locator('li')).toHaveCount(2);

  await page.getByTestId('version-list').locator('li').last().click();
  await page.getByRole('button', { name: 'Restore this version' }).click();
  await expect(page.getByTestId('version-list').locator('li')).toHaveCount(3);
  await expect(page.getByTestId('version-list').locator('li').first()).toContainText('Restored v1.');
  await page.getByRole('tab', { name: 'Properties' }).click();
  await expect(page.getByLabel('Cup height value')).toHaveValue('15');

  await page.getByRole('tab', { name: 'Versions' }).click();
  await page.getByTestId('version-list').locator('li').nth(1).click();
  await page.getByRole('button', { name: 'Branch as new design' }).click();
  await expect(page.getByLabel('Design name')).toHaveValue(/branch from v2/);
  await page.getByRole('tab', { name: 'Versions' }).click();
  await expect(page.getByTestId('version-list')).toContainText('Branched from');
});

test('library filters, views and compare', async ({ page }) => {
  const stamp = Date.now();
  await newDesign(page, `Filter Maillot ${stamp}`, true);
  await page.goto('/designs');
  await page.getByPlaceholder('Search names and tags').fill(`Filter Maillot ${stamp}`);
  await expect(page.getByTestId('design-card')).toHaveCount(1);
  await page.getByPlaceholder('Search names and tags').fill('');
  await openFilters(page);
  await page.getByLabel('Category').selectOption('one_piece');
  await expect(page.getByRole('heading', { name: 'Blush Lace Triangle' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear filters' }).click();

  await page.getByRole('radio', { name: 'List view' }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByRole('radio', { name: 'Board view' }).click();
  await expect(page.getByRole('region', { name: 'In design' })).toBeVisible();
  await page.getByRole('radio', { name: 'Grid view' }).click();

  await page.getByLabel('Compare Blush Lace Triangle').check();
  await page.getByLabel(`Compare Filter Maillot ${stamp}`).check();
  await page.getByRole('link', { name: 'Compare side by side' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Compare designs' })).toBeVisible();
  await expect(page.getByText('T1 · Cup height (centre)')).toBeVisible();
  await expect(page.getByText('O1 · Torso length (strap top to crotch)')).toBeVisible();
});

test('duplicate and archive from the library menu', async ({ page }) => {
  const name = `Dupe ${Date.now()}`;
  await newDesign(page, name);
  await page.goto('/designs');
  await page.getByRole('button', { name: `More actions for ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Duplicate as new' }).click();
  await expect(page.getByLabel('Design name')).toHaveValue(`${name} — copy`);

  await page.goto('/designs');
  await page.getByRole('button', { name: `More actions for ${name} — copy` }).click();
  await page.getByRole('menuitem', { name: 'Archive' }).click();
  await expect(page.getByRole('heading', { name: `${name} — copy` })).toHaveCount(0);
  await openFilters(page);
  await page.getByLabel('Status').selectOption('archived');
  await expect(page.getByRole('heading', { name: `${name} — copy` })).toBeVisible();
});

test('create a collection and add a design to it', async ({ page }) => {
  const design = `Coll ${Date.now()}`;
  const collection = `Riviera Nights ${Date.now()}`;
  await newDesign(page, design);
  await page.goto('/collections');
  await page.getByRole('button', { name: 'New collection' }).click();
  await page.getByPlaceholder('e.g. Resort 27').first().fill(collection);
  await page.getByRole('button', { name: 'Create collection' }).click();
  await expect(page.getByRole('heading', { level: 1, name: collection })).toBeVisible();
  await page.getByRole('button', { name: 'Add designs' }).click();
  await page.getByRole('checkbox', { name: new RegExp(design) }).check();
  await page.getByRole('button', { name: /to this collection/ }).click();
  await expect(page.getByRole('heading', { name: design })).toBeVisible();

  await page.goto('/collections');
  await expect(page.getByRole('link', { name: new RegExp(collection) })).toContainText('1 design');
});
