<script setup lang="ts">
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { ref, watch } from 'vue'
import ExerciseItem from '@/components/exercise-item/index.vue'
import TagChip from '@/components/tag-chip/index.vue'
import { getToken } from '@/api/http'
import { useExerciseStore } from '@/stores/exercise'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { offAuthChanged, onAuthChanged } from '@/utils/auth-events'
import { routes } from '@/utils/navigation'

const exerciseStore = useExerciseStore()
const activeCategoryCode = ref('')
const searchText = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

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
      keyword: searchText.value
    })
  }, 300)
})

function switchCategory(categoryCode: string) {
  activeCategoryCode.value = categoryCode
  exerciseStore.fetchExercises({
    reset: true,
    categoryCode,
    keyword: searchText.value
  })
}

function loadMore() {
  exerciseStore.fetchExercises({
    categoryCode: activeCategoryCode.value,
    keyword: searchText.value
  })
}

async function refreshAfterAuthChanged() {
  exerciseStore.clearListCache()
  await exerciseStore.fetchExercises({
    reset: true,
    force: true,
    categoryCode: activeCategoryCode.value,
    keyword: searchText.value
  })
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
</script>

<template>
  <scroll-view scroll-y class="page-scroll" @scrolltolower="loadMore">
    <view class="page-shell tab-page safe-bottom">
      <view class="eyebrow">Exercise Library</view>
      <view class="title-xl">动作库</view>
      <view class="muted exercises__count">
        已加载 {{ exerciseStore.items.length }} / {{ exerciseStore.total }} 个动作
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
            v-for="category in exerciseStore.categoryOptions"
            :key="category.code || 'all'"
            :text="category.name"
            :active="activeCategoryCode === category.code"
            @tap="switchCategory(category.code)"
          />
        </view>
      </scroll-view>

      <view class="exercises__list">
        <ExerciseItem
          v-for="item in exerciseStore.items"
          :key="item.id"
          :exercise="item"
          @select="openDetail"
          @favorite="onFavorite"
        />
      </view>

      <view class="exercises__footer muted">
        <text v-if="exerciseStore.loading">加载中...</text>
        <text v-else-if="!exerciseStore.hasMore">没有更多动作了</text>
        <text v-else>上拉加载更多</text>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.exercises {
  &__count {
    margin-top: 8rpx;
  }

  &__search {
    margin-top: 24rpx;
    padding: 22rpx 24rpx;
    display: flex;
    align-items: center;
    gap: 16rpx;
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

  &__list {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }

  &__footer {
    padding: 28rpx 0 8rpx;
    text-align: center;
    font-size: 24rpx;
  }
}
</style>
