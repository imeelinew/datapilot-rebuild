import { z } from 'zod'
import type { AppConfig } from './config.js'
import type { Database } from './db.js'
import { AppError } from './errors.js'

type HistoryMessage = {
  role: 'user' | 'assistant'
  content: string
}

type CitySnapshot = {
  name: string
  province: string
  population: number
  congestion_index: string
  aqi: string
  pm25: string
  temperature: string
  avg_speed: string
}

async function loadSnapshot(db: Database): Promise<CitySnapshot[]> {
  const result = await db.query<CitySnapshot>(
    `SELECT name, province, population, congestion_index, aqi, pm25,
            temperature, avg_speed
     FROM cities ORDER BY population DESC`,
  )
  return result.rows
}

function deterministicAnswer(cities: CitySnapshot[], question: string): string {
  if (cities.length === 0) {
    return '当前没有可分析的城市数据。请先执行数据库 seed。'
  }
  const city = cities.find((item) => question.includes(item.name))
  const source = '确定性数据分析降级（未配置 AI 提供商，数据来自 PostgreSQL cities 表）'
  if (city) {
    return `${source}。${city.name}（${city.province}）人口约 ${city.population.toLocaleString('zh-CN')}，拥堵指数 ${city.congestion_index}，AQI ${city.aqi}，PM2.5 ${city.pm25}，均速 ${city.avg_speed} km/h。建议结合事件表和分区环境数据继续判断原因。`
  }
  const highestAqi = [...cities].sort((a, b) => Number(b.aqi) - Number(a.aqi))[0]!
  const highestCongestion = [...cities].sort(
    (a, b) => Number(b.congestion_index) - Number(a.congestion_index),
  )[0]!
  return `${source}。当前共有 ${cities.length} 个城市样本；AQI 最高的是 ${highestAqi.name}（${highestAqi.aqi}），拥堵指数最高的是 ${highestCongestion.name}（${highestCongestion.congestion_index}）。简报仅基于当前数据库快照，未补造外部事实。`
}

const providerResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string() }),
  })).min(1),
})

async function providerAnswer(
  config: AppConfig,
  cities: CitySnapshot[],
  history: HistoryMessage[],
  question: string,
): Promise<string> {
  const url = new URL(`${config.aiBaseUrl}/chat/completions`)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new AppError(500, 'AI_BASE_URL 配置不合法')
  }

  const snapshot = cities.map((city) => ({
    name: city.name,
    province: city.province,
    population: city.population,
    congestionIndex: Number(city.congestion_index),
    aqi: Number(city.aqi),
    pm25: Number(city.pm25),
    temperature: Number(city.temperature),
    avgSpeed: Number(city.avg_speed),
  }))
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.aiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.aiModel,
        stream: false,
        temperature: 0.2,
        max_tokens: config.aiMaxOutputTokens,
        messages: [
          {
            role: 'system',
            content:
              '你是城市运营数据分析助手。只根据给定城市快照回答；不得编造外部事实。' +
              `城市快照：${JSON.stringify(snapshot)}`,
          },
          ...history.slice(-20),
          { role: 'user', content: question },
        ],
      }),
      signal: AbortSignal.timeout(config.aiTimeoutMs),
    })
  } catch {
    throw new AppError(502, 'AI 提供商连接失败')
  }
  if (!response.ok) throw new AppError(502, `AI 提供商返回 ${response.status}`)

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new AppError(502, 'AI 提供商响应格式不合法')
  }
  const parsed = providerResponseSchema.safeParse(payload)
  const content = parsed.success ? parsed.data.choices[0]?.message.content.trim() : ''
  if (!content) throw new AppError(502, 'AI 提供商未返回有效内容')
  if (content.length > config.aiMaxOutputChars) {
    throw new AppError(502, 'AI 提供商输出超过长度限制')
  }
  return content
}

export async function generateAnswer(
  db: Database,
  config: AppConfig,
  history: HistoryMessage[],
  question: string,
): Promise<{ content: string; type: 'text' | 'fallback'; source: string }> {
  const cities = await loadSnapshot(db)
  if (!config.aiApiKey) {
    return {
      content: deterministicAnswer(cities, question),
      type: 'fallback',
      source: 'deterministic-fallback',
    }
  }
  return {
    content: await providerAnswer(config, cities, history, question),
    type: 'text',
    source: 'provider',
  }
}
