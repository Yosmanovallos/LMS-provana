import { expect, test } from '@playwright/test';
import { loginAs } from '../pages/auth';
import { AchievementsPage } from '../pages/employee';
import { AdminGamificationPage } from '../pages/admin';

/** Journey 6 — admin materializes leaderboards; an employee sees the ranking. */
test('leaderboard materializes and renders for an employee', async ({ page }) => {
  // Ben earned points in earlier journeys (courses, assessments) — materialize now
  await loginAs(page, 'Alex Admin');
  const gamification = new AdminGamificationPage(page);
  await gamification.goto();
  await gamification.materializeLeaderboards();

  await loginAs(page, 'Ben Dervis');
  const achievements = new AchievementsPage(page);
  await achievements.goto();

  await expect(achievements.leaderboardRow('Ana Quintero').first()).toBeVisible();
  await expect(achievements.leaderboardRow('Ben Dervis (you)').first()).toBeVisible();
  // engagement firewall: points exist, and this page says so explicitly
  await expect(page.getByText('points never affect promotion readiness')).toBeVisible();
});
