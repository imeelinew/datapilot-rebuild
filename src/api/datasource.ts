import request from "@/utils/request"
import type {
  ChartQueryConfig,
  DatasourceQueryResult,
} from "@/types/dashboardManage"

const datasourceService = {
  query(id: number, data: ChartQueryConfig) {
    return request.post(
      `/datasources/${id}/query`,
      data,
    ) as Promise<DatasourceQueryResult>
  },
}
export default datasourceService