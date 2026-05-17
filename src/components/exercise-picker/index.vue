<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  createCustomExercise,
  fetchExerciseCategories,
  fetchExerciseList,
  fetchFavoriteExercises,
  type ExerciseCategory,
  type ExerciseSummary
} from '@/api/exercise'
import { getToken } from '@/api/http'
import { useExerciseStore } from '@/stores/exercise'
import { ensureMembershipFeature } from '@/utils/membership-guard'

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
}>()

const emit = defineEmits<{
  close: []
  select: [exercise: ExerciseSummary]
}>()

const exerciseStore = useExerciseStore()
const categoryOptions = ref<Array<{ code: string; name: string }>>([{ code: '', name: '全部' }])
const quickFilter = ref('all')
const activeCategoryCode = ref('')
const keyword = ref('')
const exerciseItems = ref<ExerciseSummary[]>([])
const exercisePageNo = ref(0)
const exerciseTotal = ref(0)
const exerciseLoading = ref(false)
const customSaving = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const trimmedKeyword = computed(() => keyword.value.trim())
const customExists = computed(() =>
  exerciseItems.value.some((item) => item.name === trimmedKeyword.value)
)
const customCreateTitle = computed(() =>
  trimmedKeyword.value ? `新建自定义动作「${trimmedKeyword.value}」` : '新建自定义动作'
)

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
    if (categoryOptions.value.length <= 1) {
      await loadCategories()
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
    return matchedKeyword && matchedCategory
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

function selectExercise(exercise: ExerciseSummary) {
  writeRecentExercise(exercise)
  emit('select', exercise)
}

async function createCustomFromKeyword() {
  if (!(await ensureMembershipFeature('自定义动作'))) return
  const name = trimmedKeyword.value || (await promptCustomName())
  if (!name || customSaving.value) return
  if (customExists.value && name === trimmedKeyword.value) {
    uni.showToast({ title: '已存在同名动作', icon: 'none' })
    return
  }

  customSaving.value = true
  try {
    const created = await createCustomExercise({ name })
    exerciseStore.clearListCache()
    const exercise: ExerciseSummary = {
      id: created.id,
      name,
      categoryCode: 'custom',
      categoryName: '自定义',
      primaryMuscle: '',
      equipment: '',
      difficultyLevel: 'BEGINNER',
      exerciseType: 'USER'
    }
    selectExercise(exercise)
    uni.showToast({ title: '已创建并添加', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '新建动作失败', icon: 'none' })
    console.error('[exercise-picker] create custom exercise failed', err)
  } finally {
    customSaving.value = false
  }
}

function promptCustomName() {
  return new Promise<string | null>((resolve) => {
    uni.showModal({
      title: '新建自定义动作',
      editable: true,
      placeholderText: '例如：弹力带肩外旋',
      success: (res) => {
        if (!res.confirm) {
          resolve(null)
          return
        }
        const content = ((res as UniApp.ShowModalRes & { content?: string }).content || '').trim()
        resolve(content || null)
      },
      fail: () => resolve(null)
    } as UniApp.ShowModalOptions)
  })
}

function isSelected(exerciseId: number) {
  return (props.selectedIds || []).includes(exerciseId)
}
</script>

<template>
  <view v-if="visible" class="exercise-picker__mask">
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

      <scroll-view scroll-y class="exercise-picker__list" @scrolltolower="loadExercises()">
        <view
          v-if="quickFilter === 'custom'"
          class="glass-card exercise-picker__custom-create btn-press"
          @tap="createCustomFromKeyword"
        >
          <view>
            <view class="exercise-picker__custom-title">{{ customCreateTitle }}</view>
            <view class="exercise-picker__custom-sub">仅当前账号可见，创建后会加入本次训练</view>
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
          <image
            v-if="exercise.thumbnailUrl"
            class="exercise-picker__thumb"
            :src="exercise.thumbnailUrl"
            mode="aspectFill"
          />
          <view v-else class="exercise-picker__thumb-placeholder">
            {{ exercise.name.slice(0, 1) }}
          </view>
          <view class="exercise-picker__body">
            <view class="exercise-picker__name">{{ exercise.name }}</view>
            <view class="exercise-picker__meta">
              {{ exercise.categoryName || '自定义' }} · {{ exercise.equipment || '-' }}
            </view>
          </view>
          <view
            class="exercise-picker__action"
            :class="{ 'exercise-picker__action--selected': isSelected(exercise.id) }"
          >
            {{ isSelected(exercise.id) ? '已添加' : '添加' }}
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
    </view>
  </view>
</template>

<style lang="scss" scoped>
.exercise-picker {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  top: 120rpx;
  bottom: 0;
  z-index: 31;
  padding: 28rpx;
  border-radius: 36rpx 36rpx 0 0;
  background: #101018;
  border: 1px solid rgba(255, 255, 255, 0.08);

  &__mask {
    position: fixed;
    inset: 0;
    z-index: 30;
    background: rgba(0, 0, 0, 0.62);
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__title {
    color: #f5f5fa;
    font-size: 34rpx;
    font-weight: 800;
  }

  &__sub,
  &__meta,
  &__footer {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
  }

  &__close {
    width: 68rpx;
    height: 68rpx;
    border-radius: 22rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
    color: #f5f5fa;
    font-size: 36rpx;
  }

  &__search {
    margin-top: 24rpx;
    padding: 20rpx 24rpx;
  }

  &__search-input {
    color: #f5f5fa;
    font-size: 26rpx;
  }

  &__placeholder {
    color: #828296;
  }

  &__quick {
    display: flex;
    gap: 12rpx;
    margin-top: 18rpx;
  }

  &__quick-item {
    padding: 14rpx 22rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.06);
    color: #b8b8c8;
    font-size: 22rpx;

    &--active {
      background: rgba(255, 80, 30, 0.16);
      color: #ff7a32;
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

  &__category {
    padding: 14rpx 22rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.08);
    color: #f5f5fa;
    font-size: 24rpx;

    &--active {
      background: linear-gradient(135deg, #ff501e, #ffa03c);
      color: #fff;
      font-weight: 700;
    }
  }

  &__list {
    height: calc(100vh - 500rpx);
    margin-top: 20rpx;
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
    color: #f5f5fa;
    font-size: 26rpx;
    font-weight: 800;
  }

  &__custom-sub {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
  }

  &__custom-action {
    flex-shrink: 0;
    color: #ff7a32;
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
    color: #ff501e;
    font-size: 30rpx;
    font-weight: 800;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__name {
    color: #f5f5fa;
    font-size: 28rpx;
    font-weight: 700;
  }

  &__action {
    color: #ff501e;
    font-size: 24rpx;
    font-weight: 700;

    &--selected {
      color: #828296;
    }
  }

  &__footer {
    padding: 20rpx 0;
    text-align: center;
  }
}
</style>
