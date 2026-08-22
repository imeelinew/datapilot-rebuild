import request from '@/utils/request'
import type {
  PermissionResult,
  ResetPasswordResult,
  RoleInput,
  RoleListResult,
  RoleResult,
  UploadResult,
  UserInput,
  UserListParams,
  UserPageResult,
  UserResult,
} from '@/types/admin'

export const userService = {
  getList(params: UserListParams) {
    return request.get('/users', { params }) as Promise<UserPageResult>
  },
  create(data: UserInput) {
    return request.post('/users', data) as Promise<UserResult>
  },
  update(id: number | string, data: Partial<UserInput>) {
    return request.put(`/users/${id}`, data) as Promise<UserResult>
  },
  delete(id: number | string) {
    return request.delete(`/users/${id}`)
  },
  setStatus(id: number | string, status: number) {
    return request.patch(`/users/${id}/status`, { status })
  },
  resetPassword(id: number | string) {
    return request.put(
      `/users/${id}/password`,
    ) as Promise<ResetPasswordResult>
  },
  uploadAvatar(file: File) {
    const data = new FormData()
    data.append('file', file)
    return request.post('/upload/avatar', data) as Promise<UploadResult>
  },
}

export const roleService = {
  getList() {
    return request.get('/roles') as Promise<RoleListResult>
  },
  getDetail(id: number) {
    return request.get(`/roles/${id}`) as Promise<RoleResult>
  },
  create(data: RoleInput) {
    return request.post('/roles', data)
  },
  update(id: number, data: RoleInput) {
    return request.put(`/roles/${id}`, data)
  },
  delete(id: number) {
    return request.delete(`/roles/${id}`)
  },
  getPermissions() {
    return request.get('/permissions') as Promise<PermissionResult>
  },
  setPermissions(id: number, permissionIds: number[]) {
    return request.put(`/roles/${id}/permissions`, { permissionIds })
  },
}
