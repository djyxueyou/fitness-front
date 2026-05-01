<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import GlassCard from '@/components/glass-card/index.vue'
import { useProfileStore } from '@/stores/profile'
import { useTrainingStore } from '@/stores/training'
import { formatWeight } from '@/utils/unit'

const trainingStore = useTrainingStore()
const profileStore = useProfileStore()
const loading = ref(false)
const muscleDistribution = ref<{ name: string; pct: number; color: string }[]>([])
const weightUnit = computed(() => profileStore.unit)

const weeklyVolume = computed(() => {
  const now = new Date()
  const result: { week: string; volume: number; sessions: number }[] = []
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now)
    date.setDate(now.getDate() - i * 7)
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)

    const records = trainingStore.history.filter((item) => {
      const startedAt = new Date(item.startedAt).getTime()
      return startedAt >= start.getTime() && startedAt <= end.getTime()
    })
    result.push({
      week: `${start.getMonth() + 1}/${start.getDate()}`,
      volume: records.reduce((sum, item) => sum + Number(item.totalVolumeKg || 0), 0),
      sessions: records.length
    })
  }
  return result
})

const maxVolume = computed(() => Math.max(...weeklyVolume.value.map((item) => item.volume), 1))

onShow(async () => {
  loading.value = true
  try {
    await trainingStore.fetchHistory()
    const ids = trainingStore.history.slice(0, 20).map((item) => item.id)
    const details = await Promise.all(ids.map((id) => trainingStore.fetchDetail(id)))
    const counters: Record<string, number> = {}
    details.forEach((detail) => {
      detail.items.forEach((item) => {
        const key = item.primaryMuscle || '其他'
        counters[key] = (counters[key] || 0) + 1
      })
    })
    const total = Object.values(counters).reduce((sum, value) => sum + value, 0) || 1
    const colors = ['#ff501e', '#50c8ff', '#c850ff', '#3dd9a2', '#ffc850']
    muscleDistribution.value = Object.entries(counters)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count], index) => ({
        name,
        pct: Math.round((count / total) * 100),
        color: colors[index % colors.length]
      }))
  } finally {
    loading.value = false
  }
})

function goBack() {
  uni.navigateBack()
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell safe-bottom">
      <AppHeader title="容量趋势" subtitle="训练数据分析" show-back @back="goBack" />

      <view class="trend__summary">
        <view class="glass-card trend__summary-card">
          <view class="muted">周均训练容量</view>
          <view class="trend__summary-row">
            <view class="trend__summary-value">{{
              formatWeight(
                weeklyVolume.reduce((s, i) => s + i.volume, 0) / Math.max(weeklyVolume.length, 1),
                weightUnit,
                0
              )
            }}</view>
            <view class="trend__summary-unit">{{ weightUnit }}</view>
          </view>
        </view>
        <view class="glass-card trend__summary-card">
          <view class="muted">周均训练次数</view>
          <view class="trend__summary-row">
            <view class="trend__summary-value">{{
              (
                weeklyVolume.reduce((s, i) => s + i.sessions, 0) / Math.max(weeklyVolume.length, 1)
              ).toFixed(1)
            }}</view>
            <view class="trend__summary-unit">次/周</view>
          </view>
        </view>
      </view>

      <GlassCard>
        <view class="trend__chart-card">
          <view class="trend__chart-title">近6周训练量</view>
          <view class="trend__bars">
            <view v-for="item in weeklyVolume" :key="item.week" class="trend__bar-item">
              <view class="trend__bar-track">
                <view
                  class="trend__bar-fill"
                  :style="{ height: `${Math.max(6, (item.volume / maxVolume) * 100)}%` }"
                />
              </view>
              <view class="trend__bar-label">{{ item.week }}</view>
              <view class="trend__bar-meta">{{ formatWeight(item.volume, weightUnit, 0) }}</view>
            </view>
          </view>
        </view>
      </GlassCard>

      <GlassCard>
        <view class="trend__muscle-card">
          <view class="trend__chart-title">肌群分布</view>
          <view v-if="loading" class="muted">加载中...</view>
          <view v-for="item in muscleDistribution" :key="item.name" class="trend__muscle-row">
            <view class="space-between">
              <view class="trend__muscle-name">
                <text class="trend__muscle-dot" :style="{ background: item.color }" />
                {{ item.name }}
              </view>
              <view class="muted">{{ item.pct }}%</view>
            </view>
            <view class="trend__muscle-track">
              <view
                class="trend__muscle-fill"
                :style="{ width: `${item.pct}%`, background: item.color }"
              />
            </view>
          </view>
        </view>
      </GlassCard>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.trend {
  &__summary {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16rpx;
    margin-bottom: 24rpx;
  }

  &__summary-card,
  &__chart-card,
  &__muscle-card {
    padding: 24rpx;
  }

  &__summary-row {
    margin-top: 10rpx;
    display: flex;
    align-items: baseline;
    gap: 8rpx;
  }

  &__summary-value {
    color: #ff501e;
    font-size: 34rpx;
    font-weight: 700;
  }

  &__summary-unit {
    color: #828296;
    font-size: 22rpx;
  }

  &__chart-card {
    margin-bottom: 24rpx;
  }

  &__chart-title {
    font-size: 28rpx;
    font-weight: 700;
    margin-bottom: 20rpx;
  }

  &__bars {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12rpx;
  }

  &__bar-item {
    flex: 1;
    text-align: center;
  }

  &__bar-track {
    height: 220rpx;
    border-radius: 18rpx;
    background: rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: flex-end;
    overflow: hidden;
  }

  &__bar-fill {
    width: 100%;
    border-radius: 18rpx;
    background: linear-gradient(180deg, #ff501e 0%, #ff8e3c 100%);
  }

  &__bar-label {
    margin-top: 10rpx;
    font-size: 20rpx;
    color: #f5f5fa;
  }

  &__bar-meta {
    margin-top: 4rpx;
    font-size: 18rpx;
    color: #828296;
  }

  &__muscle-row + &__muscle-row {
    margin-top: 18rpx;
  }

  &__muscle-name {
    display: flex;
    align-items: center;
    gap: 10rpx;
    font-size: 22rpx;
  }

  &__muscle-dot {
    width: 10rpx;
    height: 10rpx;
    border-radius: 50%;
  }

  &__muscle-track {
    margin-top: 10rpx;
    height: 12rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  &__muscle-fill {
    height: 100%;
    border-radius: inherit;
  }
}
</style>
