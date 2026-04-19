import { test, expect } from '@playwright/test';

test('loads application shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'NoteWizard' })).toBeVisible();
});
