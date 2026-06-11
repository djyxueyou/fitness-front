import { request } from '@/api/http'

export interface CultivationStateResponse {
  totalExp: number
  levelIndex: number
  realmName: string
  stageName: string
  currentLevelExp: number
  nextLevelExp: number
  progressPercent: number
  realmCode?: string
  stageCode?: string
  themeColor?: string
  accentColor?: string
  auraName?: string
  avatarSymbol?: string
  visualKey?: string
}

export interface CultivationProfileResponse extends CultivationStateResponse {
  realmCode: string
  stageCode: string
  currentStreakDays: number
  rankingEnabled: boolean
  themeColor: string
  accentColor: string
  auraName: string
  avatarSymbol: string
  visualKey: string
}

export interface CultivationSettlementResponse {
  eligible: boolean
  granted: boolean
  upgraded: boolean
  message: string
  baseExp: number
  durationBonusExp: number
  streakBonusExp: number
  totalExp: number
  before: CultivationStateResponse
  after: CultivationStateResponse
}

export function fetchCultivationProfile() {
  return request<CultivationProfileResponse>({
    url: '/api/cultivation/profile',
    method: 'GET'
  })
}

export function settleTrainingCultivation(trainingId: number) {
  return request<CultivationSettlementResponse>({
    url: `/api/cultivation/trainings/${trainingId}/settlement`,
    method: 'POST',
    timeoutMs: 30000
  })
}
