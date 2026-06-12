import { expect, test } from '@playwright/test';
import { loginAs } from '../pages/auth';

/** Journey 1 — login as all three personas lands on the role home with the right shell. */
test.describe('persona login', () => {
  test('Alex (admin) lands on the catalog builder', async ({ page }) => {
    await loginAs(page, 'Alex Admin');
    await expect(page.getByRole('heading', { name: 'Catalog builder' })).toBeVisible();
    await expect(page.locator('aside')).toContainText('Alex Admin');
    await expect(page.locator('aside')).toContainText('admin');
  });

  test('Marco (manager) lands on his team', async ({ page }) => {
    await loginAs(page, 'Marco Manager');
    await expect(page.getByRole('heading', { name: /My team/ })).toBeVisible();
    await expect(page.locator('aside')).toContainText('Marco Manager');
    await expect(page.locator('aside')).toContainText('manager');
  });

  test('Ana (employee) lands on My Learning', async ({ page }) => {
    await loginAs(page, 'Ana Quintero');
    await expect(page.getByRole('heading', { name: 'Learning hub' })).toBeVisible();
    await expect(page.locator('aside')).toContainText('Ana Quintero');
    await expect(page.locator('aside')).toContainText('employee');
  });
});
