<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import EmptyState from '@/components/empty-state/index.vue'
import { fetchActiveTrainingPlan } from '@/api/plan'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'

const loading = ref(true)
const missing = ref(false)

onShow(async () => {
  const ok = await ensureFeatureAuth('训练计划')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }

  loading.value = true
  missing.value = false
  try {
    const activePlan = await fetchActiveTrainingPlan()
    if (activePlan) {
      uni.redirectTo({ url: `${routes.planDetail}?id=${activePlan.id}` })
      return
    }
    missing.value = true
  } catch (err) {
    missing.value = true
    console.error('[plan] active redirect failed', err)
  } finally {
    loading.value = false
  }
})

function goPlans() {
  uni.switchTab({ url: routes.planIndex })
}

function goBack() {
  uni.navigateBack()
}
</script>

<template>
  <view class="page-shell active-plan-redirect">
    <AppHeader title="当前计划" subtitle="正在打开计划详情" show-back @back="goBack" />
    <view v-if="loading" class="active-plan-redirect__loading">计划加载中...</view>
    <EmptyState
      v-else-if="missing"
      icon="+"
      title="还没有启用计划"
      description="请返回计划页，从系统计划或我的计划中启用一套安排。"
    />
    <view v-if="missing" class="active-plan-redirect__action btn-press" @tap="goPlans">
      返回计划页
    </view>
  </view>
</template>

<style lang="scss" scoped>
.active-plan-redirect {
  &__loading {
    padding-top: 120rpx;
    color: #828296;
    text-align: center;
    font-size: 24rpx;
  }

  &__action {
    width: 220rpx;
    min-height: 64rpx;
    margin: 28rpx auto 0;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    font-size: 23rpx;
    font-weight: 900;
  }
}
</style>
