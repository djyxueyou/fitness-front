import { request } from '@/api/http'

export interface ExerciseProgressionRecommendation {
  available: boolean
  locked: boolean
  recommendationId?: string
  ruleVersion: string
  action:
    | 'NONE'
    | 'MAINTAIN'
    | 'INCREASE_WEIGHT'
    | 'REDUCE_WEIGHT'
    | 'INCREASE_REPS'
    | 'INCREASE_DURATION'
  reasonCode: string
  reasonText: string
  targetText?: string
  effectText?: string
  secondaryActionText?: string
  primaryActionText?: string
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  targetWeightKg?: number
  targetReps?: number
  targetDurationSeconds?: number
  evidence: Array<{ recordItemId: number; label: string }>
}

export function fetchProgressionRecommendation(exerciseId: number) {
  return request<ExerciseProgressionRecommendation>({
    url: `/api/trainings/exercises/${exerciseId}/progression-recommendation`,
    method: 'GET'
  })
}

export function sendProgressionRecommendationFeedback(
  exerciseId: number,
  recommendationId: string,
  action: 'APPLIED' | 'DISMISSED' | 'OVERRIDDEN'
) {
  return request<void>({
    url: `/api/trainings/exercises/${exerciseId}/progression-recommendation/feedback`,
    method: 'POST',
    data: { recommendationId, action }
  })
}
