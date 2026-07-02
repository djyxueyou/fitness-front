<script setup lang="ts">
import { computed } from 'vue'
import TrainingLevelBadge from '@/components/training-level-badge/index.vue'
import type {
  TrainingLevelProfileResponse,
  TrainingLevelSettlementResponse
} from '@/api/training-level'

const props = defineProps<{
  settlement?: TrainingLevelSettlementResponse | null
  profile?: TrainingLevelProfileResponse | null
  loading?: boolean
}>()

const state = computed(() => props.settlement?.after || props.profile || null)
const progressPercent = computed(() =>
  Math.max(0, Math.min(100, state.value?.progressPercent || 0))
)
const nextExp = computed(() => {
  if (!state.value) return 0
  return Math.max(0, state.value.nextLevelExp - state.value.currentLevelExp)
})
const gainedText = computed(() => {
  if (props.loading) return '结算训练 XP 中'
  if (props.settlement && !props.settlement.eligible) return '本次未获得 XP'
  if (props.settlement?.alreadySettled) return '本次 XP 已结算'
  if (props.settlement) return `训练成长 +${props.settlement.expGained} XP`
  return '训练等级'
})
const message = computed(() => {
  if (props.loading) return '正在根据本次训练时长计算成长。'
  if (props.settlement?.message) return props.settlement.message
  if (!state.value) return '坚持有效训练，逐步提升等级。'
  return nextExp.value > 0 ? `还差 ${nextExp.value} XP 升到下一等级。` : '继续完成有效训练。'
})
</script>

<template>
  <view class="training-level-card glass-card">
    <TrainingLevelBadge
      :level="state?.level || 1"
      :badge-name="state?.badgeName || '青铜'"
      :badge-code="state?.badgeCode || 'BRONZE'"
      :theme-color="state?.themeColor || '#ff7a1a'"
      :accent-color="state?.accentColor || '#cd7f32'"
      :upgraded="Boolean(settlement?.upgraded)"
    />
    <view class="training-level-card__body">
      <view class="training-level-card__label">{{ gainedText }}</view>
      <view class="training-level-card__title">
        Lv.{{ state?.level || 1 }} · {{ state?.badgeName || '青铜' }}
      </view>
      <view class="training-level-card__track">
        <view class="training-level-card__bar" :style="{ width: `${progressPercent}%` }" />
      </view>
      <view class="training-level-card__message">{{ message }}</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.training-level-card {
  margin-bottom: 24rpx;
  padding: 24rpx;
  display: flex;
  align-items: center;
  gap: 22rpx;
  border-color: rgba(255, 122, 26, 0.24);
  background:
    radial-gradient(circle at 12% 0%, rgba(255, 122, 26, 0.12), transparent 34%),
    var(--app-card);

  &__body {
    min-width: 0;
    flex: 1;
  }

  &__label {
    color: var(--app-accent);
    font-size: 22rpx;
    font-weight: 900;
  }

  &__title {
    margin-top: 8rpx;
    color: var(--app-text);
    font-size: 30rpx;
    font-weight: 950;
  }

  &__track {
    height: 12rpx;
    margin-top: 16rpx;
    overflow: hidden;
    border-radius: 999rpx;
    background: var(--app-surface);
  }

  &__bar {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #ff5a1f, #ff9a1f);
    transition: width 0.25s ease;
  }

  &__message {
    margin-top: 10rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
    line-height: 1.45;
  }
}
</style>
