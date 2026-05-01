<script setup lang="ts">
import AppHeader from '@/components/app-header/index.vue'
import GlassCard from '@/components/glass-card/index.vue'
import { muscleDistribution, weeklyVolume } from '@/mock/history'

function goBack() {
  uni.navigateBack()
}

const maxVolume = Math.max(...weeklyVolume.map((item) => item.volume))
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell safe-bottom">
      <AppHeader title="容量趋势" subtitle="训练数据分析" show-back @back="goBack" />

      <view class="trend__summary">
        <view class="glass-card trend__summary-card">
          <view class="muted">月均训练容量</view>
          <view class="trend__summary-value">10,675 kg</view>
        </view>
        <view class="glass-card trend__summary-card">
          <view class="muted">月均训练次数</view>
          <view class="trend__summary-value">3.8 次/周</view>
        </view>
      </view>

      <GlassCard>
        <view class="trend__chart-card">
          <view class="trend__chart-title">周训练量趋势</view>
          <view class="trend__chart">
            <view v-for="item in weeklyVolume" :key="item.week" class="trend__bar-col">
              <view class="trend__bar" :style="{ height: `${(item.volume / maxVolume) * 220}rpx` }" />
              <view class="trend__bar-week">{{ item.week }}</view>
              <view class="trend__bar-value">{{ item.sessions }} 次</view>
            </view>
          </view>
        </view>
      </GlassCard>

      <GlassCard>
        <view class="trend__muscle-card">
          <view class="trend__chart-title">肌群分布</view>
          <view v-for="item in muscleDistribution" :key="item.name" class="trend__muscle-row">
            <view class="space-between">
              <view class="trend__muscle-name">
                <text class="trend__muscle-dot" :style="{ background: item.color }" />
                {{ item.name }}
              </view>
              <view class="muted">{{ item.pct }}%</view>
            </view>
            <view class="trend__muscle-track">
              <view class="trend__muscle-fill" :style="{ width: `${item.pct}%`, background: item.color }" />
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

  &__summary-value {
    margin-top: 10rpx;
    color: #ff501e;
    font-size: 34rpx;
    font-weight: 700;
  }

  &__chart-card {
    margin-bottom: 24rpx;
  }

  &__chart-title {
    font-size: 28rpx;
    font-weight: 700;
    margin-bottom: 20rpx;
  }

  &__chart {
    height: 320rpx;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16rpx;
  }

  &__bar-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 12rpx;
  }

  &__bar {
    width: 100%;
    border-radius: 999rpx 999rpx 16rpx 16rpx;
    background: linear-gradient(180deg, #ff501e 0%, rgba(255, 160, 60, 0.2) 100%);
  }

  &__bar-week {
    font-size: 20rpx;
    color: #f5f5fa;
  }

  &__bar-value {
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
