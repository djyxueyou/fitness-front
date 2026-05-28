<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { useMembershipStore } from '@/stores/membership'

const membershipStore = useMembershipStore()
const payingPlanCode = ref('')

const benefits = [
  {
    title: '不限训练记录',
    desc: '免费版每周只能保存 1 次训练，会员可不限次数记录。'
  },
  {
    title: '动作收藏',
    desc: '收藏常用动作，在动作库和训练中快速找到。'
  },
  {
    title: '自定义动作',
    desc: '创建只属于你的动作，支持自重、负重和计时类型。'
  },
  {
    title: '自定义模板',
    desc: '新建、复制、编辑模板，把常练计划沉淀下来。'
  },
  {
    title: '历史沉淀',
    desc: '从训练历史保存为模板，复用自己的有效训练安排。'
  }
]

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
    return `剩余 ${status.remainingDays} 天，可使用不限训练、收藏动作、自定义动作和自定义模板。`
  }
  return '免费版每周可保存 1 次训练，开通会员后解锁完整训练记录和自定义能力。'
})

const expirationWarning = computed(() => {
  const status = membershipStore.status
  if (!status) return null
  if (status.active && status.remainingDays <= 7) {
    return {
      type: 'warning',
      text: status.trial
        ? `试用将在 ${status.remainingDays} 天后到期，续费后可继续使用会员权益。`
        : `会员将在 ${status.remainingDays} 天后到期，请及时续费。`
    }
  }
  if (status.expired) {
    return {
      type: 'expired',
      text: '会员已过期。已创建的数据会保留，但不能继续收藏、新建或编辑自定义内容。'
    }
  }
  return null
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

function planSubText(months: number) {
  if (months >= 12) return '12 个月会员，适合长期训练记录'
  return `${months} 个月会员，适合先体验完整权益`
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
        subtitle="解锁完整训练记录、收藏和自定义能力"
        show-back
        @back="goBack"
      />

      <view class="glass-card membership__status">
        <view class="membership__badge">{{ membershipStore.status?.trial ? 'TRIAL' : 'VIP' }}</view>
        <view class="membership__status-title">{{ statusTitle }}</view>
        <view class="membership__status-sub">{{ statusSub }}</view>
      </view>

      <view
        v-if="expirationWarning"
        class="membership__warning"
        :class="`membership__warning--${expirationWarning.type}`"
      >
        {{ expirationWarning.text }}
      </view>

      <view class="membership__section">会员权益</view>
      <view class="membership__benefits">
        <view v-for="item in benefits" :key="item.title" class="glass-card membership__benefit">
          <view class="membership__benefit-icon">✓</view>
          <view class="membership__benefit-copy">
            <view class="membership__benefit-title">{{ item.title }}</view>
            <view class="membership__benefit-desc">{{ item.desc }}</view>
          </view>
        </view>
      </view>

      <view class="membership__section">选择套餐</view>
      <view class="membership__plans">
        <view v-for="plan in membershipStore.plans" :key="plan.planCode" class="glass-card membership__plan">
          <view class="membership__plan-copy">
            <view class="membership__plan-name">{{ plan.name }}</view>
            <view class="membership__plan-sub">{{ planSubText(plan.durationMonths) }}</view>
          </view>
          <view class="membership__plan-right">
            <view class="membership__price">{{ priceText(plan.priceCent) }}</view>
            <view class="gradient-fire membership__buy btn-press" @tap="buy(plan.planCode)">
              {{ payingPlanCode === plan.planCode ? '处理中' : '开通' }}
            </view>
          </view>
        </view>
      </view>

      <view class="membership__note">
        说明：会员到期后，历史训练、自定义动作和自定义模板会保留；但不能继续收藏、新建或编辑自定义内容。
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
    color: #d8d8e6;
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
    display: flex;
    gap: 18rpx;
    align-items: flex-start;
  }

  &__benefit-icon {
    width: 42rpx;
    height: 42rpx;
    border-radius: 999rpx;
    background: rgba(255, 80, 30, 0.18);
    color: #ff7a32;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24rpx;
    font-weight: 900;
    flex-shrink: 0;
  }

  &__benefit-copy {
    min-width: 0;
  }

  &__benefit-title {
    color: #f5f5fa;
    font-size: 27rpx;
    font-weight: 900;
  }

  &__benefit-desc {
    margin-top: 8rpx;
    color: #9c9caf;
    font-size: 23rpx;
    line-height: 1.5;
  }

  &__plan {
    padding: 26rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
  }

  &__plan-copy {
    min-width: 0;
    flex: 1;
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
    line-height: 1.4;
  }

  &__plan-right {
    display: flex;
    align-items: center;
    gap: 18rpx;
    flex-shrink: 0;
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

  &__note {
    margin-top: 24rpx;
    color: #828296;
    font-size: 22rpx;
    line-height: 1.6;
  }

  &__empty {
    margin-top: 18rpx;
    padding: 26rpx;
    color: #828296;
    font-size: 24rpx;
  }

  &__warning {
    margin-top: 20rpx;
    padding: 20rpx 24rpx;
    border-radius: 24rpx;
    font-size: 24rpx;
    line-height: 1.6;

    &--warning {
      background: rgba(255, 160, 60, 0.12);
      border: 1px solid rgba(255, 160, 60, 0.28);
      color: #ffa03c;
    }

    &--expired {
      background: rgba(255, 107, 74, 0.1);
      border: 1px solid rgba(255, 107, 74, 0.22);
      color: #ff6b4a;
    }
  }
}
</style>
