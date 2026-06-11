import { request } from '@/api/http'

export interface TrainingPlanListItemResponse {
  id: number
  name: string
  planType: 'SYSTEM' | 'USER' | string
  goal?: string
  difficultyLevel?: string
  cycleWeeks: number
  active: boolean
  lastExecutionStatus?: string
  canReactivate?: boolean
}

export interface TrainingPlanDayResponse {
  id: number
  weekIndex: number
  dayOfWeek: number
  title: string
  templateId: number
  templateName?: string
  sortOrder: number
  scheduledDate?: string
  status?:
    | 'NOT_STARTED'
    | 'UPCOMING'
    | 'TODAY_PENDING'
    | 'OVERDUE'
    | 'COMPLETED'
    | 'COMPLETED_EARLY'
    | 'COMPLETED_LATE'
    | 'SKIPPED'
    | 'NOT_APPLICABLE'
    | string
  actionType?: 'NONE' | 'START_EARLY' | 'START' | 'MAKE_UP' | 'RESTORE' | 'VIEW_RECORD' | string
  completed?: boolean
  completedTrainingId?: number
  completedAt?: string
}

export interface TrainingPlanDetailResponse {
  id: number
  name: string
  planType: 'SYSTEM' | 'USER' | string
  goal?: string
  difficultyLevel?: string
  cycleWeeks: number
  active: boolean
  userTrainingPlanId?: number
  executionStatus?: 'SCHEDULED' | 'ACTIVE' | 'FINISHING' | 'COMPLETED' | 'STOPPED' | 'REPLACED' | string
  currentWeek?: number
  scheduleStartDate?: string
  scheduleEndDate?: string
  days: TrainingPlanDayResponse[]
}

export interface PlanRecommendationResponse {
  type:
    | 'PLAN_TODAY'
    | 'PLAN_TODAY_COMPLETED'
    | 'PLAN_PENDING'
    | 'PLAN_REST'
    | 'PLAN_COMPLETED'
    | 'SMART_TEMPLATE'
    | 'PLAN_ONBOARDING'
    | string
  title: string
  subtitle: string
  reason?: string
  templateId?: number
  planId?: number
  planName?: string
  planDayId?: number
  weekIndex?: number
  dayOfWeek?: number
}

export interface ActivePlanSummaryResponse {
  userTrainingPlanId: number
  planId: number
  planName: string
  executionStatus: string
  weekIndex: number
  cycleWeeks: number
  totalDays: number
  completedTotal: number
  scheduledThisWeek: number
  completedThisWeek: number
  skippedThisWeek: number
  overdueCount: number
  remainingThisWeek: number
  todayStatus?: string
  nextPlanDayId?: number
  nextDayOfWeek?: number
  nextTitle?: string
  scheduleStartDate?: string
  scheduleEndDate?: string
  nextScheduledDate?: string
}

export interface UpdateTrainingPlanRequest {
  name: string
  goal?: string
  difficultyLevel?: string
  cycleWeeks?: number
}

export interface CreateTrainingPlanRequest extends UpdateTrainingPlanRequest {
  cycleWeeks: number
}

export interface PlanActivationOptionResponse {
  mode: 'THIS_WEEK' | 'NEXT_WEEK'
  scheduleStartDate: string
  firstTrainingDate?: string
  remainingTrainingDays: number
  notApplicableDays: number
  recommended: boolean
}

export interface UpdateTrainingPlanDayRequest {
  title: string
  weekIndex: number
  dayOfWeek: number
  templateId: number
  sortOrder?: number
}

export interface CreateTrainingPlanDayRequest extends UpdateTrainingPlanDayRequest {
  clientRequestId: string
}

export function fetchTrainingPlans(scope: 'all' | 'system' | 'mine' = 'all') {
  return request<TrainingPlanListItemResponse[]>({
    url: `/api/plans?scope=${encodeURIComponent(scope)}`,
    method: 'GET'
  })
}

export function fetchTrainingPlanDetail(id: number) {
  return request<TrainingPlanDetailResponse>({
    url: `/api/plans/${id}`,
    method: 'GET'
  })
}

export function copyTrainingPlan(id: number) {
  return request<TrainingPlanDetailResponse>({
    url: `/api/plans/${id}/copy`,
    method: 'POST',
    timeoutMs: 30000
  })
}

export function createTrainingPlan(payload: CreateTrainingPlanRequest) {
  return request<TrainingPlanDetailResponse>({
    url: '/api/plans',
    method: 'POST',
    data: payload,
    timeoutMs: 30000
  })
}

export function fetchPlanActivationOptions(id: number) {
  return request<PlanActivationOptionResponse[]>({
    url: `/api/user/plans/${id}/activation-options`,
    method: 'GET'
  })
}

export function activateTrainingPlan(id: number, mode: 'THIS_WEEK' | 'NEXT_WEEK' = 'THIS_WEEK') {
  return request<void>({
    url: `/api/user/plans/${id}/activate`,
    method: 'POST',
    data: { mode },
    timeoutMs: 30000
  })
}

export function deactivateActiveTrainingPlan() {
  return request<void>({
    url: '/api/user/plans/active/deactivate',
    method: 'POST',
    timeoutMs: 30000
  })
}

export function updateTrainingPlan(id: number, payload: UpdateTrainingPlanRequest) {
  return request<TrainingPlanDetailResponse>({
    url: `/api/plans/${id}`,
    method: 'PUT',
    data: payload,
    timeoutMs: 30000
  })
}

export function deleteTrainingPlan(id: number) {
  return request<void>({
    url: `/api/plans/${id}`,
    method: 'DELETE',
    timeoutMs: 30000
  })
}

export function createTrainingPlanDay(id: number, payload: CreateTrainingPlanDayRequest) {
  return request<TrainingPlanDetailResponse>({
    url: `/api/plans/${id}/days`,
    method: 'POST',
    data: payload,
    timeoutMs: 30000
  })
}

export function updateTrainingPlanDay(
  id: number,
  dayId: number,
  payload: UpdateTrainingPlanDayRequest
) {
  return request<TrainingPlanDetailResponse>({
    url: `/api/plans/${id}/days/${dayId}`,
    method: 'PUT',
    data: payload,
    timeoutMs: 30000
  })
}

export function deleteTrainingPlanDay(id: number, dayId: number) {
  return request<TrainingPlanDetailResponse>({
    url: `/api/plans/${id}/days/${dayId}`,
    method: 'DELETE',
    timeoutMs: 30000
  })
}

export function fetchActiveTrainingPlan() {
  return request<TrainingPlanDetailResponse | null>({
    url: '/api/user/plans/active',
    method: 'GET'
  })
}

export function fetchActiveTrainingPlanSummary() {
  return request<ActivePlanSummaryResponse | null>({
    url: '/api/user/plans/active/summary',
    method: 'GET'
  })
}

export function fetchTodayPlanRecommendation() {
  return request<PlanRecommendationResponse>({
    url: '/api/user/plans/recommendation/today',
    method: 'GET'
  })
}

export function skipActiveTrainingPlanDay(dayId: number) {
  return request<void>({
    url: `/api/user/plans/active/days/${dayId}/skip`,
    method: 'POST'
  })
}

export function unskipActiveTrainingPlanDay(dayId: number) {
  return request<void>({
    url: `/api/user/plans/active/days/${dayId}/skip`,
    method: 'DELETE'
  })
}

export function finishActiveTrainingPlan() {
  return request<void>({
    url: '/api/user/plans/active/finish',
    method: 'POST'
  })
}
