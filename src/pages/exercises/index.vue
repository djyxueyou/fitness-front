<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import CustomExerciseDialog from '@/components/custom-exercise-dialog/index.vue'
import EmptyState from '@/components/empty-state/index.vue'
import ExerciseItem from '@/components/exercise-item/index.vue'
import MembershipRequiredModal from '@/components/membership-required-modal/index.vue'
import { getToken } from '@/api/http'
import { useExerciseStore } from '@/stores/exercise'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { ensureMembershipFeature } from '@/utils/membership-guard'
import { offAuthChanged, onAuthChanged } from '@/utils/auth-events'
import { routes } from '@/utils/navigation'

type ExerciseRecordType = 'WEIGHT_REPS' | 'BODYWEIGHT_REPS' | 'DURATION'

const exerciseStore = useExerciseStore()
const activeCategoryCode = ref('')
const activeScope = ref<'ALL' | 'CUSTOM'>('ALL')
const searchText = ref('')
const customDialogVisible = ref(false)
const customDialogMode = ref<'create' | 'edit'>('create')
const customDialogName = ref('')
const customDialogRecordType = ref<ExerciseRecordType>('BODYWEIGHT_REPS')
const editingCustomId = ref<number | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const initialLoading = computed(() => exerciseStore.loading && !exerciseStore.items.length)
const footerText = computed(() => {
  if (exerciseStore.loading && exerciseStore.items.length) return '加载中...'
  if (exerciseStore.items.length && !exerciseStore.hasMore) return '没有更多动作了'
  if (exerciseStore.items.length) return '上拉加载更多'
  return ''
})
const emptyTitle = computed(() =>
  activeScope.value === 'CUSTOM' ? '还没有自定义动作' : '当前条件没有动作'
)
const emptyDescription = computed(() =>
  activeScope.value === 'CUSTOM'
    ? '可以新建只属于你的动作，用于训练记录和模板编排。'
    : '可以切换分类，或清空搜索关键词后再试。'
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
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    exerciseStore.fetchExercises({
      reset: true,
      categoryCode: activeCategoryCode.value,
      keyword: searchText.value,
      scope: activeScope.value
    })
  }, 300)
})

function switchCategory(categoryCode: string) {
  if (categoryCode === '__custom') {
    activeScope.value = 'CUSTOM'
    activeCategoryCode.value = ''
  } else {
    activeScope.value = 'ALL'
    activeCategoryCode.value = categoryCode
  }
  exerciseStore.fetchExercises({
    reset: true,
    categoryCode: activeCategoryCode.value,
    keyword: searchText.value,
    scope: activeScope.value
  })
}

function reloadExercises() {
  exerciseStore.fetchExercises({
    reset: true,
    force: true,
    categoryCode: activeCategoryCode.value,
    keyword: searchText.value,
    scope: activeScope.value
  })
}

function loadMore() {
  exerciseStore.fetchExercises({
    categoryCode: activeCategoryCode.value,
    keyword: searchText.value,
    scope: activeScope.value
  })
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
  const ok = await ensureFeatureAuth('查看动作详情')
  if (!ok) return
  uni.navigateTo({ url: `${routes.exerciseDetail}?id=${id}` })
}

async function openFavorites() {
  const ok = await ensureMembershipFeature('我的收藏')
  if (!ok) return
  uni.navigateTo({ url: routes.favorites })
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
  customDialogVisible.value = true
}

function closeCustomDialog() {
  customDialogVisible.value = false
  editingCustomId.value = null
}

async function submitCustomExercise(payload: { name: string; recordType: ExerciseRecordType }) {
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
  <view class="exercises-page">
    <scroll-view scroll-y class="page-scroll">
      <view class="page-shell tab-page safe-bottom">
      <view class="exercises__header">
        <view class="exercises__header-copy">
          <view class="eyebrow">Exercise Library</view>
          <view class="title-xl">动作库</view>
          <view class="muted exercises__count">
            已加载 {{ exerciseStore.items.length }} / {{ exerciseStore.total }} 个动作
          </view>
        </view>
        <view class="glass-card exercises__favorites btn-press" @tap="openFavorites">
          <text class="exercises__favorites-icon">♥</text>
          <text>我的收藏</text>
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

      <view class="exercises__body">
        <scroll-view scroll-y class="exercises__sidebar">
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

          <view v-else-if="!exerciseStore.items.length" class="exercises__state">
            <EmptyState icon="🏋️" :title="emptyTitle" :description="emptyDescription" />
          </view>

          <view v-else class="exercises__list">
            <ExerciseItem
              v-for="item in exerciseStore.items"
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
      @close="closeCustomDialog"
      @submit="submitCustomExercise"
    />
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

  &__favorites {
    min-width: 142rpx;
    min-height: 68rpx;
    padding: 0 18rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8rpx;
    color: #f5f5fa;
    font-size: 22rpx;
    font-weight: 800;
  }

  &__favorites-icon {
    color: #ff501e;
    text-shadow: 0 0 12rpx rgba(255, 80, 30, 0.36);
  }

  &__search {
    margin-top: 24rpx;
    padding: 24rpx 28rpx;
    display: flex;
    align-items: center;
    gap: 16rpx;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 80, 30, 0.15);
    border-radius: 32rpx;
  }

  &__search-input {
    flex: 1;
    min-width: 0;
    color: #f5f5fa;
    font-size: 26rpx;
  }

  &__placeholder {
    color: #828296;
  }

  &__search-icon,
  &__search-clear {
    color: #828296;
    font-size: 28rpx;
  }

  &__body {
    display: flex;
    gap: 12rpx;
    margin-top: 24rpx;
    flex: 1;
    min-height: 0;
  }

  &__sidebar {
    width: 124rpx;
    flex-shrink: 0;
  }

  &__sidebar-item {
    min-height: 92rpx;
    padding: 28rpx 6rpx;
    margin-bottom: 10rpx;
    border-radius: 22rpx;
    font-size: 22rpx;
    color: #b8b8c8;
    text-align: center;
    background: rgba(255, 255, 255, 0.045);
    border: 1px solid transparent;
    word-break: keep-all;
    display: flex;
    align-items: center;
    justify-content: center;

    &--active {
      background: rgba(255, 80, 30, 0.16);
      border-color: rgba(255, 80, 30, 0.42);
      color: #ff7a32;
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
    color: #f5f5fa;
    font-size: 24rpx;
    font-weight: 900;
  }

  &__custom-sub {
    margin-top: 4rpx;
    color: #828296;
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
    gap: 20rpx;
  }

  &__footer {
    padding: 28rpx 0 8rpx;
    text-align: center;
    font-size: 24rpx;
  }
}
</style>
