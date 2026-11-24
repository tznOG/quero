import { test, expect } from '@playwright/test';

test('temas, persistência e preferência do sistema', async ({ page }) => {
  await page.goto('/');
  const picker = page.getByLabel('Tema do site');
  for (const theme of ['light', 'dark', 'rose', 'ocean', 'lavender', 'midnight']) {
    await picker.selectOption(theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(picker).toBeVisible();
    const colors = await page.evaluate(() => ({
      paper: getComputedStyle(document.documentElement).getPropertyValue('--paper').trim(),
      ink: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(),
    }));
    expect(colors.paper).not.toBe(colors.ink);
  }
  await page.reload();
  await expect(picker).toHaveValue('midnight');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'midnight');
  await picker.selectOption('system');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
