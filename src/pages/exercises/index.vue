<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import CustomExerciseDialog from '@/components/custom-exercise-dialog/index.vue'
import EmptyState from '@/components/empty-state/index.vue'
import ExerciseItem from '@/components/exercise-item/index.vue'
import MembershipRequiredModal from '@/components/membership-required-modal/index.vue'
import WorkoutDraftFab from '@/components/workout-draft-fab/index.vue'
import WorkoutDraftPrompt from '@/components/workout-draft-prompt/index.vue'
import { getToken } from '@/api/http'
import { useExerciseStore } from '@/stores/exercise'
import { useWorkoutStore } from '@/stores/workout'
import { useWorkoutDraftPromptStore } from '@/stores/workout-draft-prompt'
import { useThemeStore } from '@/stores/theme'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { ensureMembershipFeature } from '@/utils/membership-guard'
import { offAuthChanged, onAuthChanged } from '@/utils/auth-events'
import { routes } from '@/utils/navigation'

type ExerciseRecordType = 'WEIGHT_REPS' | 'BODYWEIGHT_REPS' | 'DURATION'
type ExerciseScope = 'ALL' | 'CUSTOM' | 'FAVORITES'
type ExerciseListScope = 'ALL' | 'CUSTOM'
type ExerciseDifficultyCode = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

const exerciseStore = useExerciseStore()
const workoutStore = useWorkoutStore()
const draftPromptStore = useWorkoutDraftPromptStore()
const themeStore = useThemeStore()
const activeCategoryCode = ref('')
const activeScope = ref<ExerciseScope>('ALL')
const activeEquipmentCode = ref('')
const activeDifficultyCode = ref('')
const activeRecordType = ref('')
const draftEquipmentCode = ref('')
const draftDifficultyCode = ref('')
const draftRecordType = ref('')
const searchText = ref('')
const filterSheetVisible = ref(false)
const customDialogVisible = ref(false)
const customDialogMode = ref<'create' | 'edit'>('create')
const customDialogName = ref('')
const customDialogRecordType = ref<ExerciseRecordType>('BODYWEIGHT_REPS')
const customDialogDifficultyCode = ref<ExerciseDifficultyCode>('BEGINNER')
const editingCustomId = ref<number | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const initialLoading = computed(() => exerciseStore.loading && !exerciseStore.items.length)
const footerText = computed(() => {
  if (activeScope.value === 'FAVORITES') return ''
  if (exerciseStore.loading && exerciseStore.items.length) return '加载中...'
  if (exerciseStore.items.length && !exerciseStore.hasMore) return '没有更多动作了'
  if (exerciseStore.items.length) return '上拉加载更多'
  return ''
})
const emptyTitle = computed(() =>
  activeScope.value === 'CUSTOM'
    ? '还没有自定义动作'
    : activeScope.value === 'FAVORITES'
      ? '还没有收藏动作'
      : '当前条件没有动作'
)
const emptyDescription = computed(() =>
  activeScope.value === 'CUSTOM'
    ? '可以新建只属于你的动作，用于训练记录和模板编排。'
    : activeScope.value === 'FAVORITES'
      ? '收藏常用动作后，可以在这里快速找到。'
      : '可以切换分类，或清空搜索关键词后再试。'
)
const equipmentOptions = [
  { label: '全部器械', value: '' },
  { label: '徒手', value: 'BODYWEIGHT' },
  { label: '杠铃', value: 'BARBELL' },
  { label: '哑铃', value: 'DUMBBELL' },
  { label: '固定器械', value: 'MACHINE' },
  { label: '绳索', value: 'CABLE' },
  { label: '史密斯机', value: 'SMITH_MACHINE' },
  { label: '单杠', value: 'PULL_UP_BAR' },
  { label: '双杠', value: 'PARALLEL_BARS' },
  { label: '弹力带', value: 'RESISTANCE_BAND' },
  { label: '壶铃', value: 'KETTLEBELL' }
]
const difficultyOptions = [
  { label: '全部难度', value: '' },
  { label: '初级', value: 'BEGINNER' },
  { label: '中级', value: 'INTERMEDIATE' },
  { label: '高级', value: 'ADVANCED' }
]
const recordTypeOptions = [
  { label: '全部类型', value: '' },
  { label: '重量次数', value: 'WEIGHT_REPS' },
  { label: '自重次数', value: 'BODYWEIGHT_REPS' },
  { label: '计时', value: 'DURATION' }
]
const activeFilterCount = computed(
  () =>
    [activeEquipmentCode.value, activeDifficultyCode.value, activeRecordType.value].filter(Boolean)
      .length
)
const hasClearableConditions = computed(
  () => !!searchText.value.trim() || activeFilterCount.value > 0
)
const visibleExercises = computed(() => {
  const source =
    activeScope.value === 'FAVORITES' ? exerciseStore.favorites : exerciseStore.items
  return source.filter((item) => {
    const keyword = searchText.value.trim().toLowerCase()
    const matchesKeyword =
      !keyword ||
      [item.name, item.category, item.muscle, item.equipment, item.equipmentName, item.equipmentDetail]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    const matchesEquipment = !activeEquipmentCode.value || item.equipmentCode === activeEquipmentCode.value
    const matchesDifficulty = !activeDifficultyCode.value || item.difficultyCode === activeDifficultyCode.value
    const matchesRecordType = !activeRecordType.value || item.recordType === activeRecordType.value
    return matchesKeyword && matchesEquipment && matchesDifficulty && matchesRecordType
  })
})
const filterSummary = computed(() =>
  [
    `器械：${findOptionLabel(equipmentOptions, activeEquipmentCode.value)}`,
    `难度：${findOptionLabel(difficultyOptions, activeDifficultyCode.value)}`,
    `类型：${findOptionLabel(recordTypeOptions, activeRecordType.value)}`
  ].join(' · ')
)

onLoad(async () => {
  onAuthChanged(refreshAfterAuthChanged)
  await exerciseStore.fetchCategories()
  await exerciseStore.fetchExercises({ reset: true, force: true })
})

onUnload(() => {
  offAuthChanged(refreshAfterAuthChanged)
})

watch(searchText, () => {
  if (activeScope.value === 'FAVORITES') return
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    exerciseStore.fetchExercises({
      reset: true,
      categoryCode: activeCategoryCode.value,
      keyword: searchText.value,
      scope: activeScope.value === 'CUSTOM' ? 'CUSTOM' : 'ALL',
      equipmentCode: activeEquipmentCode.value,
      difficultyCode: activeDifficultyCode.value,
      recordType: activeRecordType.value
    })
  }, 300)
})

function currentQueryOptions(): {
  categoryCode: string
  keyword: string
  scope: ExerciseListScope
  equipmentCode: string
  difficultyCode: string
  recordType: string
} {
  return {
    categoryCode: activeCategoryCode.value,
    keyword: searchText.value,
    scope: activeScope.value === 'CUSTOM' ? 'CUSTOM' : 'ALL',
    equipmentCode: activeEquipmentCode.value,
    difficultyCode: activeDifficultyCode.value,
    recordType: activeRecordType.value
  }
}

async function switchCategory(categoryCode: string) {
  if (categoryCode === '__favorites') {
    const ok = await ensureMembershipFeature('我的收藏')
    if (!ok) return
    activeScope.value = 'FAVORITES'
    activeCategoryCode.value = ''
    await exerciseStore.refreshFavoriteStates()
    return
  }
  if (categoryCode === '__custom') {
    activeScope.value = 'CUSTOM'
    activeCategoryCode.value = ''
  } else {
    activeScope.value = 'ALL'
    activeCategoryCode.value = categoryCode
  }
  exerciseStore.fetchExercises({ reset: true, ...currentQueryOptions() })
}

function reloadExercises() {
  exerciseStore.fetchExercises({ reset: true, force: true, ...currentQueryOptions() })
}

function loadMore() {
  if (activeScope.value === 'FAVORITES') return
  exerciseStore.fetchExercises(currentQueryOptions())
}

async function openDraftFab() {
  workoutStore.refreshDraftState()
  const action = await draftPromptStore.open()
  if (action === 'continue') {
    if (workoutStore.restoreDraft()) {
      uni.navigateTo({ url: routes.workoutActive })
    }
  }
  if (action === 'discard') {
    workoutStore.discardWorkout()
  }
}

function switchFilter(type: 'equipment' | 'difficulty' | 'recordType', value: string) {
  if (type === 'equipment') draftEquipmentCode.value = value
  if (type === 'difficulty') draftDifficultyCode.value = value
  if (type === 'recordType') draftRecordType.value = value
}

function findOptionLabel(options: Array<{ label: string; value: string }>, value: string) {
  if (!value) return '全部'
  const option = options.find((item) => item.value === value)
  return option ? option.label : '全部'
}

function openFilterSheet() {
  draftEquipmentCode.value = activeEquipmentCode.value
  draftDifficultyCode.value = activeDifficultyCode.value
  draftRecordType.value = activeRecordType.value
  filterSheetVisible.value = true
}

function closeFilterSheet() {
  filterSheetVisible.value = false
}

function clearAdvancedFilters() {
  if (!draftEquipmentCode.value && !draftDifficultyCode.value && !draftRecordType.value) {
    return
  }
  draftEquipmentCode.value = ''
  draftDifficultyCode.value = ''
  draftRecordType.value = ''
}

function applyAdvancedFilters() {
  const changed =
    activeEquipmentCode.value !== draftEquipmentCode.value ||
    activeDifficultyCode.value !== draftDifficultyCode.value ||
    activeRecordType.value !== draftRecordType.value
  activeEquipmentCode.value = draftEquipmentCode.value
  activeDifficultyCode.value = draftDifficultyCode.value
  activeRecordType.value = draftRecordType.value
  filterSheetVisible.value = false
  if (changed && activeScope.value !== 'FAVORITES') {
    exerciseStore.fetchExercises({ reset: true, ...currentQueryOptions() })
  }
}

function clearConditions() {
  if (!hasClearableConditions.value) return
  searchText.value = ''
  activeEquipmentCode.value = ''
  activeDifficultyCode.value = ''
  activeRecordType.value = ''
  if (activeScope.value === 'FAVORITES') return
  exerciseStore.fetchExercises({ reset: true, ...currentQueryOptions() })
}

async function refreshAfterAuthChanged() {
  exerciseStore.clearListCache()
  await reloadExercises()
  await exerciseStore.refreshFavoriteStates()
}

async function openDetail(id: number) {
  if (!Number.isFinite(id) || id <= 0) {
    console.error('[exercise] invalid detail id', id)
    uni.showToast({ title: '动作参数错误', icon: 'none' })
    return
  }
  uni.navigateTo({ url: `${routes.exerciseDetail}?id=${id}` })
}

async function onFavorite(id: number) {
  const wasLoggedIn = !!getToken()
  const ok = await ensureFeatureAuth('收藏动作')
  if (!ok) return

  if (!wasLoggedIn) {
    await exerciseStore.refreshFavoriteStates()
    uni.showToast({ title: '已登录，请再次点击收藏', icon: 'none' })
    return
  }

  if (!(await ensureMembershipFeature('收藏动作'))) return
  await exerciseStore.toggleFavorite(id)
}

async function createCustomExercise() {
  if (!(await ensureMembershipFeature('自定义动作'))) return
  const ok = await ensureFeatureAuth('自定义动作')
  if (!ok) return
  editingCustomId.value = null
  customDialogMode.value = 'create'
  customDialogName.value = searchText.value.trim()
  customDialogRecordType.value = 'BODYWEIGHT_REPS'
  customDialogDifficultyCode.value = 'BEGINNER'
  customDialogVisible.value = true
}

async function renameCustomExercise(id: number) {
  if (!(await ensureMembershipFeature('自定义动作'))) return
  const target = exerciseStore.items.find((item) => item.id === id)
  if (!target) return
  editingCustomId.value = id
  customDialogMode.value = 'edit'
  customDialogName.value = target.name
  customDialogRecordType.value = (target.recordType as ExerciseRecordType) || 'BODYWEIGHT_REPS'
  customDialogDifficultyCode.value = (target.difficultyCode as ExerciseDifficultyCode) || 'BEGINNER'
  customDialogVisible.value = true
}

function closeCustomDialog() {
  customDialogVisible.value = false
  editingCustomId.value = null
}

async function submitCustomExercise(payload: {
  name: string
  recordType: ExerciseRecordType
  difficultyCode: ExerciseDifficultyCode
  difficultyName: string
}) {
  try {
    if (customDialogMode.value === 'edit' && editingCustomId.value) {
      await exerciseStore.updateCustom(editingCustomId.value, payload)
      uni.showToast({ title: '已更新自定义动作', icon: 'none' })
    } else {
      await exerciseStore.createCustom(payload)
      activeScope.value = 'CUSTOM'
      activeCategoryCode.value = ''
      searchText.value = ''
      uni.showToast({ title: '已创建自定义动作', icon: 'none' })
    }
    closeCustomDialog()
  } catch (err) {
    uni.showToast({
      title: customDialogMode.value === 'edit' ? '更新动作失败' : '新建动作失败',
      icon: 'none'
    })
    console.error('[exercise] save custom failed', err)
  }
}

async function deleteCustomExercise(id: number) {
  if (!(await ensureFeatureAuth('自定义动作'))) return
  const target = exerciseStore.items.find((item) => item.id === id)
  if (!target) return
  uni.showModal({
    title: '删除自定义动作？',
    content: `删除“${target.name}”后不可恢复。已被模板或历史记录使用的动作不能删除。`,
    confirmText: '删除',
    confirmColor: '#ff6b4a',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await exerciseStore.deleteCustom(id)
        uni.showToast({ title: '已删除', icon: 'none' })
      } catch (err) {
        uni.showToast({ title: '删除失败，可能已被使用', icon: 'none' })
        console.error('[exercise] delete custom failed', err)
      }
    }
  })
}
</script>

<template>
  <view class="exercises-page" :class="themeStore.themeClass">
    <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
      <view class="page-shell tab-page safe-bottom" :class="themeStore.themeClass">
        <view class="exercises__header">
          <view class="exercises__header-copy">
            <view class="eyebrow">Exercise Library</view>
            <view class="title-xl">动作库</view>
            <view class="muted exercises__count">
              已加载 {{ exerciseStore.items.length }} / {{ exerciseStore.total }} 个动作
            </view>
          </view>
        </view>

        <view class="glass-card exercises__search">
          <text class="exercises__search-icon">⌕</text>
          <input
            v-model="searchText"
            class="exercises__search-input"
            placeholder="搜索动作、肌群或器械..."
            placeholder-class="exercises__placeholder"
          />
          <text v-if="searchText" class="exercises__search-clear" @tap="searchText = ''">×</text>
        </view>

        <view class="glass-card exercises__filter-summary">
          <view class="exercises__filter-tags">
            <view class="exercises__filter-tag">
              {{
                activeScope === 'CUSTOM'
                  ? '自定义'
                  : activeScope === 'FAVORITES'
                    ? '我的收藏'
                    : '全部动作'
              }}
            </view>
            <view v-if="activeEquipmentCode" class="exercises__filter-tag">
              {{ findOptionLabel(equipmentOptions, activeEquipmentCode) }}
            </view>
            <view v-if="activeDifficultyCode" class="exercises__filter-tag">
              {{ findOptionLabel(difficultyOptions, activeDifficultyCode) }}
            </view>
            <view v-if="activeRecordType" class="exercises__filter-tag">
              {{ findOptionLabel(recordTypeOptions, activeRecordType) }}
            </view>
            <view v-if="!activeFilterCount" class="exercises__filter-tag exercises__filter-tag--muted">
              {{ filterSummary }}
            </view>
          </view>
          <view class="exercises__filter-actions">
            <view
              v-if="hasClearableConditions"
              class="exercises__clear-button btn-press"
              @tap="clearConditions"
            >
              清空
            </view>
            <view class="exercises__filter-button btn-press" @tap="openFilterSheet">
              <text>筛选</text>
              <text v-if="activeFilterCount" class="exercises__filter-badge">
                {{ activeFilterCount }}
              </text>
            </view>
          </view>
        </view>

        <view class="exercises__body">
          <scroll-view scroll-y class="exercises__sidebar">
            <view
              class="exercises__sidebar-item"
              :class="{ 'exercises__sidebar-item--active': activeScope === 'FAVORITES' }"
              @tap="switchCategory('__favorites')"
            >
              <text>收藏</text>
            </view>
            <view
              class="exercises__sidebar-item"
              :class="{ 'exercises__sidebar-item--active': activeScope === 'CUSTOM' }"
              @tap="switchCategory('__custom')"
            >
              <text>自定义</text>
            </view>
            <view
              v-for="category in exerciseStore.categoryOptions"
              :key="category.code || 'all'"
              class="exercises__sidebar-item"
              :class="{
                'exercises__sidebar-item--active':
                  activeScope === 'ALL' && activeCategoryCode === category.code
              }"
              @tap="switchCategory(category.code)"
            >
              <text>{{ category.name }}</text>
            </view>
          </scroll-view>

          <scroll-view scroll-y class="exercises__content" @scrolltolower="loadMore">
            <view
              v-if="activeScope === 'CUSTOM'"
              class="glass-card exercises__custom-create btn-press"
              @tap="createCustomExercise"
            >
              <view class="exercises__custom-plus">+</view>
              <view>
                <view class="exercises__custom-title">新建自定义动作</view>
                <view class="exercises__custom-sub">名称和记录类型一次设置</view>
              </view>
            </view>

            <view v-if="initialLoading" class="exercises__state muted">加载中...</view>

            <view v-else-if="exerciseStore.listError" class="exercises__state">
              <EmptyState
                icon="⚠"
                title="动作加载失败"
                description="网络或服务暂时异常，可以稍后重试。"
              />
              <view class="gradient-fire exercises__retry btn-press" @tap="reloadExercises">
                重新加载
              </view>
            </view>

            <view v-else-if="!visibleExercises.length" class="exercises__state">
              <EmptyState icon="🏋️" :title="emptyTitle" :description="emptyDescription" />
            </view>

            <view v-else class="exercises__list">
              <ExerciseItem
                v-for="item in visibleExercises"
                :key="item.id"
                :exercise="item"
                :custom-actions="activeScope === 'CUSTOM'"
                @select="openDetail"
                @favorite="onFavorite"
                @rename="renameCustomExercise"
                @delete="deleteCustomExercise"
              />
            </view>

            <view v-if="footerText" class="exercises__footer muted">
              {{ footerText }}
            </view>
          </scroll-view>
        </view>
      </view>
    </scroll-view>

    <CustomExerciseDialog
      :visible="customDialogVisible"
      :title="customDialogMode === 'edit' ? '编辑自定义动作' : '新建自定义动作'"
      :confirm-text="customDialogMode === 'edit' ? '保存' : '创建'"
      :initial-name="customDialogName"
      :initial-record-type="customDialogRecordType"
      :initial-difficulty-code="customDialogDifficultyCode"
      @close="closeCustomDialog"
      @submit="submitCustomExercise"
    />
    <view
      v-if="filterSheetVisible"
      class="exercises__sheet-mask"
      catchtouchmove="true"
      @tap="closeFilterSheet"
    >
      <view class="exercises__sheet glass-card" @tap.stop>
        <view class="exercises__sheet-header">
          <view>
            <view class="exercises__sheet-title">筛选动作</view>
            <view class="exercises__sheet-subtitle"
              >身体部位仍在左侧选择，这里只调整器械、难度和记录类型。</view
            >
          </view>
          <view class="exercises__sheet-close btn-press" @tap="closeFilterSheet">×</view>
        </view>

        <view class="exercises__filter-group">
          <view class="exercises__filter-group-title">器械</view>
          <view class="exercises__filter-grid">
            <view
              v-for="item in equipmentOptions"
              :key="item.value || 'sheet-equipment-all'"
              class="exercises__filter-chip btn-press"
              :class="{ 'exercises__filter-chip--active': draftEquipmentCode === item.value }"
              @tap="switchFilter('equipment', item.value)"
            >
              {{ item.label }}
            </view>
          </view>
        </view>

        <view class="exercises__filter-group">
          <view class="exercises__filter-group-title">难度</view>
          <view class="exercises__filter-grid">
            <view
              v-for="item in difficultyOptions"
              :key="item.value || 'sheet-difficulty-all'"
              class="exercises__filter-chip btn-press"
              :class="{ 'exercises__filter-chip--active': draftDifficultyCode === item.value }"
              @tap="switchFilter('difficulty', item.value)"
            >
              {{ item.label }}
            </view>
          </view>
        </view>

        <view class="exercises__filter-group">
          <view class="exercises__filter-group-title">记录类型</view>
          <view class="exercises__filter-grid">
            <view
              v-for="item in recordTypeOptions"
              :key="item.value || 'sheet-record-all'"
              class="exercises__filter-chip btn-press"
              :class="{ 'exercises__filter-chip--active': draftRecordType === item.value }"
              @tap="switchFilter('recordType', item.value)"
            >
              {{ item.label }}
            </view>
          </view>
        </view>

        <view class="exercises__sheet-actions">
          <view class="exercises__sheet-reset btn-press" @tap="clearAdvancedFilters">清空</view>
          <view class="gradient-fire exercises__sheet-confirm btn-press" @tap="applyAdvancedFilters">
            完成
          </view>
        </view>
      </view>
    </view>
    <WorkoutDraftFab :class="themeStore.themeClass" variant="light" @open="openDraftFab" />
    <WorkoutDraftPrompt />
    <MembershipRequiredModal />
  </view>
</template>

<style lang="scss" scoped>
.exercises {
  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18rpx;
  }

  &__header-copy {
    min-width: 0;
  }

  &__count {
    margin-top: 8rpx;
  }

  &__quick-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14rpx;
    margin-top: 18rpx;
  }

  &__quick-card {
    min-height: 96rpx;
    padding: 18rpx;
    border-radius: 26rpx;
    display: flex;
    align-items: center;
    gap: 14rpx;
    background: var(--app-surface);
    border-color: var(--app-border);
  }

  &__quick-card--filter {
    border-color: rgba(255, 80, 30, 0.22);
  }

  &__quick-icon {
    width: 52rpx;
    height: 52rpx;
    border-radius: 18rpx;
    background: var(--app-accent-soft);
    color: var(--app-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24rpx;
    font-weight: 900;
    flex-shrink: 0;
  }

  &__quick-icon--filter {
    background: rgba(37, 99, 235, 0.1);
    color: #2f73d8;
  }

  &__quick-title {
    color: var(--app-text);
    font-size: 24rpx;
    font-weight: 900;
  }

  &__quick-sub {
    margin-top: 4rpx;
    color: var(--app-text-muted);
    font-size: 19rpx;
    line-height: 1.35;
  }

  &__search {
    margin-top: 24rpx;
    padding: 20rpx 24rpx;
    display: flex;
    align-items: center;
    gap: 16rpx;
    background: var(--app-surface);
    border: 1px solid var(--app-border);
    border-radius: 24rpx;
  }

  &__search-input {
    flex: 1;
    min-width: 0;
    color: var(--app-text);
    font-size: 26rpx;
  }

  &__placeholder {
    color: var(--app-text-muted);
  }

  &__search-icon,
  &__search-clear {
    color: var(--app-text-muted);
    font-size: 28rpx;
  }

  &__body {
    display: flex;
    gap: 12rpx;
    margin-top: 24rpx;
    flex: 1;
    min-height: 0;
  }

  &__filter-summary {
    margin-top: 14rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18rpx;
    padding: 16rpx 18rpx;
    background: var(--app-surface);
    border-color: var(--app-border);
  }

  &__filter-tags {
    min-width: 0;
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10rpx;
    overflow: hidden;
  }

  &__filter-tag {
    max-width: 210rpx;
    padding: 8rpx 14rpx;
    border-radius: 999rpx;
    background: var(--app-bg);
    color: var(--app-text-secondary);
    font-size: 20rpx;
    font-weight: 800;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 0;
  }

  &__filter-tag--muted {
    max-width: 430rpx;
    color: var(--app-text-muted);
    font-weight: 700;
  }

  &__filter-button {
    min-width: 112rpx;
    min-height: 58rpx;
    padding: 0 18rpx;
    border-radius: 999rpx;
    background: var(--app-accent-soft);
    border: 1px solid rgba(255, 80, 30, 0.42);
    color: var(--app-accent);
    font-size: 22rpx;
    font-weight: 900;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8rpx;
    flex-shrink: 0;
  }

  &__filter-actions {
    display: flex;
    align-items: center;
    gap: 10rpx;
    flex-shrink: 0;
  }

  &__clear-button {
    min-width: 92rpx;
    min-height: 58rpx;
    padding: 0 18rpx;
    border-radius: 999rpx;
    background: var(--app-bg);
    border: 1px solid var(--app-border);
    color: var(--app-text-secondary);
    font-size: 22rpx;
    font-weight: 900;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__filter-badge {
    min-width: 30rpx;
    height: 30rpx;
    padding: 0 8rpx;
    border-radius: 999rpx;
    background: var(--app-accent);
    color: #fff;
    font-size: 18rpx;
    line-height: 30rpx;
    text-align: center;
  }

  &__filter-chip {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 64rpx;
    padding: 0 18rpx;
    border-radius: 999rpx;
    background: var(--app-surface);
    border: 1px solid var(--app-border);
    color: var(--app-text-muted);
    font-size: 22rpx;
    font-weight: 700;

    &--active {
      background: var(--app-accent-soft);
      border-color: rgba(255, 80, 30, 0.42);
      color: var(--app-accent);
    }
  }

  &__sidebar {
    width: 124rpx;
    flex-shrink: 0;
  }

  &__sidebar-item {
    min-height: 82rpx;
    padding: 22rpx 6rpx;
    margin-bottom: 10rpx;
    border-radius: 22rpx;
    font-size: 22rpx;
    color: var(--app-text-muted);
    text-align: center;
    background: var(--app-surface);
    border: 1px solid transparent;
    word-break: keep-all;
    display: flex;
    align-items: center;
    justify-content: center;

    &--active {
      background: var(--app-accent-soft);
      border-color: rgba(255, 80, 30, 0.42);
      color: var(--app-accent);
      font-weight: 900;
    }
  }

  &__content {
    flex: 1;
    min-width: 0;
    max-height: calc(100vh - 330rpx);
  }

  &__state {
    padding-top: 44rpx;
  }

  &__custom-create {
    margin-bottom: 18rpx;
    padding: 18rpx 20rpx;
    display: flex;
    align-items: center;
    gap: 14rpx;
    border-color: rgba(255, 80, 30, 0.24);
  }

  &__custom-title {
    color: var(--app-text);
    font-size: 24rpx;
    font-weight: 900;
  }

  &__custom-sub {
    margin-top: 4rpx;
    color: var(--app-text-muted);
    font-size: 20rpx;
  }

  &__custom-plus {
    width: 48rpx;
    height: 48rpx;
    border-radius: 16rpx;
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    font-weight: 900;
    flex-shrink: 0;
  }

  &__retry {
    width: 240rpx;
    min-height: 76rpx;
    margin: 0 auto;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 26rpx;
    font-weight: 800;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 14rpx;
  }

  &__footer {
    padding: 28rpx 0 8rpx;
    text-align: center;
    font-size: 24rpx;
  }

  &__sheet-mask {
    position: fixed;
    inset: 0;
    z-index: 120;
    display: flex;
    align-items: flex-end;
    background: rgba(0, 0, 0, 0.58);
  }

  &__sheet {
    width: 100%;
    padding: 28rpx 28rpx calc(30rpx + env(safe-area-inset-bottom));
    border-radius: 34rpx 34rpx 0 0;
    background: var(--app-surface-raised);
    border-color: var(--app-border);
    box-shadow: 0 -24rpx 72rpx rgba(31, 49, 72, 0.16);
  }

  &__sheet-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18rpx;
  }

  &__sheet-title {
    color: var(--app-text);
    font-size: 32rpx;
    font-weight: 900;
  }

  &__sheet-subtitle {
    margin-top: 8rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
    line-height: 1.45;
  }

  &__sheet-close {
    width: 58rpx;
    height: 58rpx;
    border-radius: 999rpx;
    background: var(--app-bg);
    color: var(--app-text-muted);
    font-size: 34rpx;
    line-height: 58rpx;
    text-align: center;
    flex-shrink: 0;
  }

  &__filter-group {
    margin-top: 28rpx;
  }

  &__filter-group-title {
    margin-bottom: 14rpx;
    color: var(--app-text);
    font-size: 24rpx;
    font-weight: 900;
  }

  &__filter-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14rpx;
  }

  &__sheet-actions {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    gap: 16rpx;
    margin-top: 32rpx;
  }

  &__sheet-reset,
  &__sheet-confirm {
    min-height: 78rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26rpx;
    font-weight: 900;
  }

  &__sheet-reset {
    background: var(--app-bg);
    border: 1px solid var(--app-border);
    color: var(--app-text-muted);
  }

  &__sheet-confirm {
    color: #fff;
  }
}

.eyebrow {
  display: none;
}
</style>
