<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{ visible: boolean; targetWeight: number; defaultBarWeight?: number }>()
defineEmits<{ close: [] }>()

const barWeight = ref(20)
const plates = [25, 20, 15, 10, 5, 2.5, 1.25]

watch(
  () => props.visible,
  (visible) => {
    if (visible) barWeight.value = props.defaultBarWeight ?? 20
  }
)

const perSide = computed(() => Math.max(0, (props.targetWeight - barWeight.value) / 2))
const result = computed(() => {
  let remaining = perSide.value
  const counts: Array<{ plate: number; count: number }> = []
  for (const plate of plates) {
    const count = Math.floor((remaining + 0.001) / plate)
    if (count > 0) {
      counts.push({ plate, count })
      remaining = Number((remaining - count * plate).toFixed(2))
    }
  }
  return { counts, remaining }
})
</script>

<template>
  <view v-if="visible" class="plate-calculator" @tap="$emit('close')">
    <view class="plate-calculator__sheet" @tap.stop>
      <view class="plate-calculator__title">杠铃片计算</view>
      <view class="plate-calculator__target">目标重量 {{ targetWeight }} kg</view>
      <view class="plate-calculator__bar">
        <text>杠铃杆重量</text>
        <input v-model.number="barWeight" type="digit" />
        <text>kg</text>
      </view>
      <view class="plate-calculator__result">
        <view v-for="item in result.counts" :key="item.plate" class="plate-calculator__plate">
          每侧 {{ item.plate }} kg × {{ item.count }}
        </view>
        <view v-if="!result.counts.length">无需加片</view>
        <view v-if="result.remaining > 0" class="plate-calculator__warning">
          现有片无法精确配出，还差每侧 {{ result.remaining }} kg
        </view>
      </view>
      <view class="plate-calculator__close btn-press" @tap="$emit('close')">完成</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.plate-calculator {
  position: fixed;
  inset: 0;
  z-index: 130;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;

  &__sheet {
    width: 100%;
    padding: 30rpx 30rpx calc(env(safe-area-inset-bottom) + 28rpx);
    border-radius: 34rpx 34rpx 0 0;
    background: var(--app-surface-warm);
    border: 1px solid var(--app-border);
    box-shadow: var(--app-shadow-floating);
  }

  &__title {
    color: var(--app-text);
    font-size: 32rpx;
    font-weight: 900;
  }

  &__target {
    margin-top: 8rpx;
    color: var(--app-text-muted);
  }

  &__bar {
    margin-top: 22rpx;
    padding: 18rpx;
    border-radius: 20rpx;
    background: var(--app-surface);
    display: flex;
    align-items: center;
    gap: 14rpx;

    input {
      width: 110rpx;
      color: var(--app-text);
      text-align: center;
      font-weight: 800;
    }
  }

  &__result {
    margin-top: 18rpx;
    padding: 20rpx;
    border-radius: 20rpx;
    background: var(--app-bg);
    color: var(--app-text);
  }

  &__plate {
    margin-bottom: 10rpx;
    font-weight: 700;
  }

  &__warning {
    margin-top: 12rpx;
    color: var(--app-warning, #d88900);
    font-size: 22rpx;
  }

  &__close {
    margin-top: 22rpx;
    padding: 20rpx;
    border-radius: 999rpx;
    text-align: center;
    background: var(--app-accent);
    color: #fff;
    font-weight: 900;
  }
}
</style>
