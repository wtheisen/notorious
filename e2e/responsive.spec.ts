import { test, expect } from '@playwright/test';

test('landing page screenshot', async ({ page }) => {
  await page.goto('/');
  // Wait for CSS animations to settle (start-btn fades in at 1.2s)
  await page.waitForTimeout(2000);
  await expect(page).toHaveScreenshot('landing.png');
});

test('game board screenshot', async ({ page }, testInfo) => {
  await page.goto('/');
  // Wait for start button fade-in animation (1.2s delay + 0.6s duration)
  await page.waitForTimeout(2000);

  // Click "Set Sail" to start game
  await page.click('.start-btn');

  // Wait for the board to load — boardgame.io setup + AI turns can take a while
  await page.waitForSelector('.phase-indicator', { timeout: 30000 });

  // Wait for Three.js to render
  await page.waitForTimeout(2000);

  await expect(page).toHaveScreenshot('game-board.png');

  const projectName = testInfo.project.name;
  if (projectName === 'phone' || projectName === 'tablet') {
    await expect(page.locator('[data-testid="mobile-player-drawer"]')).toBeVisible();
  } else {
    await expect(page.locator('[data-testid="desktop-player-panels"]')).toBeVisible();
  }
});
