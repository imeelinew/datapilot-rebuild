import type { ApiResult } from './auth'

export interface City {
  id: number
  name: string
  province: string
  population: number
  area: number
  gdp: number | string | null
  lng: number
  lat: number
  createdAt: string
}

export interface CityOverview {
  totalCities: number
  avgCongestionIndex: number | null
  avgAqi: number | null
  avgPM25: number | null
  avgTemperature: number | null
  avgSpeed: number | null
  pendingEvents: number
  eventProcessRate: number
}

export interface FacilityStat {
  type: string
  count: number
}

export interface TrafficRankingItem {
  name: string
  value: number
}

export interface EventStats {
  total: number

  byType: Array<{
    type: string
    count: number
  }>

  bySeverity: Array<{
    severity: string
    count: number
  }>

  byStatus: Array<{
    status: string
    count: number
  }>
}

export interface CityEvent {
  id: number
  title: string
  eventType: string
  severity: string
  status: string
  reportedAt: string

  city: {
    id: number
    name: string
  }
}

export interface EnvironmentItem {
  id: number
  cityId: number
  district: string
  aqi: number
  pm25: number
  pm10: number
  temperature: number
  humidity: number
  noise: number
  weather: string
  recordedAt: string
}

export interface CityEventPage {
  list: CityEvent[]
  total: number
  page: number
  pageSize: number
}

export type OverviewResult = ApiResult<CityOverview>

export type CityListResult = ApiResult<City[]>

export type FacilityResult = ApiResult<FacilityStat[]>

export type TrafficRankingResult =
  ApiResult<TrafficRankingItem[]>

export type EventStatsResult = ApiResult<EventStats>

export type CityEventPageResult =
  ApiResult<CityEventPage>

export type EnvironmentResult = ApiResult<EnvironmentItem[]>
