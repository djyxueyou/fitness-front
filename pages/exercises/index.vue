<script setup lang="ts">
import { computed, ref } from 'vue'
import ExerciseItem from '@/components/exercise-item/index.vue'
import TagChip from '@/components/tag-chip/index.vue'
import { exerciseCategories } from '@/mock/exercises'
import { routes } from '@/utils/navigation'
import { useExerciseStore } from '@/stores/exercise'

const exerciseStore = useExerciseStore()
const activeCategory = ref('全部')
const searchText = ref('')

const filteredExercises = computed(() =>
  exerciseStore.items.filter((item) => {
    const categoryMatch = activeCategory.value === '全部' || item.category === activeCategory.value
    const text = searchText.value.trim()
    const searchMatch = !text || item.name.includes(text) || item.muscle.includes(text)
    return categoryMatch && searchMatch
  })
)

function openDetail(id: number) {
  uni.navigateTo({ url: `${routes.exerciseDetail}?id=${id}` })
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell safe-bottom">
      <view class="title-xl">动作库</view>
      <view class="muted exercises__count">{{ exerciseStore.items.length }} 个动作</view>

      <view class="glass-card exercises__search">
        <text class="exercises__search-icon">⌕</text>
        <input v-model="searchText" class="exercises__search-input" placeholder="搜索动作、肌群或器械..." placeholder-class="exercises__placeholder" />
        <text v-if="searchText" class="exercises__search-clear" @tap="searchText = ''">✕</text>
      </view>

      <scroll-view scroll-x class="exercises__tabs">
        <view class="exercises__tabs-inner">
          <TagChip v-for="category in exerciseCategories" :key="category" :text="category" :active="activeCategory === category" @tap="activeCategory = category" />
        </view>
      </scroll-view>

      <view class="exercises__list">
        <ExerciseItem
          v-for="item in filteredExercises"
          :key="item.id"
          :exercise="item"
          @tap="openDetail"
          @favorite="exerciseStore.toggleFavorite"
        />
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
}
</style>
