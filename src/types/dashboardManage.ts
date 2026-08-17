import type { ApiResult } from "./auth"
export type PageData<T> = {
    list: T[]
    total: number
    page: number
    pageSize: number
}
export type DashboardItem = {
    id: number
    title: string
    description: string | null
    layout: Array<Record<string, unknown>> | null
    isPublic: number
    bgTheme: 'light' | 'dark'
    createdBy: number
    createdAt: string
    updatedAt: string
    creator?: {
        id: number
        username: string
    }
    _count?: {
        charts: number
    }
}
export type DashboardPageResult = ApiResult<PageData<DashboardItem>>
export type PageParams = {
    page?: number
    pageSize?: number
    keyword?: string
}
//创建仪表盘
export type DashboardInput = {
    title: string
    description?: string
    layout?: Array<Record<string, unknown>>
    bgTheme?: 'light' | 'dark'
}

export type DashboardResult = ApiResult<DashboardItem>

//仪表盘详情
export type DashboardDetail =
  DashboardItem & {
    charts: Array<Record<string, unknown>>
    mapLayers: Array<Record<string, unknown>>
  }

export type DashboardDetailResult =
  ApiResult<DashboardDetail>