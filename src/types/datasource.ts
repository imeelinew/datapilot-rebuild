import type { ApiResult } from '@/types/auth'
import type { PageData } from '@/types/dashboardManage'

export type Datasource = {
  id: number
  name: string
  type: string
  config: Record<string, unknown>
  status: number
  description: string | null
  createdBy: number
  createdAt: string
  updatedAt: string
}

export type DatasourcePageResult = ApiResult<PageData<Datasource>>

export type TableInfo = {
  tableName: string
}

export type FieldInfo = {
  columnName: string
  dataType: string
}

export type TableListResult = ApiResult<TableInfo[]>
export type FieldListResult = ApiResult<FieldInfo[]>
