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
    userTrainingPlanId: number
    planId: number
    planName: string
    planDayId: number
    title: string
    templateId: number
    templateName?: string
    scheduledDate: string
    status: string
    actionType: string
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
