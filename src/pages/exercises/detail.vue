<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import MembershipRequiredModal from '@/components/membership-required-modal/index.vue'
import TagChip from '@/components/tag-chip/index.vue'
import { getToken } from '@/api/http'
import { fetchExerciseLastPerformance, type ExerciseLastPerformanceResponse } from '@/api/training'
import { useExerciseStore } from '@/stores/exercise'
import { useTemplateStore } from '@/stores/template'
import { useWorkoutStore } from '@/stores/workout'
import { useThemeStore } from '@/stores/theme'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { ensureMembershipFeature } from '@/utils/membership-guard'
import { routes } from '@/utils/navigation'
import { formatSeconds } from '@/utils/format'
import type { Exercise } from '@/types/exercise'

const exerciseStore = useExerciseStore()
const templateStore = useTemplateStore()
const workoutStore = useWorkoutStore()
const themeStore = useThemeStore()
const exerciseId = ref(0)
const loading = ref(true)
const isAdded = ref(false)
const lastPerformance = ref<ExerciseLastPerformanceResponse | null>(null)
const alternativeExercises = ref<Exercise[]>([])

const exercise = computed(() => exerciseStore.getById(exerciseId.value))
const demoUrl = computed(() => exercise.value?.mediaUrl || '')
const coverUrl = computed(() => exercise.value?.thumbnailUrl || '')
const isVideoDemo = computed(() => /\.mp4(?:[?#].*)?$/i.test(demoUrl.value))
const isCustomExercise = computed(() => exercise.value?.exerciseType === 'USER')
const instructionTips = computed(() =>
  isCustomExercise.value ? [] : splitContent(exercise.value?.instructionText)
)
const formCueTips = computed(() =>
  isCustomExercise.value ? [] : splitContent(exercise.value?.formCuesText)
)
const alternativeExerciseIds = computed(() => exercise.value?.alternativeExerciseIds || [])
const isInCurrentWorkout = computed(() =>
  exercise.value ? workoutStore.hasExercise(exercise.value.id) : false
)
const bestMetricLabel = computed(() =>
  exercise.value?.recordType === 'DURATION'
    ? '最长计时'
    : exercise.value?.recordType === 'BODYWEIGHT_REPS'
      ? '最多次数'
      : '最大重量'
)
const bestMetricSubLabel = computed(() =>
  exercise.value?.recordType === 'WEIGHT_REPS' ? '历史表现' : '最佳记录'
)
const record = computed(() => {
  const performance = lastPerformance.value
  if (!performance) return { best: '--', lastSet: '--' }
  if (exercise.value?.recordType === 'DURATION') {
    return {
      best: performance.bestDurationSeconds ? formatSeconds(performance.bestDurationSeconds) : '--',
      lastSet: performance.sets.length
        ? formatSeconds(performance.sets[0].durationSeconds || 0)
        : '--'
    }
  }
  if (exercise.value?.recordType === 'BODYWEIGHT_REPS') {
    return {
      best: performance.sets.length
        ? `${Math.max(...performance.sets.map((set) => set.reps || 0))} 次`
        : '--',
      lastSet: performance.sets.length ? `自重 x ${performance.sets[0].reps}` : '--'
    }
  }
  return {
    best: `${performance.bestWeightKg} kg`,
    lastSet: performance.sets.length
      ? `${performance.sets[0].weightKg} kg x ${performance.sets[0].reps}`
      : '--'
  }
})

onLoad((query = {}) => {
  const id = Number(query.id)
  if (!Number.isFinite(id) || id <= 0) {
    loading.value = false
    return
  }
  exerciseId.value = id
  loadDetail(id)
})

async function loadDetail(id: number) {
  loading.value = true
  try {
    await exerciseStore.fetchDetail(id)
    await loadAlternatives()
    if (getToken()) {
      fetchExerciseLastPerformance(id)
        .then((performance) => {
          lastPerformance.value = performance
        })
        .catch(() => {})
    }
  } catch (err) {
    console.error('[exercise-detail] fetch failed', err)
    uni.showToast({ title: '动作详情加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function loadAlternatives() {
  const ids = alternativeExerciseIds.value.filter((id) => id !== exerciseId.value)
  if (!ids.length) {
    alternativeExercises.value = []
    return
  }
  const results = await Promise.allSettled(ids.map((id) => exerciseStore.fetchDetail(id)))
  alternativeExercises.value = results
    .map((result, index) => {
      if (result.status === 'fulfilled') return result.value
      return exerciseStore.getById(ids[index])
    })
    .filter((item): item is Exercise => Boolean(item))
}

function goBack() {
  uni.navigateBack()
}

function goAlternative(id: number) {
  uni.redirectTo({ url: `${routes.exerciseDetail}?id=${id}` })
}

function splitContent(text?: string) {
  if (!text) return []
  return text
    .split(/\r?\n|；|。/)
    .map((item) => item.replace(/^[-\d.\s]+/, '').trim())
    .filter(Boolean)
}

async function toggleFavorite() {
  const wasLoggedIn = !!getToken()
  const ok = await ensureFeatureAuth('收藏动作')
  if (!ok || !exercise.value) return
  if (!wasLoggedIn) {
    await exerciseStore.refreshFavoriteStates()
    uni.showToast({ title: '已登录，请再次点击收藏', icon: 'none' })
    return
  }
  if (!(await ensureMembershipFeature('收藏动作'))) return
  await exerciseStore.toggleFavorite(exercise.value.id)
}

async function addToWorkout() {
  const ok = await ensureFeatureAuth('训练功能')
  if (!ok || !exercise.value) return
  const added = workoutStore.addExercise(
    exercise.value.id,
    exercise.value.name,
    exercise.value.muscle,
    exercise.value.recordType
  )
  if (!added) {
    uni.showToast({ title: '该动作已在当前训练中', icon: 'none' })
    return
  }
  isAdded.value = true
  uni.showToast({ title: '已加入今日训练', icon: 'none' })
  setTimeout(() => {
    isAdded.value = false
  }, 1600)
}

async function addToTemplate() {
  const ok = await ensureFeatureAuth('模板管理')
  if (!ok || !exercise.value) return
  if (!(await ensureMembershipFeature('自定义模板'))) return
  try {
    const result = await templateStore.saveFromPlan(`${exercise.value.name} 模板`, [
      { exerciseId: exercise.value.id, targetSets: 3 }
    ])
    uni.showToast({ title: '已创建模板', icon: 'none' })
    uni.navigateTo({ url: `${routes.templateDetail}?id=${result.id}` })
  } catch (err) {
    uni.showToast({ title: '添加失败', icon: 'none' })
    console.error('[exercise-detail] add to template failed', err)
  }
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view
      v-if="exercise"
      class="page-shell exercise-detail secondary-page safe-bottom"
      :class="themeStore.themeClass"
    >
      <AppHeader
        :title="exercise.name"
        :subtitle="`${exercise.muscle} · ${exercise.category}`"
        show-back
        @back="goBack"
      >
        <template #right>
          <view
            class="glass-card exercise-detail__fav btn-press"
            :class="{ 'exercise-detail__fav--active': exercise.favorited }"
            @tap="toggleFavorite"
          >
            {{ exercise.favorited ? '♥' : '♡' }}
          </view>
        </template>
      </AppHeader>

      <view class="exercise-detail__preview">
        <video
          v-if="demoUrl && isVideoDemo"
          class="exercise-detail__demo"
          :src="demoUrl"
          :poster="coverUrl"
          :controls="false"
          :autoplay="true"
          :loop="true"
          :muted="true"
          object-fit="contain"
          :show-center-play-btn="false"
          :enable-progress-gesture="false"
        />
        <image
          v-else-if="demoUrl"
          class="exercise-detail__demo"
          :src="demoUrl"
          mode="aspectFit"
          lazy-load
        />
        <image
          v-else-if="coverUrl"
          class="exercise-detail__demo"
          :src="coverUrl"
          mode="aspectFit"
        />
        <view v-else class="exercise-detail__placeholder">
          <view class="exercise-detail__placeholder-icon">演示</view>
          <view class="muted">{{ loading ? '加载动作演示中...' : '暂无动作演示' }}</view>
        </view>
      </view>

      <view class="exercise-detail__chips">
        <TagChip :text="`器械：${exercise.equipment}`" />
        <TagChip :text="`难度：${exercise.level}`" />
      </view>

      <view v-if="instructionTips.length" class="glass-card exercise-detail__section">
        <view class="exercise-detail__section-title">怎么做</view>
        <view v-for="(tip, index) in instructionTips" :key="tip" class="exercise-detail__tip">
          <view class="exercise-detail__tip-index">{{ index + 1 }}</view>
          <view class="exercise-detail__tip-text">{{ tip }}</view>
        </view>
      </view>
      <view v-else-if="!isCustomExercise" class="glass-card exercise-detail__section">
        <view class="exercise-detail__section-title">怎么做</view>
        <view class="muted">暂无详细说明</view>
      </view>

      <view v-if="formCueTips.length" class="glass-card exercise-detail__section">
        <view class="exercise-detail__section-title">关键提示</view>
        <view v-for="tip in formCueTips" :key="tip" class="exercise-detail__cue">
          <view class="exercise-detail__cue-dot">✓</view>
          <view class="exercise-detail__tip-text">{{ tip }}</view>
        </view>
      </view>

      <view v-if="alternativeExerciseIds.length" class="glass-card exercise-detail__section">
        <view class="exercise-detail__section-title">替代动作</view>
        <view class="exercise-detail__alternatives">
          <view
            v-for="item in alternativeExercises"
            :key="item.id"
            class="exercise-detail__alternative btn-press"
            @tap="goAlternative(item.id)"
          >
            <view class="exercise-detail__alternative-name">{{ item.name }}</view>
            <view class="exercise-detail__alternative-meta">
              {{ item.muscle }} · {{ item.equipment }}
            </view>
          </view>
        </view>
      </view>

      <view class="glass-card exercise-detail__section">
        <view class="exercise-detail__section-head">
          <view class="exercise-detail__section-title">历史最佳</view>
          <view class="muted">最近表现</view>
        </view>
        <view class="exercise-detail__records">
          <view class="exercise-detail__record">
            <view class="muted">{{ bestMetricLabel }}</view>
            <view class="exercise-detail__record-value">{{ record.best }}</view>
            <view class="muted">{{ bestMetricSubLabel }}</view>
          </view>
          <view class="exercise-detail__record">
            <view class="muted">最近工作组</view>
            <view class="exercise-detail__record-value">{{ record.lastSet }}</view>
            <view class="muted">上次记录</view>
          </view>
        </view>
      </view>

      <view
        class="exercise-detail__cta"
        :class="{
          'glass-card': isAdded || isInCurrentWorkout,
          'gradient-fire glow-primary': !isAdded && !isInCurrentWorkout
        }"
        @tap="addToWorkout"
      >
        {{ isAdded || isInCurrentWorkout ? '已在今日训练中' : '添加到今日训练' }}
      </view>
      <view class="glass-card exercise-detail__template-cta btn-press" @tap="addToTemplate">
        添加到模板
      </view>
    </view>
    <view v-else class="page-shell secondary-page safe-bottom" :class="themeStore.themeClass">
      <view class="muted exercise-detail__empty">
        {{ loading ? '加载中...' : '动作不存在' }}
      </view>
    </view>
  </scroll-view>
  <MembershipRequiredModal />
</template>

<style lang="scss" scoped>
.exercise-detail {
  &__fav {
    width: 72rpx;
    height: 72rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #b8b8c8;
    font-size: 34rpx;

    &--active {
      color: #ff4d4f;
      text-shadow: 0 0 12rpx rgba(255, 77, 79, 0.55);
    }
  }

  &__preview {
    min-height: 0;
    aspect-ratio: 16 / 9;
    border-radius: 36rpx;
    background: #fff;
    overflow: hidden;
  }

  &__demo {
    width: 100%;
    height: 100%;
    display: block;
    background: #fff;
  }

  &__placeholder,
  &__empty {
    min-height: 420rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12rpx;
  }

  &__placeholder-icon {
    width: 112rpx;
    height: 112rpx;
    border-radius: 32rpx;
    background: rgba(255, 80, 30, 0.15);
    color: #ff501e;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30rpx;
    font-weight: 800;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
    margin: 24rpx 0;

    &--inside {
      margin: 0;
    }
  }

  &__section {
    padding: 24rpx;
    margin-bottom: 20rpx;
  }

  &__section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__section-title {
    font-size: 28rpx;
    font-weight: 700;
    margin-bottom: 16rpx;
  }

  &__tip,
  &__cue {
    display: flex;
    align-items: flex-start;
    gap: 16rpx;
    margin-top: 16rpx;
  }

  &__tip-index,
  &__cue-dot {
    width: 40rpx;
    height: 40rpx;
    border-radius: 14rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20rpx;
    font-weight: 700;
    flex-shrink: 0;
  }

  &__tip-index {
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    color: #fff;
  }

  &__cue-dot {
    background: rgba(61, 217, 162, 0.16);
    color: #3dd9a2;
  }

  &__tip-text {
    flex: 1;
    font-size: 24rpx;
    line-height: 1.6;
  }

  &__alternatives {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
  }

  &__alternative {
    min-width: 220rpx;
    min-height: 92rpx;
    padding: 16rpx 18rpx;
    border-radius: 22rpx;
    background: rgba(255, 80, 30, 0.1);
    border: 1rpx solid rgba(255, 80, 30, 0.22);
    color: #f5f5fa;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    font-weight: 800;
  }

  &__alternative-name {
    max-width: 320rpx;
    font-size: 24rpx;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__alternative-meta {
    margin-top: 6rpx;
    color: #9d9daf;
    font-size: 20rpx;
    line-height: 1.35;
  }

  &__records {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16rpx;
  }

  &__record {
    padding: 20rpx;
    border-radius: 24rpx;
    background: rgba(255, 80, 30, 0.08);
  }

  &__record-value {
    margin: 10rpx 0 8rpx;
    color: #ff501e;
    font-size: 30rpx;
    font-weight: 700;
  }

  &__cta,
  &__template-cta {
    min-height: 92rpx;
    border-radius: 28rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    font-weight: 700;
    color: #fff;
  }

  &__template-cta {
    margin-top: 18rpx;
    color: #ff7a32;
  }
}
</style>
