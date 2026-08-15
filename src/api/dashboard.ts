import request from '@/utils/request'
import type {
    CityEventPageResult,
    EventStatsResult,
    FacilityResult,
    OverviewResult,
    TrafficRankingResult,
} from '@/types/dashboard'

const dashboardService = {
    getOverview() {
        return request.get(
            '/cities/overview',
        ) as Promise<OverviewResult>
    },

    getFacilityStats() {
        return request.get(
            '/cities/facility-stats',
        ) as Promise<FacilityResult>
    },

    getTrafficRanking() {
        return request.get(
            '/cities/traffic-ranking',
        ) as Promise<TrafficRankingResult>
    },

    getEventStats() {
        return request.get(
            '/cities/event-stats',
        ) as Promise<EventStatsResult>
    },

    getLatestEvents() {
        return request.get('/cities/events', {
            params: {
                page: 1,
                pageSize: 8,
            },
        }) as Promise<CityEventPageResult>
    },
}

export default dashboardService