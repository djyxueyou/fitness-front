import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  fetchUserProfile,
  fetchUserSummary,
  getCachedUserProfile,
  setCachedUserProfile,
  updateUserSettings
} from '@/api/user'

export const useProfileStore = defineStore('profile', () => {
  const cached = getCachedUserProfile()
  const userId = ref<number | null>(cached?.userId ?? null)
  const nickname = ref(cached?.nickname || 'LiftLog User')
  const avatarUrl = ref(cached?.avatarUrl || '')
  const notifications = ref(true)
  const darkMode = ref(true)
  const unit = ref<'kg' | 'lb'>(cached?.weightUnit === 'lb' ? 'lb' : 'kg')
  const restSeconds = ref<number>(cached?.restSeconds ?? 90)
  const totalSessions = ref(0)
  const totalVolumeKg = ref(0)
  const currentStreakDays = ref(0)

  async function refreshProfile() {
    try {
      const profile = await fetchUserProfile()
      userId.value = profile.userId
      nickname.value = profile.nickname || 'LiftLog User'
      avatarUrl.value = profile.avatarUrl || ''
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
      weightUnit: unit.value,
      restSeconds: restSeconds.value
    })
  }

  return {
    userId,
    nickname,
    avatarUrl,
    notifications,
    darkMode,
    unit,
    restSeconds,
    totalSessions,
    totalVolumeKg,
    currentStreakDays,
    refreshProfile,
    refreshSummary,
    saveSettings
  }
})
