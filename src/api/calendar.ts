import { request } from '@/api/http'

export interface CalendarMonthResponse {
  year: number
  month: number
  summary: {
    plannedCount: number
    trainedDayCount: number
    duePlanDayCount: number
    completedDuePlanDayCount: number
    completionRate?: number
  }
  days: Array<{
    date: string
    hasPlan: boolean
    hasTraining: boolean
    needsAttention: boolean
  }>
}

export interface CalendarDateDetailResponse {
  date: string
  planDays: Array<{
    sourceType?: 'MY_PLAN' | 'RECOMMENDED_EXECUTION' | string
    userTrainingPlanId?: number | null
    executionId?: number
    planId?: number | null
    planName: string
    planDayId?: number
    executionDayId?: number
    title: string
    templateId?: number
    templateName?: string
    scheduledDate: string
    status: string
    actionType: string
    canSkip?: boolean
    coverUrl?: string
    coverRecordType?: string
    completedTrainingId?: number
    durationSeconds?: number
    totalSetCount?: number
    totalVolumeKg?: number
  }>
  trainingRecords: Array<{
    id: number
    trainingName: string
    sourceType: string
    coverUrl?: string
    coverRecordType?: string
    startedAt: string
    durationSeconds: number
    totalSetCount: number
    totalVolumeKg: number
    planDayId?: number
  }>
}

export function fetchCalendarMonth(year: number, month: number) {
  return request<CalendarMonthResponse>({
    url: `/api/calendar/month?year=${year}&month=${month}`,
    method: 'GET'
  })
}

export function fetchCalendarDate(date: string) {
  return request<CalendarDateDetailResponse>({
    url: `/api/calendar/dates/${date}`,
    method: 'GET'
  })
}
