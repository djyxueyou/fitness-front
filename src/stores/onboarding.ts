import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  fetchRecommendedPlans,
  fetchTrainingProfile,
  saveTrainingProfile
} from '@/api/onboarding'

const STORAGE_KEY = 'FITFORGE_TRAINING_ONBOARDING'

export type TrainingGoal = 'MUSCLE_GAIN' | 'STRENGTH' | 'FAT_LOSS' | 'GENERAL_FITNESS'
export type ExperienceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
export type TrainingEnvironment = 'FULL_GYM' | 'HOME_BASIC' | 'BODYWEIGHT_ONLY'

export interface TrainingOnboardingProfile {
  ownerUserId?: number
  completed: boolean
  currentStep: number
  goal: TrainingGoal
  experienceLevel: ExperienceLevel
  sessionsPerWeek: number
  sessionDurationMinutes: number
  environment: TrainingEnvironment
  limitations: string[]
  recommendedPlanId?: number
  recommendationReasons: string[]
}

const defaultProfile: TrainingOnboardingProfile = {
  completed: false,
  currentStep: 0,
  goal: 'GENERAL_FITNESS',
  experienceLevel: 'BEGINNER',
  sessionsPerWeek: 3,
  sessionDurationMinutes: 45,
  environment: 'FULL_GYM',
  limitations: [],
  recommendationReasons: []
}

function readProfile() {
  try {
    return {
      ...defaultProfile,
      ...(uni.getStorageSync(STORAGE_KEY) || {})
    } as TrainingOnboardingProfile
  } catch {
    return { ...defaultProfile }
  }
}

export const useOnboardingStore = defineStore('onboarding', () => {
  const profile = ref<TrainingOnboardingProfile>(readProfile())
  const isCompleted = computed(() => profile.value.completed)

  function persist() {
    uni.setStorageSync(STORAGE_KEY, profile.value)
  }

  function update(next: Partial<TrainingOnboardingProfile>) {
    profile.value = { ...profile.value, ...next }
    persist()
  }

  function ensureOwner(userId?: number | null) {
    if (!userId || profile.value.ownerUserId === userId) return
    profile.value = { ...defaultProfile, ownerUserId: userId }
    persist()
  }

  function complete() {
    update({ completed: true, currentStep: 3 })
  }

  function beginEdit() {
    update({ currentStep: 0 })
  }

  function completeEdit() {
    update({
      completed: true,
      currentStep: 3,
      recommendedPlanId: undefined,
      recommendationReasons: []
    })
  }

  function reset() {
    profile.value = { ...defaultProfile }
    persist()
  }

  async function loadFromServer() {
    const serverProfile = await fetchTrainingProfile()
    update({
      completed: serverProfile.completed,
      currentStep: serverProfile.currentStep ?? 0,
      goal: (serverProfile.goal || profile.value.goal) as TrainingGoal,
      experienceLevel: (serverProfile.experienceLevel || profile.value.experienceLevel) as ExperienceLevel,
      sessionsPerWeek: serverProfile.sessionsPerWeek || profile.value.sessionsPerWeek,
      sessionDurationMinutes:
        serverProfile.sessionDurationMinutes || profile.value.sessionDurationMinutes,
      environment: (serverProfile.environment || profile.value.environment) as TrainingEnvironment,
      limitations: serverProfile.limitations
        ? serverProfile.limitations.split(',').filter(Boolean)
        : []
    })
  }

  async function saveToServer(completed = profile.value.completed) {
    const saved = await saveTrainingProfile({
      goal: profile.value.goal,
      experienceLevel: profile.value.experienceLevel,
      sessionsPerWeek: profile.value.sessionsPerWeek,
      sessionDurationMinutes: profile.value.sessionDurationMinutes,
      environment: profile.value.environment,
      limitations: profile.value.limitations.join(','),
      currentStep: profile.value.currentStep,
      completed
    })
    update({ completed: saved.completed, currentStep: saved.currentStep })
  }

  async function recommend() {
    const best = (await fetchRecommendedPlans())[0]
    if (!best) return null
    update({ recommendedPlanId: best.planId, recommendationReasons: best.reasons })
    return best
  }

  return {
    profile,
    isCompleted,
    update,
    complete,
    beginEdit,
    completeEdit,
    reset,
    ensureOwner,
    loadFromServer,
    saveToServer,
    recommend
  }
})
