<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import EmptyState from '@/components/empty-state/index.vue'
import ExerciseItem from '@/components/exercise-item/index.vue'
import MembershipRequiredModal from '@/components/membership-required-modal/index.vue'
import { ensureMembershipFeature } from '@/utils/membership-guard'
import { routes } from '@/utils/navigation'
import { useExerciseStore } from '@/stores/exercise'

const exerciseStore = useExerciseStore()
const favorites = computed(() => exerciseStore.favorites)

onShow(async () => {
  const ok = await ensureMembershipFeature('我的收藏')
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
        icon="♥"
        title="暂无收藏动作"
        description="在动作库中收藏常用动作后，会显示在这里。"
      />
      <view v-else class="favorites__list">
        <ExerciseItem
          v-for="item in favorites"
          :key="item.id"
          :exercise="item"
          @select="openDetail"
          @favorite="exerciseStore.toggleFavorite"
        />
      </view>
    </view>
  </scroll-view>
  <MembershipRequiredModal />
</template>

<style lang="scss" scoped>
.favorites {
  &__list {
    display: flex;
    flex-direction: column;
    gap: 20rpx;
  }
}
</style>
