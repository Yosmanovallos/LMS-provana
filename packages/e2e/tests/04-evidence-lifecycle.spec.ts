import { test } from '@playwright/test';
import { loginAs } from '../pages/auth';
import { EvidencePage } from '../pages/employee';
import { ReviewEvidencePage } from '../pages/manager';

const DESCRIPTION = 'Billing reconciliation runbook (e2e journey 4)';

/** Journey 4 — submit → reject → resubmit → approve, full state machine through the UI. */
test('evidence runs the full review lifecycle', async ({ page }) => {
  const evidence = new EvidencePage(page);
  const queue = new ReviewEvidencePage(page);

  // Ben submits
  await loginAs(page, 'Ben Dervis');
  await evidence.goto();
  await evidence.submit(DESCRIPTION);

  // Marco rejects with feedback
  await loginAs(page, 'Marco Manager');
  await queue.goto();
  await queue.startReview(DESCRIPTION);
  await queue.reject(DESCRIPTION, 'Please attach the test results');

  // Ben sees the rejection + feedback and resubmits
  await loginAs(page, 'Ben Dervis');
  await evidence.goto();
  await evidence.expectItem(DESCRIPTION, 'rejected');
  await evidence.expectItem(DESCRIPTION, 'Please attach the test results');
  await evidence.resubmit(DESCRIPTION);

  // Marco approves the resubmission
  await loginAs(page, 'Marco Manager');
  await queue.goto();
  await queue.startReview(DESCRIPTION);
  await queue.approve(DESCRIPTION, 'Thorough now, thanks');

  // Ben sees the approval
  await loginAs(page, 'Ben Dervis');
  await evidence.goto();
  await evidence.expectItem(DESCRIPTION, 'approved');
});
