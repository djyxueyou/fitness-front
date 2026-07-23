<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppOptionSheet from '@/components/app-option-sheet/index.vue'
import {
  canSubmitCustomExercise,
  initialCustomExerciseCategory,
  initialCustomExerciseEquipment,
  normalizeCustomExerciseCategoryPayload,
  normalizeCustomExerciseOption,
  type CustomExerciseFormMode
} from '@/utils/custom-exercise-form'

type ExerciseRecordType = 'WEIGHT_REPS' | 'BODYWEIGHT_REPS' | 'DURATION'
type ExerciseDifficultyCode = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

interface CategoryOption {
  code: string
  name: string
}

interface SelectOption {
  value: string
  label: string
}

const RECORD_TYPE_OPTIONS: Array<{
  label: string
  value: ExerciseRecordType
  description: string
}> = [
  { label: '自重次数', value: 'BODYWEIGHT_REPS', description: '俯卧撑、卷腹等按次数记录' },
  { label: '重量次数', value: 'WEIGHT_REPS', description: '哑铃、杠铃、器械训练' },
  { label: '计时', value: 'DURATION', description: '平板支撑、靠墙坐等按秒记录' }
]

const DIFFICULTY_OPTIONS: Array<{ label: string; value: ExerciseDifficultyCode }> = [
  { label: '初级', value: 'BEGINNER' },
  { label: '中级', value: 'INTERMEDIATE' },
  { label: '高级', value: 'ADVANCED' }
]

const props = withDefaults(
  defineProps<{
    visible: boolean
    mode?: CustomExerciseFormMode
    title?: string
    confirmText?: string
    categoryOptions?: CategoryOption[]
    equipmentOptions?: SelectOption[]
    initialName?: string
    initialCategoryCode?: string
    initialEquipmentCode?: string
    initialRecordType?: ExerciseRecordType | string
    initialDifficultyCode?: ExerciseDifficultyCode | string
    recordTypeLocked?: boolean
  }>(),
  {
    mode: 'create',
    title: '新建自定义动作',
    confirmText: '创建',
    categoryOptions: () => [],
    equipmentOptions: () => [],
    initialName: '',
    initialCategoryCode: '',
    initialEquipmentCode: '',
    initialRecordType: 'BODYWEIGHT_REPS',
    initialDifficultyCode: 'BEGINNER',
    recordTypeLocked: false
  }
)

const emit = defineEmits<{
  close: []
  submit: [
    payload: {
      name: string
      categoryCode?: string
      categoryName?: string
      equipmentCode?: string
      equipmentName?: string
      recordType: ExerciseRecordType
      difficultyCode: ExerciseDifficultyCode
      difficultyName: string
    }
  ]
}>()

const name = ref('')
const categoryCode = ref('')
const equipmentCode = ref('')
const recordType = ref<ExerciseRecordType>('BODYWEIGHT_REPS')
const difficultyCode = ref<ExerciseDifficultyCode>('BEGINNER')
const equipmentTouched = ref(false)
const activeOptionSheet = ref<'category' | 'equipment' | null>(null)

const selectableCategories = computed<SelectOption[]>(() => {
  const options = props.categoryOptions
    .filter((item) => item.code && item.code !== 'custom')
    .map((item) => ({ value: item.code, label: item.name }))
  if (
    props.mode === 'edit' &&
    categoryCode.value &&
    !options.some((item) => item.value === categoryCode.value)
  ) {
    return [
      { value: '', label: '暂不设置' },
      { value: categoryCode.value, label: '当前训练部位' },
      ...options
    ]
  }
  return [{ value: '', label: '暂不设置' }, ...options]
})
const selectableEquipment = computed<SelectOption[]>(() => [
  { value: '', label: '暂不设置' },
  ...props.equipmentOptions.filter((item) => item.value)
])
const categoryLabel = computed(
  () =>
    selectableCategories.value.find((item) => item.value === categoryCode.value)?.label ||
    '暂不设置'
)
const equipmentLabel = computed(
  () =>
    selectableEquipment.value.find((item) => item.value === equipmentCode.value)?.label ||
    '暂不设置'
)
const canSubmit = computed(() => canSubmitCustomExercise(name.value))
const recordTypeDescription = computed(
  () =>
    RECORD_TYPE_OPTIONS.find((item) => item.value === recordType.value)?.description ||
    '选择训练数据的记录方式'
)

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    name.value = props.initialName || ''
    categoryCode.value = initialCustomExerciseCategory(props.mode, props.initialCategoryCode)
    recordType.value = normalizeRecordType(props.initialRecordType)
    equipmentCode.value = initialCustomExerciseEquipment(
      props.mode,
      recordType.value,
      props.initialEquipmentCode
    )
    difficultyCode.value = normalizeDifficultyCode(props.initialDifficultyCode)
    equipmentTouched.value = props.mode === 'edit'
    activeOptionSheet.value = null
  },
  { immediate: true }
)

function normalizeRecordType(value?: string): ExerciseRecordType {
  if (value === 'WEIGHT_REPS' || value === 'DURATION' || value === 'BODYWEIGHT_REPS') return value
  return 'BODYWEIGHT_REPS'
}

function normalizeDifficultyCode(value?: string): ExerciseDifficultyCode {
  if (value === 'INTERMEDIATE' || value === 'ADVANCED' || value === 'BEGINNER') return value
  return 'BEGINNER'
}

function selectType(value: ExerciseRecordType) {
  if (props.recordTypeLocked) {
    uni.showToast({ title: '已有训练记录，不能修改记录类型', icon: 'none' })
    return
  }
  recordType.value = value
  if (!equipmentTouched.value && props.mode === 'create') {
    equipmentCode.value = initialCustomExerciseEquipment('create', value)
  }
}

function selectDifficulty(value: ExerciseDifficultyCode) {
  difficultyCode.value = value
}

function selectCategory(value: string) {
  categoryCode.value = value
  activeOptionSheet.value = null
}

function selectEquipment(value: string) {
  equipmentCode.value = value
  equipmentTouched.value = true
  activeOptionSheet.value = null
}

function submit() {
  const trimmedName = name.value.trim()
  if (!trimmedName) {
    uni.showToast({ title: '请输入动作名称', icon: 'none' })
    return
  }
  const category = normalizeCustomExerciseCategoryPayload(
    props.mode,
    categoryCode.value,
    selectableCategories.value
  )
  const equipment = normalizeCustomExerciseOption(equipmentCode.value, selectableEquipment.value)
  const difficulty = DIFFICULTY_OPTIONS.find((item) => item.value === difficultyCode.value)
  emit('submit', {
    name: trimmedName,
    categoryCode: category.code,
    categoryName: category.name,
    equipmentCode: equipment.code,
    equipmentName: equipment.name,
    recordType: recordType.value,
    difficultyCode: difficultyCode.value,
    difficultyName: difficulty?.label || '初级'
  })
}
</script>

<template>
  <view v-if="visible" class="custom-exercise-dialog__mask" @tap="emit('close')">
    <view class="custom-exercise-dialog" @tap.stop>
      <view class="custom-exercise-dialog__handle" />
      <view class="custom-exercise-dialog__head">
        <view>
          <view class="custom-exercise-dialog__title">{{ title }}</view>
          <view class="custom-exercise-dialog__sub">仅当前账号可见，可用于训练和模板</view>
        </view>
        <view class="custom-exercise-dialog__close btn-press" @tap="emit('close')">×</view>
      </view>

      <scroll-view scroll-y class="custom-exercise-dialog__scroll">
        <view class="custom-exercise-dialog__field">
          <view class="custom-exercise-dialog__label">动作名称</view>
          <input
            v-model="name"
            class="custom-exercise-dialog__input"
            placeholder="例如：弹力带肩外旋"
            placeholder-class="custom-exercise-dialog__placeholder"
          />
        </view>

        <view class="custom-exercise-dialog__section-title">动作信息</view>
        <view
          class="custom-exercise-dialog__select-row btn-press"
          @tap="activeOptionSheet = 'category'"
        >
          <view>
            <view class="custom-exercise-dialog__label">训练部位</view>
            <view
              class="custom-exercise-dialog__select-value"
              :class="{ 'custom-exercise-dialog__select-value--empty': !categoryCode }"
            >
              {{ categoryLabel }}
            </view>
          </view>
          <image
            class="custom-exercise-dialog__arrow"
            src="/static/icons/chevron-down.svg"
            mode="aspectFit"
          />
        </view>
        <view
          class="custom-exercise-dialog__select-row btn-press"
          @tap="activeOptionSheet = 'equipment'"
        >
          <view>
            <view class="custom-exercise-dialog__label">器械</view>
            <view class="custom-exercise-dialog__select-value">{{ equipmentLabel }}</view>
          </view>
          <image
            class="custom-exercise-dialog__arrow"
            src="/static/icons/chevron-down.svg"
            mode="aspectFit"
          />
        </view>

        <view class="custom-exercise-dialog__label custom-exercise-dialog__label--spaced"
          >记录类型</view
        >
        <view v-if="recordTypeLocked" class="custom-exercise-dialog__lock-tip"
          >已有训练记录，记录类型已锁定；名称、部位、器械和难度仍可修改。</view
        >
        <view class="custom-exercise-dialog__types">
          <view
            v-for="item in RECORD_TYPE_OPTIONS"
            :key="item.value"
            class="custom-exercise-dialog__type btn-press"
            :class="{
              'custom-exercise-dialog__type--active': recordType === item.value,
              'custom-exercise-dialog__type--locked': recordTypeLocked && recordType !== item.value
            }"
            @tap="selectType(item.value)"
          >
            <view class="custom-exercise-dialog__type-name">{{ item.label }}</view>
            <view class="custom-exercise-dialog__type-desc">{{ item.description }}</view>
          </view>
        </view>
        <view class="custom-exercise-dialog__type-hint">{{ recordTypeDescription }}</view>

        <view class="custom-exercise-dialog__label custom-exercise-dialog__label--spaced"
          >难度</view
        >
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
        <view class="custom-exercise-dialog__scroll-bottom" />
      </scroll-view>

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

  <AppOptionSheet
    :visible="visible && activeOptionSheet === 'category'"
    title="选择训练部位"
    subtitle="可暂不设置，之后仍可编辑"
    :items="selectableCategories"
    :model-value="categoryCode"
    @close="activeOptionSheet = null"
    @select="selectCategory"
  />
  <AppOptionSheet
    :visible="visible && activeOptionSheet === 'equipment'"
    title="选择器械"
    subtitle="选择最接近的主要器械"
    :items="selectableEquipment"
    :model-value="equipmentCode"
    @close="activeOptionSheet = null"
    @select="selectEquipment"
  />
</template>

<style lang="scss" scoped>
.custom-exercise-dialog {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 161;
  height: 86vh;
  max-height: 86vh;
  padding: 16rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 36rpx 36rpx 0 0;
  background: var(--app-surface-raised);
  border: 1px solid var(--app-border);
  box-shadow: var(--app-shadow-focus);
  display: flex;
  flex-direction: column;

  &__mask {
    position: fixed;
    inset: 0;
    z-index: 160;
    background: rgba(0, 0, 0, 0.68);
    backdrop-filter: blur(10rpx);
  }
  &__handle {
    width: 72rpx;
    height: 8rpx;
    margin: 0 auto 18rpx;
    border-radius: 999rpx;
    background: var(--app-border);
    flex-shrink: 0;
  }
  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18rpx;
    flex-shrink: 0;
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
  &__scroll {
    height: 0;
    min-height: 0;
    flex: 1;
    margin-top: 20rpx;
  }
  &__field {
    padding: 22rpx;
    border-radius: 26rpx;
    background: var(--app-bg);
    border: 1px solid var(--app-border);
  }
  &__label,
  &__section-title {
    color: var(--app-text);
    font-size: 24rpx;
    font-weight: 900;
  }
  &__section-title {
    margin: 26rpx 0 14rpx;
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
  &__select-row {
    min-height: 92rpx;
    margin-top: 12rpx;
    padding: 18rpx 22rpx;
    border-radius: 24rpx;
    background: var(--app-surface);
    border: 1px solid var(--app-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  &__select-value {
    margin-top: 8rpx;
    color: var(--app-text-secondary);
    font-size: 24rpx;
    font-weight: 800;
  }
  &__select-value--empty {
    color: var(--app-text-muted);
  }
  &__arrow {
    width: 34rpx;
    height: 34rpx;
    transform: rotate(-90deg);
  }
  &__lock-tip {
    margin-top: 12rpx;
    padding: 14rpx 18rpx;
    border-radius: 18rpx;
    color: var(--app-text-secondary);
    background: var(--app-bg);
    font-size: 21rpx;
    line-height: 1.5;
  }
  &__types {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8rpx;
    margin-top: 10rpx;
  }
  &__type {
    min-height: 60rpx;
    padding: 8rpx 6rpx;
    border-radius: 24rpx;
    background: var(--app-surface);
    border: 1px solid var(--app-border);
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  &__type--active {
    background: var(--app-accent-soft);
    border-color: rgba(255, 80, 30, 0.52);
    box-shadow: 0 0 24rpx rgba(255, 80, 30, 0.13);
  }
  &__type--locked {
    opacity: 0.45;
  }
  &__type-name {
    color: var(--app-text);
    font-size: 26rpx;
    font-weight: 900;
  }
  &__type-desc {
    display: none;
  }
  &__type-hint {
    display: block;
    min-height: 30rpx;
    margin-top: 8rpx;
    color: var(--app-text-muted);
    font-size: 20rpx;
    line-height: 1.4;
    text-align: center;
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
  }
  &__difficulty-chip--active {
    background: var(--app-accent-soft);
    border-color: rgba(255, 80, 30, 0.52);
    color: var(--app-accent);
  }
  &__scroll-bottom {
    height: 24rpx;
  }
  &__actions {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    gap: 16rpx;
    padding-top: 18rpx;
    border-top: 1px solid var(--app-border);
    background: var(--app-surface-raised);
    flex-shrink: 0;
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
  }
  &__confirm--disabled {
    opacity: 0.45;
  }
}

@media screen and (max-height: 740px) {
  .custom-exercise-dialog {
    height: 88vh;
    max-height: 88vh;
    padding-top: 12rpx;

    &__handle {
      margin-bottom: 12rpx;
    }
    &__scroll {
      margin-top: 12rpx;
    }
    &__field {
      padding: 16rpx 20rpx;
    }
    &__section-title {
      margin: 18rpx 0 10rpx;
    }
    &__label--spaced {
      margin-top: 16rpx;
    }
    &__input {
      margin-top: 8rpx;
      min-height: 52rpx;
    }
    &__select-row {
      min-height: 78rpx;
      margin-top: 8rpx;
      padding: 12rpx 18rpx;
    }
    &__select-value {
      margin-top: 4rpx;
    }
    &__sub {
      margin-top: 4rpx;
      line-height: 1.35;
    }
    &__difficulty {
      margin-top: 8rpx;
    }
    &__difficulty-chip {
      min-height: 56rpx;
    }
    &__scroll-bottom {
      height: 16rpx;
    }
    &__actions {
      padding-top: 12rpx;
    }
    &__cancel,
    &__confirm {
      min-height: 68rpx;
    }
  }
}
</style>
