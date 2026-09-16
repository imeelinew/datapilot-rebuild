import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  List,
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
import type { City, EnvironmentItem, TrafficHeatmapItem } from '@/types/dashboard'
import { distanceKm } from '@/utils/geo'

type MapMode = '城市' | '环境' | '交通'

type MapOverlay = {
  on: (event: string, handler: () => void) => void
}

type MapInstance = {
  add: (overlays: MapOverlay[]) => void
  remove: (overlays: MapOverlay[]) => void
  clearMap: () => void
  destroy: () => void
  setFitView: (overlays?: MapOverlay[]) => void
  setZoomAndCenter: (zoom: number, center: [number, number]) => void
}

type HeatMapInstance = {
  setDataSet: (dataset: {
    data: Array<{ lng: number; lat: number; count: number }>
    max: number
  }) => void
  setMap: (map: MapInstance | null) => void
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
  HeatMap?: new (map: MapInstance, options: Record<string, unknown>) => HeatMapInstance
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
  const [trafficPoints, setTrafficPoints] = useState<TrafficHeatmapItem[]>([])
  const [trafficError, setTrafficError] = useState('')
  const [selectedTraffic, setSelectedTraffic] = useState<TrafficHeatmapItem>()
  const [selectedCity, setSelectedCity] = useState<City>()
  const [radiusKm, setRadiusKm] = useState(800)
  const [loading, setLoading] = useState(false)
  const [mapError, setMapError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const cityResult = await dashboardService.getCities()
      const cityList = Array.isArray(cityResult.data)
        ? cityResult.data.slice(0, 20)
        : []
      setCities(cityList)

      const [environmentResults, trafficResult] = await Promise.all([
        Promise.allSettled(
          cityList.map((city) => dashboardService.getCityEnvironment(city.id)),
        ),
        dashboardService.getTrafficHeatmap().then(
          (result) => result.data,
          () => null,
        ),
      ])
      const nextMap: Record<number, EnvironmentItem | undefined> = {}
      environmentResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          nextMap[cityList[index].id] = Array.isArray(result.value.data)
            ? result.value.data[0]
            : undefined
        }
      })
      setEnvironmentMap(nextMap)
      if (Array.isArray(trafficResult)) {
        setTrafficPoints(trafficResult)
        setSelectedTraffic(undefined)
        setTrafficError('')
      } else {
        setTrafficError('交通热力数据暂时不可用')
      }
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

    loadAMap({ key, version: '2.0', plugins: ['AMap.HeatMap'] })
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
    if (mode === '交通') return
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

  const rankedTraffic = useMemo(
    () => [...trafficPoints]
      .filter((point) =>
        Number.isFinite(point.lng) &&
        Number.isFinite(point.lat) &&
        Number.isFinite(point.congestionIndex),
      )
      .sort((a, b) => b.congestionIndex - a.congestionIndex),
    [trafficPoints],
  )
  const activeTraffic = selectedTraffic ?? rankedTraffic[0]

  useEffect(() => {
    const map = mapRef.current
    const AMap = amapRef.current
    if (!mapReady || mode !== '交通' || !map || !AMap || rankedTraffic.length === 0) return

    let heatmap: HeatMapInstance | undefined
    const fallbackOverlays: MapOverlay[] = []

    if (AMap.HeatMap) {
      heatmap = new AMap.HeatMap(map, {
        radius: 32,
        opacity: [0, 0.85],
        gradient: {
          0.2: '#52c41a',
          0.5: '#faad14',
          0.8: '#fa8c16',
          1: '#f5222d',
        },
      })
      heatmap.setDataSet({
        data: rankedTraffic.map((point) => ({
          lng: point.lng,
          lat: point.lat,
          count: point.congestionIndex,
        })),
        max: Math.max(10, rankedTraffic[0].congestionIndex),
      })
    } else {
      rankedTraffic.slice(0, 60).forEach((point) => {
        fallbackOverlays.push(new AMap.Circle({
          center: [point.lng, point.lat],
          radius: 1600,
          fillColor: point.congestionIndex >= 8 ? '#f5222d' : '#fa8c16',
          fillOpacity: 0.35,
          strokeOpacity: 0,
        }))
      })
    }

    const markers = rankedTraffic.slice(0, 20).map((point) => {
      const marker = new AMap.Marker({
        position: [point.lng, point.lat],
        title: point.roadName,
        content: '<div class="traffic-hotspot-marker"></div>',
      })
      marker.on('click', () => setSelectedTraffic(point))
      return marker
    })
    map.add([...fallbackOverlays, ...markers])

    return () => {
      heatmap?.setMap(null)
      map.remove([...fallbackOverlays, ...markers])
    }
  }, [mapReady, mode, rankedTraffic])

  useEffect(() => {
    const map = mapRef.current
    if (mapReady && mode === '交通' && map && activeTraffic) {
      map.setZoomAndCenter(11, [activeTraffic.lng, activeTraffic.lat])
    }
  }, [mapReady, mode, activeTraffic])

  useEffect(() => {
    const map = mapRef.current
    const AMap = amapRef.current
    if (!mapReady || !map || !AMap || mode === '交通') return
    if (!selectedCity) {
      if (cities.length > 0) map.setFitView()
      return
    }

    const circle = new AMap.Circle({
      center: [selectedCity.lng, selectedCity.lat],
      radius: radiusKm * 1000,
      fillColor: '#1677ff',
      fillOpacity: 0.08,
      strokeColor: '#1677ff',
      strokeWeight: 2,
      strokeStyle: 'dashed',
    })
    map.add([circle])
    map.setFitView([circle])

    return () => map.remove([circle])
  }, [mapReady, cities, environmentMap, mode, selectedCity, radiusKm])

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

  const nearbyCities = useMemo(() => {
    if (!selectedCity) return []

    return cities
      .filter((city) => city.id !== selectedCity.id)
      .map((city) => ({ city, distance: distanceKm(selectedCity, city) }))
      .filter((item) => item.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance)
  }, [cities, selectedCity, radiusKm])

  return (
    <Spin spinning={loading}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div className="page-header">
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              地图可视化
            </Typography.Title>
          </div>
          <Space>
            <Segmented
              value={mode}
              options={['城市', '环境', '交通']}
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
        {mode === '交通' && trafficError && (
          <Alert showIcon type="warning" message={trafficError} />
        )}

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
          <Col xs={24} xl={(mode === '交通' ? activeTraffic : selectedCity) ? 16 : 24}>
            <Card title={mode === '城市' ? '城市分布' : mode === '环境' ? '空气质量分布' : '交通拥堵热力图'}>
              <div
                ref={mapContainerRef}
                className="amap-view"
                style={{ width: '100%', height: 520, borderRadius: 8 }}
              />
            </Card>
          </Col>
          {mode !== '交通' && selectedCity && (
            <Col xs={24} xl={8}>
              <Card
                title={selectedCity.name}
                extra={
                  <Space>
                    {selectedEnvironment && (
                      <Tag color={getAqiLevel(selectedEnvironment.aqi).color}>
                        {getAqiLevel(selectedEnvironment.aqi).label}
                      </Tag>
                    )}
                    <Button size="small" onClick={() => setSelectedCity(undefined)}>
                      清除选择
                    </Button>
                  </Space>
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
                <div className="map-analysis">
                  <Typography.Title level={5}>周边城市分析</Typography.Title>
                  <Segmented
                    block
                    value={radiusKm}
                    options={[
                      { label: '300 km', value: 300 },
                      { label: '800 km', value: 800 },
                      { label: '1500 km', value: 1500 },
                    ]}
                    onChange={(value) => setRadiusKm(Number(value))}
                    style={{ marginTop: 12 }}
                  />
                  <Statistic
                    title="范围内城市"
                    value={nearbyCities.length}
                    suffix="座"
                    style={{ marginTop: 16 }}
                  />
                  {nearbyCities.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前范围内没有其他城市" />
                  ) : (
                    <List
                      size="small"
                      dataSource={nearbyCities}
                      renderItem={({ city, distance }) => (
                        <List.Item>
                          <Typography.Text>{city.name}</Typography.Text>
                          <Typography.Text type="secondary">
                            {Math.round(distance).toLocaleString('zh-CN')} km
                          </Typography.Text>
                        </List.Item>
                      )}
                    />
                  )}
                </div>
              </Card>
            </Col>
          )}
          {mode === '交通' && activeTraffic && (
            <Col xs={24} xl={8}>
              <Card title="交通热点">
                <Descriptions
                  column={1}
                  size="small"
                  items={[
                    { key: 'road', label: '道路', children: activeTraffic.roadName },
                    { key: 'index', label: '拥堵指数', children: activeTraffic.congestionIndex.toFixed(1) },
                    { key: 'point', label: '监测点', children: `${activeTraffic.lng.toFixed(3)}, ${activeTraffic.lat.toFixed(3)}` },
                  ]}
                />
                <List
                  size="small"
                  className="traffic-ranking"
                  dataSource={rankedTraffic.slice(0, 10)}
                  renderItem={(point, index) => (
                    <List.Item
                      className="traffic-ranking-item"
                      onClick={() => setSelectedTraffic(point)}
                    >
                      <Typography.Text>{index + 1}. {point.roadName}</Typography.Text>
                      <Tag color={point.congestionIndex >= 8 ? 'red' : 'orange'}>
                        {point.congestionIndex.toFixed(1)}
                      </Tag>
                    </List.Item>
                  )}
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
