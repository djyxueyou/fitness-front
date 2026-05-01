<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import ProgressBar from '@/components/progress-bar/index.vue'
import { routes } from '@/utils/navigation'
import { formatSeconds } from '@/utils/format'
import { useWorkoutStore } from '@/stores/workout'

const workoutStore = useWorkoutStore()
const showFinish = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

const calories = computed(() => Math.round(workoutStore.elapsedSeconds * 0.08))

function closePage() {
  if (timer) clearInterval(timer)
  uni.navigateBack()
}

function confirmFinish() {
  if (timer) clearInterval(timer)
  workoutStore.finishWorkout()
  uni.switchTab({ url: routes.home })
}

onMounted(() => {
  if (!workoutStore.activeExercises.length) {
    workoutStore.startWorkout(null)
  }

  timer = setInterval(() => {
    workoutStore.elapsedSeconds += 1
  }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <view class="workout-active">
    <view class="workout-active__top">
      <view class="workout-active__close btn-press" @tap="closePage">✕</view>
      <view class="workout-active__title-wrap">
        <view class="workout-active__title">{{ workoutStore.activeTemplateName }}</view>
        <view class="workout-active__timer">{{ formatSeconds(workoutStore.elapsedSeconds) }}</view>
      </view>
      <view class="workout-active__done btn-press" @tap="showFinish = true">完成</view>
    </view>

    <view class="workout-active__progress">
      <view class="space-between">
        <view class="muted">{{ workoutStore.doneSets }}/{{ workoutStore.totalSets }} 组已完成</view>
        <view class="workout-active__percent">{{ Math.round(workoutStore.progress * 100) }}%</view>
      </view>
      <ProgressBar :value="workoutStore.progress" />
    </view>

    <view class="workout-active__stats">
      <view class="glass-card workout-active__stat">
        <view class="workout-active__stat-icon">⏱</view>
        <view class="workout-active__stat-value">{{ formatSeconds(workoutStore.elapsedSeconds) }}</view>
        <view class="workout-active__stat-label">时长</view>
      </view>
      <view class="glass-card workout-active__stat">
        <view class="workout-active__stat-icon">🔥</view>
        <view class="workout-active__stat-value">{{ calories }} kcal</view>
        <view class="workout-active__stat-label">消耗</view>
      </view>
      <view class="glass-card workout-active__stat">
        <view class="workout-active__stat-icon">⚡</view>
        <view class="workout-active__stat-value">{{ workoutStore.totalVolume }} kg</view>
        <view class="workout-active__stat-label">总容量</view>
      </view>
    </view>

    <scroll-view scroll-y class="workout-active__list">
      <view v-for="(exercise, exerciseIndex) in workoutStore.activeExercises" :key="exercise.id" class="glass-card workout-active__card">
        <view class="workout-active__card-top">
          <view>
            <view class="workout-active__card-title">{{ exercise.name }}</view>
            <view class="workout-active__card-sub">{{ exercise.muscle }}</view>
          </view>
          <view class="muted">⌄</view>
        </view>

        <view class="workout-active__table-head">
          <text class="workout-active__set-index">组</text>
          <text class="workout-active__cell">重量(kg)</text>
          <text class="workout-active__cell">次数</text>
          <text class="workout-active__done-head">完成</text>
        </view>

        <view v-for="(set, setIndex) in exercise.sets" :key="`${exercise.id}-${setIndex}`" class="workout-active__set" :class="{ 'workout-active__set--done': set.done }">
          <text class="workout-active__set-index">{{ setIndex + 1 }}</text>
          <text class="workout-active__cell">{{ set.weight }}</text>
          <text class="workout-active__cell">{{ set.reps }}</text>
          <view class="workout-active__set-toggle" :class="{ 'workout-active__set-toggle--done': set.done }" @tap="workoutStore.toggleSet(exerciseIndex, setIndex)">
            ✓
          </view>
        </view>

        <view class="workout-active__add-row" @tap="workoutStore.addSet(exerciseIndex)">+ 添加一组</view>
      </view>

      <view class="glass-card workout-active__add-exercise btn-press" @tap="uni.switchTab({ url: routes.exercises })">+ 添加动作</view>
    </scroll-view>

    <view v-if="showFinish" class="workout-active__overlay" @tap="showFinish = false">
      <view class="workout-active__sheet" @tap.stop>
        <view class="workout-active__sheet-handle" />
        <view class="title-lg">完成训练？</view>
        <view class="muted workout-active__sheet-sub">已完成 {{ workoutStore.doneSets }}/{{ workoutStore.totalSets }} 组，训练时长 {{ formatSeconds(workoutStore.elapsedSeconds) }}</view>
        <view class="gradient-fire workout-active__sheet-btn btn-press" @tap="confirmFinish">保存并完成</view>
        <view class="glass-card workout-active__sheet-btn btn-press" @tap="showFinish = false">继续训练</view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.workout-active {
  min-height: 100vh;
  background: #0a0a0e;
  padding: calc(env(safe-area-inset-top) + 24rpx) 32rpx calc(env(safe-area-inset-bottom) + 24rpx);
  display: flex;
  flex-direction: column;

  &__top,
  &__progress,
  &__stats {
    flex-shrink: 0;
  }

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
  }

  &__close,
  &__done {
    min-width: 72rpx;
    min-height: 72rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__close {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  &__done {
    padding: 0 24rpx;
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    color: #fff;
    font-weight: 700;
  }

  &__title-wrap {
    flex: 1;
    text-align: center;
  }

  &__title {
    font-size: 28rpx;
    font-weight: 700;
  }

  &__timer,
  &__percent {
    color: #ff501e;
    font-weight: 700;
  }

  &__timer {
    margin-top: 8rpx;
    font-size: 36rpx;
  }

  &__progress {
    margin-top: 24rpx;
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16rpx;
    margin: 24rpx 0;
  }

  &__stat {
    padding: 20rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8rpx;
  }

  &__stat-icon {
    font-size: 28rpx;
  }

  &__stat-value {
    font-size: 24rpx;
    font-weight: 700;
  }

  &__stat-label {
    color: #828296;
    font-size: 20rpx;
  }

  &__list {
    flex: 1;
  }

  &__card {
    padding: 24rpx;
    margin-bottom: 20rpx;
  }

  &__card-top,
  &__table-head,
  &__set {
    display: flex;
    align-items: center;
  }

  &__card-top {
    justify-content: space-between;
    padding-bottom: 20rpx;
    margin-bottom: 12rpx;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  &__card-title {
    font-size: 28rpx;
    font-weight: 700;
  }

  &__card-sub {
    margin-top: 8rpx;
    font-size: 22rpx;
    color: #828296;
  }

  &__table-head {
    padding: 0 8rpx 12rpx;
    color: #828296;
    font-size: 20rpx;
  }

  &__set {
    padding: 16rpx 8rpx;
    border-radius: 22rpx;
    margin-bottom: 10rpx;

    &--done {
      background: rgba(255, 80, 30, 0.1);
    }
  }

  &__set-index {
    width: 48rpx;
    text-align: center;
    font-weight: 700;
  }

  &__cell {
    flex: 1;
    text-align: center;
  }

  &__done-head {
    width: 68rpx;
    text-align: center;
  }

  &__set-toggle {
    width: 56rpx;
    height: 56rpx;
    border-radius: 18rpx;
    background: rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #828296;

    &--done {
      background: linear-gradient(135deg, #ff501e, #ffa03c);
      color: #fff;
    }
  }

  &__add-row {
    margin-top: 8rpx;
    color: #ff501e;
    font-size: 22rpx;
  }

  &__add-exercise {
    padding: 24rpx;
    text-align: center;
    color: #ff501e;
    font-size: 26rpx;
    font-weight: 700;
  }

  &__overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.72);
    display: flex;
    align-items: flex-end;
    z-index: 20;
  }

  &__sheet {
    width: 100%;
    background: #14141c;
    border-radius: 36rpx 36rpx 0 0;
    padding: 24rpx 32rpx calc(env(safe-area-inset-bottom) + 24rpx);
  }

  &__sheet-handle {
    width: 80rpx;
    height: 8rpx;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 999rpx;
    margin: 0 auto 24rpx;
  }

  &__sheet-sub {
    margin: 16rpx 0 24rpx;
  }

  &__sheet-btn {
    min-height: 92rpx;
    border-radius: 28rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 16rpx;
    font-size: 28rpx;
    font-weight: 700;
    color: #fff;
  }
}
</style>
