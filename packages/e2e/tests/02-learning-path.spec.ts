import { expect, test } from '@playwright/test';
import { loginAs } from '../pages/auth';
import { CatalogPage, CoursePage, MyLearningPage } from '../pages/employee';

/** Journey 2 — enroll in a path, complete a course lesson by lesson, see it in History. */
test('Ben enrolls in the QA path and completes Agile Basics', async ({ page }) => {
  await loginAs(page, 'Ben Dervis');
  const catalog = new CatalogPage(page);
  const course = new CoursePage(page);
  const myLearning = new MyLearningPage(page);

  await catalog.goto();
  await catalog.enroll('QA Junior → Mid Path');
  await catalog.enroll('Agile Basics');

  await catalog.openCourse('Agile Basics');
  await course.completeAllLessons();
  await course.expectCompleted();

  await myLearning.goto('history');
  await expect(myLearning.item('Agile Basics').first()).toBeVisible();

  await myLearning.goto('todo');
  await expect(myLearning.item('QA Junior → Mid Path').first()).toBeVisible();
});
