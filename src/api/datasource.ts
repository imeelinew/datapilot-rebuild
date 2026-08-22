import request from "@/utils/request"
import type {
  ChartQueryConfig,
  DatasourceQueryResult,
} from "@/types/dashboardManage"
import type {
  DatasourcePageResult,
  FieldListResult,
  TableListResult,
} from '@/types/datasource'

const datasourceService = {
  getList() {
    return request.get('/datasources', {
      params: {
        page: 1,
        pageSize: 100,
      },
    }) as Promise<DatasourcePageResult>
  },

  getTables(id: number) {
    return request.get(
      `/datasources/${id}/tables`,
    ) as Promise<TableListResult>
  },

  getFields(id: number, table: string) {
    return request.get(
      `/datasources/${id}/tables/${encodeURIComponent(table)}/fields`,
    ) as Promise<FieldListResult>
  },

  query(id: number, data: ChartQueryConfig) {
    return request.post(
      `/datasources/${id}/query`,
      data,
    ) as Promise<DatasourceQueryResult>
  },
}
export default datasourceService
