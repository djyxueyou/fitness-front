import { request } from '@/api/http'

export interface ExerciseSummary {
  id: number
  name: string
  categoryCode: string
  categoryName: string
  primaryMuscleCode?: string
  primaryMuscleName?: string
  primaryMuscle?: string
  secondaryMuscles?: string[]
  equipmentCode?: string
  equipmentName?: string
  equipment?: string
  equipmentDetail?: string
  difficultyCode?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | string
  difficultyName?: string
  difficultyLevel?: string
  recordType?: 'WEIGHT_REPS' | 'BODYWEIGHT_REPS' | 'DURATION' | string
  searchKeywords?: string
  exerciseType?: 'SYSTEM' | 'USER' | string
  thumbnailSource?: string
  thumbnailPath?: string
  thumbnailUrl?: string
  isVariant?: number
  variantOfExerciseId?: number
  progressionLevel?: number
  favorited?: boolean
}

export interface ExerciseDetail extends ExerciseSummary {
  secondaryMuscles?: string[]
  instructionText?: string
  formCuesText?: string
  mediaSource: string
  mediaPath?: string
  mediaUrl?: string
  mediaSizeBytes?: number
  mediaWidth?: number
  mediaHeight?: number
  alternativeExerciseIds?: number[]
  planningTagsJson?: string
  sourceReferenceUrl?: string
  contentReviewStatus?: 'DRAFT' | 'REVIEWED' | string
  recordTypeLocked?: boolean
}

export interface ExerciseCategory {
  categoryCode: string
  categoryName: string
  exerciseCount: number
}

export interface ExerciseFilterMetadata {
  equipment: Array<{ value: string; label: string }>
  difficulty: Array<{ value: string; label: string }>
  recordTypes: Array<{ value: string; label: string }>
}

interface PageResponse<T> {
  total: number
  pageNo: number
  pageSize: number
  list: T[]
}

export interface FavoriteStatusResponse {
  favorited: boolean
}

export interface CreateCustomExerciseRequest {
  name: string
  categoryCode?: string
  categoryName?: string
  primaryMuscleCode?: string
  primaryMuscleName?: string
  equipmentCode?: string
  equipmentName?: string
  equipmentDetail?: string
  difficultyCode?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | string
  difficultyName?: string
  recordType?: 'WEIGHT_REPS' | 'BODYWEIGHT_REPS' | 'DURATION' | string
}

export interface CreateCustomExerciseResponse extends ExerciseSummary {
  recordTypeLocked: boolean
}

export interface UpdateCustomExerciseRequest extends CreateCustomExerciseRequest {}

function cleanQuery(params?: {
  categoryCode?: string
  keyword?: string
  scope?: string
  primaryMuscleCode?: string
  equipmentCode?: string
  difficultyCode?: string
  recordType?: string
  pageNo?: number
  pageSize?: number
}) {
  if (!params) return {}
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  )
}

export function fetchExerciseList(params?: {
  categoryCode?: string
  keyword?: string
  scope?: 'ALL' | 'SYSTEM' | 'CUSTOM'
  primaryMuscleCode?: string
  equipmentCode?: string
  difficultyCode?: string
  recordType?: string
  pageNo?: number
  pageSize?: number
}) {
  return request<PageResponse<ExerciseSummary>>({
    url: '/api/exercises',
    method: 'GET',
    data: cleanQuery(params)
  })
}

export function fetchExerciseDetail(id: number) {
  return request<ExerciseDetail>({
    url: `/api/exercises/${id}`,
    method: 'GET'
  })
}

export function fetchExerciseCategories() {
  return request<ExerciseCategory[]>({
    url: '/api/exercises/categories',
    method: 'GET',
    withAuth: false
  })
}

export function fetchExerciseFilterMetadata() {
  return request<ExerciseFilterMetadata>({
    url: '/api/exercises/filter-metadata',
    method: 'GET',
    withAuth: false
  })
}

export function favoriteExercise(id: number) {
  return request<FavoriteStatusResponse>({
    url: `/api/exercises/favorite/${id}`,
    method: 'POST'
  })
}

export function unfavoriteExercise(id: number) {
  return request<FavoriteStatusResponse>({
    url: `/api/exercises/favorite/${id}`,
    method: 'DELETE'
  })
}

export function fetchFavoriteExercises() {
  return request<ExerciseSummary[]>({
    url: '/api/exercises/favorites',
    method: 'GET'
  })
}

export function createCustomExercise(payload: CreateCustomExerciseRequest) {
  return request<CreateCustomExerciseResponse>({
    url: '/api/exercises/custom',
    method: 'POST',
    data: payload,
    timeoutMs: 30000
  })
}

export function updateCustomExercise(id: number, payload: UpdateCustomExerciseRequest) {
  return request<CreateCustomExerciseResponse>({
    url: `/api/exercises/custom/${id}`,
    method: 'PUT',
    data: payload,
    timeoutMs: 30000
  })
}

export function deleteCustomExercise(id: number) {
  return request<void>({
    url: `/api/exercises/custom/${id}`,
    method: 'DELETE',
    timeoutMs: 30000
  })
}
