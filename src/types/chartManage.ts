import type { EChartsOption } from 'echarts'

import type { ApiResult } from '@/types/auth'
import type {
  ChartQueryConfig,
  DashboardChart,
  PageData,
} from '@/types/dashboardManage'

export type ChartItem = DashboardChart & {
  dashboard?: {
    id: number
    title: string
  }
  datasource?: {
    id: number
    name: string
    type: string
  } | null
}

export type ChartPageParams = {
  page?: number
  pageSize?: number
  dashboardId?: number
  chartType?: string
  keyword?: string
}

export type ChartInput = {
  dashboardId: number
  title: string
  chartType: DashboardChart['chartType']
  datasourceId: number | null
  queryConfig: ChartQueryConfig
  chartConfig: Record<string, unknown>
  position: {
    x: number
    y: number
    w: number
    h: number
  }
  sortOrder: number
}

export type ChartPageResult = ApiResult<PageData<ChartItem>>
export type ChartResult = ApiResult<ChartItem>
export type ChartPreviewResult = ApiResult<EChartsOption>
