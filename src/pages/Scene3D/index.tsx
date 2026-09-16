import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ReloadOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Progress,
  Segmented,
  Select,
  Space,
  Spin,
  Switch,
  Typography,
  message,
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import dashboardService from '@/api/dashboard'
import type { City } from '@/types/dashboard'
import CityColumn from './components/CityColumn'

type MetricType = 'population' | 'area' | 'gdp'

type SceneCity = {
  city: City
  displayValue: string
  metricValue: number
  height: number
  rank: number
}

const metricLabels: Record<MetricType, string> = {
  population: '人口',
  area: '面积',
  gdp: 'GDP',
}

const columnColors = [
  '#f5222d',
  '#fa8c16',
  '#fadb14',
  '#52c41a',
  '#13c2c2',
  '#1677ff',
  '#722ed1',
  '#eb2f96',
]

function formatMetricValue(value: number, metric: MetricType) {
  const formatted = value.toLocaleString('zh-CN', {
    maximumFractionDigits: 1,
  })

  if (metric === 'population') return `${formatted} 万人`
  if (metric === 'area') return `${formatted} km²`
  return `${formatted} 亿元`
}

function SceneContent({
  cityData,
  selectedCityId,
  onSelectCity,
  autoRotate,
}: {
  cityData: SceneCity[]
  selectedCityId?: number
  onSelectCity: (id: number) => void
  autoRotate: boolean
}) {
  const radius = 5

  return (
    <>
      <color attach="background" args={['#f1f3f5']} />
      <ambientLight intensity={1.8} />
      <directionalLight position={[6, 10, 8]} intensity={2.5} />
      <gridHelper args={[22, 22, '#aab7c4', '#d5dce3']} />

      {cityData.map((item, index) => {
        const angle = (index / cityData.length) * Math.PI * 2
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius

        return (
          <CityColumn
            key={item.city.id}
            name={item.city.name}
            value={item.displayValue}
            height={item.height}
            position={[x, 0, z]}
            color={columnColors[index % columnColors.length]}
            selected={item.city.id === selectedCityId}
            onSelect={() => onSelectCity(item.city.id)}
          />
        )
      })}

      <OrbitControls
        target={[0, 1.5, 0]}
        minDistance={8}
        maxDistance={20}
        enableDamping
        autoRotate={autoRotate}
        autoRotateSpeed={0.5}
      />
    </>
  )
}

function Scene3D() {
  const [cities, setCities] = useState<City[]>([])
  const [metric, setMetric] = useState<MetricType>('population')
  const [selectedCityId, setSelectedCityId] = useState<number>()
  const [autoRotate, setAutoRotate] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadCities = useCallback(async () => {
    setLoading(true)

    try {
      const result = await dashboardService.getCities()
      setCities(result.data)
    } catch (error) {
      console.error(error)
      message.error('城市数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCities()
  }, [loadCities])

  const sceneData = useMemo<SceneCity[]>(() => {
    const sortedCities = [...cities].sort(
      (a, b) => Number(b[metric] ?? 0) - Number(a[metric] ?? 0),
    )
    const maxValue = Math.max(
      ...sortedCities.map((city) => Number(city[metric] ?? 0)),
      1,
    )

    return sortedCities.map((city, index) => {
      const metricValue = Number(city[metric] ?? 0)

      return {
        city,
        metricValue,
        displayValue: formatMetricValue(metricValue, metric),
        height: 1.2 + (metricValue / maxValue) * 4.8,
        rank: index + 1,
      }
    })
  }, [cities, metric])

  const selected = sceneData.find((item) => item.city.id === selectedCityId) ?? sceneData[0]
  const average = cities.length
    ? sceneData.reduce((sum, item) => sum + item.metricValue, 0) / cities.length
    : 0
  const maxValue = sceneData[0]?.metricValue ?? 0

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div className="page-header">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            3D 城市场景
          </Typography.Title>
          <Typography.Text type="secondary">
            点击数据柱选中城市，拖动旋转视角，滚轮缩放
          </Typography.Text>
        </div>
        <Space wrap>
          <Segmented
            value={metric}
            options={Object.entries(metricLabels).map(([value, label]) => ({ value, label }))}
            onChange={(value) => setMetric(value as MetricType)}
          />
          <Switch
            checked={autoRotate}
            checkedChildren="自动旋转"
            unCheckedChildren="手动旋转"
            onChange={setAutoRotate}
          />
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => void loadCities()}
          >
            刷新
          </Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        <div className="scene-explorer">
          <div className="scene-canvas">
            <Canvas camera={{ position: [11, 12, 16], fov: 50 }}>
              <SceneContent
                cityData={sceneData}
                selectedCityId={selected?.city.id}
                onSelectCity={setSelectedCityId}
                autoRotate={autoRotate}
              />
            </Canvas>
          </div>

          <Card title="城市指标分析" className="scene-panel">
            {selected ? (
              <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                <Select
                  value={selected.city.id}
                  options={sceneData.map((item) => ({
                    label: item.city.name,
                    value: item.city.id,
                  }))}
                  onChange={setSelectedCityId}
                  aria-label="选择城市"
                  style={{ width: '100%' }}
                />
                <div>
                  <Typography.Text type="secondary">
                    {metricLabels[metric]} · 第 {selected.rank} / {sceneData.length} 名
                  </Typography.Text>
                  <Typography.Title level={3} style={{ margin: '4px 0' }}>
                    {selected.displayValue}
                  </Typography.Title>
                  <Progress
                    percent={maxValue ? Math.round((selected.metricValue / maxValue) * 100) : 0}
                    format={(percent) => `最高值的 ${percent}%`}
                  />
                  <Typography.Text type="secondary">
                    全部城市平均：{formatMetricValue(average, metric)}
                  </Typography.Text>
                </div>
                <Descriptions
                  column={1}
                  size="small"
                  items={[
                    { key: 'province', label: '省份', children: selected.city.province },
                    { key: 'population', label: '人口', children: formatMetricValue(selected.city.population, 'population') },
                    { key: 'area', label: '面积', children: formatMetricValue(selected.city.area, 'area') },
                    { key: 'gdp', label: 'GDP', children: selected.city.gdp == null ? '-' : formatMetricValue(Number(selected.city.gdp), 'gdp') },
                  ]}
                />
              </Space>
            ) : (
              <Empty description="暂无城市数据" />
            )}
          </Card>
        </div>
      </Spin>
    </Space>
  )
}

export default Scene3D
