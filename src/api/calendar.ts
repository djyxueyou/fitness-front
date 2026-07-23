import { request } from '@/api/http'
import { normalizeCalendarCoverItems } from '@/utils/calendar-cover-url'

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
    sourceType?: 'USER_PLAN_EXECUTION' | 'SYSTEM_PLAN_EXECUTION' | string
    executionId?: number
    definitionId?: number | null
    planName: string
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
  }>
}

export function fetchCalendarMonth(year: number, month: number) {
  return request<CalendarMonthResponse>({
    url: `/api/calendar/month?year=${year}&month=${month}`,
    method: 'GET'
  })
}

export async function fetchCalendarDate(date: string) {
  const detail = await request<CalendarDateDetailResponse>({
    url: `/api/calendar/dates/${date}`,
    method: 'GET'
  })
  return {
    ...detail,
    planDays: normalizeCalendarCoverItems(detail.planDays),
    trainingRecords: normalizeCalendarCoverItems(detail.trainingRecords)
  }
}
