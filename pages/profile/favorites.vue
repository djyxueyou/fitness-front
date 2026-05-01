<script setup lang="ts">
import { computed } from 'vue'
import AppHeader from '@/components/app-header/index.vue'
import EmptyState from '@/components/empty-state/index.vue'
import { useExerciseStore } from '@/stores/exercise'

const exerciseStore = useExerciseStore()
const favorites = computed(() => exerciseStore.favorites)

function goBack() {
  uni.navigateBack()
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell safe-bottom">
      <AppHeader title="我的收藏" :subtitle="`${favorites.length} 个动作`" show-back @back="goBack" />
      <EmptyState v-if="!favorites.length" icon="☆" title="暂无收藏动作" description="在动作库中收藏常用动作后会显示在这里。" />
      <view v-else class="favorites__list">
        <view v-for="item in favorites" :key="item.id" class="glass-card favorites__item">
          <view class="favorites__avatar">{{ item.name.slice(0, 1) }}</view>
          <view class="favorites__body">
            <view class="favorites__name">{{ item.name }}</view>
            <view class="favorites__meta">{{ item.muscle }} · {{ item.equipment }} · {{ item.level }}</view>
          </view>
          <view class="favorites__star">★</view>
          <view class="favorites__delete btn-press" @tap="exerciseStore.toggleFavorite(item.id)">删除</view>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.favorites {
  &__list {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 16rpx;
    padding: 24rpx;
  }

  &__avatar {
    width: 72rpx;
    height: 72rpx;
    border-radius: 22rpx;
    background: rgba(255, 200, 80, 0.16);
    color: #ffc850;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
  }

  &__body {
    flex: 1;
  }

  &__name {
    font-size: 28rpx;
    font-weight: 700;
  }

  &__meta {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
  }

  &__star {
    color: #ffc850;
  }

  &__delete {
    color: #ff501e;
    font-size: 22rpx;
  }
}
</style>
