import type { ReactNode } from "react";
export type RoleCode = 'super_admin' | 'admin' | 'analyst' | 'user'

export interface MenuNode {
    key: string
    label: string
    icon: ReactNode
    roles: RoleCode[]
    children?: MenuNode[]
}
