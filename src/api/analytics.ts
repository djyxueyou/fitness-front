import { request } from '@/api/http'

export type AnalyticsRange = 'week' | 'month' | '90d'

export interface AnalyticsOverviewResponse {
  range: AnalyticsRange
  totalSessions: number
  totalVolumeKg: number
  totalDurationSeconds: number
  lastTrainingAt?: string
  prCount: number
  topMuscles: AnalyticsTopMuscleResponse[]
}

export interface AnalyticsDashboardResponse {
  range: AnalyticsRange
  current: {
    totalSessions: number
    totalVolumeKg: number
    totalDurationSeconds: number
  }
  previous: {
    totalSessions: number
    totalVolumeKg: number
    totalDurationSeconds: number
  }
  delta: {
    sessions: number
    volumeKg: number
    volumePercent?: number | null
    durationSeconds: number
  }
}

export interface AnalyticsTopMuscleResponse {
  muscle: string
  sessionCount: number
  setCount: number
  volumeKg: number
}

export interface AnalyticsWeeklyVolumePointResponse {
  weekStart: string
  weekEnd: string
  sessionCount: number
  totalSetCount: number
  totalVolumeKg: number
  totalDurationSeconds: number
}

export interface AnalyticsWeeklyVolumeResponse {
  weeks: AnalyticsWeeklyVolumePointResponse[]
}

export interface AnalyticsMuscleDistributionItemResponse {
  muscle: string
  setCount: number
  volumeKg: number
  percentage: number
}

export interface AnalyticsMuscleDistributionResponse {
  items: AnalyticsMuscleDistributionItemResponse[]
}

export interface ExerciseTrendPointResponse {
  trainingId: number
  trainedAt: string
  maxWeightKg: number
  totalVolumeKg: number
  totalReps: number
  maxDurationSeconds: number
}

export interface ExerciseTrendResponse {
  exerciseId: number
  exerciseName?: string
  recordType?: string
  points: ExerciseTrendPointResponse[]
}

export interface AnalyticsPrItemResponse {
  trainingId: number
  exerciseId: number
  exerciseName: string
  prType: string
  value: number
  previousValue?: number | null
  delta?: number | null
  achievedAt: string
}

export interface AnalyticsPrListResponse {
  items: AnalyticsPrItemResponse[]
}

export interface AnalyticsInsightResponse {
  type: string
  title: string
  description: string
}

export interface AdvancedAnalyticsSummaryResponse {
  dataReady: boolean
  readinessCode: string
  headline: string
  summary: string
  highlights: AnalyticsInsightResponse[]
  attentionItems: AnalyticsInsightResponse[]
}

export function fetchWeeklyVolume(weeks = 12) {
  return request<AnalyticsWeeklyVolumeResponse>({
    url: '/api/trainings/analytics/weekly-volume',
    method: 'GET',
    data: { weeks }
  })
}

export function fetchAnalyticsDashboard(range: AnalyticsRange = 'week') {
  return request<AnalyticsDashboardResponse>({
    url: '/api/trainings/analytics/dashboard',
    method: 'GET',
    data: { range }
  })
}

export function fetchMuscleDistribution(range: AnalyticsRange = 'month') {
  return request<AnalyticsMuscleDistributionResponse>({
    url: '/api/trainings/analytics/muscle-distribution',
    method: 'GET',
    data: { range }
  })
}

export function fetchAnalyticsOverview(range: AnalyticsRange = 'month') {
  return request<AnalyticsOverviewResponse>({
    url: '/api/trainings/analytics/overview',
    method: 'GET',
    data: { range }
  })
}

export function fetchExerciseTrend(exerciseId: number, range: AnalyticsRange = '90d') {
  return request<ExerciseTrendResponse>({
    url: `/api/trainings/exercises/${exerciseId}/trend`,
    method: 'GET',
    data: { range }
  })
}

export function fetchAnalyticsPrs(range: AnalyticsRange = 'month') {
  return request<AnalyticsPrListResponse>({
    url: '/api/trainings/analytics/prs',
    method: 'GET',
    data: { range }
  })
}

export function fetchAdvancedAnalyticsSummary() {
  return request<AdvancedAnalyticsSummaryResponse>({
    url: '/api/trainings/analytics/advanced-summary',
    method: 'GET'
  })
}
