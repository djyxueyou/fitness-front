<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import CultivationFigure from '@/components/cultivation-figure/index.vue'
import {
  settleTrainingCultivation,
  type CultivationSettlementResponse
} from '@/api/cultivation'
import { routes } from '@/utils/navigation'

const trainingId = ref(0)
const loading = ref(false)
const settlement = ref<CultivationSettlementResponse | null>(null)
const currentState = computed(() => settlement.value?.after)
const themeColor = computed(() => currentState.value?.themeColor || '#ff6a2a')
const accentColor = computed(() => currentState.value?.accentColor || '#b73518')
const visualKey = computed(() => currentState.value?.visualKey || 'body')
const settlementStyle = computed(() => ({
  '--cultivation-theme': themeColor.value,
  '--cultivation-accent': accentColor.value
}))
const auraText = computed(() => currentState.value?.auraName || '筋骨初成')
const nextExpText = computed(() => {
  const state = currentState.value
  if (!state) return '--'
  return Math.max(0, state.nextLevelExp - state.currentLevelExp)
})

const realmTitle = computed(() => {
  const state = currentState.value
  if (!state) return '修炼结算'
  return `${state.realmName} · ${state.stageName}`
})
const expText = computed(() => {
  if (!settlement.value) return '--'
  if (!settlement.value.eligible) return '0'
  if (!settlement.value.granted) return '已结算'
  return `+${settlement.value.totalExp}`
})
const progressStyle = computed(() => ({
  width: `${Math.max(0, Math.min(100, settlement.value?.after.progressPercent || 0))}%`
}))
const settlementTitle = computed(() => {
  if (loading.value) return '正在结算修为'
  if (!settlement.value) return '修炼结算'
  if (!settlement.value.eligible) return '本次未获得修为'
  if (!settlement.value.granted) return '今日修为已结算'
  if (settlement.value.upgraded) return '境界突破'
  return '修为增长'
})
const bonusItems = computed(() => [
  { icon: '●', label: '有效训练', value: settlement.value?.baseExp || 0 },
  { icon: '◷', label: '时长加成', value: settlement.value?.durationBonusExp || 0 },
  { icon: '∞', label: '连续加成', value: settlement.value?.streakBonusExp || 0 }
])

onLoad((options) => {
  const rawId = typeof options?.id === 'string' ? Number(options.id) : 0
  if (Number.isFinite(rawId) && rawId > 0) {
    trainingId.value = rawId
    void loadSettlement()
  }
})

async function loadSettlement() {
  if (!trainingId.value) return
  loading.value = true
  try {
    settlement.value = await settleTrainingCultivation(trainingId.value)
  } catch (err) {
    uni.showToast({ title: '修为结算失败', icon: 'none' })
    console.error('[cultivation] settlement failed', err)
  } finally {
    loading.value = false
  }
}

function goSummary() {
  if (!trainingId.value) {
    goHome()
    return
  }
  uni.redirectTo({ url: `${routes.workoutSummary}?id=${trainingId.value}` })
}

function goHome() {
  uni.switchTab({ url: routes.home })
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell cultivation-settlement safe-bottom">
      <AppHeader title="修炼结算" subtitle="训练已保存，查看本次修为增长" />

      <view class="cultivation-settlement__hero" :style="settlementStyle">
        <view class="cultivation-settlement__glow" />
        <view class="cultivation-settlement__phantom">
          <CultivationFigure
            ghost
            :visual-key="visualKey"
            :theme-color="themeColor"
            :accent-color="accentColor"
            :muted="Boolean(settlement && !settlement.eligible)"
            :upgraded="Boolean(settlement?.upgraded)"
          />
        </view>
        <view class="cultivation-settlement__badge">{{ settlementTitle }}</view>
        <view class="cultivation-settlement__core">
          <view class="cultivation-settlement__core-ring" />
          <view class="cultivation-settlement__exp">{{ expText }}</view>
          <view class="cultivation-settlement__unit">修为</view>
        </view>
        <view class="cultivation-settlement__realm">{{ realmTitle }}</view>
        <view class="cultivation-settlement__aura">{{ auraText }}</view>
        <view class="cultivation-settlement__message">
          {{ settlement?.message || '正在根据本次训练时长结算修为。' }}
        </view>

        <view v-if="settlement?.after" class="cultivation-settlement__progress">
          <view class="cultivation-settlement__progress-top">
            <text>当前进度</text>
            <text>{{ settlement.after.currentLevelExp }}/{{ settlement.after.nextLevelExp }}</text>
          </view>
          <view class="cultivation-settlement__track">
            <view class="cultivation-settlement__bar" :style="progressStyle" />
          </view>
          <view class="cultivation-settlement__next">距离下一阶段还差 {{ nextExpText }} 修为</view>
        </view>
      </view>

      <view class="glass-card cultivation-settlement__grid">
        <view v-for="item in bonusItems" :key="item.label" class="glass-card cultivation-settlement__stat">
          <view class="cultivation-settlement__stat-icon">{{ item.icon }}</view>
          <view class="cultivation-settlement__stat-label">{{ item.label }}</view>
          <view
            class="cultivation-settlement__stat-value"
            :class="{ 'cultivation-settlement__stat-value--gain': item.value > 0 }"
          >
            +{{ item.value }}
          </view>
        </view>
      </view>

      <view class="glass-card cultivation-settlement__rule">
        <view class="cultivation-settlement__rule-title">结算规则</view>
        <view class="cultivation-settlement__rule-copy">
          单次训练满 30 分钟才算有效；每天只结算一次修为。满 60 分钟和连续训练会有少量加成。
        </view>
      </view>

      <view class="cultivation-settlement__actions">
        <view class="gradient-fire cultivation-settlement__button btn-press" @tap="goSummary">
          查看详细分析
        </view>
        <view class="glass-card cultivation-settlement__button btn-press" @tap="goHome">
          返回首页
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.cultivation-settlement {
  &__hero {
    --cultivation-theme: #ff6a2a;
    --cultivation-accent: #b73518;
    position: relative;
    margin-top: 22rpx;
    padding: 34rpx 32rpx 44rpx;
    border-radius: 44rpx;
    overflow: hidden;
    text-align: center;
    background:
      radial-gradient(circle at 50% 14%, var(--cultivation-theme), transparent 42%),
      linear-gradient(150deg, rgba(255, 255, 255, 0.075), rgba(18, 18, 26, 0.96));
    border: 1rpx solid var(--cultivation-theme);
    box-shadow:
      0 30rpx 80rpx rgba(0, 0, 0, 0.34),
      0 0 36rpx rgba(255, 106, 42, 0.16);
  }

  &__glow {
    position: absolute;
    left: 50%;
    top: 74rpx;
    width: 230rpx;
    height: 230rpx;
    transform: translateX(-50%);
    border-radius: 999rpx;
    background: var(--cultivation-theme);
    opacity: 0.2;
    filter: blur(36rpx);
  }

  &__phantom {
    position: absolute;
    inset: 28rpx 0 auto;
    z-index: 0;
    pointer-events: none;
  }

  &__badge,
  &__core,
  &__exp,
  &__unit,
  &__realm,
  &__aura,
  &__message,
  &__progress {
    position: relative;
    z-index: 1;
  }

  &__badge {
    display: inline-flex;
    padding: 10rpx 20rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.1);
    color: var(--cultivation-theme);
    font-size: 22rpx;
    font-weight: 900;
  }

  &__core {
    position: relative;
    width: 188rpx;
    height: 188rpx;
    margin: 42rpx auto 0;
    border-radius: 999rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(circle at 50% 45%, rgba(255, 255, 255, 0.2), transparent 34%),
      radial-gradient(circle, rgba(255, 255, 255, 0.12), rgba(0, 0, 0, 0.32));
    border: 1rpx solid rgba(255, 255, 255, 0.13);
    box-shadow:
      0 0 42rpx var(--cultivation-theme),
      inset 0 0 32rpx rgba(255, 255, 255, 0.08);
  }

  &__core-ring {
    position: absolute;
    inset: -20rpx;
    border-radius: 999rpx;
    border: 2rpx solid rgba(255, 255, 255, 0.08);
    box-shadow: inset 0 0 26rpx var(--cultivation-theme);
    animation: settlement-core-pulse 2.8s ease-in-out infinite;
  }

  &__exp {
    color: #fff;
    font-size: 74rpx;
    font-weight: 900;
    line-height: 1;
  }

  &__unit {
    margin-top: 8rpx;
    color: var(--cultivation-theme);
    font-size: 24rpx;
    font-weight: 900;
  }

  &__realm {
    margin-top: 26rpx;
    color: #f5f5fa;
    font-size: 36rpx;
    font-weight: 900;
  }

  &__aura {
    margin-top: 8rpx;
    color: var(--cultivation-theme);
    font-size: 23rpx;
    font-weight: 900;
  }

  &__message {
    margin: 12rpx auto 0;
    max-width: 560rpx;
    color: #b8b8c8;
    font-size: 24rpx;
    line-height: 1.55;
  }

  &__progress {
    margin-top: 30rpx;
  }

  &__progress-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #a5a5b8;
    font-size: 22rpx;
  }

  &__track {
    margin-top: 12rpx;
    height: 14rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.09);
    overflow: hidden;
  }

  &__bar {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--cultivation-theme), var(--cultivation-accent));
    box-shadow: 0 0 24rpx var(--cultivation-theme);
  }

  &__next {
    margin-top: 12rpx;
    color: #a5a5b8;
    font-size: 22rpx;
    text-align: left;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16rpx;
    margin-top: 24rpx;
    padding: 16rpx;
  }

  &__stat {
    padding: 22rpx 14rpx;
    text-align: center;
    border-radius: 24rpx;
    background:
      radial-gradient(circle at 50% 0%, rgba(255, 106, 42, 0.14), transparent 48%),
      rgba(255, 255, 255, 0.045);
  }

  &__stat-icon {
    width: 36rpx;
    height: 36rpx;
    margin: 0 auto 10rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--cultivation-theme);
    background: rgba(255, 106, 42, 0.16);
    font-size: 20rpx;
    font-weight: 900;
  }

  &__stat-label {
    color: #828296;
    font-size: 22rpx;
  }

  &__stat-value {
    margin-top: 10rpx;
    color: #f5f5fa;
    font-size: 32rpx;
    font-weight: 900;
  }

  &__stat-value--gain {
    color: #58e58f;
    text-shadow: 0 0 20rpx rgba(88, 229, 143, 0.38);
  }

  &__rule {
    margin-top: 24rpx;
    padding: 28rpx;
  }

  &__rule-title {
    color: #f5f5fa;
    font-size: 28rpx;
    font-weight: 900;
  }

  &__rule-copy {
    margin-top: 12rpx;
    color: #a5a5b8;
    font-size: 24rpx;
    line-height: 1.6;
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
    font-weight: 900;
  }

  &__actions .gradient-fire {
    box-shadow: 0 0 30rpx rgba(255, 106, 42, 0.34);
  }
}

@keyframes settlement-core-pulse {
  0%,
  100% {
    opacity: 0.58;
    transform: scale(0.96);
  }

  50% {
    opacity: 1;
    transform: scale(1.04);
  }
}
</style>
