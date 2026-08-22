import request from '@/utils/request'
import type {
  ChartInput,
  ChartPageParams,
  ChartPageResult,
  ChartPreviewResult,
  ChartResult,
} from '@/types/chartManage'

const chartManageService = {
  getList(params: ChartPageParams) {
    return request.get('/charts', { params }) as Promise<ChartPageResult>
  },

  getDetail(id: number) {
    return request.get(`/charts/${id}`) as Promise<ChartResult>
  },

  create(data: ChartInput) {
    return request.post('/charts', data) as Promise<ChartResult>
  },

  update(id: number, data: ChartInput) {
    return request.put(`/charts/${id}`, data)
  },

  delete(id: number) {
    return request.delete(`/charts/${id}`)
  },

  preview(id: number) {
    return request.post(
      `/charts/${id}/preview`,
    ) as Promise<ChartPreviewResult>
  },
}

export default chartManageService
