import { expect, test } from '@playwright/test';
import { loginAs } from '../pages/auth';
import { TeamReadinessPage } from '../pages/manager';

/** Journey 5 — the seeded 82% scenario (master plan §7.7), employee and manager views. */
test.describe('readiness gap', () => {
  test('Ana sees 82% with the three named gaps', async ({ page }) => {
    await loginAs(page, 'Ana Quintero');
    await page.goto('/career');

    await expect(page.getByText('82%').first()).toBeVisible();
    const outstanding = page.locator('section', { hasText: 'Outstanding' });
    await expect(outstanding.getByText('Automation Fundamentals')).toBeVisible();
    await expect(outstanding.getByText('Assessment A')).toBeVisible();
    await expect(outstanding.getByText('Certification B')).toBeVisible();
    const satisfied = page.locator('section', { hasText: 'Satisfied' });
    await expect(satisfied.getByText('Testing Fundamentals')).toBeVisible();
    await expect(satisfied.getByText('Project Evidence')).toBeVisible();
  });

  test('Marco sees Ana at 82% in team readiness and opens her gap report', async ({ page }) => {
    await loginAs(page, 'Marco Manager');
    const readiness = new TeamReadinessPage(page);

    await readiness.goto();
    await expect(readiness.row('Ana Quintero').getByText('82%')).toBeVisible();

    await readiness.openGapReport('Ana Quintero');
    await expect(page.getByRole('heading', { name: 'Ana Quintero' })).toBeVisible();
    await expect(page.getByText('Automation Fundamentals')).toBeVisible();
  });
});
