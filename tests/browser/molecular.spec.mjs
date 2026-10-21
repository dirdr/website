import { test, expect } from '@playwright/test';

test('all seven embedded molecules load upstream Wasm and respond to input', async ({
  page,
}) => {
  const errors = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/projects/molecular-visualization/');
  const embeds = page.locator('web-demo');
  await expect(embeds).toHaveCount(7);
  for (let index = 0; index < 7; index++) {
    const embed = embeds.nth(index);
    await embed.scrollIntoViewIfNeeded();
    const frame = embed.frameLocator('iframe');
    await expect(frame.locator('#molecule-status')).toBeHidden();
    const canvas = frame.locator('canvas');
    const before = await canvas.screenshot();
    await canvas.press('ArrowRight');
    await expect
      .poll(async () => Buffer.compare(before, await canvas.screenshot()))
      .not.toBe(0);
    const rotated = await canvas.screenshot();
    await canvas.press('+');
    await expect
      .poll(async () => Buffer.compare(rotated, await canvas.screenshot()))
      .not.toBe(0);
    await expect(frame.locator('#molecule-status')).toBeHidden();
  }
  expect(
    requests.some((url) => url.endsWith('/molecular_visualization_bg.wasm')),
  ).toBe(true);
  expect(
    requests.some((url) => /github\.com|githubusercontent\.com/.test(url)),
  ).toBe(false);
  expect(errors).toEqual([]);
});

test('reports missing molecule files', async ({ page }) => {
  await page.goto('/demos/molecular-visualization/?molecule=/missing.pdb');
  await expect(page.locator('#molecule-status')).toContainText(
    'Could not load this molecule',
  );
});

test('mobile molecule canvas fits the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects/molecular-visualization/');
  const embed = page.locator('web-demo').first();
  await embed.scrollIntoViewIfNeeded();
  const frame = embed.frameLocator('iframe');
  await expect(frame.locator('#molecule-status')).toBeHidden();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: test.info().outputPath('molecular-mobile.png'),
  });
});
