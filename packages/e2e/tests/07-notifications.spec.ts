import { expect, test } from '@playwright/test';
import { loginAs } from '../pages/auth';
import { EvidencePage, NotificationsPage } from '../pages/employee';

/** Journey 7 — an event produces an in-app notification; the recipient marks it read. */
test('Marco receives and reads the evidence notification', async ({ page }) => {
  // Ben submits fresh evidence → notification.evidence-submitted → Marco's inbox
  await loginAs(page, 'Ben Dervis');
  const evidence = new EvidencePage(page);
  await evidence.goto();
  await evidence.submit('Notification receipt check (e2e journey 7)');

  await loginAs(page, 'Marco Manager');
  const inbox = new NotificationsPage(page);
  await inbox.goto();

  await expect(page.getByText('Evidence awaiting your review').first()).toBeVisible();
  const unreadBefore = await inbox.markReadButtons.count();
  expect(unreadBefore).toBeGreaterThan(0);

  await inbox.markReadButtons.first().click();
  await expect(inbox.markReadButtons).toHaveCount(unreadBefore - 1);
});
