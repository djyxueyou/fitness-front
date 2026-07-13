<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type ExerciseRecordType = 'WEIGHT_REPS' | 'BODYWEIGHT_REPS' | 'DURATION'
type ExerciseDifficultyCode = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

const RECORD_TYPE_OPTIONS: Array<{
  label: string
  value: ExerciseRecordType
  description: string
}> = [
  { label: '自重次数', value: 'BODYWEIGHT_REPS', description: '俯卧撑、卷腹等按次数记录' },
  { label: '重量次数', value: 'WEIGHT_REPS', description: '哑铃、杠铃、器械训练' },
  { label: '计时', value: 'DURATION', description: '平板支撑、靠墙坐等按秒记录' }
]

const DIFFICULTY_OPTIONS: Array<{
  label: string
  value: ExerciseDifficultyCode
}> = [
  { label: '初级', value: 'BEGINNER' },
  { label: '中级', value: 'INTERMEDIATE' },
  { label: '高级', value: 'ADVANCED' }
]

const props = withDefaults(
  defineProps<{
    visible: boolean
    title?: string
    confirmText?: string
    initialName?: string
    initialRecordType?: ExerciseRecordType | string
    initialDifficultyCode?: ExerciseDifficultyCode | string
  }>(),
  {
    title: '新建自定义动作',
    confirmText: '创建',
    initialName: '',
    initialRecordType: 'BODYWEIGHT_REPS',
    initialDifficultyCode: 'BEGINNER'
  }
)

const emit = defineEmits<{
  close: []
  submit: [
    payload: {
      name: string
      recordType: ExerciseRecordType
      difficultyCode: ExerciseDifficultyCode
      difficultyName: string
    }
  ]
}>()

const name = ref('')
const recordType = ref<ExerciseRecordType>('BODYWEIGHT_REPS')
const difficultyCode = ref<ExerciseDifficultyCode>('BEGINNER')

const canSubmit = computed(() => !!name.value.trim())

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    name.value = props.initialName || ''
    recordType.value = normalizeRecordType(props.initialRecordType)
    difficultyCode.value = normalizeDifficultyCode(props.initialDifficultyCode)
  },
  { immediate: true }
)

function normalizeRecordType(value?: string): ExerciseRecordType {
  if (value === 'WEIGHT_REPS' || value === 'DURATION' || value === 'BODYWEIGHT_REPS') {
    return value
  }
  return 'BODYWEIGHT_REPS'
}

function normalizeDifficultyCode(value?: string): ExerciseDifficultyCode {
  if (value === 'INTERMEDIATE' || value === 'ADVANCED' || value === 'BEGINNER') {
    return value
  }
  return 'BEGINNER'
}

function selectType(value: ExerciseRecordType) {
  recordType.value = value
}

function selectDifficulty(value: ExerciseDifficultyCode) {
  difficultyCode.value = value
}

function submit() {
  const trimmedName = name.value.trim()
  if (!trimmedName) {
    uni.showToast({ title: '请输入动作名称', icon: 'none' })
    return
  }
  const difficulty = DIFFICULTY_OPTIONS.find((item) => item.value === difficultyCode.value)
  emit('submit', {
    name: trimmedName,
    recordType: recordType.value,
    difficultyCode: difficultyCode.value,
    difficultyName: difficulty?.label || '初级'
  })
}
</script>

<template>
  <view v-if="visible" class="custom-exercise-dialog__mask">
    <view class="custom-exercise-dialog">
      <view class="custom-exercise-dialog__head">
        <view>
          <view class="custom-exercise-dialog__title">{{ title }}</view>
          <view class="custom-exercise-dialog__sub">仅当前账号可见，可用于训练和模板</view>
        </view>
        <view class="custom-exercise-dialog__close btn-press" @tap="emit('close')">×</view>
      </view>

      <view class="custom-exercise-dialog__field">
        <view class="custom-exercise-dialog__label">动作名称</view>
        <input
          v-model="name"
          class="custom-exercise-dialog__input"
          placeholder="例如：弹力带肩外旋"
          placeholder-class="custom-exercise-dialog__placeholder"
          focus
        />
      </view>

      <view class="custom-exercise-dialog__label">记录类型</view>
      <view class="custom-exercise-dialog__types">
        <view
          v-for="item in RECORD_TYPE_OPTIONS"
          :key="item.value"
          class="custom-exercise-dialog__type btn-press"
          :class="{ 'custom-exercise-dialog__type--active': recordType === item.value }"
          @tap="selectType(item.value)"
        >
          <view class="custom-exercise-dialog__type-name">{{ item.label }}</view>
          <view class="custom-exercise-dialog__type-desc">{{ item.description }}</view>
        </view>
      </view>

      <view class="custom-exercise-dialog__label custom-exercise-dialog__label--spaced">难度</view>
      <view class="custom-exercise-dialog__difficulty">
        <view
          v-for="item in DIFFICULTY_OPTIONS"
          :key="item.value"
          class="custom-exercise-dialog__difficulty-chip btn-press"
          :class="{
            'custom-exercise-dialog__difficulty-chip--active': difficultyCode === item.value
          }"
          @tap="selectDifficulty(item.value)"
        >
          {{ item.label }}
        </view>
      </view>

      <view class="custom-exercise-dialog__actions">
        <view class="custom-exercise-dialog__cancel btn-press" @tap="emit('close')">取消</view>
        <view
          class="custom-exercise-dialog__confirm btn-press"
          :class="{ 'custom-exercise-dialog__confirm--disabled': !canSubmit }"
          @tap="submit"
        >
          {{ confirmText }}
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.custom-exercise-dialog {
  position: fixed;
  left: 36rpx;
  right: 36rpx;
  top: 50%;
  z-index: 71;
  transform: translateY(-50%);
  padding: 32rpx;
  border-radius: 34rpx;
  background: var(--app-surface-raised);
  border: 1px solid var(--app-border);
  box-shadow: var(--app-shadow-focus);

  &__mask {
    position: fixed;
    inset: 0;
    z-index: 70;
    background: rgba(0, 0, 0, 0.68);
    backdrop-filter: blur(10rpx);
  }

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18rpx;
  }

  &__title {
    color: var(--app-text);
    font-size: 34rpx;
    font-weight: 900;
  }

  &__sub,
  &__type-desc {
    margin-top: 8rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
    line-height: 1.45;
  }

  &__close {
    width: 64rpx;
    height: 64rpx;
    border-radius: 22rpx;
    background: var(--app-bg);
    color: var(--app-text);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 38rpx;
    flex-shrink: 0;
  }

  &__field {
    margin: 30rpx 0 26rpx;
    padding: 22rpx;
    border-radius: 26rpx;
    background: var(--app-bg);
    border: 1px solid var(--app-border);
  }

  &__label {
    color: var(--app-text);
    font-size: 24rpx;
    font-weight: 900;
  }

  &__label--spaced {
    margin-top: 24rpx;
  }

  &__input {
    margin-top: 14rpx;
    min-height: 68rpx;
    color: var(--app-text);
    font-size: 30rpx;
    font-weight: 800;
  }

  &__placeholder {
    color: var(--app-text-muted);
  }

  &__types {
    display: flex;
    flex-direction: column;
    gap: 14rpx;
    margin-top: 16rpx;
  }

  &__type {
    padding: 20rpx 22rpx;
    border-radius: 24rpx;
    background: var(--app-surface);
    border: 1px solid var(--app-border);

    &--active {
      background: var(--app-accent-soft);
      border-color: rgba(255, 80, 30, 0.52);
      box-shadow: 0 0 24rpx rgba(255, 80, 30, 0.13);
    }
  }

  &__type-name {
    color: var(--app-text);
    font-size: 26rpx;
    font-weight: 900;
  }

  &__difficulty {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12rpx;
    margin-top: 14rpx;
  }

  &__difficulty-chip {
    min-height: 64rpx;
    border-radius: 999rpx;
    background: var(--app-surface);
    border: 1px solid var(--app-border);
    color: var(--app-text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24rpx;
    font-weight: 900;

    &--active {
      background: var(--app-accent-soft);
      border-color: rgba(255, 80, 30, 0.52);
      color: var(--app-accent);
    }
  }

  &__actions {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    gap: 16rpx;
    margin-top: 30rpx;
  }

  &__cancel,
  &__confirm {
    min-height: 76rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26rpx;
    font-weight: 900;
  }

  &__cancel {
    color: var(--app-text-secondary);
    background: var(--app-bg);
  }

  &__confirm {
    color: #fff;
    background: linear-gradient(135deg, #ff501e, #ffa03c);

    &--disabled {
      opacity: 0.45;
    }
  }
}
</style>
