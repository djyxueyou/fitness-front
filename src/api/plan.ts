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
  executionStatus?:
    | 'SCHEDULED'
    | 'ACTIVE'
    | 'FINISHING'
    | 'COMPLETED'
    | 'STOPPED'
    | 'REPLACED'
    | string
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
  sourceType?: 'RECOMMENDED_EXECUTION' | 'MY_PLAN' | string
  userTrainingPlanId?: number | null
  executionId?: number | null
  planId: number
  sourceSystemPlanId?: number | null
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

export interface RecommendedPlanListItemResponse {
  id: number
  name: string
  subtitle?: string
  goal?: string
  difficultyLevel?: string
  cycleWeeks: number
  minWeeklyFrequency: number
  maxWeeklyFrequency: number
}

export interface RecommendedPlanBlueprintSummaryResponse {
  blueprintId: number
  name: string
  description?: string
  estimatedMinutes?: number
}

export interface RecommendedPlanIntroResponse {
  id: number
  name: string
  subtitle?: string
  description?: string
  targetUserText?: string
  goal?: string
  difficultyLevel?: string
  cycleWeeks: number
  minWeeklyFrequency: number
  maxWeeklyFrequency: number
  safetyNotes?: string
  blueprints: RecommendedPlanBlueprintSummaryResponse[]
}

export interface RecommendedPlanPersonalizationRequest {
  weeklyFrequency: number
  unavailableBodyParts: string[]
  equipment: 'GYM' | 'DUMBBELL' | 'BODYWEIGHT' | 'UNKNOWN'
  durationMinutes: 20 | 35 | 50
  restSecondsByExerciseId?: Record<number, number>
  restSecondsByOccurrence?: Record<string, number>
}

export interface RecommendedPlanPreviewItemResponse {
  exerciseId: number
  exerciseName: string
  movementPattern?: string
  sortOrder: number
  targetSets: number
  targetWeightKg?: number
  targetReps?: number
  targetDurationSeconds?: number
  plannedRestSeconds?: number
  targetSource: string
  replacedFromExerciseId?: number
  replacementReason?: string
  recordType?: 'WEIGHT_REPS' | 'BODYWEIGHT_REPS' | 'DURATION' | string
  thumbnailSource?: string
  thumbnailPath?: string
  thumbnailUrl?: string
}

export interface RecommendedPlanPreviewDayResponse {
  sourceBlueprintDayId?: number
  blueprintId?: number
  weekIndex: number
  dayOfWeek: number
  title: string
  frequencyBucket?: string
  items: RecommendedPlanPreviewItemResponse[]
}

export interface RecommendedPlanPreviewResponse {
  systemPlanId: number
  displayName: string
  weeklyFrequency: number
  durationMinutes: number
  days: RecommendedPlanPreviewDayResponse[]
  replacementSummary?: string
  warnings: string[]
}

export interface ActiveExecutionItemResponse {
  id: number
  exerciseId: number
  exerciseName: string
  primaryMuscle?: string
  equipment?: string
  recordType?: 'WEIGHT_REPS' | 'BODYWEIGHT_REPS' | 'DURATION' | string
  sortOrder: number
  targetSets?: number
  targetWeightKg?: number
  targetReps?: number
  targetDurationSeconds?: number
  plannedRestSeconds?: number
  replacedFromExerciseId?: number
  replacementReason?: string
  thumbnailSource?: string
  thumbnailPath?: string
  thumbnailUrl?: string
}

export interface ActiveExecutionDayResponse {
  id: number
  weekIndex: number
  dayOfWeek: number
  plannedDate: string
  title: string
  status: 'PENDING' | 'COMPLETED' | 'SKIPPED' | string
  displayStatus?: string
  actionType?: string
  canSkip?: boolean
  completedTrainingRecordId?: number
  completedAt?: string
  skippedAt?: string
  items: ActiveExecutionItemResponse[]
}

export interface ActiveExecutionResponse {
  executionId: number
  definitionId: number
  sourceSystemPlanId?: number
  planName: string
  status: 'SCHEDULED' | 'ACTIVE' | 'FINISHING' | 'COMPLETED' | 'STOPPED' | 'REPLACED' | string
  currentWeek: number
  cycleWeeks: number
  scheduleStartDate: string
  scheduleEndDate: string
  days: ActiveExecutionDayResponse[]
}

type ActivePlanEndpointResponse = TrainingPlanDetailResponse | ActiveExecutionResponse

function isActiveExecutionResponse(
  value: ActivePlanEndpointResponse | null
): value is ActiveExecutionResponse {
  return Boolean(value && typeof value === 'object' && 'executionId' in value)
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

export function fetchRecommendedPlans() {
  return request<RecommendedPlanListItemResponse[]>({
    url: '/api/recommended-plans',
    method: 'GET',
    withAuth: false
  })
}

export function fetchRecommendedPlanIntro(id: number) {
  return request<RecommendedPlanIntroResponse>({
    url: `/api/recommended-plans/${id}/intro`,
    method: 'GET',
    withAuth: false
  })
}

export function previewRecommendedPlan(id: number, data: RecommendedPlanPersonalizationRequest) {
  return request<RecommendedPlanPreviewResponse>({
    url: `/api/recommended-plans/${id}/personalization/preview`,
    method: 'POST',
    data,
    timeoutMs: 30000
  })
}

export function activateRecommendedPlan(id: number, data: RecommendedPlanPersonalizationRequest) {
  return request<ActivePlanSummaryResponse>({
    url: `/api/recommended-plans/${id}/personalization/activate`,
    method: 'POST',
    data,
    timeoutMs: 30000
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

function fetchActivePlanEndpoint() {
  return request<ActivePlanEndpointResponse | null>({
    url: '/api/user/plans/active',
    method: 'GET'
  })
}

export async function fetchActiveTrainingPlan() {
  const active = await fetchActivePlanEndpoint()
  return isActiveExecutionResponse(active) ? null : active
}

export async function fetchActivePlanExecution() {
  const active = await fetchActivePlanEndpoint()
  return isActiveExecutionResponse(active) ? active : null
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
