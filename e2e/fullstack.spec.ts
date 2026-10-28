import { test, expect, type Page } from '@playwright/test'

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('用户名', { exact: true }).fill('admin')
  await page.getByLabel('密码', { exact: true }).fill(process.env.SEED_ADMIN_PASSWORD || 'LocalDemo-Admin-2026')
  const image = page.getByRole('img', { name: '验证码', exact: true })
  await expect(image).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/)
  const source = await image.getAttribute('src')
  const svg = Buffer.from(source!.split(',')[1], 'base64').toString('utf8')
  const code = svg.match(/<text[^>]*>([^<]+)<\/text>/)?.[1]
  expect(code).toBeTruthy()
  await page.getByPlaceholder('验证码', { exact: true }).fill(code!)
  const response = page.waitForResponse((r) => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST')
  await page.getByRole('button', { name: /登\s*录/, exact: true }).click()
  const result = await (await response).json()
  expect(result.code).toBe(200)
  await expect(page).toHaveURL(/\/dashboard$/)
  return result.data.token as string
}

async function select(page: Page, label: string, option: string) {
  const field = page.getByLabel(label, { exact: true })
  await field.click()
  await field.fill(option)
  await expect(page.locator('.ant-select-dropdown:visible').getByText(option, { exact: false }).last()).toBeVisible()
  await field.press('Enter')
}

test('login → create chart from stored city data → persist → transactionally clone dashboard', async ({ page, request }) => {
  const token = await login(page)
  const headers = { Authorization: `Bearer ${token}` }
  const title = `验收仪表盘-${Date.now()}`
  const chartTitle = `${title}-人口`
  let dashboardId: number | undefined
  let cloneId: number | undefined
  try {
    await page.goto('/data/dashboards')
    await page.getByRole('button', { name: /新建仪表盘/ }).click()
    await page.getByLabel('标题', { exact: true }).fill(title)
    const created = page.waitForResponse((r) => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST')
    await page.getByRole('button', { name: /创\s*建/, exact: true }).click()
    const createdResult = await (await created).json()
    expect(createdResult.code).toBe(200)
    dashboardId = createdResult.data.id
    await expect(page.getByText(title, { exact: true })).toBeVisible()

    await page.goto(`/data/charts/new?dashboardId=${dashboardId}`)
    await select(page, '数据源', '城市运行种子数据')
    await page.getByRole('button', { name: /下一步/ }).click()
    await select(page, '数据表', 'cities')
    await select(page, 'X 轴字段', 'name')
    await select(page, 'Y 轴字段', 'population')
    await page.getByLabel('图表名称', { exact: true }).fill(chartTitle)
    await page.getByRole('button', { name: /下一步/ }).click()
    await expect(page.getByText(/查询到 [1-9]\d* 行数据/)).toBeVisible()
    const chartSaved = page.waitForResponse((r) => r.url().endsWith('/api/charts') && r.request().method() === 'POST')
    await page.getByRole('button', { name: /保存到仪表盘/ }).click()
    expect((await (await chartSaved).json()).code).toBe(200)
    await page.goto(`/data/dashboards/${dashboardId}`)
    await expect(page.getByText(chartTitle, { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText(chartTitle, { exact: true })).toBeVisible()

    await page.goto('/data/dashboards')
    const card = page.locator('.ant-card').filter({ has: page.getByText(title, { exact: true }) })
    const cloned = page.waitForResponse((r) => r.url().endsWith(`/api/dashboards/${dashboardId}/clone`))
    await card.getByRole('button', { name: /复\s*制/ }).click()
    const clone = await (await cloned).json()
    expect(clone.code).toBe(200)
    cloneId = clone.data.id
    const detail = await (await request.get(`/api/dashboards/${cloneId}`, { headers })).json()
    expect(detail.data.charts).toHaveLength(1)
    expect(detail.data.charts[0].title).toBe(chartTitle)
    await page.screenshot({ path: 'test-results/dashboard-acceptance.png', fullPage: true })
  } finally {
    if (cloneId) await request.delete(`/api/dashboards/${cloneId}`, { headers })
    if (dashboardId) await request.delete(`/api/dashboards/${dashboardId}`, { headers })
  }
})

test('AI data-analysis fallback persists a complete conversation round', async ({ page, request }) => {
  const token = await login(page)
  let id: number | undefined
  try {
    await page.goto('/ai')
    await page.getByPlaceholder('请输入问题，Command/Ctrl + Enter 发送').fill('分析当前城市人口与空气质量')
    const created = page.waitForResponse((r) => r.url().endsWith('/api/ai/conversations') && r.request().method() === 'POST')
    await page.getByRole('button', { name: /发\s*送/, exact: true }).click()
    id = (await (await created).json()).data.id
    await expect(page.locator('.ai-message-assistant')).toContainText(/降级|本地|数据分析|未配置/)
    await expect(page.getByRole('button', { name: /发\s*送/, exact: true })).not.toHaveClass(/loading/)
    await expect.poll(async () => {
      const res = await request.get(`/api/ai/conversations/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      const result = await res.json()
      return result.data.messages.length
    }).toBe(2)
    await page.reload()
    await page.locator('.ai-sidebar .ant-list-item').filter({ hasText: '分析当前城市人口与空气质量' }).click()
    await expect(page.locator('.ai-message-assistant')).toContainText(/降级|本地|数据分析|未配置/)
  } finally {
    if (id) await request.delete(`/api/ai/conversations/${id}`, { headers: { Authorization: `Bearer ${token}` } })
  }
})
