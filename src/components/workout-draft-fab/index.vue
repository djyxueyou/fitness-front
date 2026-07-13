<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useWorkoutStore } from '@/stores/workout'

const props = withDefaults(
  defineProps<{
    visible?: boolean
    variant?: 'default' | 'light'
  }>(),
  {
    visible: true,
    variant: 'default'
  }
)

const emit = defineEmits<{
  (event: 'open'): void
}>()

const workoutStore = useWorkoutStore()
const collapsed = ref(false)
let collapseTimer: ReturnType<typeof setTimeout> | null = null
const shouldShow = computed(
  () =>
    props.visible &&
    workoutStore.hasRecoverableWorkout &&
    workoutStore.draftSummary.exerciseCount > 0
)

function clearCollapseTimer() {
  if (!collapseTimer) return
  clearTimeout(collapseTimer)
  collapseTimer = null
}

function scheduleCollapse() {
  clearCollapseTimer()
  collapseTimer = setTimeout(() => {
    collapsed.value = true
  }, 2800)
}

watch(
  shouldShow,
  (visible) => {
    clearCollapseTimer()
    collapsed.value = false
    if (visible) {
      scheduleCollapse()
    }
  },
  { immediate: true }
)

onUnmounted(clearCollapseTimer)
</script>

<template>
  <view
    v-if="shouldShow"
    class="workout-draft-fab btn-press"
    :class="{
      'workout-draft-fab--collapsed': collapsed,
      'workout-draft-fab--light': variant === 'light'
    }"
    @tap="emit('open')"
  >
    <view class="workout-draft-fab__rail" />
    <view class="workout-draft-fab__play">▶</view>
    <view v-if="!collapsed" class="workout-draft-fab__copy">
      <view class="workout-draft-fab__title">
        {{ workoutStore.draftSummary.state === 'RUNNING' ? '训练进行中' : '训练草稿' }}
      </view>
      <view class="workout-draft-fab__sub">{{ workoutStore.draftSummary.durationText }}</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.workout-draft-fab {
  position: fixed;
  right: 0;
  bottom: calc(188rpx + env(safe-area-inset-bottom));
  z-index: 88;
  width: 218rpx;
  min-width: 188rpx;
  height: 92rpx;
  padding: 14rpx 18rpx 14rpx 22rpx;
  border-radius: 30rpx 0 0 30rpx;
  display: flex;
  align-items: center;
  gap: 14rpx;
  overflow: hidden;
  background:
    radial-gradient(circle at 0% 0%, rgba(255, 100, 24, 0.16), transparent 58%),
    var(--app-surface-raised);
  border: 1rpx solid var(--app-border);
  border-right: 0;
  box-shadow: var(--app-shadow-card);
  transition:
    width 0.24s ease,
    min-width 0.24s ease,
    padding 0.24s ease,
    border-radius 0.24s ease;

  &--collapsed {
    width: 92rpx;
    min-width: 92rpx;
    padding: 14rpx 16rpx 14rpx 22rpx;
    border-radius: 30rpx 0 0 30rpx;
  }

  &--light {
    background: var(--app-surface-raised);
    border-color: var(--app-border);
    box-shadow: var(--app-shadow-card);

    .workout-draft-fab__rail {
      box-shadow: none;
    }

    .workout-draft-fab__title {
      color: var(--app-text);
    }

    .workout-draft-fab__sub {
      color: var(--app-accent);
    }
  }

  &__rail {
    position: absolute;
    left: 0;
    top: 16rpx;
    bottom: 16rpx;
    width: 6rpx;
    border-radius: 999rpx;
    background: linear-gradient(180deg, #ff501e, #ff8c00);
    box-shadow: 0 0 18rpx rgba(255, 80, 30, 0.6);
  }

  &__play {
    width: 52rpx;
    height: 52rpx;
    border-radius: 18rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: linear-gradient(135deg, #ff501e, #ff8c00);
    font-size: 20rpx;
    flex-shrink: 0;
  }

  &__copy {
    min-width: 0;
    flex: 1;
  }

  &__title {
    color: var(--app-text);
    font-size: 24rpx;
    font-weight: 900;
    line-height: 1.1;
  }

  &__sub {
    margin-top: 8rpx;
    color: var(--app-accent);
    font-size: 20rpx;
    font-weight: 800;
  }
}
</style>
