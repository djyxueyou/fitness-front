<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import EmptyState from '@/components/empty-state/index.vue'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { useExerciseStore } from '@/stores/exercise'

const exerciseStore = useExerciseStore()
const favorites = computed(() => exerciseStore.favorites)

onShow(async () => {
  const ok = await ensureFeatureAuth('个人信息')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  await exerciseStore.refreshFavoriteStates()
})

function goBack() {
  uni.navigateBack()
}

function openDetail(id: number) {
  uni.navigateTo({ url: `${routes.exerciseDetail}?id=${id}` })
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell safe-bottom">
      <AppHeader
        title="我的收藏"
        :subtitle="`${favorites.length} 个动作`"
        show-back
        @back="goBack"
      />
      <EmptyState
        v-if="!favorites.length"
        icon="♡"
        title="暂无收藏动作"
        description="在动作库中收藏常用动作后，会显示在这里。"
      />
      <view v-else class="favorites__list">
        <view
          v-for="item in favorites"
          :key="item.id"
          class="glass-card favorites__item"
          @tap="openDetail(item.id)"
        >
          <view class="favorites__avatar">{{ item.name.slice(0, 1) }}</view>
          <view class="favorites__body">
            <view class="favorites__name">{{ item.name }}</view>
            <view class="favorites__meta"
              >{{ item.muscle }} · {{ item.equipment }} · {{ item.level }}</view
            >
          </view>
          <view class="favorites__heart">♥</view>
          <view class="favorites__delete btn-press" @tap.stop="exerciseStore.toggleFavorite(item.id)"
            >删除</view
          >
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

  &__heart {
    color: #ff4d4f;
    text-shadow: 0 0 12rpx rgba(255, 77, 79, 0.5);
  }

  &__delete {
    color: #ff501e;
    font-size: 22rpx;
  }
}
</style>
