import type { GlowRingProps } from '@/types/3d'
function GlowRing({
    position,
    innerRadius = 1.1,
    outerRadius = 1.4,
    color = '#00d4ff',
    opacity = 0.7,
}: GlowRingProps) {
    return (
        <mesh
            position={position}
            rotation={[-Math.PI / 2, 0, 0]}
        >
            <ringGeometry
                args={[
                    innerRadius,
                    outerRadius,
                    64,
                ]}
            />

            <meshBasicMaterial
                color={color}
                transparent
                opacity={opacity}
            />
        </mesh>
    )
}

export default GlowRing