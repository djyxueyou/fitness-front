import { request } from '@/api/http'
import type { TrainingLevelSettlementResponse } from '@/api/training-level'

interface PageResponse<T> {
  total: number
  pageNo: number
  pageSize: number
  list: T[]
}

export interface TrainingHistoryItemResponse {
  id: number
  templateId?: number
  trainingName: string
  templateName?: string
  coverUrl?: string
  coverRecordType?: string
  startedAt: string
  endedAt: string
  durationSeconds: number
  totalExerciseCount: number
  totalSetCount: number
  totalVolumeKg: number
}

export interface TrainingSetResponse {
  setNumber: number
  weightKg: number
  reps: number
  durationSeconds?: number
  volumeKg: number
}

export interface TrainingItemDetailResponse {
  exerciseId: number
  exerciseName: string
  primaryMuscle?: string
  equipment?: string
  recordType?: 'WEIGHT_REPS' | 'BODYWEIGHT_REPS' | 'DURATION' | string
  sortOrder: number
  targetSets: number
  completedSets: number
  totalVolumeKg?: number
  maxWeightKg?: number
  previousVolumeKg?: number | null
  volumeDeltaKg?: number | null
  previousMaxWeightKg?: number | null
  maxWeightDeltaKg?: number | null
  firstRecord?: boolean
  thumbnailSource?: string
  thumbnailPath?: string
  thumbnailUrl?: string
  sets: TrainingSetResponse[]
}

export interface TrainingDetailResponse {
  id: number
  templateId?: number
  templateName?: string
  trainingName: string
  startedAt: string
  endedAt: string
  durationSeconds: number
  totalExerciseCount: number
  totalSetCount: number
  totalVolumeKg: number
  note?: string
  prs?: TrainingPrResponse[]
  items: TrainingItemDetailResponse[]
}

export interface TrainingReportItemResponse {
  exerciseId: number
  exerciseName: string
  recordType?: 'WEIGHT_REPS' | 'BODYWEIGHT_REPS' | 'DURATION' | string
  completedSets: number
  totalReps: number
  totalDurationSeconds: number
  totalVolumeKg: number
  maxWeightKg: number
  previousVolumeKg?: number | null
  volumeDeltaKg?: number | null
  previousMaxWeightKg?: number | null
  maxWeightDeltaKg?: number | null
  firstRecord?: boolean
  prs: TrainingPrResponse[]
}

export interface TrainingReportResponse {
  trainingId: number
  trainingName: string
  durationSeconds: number
  totalExerciseCount: number
  totalSetCount: number
  totalVolumeKg: number
  prCount: number
  items: TrainingReportItemResponse[]
}

export interface TrainingCalendarDayResponse {
  trainingDate: string
  sessionCount: number
  totalVolumeKg: number
}

export interface TrainingStatsSummaryResponse {
  totalSessions: number
  totalVolumeKg: number
  totalDurationSeconds: number
  lastTrainingAt?: string
}

export interface HomeWeeklyRhythmResponse {
  weekStart: string
  weekEnd: string
  sessionCount: number
  totalVolumeKg: number
  totalDurationSeconds: number
  trainedDates: string[]
}

export interface ExerciseLastPerformanceSetResponse {
  setNumber: number
  weightKg: number
  reps: number
  durationSeconds?: number
  volumeKg: number
}

export interface ExerciseLastPerformanceResponse {
  exerciseId: number
  exerciseName?: string
  lastTrainingAt?: string
  sets: ExerciseLastPerformanceSetResponse[]
  bestWeightKg: number
  bestVolumeKg: number
  bestDurationSeconds?: number
}

export interface SaveTrainingSetRequest {
  weightKg?: number
  reps?: number
  durationSeconds?: number
  setType?: 'NORMAL' | 'WARMUP' | 'DROP' | 'FAILURE'
  effort?: 'RIR_4_PLUS' | 'RIR_2_3' | 'RIR_1' | 'RIR_0' | 'FAILED'
  plannedWeightKg?: number
  plannedReps?: number
  plannedDurationSeconds?: number
  targetSource?: 'PLAN' | 'TEMPLATE' | 'LAST_PERFORMANCE' | 'PROGRESSION_RECOMMENDATION' | 'MANUAL'
  sourceRecommendationId?: string
}

export interface SaveTrainingItemRequest {
  exerciseId: number
  targetSets?: number
  restSeconds?: number
  sets: SaveTrainingSetRequest[]
}

export interface SaveTrainingRequest {
  templateId?: number | null
  executionId?: number | null
  executionDayId?: number | null
  sourceType?: 'FREE' | 'USER_TEMPLATE' | 'SYSTEM_EXECUTION' | 'USER_PLAN_EXECUTION' | string
  userTemplateId?: number | null
  sourceSystemPlanId?: number | null
  sourceUserPlanDefinitionId?: number | null
  clientRequestId?: string
  trainingName: string
  startedAt: string
  endedAt: string
  durationSeconds?: number
  pausedSeconds?: number
  suspendedSeconds?: number
  note?: string
  items: SaveTrainingItemRequest[]
}

export interface SaveTrainingResponse {
  trainingId: number
  durationSeconds: number
  totalExerciseCount: number
  totalSetCount: number
  totalVolumeKg: number
  prCount?: number
  prs?: TrainingPrResponse[]
  levelSettlement?: TrainingLevelSettlementResponse | null
}

export interface TrainingPrResponse {
  exerciseId: number
  exerciseName: string
  prType: 'MAX_WEIGHT' | 'MAX_REPS' | 'MAX_VOLUME' | 'MAX_DURATION' | string
  value: number
  previousValue?: number | null
  delta?: number | null
}

export function fetchTrainingHistory(params?: {
  pageNo?: number
  pageSize?: number
  startedFrom?: string
  startedTo?: string
}) {
  return request<PageResponse<TrainingHistoryItemResponse>>({
    url: '/api/trainings',
    method: 'GET',
    data: params || {}
  })
}

export function fetchTrainingDetail(id: number) {
  return request<TrainingDetailResponse>({
    url: `/api/trainings/${id}`,
    method: 'GET'
  })
}

export function fetchTrainingReport(id: number) {
  return request<TrainingReportResponse>({
    url: `/api/trainings/${id}/report`,
    method: 'GET'
  })
}

export function saveTraining(payload: SaveTrainingRequest) {
  return request<SaveTrainingResponse>({
    url: '/api/trainings',
    method: 'POST',
    data: payload,
    timeoutMs: 60000
  })
}

export function updateTraining(id: number, payload: SaveTrainingRequest) {
  return request<SaveTrainingResponse>({
    url: `/api/trainings/${id}`,
    method: 'PUT',
    data: payload,
    timeoutMs: 60000
  })
}

export function deleteTraining(id: number) {
  return request<void>({
    url: `/api/trainings/${id}`,
    method: 'DELETE',
    timeoutMs: 30000
  })
}

export function fetchTrainingCalendar(params: { year: number; month: number }) {
  return request<TrainingCalendarDayResponse[]>({
    url: '/api/trainings/calendar',
    method: 'GET',
    data: params
  })
}

export function fetchTrainingSummary(params?: { startedFrom?: string; startedTo?: string }) {
  return request<TrainingStatsSummaryResponse>({
    url: '/api/trainings/stats/summary',
    method: 'GET',
    data: params || {}
  })
}

export function fetchHomeWeeklyRhythm() {
  return request<HomeWeeklyRhythmResponse>({
    url: '/api/trainings/home/weekly-rhythm',
    method: 'GET'
  })
}

export function fetchExerciseLastPerformance(exerciseId: number) {
  return request<ExerciseLastPerformanceResponse>({
    url: `/api/trainings/exercises/${exerciseId}/last-performance`,
    method: 'GET'
  })
}

export function fetchExerciseLastPerformances(exerciseIds: number[]) {
  const ids = Array.from(new Set(exerciseIds.filter((id) => Number.isFinite(id) && id > 0)))
  if (!ids.length) {
    return Promise.resolve([])
  }
  return request<ExerciseLastPerformanceResponse[]>({
    url: '/api/trainings/exercises/last-performances',
    method: 'GET',
    data: {
      exerciseIds: ids.join(',')
    }
  })
}
