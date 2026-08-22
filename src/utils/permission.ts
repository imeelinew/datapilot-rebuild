import type { User } from '@/types/auth'
import type { MenuNode, RoleCode } from '@/types/menu'

const pagePermissions: Record<string, RoleCode[]> = {
  '/dashboard': ['super_admin', 'admin', 'analyst', 'user'],
  '/data/dashboards': ['super_admin', 'admin', 'analyst'],
  '/data/charts': ['super_admin', 'admin', 'analyst'],
  '/visual/map': ['super_admin', 'admin', 'analyst', 'user'],
  '/visual/scene': ['super_admin', 'admin', 'analyst'],
  '/ai': ['super_admin', 'admin', 'analyst', 'user'],
  '/settings/users': ['super_admin', 'admin'],
  '/settings/roles': ['super_admin', 'admin'],
  '/profile': ['super_admin', 'admin', 'analyst', 'user'],
}

export function getRoleCode(user: User | null) {
  const code = user?.role?.code || user?.roleCode
  return code === 'data_analyst' ? 'analyst' : code
}

export function filterMenus(menus: MenuNode[], roleCode?: string): MenuNode[] {
  if (!roleCode) return []
  if (roleCode === 'super_admin') return menus

  return menus.flatMap((item) => {
    const children = item.children
      ? filterMenus(item.children, roleCode)
      : undefined
    const allowed = item.roles.includes(roleCode as RoleCode)

    if (!allowed && (!children || children.length === 0)) return []
    return [{ ...item, children }]
  })
}

export function canAccessPage(pathname: string, roleCode?: string) {
  if (!roleCode) return false
  if (roleCode === 'super_admin') return true

  // 详情页和编辑页沿用所属列表页的权限。
  const basePath = Object.keys(pagePermissions).find((path) => (
    pathname === path || pathname.startsWith(`${path}/`)
  ))

  if (!basePath) return true
  return pagePermissions[basePath].includes(roleCode as RoleCode)
}
