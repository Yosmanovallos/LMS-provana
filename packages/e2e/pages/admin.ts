import { Locator, Page, expect } from '@playwright/test';

export interface RoleLevel {
  role: string;
  level: string;
}

export class AdminRequirementSetsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/admin/requirement-sets');
  }

  setCard(transition: string): Locator {
    return this.page.locator('section', { hasText: transition });
  }

  async createDraft(from: RoleLevel, to: RoleLevel, requirementsJson: string): Promise<void> {
    const form = this.page.locator('section', { hasText: 'New requirement set' });
    await form.locator('select[name="fromRole"]').selectOption(from.role);
    await form.locator('select[name="fromLevel"]').selectOption(from.level);
    await form.locator('select[name="toRole"]').selectOption(to.role);
    await form.locator('select[name="toLevel"]').selectOption(to.level);
    await form.locator('textarea[name="requirements"]').fill(requirementsJson);
    await form.getByRole('button', { name: 'Create draft' }).click();
  }

  async activate(transition: string): Promise<void> {
    const card = this.setCard(transition);
    await card.getByRole('button', { name: 'Activate' }).click();
    await expect(card.getByText('active', { exact: true })).toBeVisible();
  }
}

export class AdminGamificationPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/admin/gamification');
  }

  async materializeLeaderboards(): Promise<void> {
    await this.page.getByRole('button', { name: 'Materialize leaderboards now' }).click();
  }
}
