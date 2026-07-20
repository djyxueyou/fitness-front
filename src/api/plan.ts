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
  executionId?: number
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
  definitionId?: number
  planName?: string
  executionDayId?: number
  weekIndex?: number
  dayOfWeek?: number
}

export interface ActivePlanSummaryResponse {
  sourceType?: 'SYSTEM_PLAN_EXECUTION' | 'USER_PLAN_EXECUTION' | string
  executionId?: number | null
  definitionId: number
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

export interface SystemPlanListItemResponse {
  id: number
  name: string
  subtitle?: string
  goal?: string
  difficultyLevel?: string
  cycleWeeks: number
  minWeeklyFrequency: number
  maxWeeklyFrequency: number
  collectionCodes: string[]
  supportedEquipment: Array<'GYM' | 'DUMBBELL' | 'BODYWEIGHT'>
  supportedDurations: Array<20 | 35 | 50>
}

export interface SystemPlanBlueprintSummaryResponse {
  blueprintId: number
  name: string
  description?: string
  estimatedMinutes?: number
}

export interface SystemPlanDetailResponse {
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
  defaultWeeklyFrequency: number
  collectionCodes: string[]
  supportedEquipment: Array<'GYM' | 'DUMBBELL' | 'BODYWEIGHT'>
  defaultEquipment: 'GYM' | 'DUMBBELL' | 'BODYWEIGHT'
  supportedDurations: Array<20 | 35 | 50>
  defaultDurationMinutes: 20 | 35 | 50
  safetyNotes?: string
  blueprints: SystemPlanBlueprintSummaryResponse[]
}

export interface SystemPlanCustomizationRequest {
  weeklyFrequency: number
  unavailableBodyParts: string[]
  equipment: 'GYM' | 'DUMBBELL' | 'BODYWEIGHT'
  durationMinutes: 20 | 35 | 50
  restSecondsByExerciseId?: Record<number, number>
  restSecondsByOccurrence?: Record<string, number>
}

export interface SystemPlanPreviewItemResponse {
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

export interface SystemPlanPreviewDayResponse {
  sourceBlueprintDayId?: number
  blueprintId?: number
  weekIndex: number
  dayOfWeek: number
  title: string
  phaseLabel?: string
  frequencyBucket?: string
  items: SystemPlanPreviewItemResponse[]
}

export interface SystemPlanPreviewResponse {
  systemPlanId: number
  displayName: string
  weeklyFrequency: number
  durationMinutes: number
  days: SystemPlanPreviewDayResponse[]
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
  savedDefinitionId?: number | null
  planName: string
  status: 'SCHEDULED' | 'ACTIVE' | 'FINISHING' | 'COMPLETED' | 'STOPPED' | 'REPLACED' | string
  currentWeek: number
  cycleWeeks: number
  scheduleStartDate: string
  scheduleEndDate: string
  days: ActiveExecutionDayResponse[]
}

export interface PlanWorkoutSnapshotResponse {
  planName: string
  definitionId: number
  definitionDayId: number
  title: string
  weekIndex: number
  dayOfWeek: number
  items: ActiveExecutionItemResponse[]
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

export function fetchTrainingPlans() {
  return request<TrainingPlanListItemResponse[]>({
    url: '/api/user-plans',
    method: 'GET'
  })
}

export function fetchSystemPlans(params?: {
  collection?: string
  goal?: string
  difficulty?: string
}) {
  const query: string[] = []
  if (params?.collection) query.push(`collection=${encodeURIComponent(params.collection)}`)
  if (params?.goal) query.push(`goal=${encodeURIComponent(params.goal)}`)
  if (params?.difficulty) query.push(`difficulty=${encodeURIComponent(params.difficulty)}`)
  const suffix = query.join('&')
  return request<SystemPlanListItemResponse[]>({
    url: `/api/system-plans${suffix ? `?${suffix}` : ''}`,
    method: 'GET',
    withAuth: false
  })
}

export function fetchSystemPlanDetail(id: number) {
  return request<SystemPlanDetailResponse>({
    url: `/api/system-plans/${id}`,
    method: 'GET',
    withAuth: false
  })
}

export function previewSystemPlan(id: number, data: SystemPlanCustomizationRequest) {
  return request<SystemPlanPreviewResponse>({
    url: `/api/system-plans/${id}/preview`,
    method: 'POST',
    data,
    timeoutMs: 30000
  })
}

export function activateSystemPlan(id: number, data: SystemPlanCustomizationRequest) {
  return request<ActivePlanSummaryResponse>({
    url: `/api/system-plans/${id}/activate`,
    method: 'POST',
    data,
    timeoutMs: 30000
  })
}

export function fetchTrainingPlanDetail(id: number) {
  return request<TrainingPlanDetailResponse>({
    url: `/api/user-plans/${id}`,
    method: 'GET'
  })
}

export function fetchPlanDayWorkout(id: number, dayId: number) {
  return request<PlanWorkoutSnapshotResponse>({
    url: `/api/user-plans/${id}/days/${dayId}/workout`,
    method: 'GET'
  })
}

export function copyTrainingPlan(id: number) {
  return request<TrainingPlanDetailResponse>({
    url: `/api/user-plans/${id}/copy`,
    method: 'POST',
    timeoutMs: 30000
  })
}

export function createTrainingPlan(payload: CreateTrainingPlanRequest) {
  return request<TrainingPlanDetailResponse>({
    url: '/api/user-plans',
    method: 'POST',
    data: payload,
    timeoutMs: 30000
  })
}

export function fetchPlanActivationOptions(id: number) {
  return request<PlanActivationOptionResponse[]>({
    url: `/api/user-plans/${id}/activation-options`,
    method: 'GET'
  })
}

export function activateTrainingPlan(id: number, mode: 'THIS_WEEK' | 'NEXT_WEEK' = 'THIS_WEEK') {
  return request<void>({
    url: `/api/user-plans/${id}/activate`,
    method: 'POST',
    data: { mode },
    timeoutMs: 30000
  })
}

export function deactivateActiveTrainingPlan() {
  return request<void>({
    url: '/api/plan-executions/active/deactivate',
    method: 'POST',
    timeoutMs: 30000
  })
}

export function updateTrainingPlan(id: number, payload: UpdateTrainingPlanRequest) {
  return request<TrainingPlanDetailResponse>({
    url: `/api/user-plans/${id}`,
    method: 'PUT',
    data: payload,
    timeoutMs: 30000
  })
}

export function deleteTrainingPlan(id: number) {
  return request<void>({
    url: `/api/user-plans/${id}`,
    method: 'DELETE',
    timeoutMs: 30000
  })
}

export function createTrainingPlanDay(id: number, payload: CreateTrainingPlanDayRequest) {
  return request<TrainingPlanDetailResponse>({
    url: `/api/user-plans/${id}/days`,
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
    url: `/api/user-plans/${id}/days/${dayId}`,
    method: 'PUT',
    data: payload,
    timeoutMs: 30000
  })
}

export function deleteTrainingPlanDay(id: number, dayId: number) {
  return request<TrainingPlanDetailResponse>({
    url: `/api/user-plans/${id}/days/${dayId}`,
    method: 'DELETE',
    timeoutMs: 30000
  })
}

function fetchActivePlanEndpoint() {
  return request<ActiveExecutionResponse | null>({
    url: '/api/plan-executions/active',
    method: 'GET'
  })
}

export async function fetchActivePlanExecution() {
  return fetchActivePlanEndpoint()
}

export function savePlanExecutionAsMyPlan(executionId: number) {
  return request<TrainingPlanDetailResponse>({
    url: `/api/plan-executions/${executionId}/save-as-my-plan`,
    method: 'POST',
    timeoutMs: 30000
  })
}

export function fetchActiveTrainingPlanSummary() {
  return request<ActivePlanSummaryResponse | null>({
    url: '/api/plan-executions/active/summary',
    method: 'GET'
  })
}

export function fetchTodayPlanRecommendation() {
  return request<PlanRecommendationResponse>({
    url: '/api/plan-executions/today-guidance',
    method: 'GET'
  })
}

export function skipActiveTrainingPlanDay(dayId: number) {
  return request<void>({
    url: `/api/plan-executions/active/days/${dayId}/skip`,
    method: 'POST'
  })
}

export function unskipActiveTrainingPlanDay(dayId: number) {
  return request<void>({
    url: `/api/plan-executions/active/days/${dayId}/skip`,
    method: 'DELETE'
  })
}

export function finishActiveTrainingPlan() {
  return request<void>({
    url: '/api/plan-executions/active/finish',
    method: 'POST'
  })
}
