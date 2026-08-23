import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Row,
  Segmented,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { load as loadAMap } from '@amap/amap-jsapi-loader'

import dashboardService from '@/api/dashboard'
import type { City, EnvironmentItem } from '@/types/dashboard'

type MapMode = '城市' | '环境'

type MapOverlay = {
  on: (event: string, handler: () => void) => void
}

type MapInstance = {
  add: (overlays: MapOverlay[]) => void
  clearMap: () => void
  destroy: () => void
  setFitView: (overlays?: MapOverlay[]) => void
}

type InfoWindowInstance = {
  open: (map: MapInstance, position: [number, number]) => void
}

type AMapApi = {
  Map: new (
    element: HTMLDivElement,
    options: Record<string, unknown>,
  ) => MapInstance
  Marker: new (options: Record<string, unknown>) => MapOverlay
  Circle: new (options: Record<string, unknown>) => MapOverlay
  InfoWindow: new (
    options: Record<string, unknown>,
  ) => InfoWindowInstance
}

const aqiLevels = [
  { max: 50, label: '优', color: '#52c41a' },
  { max: 100, label: '良', color: '#a0d911' },
  { max: 150, label: '轻度污染', color: '#faad14' },
  { max: 200, label: '中度污染', color: '#fa8c16' },
  { max: 300, label: '重度污染', color: '#f5222d' },
  { max: Number.POSITIVE_INFINITY, label: '严重污染', color: '#722ed1' },
]

function getAqiLevel(aqi: number) {
  return aqiLevels.find((item) => aqi <= item.max) || aqiLevels[0]
}

function toNumber(value: number | string | null | undefined) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function getGdpDisplay(value: number | string | null | undefined) {
  const number = toNumber(value)

  if (number >= 10000) {
    return {
      value: number / 10000,
      suffix: '万亿元',
      precision: 2,
    }
  }

  return {
    value: number,
    suffix: '亿元',
    precision: Number.isInteger(number) ? 0 : 1,
  }
}

function formatGdp(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '-'
  const display = getGdpDisplay(value)
  return `${display.value.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: display.precision,
  })} ${display.suffix}`
}

function MapView() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapInstance | null>(null)
  const amapRef = useRef<AMapApi | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mode, setMode] = useState<MapMode>('城市')
  const [cities, setCities] = useState<City[]>([])
  const [environmentMap, setEnvironmentMap] = useState<
    Record<number, EnvironmentItem | undefined>
  >({})
  const [selectedCity, setSelectedCity] = useState<City>()
  const [loading, setLoading] = useState(false)
  const [mapError, setMapError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const cityResult = await dashboardService.getCities()
      const cityList = cityResult.data.slice(0, 20)
      setCities(cityList)

      const environmentResults = await Promise.allSettled(
        cityList.map((city) =>
          dashboardService.getCityEnvironment(city.id),
        ),
      )
      const nextMap: Record<number, EnvironmentItem | undefined> = {}
      environmentResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          nextMap[cityList[index].id] = result.value.data[0]
        }
      })
      setEnvironmentMap(nextMap)
    } catch (error) {
      console.error(error)
      message.error('地图数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const key = import.meta.env.VITE_AMAP_KEY?.trim()
    const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE?.trim()

    if (!key || !securityCode) {
      setMapError(
        '未读到高德配置。请把 Key 写在项目根目录的 .env（不是 .env.example），然后重启 npm run dev',
      )
      return
    }

    window._AMapSecurityConfig = { securityJsCode: securityCode }

    let cancelled = false
    let map: MapInstance | null = null

    loadAMap({ key, version: '2.0' })
      .then((AMap) => {
        if (cancelled || !mapContainerRef.current) return
        const api = AMap as unknown as AMapApi
        amapRef.current = api
        map = new api.Map(mapContainerRef.current, {
          zoom: 5,
          center: [104.195397, 35.86166],
          viewMode: '2D',
        })
        mapRef.current = map
        setMapReady(true)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error(error)
        const detail =
          typeof error === 'string'
            ? error
            : error instanceof Error
              ? error.message
              : ''
        setMapError(
          detail
            ? `高德地图加载失败：${detail}`
            : '高德地图加载失败，请确认 Key 类型为 Web端(JS API)，安全密钥匹配，且 localhost 已加入域名白名单',
        )
      })

    return () => {
      cancelled = true
      setMapReady(false)
      map?.destroy()
      mapRef.current = null
      amapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const AMap = amapRef.current
    if (!mapReady || !map || !AMap || cities.length === 0) return

    map.clearMap()
    const overlays: MapOverlay[] = []

    cities.forEach((city) => {
      const environment = environmentMap[city.id]
      const position: [number, number] = [city.lng, city.lat]

      if (mode === '城市') {
        const marker = new AMap.Marker({
          position,
          title: city.name,
          content: `<div class="city-marker">${city.name}</div>`,
        })
        marker.on('click', () => {
          setSelectedCity(city)
          const infoWindow = new AMap.InfoWindow({
            content: `<div class="map-info"><strong>${city.name}</strong><br/>人口：${city.population.toLocaleString('zh-CN')} 万人<br/>GDP：${formatGdp(city.gdp)}</div>`,
            offset: [0, -16],
          })
          infoWindow.open(map, position)
        })
        overlays.push(marker)
      } else if (environment) {
        const level = getAqiLevel(environment.aqi)
        const circle = new AMap.Circle({
          center: position,
          radius: 50000,
          fillColor: level.color,
          fillOpacity: 0.42,
          strokeColor: level.color,
          strokeWeight: 2,
        })
        circle.on('click', () => {
          setSelectedCity(city)
          const infoWindow = new AMap.InfoWindow({
            content: `<div class="map-info"><strong>${city.name} · ${level.label}</strong><br/>AQI：${environment.aqi}<br/>PM2.5：${environment.pm25}<br/>${environment.weather} / ${environment.temperature}℃</div>`,
          })
          infoWindow.open(map, position)
        })
        overlays.push(circle)
      }
    })

    map.add(overlays)
    map.setFitView(overlays)

    return () => map.clearMap()
  }, [cities, environmentMap, mapReady, mode])

  const environmentList = useMemo(
    () => Object.values(environmentMap).filter(
      (item): item is EnvironmentItem => Boolean(item),
    ),
    [environmentMap],
  )

  const stats = useMemo(() => {
    const environmentCount = environmentList.length || 1
    const totalGdp = cities.reduce(
      (sum, item) => sum + toNumber(item.gdp),
      0,
    )
    const gdpDisplay = getGdpDisplay(totalGdp)

    return [
      { title: '覆盖城市', value: cities.length, suffix: '座' },
      {
        title: '总人口',
        value: cities.reduce((sum, item) => sum + item.population, 0),
        suffix: '万人',
      },
      {
        title: 'GDP',
        value: gdpDisplay.value,
        suffix: gdpDisplay.suffix,
        precision: gdpDisplay.precision,
      },
      {
        title: '平均 AQI',
        value:
          environmentList.reduce((sum, item) => sum + item.aqi, 0) /
          environmentCount,
        suffix: '',
      },
      {
        title: '平均 PM2.5',
        value:
          environmentList.reduce((sum, item) => sum + item.pm25, 0) /
          environmentCount,
        suffix: '',
      },
    ]
  }, [cities, environmentList])

  const selectedEnvironment = selectedCity
    ? environmentMap[selectedCity.id]
    : undefined

  return (
    <Spin spinning={loading}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div className="page-header">
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              地图可视化
            </Typography.Title>
            <Typography.Text type="secondary">
              城市基础信息与实时环境监测
            </Typography.Text>
          </div>
          <Space>
            <Segmented
              value={mode}
              options={['城市', '环境']}
              onChange={(value) => setMode(value as MapMode)}
            />
            <Button
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={() => void loadData()}
            >
              刷新
            </Button>
          </Space>
        </div>

        <Row gutter={[12, 12]}>
          {stats.map((item) => (
            <Col flex="1 1 180px" key={item.title}>
              <Card size="small">
                <Statistic
                  title={item.title}
                  value={item.value}
                  precision={item.precision ?? (Number.isInteger(item.value) ? 0 : 1)}
                  suffix={item.suffix}
                />
              </Card>
            </Col>
          ))}
        </Row>

        {mapError && <Alert showIcon type="warning" message={mapError} />}

        {mode === '环境' && (
          <Space wrap>
            {aqiLevels.slice(0, -1).map((item) => (
              <Tag color={item.color} key={item.label}>
                {item.label}
              </Tag>
            ))}
          </Space>
        )}

        <Row gutter={16}>
          <Col span={selectedCity ? 18 : 24}>
            <Card title={mode === '城市' ? '城市分布' : '空气质量分布'}>
              <div
                ref={mapContainerRef}
                className="amap-view"
                style={{ width: '100%', height: 520, borderRadius: 8 }}
              />
            </Card>
          </Col>
          {selectedCity && (
            <Col span={6}>
              <Card
                title={selectedCity.name}
                extra={
                  selectedEnvironment ? (
                    <Tag color={getAqiLevel(selectedEnvironment.aqi).color}>
                      {getAqiLevel(selectedEnvironment.aqi).label}
                    </Tag>
                  ) : null
                }
              >
                <Descriptions
                  column={1}
                  size="small"
                  items={[
                    { key: 'province', label: '省份', children: selectedCity.province },
                    { key: 'population', label: '人口', children: `${selectedCity.population} 万人` },
                    { key: 'gdp', label: 'GDP', children: formatGdp(selectedCity.gdp) },
                    { key: 'weather', label: '天气', children: selectedEnvironment?.weather || '-' },
                    { key: 'aqi', label: 'AQI', children: selectedEnvironment?.aqi ?? '-' },
                    { key: 'pm25', label: 'PM2.5', children: selectedEnvironment?.pm25 ?? '-' },
                  ]}
                />
              </Card>
            </Col>
          )}
        </Row>
      </Space>
    </Spin>
  )
}

export default MapView
