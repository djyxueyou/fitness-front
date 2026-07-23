<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import MembershipRequiredModal from '@/components/membership-required-modal/index.vue'
import PrimaryButton from '@/components/primary-button/index.vue'
import { isStalePlanDetailError, usePlanStore } from '@/stores/plan'
import { useThemeStore } from '@/stores/theme'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { ensureMembershipFeature } from '@/utils/membership-guard'
import { routes } from '@/utils/navigation'
import { showPlanWriteError } from '@/utils/plan-write-feedback'

const planStore = usePlanStore()
const themeStore = useThemeStore()
const planId = ref<number | null>(null)
const name = ref('')
const saving = ref(false)

onLoad((options) => {
  const id = Number(options?.id)
  planId.value = Number.isFinite(id) && id > 0 ? id : null
})

onShow(async () => {
  const ok = await ensureFeatureAuth('训练计划')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  if (!planId.value) return
  try {
    const detail = await planStore.getDetail(planId.value, true)
    if (detail.planType === 'SYSTEM') {
      uni.showToast({ title: '系统计划不能编辑', icon: 'none' })
      uni.navigateBack()
      return
    }
    name.value = detail.name
  } catch (err) {
    if (isStalePlanDetailError(err)) return
    uni.showToast({ title: '计划加载失败', icon: 'none' })
    console.error('[plan] edit load failed', err)
  }
})

function goBack() {
  uni.navigateBack()
}

async function savePlan() {
  if (!planId.value || saving.value) return
  if (!(await ensureMembershipFeature('自定义训练计划'))) return
  const nextName = name.value.trim()
  if (!nextName) {
    uni.showToast({ title: '请输入计划名称', icon: 'none' })
    return
  }
  saving.value = true
  try {
    await planStore.updatePlan(planId.value, {
      name: nextName
    })
    uni.showToast({ title: '已保存计划', icon: 'none' })
    uni.navigateBack()
  } catch (err) {
    showPlanWriteError(err, '计划保存失败，请重试')
    console.error('[plan] save failed', err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view class="page-shell plan-edit operation-page safe-bottom" :class="themeStore.themeClass">
      <AppHeader title="编辑计划" subtitle="修改我的计划名称" show-back @back="goBack" />

      <view class="glass-card plan-edit__form">
        <view class="plan-edit__field">
          <view class="plan-edit__label">计划名称</view>
          <input v-model="name" class="plan-edit__input" placeholder="输入计划名称" />
        </view>
      </view>

      <view class="plan-edit__footer">
        <PrimaryButton :disabled="saving" :loading="saving" @tap="savePlan">
          {{ saving ? '保存中...' : '保存计划' }}
        </PrimaryButton>
      </view>
    </view>
  </scroll-view>
  <MembershipRequiredModal />
</template>

<style lang="scss" scoped>
.plan-edit {
  padding-bottom: 150rpx;

  &__form {
    margin-top: 24rpx;
    padding: 28rpx;
  }

  &__field + &__field {
    margin-top: 30rpx;
  }

  &__label {
    color: var(--app-text);
    font-size: 24rpx;
    font-weight: 900;
  }

  &__input {
    margin-top: 14rpx;
    min-height: 76rpx;
    padding: 0 22rpx;
    border-radius: 22rpx;
    border: 1rpx solid var(--app-border);
    background: var(--app-bg);
    color: var(--app-text-secondary);
    font-size: 26rpx;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 14rpx;
    margin-top: 16rpx;
  }

  &__chip {
    min-height: 64rpx;
    padding: 0 24rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--app-bg);
    border: 1rpx solid var(--app-border);
    color: var(--app-text-secondary);
    font-size: 24rpx;
    font-weight: 900;

    &--active {
      background: var(--app-accent-soft);
      border-color: rgba(255, 100, 24, 0.36);
      color: var(--app-accent);
    }
  }

  &__footer {
    position: fixed;
    left: 24rpx;
    right: 24rpx;
    bottom: calc(24rpx + env(safe-area-inset-bottom));
    z-index: 10;
  }
}
</style>
