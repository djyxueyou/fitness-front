<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import EmptyState from '@/components/empty-state/index.vue'
import ExerciseItem from '@/components/exercise-item/index.vue'
import TagChip from '@/components/tag-chip/index.vue'
import { getToken } from '@/api/http'
import { useExerciseStore } from '@/stores/exercise'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { ensureMembershipFeature } from '@/utils/membership-guard'
import { offAuthChanged, onAuthChanged } from '@/utils/auth-events'
import { routes } from '@/utils/navigation'

const exerciseStore = useExerciseStore()
const activeCategoryCode = ref('')
const activeScope = ref<'ALL' | 'CUSTOM'>('ALL')
const searchText = ref('')
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
    ? '训练中添加动作时，可以直接新建只属于你的自定义动作。'
    : '可以换个分类，或者清空搜索关键词再试。'
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

function openDetail(id: number) {
  if (!Number.isFinite(id) || id <= 0) {
    console.error('[exercise] invalid detail id', id)
    uni.showToast({ title: '动作参数错误', icon: 'none' })
    return
  }
  uni.navigateTo({ url: `${routes.exerciseDetail}?id=${id}` })
}

async function openFavorites() {
  const ok = await ensureFeatureAuth('我的收藏')
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

  await exerciseStore.toggleFavorite(id)
}

function showNameInput(options: { title: string; placeholder: string; value?: string }) {
  return new Promise<string | null>((resolve) => {
    uni.showModal({
      title: options.title,
      editable: true,
      placeholderText: options.placeholder,
      content: options.value || '',
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

async function createCustomExercise() {
  if (!(await ensureMembershipFeature('自定义动作'))) return
  const ok = await ensureFeatureAuth('自定义动作')
  if (!ok) return
  const name = await showNameInput({
    title: '新建自定义动作',
    placeholder: '例如：弹力带肩外旋',
    value: searchText.value
  })
  if (!name) return

  try {
    await exerciseStore.createCustom({ name })
    activeScope.value = 'CUSTOM'
    activeCategoryCode.value = ''
    searchText.value = ''
    uni.showToast({ title: '已创建自定义动作', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '新建动作失败', icon: 'none' })
    console.error('[exercise] create custom failed', err)
  }
}

async function renameCustomExercise(id: number) {
  if (!(await ensureMembershipFeature('自定义动作'))) return
  const target = exerciseStore.items.find((item) => item.id === id)
  if (!target) return
  const name = await showNameInput({
    title: '重命名动作',
    placeholder: '输入新的动作名称',
    value: target.name
  })
  if (!name || name === target.name) return

  try {
    await exerciseStore.updateCustom(id, { name })
    uni.showToast({ title: '已重命名', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '重命名失败', icon: 'none' })
    console.error('[exercise] rename custom failed', err)
  }
}

async function deleteCustomExercise(id: number) {
  if (!(await ensureMembershipFeature('自定义动作'))) return
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
  <scroll-view scroll-y class="page-scroll" @scrolltolower="loadMore">
    <view class="page-shell tab-page safe-bottom">
      <view class="exercises__header">
        <view>
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

      <scroll-view scroll-x class="exercises__tabs">
        <view class="exercises__tabs-inner">
          <TagChip
            text="自定义"
            :active="activeScope === 'CUSTOM'"
            @tap="switchCategory('__custom')"
          />
          <TagChip
            v-for="category in exerciseStore.categoryOptions"
            :key="category.code || 'all'"
            :text="category.name"
            :active="activeScope === 'ALL' && activeCategoryCode === category.code"
            @tap="switchCategory(category.code)"
          />
        </view>
      </scroll-view>

      <view
        v-if="activeScope === 'CUSTOM'"
        class="glass-card exercises__custom-create btn-press"
        @tap="createCustomExercise"
      >
        <view>
          <view class="exercises__custom-title">新建自定义动作</view>
          <view class="exercises__custom-sub">只属于当前账号，可用于自由训练和模板。</view>
        </view>
        <view class="exercises__custom-plus">+</view>
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
        <EmptyState icon="🏋" :title="emptyTitle" :description="emptyDescription" />
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
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.exercises {
  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20rpx;
  }

  &__count {
    margin-top: 8rpx;
  }

  &__favorites {
    min-width: 156rpx;
    min-height: 72rpx;
    padding: 0 20rpx;
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
    transition: all 0.3s ease;

    &:focus-within {
      border-color: rgba(255, 80, 30, 0.5);
      box-shadow: 0 0 20rpx rgba(255, 80, 30, 0.15);
    }
  }

  &__search-input {
    flex: 1;
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

  &__tabs {
    margin: 24rpx -32rpx 20rpx;
    white-space: nowrap;
  }

  &__tabs-inner {
    display: inline-flex;
    gap: 12rpx;
    padding: 0 32rpx;
  }

  &__state {
    padding-top: 80rpx;
  }

  &__custom-create {
    margin-bottom: 20rpx;
    padding: 22rpx 24rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
    border-color: rgba(255, 80, 30, 0.24);
  }

  &__custom-title {
    color: #f5f5fa;
    font-size: 28rpx;
    font-weight: 800;
  }

  &__custom-sub {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
  }

  &__custom-plus {
    width: 56rpx;
    height: 56rpx;
    border-radius: 18rpx;
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 34rpx;
    font-weight: 900;
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
