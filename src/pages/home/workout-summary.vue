<script setup lang="ts">
import { computed } from 'vue'
import AppHeader from '@/components/app-header/index.vue'
import { routes } from '@/utils/navigation'
import { formatSeconds } from '@/utils/format'
import { formatWeight } from '@/utils/unit'
import { useProfileStore } from '@/stores/profile'
import { useWorkoutStore } from '@/stores/workout'

const workoutStore = useWorkoutStore()
const profileStore = useProfileStore()

const summary = computed(() => workoutStore.completedSummary)
const weightUnit = computed(() => profileStore.unit)
const durationText = computed(() => formatSeconds(summary.value?.durationSeconds || 0))
const volumeText = computed(() =>
  summary.value
    ? `${formatWeight(summary.value.totalVolumeKg, weightUnit.value, 1)} ${weightUnit.value}`
    : '--'
)

function goHome() {
  workoutStore.setCompletedSummary(null)
  uni.switchTab({ url: routes.home })
}

function goDetail() {
  const trainingId = summary.value?.trainingId
  if (!trainingId) {
    goHome()
    return
  }

  uni.redirectTo({ url: `${routes.historyDetail}?id=${trainingId}` })
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell workout-summary safe-bottom">
      <AppHeader title="训练完成" subtitle="本次训练已保存" />

      <view class="workout-summary__hero">
        <view class="workout-summary__badge">完成</view>
        <view class="workout-summary__title">{{ summary?.trainingName || '训练已完成' }}</view>
        <view class="workout-summary__sub">保持记录，才能看到真实进步。</view>
      </view>

      <view class="workout-summary__grid">
        <view class="glass-card workout-summary__stat">
          <view class="workout-summary__label">时长</view>
          <view class="workout-summary__value">{{ durationText }}</view>
        </view>
        <view class="glass-card workout-summary__stat">
          <view class="workout-summary__label">总容量</view>
          <view class="workout-summary__value">{{ volumeText }}</view>
        </view>
        <view class="glass-card workout-summary__stat">
          <view class="workout-summary__label">动作</view>
          <view class="workout-summary__value">{{ summary?.totalExerciseCount || 0 }} 个</view>
        </view>
        <view class="glass-card workout-summary__stat">
          <view class="workout-summary__label">完成组</view>
          <view class="workout-summary__value">{{ summary?.totalSetCount || 0 }} 组</view>
        </view>
      </view>

      <view class="glass-card workout-summary__note">
        <view class="workout-summary__note-title">下一步</view>
        <view class="workout-summary__note-copy">
          可以回首页查看本周训练变化，或进入训练详情复盘每个动作。
        </view>
      </view>

      <view class="workout-summary__actions">
        <view class="gradient-fire workout-summary__button btn-press" @tap="goHome">返回首页</view>
        <view class="glass-card workout-summary__button btn-press" @tap="goDetail">查看详情</view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.workout-summary {
  &__hero {
    margin-top: 20rpx;
    padding: 44rpx 30rpx;
    border-radius: 42rpx;
    background:
      radial-gradient(circle at 20% 10%, rgba(255, 160, 60, 0.28), transparent 34%),
      linear-gradient(145deg, rgba(255, 80, 30, 0.2), rgba(20, 20, 28, 0.95));
    border: 1px solid rgba(255, 80, 30, 0.24);
  }

  &__badge {
    width: fit-content;
    padding: 10rpx 18rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.14);
    color: #ffa03c;
    font-size: 22rpx;
    font-weight: 800;
  }

  &__title {
    margin-top: 24rpx;
    color: #fff;
    font-size: 44rpx;
    font-weight: 900;
  }

  &__sub {
    margin-top: 12rpx;
    color: rgba(245, 245, 250, 0.76);
    font-size: 24rpx;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16rpx;
    margin-top: 24rpx;
  }

  &__stat {
    padding: 26rpx;
  }

  &__label {
    color: #828296;
    font-size: 22rpx;
  }

  &__value {
    margin-top: 10rpx;
    color: #f5f5fa;
    font-size: 34rpx;
    font-weight: 900;
  }

  &__note {
    margin-top: 24rpx;
    padding: 28rpx;
  }

  &__note-title {
    color: #f5f5fa;
    font-size: 28rpx;
    font-weight: 800;
  }

  &__note-copy {
    margin-top: 12rpx;
    color: #828296;
    font-size: 24rpx;
    line-height: 1.7;
  }

  &__actions {
    margin-top: 32rpx;
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }

  &__button {
    min-height: 92rpx;
    border-radius: 28rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 28rpx;
    font-weight: 800;
  }
}
</style>
