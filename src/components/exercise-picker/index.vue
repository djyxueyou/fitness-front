<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CustomExerciseDialog from '@/components/custom-exercise-dialog/index.vue'
import ExerciseFilterSheet from '@/components/exercise-filter-sheet/index.vue'
import ExerciseThumbnail from '@/components/exercise-thumbnail/index.vue'
import MembershipRequiredModal from '@/components/membership-required-modal/index.vue'
import {
  createCustomExercise,
  fetchExerciseCategories,
  fetchExerciseFilterMetadata,
  fetchExerciseList,
  fetchFavoriteExercises,
  type ExerciseCategory,
  type ExerciseSummary
} from '@/api/exercise'
import { getToken } from '@/api/http'
import { useExerciseStore } from '@/stores/exercise'
import { useThemeStore } from '@/stores/theme'
import { ensureMembershipFeature } from '@/utils/membership-guard'
import { routes } from '@/utils/navigation'
import {
  activeFilterChips,
  countAdvancedFilters,
  type ExerciseFilterMetadata
} from '@/utils/exercise-filters'
import { pickerCopy, type ExercisePickerContext } from '@/utils/exercise-picker-context'
import { setPendingExerciseSelection } from '@/utils/exercise-selection-session'

type ExerciseRecordType = 'WEIGHT_REPS' | 'BODYWEIGHT_REPS' | 'DURATION'

const PAGE_SIZE = 10
const RECENT_EXERCISES_KEY = 'LIFTLOG_RECENT_EXERCISES'
const QUICK_FILTERS = [
  { code: 'all', name: '全部' },
  { code: 'recent', name: '最近使用' },
  { code: 'favorite', name: '收藏' },
  { code: 'custom', name: '自定义' }
]

const props = defineProps<{
  visible: boolean
  title?: string
  subtitle?: string
  selectedIds?: number[]
  mode?: 'MULTIPLE_ADD' | 'SINGLE_REPLACE'
  context?: ExercisePickerContext
}>()

const emit = defineEmits<{
  close: []
  select: [exercise: ExerciseSummary]
  confirm: [exercises: ExerciseSummary[]]
}>()

const exerciseStore = useExerciseStore()
const themeStore = useThemeStore()
const categoryOptions = ref<Array<{ code: string; name: string }>>([{ code: '', name: '全部' }])
const quickFilter = ref('all')
const activeCategoryCode = ref('')
const activeEquipmentCode = ref('')
const activeDifficultyCode = ref('')
const activeRecordType = ref('')
const keyword = ref('')
const exerciseItems = ref<ExerciseSummary[]>([])
const exercisePageNo = ref(0)
const exerciseTotal = ref(0)
const exerciseLoading = ref(false)
const customSaving = ref(false)
const customDialogVisible = ref(false)
const customDialogName = ref('')
const customDialogRecordType = ref<ExerciseRecordType>('BODYWEIGHT_REPS')
const pendingExercises = ref<ExerciseSummary[]>([])
const filterSheetVisible = ref(false)
const filterMetadata = ref<ExerciseFilterMetadata>({
  equipment: [],
  difficulty: [],
  recordTypes: []
})
let searchTimer: ReturnType<typeof setTimeout> | null = null

const trimmedKeyword = computed(() => keyword.value.trim())
const customExists = computed(() =>
  exerciseItems.value.some((item) => item.name === trimmedKeyword.value)
)
const customCreateTitle = computed(() =>
  trimmedKeyword.value ? `新建自定义动作「${trimmedKeyword.value}」` : '新建自定义动作'
)
const pickerContext = computed<ExercisePickerContext>(
  () => props.context || (props.mode === 'SINGLE_REPLACE' ? 'REPLACE' : 'WORKOUT')
)
const copy = computed(() => pickerCopy(pickerContext.value, pendingExercises.value.length))
const filterState = computed(() => ({
  categoryCode: activeCategoryCode.value,
  equipmentCode: activeEquipmentCode.value,
  difficultyCode: activeDifficultyCode.value,
  recordType: activeRecordType.value
}))
const filterChips = computed(() => activeFilterChips(filterState.value, filterMetadata.value))
const advancedFilterCount = computed(() => countAdvancedFilters(filterState.value))

function readRecentExercises() {
  try {
    const value = uni.getStorageSync(RECENT_EXERCISES_KEY) as ExerciseSummary[] | undefined
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function writeRecentExercise(exercise: ExerciseSummary) {
  const next = [exercise, ...readRecentExercises().filter((item) => item.id !== exercise.id)].slice(
    0,
    20
  )
  uni.setStorageSync(RECENT_EXERCISES_KEY, next)
}

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) return
    pendingExercises.value = []
    if (categoryOptions.value.length <= 1) {
      await Promise.all([loadCategories(), loadFilterMetadata()])
    }
    await loadExercises(true)
  }
)

watch(keyword, () => {
  if (!props.visible) return
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    loadExercises(true)
  }, 300)
})

async function loadFilterMetadata() {
  try {
    filterMetadata.value = await fetchExerciseFilterMetadata()
  } catch {
    filterMetadata.value = {
      equipment: [
        { label: '徒手', value: 'BODYWEIGHT' },
        { label: '杠铃', value: 'BARBELL' },
        { label: '哑铃', value: 'DUMBBELL' },
        { label: '固定器械', value: 'MACHINE' },
        { label: '绳索', value: 'CABLE' },
        { label: '弹力带', value: 'RESISTANCE_BAND' }
      ],
      difficulty: [
        { label: '初级', value: 'BEGINNER' },
        { label: '中级', value: 'INTERMEDIATE' },
        { label: '高级', value: 'ADVANCED' }
      ],
      recordTypes: [
        { label: '重量次数', value: 'WEIGHT_REPS' },
        { label: '自重次数', value: 'BODYWEIGHT_REPS' },
        { label: '计时', value: 'DURATION' }
      ]
    }
  }
}

async function loadCategories() {
  try {
    const categories = await fetchExerciseCategories()
    categoryOptions.value = [
      { code: '', name: '全部' },
      ...categories.map((item: ExerciseCategory) => ({
        code: item.categoryCode,
        name: item.categoryName
      }))
    ]
  } catch (err) {
    console.error('[exercise-picker] categories fetch failed', err)
  }
}

async function loadExercises(reset = false) {
  if (exerciseLoading.value) return
  if (quickFilter.value === 'recent') {
    const recentItems = filterLocalExercises(readRecentExercises())
    exerciseItems.value = recentItems
    exercisePageNo.value = 1
    exerciseTotal.value = recentItems.length
    return
  }
  if (quickFilter.value === 'favorite') {
    if (!(await ensureMembershipFeature('收藏动作'))) {
      exerciseItems.value = []
      exerciseTotal.value = 0
      return
    }
    await loadFavoriteExercises()
    return
  }
  if (!reset && exerciseItems.value.length >= exerciseTotal.value && exerciseTotal.value > 0) {
    return
  }

  exerciseLoading.value = true
  try {
    const page = await fetchExerciseList({
      pageNo: reset ? 1 : exercisePageNo.value + 1,
      pageSize: PAGE_SIZE,
      categoryCode: activeCategoryCode.value || undefined,
      equipmentCode: activeEquipmentCode.value || undefined,
      difficultyCode: activeDifficultyCode.value || undefined,
      recordType: activeRecordType.value || undefined,
      keyword: trimmedKeyword.value || undefined,
      scope: quickFilter.value === 'custom' ? 'CUSTOM' : 'ALL'
    })
    exercisePageNo.value = page.pageNo
    exerciseTotal.value = page.total
    exerciseItems.value = reset ? page.list : [...exerciseItems.value, ...page.list]
  } catch (err) {
    uni.showToast({ title: '动作加载失败', icon: 'none' })
    console.error('[exercise-picker] exercises fetch failed', err)
  } finally {
    exerciseLoading.value = false
  }
}

async function loadFavoriteExercises() {
  exerciseLoading.value = true
  try {
    if (!getToken()) {
      exerciseItems.value = []
      exerciseTotal.value = 0
      return
    }
    const favorites = await fetchFavoriteExercises()
    const items = filterLocalExercises(favorites)
    exerciseItems.value = items
    exercisePageNo.value = 1
    exerciseTotal.value = items.length
  } catch (err) {
    uni.showToast({ title: '收藏动作加载失败', icon: 'none' })
    console.error('[exercise-picker] favorite exercises fetch failed', err)
  } finally {
    exerciseLoading.value = false
  }
}

function filterLocalExercises(list: ExerciseSummary[]) {
  const word = trimmedKeyword.value.toLowerCase()
  return list.filter((item) => {
    const matchedKeyword =
      !word ||
      item.name.toLowerCase().includes(word) ||
      (item.primaryMuscle || '').toLowerCase().includes(word) ||
      (item.equipment || '').toLowerCase().includes(word)
    const matchedCategory =
      !activeCategoryCode.value || item.categoryCode === activeCategoryCode.value
    const matchedEquipment =
      !activeEquipmentCode.value || item.equipmentCode === activeEquipmentCode.value
    const matchedDifficulty =
      !activeDifficultyCode.value || item.difficultyCode === activeDifficultyCode.value
    const matchedRecordType = !activeRecordType.value || item.recordType === activeRecordType.value
    return (
      matchedKeyword &&
      matchedCategory &&
      matchedEquipment &&
      matchedDifficulty &&
      matchedRecordType
    )
  })
}

function switchQuickFilter(code: string) {
  quickFilter.value = code
  activeCategoryCode.value = ''
  loadExercises(true)
}

function switchCategory(categoryCode: string) {
  activeCategoryCode.value = categoryCode
  loadExercises(true)
}

function applyAdvancedFilters(value: typeof filterState.value) {
  activeEquipmentCode.value = value.equipmentCode
  activeDifficultyCode.value = value.difficultyCode
  activeRecordType.value = value.recordType
  filterSheetVisible.value = false
  void loadExercises(true)
}

function removeFilter(key: 'equipmentCode' | 'difficultyCode' | 'recordType') {
  if (key === 'equipmentCode') activeEquipmentCode.value = ''
  if (key === 'difficultyCode') activeDifficultyCode.value = ''
  if (key === 'recordType') activeRecordType.value = ''
  void loadExercises(true)
}

function selectExercise(exercise: ExerciseSummary) {
  if ((props.selectedIds || []).includes(exercise.id)) return
  if (props.mode === 'SINGLE_REPLACE') {
    writeRecentExercise(exercise)
    emit('select', exercise)
    return
  }
  setExerciseSelection(exercise, !pendingExercises.value.some((item) => item.id === exercise.id))
}

function setExerciseSelection(exercise: ExerciseSummary, selected: boolean) {
  if ((props.selectedIds || []).includes(exercise.id)) return
  if (selected) writeRecentExercise(exercise)
  pendingExercises.value = setPendingExerciseSelection(pendingExercises.value, exercise, selected)
}

function confirmSelection() {
  if (!pendingExercises.value.length) return
  pendingExercises.value.forEach(writeRecentExercise)
  emit('confirm', pendingExercises.value)
}

async function createCustomFromKeyword() {
  if (!(await ensureMembershipFeature('自定义动作'))) return
  customDialogName.value = trimmedKeyword.value
  customDialogRecordType.value = 'BODYWEIGHT_REPS'
  customDialogVisible.value = true
}

function closeCustomDialog() {
  customDialogVisible.value = false
}

async function submitCustomExercise(payload: { name: string; recordType: ExerciseRecordType }) {
  if (customSaving.value) return
  if (customExists.value && payload.name === trimmedKeyword.value) {
    uni.showToast({ title: '已存在同名动作', icon: 'none' })
    return
  }

  customSaving.value = true
  try {
    const created = await createCustomExercise(payload)
    exerciseStore.clearListCache()
    const exercise: ExerciseSummary = {
      id: created.id,
      name: payload.name,
      categoryCode: 'custom',
      categoryName: '自定义',
      primaryMuscle: '',
      equipment: '',
      difficultyLevel: 'BEGINNER',
      difficultyCode: 'BEGINNER',
      difficultyName: '初级',
      recordType: payload.recordType,
      exerciseType: 'USER'
    }
    closeCustomDialog()
    selectExercise(exercise)
    uni.showToast({
      title: props.mode === 'SINGLE_REPLACE' ? '已创建' : '已创建并选中',
      icon: 'none'
    })
  } catch (err) {
    uni.showToast({ title: '新建动作失败', icon: 'none' })
    console.error('[exercise-picker] create custom exercise failed', err)
  } finally {
    customSaving.value = false
  }
}

function isSelected(exerciseId: number) {
  return (
    (props.selectedIds || []).includes(exerciseId) ||
    pendingExercises.value.some((item) => item.id === exerciseId)
  )
}

function isAlreadyAdded(exerciseId: number) {
  return (props.selectedIds || []).includes(exerciseId)
}

function openExerciseDetail(exerciseId: number) {
  const selected = pendingExercises.value.some((item) => item.id === exerciseId)
  const locked = (props.selectedIds || []).includes(exerciseId)
  uni.navigateTo({
    url: `${routes.exerciseDetail}?id=${exerciseId}&pickerContext=${pickerContext.value}&pickerSelected=${selected ? 1 : 0}&pickerLocked=${locked ? 1 : 0}`,
    events: {
      exerciseSelected: (
        payload: ExerciseSummary | { exercise: ExerciseSummary; selected: boolean }
      ) => {
        if ('exercise' in payload) {
          setExerciseSelection(payload.exercise, payload.selected)
          return
        }
        selectExercise(payload)
      }
    }
  })
}
</script>

<template>
  <view v-if="visible" class="exercise-picker__mask" :class="themeStore.themeClass">
    <view class="exercise-picker">
      <view class="exercise-picker__head">
        <view>
          <view class="exercise-picker__title">{{ title || '添加动作' }}</view>
          <view class="exercise-picker__sub">{{ subtitle || '搜索并添加到当前训练' }}</view>
        </view>
        <view class="exercise-picker__close btn-press" @tap="emit('close')">×</view>
      </view>

      <view class="glass-card exercise-picker__search">
        <input
          v-model="keyword"
          class="exercise-picker__search-input"
          placeholder="搜索动作、肌群或器械"
          placeholder-class="exercise-picker__placeholder"
        />
      </view>

      <view class="exercise-picker__quick">
        <view
          v-for="item in QUICK_FILTERS"
          :key="item.code"
          class="exercise-picker__quick-item btn-press"
          :class="{ 'exercise-picker__quick-item--active': quickFilter === item.code }"
          @tap="switchQuickFilter(item.code)"
        >
          {{ item.name }}
        </view>
      </view>

      <scroll-view v-if="quickFilter !== 'custom'" scroll-x class="exercise-picker__categories">
        <view class="exercise-picker__categories-inner">
          <view
            v-for="category in categoryOptions"
            :key="category.code || 'all'"
            class="exercise-picker__category btn-press"
            :class="{ 'exercise-picker__category--active': activeCategoryCode === category.code }"
            @tap="switchCategory(category.code)"
          >
            {{ category.name }}
          </view>
        </view>
      </scroll-view>

      <view class="exercise-picker__advanced">
        <view class="exercise-picker__advanced-item btn-press" @tap="filterSheetVisible = true">
          筛选{{ advancedFilterCount ? `（${advancedFilterCount}）` : '' }}
        </view>
        <view
          v-for="chip in filterChips"
          :key="chip.key"
          class="exercise-picker__advanced-item exercise-picker__advanced-item--active btn-press"
          @tap="removeFilter(chip.key)"
        >
          {{ chip.label }} ×
        </view>
      </view>

      <scroll-view scroll-y class="exercise-picker__list" @scrolltolower="loadExercises()">
        <view
          v-if="quickFilter === 'custom'"
          class="glass-card exercise-picker__custom-create btn-press"
          @tap="createCustomFromKeyword"
        >
          <view>
            <view class="exercise-picker__custom-title">{{ customCreateTitle }}</view>
            <view class="exercise-picker__custom-sub">创建后会加入本次训练</view>
          </view>
          <view class="exercise-picker__custom-action">
            {{ customSaving ? '创建中' : '创建' }}
          </view>
        </view>

        <view
          v-for="exercise in exerciseItems"
          :key="exercise.id"
          class="glass-card exercise-picker__item"
          @tap="selectExercise(exercise)"
        >
          <ExerciseThumbnail
            :name="exercise.name"
            :record-type="exercise.recordType"
            :url="exercise.thumbnailUrl"
          />
          <view class="exercise-picker__body">
            <view class="exercise-picker__name">{{ exercise.name }}</view>
            <view class="exercise-picker__meta">
              {{ exercise.categoryName || '自定义' }} · {{ exercise.equipment || '-' }}
            </view>
            <view
              class="exercise-picker__detail btn-press"
              @tap.stop="openExerciseDetail(exercise.id)"
            >
              查看详情
            </view>
          </view>
          <view
            class="exercise-picker__action"
            :class="{ 'exercise-picker__action--selected': isSelected(exercise.id) }"
          >
            {{
              isAlreadyAdded(exercise.id)
                ? copy.existing
                : isSelected(exercise.id)
                  ? '✓ 已选'
                  : copy.action
            }}
          </view>
        </view>

        <view class="exercise-picker__footer">
          {{
            exerciseLoading
              ? '加载中...'
              : exerciseItems.length >= exerciseTotal
                ? '没有更多了'
                : '上拉加载更多'
          }}
        </view>
      </scroll-view>
      <view v-if="mode !== 'SINGLE_REPLACE'" class="exercise-picker__confirm-wrap">
        <view
          class="exercise-picker__confirm btn-press"
          :class="{ 'exercise-picker__confirm--disabled': !pendingExercises.length }"
          @tap="confirmSelection"
        >
          {{ copy.confirm }}
        </view>
      </view>
    </view>

    <CustomExerciseDialog
      :visible="customDialogVisible"
      title="新建自定义动作"
      confirm-text="创建并添加"
      :initial-name="customDialogName"
      :initial-record-type="customDialogRecordType"
      @close="closeCustomDialog"
      @submit="submitCustomExercise"
    />
    <ExerciseFilterSheet
      :visible="filterSheetVisible"
      :model-value="filterState"
      :metadata="filterMetadata"
      :result-count="exerciseTotal"
      @close="filterSheetVisible = false"
      @apply="applyAdvancedFilters"
    />
  </view>
  <MembershipRequiredModal />
</template>

<style lang="scss" scoped>
.exercise-picker {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  top: 120rpx;
  bottom: 0;
  z-index: var(--z-sheet, 110);
  padding: 28rpx;
  border-radius: 36rpx 36rpx 0 0;
  background: var(--app-surface-raised);
  border: 1px solid var(--app-border);
  box-shadow: var(--app-shadow-focus);

  &__mask {
    position: fixed;
    inset: 0;
    z-index: var(--z-mask, 100);
    background: rgba(0, 0, 0, 0.62);
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__title {
    color: var(--app-text);
    font-size: 34rpx;
    font-weight: 800;
  }

  &__sub,
  &__meta,
  &__footer {
    margin-top: 8rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
  }

  &__close {
    width: 68rpx;
    height: 68rpx;
    border-radius: 22rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--app-bg);
    color: var(--app-text);
    font-size: 36rpx;
  }

  &__search {
    margin-top: 24rpx;
    padding: 20rpx 24rpx;
  }

  &__search-input {
    color: var(--app-text);
    font-size: 26rpx;
  }

  &__placeholder {
    color: var(--app-text-muted);
  }

  &__quick {
    display: flex;
    gap: 12rpx;
    margin-top: 18rpx;
  }

  &__quick-item {
    padding: 14rpx 22rpx;
    border-radius: 999rpx;
    background: var(--app-bg);
    color: var(--app-text-secondary);
    font-size: 22rpx;

    &--active {
      background: rgba(255, 80, 30, 0.16);
      color: var(--app-accent);
      font-weight: 800;
    }
  }

  &__categories {
    margin: 20rpx -28rpx;
    white-space: nowrap;
  }

  &__categories-inner {
    display: inline-flex;
    gap: 12rpx;
    padding: 0 28rpx;
  }

  &__advanced {
    display: flex;
    gap: 12rpx;
    margin: -6rpx 0 12rpx;
  }

  &__advanced-item {
    padding: 12rpx 18rpx;
    border-radius: 999rpx;
    background: var(--app-bg);
    color: var(--app-text-secondary);
    font-size: 22rpx;
  }

  &__category {
    padding: 14rpx 22rpx;
    border-radius: 999rpx;
    background: var(--app-bg);
    color: var(--app-text-secondary);
    font-size: 24rpx;

    &--active {
      background: linear-gradient(135deg, #ff501e, #ffa03c);
      color: #fff;
      font-weight: 700;
    }
  }

  &__list {
    height: calc(100vh - 620rpx);
    margin-top: 20rpx;
  }

  &__confirm-wrap {
    position: absolute;
    left: 28rpx;
    right: 28rpx;
    bottom: calc(env(safe-area-inset-bottom) + 20rpx);
  }

  &__confirm {
    padding: 24rpx;
    border-radius: 24rpx;
    text-align: center;
    color: #fff;
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    font-weight: 800;

    &--disabled {
      opacity: 0.42;
    }
  }

  &__custom-create,
  &__item {
    display: flex;
    align-items: center;
    gap: 18rpx;
    padding: 18rpx;
    margin-bottom: 14rpx;
  }

  &__custom-create {
    justify-content: space-between;
    border-color: rgba(255, 80, 30, 0.35);
  }

  &__custom-title {
    color: var(--app-text);
    font-size: 26rpx;
    font-weight: 800;
  }

  &__custom-sub {
    margin-top: 8rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
  }

  &__detail {
    margin-top: 8rpx;
    color: var(--app-info, #2f7df7);
    font-size: 21rpx;
  }

  &__custom-action {
    flex-shrink: 0;
    color: var(--app-accent);
    font-size: 24rpx;
    font-weight: 800;
  }

  &__thumb,
  &__thumb-placeholder {
    width: 84rpx;
    height: 84rpx;
    border-radius: 22rpx;
    flex-shrink: 0;
  }

  &__thumb-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 80, 30, 0.14);
    color: var(--app-accent);
    font-size: 30rpx;
    font-weight: 800;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__name {
    color: var(--app-text);
    font-size: 28rpx;
    font-weight: 700;
  }

  &__action {
    color: var(--app-accent);
    font-size: 24rpx;
    font-weight: 700;

    &--selected {
      color: var(--app-text-muted);
    }
  }

  &__footer {
    padding: 20rpx 0;
    text-align: center;
  }
}
</style>
