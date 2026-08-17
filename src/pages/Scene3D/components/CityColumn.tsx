import {
    Html,
    RoundedBox,
} from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import type { Group } from 'three'
import type { CityColumnProps } from '@/types/3d'
import GlowRing from './GlowRing'

function CityColumn({ name, value, height, position, color }: CityColumnProps) { 
    const groupRef = useRef<Group>(null)
    const [hovered, setHovered] = useState(false)

    useFrame((_, delta) => {
        if (!groupRef.current) return
        
        group
    })

}