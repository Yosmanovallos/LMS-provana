import { expect, test } from '@playwright/test';
import { loginAs } from '../pages/auth';
import { AdminRequirementSetsPage } from '../pages/admin';

const REQUIREMENTS = JSON.stringify([
  { kind: 'certification', certificationName: 'Architecture Cert', label: 'Architecture Cert', weight: 60 },
  { kind: 'tenure', months: 6, label: '6 months at level', weight: 40 },
]);

/** Journey 8 — admin builds a requirement set as versioned data and activates it. */
test('Alex creates and activates a dev mid→senior requirement set', async ({ page }) => {
  await loginAs(page, 'Alex Admin');
  const sets = new AdminRequirementSetsPage(page);

  await sets.goto();
  await sets.createDraft({ role: 'dev', level: 'mid' }, { role: 'dev', level: 'senior' }, REQUIREMENTS);

  const card = sets.setCard('dev/mid → dev/senior');
  await expect(card.getByText('draft', { exact: true })).toBeVisible();
  await expect(card.getByText('Architecture Cert').first()).toBeVisible();
  await expect(card.getByText('total weight 100')).toBeVisible();

  await sets.activate('dev/mid → dev/senior');
});
