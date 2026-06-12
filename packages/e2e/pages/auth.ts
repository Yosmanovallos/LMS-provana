import { Page } from '@playwright/test';

export type PersonaName = 'Alex Admin' | 'Marco Manager' | 'Ana Quintero' | 'Ben Dervis';

/** Selects a seeded persona through the real /personas UI (ADR-008 dev auth). */
export async function loginAs(page: Page, name: PersonaName): Promise<void> {
  await page.goto('/personas');
  await page.getByRole('button', { name }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/personas'));
}
