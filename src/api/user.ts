import { request } from '@/api/http'

const USER_PROFILE_KEY = 'LIFTLOG_USER_PROFILE'

export interface UserProfileResponse {
  userId: number
  nickname: string
  avatarUrl?: string
  weightUnit: 'kg' | 'lb' | string
  restSeconds: number
}

export interface UpdateUserSettingRequest {
  weightUnit: 'kg' | 'lb'
  restSeconds: number
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
