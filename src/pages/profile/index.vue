<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { clearToken, getToken } from '@/api/http'
import { fetchTrainingLevelProfile, type TrainingLevelProfileResponse } from '@/api/training-level'
import TrainingLevelBadge from '@/components/training-level-badge/index.vue'
import WorkoutDraftFab from '@/components/workout-draft-fab/index.vue'
import WorkoutDraftPrompt from '@/components/workout-draft-prompt/index.vue'
import { useProfileStore } from '@/stores/profile'
import { useThemeStore } from '@/stores/theme'
import { useWorkoutStore } from '@/stores/workout'
import { useWorkoutDraftPromptStore } from '@/stores/workout-draft-prompt'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { emitAuthChanged } from '@/utils/auth-events'
import { routes } from '@/utils/navigation'
import { formatCompactWeight } from '@/utils/unit'

const profileStore = useProfileStore()
const workoutStore = useWorkoutStore()
const draftPromptStore = useWorkoutDraftPromptStore()
const themeStore = useThemeStore()
const authChecking = ref(true)
const trainingLevel = ref<TrainingLevelProfileResponse | null>(null)
const showLevelDetail = ref(false)
let authFlowRunning = false
let suppressNextAuthUntil = 0

const weightUnit = computed(() => profileStore.unit)
const levelState = computed(() => trainingLevel.value)
const levelTitle = computed(() =>
  levelState.value ? `Lv.${levelState.value.level} · ${levelState.value.badgeName}` : 'Lv.1 · 青铜'
)
const levelProgressText = computed(() =>
  levelState.value
    ? `${levelState.value.currentLevelExp}/${levelState.value.nextLevelExp} XP`
    : '0/40 XP'
)
const levelProgressStyle = computed(() => ({
  width: `${Math.max(0, Math.min(100, levelState.value?.progressPercent || 0))}%`
}))
const levelNextExp = computed(() => {
  if (!levelState.value) return '--'
  return Math.max(0, levelState.value.nextLevelExp - levelState.value.currentLevelExp)
})
const levelProgressPercent = computed(() =>
  Math.max(0, Math.min(100, levelState.value?.progressPercent || 0))
)
const levelThemeStyle = computed(() => ({
  '--level-theme': levelState.value?.themeColor || '#ff7a1a',
  '--level-accent': levelState.value?.accentColor || '#cd7f32'
}))
const levelSummaryItems = computed(() => [
  { label: '当前 XP', value: levelProgressText.value },
  { label: '连续训练', value: `${levelState.value?.currentStreakDays || 0} 天` },
  { label: '总 XP', value: `${levelState.value?.totalExp || 0}` }
])
const levelRuleItems = [
  { title: '有效训练', desc: '训练满 30 分钟才会增加 XP' },
  { title: '每日结算', desc: '每天最多结算一次训练 XP' },
  { title: '额外加成', desc: '满 60 分钟和连续训练有少量加成' }
]

const badgePreviewItems = [
  { badgeCode: 'BRONZE', badgeName: '青铜', range: 'Lv.1-5', accentColor: '#cd7f32' },
  { badgeCode: 'SILVER', badgeName: '白银', range: 'Lv.6-10', accentColor: '#b8c0cc' },
  { badgeCode: 'GOLD', badgeName: '黄金', range: 'Lv.11-20', accentColor: '#d6a63a' },
  { badgeCode: 'PLATINUM', badgeName: '铂金', range: 'Lv.21-35', accentColor: '#94a3b8' },
  { badgeCode: 'DIAMOND', badgeName: '钻石', range: 'Lv.36-55', accentColor: '#60a5fa' },
  { badgeCode: 'STELLAR', badgeName: '星耀', range: 'Lv.56-80', accentColor: '#8b5cf6' },
  { badgeCode: 'GLORY', badgeName: '荣耀', range: 'Lv.81+', accentColor: '#f59e0b' }
]
const currentBadgeIndex = computed(() => {
  const index = badgePreviewItems.findIndex(
    (item) => item.badgeCode === levelState.value?.badgeCode
  )
  return index >= 0 ? index : 0
})
const profileStats = computed(() => [
  { value: `${profileStore.currentStreakDays} 天`, label: '连续训练' },
  { value: `${profileStore.totalSessions} 次`, label: '累计训练' },
  {
    value: `${formatCompactWeight(profileStore.totalVolumeKg, weightUnit.value)} ${weightUnit.value}`,
    label: '累计容量'
  }
])

const healthItems = [
  {
    label: '身体指标',
    sub: '体脂、围度和心率记录',
    path: routes.profileBodyMetrics,
    icon: '/static/profile/chart-bar.svg'
  }
]

const accountItems = [
  {
    label: '会员中心',
    sub: '查看试用期、套餐和会员权益',
    path: routes.membership,
    icon: '/static/profile/sparkles.svg'
  },
  {
    label: '我的收藏',
    sub: '常用动作收藏',
    path: routes.favorites,
    icon: '/static/profile/heart.svg'
  },
  {
    label: '设置',
    sub: '单位、休息与应用偏好',
    path: routes.settings,
    icon: '/static/profile/cog-6-tooth.svg'
  },
  {
    label: '关于',
    sub: '版本信息与相关协议',
    path: routes.about,
    icon: '/static/profile/information-circle.svg'
  }
]

onShow(async () => {
  if (Date.now() < suppressNextAuthUntil) return
  if (authFlowRunning) return
  authFlowRunning = true
  authChecking.value = true
  const ok = await ensureFeatureAuth('个人信息')
  if (!ok) {
    suppressNextAuthUntil = Date.now() + 1200
    authChecking.value = false
    authFlowRunning = false
    uni.switchTab({ url: routes.home })
    return
  }
  await Promise.all([
    profileStore.refreshProfile(),
    profileStore.refreshSummary(),
    refreshTrainingLevel()
  ])
  authChecking.value = false
  authFlowRunning = false
})

async function refreshTrainingLevel() {
  try {
    trainingLevel.value = await fetchTrainingLevelProfile()
  } catch (err) {
    trainingLevel.value = null
    console.error('[training-level] profile fetch failed', err)
  }
}

function openPage(path: string) {
  uni.navigateTo({ url: path })
}

function openLevelDetail() {
  showLevelDetail.value = true
}

function closeLevelDetail() {
  showLevelDetail.value = false
}

function goTrainFromLevel() {
  showLevelDetail.value = false
  uni.switchTab({ url: routes.home })
}

function goAnalysisFromLevel() {
  showLevelDetail.value = false
  uni.navigateTo({ url: routes.volumeTrend })
}

async function openDraftFab() {
  workoutStore.refreshDraftState()
  const action = await draftPromptStore.open()
  if (action === 'continue') {
    if (workoutStore.restoreDraft()) {
      uni.navigateTo({ url: routes.workoutActive })
    }
  }
  if (action === 'discard') {
    workoutStore.discardWorkout()
  }
}

function logout() {
  uni.showModal({
    title: '退出登录？',
    content: '退出后将清除当前登录状态，训练记录和收藏需要重新登录后查看。',
    confirmText: '退出',
    confirmColor: '#ff6b4a',
    success: (res) => {
      if (!res.confirm) return
      clearToken()
      profileStore.resetProfile()
      emitAuthChanged()
      uni.showToast({ title: '已退出登录', icon: 'none' })
      uni.switchTab({ url: routes.home })
    }
  })
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view class="page-shell tab-page profile-page safe-bottom" :class="themeStore.themeClass">
      <view v-if="authChecking && !getToken()" class="profile__auth-state muted">
        正在打开登录授权...
      </view>
      <template v-else>
        <view class="profile__page-title">我的</view>

        <view class="profile__summary" :style="levelThemeStyle">
          <view class="profile__identity btn-press" @tap="openPage(routes.profileEdit)">
            <image
              class="profile__avatar"
              :src="profileStore.avatarDisplayUrl || '/static/app-logo.png'"
              mode="aspectFill"
            />
            <view class="profile__info">
              <view class="title-lg">{{ profileStore.nickname }}</view>
              <view class="profile__identity-sub btn-press" @tap.stop="openLevelDetail">
                {{ levelTitle }}
              </view>
            </view>
            <view class="profile__chevron">›</view>
          </view>

          <view class="profile__stats">
            <view v-for="item in profileStats" :key="item.label" class="profile__stat">
              <view class="profile__stat-value">{{ item.value }}</view>
              <view class="profile__stat-label">{{ item.label }}</view>
            </view>
          </view>
        </view>

        <view class="profile__group">
          <view
            v-for="item in [...healthItems, ...accountItems]"
            :key="item.label"
            class="profile__row btn-press"
            @tap="openPage(item.path)"
          >
            <image class="profile__row-icon" :src="item.icon" mode="aspectFit" />
            <view class="profile__row-body">
              <view class="profile__row-title">{{ item.label }}</view>
            </view>
            <view class="profile__chevron">›</view>
          </view>
        </view>

        <view class="profile__logout btn-press" @tap="logout">退出登录</view>
      </template>
    </view>
  </scroll-view>

  <view v-if="showLevelDetail" class="profile__level-overlay" @tap="closeLevelDetail">
    <view class="profile__level-sheet" :style="levelThemeStyle" @tap.stop>
      <view class="profile__sheet-handle" />
      <view class="profile__sheet-top">
        <view>
          <view class="profile__sheet-heading">训练等级详解</view>
          <view class="profile__sheet-sub">用长期有效训练记录体现成长。</view>
        </view>
        <view class="profile__sheet-close btn-press" @tap="closeLevelDetail">×</view>
      </view>

      <scroll-view scroll-y class="profile__sheet-content" :show-scrollbar="false">
        <view class="profile__level-detail-card">
          <TrainingLevelBadge
            size="lg"
            :level="levelState?.level || 1"
            :badge-name="levelState?.badgeName || '青铜'"
            :badge-code="levelState?.badgeCode || 'BRONZE'"
            :theme-color="levelState?.themeColor || '#ff7a1a'"
            :accent-color="levelState?.accentColor || '#cd7f32'"
          />
          <view class="profile__level-detail-body">
            <view class="profile__level-detail-label">当前等级</view>
            <view class="profile__level-detail-title">{{ levelTitle }}</view>
            <view class="profile__level-detail-copy">
              {{ levelState?.badgeName || '青铜' }} · {{ levelState?.stageName || '起步' }}阶段
            </view>
            <view class="profile__level-track profile__level-track--detail">
              <view class="profile__level-bar" :style="levelProgressStyle" />
            </view>
            <view class="profile__level-detail-row">
              <text>还差 {{ levelNextExp }} XP 升级</text>
              <text>{{ levelProgressPercent }}%</text>
            </view>
          </view>
        </view>

        <view class="profile__level-summary">
          <view
            v-for="item in levelSummaryItems"
            :key="item.label"
            class="profile__level-summary-item"
          >
            <view class="profile__level-summary-value">{{ item.value }}</view>
            <view class="profile__level-summary-label">{{ item.label }}</view>
          </view>
        </view>

        <view class="profile__sheet-section-title">等级路线</view>
        <scroll-view scroll-x class="profile__badge-list" :show-scrollbar="false">
          <view class="profile__badge-list-inner">
            <view
              v-for="(item, index) in badgePreviewItems"
              :key="item.badgeCode"
              class="profile__badge-item"
              :class="{
                'profile__badge-item--current': item.badgeCode === levelState?.badgeCode,
                'profile__badge-item--locked': index > currentBadgeIndex
              }"
            >
              <TrainingLevelBadge
                size="sm"
                :level="index + 1"
                :badge-name="item.badgeName"
                :badge-code="item.badgeCode"
                theme-color="#ff7a1a"
                :accent-color="item.accentColor"
                :upgraded="item.badgeCode === levelState?.badgeCode"
              />
              <view class="profile__badge-name">{{ item.badgeName }}</view>
              <view class="profile__badge-range">{{ item.range }}</view>
            </view>
          </view>
        </scroll-view>

        <view class="profile__sheet-section-title">结算规则</view>
        <view class="profile__level-rules">
          <view v-for="item in levelRuleItems" :key="item.title" class="profile__level-rule">
            <view class="profile__level-rule-title">{{ item.title }}</view>
            <view class="profile__level-rule-desc">{{ item.desc }}</view>
          </view>
        </view>
      </scroll-view>

      <view class="profile__level-actions">
        <view class="gradient-fire profile__level-action btn-press" @tap="goTrainFromLevel"
          >去训练</view
        >
        <view class="glass-card profile__level-action btn-press" @tap="goAnalysisFromLevel"
          >查看训练分析</view
        >
      </view>
    </view>
  </view>

  <WorkoutDraftFab
    :class="themeStore.themeClass"
    :visible="!showLevelDetail"
    variant="light"
    @open="openDraftFab"
  />
  <WorkoutDraftPrompt />
</template>

<style lang="scss" scoped>
.profile {
  &__auth-state {
    min-height: 70vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__hero {
    padding: 30rpx;
    border-radius: 36rpx;
    background:
      radial-gradient(circle at 18% 0%, rgba(255, 122, 26, 0.14), transparent 38%), var(--app-card);
    border: 1rpx solid rgba(255, 122, 26, 0.16);
    box-shadow: var(--app-shadow);
  }

  &__hero-top {
    display: flex;
    align-items: center;
    gap: 20rpx;
  }

  &__avatar {
    width: 104rpx;
    height: 104rpx;
    border-radius: 32rpx;
    background: var(--app-surface);
  }

  &__info {
    min-width: 0;
    flex: 1;
  }

  &__profile-sub {
    margin-top: 8rpx;
    color: var(--app-text-muted);
    font-size: 24rpx;
  }

  &__level-card {
    margin-top: 28rpx;
    padding: 24rpx;
    border-radius: 30rpx;
    background: rgba(255, 255, 255, 0.78);
    border: 1rpx solid rgba(255, 122, 26, 0.18);
    display: flex;
    align-items: center;
    gap: 22rpx;
  }

  &__level-main {
    min-width: 0;
    flex: 1;
  }

  &__level-label {
    color: var(--app-accent);
    font-size: 22rpx;
    font-weight: 900;
  }

  &__level-title {
    margin-top: 8rpx;
    color: var(--app-text);
    font-size: 32rpx;
    font-weight: 950;
  }

  &__level-copy,
  &__level-next,
  &__level-detail-copy {
    color: var(--app-text-muted);
    font-size: 22rpx;
    line-height: 1.5;
  }

  &__level-track {
    height: 12rpx;
    margin-top: 14rpx;
    overflow: hidden;
    border-radius: 999rpx;
    background: var(--app-surface);
  }

  &__level-track--detail {
    margin: 18rpx 0;
  }

  &__level-bar {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--level-theme), var(--level-accent));
  }

  &__level-side {
    width: 150rpx;
    text-align: right;
  }

  &__level-value {
    color: var(--app-text);
    font-size: 22rpx;
    font-weight: 900;
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14rpx;
    margin-top: 24rpx;
  }

  &__stat {
    padding: 20rpx 14rpx;
    border-radius: 24rpx;
    background: var(--app-surface);
    text-align: center;
  }

  &__stat-icon {
    font-size: 24rpx;
  }

  &__stat-value {
    margin-top: 8rpx;
    color: var(--app-text);
    font-size: 24rpx;
    font-weight: 900;
  }

  &__section-head {
    margin: 34rpx 0 18rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__section-head--services {
    margin-top: 42rpx;
  }

  &__section-title {
    color: var(--app-text);
    font-size: 32rpx;
    font-weight: 950;
  }

  &__quick-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 18rpx;
  }

  &__quick-item,
  &__menu-item {
    border-radius: 28rpx;
    background: var(--app-card);
    border: 1rpx solid var(--app-border);
    box-shadow: var(--app-shadow-sm);
  }

  &__quick-item {
    padding: 24rpx;
  }

  &__quick-icon,
  &__menu-icon {
    width: 58rpx;
    height: 58rpx;
    border-radius: 18rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-accent);
    font-size: 26rpx;
    font-weight: 900;
  }

  &__quick-title,
  &__menu-title {
    margin-top: 16rpx;
    color: var(--app-text);
    font-size: 26rpx;
    font-weight: 900;
  }

  &__quick-sub,
  &__menu-sub {
    margin-top: 8rpx;
    color: var(--app-text-muted);
    font-size: 21rpx;
    line-height: 1.45;
  }

  &__menu {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }

  &__menu-item {
    padding: 24rpx;
    display: flex;
    align-items: center;
    gap: 18rpx;
  }

  &__menu-body {
    min-width: 0;
    flex: 1;
  }

  &__menu-title {
    margin-top: 0;
  }

  &__menu-arrow {
    color: var(--app-text-muted);
    font-size: 42rpx;
  }

  &__logout {
    height: 84rpx;
    margin: 30rpx 0 20rpx;
    border-radius: 28rpx;
    background: rgba(255, 80, 80, 0.1);
    color: var(--app-danger);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26rpx;
    font-weight: 900;
  }

  &__page-title {
    margin: 8rpx 0 24rpx;
    color: var(--app-text);
    font-size: 54rpx;
    font-weight: 900;
    line-height: 1.15;
  }

  &__summary,
  &__group {
    overflow: hidden;
    border: 1rpx solid var(--app-border);
    border-radius: var(--app-radius-lg);
    background: var(--app-surface);
    box-shadow: none;
  }

  &__group {
    margin-top: 34rpx;
  }

  &__summary {
    padding: 0;
  }

  &__identity {
    min-height: 132rpx;
    padding: 24rpx 26rpx;
    display: flex;
    align-items: center;
    gap: 22rpx;
  }

  &__avatar {
    width: 92rpx;
    height: 92rpx;
    border-radius: 28rpx;
    background: var(--app-bg);
  }

  &__identity-sub {
    margin-top: 6rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
  }

  &__chevron {
    margin-left: auto;
    flex-shrink: 0;
    color: var(--app-text-muted);
    font-size: 40rpx;
    font-weight: 500;
  }

  &__level-card {
    margin: 0 26rpx;
    padding: 24rpx 0;
    border-width: 1rpx 0 0;
    border-radius: 0;
    border-color: var(--app-border);
    background: transparent;
    box-shadow: none;
  }

  &__level-track {
    background: var(--app-bg);
  }

  &__level-bar {
    background: var(--app-accent);
  }

  &__stats {
    margin: 0;
    padding: 22rpx 12rpx 26rpx;
    border-top: 1rpx solid var(--app-border);
    gap: 0;
  }

  &__stat {
    position: relative;
    padding: 4rpx 10rpx;
    border-radius: 0;
    background: transparent;

    & + &::before {
      position: absolute;
      top: 4rpx;
      bottom: 4rpx;
      left: 0;
      width: 1rpx;
      background: var(--app-border);
      content: '';
    }
  }

  &__stat-value {
    margin-top: 0;
    font-size: 27rpx;
  }

  &__stat-label {
    margin-top: 8rpx;
    color: var(--app-text-muted);
    font-size: 21rpx;
  }

  &__section-title {
    margin: 34rpx 8rpx 14rpx;
    color: var(--app-text-muted);
    font-size: 23rpx;
    font-weight: 700;
  }

  &__row {
    position: relative;
    min-height: 96rpx;
    padding: 18rpx 26rpx;
    display: flex;
    align-items: center;
    gap: 20rpx;

    & + &::before {
      position: absolute;
      top: 0;
      right: 24rpx;
      left: 24rpx;
      height: 1rpx;
      background: var(--app-border);
      content: '';
    }
  }

  &__row-body {
    min-width: 0;
    flex: 1;
  }

  &__row-icon {
    width: 42rpx;
    height: 42rpx;
    flex-shrink: 0;
    opacity: 0.72;
  }

  &__row-title {
    color: var(--app-text);
    font-size: 27rpx;
    font-weight: 800;
  }

  &__row-sub {
    margin-top: 6rpx;
    color: var(--app-text-muted);
    font-size: 21rpx;
    line-height: 1.4;
  }

  &__level-overlay {
    position: fixed;
    inset: 0;
    z-index: 1100;
    background: rgba(8, 13, 24, 0.58);
    display: flex;
    align-items: flex-end;
  }

  &__level-sheet {
    width: 100%;
    height: 82vh;
    padding: 14rpx 32rpx 0;
    border-radius: 40rpx 40rpx 0 0;
    background: #f3f6fb;
    box-shadow: 0 -24rpx 60rpx rgba(15, 23, 42, 0.18);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  &__sheet-handle {
    width: 64rpx;
    height: 8rpx;
    margin: 0 auto 22rpx;
    border-radius: 999rpx;
    background: var(--app-border-strong);
    flex-shrink: 0;
  }

  &__sheet-top {
    flex-shrink: 0;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20rpx;
    margin: 0 -32rpx;
    padding: 0 32rpx 20rpx;
    background: #f3f6fb;
    border-bottom: 1rpx solid rgba(226, 232, 240, 0.8);
  }

  &__sheet-heading {
    color: var(--app-text);
    font-size: 34rpx;
    font-weight: 950;
  }

  &__sheet-sub {
    margin-top: 8rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
  }

  &__sheet-close {
    width: 68rpx;
    height: 68rpx;
    border-radius: 24rpx;
    background: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-text-muted);
    font-size: 34rpx;
    font-weight: 900;
    flex-shrink: 0;
  }

  &__sheet-content {
    flex: 1;
    min-height: 0;
    padding: 24rpx 0 18rpx;
    background: #f3f6fb;
  }

  &__sheet-section-title {
    margin: 28rpx 0 14rpx;
    color: var(--app-text);
    font-size: 26rpx;
    font-weight: 950;
  }

  &__level-detail-card {
    padding: 26rpx;
    border-radius: 32rpx;
    background:
      radial-gradient(circle at 12% 8%, rgba(255, 255, 255, 0.9), transparent 34%),
      radial-gradient(circle at 86% 0%, rgba(255, 122, 26, 0.16), transparent 42%), #ffffff;
    display: flex;
    align-items: center;
    gap: 24rpx;
    border: 1rpx solid rgba(255, 122, 26, 0.16);
  }

  &__level-detail-body {
    min-width: 0;
    flex: 1;
  }

  &__level-detail-label {
    color: var(--app-accent);
    font-size: 21rpx;
    font-weight: 950;
  }

  &__level-detail-title {
    margin-top: 6rpx;
    color: var(--app-text);
    font-size: 34rpx;
    font-weight: 950;
  }

  &__level-detail-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12rpx;
    color: var(--app-text-secondary);
    font-size: 21rpx;
    font-weight: 800;
  }

  &__level-summary {
    margin-top: 16rpx;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12rpx;
  }

  &__level-summary-item {
    padding: 18rpx 16rpx;
    border-radius: 24rpx;
    background: #ffffff;
    border: 1rpx solid rgba(226, 232, 240, 0.9);
  }

  &__level-summary-value {
    color: var(--app-text);
    font-size: 25rpx;
    font-weight: 950;
    line-height: 1.1;
  }

  &__level-summary-label {
    margin-top: 8rpx;
    color: var(--app-text-muted);
    font-size: 19rpx;
  }

  &__badge-list {
    white-space: nowrap;
  }

  &__badge-list-inner {
    display: inline-flex;
    gap: 16rpx;
    padding-bottom: 6rpx;
  }

  &__badge-item {
    width: 138rpx;
    padding: 18rpx 14rpx;
    border-radius: 26rpx;
    background: #ffffff;
    border: 1rpx solid transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10rpx;
  }

  &__badge-item--current {
    border-color: var(--app-accent);
    box-shadow: 0 12rpx 30rpx rgba(255, 98, 31, 0.18);
  }

  &__badge-item--locked {
    opacity: 0.45;
  }

  &__badge-name {
    color: var(--app-text);
    font-size: 22rpx;
    font-weight: 900;
  }

  &__badge-range {
    color: var(--app-text-muted);
    font-size: 18rpx;
  }

  &__level-rules {
    display: flex;
    flex-direction: column;
    gap: 12rpx;
  }

  &__level-rule {
    padding: 22rpx 24rpx;
    border-radius: 24rpx;
    background: #ffffff;
    border: 1rpx solid rgba(226, 232, 240, 0.9);
  }

  &__level-rule-title {
    color: var(--app-text);
    font-size: 24rpx;
    font-weight: 950;
  }

  &__level-rule-desc {
    margin-top: 6rpx;
    color: var(--app-text-muted);
    font-size: 21rpx;
    line-height: 1.45;
  }

  &__level-actions {
    flex-shrink: 0;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16rpx;
    padding: 20rpx 0 calc(28rpx + env(safe-area-inset-bottom));
    border-top: 1rpx solid rgba(226, 232, 240, 0.8);
    background: #f3f6fb;
  }

  &__level-action {
    height: 82rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26rpx;
    font-weight: 950;
  }
}
</style>
