<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  AdvancedExerciseFilterKey,
  ExerciseFilterMetadata,
  ExerciseFilterState
} from '@/utils/exercise-filters'

const props = defineProps<{
  visible: boolean
  modelValue: ExerciseFilterState
  metadata: ExerciseFilterMetadata
  resultCount?: number
}>()

const emit = defineEmits<{
  close: []
  apply: [value: ExerciseFilterState]
}>()

const draft = ref<ExerciseFilterState>({ ...props.modelValue })

watch(
  () => props.visible,
  (visible) => {
    if (visible) draft.value = { ...props.modelValue }
  }
)

const groups = computed(() => [
  { key: 'equipmentCode' as const, title: '器械', options: props.metadata.equipment },
  { key: 'difficultyCode' as const, title: '难度', options: props.metadata.difficulty },
  { key: 'recordType' as const, title: '记录类型', options: props.metadata.recordTypes }
])

function choose(key: AdvancedExerciseFilterKey, value: string) {
  draft.value = { ...draft.value, [key]: value }
}

function reset() {
  draft.value = { ...draft.value, equipmentCode: '', difficultyCode: '', recordType: '' }
}
</script>

<template>
  <view
    v-if="visible"
    class="exercise-filter-sheet__mask"
    catchtouchmove="true"
    @tap="emit('close')"
  >
    <view class="exercise-filter-sheet" @tap.stop>
      <view class="exercise-filter-sheet__head">
        <view>
          <view class="exercise-filter-sheet__title">筛选动作</view>
          <view class="exercise-filter-sheet__sub">动作库与添加动作使用相同筛选条件</view>
        </view>
        <view class="exercise-filter-sheet__close btn-press" @tap="emit('close')">×</view>
      </view>
      <scroll-view scroll-y class="exercise-filter-sheet__body">
        <view v-for="group in groups" :key="group.key" class="exercise-filter-sheet__group">
          <view class="exercise-filter-sheet__group-title">{{ group.title }}</view>
          <view class="exercise-filter-sheet__grid">
            <view
              class="exercise-filter-sheet__chip btn-press"
              :class="{ 'exercise-filter-sheet__chip--active': !draft[group.key] }"
              @tap="choose(group.key, '')"
              >全部</view
            >
            <view
              v-for="option in group.options"
              :key="option.value"
              class="exercise-filter-sheet__chip btn-press"
              :class="{ 'exercise-filter-sheet__chip--active': draft[group.key] === option.value }"
              @tap="choose(group.key, option.value)"
              >{{ option.label }}</view
            >
          </view>
        </view>
      </scroll-view>
      <view class="exercise-filter-sheet__actions">
        <view class="exercise-filter-sheet__reset btn-press" @tap="reset">重置</view>
        <view class="exercise-filter-sheet__apply btn-press" @tap="emit('apply', { ...draft })">
          {{ resultCount == null ? '应用筛选' : `查看 ${resultCount} 个动作` }}
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.exercise-filter-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 151;
  max-height: 78vh;
  padding: 30rpx 28rpx calc(24rpx + env(safe-area-inset-bottom));
  border-radius: 36rpx 36rpx 0 0;
  background: var(--app-surface-raised);
  &__mask {
    position: fixed;
    inset: 0;
    z-index: 150;
    background: rgba(0, 0, 0, 0.58);
  }
  &__head,
  &__actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
  }
  &__title {
    font-size: 36rpx;
    font-weight: 800;
  }
  &__sub {
    margin-top: 6rpx;
    color: var(--app-text-muted);
    font-size: 24rpx;
  }
  &__close {
    display: grid;
    place-items: center;
    width: 72rpx;
    height: 72rpx;
    border-radius: 22rpx;
    background: var(--app-surface-soft);
    font-size: 40rpx;
  }
  &__body {
    max-height: 54vh;
    margin: 20rpx 0;
  }
  &__group {
    margin-bottom: 28rpx;
  }
  &__group-title {
    margin-bottom: 14rpx;
    font-size: 28rpx;
    font-weight: 700;
  }
  &__grid {
    display: flex;
    flex-wrap: wrap;
    gap: 14rpx;
  }
  &__chip {
    min-width: 132rpx;
    padding: 18rpx 22rpx;
    border: 1rpx solid var(--app-border);
    border-radius: 20rpx;
    text-align: center;
    background: var(--app-surface-soft);
  }
  &__chip--active {
    border-color: #ff6b2c;
    color: #ff5b1f;
    background: rgba(255, 107, 44, 0.12);
    font-weight: 700;
  }
  &__reset,
  &__apply {
    display: grid;
    place-items: center;
    min-height: 88rpx;
    border-radius: 24rpx;
    font-weight: 800;
  }
  &__reset {
    width: 180rpx;
    border: 1rpx solid var(--app-border);
  }
  &__apply {
    flex: 1;
    color: #fff;
    background: linear-gradient(135deg, #ff541f, #ff8a24);
  }
}
</style>
