import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ReloadOutlined } from '@ant-design/icons'
import {
  Button,
  Segmented,
  Space,
  Spin,
  Typography,
  message,
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import dashboardService from '@/api/dashboard'
import type { City } from '@/types/dashboard'
import CityColumn from './components/CityColumn'
const { Title, Text } = Typography

type MetricType = 'population' | 'area' | 'gdp'

type SceneCity = {
  id: number
  name: string
  displayValue: string
  height: number
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

function SceneContent({ cityData }: { cityData: SceneCity[] }) {
  const radius = 5

  return (
    <>
      <color
        attach='background'
        args={['#f1f3f5']}
      ></color>
      <ambientLight intensity={1.8} />
      <directionalLight
        position={[6, 10, 8]}
        intensity={2.5}
      />
      <gridHelper
        args={[
          22,
          22,
          '#aab7c4',
          '#d5dce3',
        ]}
      />

      {cityData.map((city, index) => {
        const angle = (index / cityData.length) * Math.PI * 2
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius

        return (
          <CityColumn
            key={city.name}
            name={city.name}
            value={city.displayValue}
            height={city.height}
            position={[x, 0, z]}
            color={columnColors[index % columnColors.length]}
          />
        )
      })}

      <OrbitControls
        target={[0, 1.5, 0]}
        minDistance={8}
        maxDistance={20}
      />

    </>
  )
}
function Scene3D() {
  const [cities, setCities] = useState<City[]>([])
  const [metric, setMetric] = useState<MetricType>('population')
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
    const sortedCities = [...cities].sort((a, b) => {
      return Number(b[metric] ?? 0) - Number(a[metric] ?? 0)
    })

    const maxValue = Math.max(
      ...sortedCities.map((city) => Number(city[metric] ?? 0)),
      1,
    )

    return sortedCities.map((city) => {
      const value = Number(city[metric] ?? 0)

      return {
        id: city.id,
        name: city.name,
        displayValue: formatMetricValue(value, metric),
        height: 1.2 + (value / maxValue) * 4.8,
      }
    })
  }, [cities, metric])

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            3D 城市场景
          </Title>

          <Text type="secondary">
            使用三维数据柱展示城市核心指标
          </Text>
        </div>

        <Space>
          <Segmented
            value={metric}
            options={[
              { label: '人口', value: 'population' },
              { label: '面积', value: 'area' },
              { label: 'GDP', value: 'gdp' },
            ]}
            onChange={(value) => setMetric(value as MetricType)}
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
        <div
          style={{
            height: 650,
            marginTop: 16,
            overflow: 'hidden',
            borderRadius: 8,
          }}
        >
          <Canvas
            camera={{
              position: [11, 12, 16],
              fov: 50,
            }}
          >
            <SceneContent cityData={sceneData} />
          </Canvas>
        </div>
      </Spin>
    </div>
  )
}
export default Scene3D
