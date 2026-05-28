<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type ExerciseRecordType = 'WEIGHT_REPS' | 'BODYWEIGHT_REPS' | 'DURATION'

const RECORD_TYPE_OPTIONS: Array<{
  label: string
  value: ExerciseRecordType
  description: string
}> = [
  { label: '自重次数', value: 'BODYWEIGHT_REPS', description: '俯卧撑、卷腹等按次数记录' },
  { label: '重量次数', value: 'WEIGHT_REPS', description: '哑铃、杠铃、器械训练' },
  { label: '计时', value: 'DURATION', description: '平板支撑、靠墙坐等按秒记录' }
]

const props = withDefaults(
  defineProps<{
    visible: boolean
    title?: string
    confirmText?: string
    initialName?: string
    initialRecordType?: ExerciseRecordType | string
  }>(),
  {
    title: '新建自定义动作',
    confirmText: '创建',
    initialName: '',
    initialRecordType: 'BODYWEIGHT_REPS'
  }
)

const emit = defineEmits<{
  close: []
  submit: [payload: { name: string; recordType: ExerciseRecordType }]
}>()

const name = ref('')
const recordType = ref<ExerciseRecordType>('BODYWEIGHT_REPS')

const canSubmit = computed(() => !!name.value.trim())

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    name.value = props.initialName || ''
    recordType.value = normalizeRecordType(props.initialRecordType)
  },
  { immediate: true }
)

function normalizeRecordType(value?: string): ExerciseRecordType {
  if (value === 'WEIGHT_REPS' || value === 'DURATION' || value === 'BODYWEIGHT_REPS') {
    return value
  }
  return 'BODYWEIGHT_REPS'
}

function selectType(value: ExerciseRecordType) {
  recordType.value = value
}

function submit() {
  const trimmedName = name.value.trim()
  if (!trimmedName) {
    uni.showToast({ title: '请输入动作名称', icon: 'none' })
    return
  }
  emit('submit', { name: trimmedName, recordType: recordType.value })
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
  background: #121219;
  border: 1px solid rgba(255, 80, 30, 0.18);
  box-shadow: 0 28rpx 80rpx rgba(0, 0, 0, 0.5);

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
    color: #f5f5fa;
    font-size: 34rpx;
    font-weight: 900;
  }

  &__sub,
  &__type-desc {
    margin-top: 8rpx;
    color: #8b8ba0;
    font-size: 22rpx;
    line-height: 1.45;
  }

  &__close {
    width: 64rpx;
    height: 64rpx;
    border-radius: 22rpx;
    background: rgba(255, 255, 255, 0.07);
    color: #f5f5fa;
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
    background: rgba(255, 255, 255, 0.045);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  &__label {
    color: #f5f5fa;
    font-size: 24rpx;
    font-weight: 900;
  }

  &__input {
    margin-top: 14rpx;
    min-height: 68rpx;
    color: #fff;
    font-size: 30rpx;
    font-weight: 800;
  }

  &__placeholder {
    color: #6f6f82;
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
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);

    &--active {
      background: rgba(255, 80, 30, 0.14);
      border-color: rgba(255, 80, 30, 0.52);
      box-shadow: 0 0 24rpx rgba(255, 80, 30, 0.13);
    }
  }

  &__type-name {
    color: #f5f5fa;
    font-size: 26rpx;
    font-weight: 900;
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
    color: #b8b8c8;
    background: rgba(255, 255, 255, 0.07);
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
