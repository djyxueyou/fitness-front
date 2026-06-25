import { request } from '@/api/http'

export interface WeeklyReviewMetricsResponse {
  sessionCount: number
  totalVolumeKg: number
  totalDurationSeconds: number
  plannedCount: number
  completedPlannedCount: number
  overdueCount: number
}

export interface WeeklyReviewDayResponse {
  date: string
  dayOfWeek: number
  sessionCount: number
  totalVolumeKg: number
  status: 'TRAINED' | 'REST' | string
}

export interface WeeklyReviewItemResponse {
  type: string
  title: string
  description: string
}

export interface WeeklyNextActionResponse {
  type: 'START_FREE_WORKOUT' | 'START_PLAN_DAY' | 'RECOVER_OVERDUE' | 'VIEW_WEEKLY_DETAIL' | string
  label: string
  description: string
  targetId?: number
  targetDate?: string
}

export interface WeeklyReviewResponse {
  weekStart: string
  weekEnd: string
  headline: string
  conclusion: string
  metrics: WeeklyReviewMetricsResponse
  days: WeeklyReviewDayResponse[]
  highlights: WeeklyReviewItemResponse[]
  attentionItems: WeeklyReviewItemResponse[]
  nextAction: WeeklyNextActionResponse
}

export function fetchWeeklyReview(weekStart?: string) {
  return request<WeeklyReviewResponse>({
    url: '/api/trainings/weekly-review',
    method: 'GET',
    data: weekStart ? { weekStart } : {}
  })
}
