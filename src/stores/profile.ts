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

const TRAINING_PREFERENCES_KEY = 'FITFORGE_TRAINING_PREFERENCES'

interface TrainingPreferences {
  weightStepKg: number
  weightStepLb: number
  repsStep: number
  durationStepSeconds: number
  barWeightKg: number
  restVibration: boolean
  restSound: boolean
  effortPromptEnabled: boolean
}

const defaultTrainingPreferences: TrainingPreferences = {
  weightStepKg: 2.5,
  weightStepLb: 5,
  repsStep: 1,
  durationStepSeconds: 10,
  barWeightKg: 20,
  restVibration: true,
  restSound: false,
  effortPromptEnabled: true
}

function getCachedTrainingPreferences(): TrainingPreferences {
  const cached = uni.getStorageSync(TRAINING_PREFERENCES_KEY) as
    | Partial<TrainingPreferences>
    | undefined
  return {
    ...defaultTrainingPreferences,
    ...(cached || {})
  }
}

export const useProfileStore = defineStore('profile', () => {
  const cached = getCachedUserProfile()
  const cachedTrainingPreferences = getCachedTrainingPreferences()
  const userId = ref<number | null>(cached?.userId ?? null)
  const nickname = ref(cached?.nickname || 'LiftLog User')
  const avatarUrl = ref(cached?.avatarUrl || '')
  const avatarDisplayUrl = computed(() => resolveAvatarUrl(avatarUrl.value))
  const heightCm = ref<number | null>(cached?.heightCm ?? null)
  const currentWeightKg = ref<number | null>(cached?.currentWeightKg ?? null)
  const notifications = ref(true)
  const darkMode = ref(true)
  const unit = ref<'kg' | 'lb'>(cached?.weightUnit === 'lb' ? 'lb' : 'kg')
  const restSeconds = ref<number>(cached?.restSeconds ?? 60)
  const weightStepKg = ref(cached?.weightStepKg ?? defaultTrainingPreferences.weightStepKg)
  const weightStepLb = ref(cached?.weightStepLb ?? defaultTrainingPreferences.weightStepLb)
  const repsStep = ref(cached?.repsStep ?? defaultTrainingPreferences.repsStep)
  const durationStepSeconds = ref(
    cached?.durationStepSeconds ?? defaultTrainingPreferences.durationStepSeconds
  )
  const effortPromptEnabled = ref(cached?.effortPromptEnabled ?? true)
  const barWeightKg = ref(cachedTrainingPreferences.barWeightKg)
  const restVibration = ref(cachedTrainingPreferences.restVibration)
  const restSound = ref(cachedTrainingPreferences.restSound)
  const totalSessions = ref(0)
  const totalVolumeKg = ref(0)

  async function refreshProfile() {
    try {
      const profile = await fetchUserProfile()
      userId.value = profile.userId
      nickname.value = profile.nickname || 'LiftLog User'
      avatarUrl.value = profile.avatarUrl || ''
      heightCm.value = profile.heightCm ?? null
      currentWeightKg.value = profile.currentWeightKg ?? null
      unit.value = profile.weightUnit === 'lb' ? 'lb' : 'kg'
      restSeconds.value = profile.restSeconds
      weightStepKg.value = profile.weightStepKg
      weightStepLb.value = profile.weightStepLb
      repsStep.value = profile.repsStep
      durationStepSeconds.value = profile.durationStepSeconds
      effortPromptEnabled.value = profile.effortPromptEnabled !== false
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
    } catch (err) {
      console.error('[profile] refresh summary failed', err)
    }
  }

  async function saveSettings(
    next: { weightUnit: 'kg' | 'lb'; restSeconds: number } & Partial<TrainingPreferences>
  ) {
    const payload = {
      weightUnit: next.weightUnit,
      restSeconds: next.restSeconds,
      weightStepKg: Math.max(0.01, Number(next.weightStepKg ?? weightStepKg.value)),
      weightStepLb: Math.max(0.01, Number(next.weightStepLb ?? weightStepLb.value)),
      repsStep: Math.max(1, Math.round(Number(next.repsStep ?? repsStep.value))),
      durationStepSeconds: Math.max(
        1,
        Math.round(Number(next.durationStepSeconds ?? durationStepSeconds.value))
      ),
      effortPromptEnabled: next.effortPromptEnabled ?? effortPromptEnabled.value
    }
    await updateUserSettings(payload)
    unit.value = next.weightUnit
    restSeconds.value = next.restSeconds
    weightStepKg.value = payload.weightStepKg
    weightStepLb.value = payload.weightStepLb
    repsStep.value = payload.repsStep
    durationStepSeconds.value = payload.durationStepSeconds
    effortPromptEnabled.value = payload.effortPromptEnabled
    setCachedUserProfile({
      userId: userId.value || 0,
      nickname: nickname.value,
      avatarUrl: avatarUrl.value,
      heightCm: heightCm.value ?? undefined,
      currentWeightKg: currentWeightKg.value ?? undefined,
      weightUnit: unit.value,
      restSeconds: restSeconds.value,
      weightStepKg: weightStepKg.value,
      weightStepLb: weightStepLb.value,
      repsStep: repsStep.value,
      durationStepSeconds: durationStepSeconds.value,
      effortPromptEnabled: effortPromptEnabled.value
    })
  }

  async function saveTrainingPreferences(next: Partial<TrainingPreferences>) {
    const merged = {
      weightStepKg: Math.max(0.5, Number(next.weightStepKg ?? weightStepKg.value)),
      weightStepLb: Math.max(1, Number(next.weightStepLb ?? weightStepLb.value)),
      repsStep: Math.max(1, Math.round(Number(next.repsStep ?? repsStep.value))),
      durationStepSeconds: Math.max(
        1,
        Math.round(Number(next.durationStepSeconds ?? durationStepSeconds.value))
      ),
      barWeightKg: Math.max(0, Number(next.barWeightKg ?? barWeightKg.value)),
      restVibration: next.restVibration ?? restVibration.value,
      restSound: next.restSound ?? restSound.value
    }

    const changesProgressionStep =
      next.weightStepKg !== undefined ||
      next.weightStepLb !== undefined ||
      next.repsStep !== undefined ||
      next.durationStepSeconds !== undefined
    if (changesProgressionStep) {
      await saveSettings({
        weightUnit: unit.value,
        restSeconds: restSeconds.value,
        ...merged
      })
    }
    barWeightKg.value = merged.barWeightKg
    restVibration.value = merged.restVibration
    restSound.value = merged.restSound
    uni.setStorageSync(TRAINING_PREFERENCES_KEY, merged)
  }

  async function saveProfile(next: {
    nickname: string
    avatarUrl?: string
    heightCm?: number | null
  }) {
    await updateUserProfile({
      nickname: next.nickname,
      avatarUrl: next.avatarUrl,
      heightCm: next.heightCm ?? null
    })
    await refreshProfile()
  }

  async function saveProfilePatch(next: {
    nickname?: string
    avatarUrl?: string
    heightCm?: number | null
  }) {
    await saveProfile({
      nickname: next.nickname ?? nickname.value,
      avatarUrl: next.avatarUrl ?? avatarUrl.value,
      heightCm: next.heightCm === undefined ? heightCm.value : next.heightCm
    })
  }

  function resetProfile() {
    userId.value = null
    nickname.value = 'LiftLog User'
    avatarUrl.value = ''
    heightCm.value = null
    currentWeightKg.value = null
    unit.value = 'kg'
    restSeconds.value = 60
    weightStepKg.value = defaultTrainingPreferences.weightStepKg
    weightStepLb.value = defaultTrainingPreferences.weightStepLb
    repsStep.value = defaultTrainingPreferences.repsStep
    durationStepSeconds.value = defaultTrainingPreferences.durationStepSeconds
    effortPromptEnabled.value = true
    barWeightKg.value = defaultTrainingPreferences.barWeightKg
    restVibration.value = defaultTrainingPreferences.restVibration
    restSound.value = defaultTrainingPreferences.restSound
    uni.setStorageSync(TRAINING_PREFERENCES_KEY, defaultTrainingPreferences)
    totalSessions.value = 0
    totalVolumeKg.value = 0
    clearCachedUserProfile()
  }

  return {
    userId,
    nickname,
    avatarUrl,
    avatarDisplayUrl,
    heightCm,
    currentWeightKg,
    notifications,
    darkMode,
    unit,
    restSeconds,
    weightStepKg,
    weightStepLb,
    repsStep,
    durationStepSeconds,
    effortPromptEnabled,
    barWeightKg,
    restVibration,
    restSound,
    totalSessions,
    totalVolumeKg,
    refreshProfile,
    refreshSummary,
    saveProfile,
    saveProfilePatch,
    saveSettings,
    saveTrainingPreferences,
    resetProfile
  }
})
