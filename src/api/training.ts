import { request } from '@/api/http'

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
  volumeKg: number
}

export interface TrainingItemDetailResponse {
  exerciseId: number
  exerciseName: string
  primaryMuscle?: string
  equipment?: string
  sortOrder: number
  targetSets: number
  completedSets: number
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
  items: TrainingItemDetailResponse[]
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
  currentStreakDays: number
}

export interface ExerciseLastPerformanceSetResponse {
  setNumber: number
  weightKg: number
  reps: number
  volumeKg: number
}

export interface ExerciseLastPerformanceResponse {
  exerciseId: number
  exerciseName?: string
  lastTrainingAt?: string
  sets: ExerciseLastPerformanceSetResponse[]
  bestWeightKg: number
  bestVolumeKg: number
}

export interface SaveTrainingSetRequest {
  weightKg: number
  reps: number
}

export interface SaveTrainingItemRequest {
  exerciseId: number
  targetSets?: number
  sets: SaveTrainingSetRequest[]
}

export interface SaveTrainingRequest {
  templateId?: number | null
  trainingName: string
  startedAt: string
  endedAt: string
  note?: string
  items: SaveTrainingItemRequest[]
}

export interface SaveTrainingResponse {
  trainingId: number
  durationSeconds: number
  totalExerciseCount: number
  totalSetCount: number
  totalVolumeKg: number
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

export function fetchTrainingSummary() {
  return request<TrainingStatsSummaryResponse>({
    url: '/api/trainings/stats/summary',
    method: 'GET'
  })
}

export function fetchExerciseLastPerformance(exerciseId: number) {
  return request<ExerciseLastPerformanceResponse>({
    url: `/api/trainings/exercises/${exerciseId}/last-performance`,
    method: 'GET'
  })
}
