import { request } from '@/api/http'

export interface TrainingProfileResponse {
  goal?: string
  experienceLevel?: string
  sessionsPerWeek?: number
  sessionDurationMinutes?: number
  environment?: string
  limitations?: string
  currentStep: number
  completed: boolean
}

export interface RecommendedPlanResponse {
  planId: number
  planName: string
  score: number
  reasons: string[]
  recommendedActivationMode: 'THIS_WEEK' | 'NEXT_WEEK'
}

export function fetchTrainingProfile() {
  return request<TrainingProfileResponse>({
    url: '/api/user/training-profile',
    method: 'GET'
  })
}

export function saveTrainingProfile(payload: TrainingProfileResponse) {
  return request<TrainingProfileResponse>({
    url: '/api/user/training-profile',
    method: 'PUT',
    data: payload
  })
}

export function fetchRecommendedPlans() {
  return request<RecommendedPlanResponse[]>({
    url: '/api/user/plans/recommended',
    method: 'GET'
  })
}
