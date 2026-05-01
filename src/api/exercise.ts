import { request } from '@/api/http'

export interface ExerciseSummary {
  id: number
  name: string
  categoryCode: string
  categoryName: string
  primaryMuscle: string
  equipment: string
  difficultyLevel: string
  thumbnailSource?: string
  thumbnailPath?: string
  thumbnailUrl?: string
  favorited?: boolean
}

export interface ExerciseDetail extends ExerciseSummary {
  instructionText?: string
  commonMistakesText?: string
  checklistText?: string
  mediaSource: string
  mediaPath: string
  mediaUrl?: string
  mediaSizeBytes?: number
  mediaWidth?: number
  mediaHeight?: number
}

export interface ExerciseCategory {
  categoryCode: string
  categoryName: string
  exerciseCount: number
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

function cleanQuery(params?: {
  categoryCode?: string
  keyword?: string
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
