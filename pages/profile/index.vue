<script setup lang="ts">
import { profileStats } from '@/mock/profile'
import { routes } from '@/utils/navigation'

const menuItems = [
  { label: '训练日历', sub: '查看训练记录', path: routes.workoutCalendar, icon: '📅' },
  { label: '历史记录', sub: '浏览训练明细', path: routes.profileHistory, icon: '⏱' },
  { label: '模板管理', sub: '维护训练模板', path: routes.templateManager, icon: '🏋️' },
  { label: '我的收藏', sub: '常用动作与收藏', path: routes.favorites, icon: '★' }
]

const otherItems = [
  { label: '设置', path: routes.settings, icon: '⚙️' },
  { label: '关于', path: routes.about, icon: 'ℹ️' }
]

function openPage(path: string) {
  uni.navigateTo({ url: path })
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell safe-bottom">
      <view class="profile__hero">
        <view class="profile__hero-top">
          <view class="profile__avatar">健</view>
          <view class="profile__info">
            <view class="title-lg">张健身</view>
            <view class="muted">训练 · 198 天</view>
          </view>
          <view class="glass-card profile__settings btn-press" @tap="openPage(routes.settings)">⚙️</view>
        </view>

        <view class="profile__stats">
          <view v-for="item in profileStats" :key="item.label" class="glass-card profile__stat">
            <view>{{ item.icon }}</view>
            <view class="profile__stat-value">{{ item.value }}</view>
            <view class="muted">{{ item.label }}</view>
          </view>
        </view>
      </view>

      <view class="section-label profile__section-label">功能</view>
      <view class="profile__menu">
        <view v-for="item in menuItems" :key="item.label" class="glass-card profile__menu-item btn-press" @tap="openPage(item.path)">
          <view class="profile__menu-icon">{{ item.icon }}</view>
          <view class="profile__menu-body">
            <view class="profile__menu-title">{{ item.label }}</view>
            <view class="profile__menu-sub">{{ item.sub }}</view>
          </view>
          <view class="profile__menu-arrow">›</view>
        </view>
      </view>

      <view class="section-label profile__section-label">其他</view>
      <view class="profile__menu">
        <view v-for="item in otherItems" :key="item.label" class="glass-card profile__menu-item btn-press" @tap="openPage(item.path)">
          <view class="profile__menu-icon">{{ item.icon }}</view>
          <view class="profile__menu-body">
            <view class="profile__menu-title">{{ item.label }}</view>
          </view>
          <view class="profile__menu-arrow">›</view>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.profile {
  &__hero {
    padding: 12rpx 0 12rpx;
  }

  &__hero-top {
    display: flex;
    align-items: center;
    gap: 20rpx;
  }

  &__avatar {
    width: 112rpx;
    height: 112rpx;
    border-radius: 32rpx;
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40rpx;
    font-weight: 700;
    box-shadow: 0 0 32rpx rgba(255, 80, 30, 0.32);
  }

  &__info {
    flex: 1;
  }

  &__settings {
    width: 72rpx;
    height: 72rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16rpx;
    margin-top: 24rpx;
  }

  &__stat {
    padding: 22rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8rpx;
  }

  &__stat-value {
    font-size: 26rpx;
    font-weight: 700;
  }

  &__section-label {
    margin: 28rpx 0 16rpx;
  }

  &__menu {
    display: flex;
    flex-direction: column;
    gap: 14rpx;
  }

  &__menu-item {
    display: flex;
    align-items: center;
    gap: 18rpx;
    padding: 24rpx;
  }

  &__menu-icon {
    width: 68rpx;
    height: 68rpx;
    border-radius: 20rpx;
    background: rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__menu-body {
    flex: 1;
  }

  &__menu-title {
    font-size: 28rpx;
    font-weight: 700;
  }

  &__menu-sub {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
  }

  &__menu-arrow {
    color: #828296;
    font-size: 32rpx;
  }
}
</style>
