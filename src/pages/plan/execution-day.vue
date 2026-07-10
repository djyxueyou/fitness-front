<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import EmptyState from '@/components/empty-state/index.vue'
import PrimaryButton from '@/components/primary-button/index.vue'
import WorkoutDraftPrompt from '@/components/workout-draft-prompt/index.vue'
import { usePlanStore } from '@/stores/plan'
import { useWorkoutStore } from '@/stores/workout'
import { useWorkoutDraftPromptStore } from '@/stores/workout-draft-prompt'
import { useThemeStore } from '@/stores/theme'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'

const planStore = usePlanStore()
const workoutStore = useWorkoutStore()
const draftPromptStore = useWorkoutDraftPromptStore()
const themeStore = useThemeStore()
const dayId = ref<number | null>(null)
const loading = ref(false)

const execution = computed(() => planStore.activeExecution)
const day = computed(() => {
  const days = execution.value?.days || []
  if (dayId.value) return days.find((item) => item.id === dayId.value) || null
  return days.find((item) => item.status === 'PENDING') || days[0] || null
})
const title = computed(() => day.value?.title || '训练日')
const meta = computed(() => {
  if (!execution.value || !day.value) return ''
  return `${execution.value.planName} · 第 ${day.value.weekIndex} 周`
})

onLoad((options) => {
  const id = Number(options?.dayId)
  dayId.value = Number.isFinite(id) && id > 0 ? id : null
})

onShow(async () => {
  const ok = await ensureFeatureAuth('训练计划')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  await loadExecution()
})

async function loadExecution() {
  if (loading.value) return
  loading.value = true
  try {
    await planStore.loadActiveExecution()
  } catch (err) {
    console.error('[plan] active execution day failed', err)
  } finally {
    loading.value = false
  }
}

async function startWorkout() {
  if (!execution.value || !day.value || !day.value.items.length) return
  const ok = await ensureFeatureAuth('训练功能')
  if (!ok) return
  workoutStore.refreshDraftState()
  if (workoutStore.hasRecoverableWorkout) {
    const action = await draftPromptStore.open({
      title: title.value,
      subtitle: '计划训练日 · 删除当前草稿后直接开始'
    })
    if (action === 'continue') {
      if (workoutStore.restoreDraft()) {
        uni.navigateTo({ url: routes.workoutActive })
      }
      return
    }
    if (action !== 'discard') return
    workoutStore.discardWorkout()
  }
  workoutStore.queueStartWorkout(null, {
    executionId: execution.value.executionId,
    executionDayId: day.value.id,
    executionDayTitle: day.value.title,
    executionItems: day.value.items
  })
  uni.navigateTo({ url: routes.workoutActive })
}

function goBack() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
    return
  }
  uni.switchTab({ url: routes.planIndex })
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view
      class="page-shell secondary-page execution-day safe-bottom"
      :class="themeStore.themeClass"
    >
      <AppHeader title="计划训练" :subtitle="meta" show-back @back="goBack" />

      <EmptyState
        v-if="!loading && !day"
        icon="!"
        title="暂无训练日"
        description="当前没有可开始的计划训练。"
      />

      <template v-else-if="day">
        <view class="glass-card execution-day__hero">
          <view class="execution-day__eyebrow">下一次训练</view>
          <view class="execution-day__title">{{ title }}</view>
          <view class="execution-day__meta"
            >{{ day.items.length }} 个动作 · {{ day.plannedDate }}</view
          >
        </view>

        <view class="execution-day__list">
          <view v-for="item in day.items" :key="item.id" class="glass-card execution-day__item">
            <view>
              <view class="execution-day__name">{{ item.exerciseName }}</view>
              <view class="execution-day__sub">
                {{ item.primaryMuscle || '目标肌群' }} · {{ item.equipment || '器械不限' }}
              </view>
            </view>
            <view class="execution-day__target">
              {{ item.targetSets || 1 }} 组
              <text v-if="item.targetReps"> · {{ item.targetReps }} 次</text>
              <text v-else-if="item.targetDurationSeconds">
                · {{ item.targetDurationSeconds }} 秒</text
              >
            </view>
            <view v-if="item.replacementReason" class="execution-day__reason">
              {{ item.replacementReason }}
            </view>
          </view>
        </view>

        <PrimaryButton class="execution-day__submit" @tap="startWorkout">开始训练</PrimaryButton>
      </template>
    </view>
  </scroll-view>
  <WorkoutDraftPrompt />
</template>

<style lang="scss" scoped>
.execution-day {
  &__hero {
    margin-top: 24rpx;
    padding: 28rpx;
  }

  &__eyebrow,
  &__meta,
  &__sub,
  &__target,
  &__reason {
    color: var(--app-text-muted);
    font-size: 23rpx;
  }

  &__title {
    margin-top: 8rpx;
    color: var(--app-text-main);
    font-size: 38rpx;
    font-weight: 900;
  }

  &__list {
    margin-top: 20rpx;
  }

  &__item {
    margin-top: 16rpx;
    padding: 22rpx;
  }

  &__name {
    color: var(--app-text-main);
    font-size: 28rpx;
    font-weight: 900;
  }

  &__target {
    margin-top: 12rpx;
  }

  &__reason {
    margin-top: 10rpx;
    color: #ff6418;
  }

  &__submit {
    margin-top: 28rpx;
  }
}
</style>
