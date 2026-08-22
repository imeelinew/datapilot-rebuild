import type { ApiResult, User } from '@/types/auth'
import type { PageData } from '@/types/dashboardManage'

export type UserListParams = {
  page?: number
  pageSize?: number
  username?: string
  status?: number
  roleId?: number
}

export type UserInput = {
  username: string
  password?: string
  email?: string
  avatar?: string
  roleId: number
}

export type UserPageResult = ApiResult<PageData<User>>
export type UserResult = ApiResult<User>

export type AdminRole = {
  id: number
  name: string
  code: string
  description: string | null
  status: number
  createdAt: string
  updatedAt: string
  permissions?: PermissionNode[]
}

export type RoleInput = {
  name: string
  code: string
  description?: string
}

export type PermissionNode = {
  id: number
  name: string
  label: string
  parentId: number | null
  type: string
  path: string | null
  icon: string | null
  sortOrder: number
  children?: PermissionNode[]
}

export type RoleListResult = ApiResult<AdminRole[]>
export type RoleResult = ApiResult<AdminRole>
export type PermissionResult = ApiResult<PermissionNode[]>
export type ResetPasswordResult = ApiResult<{ newPassword: string }>
export type UploadResult = ApiResult<{ url: string; filename: string }>
