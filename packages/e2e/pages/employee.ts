import { Locator, Page, expect } from '@playwright/test';

export class MyLearningPage {
  constructor(private readonly page: Page) {}

  async goto(tab?: 'todo' | 'active' | 'history' | 'certificates'): Promise<void> {
    await this.page.goto(`/my-learning${tab ? `?tab=${tab}` : ''}`);
  }

  item(title: string): Locator {
    return this.page.locator('li', { hasText: title });
  }
}

export class CatalogPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/catalog');
  }

  row(title: string): Locator {
    return this.page.locator('li', { hasText: title });
  }

  async enroll(title: string): Promise<void> {
    await this.row(title).getByRole('button', { name: 'Enroll' }).click();
    await expect(this.row(title).getByText('Enrolled ✓')).toBeVisible();
  }

  async openCourse(title: string): Promise<void> {
    await this.row(title).getByRole('link', { name: title }).click();
    await this.page.waitForURL('**/courses/**');
  }
}

export class CoursePage {
  constructor(private readonly page: Page) {}

  async completeAllLessons(): Promise<void> {
    const buttons = this.page.getByRole('button', { name: 'Mark complete' });
    let remaining = await buttons.count();
    while (remaining > 0) {
      await buttons.first().click();
      await expect(buttons).toHaveCount(remaining - 1);
      remaining -= 1;
    }
  }

  async expectCompleted(): Promise<void> {
    await expect(this.page.getByText('100%')).toBeVisible();
    await expect(this.page.getByText('completed', { exact: true })).toBeVisible();
  }
}

export class AssessmentsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/assessments');
  }

  async take(title: string): Promise<void> {
    await this.page.locator('li', { hasText: title }).getByRole('link', { name: 'Take' }).click();
    await this.page.waitForURL('**/assessments/**');
  }

  /** At least one attempt row for the assessment carries the given status. */
  async expectAttempt(title: string, status: string): Promise<void> {
    await expect(
      this.page.locator('tr', { hasText: title }).filter({ hasText: status }).first(),
    ).toBeVisible();
  }
}

export class TakeAssessmentPage {
  constructor(private readonly page: Page) {}

  async checkOption(optionText: string): Promise<void> {
    await this.page.getByRole('checkbox', { name: optionText }).check();
  }

  async fillPractical(text: string): Promise<void> {
    await this.page.getByPlaceholder(/Describe your work/).fill(text);
  }

  async submit(): Promise<void> {
    await this.page.getByRole('button', { name: 'Submit attempt' }).click();
    await this.page.waitForURL('**/assessments?submitted=1');
  }
}

export class EvidencePage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/evidence');
  }

  private get submitCard(): Locator {
    return this.page.locator('section', { hasText: 'Submit new evidence' });
  }

  async submit(description: string): Promise<void> {
    await this.submitCard.locator('input[type="file"]').setInputFiles({
      name: 'evidence.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 e2e evidence payload'),
    });
    await this.submitCard.locator('textarea[name="description"]').fill(description);
    await this.submitCard.getByRole('button', { name: 'Submit for review' }).click();
    await this.expectItem(description, 'submitted');
  }

  item(description: string, status: string): Locator {
    return this.page.locator('li', { hasText: description }).filter({ hasText: status });
  }

  async expectItem(description: string, status: string): Promise<void> {
    await expect(this.item(description, status).first()).toBeVisible();
  }

  async resubmit(description: string): Promise<void> {
    const rejected = this.item(description, 'rejected').first();
    await rejected.getByText('Resubmit with fixes').click();
    await rejected.locator('input[type="file"]').setInputFiles({
      name: 'evidence-v2.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 e2e evidence payload v2'),
    });
    await rejected.getByRole('button', { name: 'Resubmit' }).click();
    await this.expectItem(description, 'submitted');
  }
}

export class NotificationsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/notifications');
  }

  get markReadButtons(): Locator {
    return this.page.getByRole('button', { name: 'Mark read' });
  }
}

export class AchievementsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/achievements');
  }

  leaderboardRow(name: string): Locator {
    return this.page.locator('tr', { hasText: name });
  }
}
