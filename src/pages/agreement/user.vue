<script setup lang="ts">
const updatedAt = '2026 年 5 月 28 日'

const sections = [
  {
    title: '一、服务说明',
    paragraphs: [
      '本小程序为健身训练记录工具，提供训练记录、动作库、训练模板、自定义动作、自定义模板、收藏、会员权益和训练数据统计等功能。',
      '我们会根据产品迭代持续优化功能展示、使用流程和会员权益说明，具体功能以小程序实际提供的页面为准。'
    ]
  },
  {
    title: '二、账号与登录',
    paragraphs: [
      '你可以通过微信一键登录创建和使用训练账号。登录后，你的训练记录、收藏、自定义动作、自定义模板和会员状态会保存到对应账号下。',
      '请妥善使用账号，不得将账号用于违法违规、侵犯他人权益、恶意请求接口、破坏系统稳定性或其他不当用途。'
    ]
  },
  {
    title: '三、训练风险提示',
    paragraphs: [
      '动作演示、动作要点、训练模板和训练建议仅用于健身记录与训练参考，不构成医疗、康复、诊断或个性化运动处方。',
      '训练前请结合自身身体状况、运动经验和现场环境量力而行。如存在疾病、伤痛、孕期、术后恢复或明显不适，应先咨询医生或专业教练。'
    ]
  },
  {
    title: '四、会员服务',
    paragraphs: [
      '部分功能可能需要开通会员后使用，包括但不限于自定义动作、自定义模板、收藏能力以及更高频次的训练保存能力。具体权益、价格、有效期和限制以会员页面展示为准。',
      '会员购买、支付、退款等事项遵循微信支付、平台规则及页面说明。若因网络、支付渠道或平台原因导致状态延迟，请以最终订单和会员状态为准。'
    ]
  },
  {
    title: '五、用户内容与数据',
    paragraphs: [
      '你创建的训练记录、自定义动作和自定义模板应与健身训练用途相关，不得包含违法违规、侵权、欺诈、骚扰或其他不适当内容。',
      '我们会按照《隐私政策》处理你的个人信息和训练数据。你可以在小程序内查看隐私政策，了解数据收集、使用、存储和保护规则。'
    ]
  },
  {
    title: '六、服务变更与中断',
    paragraphs: [
      '我们可能因产品升级、系统维护、第三方服务限制、网络异常或不可抗力等原因调整、暂停或中断部分服务。',
      '涉及重要功能或权益变化时，我们会尽量通过页面提示、公告或其他合理方式告知。'
    ]
  },
  {
    title: '七、免责声明',
    paragraphs: [
      '你应自行承担训练过程中的运动风险。本小程序会尽力提供清晰的记录工具和动作参考，但不对因个人身体状况、训练方式、器械环境或第三方因素导致的伤害承担超出法律规定范围的责任。',
      '因网络异常、设备问题、用户操作错误或第三方服务限制导致的数据展示异常、服务延迟或服务中断，我们会在合理范围内协助处理。'
    ]
  },
  {
    title: '八、协议更新与联系',
    paragraphs: [
      '我们可能根据法律法规、平台规则或产品变化更新本协议。更新后的协议会在小程序内展示，继续使用相关服务视为你已了解并接受更新内容。',
      '如对本协议、隐私政策或服务有疑问，可通过小程序“关于”页面提供的方式进行反馈。'
    ]
  }
]

function goBack() {
  uni.navigateBack()
}
</script>

<template>
  <scroll-view scroll-y class="agreement-page">
    <view class="agreement-page__shell">
      <view class="agreement-page__header">
        <view class="agreement-page__back" @tap="goBack">‹</view>
        <view class="agreement-page__header-title">用户协议</view>
      </view>

      <view class="agreement__hero">
        <image class="agreement__logo" src="/static/app-logo.png" mode="aspectFill" />
        <view>
          <view class="agreement__title">用户协议</view>
          <view class="muted agreement__date">更新日期：{{ updatedAt }}</view>
        </view>
      </view>

      <view class="agreement__card">
        <view class="agreement__summary">
          请在使用本小程序前仔细阅读本协议。点击登录、开通会员或继续使用相关功能，即表示你已阅读并同意本协议及相关页面规则。
        </view>
      </view>

      <view v-for="section in sections" :key="section.title" class="agreement__card">
        <view class="agreement__section">
          <view class="agreement__section-title">{{ section.title }}</view>
          <view
            v-for="paragraph in section.paragraphs"
            :key="paragraph"
            class="agreement__paragraph"
          >
            {{ paragraph }}
          </view>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.agreement-page {
  width: 100%;
  height: 100vh;
  min-height: 100vh;
  background:
    radial-gradient(circle at 50% -10%, rgba(255, 80, 30, 0.12) 0%, transparent 58%),
    #0a0a0e;
  color: #f5f5fa;

  &__shell {
    min-height: 100vh;
    padding: calc(var(--status-bar-height, 0px) + 24rpx) 32rpx
      calc(env(safe-area-inset-bottom) + 32rpx);
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 20rpx;
    margin-bottom: 28rpx;
  }

  &__back {
    width: 72rpx;
    height: 72rpx;
    border-radius: 24rpx;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #f5f5fa;
    font-size: 48rpx;
    line-height: 1;
  }

  &__header-title {
    color: #f5f5fa;
    font-size: 42rpx;
    font-weight: 800;
    line-height: 1.2;
  }
}

.agreement {
  &__hero {
    display: flex;
    align-items: center;
    gap: 22rpx;
    margin-bottom: 26rpx;
  }

  &__logo {
    width: 96rpx;
    height: 96rpx;
    border-radius: 30rpx;
    box-shadow: 0 0 32rpx rgba(255, 80, 30, 0.22);
  }

  &__title {
    color: #f5f5fa;
    font-size: 38rpx;
    line-height: 1.2;
    font-weight: 800;
  }

  &__date {
    margin-top: 10rpx;
    color: #828296;
    font-size: 24rpx;
  }

  &__card {
    margin-top: 20rpx;
    border-radius: 30rpx;
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.07);
    overflow: hidden;
  }

  &__summary,
  &__section {
    padding: 26rpx;
  }

  &__summary {
    color: #d8d8e2;
    font-size: 26rpx;
    line-height: 1.7;
  }

  &__section-title {
    color: #fff;
    font-size: 30rpx;
    font-weight: 800;
    margin-bottom: 18rpx;
  }

  &__paragraph {
    color: #a9a9b8;
    font-size: 25rpx;
    line-height: 1.75;
  }

  &__paragraph + &__paragraph {
    margin-top: 14rpx;
  }
}
</style>
