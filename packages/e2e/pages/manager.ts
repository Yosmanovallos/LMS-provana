import { Locator, Page, expect } from '@playwright/test';

export class ReviewEvidencePage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/review/evidence');
  }

  card(description: string): Locator {
    return this.page.locator('section', { hasText: description });
  }

  async startReview(description: string): Promise<void> {
    await this.card(description).getByRole('button', { name: 'Start review' }).click();
    await expect(this.card(description).getByRole('button', { name: 'Approve' })).toBeVisible();
  }

  async approve(description: string, note: string): Promise<void> {
    const card = this.card(description);
    await card.getByPlaceholder('Approval note (optional)').fill(note);
    await card.getByRole('button', { name: 'Approve' }).click();
    await expect(this.card(description)).toHaveCount(0); // decided items leave the queue
  }

  async reject(description: string, feedback: string): Promise<void> {
    const card = this.card(description);
    await card.getByPlaceholder('Rejection feedback (required)').fill(feedback);
    await card.getByRole('button', { name: 'Reject' }).click();
    await expect(this.card(description)).toHaveCount(0);
  }
}

export class ReviewAssessmentsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/review/assessments');
  }

  card(text: string): Locator {
    return this.page.locator('section', { hasText: text });
  }

  async scoreAndFinalize(cardText: string, points: number, feedback: string): Promise<void> {
    const card = this.card(cardText);
    await card.locator('input[type="number"]').fill(String(points));
    await card.getByPlaceholder(/Feedback/).fill(feedback);
    await card.getByRole('button', { name: 'Finalize review' }).click();
    await expect(this.card(cardText)).toHaveCount(0); // finalized attempts leave the queue
  }
}

export class TeamReadinessPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/readiness');
  }

  row(name: string): Locator {
    return this.page.locator('tr', { hasText: name });
  }

  async openGapReport(name: string): Promise<void> {
    await this.row(name).getByRole('link', { name: 'Gap report' }).click();
    await this.page.waitForURL('**/readiness/**');
  }
}
