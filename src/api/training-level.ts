import { request } from '@/api/http'

export interface TrainingLevelStateResponse {
  totalExp: number
  level: number
  stageCode: string
  stageName: string
  badgeCode: string
  badgeName: string
  currentLevelExp: number
  nextLevelExp: number
  progressPercent: number
  themeColor: string
  accentColor: string
}

export interface TrainingLevelProfileResponse extends TrainingLevelStateResponse {
  rankingEnabled: boolean
}

export interface TrainingLevelSettlementResponse {
  trainingId: number
  eligible: boolean
  alreadySettled: boolean
  expGained: number
  baseExp: number
  completedWorkingSets: number
  planBonusExp: number
  prBonusExp: number
  reason: string
  message: string
  upgraded: boolean
  before: TrainingLevelStateResponse | null
  after: TrainingLevelStateResponse | null
}

export function fetchTrainingLevelProfile() {
  return request<TrainingLevelProfileResponse>({
    url: '/api/training-level/profile',
    method: 'GET'
  })
}

export function settleTrainingLevel(trainingId: number) {
  return request<TrainingLevelSettlementResponse>({
    url: `/api/training-level/trainings/${trainingId}/settlement`,
    method: 'POST',
    timeoutMs: 30000
  })
}
