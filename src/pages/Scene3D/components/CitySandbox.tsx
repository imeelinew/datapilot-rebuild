import { Html, OrbitControls } from '@react-three/drei'
import { DoubleSide } from 'three'
import { sandboxZones, type SandboxZone } from '../sandboxZones'

function Tree({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.045, 0.065, 0.48, 8]} />
        <meshStandardMaterial color="#795548" />
      </mesh>
      <mesh position={[0, 0.61, 0]}>
        <sphereGeometry args={[0.32, 10, 10]} />
        <meshStandardMaterial color="#3a965c" roughness={0.9} />
      </mesh>
    </group>
  )
}

function ZoneModel({
  zone,
  selected,
  exploded,
  onSelect,
}: {
  zone: SandboxZone
  selected: boolean
  exploded: boolean
  onSelect: () => void
}) {
  const floorHeight = 0.48
  const floorGap = selected && exploded ? 0.18 : 0
  const roofHeight = zone.floors * (floorHeight + floorGap) + 0.12

  return (
    <group
      position={[zone.position[0], 0, zone.position[1]]}
      onClick={(event) => {
        event.stopPropagation()
        onSelect()
      }}
    >
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[2.35, 0.14, 2.35]} />
        <meshStandardMaterial color={selected ? '#81c5ff' : '#cbd5df'} />
      </mesh>

      {zone.floors === 0 ? (
        <>
          <mesh position={[0, 0.17, 0]}>
            <boxGeometry args={[2.1, 0.08, 2.1]} />
            <meshStandardMaterial color="#72bf7a" />
          </mesh>
          <Tree position={[-0.65, 0.2, -0.62]} />
          <Tree position={[0.62, 0.2, -0.55]} />
          <Tree position={[-0.55, 0.2, 0.58]} />
          <Tree position={[0.6, 0.2, 0.6]} />
          <mesh position={[0, 0.23, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.08, 20]} />
            <meshStandardMaterial color="#9ed7e5" metalness={0.2} roughness={0.2} />
          </mesh>
        </>
      ) : (
        <>
          {Array.from({ length: zone.floors }, (_, index) => {
            const y = 0.38 + index * (floorHeight + floorGap)
            return (
              <group key={index} position={[0, y, 0]}>
                <mesh>
                  <boxGeometry args={[1.65, 0.44, 1.65]} />
                  <meshStandardMaterial
                    color={zone.color}
                    roughness={0.65}
                    metalness={0.12}
                    emissive={selected ? '#1b5d91' : '#000000'}
                    emissiveIntensity={selected ? 0.22 : 0}
                  />
                </mesh>
                <mesh position={[0, 0.03, 0.837]}>
                  <boxGeometry args={[1.32, 0.24, 0.018]} />
                  <meshStandardMaterial color="#d9efff" emissive="#7ab6df" emissiveIntensity={0.22} />
                </mesh>
                <mesh position={[0, 0.03, -0.837]}>
                  <boxGeometry args={[1.32, 0.24, 0.018]} />
                  <meshStandardMaterial color="#d9efff" emissive="#7ab6df" emissiveIntensity={0.22} />
                </mesh>
              </group>
            )
          })}
          <mesh position={[0, roofHeight, 0]}>
            <boxGeometry args={[1.85, 0.14, 1.85]} />
            <meshStandardMaterial color="#33485e" metalness={0.3} roughness={0.5} />
          </mesh>
          {zone.id === 'command' && (
            <mesh position={[0, roofHeight + 0.4, 0]}>
              <cylinderGeometry args={[0.035, 0.06, 0.8, 8]} />
              <meshStandardMaterial color="#bfd5e8" metalness={0.7} />
            </mesh>
          )}
        </>
      )}

      {selected && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.17, 0]}>
            <ringGeometry args={[1.43, 1.53, 40]} />
            <meshBasicMaterial color="#20a9ff" side={DoubleSide} />
          </mesh>
          <Html
            position={[0, zone.floors ? roofHeight + 0.6 : 1.4, 0]}
            center
            distanceFactor={11}
            style={{
              background: 'rgba(10, 30, 54, 0.9)',
              color: '#fff',
              padding: '5px 9px',
              borderRadius: 6,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {zone.name}
          </Html>
        </>
      )}
    </group>
  )
}

export function CitySandbox({
  selectedZoneId,
  onSelectZone,
  exploded,
  autoRotate,
}: {
  selectedZoneId?: string
  onSelectZone: (id: string) => void
  exploded: boolean
  autoRotate: boolean
}) {
  const selectedZone = sandboxZones.find((zone) => zone.id === selectedZoneId)

  return (
    <>
      <color attach="background" args={['#dce8ee']} />
      <ambientLight intensity={2} />
      <directionalLight position={[6, 13, 9]} intensity={2.4} />
      <mesh position={[0, -0.11, 0]}>
        <boxGeometry args={[12.7, 0.2, 12.7]} />
        <meshStandardMaterial color="#e9f1ec" />
      </mesh>
      {[-1.7, 1.7].map((offset) => (
        <group key={offset}>
          <mesh position={[offset, 0.01, 0]}>
            <boxGeometry args={[0.55, 0.02, 12]} />
            <meshStandardMaterial color="#748596" />
          </mesh>
          <mesh position={[0, 0.015, offset]}>
            <boxGeometry args={[12, 0.02, 0.55]} />
            <meshStandardMaterial color="#748596" />
          </mesh>
        </group>
      ))}
      {sandboxZones.map((zone) => (
        <ZoneModel
          key={zone.id}
          zone={zone}
          selected={zone.id === selectedZoneId}
          exploded={exploded}
          onSelect={() => onSelectZone(zone.id)}
        />
      ))}
      <OrbitControls
        target={selectedZone ? [selectedZone.position[0], 1.3, selectedZone.position[1]] : [0, 1.3, 0]}
        minDistance={5}
        maxDistance={22}
        maxPolarAngle={Math.PI / 2.05}
        enableDamping
        autoRotate={autoRotate}
        autoRotateSpeed={0.45}
      />
    </>
  )
}
