<script setup lang="ts">
import TrainingLevelBadge from '@/components/training-level-badge/index.vue'
import type { TrainingLevelSettlementResponse } from '@/api/training-level'

defineProps<{
  visible: boolean
  settlement: TrainingLevelSettlementResponse | null
}>()

defineEmits<{
  close: []
}>()
</script>

<template>
  <view
    v-if="visible && settlement?.upgraded && settlement.before && settlement.after"
    class="training-level-upgrade"
    @tap="$emit('close')"
  >
    <view class="training-level-upgrade__sheet" @tap.stop>
      <view class="training-level-upgrade__label">LEVEL UP</view>
      <view class="training-level-upgrade__title">训练等级提升</view>
      <TrainingLevelBadge
        size="lg"
        :level="settlement.after.level"
        :badge-name="settlement.after.badgeName"
        :badge-code="settlement.after.badgeCode"
        :theme-color="settlement.after.themeColor"
        :accent-color="settlement.after.accentColor"
        upgraded
      />
      <view class="training-level-upgrade__copy">
        Lv.{{ settlement.before.level }} 升至 Lv.{{ settlement.after.level }} ·
        {{ settlement.after.badgeName }}
      </view>
      <view class="training-level-upgrade__button btn-press" @tap="$emit('close')">知道了</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.training-level-upgrade {
  position: fixed;
  inset: 0;
  z-index: 1200;
  padding: 40rpx;
  background: rgba(8, 13, 24, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;

  &__sheet {
    width: 100%;
    max-width: 560rpx;
    padding: 42rpx 34rpx 34rpx;
    border-radius: 40rpx;
    background: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 36rpx 90rpx rgba(15, 23, 42, 0.22);
  }

  &__label {
    color: var(--app-accent);
    font-size: 22rpx;
    font-weight: 950;
    letter-spacing: 3rpx;
  }

  &__title {
    margin: 12rpx 0 28rpx;
    color: var(--app-text);
    font-size: 40rpx;
    font-weight: 950;
  }

  &__copy {
    margin-top: 26rpx;
    color: var(--app-text-secondary);
    font-size: 24rpx;
    font-weight: 800;
  }

  &__button {
    width: 100%;
    height: 82rpx;
    margin-top: 30rpx;
    border-radius: 24rpx;
    background: linear-gradient(135deg, #ff5a1f, #ff8a00);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    font-weight: 950;
  }
}
</style>
