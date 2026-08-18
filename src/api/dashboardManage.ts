import request from "../utils/request"

import type { DashboardPageResult, PageParams, DashboardInput, DashboardResult, DashboardDetailResult } from "../types/dashboardManage"

export const dashboardManageService = {
    getList(params: PageParams) {
        return request.get(
            '/dashboards',
            { params }
        ) as Promise<DashboardPageResult>
    },
    create(data: DashboardInput) {
        return request.post(
            '/dashboards',
            data
        ) as Promise<DashboardResult>
    },
    clone(id: number) {
        return request.post(
            `/dashboards/${id}/clone`
        ) as Promise<DashboardResult>
    },
    delete(id: number) {
        return request.delete(
            `/dashboards/${id}`
        )
    },
    getDetail(id: number) {
        return request.get(
            `/dashboards/${id}`
        ) as Promise<DashboardDetailResult>
    }
}
export default dashboardManageService