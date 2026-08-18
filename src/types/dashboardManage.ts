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

export type ChartQueryConfig = {
    sql?: string
    table?: string
    endpoint?: string
    xField?: string
    yField?: string
    params?: Record<string, unknown>
    refreshInterval?: number
}

export type DashboardChart = {
    id: number
    dashboardId: number
    title: string
    chartType: "line" | "bar" | "pie" | "scatter" | "table"
    datasourceId: number | null
    queryConfig: ChartQueryConfig | null
    chartConfig: Record<string, unknown>
    position: Record<string, unknown>
    sortOrder: number
    createdAt: string
    updatedAt: string
}

export type QueryColumn = {
    columnName: string
    dataType: string
}

export type DatasourceQueryData = {
    columns: QueryColumn[]
    rows: Array<Record<string, unknown>>
    total: number
    sql: string
}

export type DatasourceQueryResult =
    ApiResult<DatasourceQueryData>

//仪表盘详情
export type DashboardDetail =
    DashboardItem & {
        charts: DashboardChart[]
        mapLayers: Array<Record<string, unknown>>
    }

export type DashboardDetailResult =
    ApiResult<DashboardDetail>