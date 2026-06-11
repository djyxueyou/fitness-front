import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  clearCachedUserProfile,
  fetchUserProfile,
  fetchUserSummary,
  getCachedUserProfile,
  resolveAvatarUrl,
  setCachedUserProfile,
  updateUserProfile,
  updateUserSettings
} from '@/api/user'

export const useProfileStore = defineStore('profile', () => {
  const cached = getCachedUserProfile()
  const userId = ref<number | null>(cached?.userId ?? null)
  const nickname = ref(cached?.nickname || 'LiftLog User')
  const avatarUrl = ref(cached?.avatarUrl || '')
  const avatarDisplayUrl = computed(() => resolveAvatarUrl(avatarUrl.value))
  const heightCm = ref<number | null>(cached?.heightCm ?? null)
  const trainingGoal = ref(cached?.trainingGoal || '')
  const experienceLevel = ref(cached?.experienceLevel || '')
  const currentWeightKg = ref<number | null>(cached?.currentWeightKg ?? null)
  const notifications = ref(true)
  const darkMode = ref(true)
  const unit = ref<'kg' | 'lb'>(cached?.weightUnit === 'lb' ? 'lb' : 'kg')
  const restSeconds = ref<number>(cached?.restSeconds ?? 60)
  const totalSessions = ref(0)
  const totalVolumeKg = ref(0)
  const currentStreakDays = ref(0)

  async function refreshProfile() {
    try {
      const profile = await fetchUserProfile()
      userId.value = profile.userId
      nickname.value = profile.nickname || 'LiftLog User'
      avatarUrl.value = profile.avatarUrl || ''
      heightCm.value = profile.heightCm ?? null
      trainingGoal.value = profile.trainingGoal || ''
      experienceLevel.value = profile.experienceLevel || ''
      currentWeightKg.value = profile.currentWeightKg ?? null
      unit.value = profile.weightUnit === 'lb' ? 'lb' : 'kg'
      restSeconds.value = profile.restSeconds
      setCachedUserProfile(profile)
    } catch (err) {
      console.error('[profile] refresh failed', err)
    }
  }

  async function refreshSummary() {
    try {
      const summary = await fetchUserSummary()
      totalSessions.value = Number(summary.totalSessions || 0)
      totalVolumeKg.value = Number(summary.totalVolumeKg || 0)
      currentStreakDays.value = Number(summary.currentStreakDays || 0)
    } catch (err) {
      console.error('[profile] refresh summary failed', err)
    }
  }

  async function saveSettings(next: { weightUnit: 'kg' | 'lb'; restSeconds: number }) {
    await updateUserSettings(next)
    unit.value = next.weightUnit
    restSeconds.value = next.restSeconds
    setCachedUserProfile({
      userId: userId.value || 0,
      nickname: nickname.value,
      avatarUrl: avatarUrl.value,
      heightCm: heightCm.value ?? undefined,
      trainingGoal: trainingGoal.value || undefined,
      experienceLevel: experienceLevel.value || undefined,
      currentWeightKg: currentWeightKg.value ?? undefined,
      weightUnit: unit.value,
      restSeconds: restSeconds.value
    })
  }

  async function saveProfile(next: {
    nickname: string
    avatarUrl?: string
    heightCm?: number | null
    trainingGoal?: string | null
    experienceLevel?: string | null
  }) {
    await updateUserProfile({
      nickname: next.nickname,
      avatarUrl: next.avatarUrl,
      heightCm: next.heightCm ?? null,
      trainingGoal: next.trainingGoal || null,
      experienceLevel: next.experienceLevel || null
    })
    await refreshProfile()
  }

  function resetProfile() {
    userId.value = null
    nickname.value = 'LiftLog User'
    avatarUrl.value = ''
    heightCm.value = null
    trainingGoal.value = ''
    experienceLevel.value = ''
    currentWeightKg.value = null
    unit.value = 'kg'
    restSeconds.value = 60
    totalSessions.value = 0
    totalVolumeKg.value = 0
    currentStreakDays.value = 0
    clearCachedUserProfile()
  }

  return {
    userId,
    nickname,
    avatarUrl,
    avatarDisplayUrl,
    heightCm,
    trainingGoal,
    experienceLevel,
    currentWeightKg,
    notifications,
    darkMode,
    unit,
    restSeconds,
    totalSessions,
    totalVolumeKg,
    currentStreakDays,
    refreshProfile,
    refreshSummary,
    saveProfile,
    saveSettings,
    resetProfile
  }
})
