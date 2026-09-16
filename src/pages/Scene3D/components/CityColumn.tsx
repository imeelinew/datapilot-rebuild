import { Html, RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, useState } from 'react'
import type { Group } from 'three'
import type { CityColumnProps } from '@/types/3d'

function CityColumn({
    name,
    value,
    height,
    position,
    color,
    selected,
    onSelect,
}: CityColumnProps) {
    const groupRef = useRef<Group>(null)
    const [hovered, setHovered] = useState(false)

    useLayoutEffect(() => {
        if (!groupRef.current) return

        groupRef.current.scale.set(1, 0.01, 1)
    }, [height])

    useFrame((_, delta) => {
        if (!groupRef.current) return

        groupRef.current.scale.y = Math.min(
            groupRef.current.scale.y + delta,
            1,
        )
    })

    return (
        <group
            ref={groupRef}
            position={position}
        >
            <RoundedBox
                args={[0.5, height, 0.5]}
                radius={0.06}
                smoothness={4}
                position={[0, height / 2, 0]}
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
                onClick={(event) => {
                    event.stopPropagation()
                    onSelect()
                }}
            >
                <meshPhysicalMaterial
                    color={color}
                    roughness={0.25}
                    metalness={0.35}
                    clearcoat={1}
                    emissive={color}
                    emissiveIntensity={selected ? 0.85 : hovered ? 0.6 : 0.15}
                />
            </RoundedBox>

            {selected && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
                    <torusGeometry args={[0.48, 0.055, 8, 40]} />
                    <meshBasicMaterial color={color} />
                </mesh>
            )}

            {(hovered || selected) && (
                <Html
                    position={[0, height + 0.6, 0]}
                    center
                    distanceFactor={10}
                    style={{
                        padding: '6px 10px',
                        color: '#fff',
                        background: 'rgba(6, 16, 31, 0.85)',
                        borderRadius: 6,
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                    }}
                >
                    <div style={{ fontWeight: 700 }}>{name}</div>
                    <div>{value}</div>
                </Html>
            )}
        </group>
    )
}

export default CityColumn
