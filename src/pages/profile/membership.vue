<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { useMembershipStore } from '@/stores/membership'

const membershipStore = useMembershipStore()
const payingPlanCode = ref('')

const statusTitle = computed(() => {
  const status = membershipStore.status
  if (!status) return '会员状态加载中'
  if (status.trial) return '30 天试用中'
  if (status.active) return '会员已开通'
  return '会员已过期'
})

const statusSub = computed(() => {
  const status = membershipStore.status
  if (!status) return '正在读取当前账号权益。'
  if (status.active) {
    return `剩余 ${status.remainingDays} 天，可使用自定义动作和自定义模板。`
  }
  return '开通后可继续使用自定义动作和自定义模板。'
})

onShow(async () => {
  const ok = await ensureFeatureAuth('会员中心')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  await membershipStore.loadAll().catch((err) => {
    uni.showToast({ title: '会员信息加载失败', icon: 'none' })
    console.error('[membership] load failed', err)
  })
})

function goBack() {
  uni.navigateBack()
}

function priceText(priceCent: number) {
  return `¥${(priceCent / 100).toFixed(priceCent % 100 === 0 ? 0 : 1)}`
}

async function buy(planCode: string) {
  if (payingPlanCode.value) return
  payingPlanCode.value = planCode
  try {
    const order = await membershipStore.createOrder(planCode)
    const params = order.payParams
    await new Promise<void>((resolve, reject) => {
      uni.requestPayment({
        timeStamp: params.timeStamp,
        nonceStr: params.nonceStr,
        package: params.packageValue,
        signType: params.signType,
        paySign: params.paySign,
        success: () => resolve(),
        fail: reject
      } as UniApp.RequestPaymentOptions)
    })

    uni.showToast({ title: '支付处理中', icon: 'none' })
    const paidOrder = await membershipStore.waitPaid(order.orderNo)
    if (paidOrder.payStatus === 'PAID') {
      uni.showToast({ title: '会员已开通', icon: 'none' })
    } else {
      uni.showToast({ title: '支付结果确认中，请稍后刷新', icon: 'none' })
    }
  } catch (err) {
    const message = err instanceof Error && err.message ? err.message : '支付失败，请稍后重试'
    uni.showToast({ title: message.slice(0, 30), icon: 'none' })
    console.error('[membership] pay failed', err)
  } finally {
    payingPlanCode.value = ''
  }
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell membership safe-bottom">
      <AppHeader
        title="会员中心"
        subtitle="开通后解锁自定义动作和自定义模板"
        show-back
        @back="goBack"
      />

      <view class="glass-card membership__status">
        <view class="membership__badge">{{ membershipStore.status?.trial ? 'TRIAL' : 'VIP' }}</view>
        <view class="membership__status-title">{{ statusTitle }}</view>
        <view class="membership__status-sub">{{ statusSub }}</view>
      </view>

      <view class="membership__section">会员权益</view>
      <view class="membership__benefits">
        <view class="glass-card membership__benefit">自定义动作：创建只属于你的动作库</view>
        <view class="glass-card membership__benefit">自定义模板：自由创建、复制和编辑训练模板</view>
      </view>

      <view class="membership__section">选择套餐</view>
      <view class="membership__plans">
        <view v-for="plan in membershipStore.plans" :key="plan.planCode" class="glass-card membership__plan">
          <view>
            <view class="membership__plan-name">{{ plan.name }}</view>
            <view class="membership__plan-sub">{{ plan.durationMonths }} 个月会员</view>
          </view>
          <view class="membership__plan-right">
            <view class="membership__price">{{ priceText(plan.priceCent) }}</view>
            <view class="gradient-fire membership__buy btn-press" @tap="buy(plan.planCode)">
              {{ payingPlanCode === plan.planCode ? '处理中' : '开通' }}
            </view>
          </view>
        </view>
      </view>

      <view v-if="!membershipStore.plans.length && !membershipStore.loading" class="glass-card membership__empty">
        暂无可购买套餐，请稍后再试。
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.membership {
  &__status {
    padding: 34rpx;
    border-color: rgba(255, 80, 30, 0.32);
    background:
      radial-gradient(circle at 16% 8%, rgba(255, 80, 30, 0.24), transparent 42%),
      rgba(255, 255, 255, 0.04);
  }

  &__badge {
    width: fit-content;
    padding: 8rpx 16rpx;
    border-radius: 999rpx;
    background: rgba(255, 80, 30, 0.18);
    color: #ff7a32;
    font-size: 22rpx;
    font-weight: 900;
  }

  &__status-title {
    margin-top: 22rpx;
    color: #f5f5fa;
    font-size: 42rpx;
    font-weight: 900;
  }

  &__status-sub {
    margin-top: 12rpx;
    color: #b8b8c8;
    font-size: 24rpx;
    line-height: 1.6;
  }

  &__section {
    margin: 30rpx 0 16rpx;
    color: #f5f5fa;
    font-size: 30rpx;
    font-weight: 900;
  }

  &__benefits,
  &__plans {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }

  &__benefit {
    padding: 24rpx;
    color: #d8d8e6;
    font-size: 26rpx;
  }

  &__plan {
    padding: 26rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
  }

  &__plan-name {
    color: #f5f5fa;
    font-size: 30rpx;
    font-weight: 900;
  }

  &__plan-sub {
    margin-top: 8rpx;
    color: #828296;
    font-size: 23rpx;
  }

  &__plan-right {
    display: flex;
    align-items: center;
    gap: 18rpx;
  }

  &__price {
    color: #ff7a32;
    font-size: 34rpx;
    font-weight: 900;
  }

  &__buy {
    min-width: 116rpx;
    min-height: 66rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 24rpx;
    font-weight: 900;
  }

  &__empty {
    margin-top: 18rpx;
    padding: 26rpx;
    color: #828296;
    font-size: 24rpx;
  }
}
</style>
