<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import { useTrainingStore } from '@/stores/training'
import { useProfileStore } from '@/stores/profile'
import { formatWeight } from '@/utils/unit'

const trainingStore = useTrainingStore()
const profileStore = useProfileStore()
const trainingId = ref<number | null>(null)
const detail = ref<Awaited<ReturnType<typeof trainingStore.fetchDetail>> | null>(null)
const loading = ref(false)
const unit = computed(() => profileStore.unit)

const totalSetsText = computed(() => `${detail.value?.totalSetCount || 0} 组`)

onLoad(async (query) => {
  loading.value = true
  try {
    const idValue = Number(query.id)
    if (!Number.isNaN(idValue) && idValue > 0) {
      trainingId.value = idValue
    } else if (typeof query.date === 'string') {
      if (!trainingStore.history.length) {
        await trainingStore.fetchHistory()
      }
      const target = trainingStore.history.find((item) => item.startedAt.startsWith(query.date))
      if (target) {
        trainingId.value = target.id
      }
    }

    if (trainingId.value) {
      detail.value = await trainingStore.fetchDetail(trainingId.value)
    }
  } finally {
    loading.value = false
  }
})

function goBack() {
  uni.navigateBack()
}

function formatDate(dateText?: string) {
  if (!dateText) return '-'
  const date = new Date(dateText)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function itemVolume(exercise: NonNullable<typeof detail.value>['items'][number]) {
  if (exercise.totalVolumeKg !== undefined && exercise.totalVolumeKg !== null) {
    return Number(exercise.totalVolumeKg || 0)
  }
  return exercise.sets.reduce((total, set) => total + Number(set.volumeKg || 0), 0)
}

function itemMaxWeight(exercise: NonNullable<typeof detail.value>['items'][number]) {
  if (exercise.maxWeightKg !== undefined && exercise.maxWeightKg !== null) {
    return Number(exercise.maxWeightKg || 0)
  }
  return exercise.sets.reduce((max, set) => Math.max(max, Number(set.weightKg || 0)), 0)
}

function comparisonText(value?: number | null, unitText = 'kg') {
  if (value === undefined || value === null) return '首次记录'
  if (value === 0) return '持平'
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatWeight(value, unit.value, 1)} ${unitText}`
}

function comparisonClass(value?: number | null) {
  if (value === undefined || value === null || value === 0) return ''
  return value > 0 ? 'history-detail__compare-value--up' : 'history-detail__compare-value--down'
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell safe-bottom">
      <AppHeader
        :title="detail?.trainingName || '训练详情'"
        :subtitle="formatDate(detail?.startedAt)"
        show-back
        @back="goBack"
      />

      <view v-if="loading" class="muted">加载中...</view>

      <template v-else-if="detail">
        <view class="history-detail__stats">
          <view class="glass-card history-detail__stat">
            <view class="history-detail__stat-icon">🕘</view>
            <view class="history-detail__stat-value"
              >{{ Math.round(detail.durationSeconds / 60) }} min</view
            >
            <view class="muted">时长</view>
          </view>
          <view class="glass-card history-detail__stat">
            <view class="history-detail__stat-icon">✅</view>
            <view class="history-detail__stat-value">{{ totalSetsText }}</view>
            <view class="muted">完成组</view>
          </view>
          <view class="glass-card history-detail__stat">
            <view class="history-detail__stat-icon">🎸</view>
            <view class="history-detail__stat-value"
              >{{ formatWeight(Number(detail.totalVolumeKg || 0), unit, 1) }} {{ unit }}</view
            >
            <view class="muted">总容量</view>
          </view>
        </view>

        <view class="history-detail__list">
          <view
            v-for="exercise in detail.items"
            :key="exercise.exerciseId"
            class="glass-card history-detail__card"
          >
            <view class="history-detail__card-top">
              <view class="history-detail__card-title">{{ exercise.exerciseName }}</view>
              <view class="muted">{{ exercise.completedSets }} 组</view>
            </view>

            <view class="history-detail__summary">
              <view>
                <view class="history-detail__summary-value">
                  {{ formatWeight(itemVolume(exercise), unit, 1) }} {{ unit }}
                </view>
                <view class="history-detail__summary-label">动作容量</view>
              </view>
              <view>
                <view class="history-detail__summary-value">
                  {{ formatWeight(itemMaxWeight(exercise), unit, 1) }} {{ unit }}
                </view>
                <view class="history-detail__summary-label">最高重量</view>
              </view>
            </view>

            <view class="history-detail__compare">
              <view class="history-detail__compare-item">
                <view class="history-detail__compare-label">容量 vs 上次</view>
                <view
                  class="history-detail__compare-value"
                  :class="comparisonClass(exercise.volumeDeltaKg)"
                >
                  {{ comparisonText(exercise.volumeDeltaKg, unit) }}
                </view>
              </view>
              <view class="history-detail__compare-item">
                <view class="history-detail__compare-label">最大重量 vs 上次</view>
                <view
                  class="history-detail__compare-value"
                  :class="comparisonClass(exercise.maxWeightDeltaKg)"
                >
                  {{ comparisonText(exercise.maxWeightDeltaKg, unit) }}
                </view>
              </view>
            </view>

            <view v-for="set in exercise.sets" :key="set.setNumber" class="history-detail__set">
              <view class="history-detail__set-label">第 {{ set.setNumber }} 组</view>
              <view class="history-detail__set-value"
                >{{ formatWeight(Number(set.weightKg || 0), unit, 1) }} {{ unit }} ×
                {{ set.reps }}</view
              >
            </view>
          </view>
        </view>
      </template>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.history-detail {
  &__stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16rpx;
    margin-bottom: 24rpx;
  }

  &__stat {
    padding: 22rpx;
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

  &__list {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
    padding-bottom: 24rpx;
  }

  &__card {
    padding: 24rpx;
  }

  &__card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 18rpx;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  &__card-title {
    font-size: 28rpx;
    font-weight: 700;
  }

  &__summary {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14rpx;
    margin-top: 18rpx;
  }

  &__summary-value {
    color: #f5f5fa;
    font-size: 26rpx;
    font-weight: 800;
  }

  &__summary-label {
    margin-top: 6rpx;
    color: #828296;
    font-size: 20rpx;
  }

  &__compare {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14rpx;
    margin-top: 18rpx;
  }

  &__compare-item {
    padding: 18rpx;
    border-radius: 22rpx;
    background: rgba(255, 255, 255, 0.05);
  }

  &__compare-label {
    color: #828296;
    font-size: 20rpx;
  }

  &__compare-value {
    margin-top: 8rpx;
    color: #b8b8c8;
    font-size: 24rpx;
    font-weight: 800;

    &--up {
      color: #3dd9a2;
    }

    &--down {
      color: #ff6b4a;
    }
  }

  &__set {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12rpx;
    margin-top: 14rpx;
    padding: 18rpx;
    border-radius: 22rpx;
    background: rgba(255, 80, 30, 0.08);
  }

  &__set-label {
    color: #828296;
    font-size: 22rpx;
  }

  &__set-value {
    flex: 1;
    text-align: right;
    font-weight: 700;
  }
}
</style>
