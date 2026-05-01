<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import AppHeader from '@/components/app-header/index.vue'
import TagChip from '@/components/tag-chip/index.vue'
import { exerciseRecords, exerciseTips } from '@/mock/exercises'
import { useExerciseStore } from '@/stores/exercise'
import { useWorkoutStore } from '@/stores/workout'

const exerciseStore = useExerciseStore()
const workoutStore = useWorkoutStore()
const exerciseId = ref(1)
const frame = ref(0)
const isPlaying = ref(false)
const isAdded = ref(false)
const frames = ['🏋️', '💪', '⚙️', '🔥']
let timer: ReturnType<typeof setInterval> | null = null

const exercise = computed(() => exerciseStore.getById(exerciseId.value) ?? exerciseStore.items[0])
const record = computed(() => exerciseRecords[exercise.value.id])

onLoad((query) => {
  const id = Number(query.id)
  if (!Number.isNaN(id) && id > 0) {
    exerciseId.value = id
  }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function goBack() {
  uni.navigateBack()
}

function toggleFavorite() {
  exerciseStore.toggleFavorite(exercise.value.id)
}

function playDemo() {
  if (timer) clearInterval(timer)
  isPlaying.value = true
  timer = setInterval(() => {
    frame.value = (frame.value + 1) % frames.length
  }, 320)
  setTimeout(() => {
    if (timer) clearInterval(timer)
    isPlaying.value = false
    frame.value = 0
  }, 2400)
}

function addToWorkout() {
  workoutStore.addExercise(exercise.value.name, exercise.value.muscle)
  isAdded.value = true
  uni.showToast({ title: '已加入今日训练', icon: 'none' })
  setTimeout(() => {
    isAdded.value = false
  }, 1600)
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell safe-bottom">
      <AppHeader :title="exercise.name" :subtitle="`${exercise.muscle} · ${exercise.category}`" show-back @back="goBack">
        <template #right>
          <view class="glass-card exercise-detail__fav btn-press" @tap="toggleFavorite">
            {{ exercise.favorited ? '★' : '☆' }}
          </view>
        </template>
      </AppHeader>

      <view class="exercise-detail__preview">
        <view class="exercise-detail__preview-card">
          <view v-if="isPlaying" class="exercise-detail__preview-frame">{{ frames[frame] }}</view>
          <template v-else>
            <view class="exercise-detail__preview-frame">🏋️</view>
            <view class="gradient-fire exercise-detail__preview-btn btn-press" @tap="playDemo">查看动作演示</view>
          </template>
        </view>
      </view>

      <view class="exercise-detail__chips">
        <TagChip :text="`器械：${exercise.equipment}`" />
        <TagChip :text="`难度：${exercise.level}`" />
        <TagChip :text="`肌群：${exercise.muscle}`" />
        <TagChip :text="`分类：${exercise.category}`" />
      </view>

      <view class="glass-card exercise-detail__section">
        <view class="exercise-detail__section-title">动作要点</view>
        <view v-for="(tip, index) in exerciseTips" :key="tip" class="exercise-detail__tip">
          <view class="exercise-detail__tip-index">{{ index + 1 }}</view>
          <view class="exercise-detail__tip-text">{{ tip }}</view>
        </view>
      </view>

      <view class="glass-card exercise-detail__section">
        <view class="exercise-detail__section-head">
          <view class="exercise-detail__section-title">历史最好</view>
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
            <view class="muted">最佳表现</view>
          </view>
        </view>
      </view>

      <view class="exercise-detail__cta" :class="{ 'glass-card': isAdded, 'gradient-fire glow-primary': !isAdded }" @tap="addToWorkout">
        {{ isAdded ? '已添加到今日训练' : '添加到今日训练' }}
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
    color: #ffc850;
    font-size: 30rpx;
  }

  &__preview-card {
    min-height: 360rpx;
    border-radius: 36rpx;
    border: 1px solid rgba(255, 80, 30, 0.16);
    background: linear-gradient(145deg, rgba(255, 80, 30, 0.08), rgba(255, 160, 60, 0.04));
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24rpx;
  }

  &__preview-frame {
    font-size: 96rpx;
  }

  &__preview-btn {
    min-height: 80rpx;
    padding: 0 28rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
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
  }

  &__tip-text {
    flex: 1;
    font-size: 24rpx;
    line-height: 1.6;
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
