import { test } from '@playwright/test';
import { loginAs } from '../pages/auth';
import { AssessmentsPage, TakeAssessmentPage } from '../pages/employee';
import { ReviewAssessmentsPage } from '../pages/manager';

/** Journey 3 — auto-scored fail, auto-scored pass, and the manual review path. */
test.describe('assessments', () => {
  // fail first: a passed assessment cannot be retaken (domain invariant)
  test('Ben fails the theory assessment with wrong answers', async ({ page }) => {
    await loginAs(page, 'Ben Dervis');
    const list = new AssessmentsPage(page);
    const take = new TakeAssessmentPage(page);

    await list.goto();
    await list.take('QA Theory Assessment');
    await take.checkOption('Pair programming');
    await take.checkOption('New features only');
    await take.submit();
    await list.expectAttempt('QA Theory Assessment', 'failed');
  });

  test('Ben passes the theory assessment on the retake', async ({ page }) => {
    await loginAs(page, 'Ben Dervis');
    const list = new AssessmentsPage(page);
    const take = new TakeAssessmentPage(page);

    await list.goto();
    await list.take('QA Theory Assessment');
    await take.checkOption('Boundary value analysis');
    await take.checkOption('Existing behavior still works');
    await take.submit();
    await list.expectAttempt('QA Theory Assessment', 'passed');
  });

  test('practical attempt goes through Marco\'s review and passes', async ({ page }) => {
    await loginAs(page, 'Ben Dervis');
    const list = new AssessmentsPage(page);
    const take = new TakeAssessmentPage(page);

    await list.goto();
    await list.take('Assessment A (Practical Automation)');
    await take.checkOption('role-based');
    await take.fillPractical('Automated the login flow: github.com/ben/login-e2e');
    await take.submit();
    await list.expectAttempt('Assessment A', 'awaiting-review');

    await loginAs(page, 'Marco Manager');
    const queue = new ReviewAssessmentsPage(page);
    await queue.goto();
    await queue.scoreAndFinalize('Assessment A', 18, 'Great coverage of the happy path');

    await loginAs(page, 'Ben Dervis');
    await list.goto();
    await list.expectAttempt('Assessment A', 'passed');
  });
});
