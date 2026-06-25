import { request } from '@/api/http'

export interface ShareMetricResponse {
  label: string
  value: string
}

export interface ShareItemResponse {
  title: string
  description: string
}

export interface ShareSectionItemResponse {
  title: string
  description: string
  thumbnailUrl?: string
  recordType?: string
  details?: string[]
}

export interface ShareSectionResponse {
  title: string
  items: ShareSectionItemResponse[]
}

export interface SharePreviewResponse {
  type: string
  title: string
  subtitle: string
  summary: string
  metrics: ShareMetricResponse[]
  items: ShareItemResponse[]
  privacyNote: string
  copyText: string
  visualTitle?: string
  visualSubtitle?: string
  sections?: ShareSectionResponse[]
}

export function fetchWorkoutSharePreview(trainingId: number | string) {
  return request<SharePreviewResponse>({
    url: `/api/share/preview/workouts/${trainingId}`
  })
}

export function fetchWeeklyReviewSharePreview(weekStart: string) {
  return request<SharePreviewResponse>({
    url: `/api/share/preview/weekly-review?weekStart=${encodeURIComponent(weekStart)}`
  })
}

export function fetchPlanSharePreview(planId: number | string) {
  return request<SharePreviewResponse>({
    url: `/api/share/preview/plans/${planId}`
  })
}

export function fetchPlanDaySharePreview(planId: number | string, dayId: number | string) {
  return request<SharePreviewResponse>({
    url: `/api/share/preview/plans/${planId}/days/${dayId}`
  })
}

export function fetchTemplateSharePreview(templateId: number | string) {
  return request<SharePreviewResponse>({
    url: `/api/share/preview/templates/${templateId}`
  })
}
