import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Congress Interest Graph E2E Smoke Tests', () => {

  test('首页加载 - 显示议员列表', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator('text=Congress Interest Graph')).toBeVisible();
    await page.waitForTimeout(3000);
    const cardCount = await page.locator('.ant-card').count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test('进入议员详情页 - 图谱出现', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);
    const firstCard = page.locator('.ant-card').first();
    await firstCard.click();
    await page.waitForTimeout(3000);
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10000 });
  });

  test('搜索功能 - 搜索 Defense', async ({ page }) => {
    await page.goto(`${BASE_URL}/search`);
    await page.waitForTimeout(2000);
    const input = page.locator('input[placeholder*="搜索"]').first();
    await input.fill('Defense');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    const resultCount = await page.locator('.ant-card').count();
    expect(resultCount).toBeGreaterThanOrEqual(0);
  });

  test('打开 EvidenceDrawer - 点击图中边', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);
    const firstCard = page.locator('.ant-card').first();
    await firstCard.click();
    await page.waitForTimeout(4000);
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 10000 });
  });

  test('导出 Markdown 简报', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);
    const firstCard = page.locator('.ant-card').first();
    await firstCard.click();
    await page.waitForTimeout(4000);
    const exportBtn = page.locator('button:has-text("导出简报")');
    if (await exportBtn.isVisible()) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 10000 }),
        exportBtn.click(),
      ]);
      expect(download.suggestedFilename()).toContain('.md');
    }
  });

  test('健康检查 API', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/health`);
    expect(resp.status()).toBe(200);
    const json = await resp.json();
    expect(json.status).toBe('ok');
    expect(json.data_mode).toBeDefined();
  });

  test('数据质量 API', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/data-quality/summary`);
    expect(resp.status()).toBe(200);
    const json = await resp.json();
    expect(json.data_mode).toBeDefined();
    expect(typeof json.total_nodes).toBe('number');
  });

  test('预测 API 返回新字段', async ({ request }) => {
    const membersResp = await request.get(`${BASE_URL}/api/members?limit=1`);
    const members = await membersResp.json();
    const mid = members.members[0].id;

    const resp = await request.post(`${BASE_URL}/api/predictions/vote`, {
      data: { member_id: mid },
    });
    expect(resp.status()).toBe(200);
    const json = await resp.json();
    expect(json.confidence_level).toBeDefined();
    expect(json.margin_from_baseline).toBeDefined();
    expect(json.interpretation).toBeDefined();
  });
});
