import { API_BASE_URL, getToken, request } from '@/api/http'

const USER_PROFILE_KEY = 'LIFTLOG_USER_PROFILE'

export interface UserProfileResponse {
  userId: number
  nickname: string
  avatarUrl?: string
  heightCm?: number
  trainingGoal?: string
  experienceLevel?: string
  currentWeightKg?: number
  weightUnit: 'kg' | 'lb' | string
  restSeconds: number
  weightStepKg: number
  weightStepLb: number
  repsStep: number
  durationStepSeconds: number
}

export interface UpdateUserProfileRequest {
  nickname?: string
  avatarUrl?: string
  heightCm?: number | null
  trainingGoal?: string | null
  experienceLevel?: string | null
}

export type BodyMetricType =
  | 'WEIGHT'
  | 'BODY_FAT'
  | 'WAIST'
  | 'CHEST'
  | 'HIP'
  | 'ARM'
  | 'THIGH'
  | 'RESTING_HEART_RATE'

export interface BodyMetricResponse {
  metricType: BodyMetricType | string
  value: number
  unit: string
  measuredAt: string
}

export interface BodyMetricHistoryDayResponse {
  measuredAt: string
  metrics: Array<{
    metricType: BodyMetricType | string
    label: string
    value: number
    unit: string
  }>
}

export interface BodyMetricHistoryPageResponse {
  items: BodyMetricHistoryDayResponse[]
  nextCursor?: string
  hasMore: boolean
}

export interface BodyMetricSummaryResponse {
  latestMeasuredAt?: string
  items: Array<{
    metricType: BodyMetricType | string
    label: string
    value: number
    unit: string
    measuredAt: string
    delta?: number | null
  }>
}

export interface BodyMetricTrendPoint {
  date: string
  value: number
  unit: string
  label: string
}

export interface UpsertBodyMetricRequest {
  metrics: Array<{
    metricType: BodyMetricType
    value: number
  }>
}

export interface AvatarUploadResponse {
  url: string
}

export interface UpdateUserSettingRequest {
  weightUnit: 'kg' | 'lb'
  restSeconds: number
  weightStepKg: number
  weightStepLb: number
  repsStep: number
  durationStepSeconds: number
}

export interface UserSummaryResponse {
  totalSessions: number
  totalVolumeKg: number
  lastTrainingAt?: string
  currentStreakDays: number
}

export function fetchUserProfile() {
  return request<UserProfileResponse>({
    url: '/api/user/profile',
    method: 'GET'
  })
}

export function updateUserProfile(payload: UpdateUserProfileRequest) {
  return request<void>({
    url: '/api/user/profile',
    method: 'PUT',
    data: payload
  })
}

export function fetchLatestBodyMetrics() {
  return request<BodyMetricResponse[]>({
    url: '/api/user/body-metrics/latest',
    method: 'GET'
  })
}

export function fetchBodyMetricSummary() {
  return request<BodyMetricSummaryResponse>({
    url: '/api/user/body-metrics/summary',
    method: 'GET'
  })
}

export function fetchBodyMetricHistory(
  options: {
    limit?: number
    cursor?: string
    metricType?: BodyMetricType | string
  } = {}
) {
  const data: {
    limit?: number
    cursor?: string
    metricType?: BodyMetricType | string
  } = {}
  if (options.limit !== undefined) {
    data.limit = options.limit
  }
  if (options.cursor) {
    data.cursor = options.cursor
  }
  if (options.metricType) {
    data.metricType = options.metricType
  }
  return request<BodyMetricHistoryPageResponse>({
    url: '/api/user/body-metrics/history',
    method: 'GET',
    data
  })
}

export async function fetchBodyMetricTrend(metricType: BodyMetricType, limit = 30) {
  const page = await fetchBodyMetricHistory({
    limit: Math.min(Math.max(limit, 1), 90),
    metricType
  })
  return page.items
    .flatMap((day) =>
      day.metrics
        .filter((metric) => metric.metricType === metricType)
        .map((metric) => ({
          date: day.measuredAt,
          value: Number(metric.value),
          unit: metric.unit,
          label: metric.label || metric.metricType
        }))
    )
    .filter((point): point is BodyMetricTrendPoint => Number.isFinite(point.value))
    .reverse()
}

export function updateBodyMetrics(payload: UpsertBodyMetricRequest) {
  return request<void>({
    url: '/api/user/body-metrics',
    method: 'PUT',
    data: payload
  })
}

export async function uploadAvatar(filePath: string) {
  const token = getToken()
  const result = await new Promise<UniApp.UploadFileSuccessCallbackResult>((resolve, reject) => {
    uni.uploadFile({
      url: `${API_BASE_URL}/api/user/avatar`,
      filePath,
      name: 'file',
      header: token ? { satoken: token } : undefined,
      success: resolve,
      fail: reject
    })
  })
  const body = JSON.parse(String(result.data)) as {
    code: number
    message: string
    data: AvatarUploadResponse
  }
  if (result.statusCode >= 400 || body.code !== 0) {
    throw new Error(body.message || '头像上传失败')
  }
  const url = body.data.url
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`
}

export function resolveAvatarUrl(avatarUrl?: string) {
  if (!avatarUrl) return ''
  if (avatarUrl.startsWith('/')) return `${API_BASE_URL}${avatarUrl}`
  return avatarUrl
}

export function updateUserSettings(payload: UpdateUserSettingRequest) {
  return request<void>({
    url: '/api/user/settings',
    method: 'PUT',
    data: payload
  })
}

export function fetchUserSummary() {
  return request<UserSummaryResponse>({
    url: '/api/user/summary',
    method: 'GET'
  })
}

export function getCachedUserProfile() {
  return uni.getStorageSync(USER_PROFILE_KEY) as UserProfileResponse | undefined
}

export function setCachedUserProfile(profile: UserProfileResponse) {
  uni.setStorageSync(USER_PROFILE_KEY, profile)
}

export function clearCachedUserProfile() {
  uni.removeStorageSync(USER_PROFILE_KEY)
}
