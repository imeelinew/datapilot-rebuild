import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Typography } from 'antd'
import GlowRing from './components/GlowRing'
const { Title, Text } = Typography

function SceneContent() {
  return (
    <>
      <color
        attach='background'
        args={['#06101f']}
      ></color>
      <ambientLight intensity={1.2} />
      <directionalLight
        position={[6, 10, 8]}
        intensity={2}
      />
      <gridHelper
        args={[
          20,
          20,
          '#1677ff',
          '#16304f',
        ]}
      />
      <GlowRing
        position={[0, 0.02, 0]}
        innerRadius={1.15}
        outerRadius={1.45}
      />
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry
          args={[1, 1, 3, 32]}
        />
        <meshStandardMaterial
          color="#1677ff"
        />
      </mesh>
      <GlowRing
        position={[0, 3.05, 0]}
        innerRadius={0.9}
        outerRadius={1.1}
        color="#69e7ff"
        opacity={0.9}
      />
      <OrbitControls></OrbitControls>

    </>
  )
}
function Scene3D() {
  return (
    <div>
      <Title level={3} style={{ margin: 0 }}>
        3D 城市场景
      </Title>

      <Text type="secondary">
        使用三维数据柱展示城市核心指标
      </Text>
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
            position: [8, 7, 10],
            fov: 45,
          }}
        >
          <SceneContent />
        </Canvas>
      </div>
    </div>
  )
}
export default Scene3D