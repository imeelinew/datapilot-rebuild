import type { ReactNode } from "react";
export interface MenuNode {
    key: string
    label: string
    icon: ReactNode
    children?: MenuNode[]
}
