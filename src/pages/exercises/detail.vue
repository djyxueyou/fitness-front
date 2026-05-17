<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import TagChip from '@/components/tag-chip/index.vue'
import { getToken } from '@/api/http'
import { exerciseRecords, exerciseTips } from '@/mock/exercises'
import { useExerciseStore } from '@/stores/exercise'
import { useWorkoutStore } from '@/stores/workout'
import { ensureFeatureAuth } from '@/utils/auth-guard'

const exerciseStore = useExerciseStore()
const workoutStore = useWorkoutStore()
const exerciseId = ref(0)
const loading = ref(true)
const isAdded = ref(false)

const exercise = computed(() => exerciseStore.getById(exerciseId.value))
const record = computed(() =>
  exercise.value
    ? (exerciseRecords[exercise.value.id] ?? { maxWeight: '--', bestSet: '--' })
    : { maxWeight: '--', bestSet: '--' }
)
const demoUrl = computed(() =>
  'mediaUrl' in (exercise.value || {}) ? exercise.value?.mediaUrl || '' : ''
)
const coverUrl = computed(() => exercise.value?.thumbnailUrl || '')
const isCustomExercise = computed(() => exercise.value?.exerciseType === 'USER')
const instructionTips = computed(() =>
  isCustomExercise.value
    ? []
    : splitContent(exercise.value?.instructionText).length
    ? splitContent(exercise.value?.instructionText)
    : exerciseTips
)
const mistakeTips = computed(() =>
  isCustomExercise.value ? [] : splitContent(exercise.value?.commonMistakesText)
)
const checklistTips = computed(() =>
  isCustomExercise.value ? [] : splitContent(exercise.value?.checklistText)
)
const isInCurrentWorkout = computed(() =>
  exercise.value ? workoutStore.hasExercise(exercise.value.id) : false
)

onLoad((query) => {
  const id = Number(query.id)
  if (!Number.isNaN(id) && id > 0) {
    exerciseId.value = id
    loadDetail(id)
    return
  }
  loading.value = false
})

async function loadDetail(id: number) {
  loading.value = true
  try {
    await exerciseStore.fetchDetail(id)
  } catch (err) {
    console.error('[exercise-detail] fetch failed', err)
    uni.showToast({ title: '动作详情加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function goBack() {
  uni.navigateBack()
}

function splitContent(text?: string) {
  if (!text) return []
  return text
    .split(/\r?\n|；|;|。/)
    .map((item) => item.replace(/^[-\d.、\s]+/, '').trim())
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

  await exerciseStore.toggleFavorite(exercise.value.id)
}

async function addToWorkout() {
  const ok = await ensureFeatureAuth('训练功能')
  if (!ok || !exercise.value) return
  const added = workoutStore.addExercise(exercise.value.id, exercise.value.name, exercise.value.muscle)
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
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view v-if="exercise" class="page-shell safe-bottom">
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
        <view class="exercise-detail__preview-card">
          <image v-if="demoUrl" class="exercise-detail__demo" :src="demoUrl" mode="aspectFit" />
          <image
            v-else-if="coverUrl"
            class="exercise-detail__demo"
            :src="coverUrl"
            mode="aspectFit"
          />
          <view v-else class="exercise-detail__placeholder">
            <view class="exercise-detail__placeholder-icon">GIF</view>
            <view class="muted">{{ loading ? '加载动作演示中...' : '暂无动作演示' }}</view>
          </view>
        </view>
      </view>

      <view class="exercise-detail__chips">
        <TagChip :text="`器械：${exercise.equipment}`" />
        <TagChip :text="`难度：${exercise.level}`" />
        <TagChip :text="`肌群：${exercise.muscle}`" />
        <TagChip :text="`分类：${exercise.category}`" />
      </view>

      <view v-if="instructionTips.length" class="glass-card exercise-detail__section">
        <view class="exercise-detail__section-title">动作要点</view>
        <view v-for="(tip, index) in instructionTips" :key="tip" class="exercise-detail__tip">
          <view class="exercise-detail__tip-index">{{ index + 1 }}</view>
          <view class="exercise-detail__tip-text">{{ tip }}</view>
        </view>
      </view>

      <view v-if="mistakeTips.length" class="glass-card exercise-detail__section">
        <view class="exercise-detail__section-title">常见错误</view>
        <view v-for="(tip, index) in mistakeTips" :key="tip" class="exercise-detail__tip">
          <view class="exercise-detail__tip-index exercise-detail__tip-index--warn">
            {{ index + 1 }}
          </view>
          <view class="exercise-detail__tip-text">{{ tip }}</view>
        </view>
      </view>

      <view v-if="checklistTips.length" class="glass-card exercise-detail__section">
        <view class="exercise-detail__section-title">训练前检查</view>
        <view v-for="tip in checklistTips" :key="tip" class="exercise-detail__check">
          <view class="exercise-detail__check-dot">✓</view>
          <view class="exercise-detail__tip-text">{{ tip }}</view>
        </view>
      </view>

      <view class="glass-card exercise-detail__section">
        <view class="exercise-detail__section-head">
          <view class="exercise-detail__section-title">历史最佳</view>
          <view class="muted">更多</view>
        </view>
        <view class="exercise-detail__records">
          <view class="exercise-detail__record">
            <view class="muted">最大重量</view>
            <view class="exercise-detail__record-value">{{ record.maxWeight }}</view>
            <view class="muted">1RM</view>
          </view>
          <view class="exercise-detail__record">
            <view class="muted">最佳工作组</view>
            <view class="exercise-detail__record-value">{{ record.bestSet }}</view>
            <view class="muted">历史表现</view>
          </view>
        </view>
      </view>

      <view
        class="exercise-detail__cta"
        :class="{ 'glass-card': isAdded || isInCurrentWorkout, 'gradient-fire glow-primary': !isAdded && !isInCurrentWorkout }"
        @tap="addToWorkout"
      >
        {{ isAdded || isInCurrentWorkout ? '已在今日训练中' : '添加到今日训练' }}
      </view>
    </view>
    <view v-else class="page-shell safe-bottom">
      <view class="muted exercise-detail__empty">
        {{ loading ? '加载中...' : '动作不存在' }}
      </view>
    </view>
  </scroll-view>
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

  &__preview-card {
    min-height: 420rpx;
    border-radius: 36rpx;
    border: 1px solid rgba(255, 80, 30, 0.16);
    background: linear-gradient(145deg, rgba(255, 80, 30, 0.08), rgba(255, 160, 60, 0.04));
    overflow: hidden;
  }

  &__demo {
    width: 100%;
    height: 420rpx;
    display: block;
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

  &__tip {
    display: flex;
    align-items: flex-start;
    gap: 16rpx;
    margin-top: 16rpx;
  }

  &__tip-index {
    width: 40rpx;
    height: 40rpx;
    border-radius: 14rpx;
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20rpx;
    font-weight: 700;

    &--warn {
      background: rgba(255, 107, 74, 0.18);
      color: #ff6b4a;
    }
  }

  &__tip-text {
    flex: 1;
    font-size: 24rpx;
    line-height: 1.6;
  }

  &__check {
    display: flex;
    align-items: flex-start;
    gap: 16rpx;
    margin-top: 16rpx;
  }

  &__check-dot {
    width: 40rpx;
    height: 40rpx;
    border-radius: 14rpx;
    background: rgba(61, 217, 162, 0.16);
    color: #3dd9a2;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20rpx;
    font-weight: 800;
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

  &__cta {
    min-height: 92rpx;
    border-radius: 28rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    font-weight: 700;
    color: #fff;
  }
}
</style>
