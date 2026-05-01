<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppHeader from '@/components/app-header/index.vue'
import { useTemplateStore } from '@/stores/template'

const templateStore = useTemplateStore()
const editingId = ref<number | null>(null)
const editName = ref('')

function goBack() {
  uni.navigateBack()
}

function startEdit(id: number, name: string) {
  editingId.value = id
  editName.value = name
}

function saveEdit() {
  if (editingId.value !== null && editName.value.trim()) {
    templateStore.rename(editingId.value, editName.value.trim())
  }
  editingId.value = null
}

onMounted(() => {
  templateStore.loadTemplates()
})
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell safe-bottom">
      <AppHeader title="模板管理" :subtitle="`共 ${templateStore.userItems.length} 个模板`" show-back @back="goBack" />
      <view class="gradient-fire template-manager__create btn-press">+ 新建模板</view>

      <view class="template-manager__list">
        <view v-for="item in templateStore.userItems" :key="item.id" class="glass-card template-manager__item">
          <template v-if="editingId === item.id">
            <input v-model="editName" class="template-manager__input" />
            <view class="gradient-fire template-manager__save btn-press" @tap="saveEdit">保存</view>
          </template>
          <template v-else>
            <view class="template-manager__icon" :style="{ background: item.color, color: item.accent }">{{ item.tag }}</view>
            <view class="template-manager__body">
              <view class="template-manager__name">{{ item.name }}</view>
              <view class="template-manager__meta">{{ item.exercises }} 个动作 · {{ item.duration }} min</view>
            </view>
            <view class="template-manager__actions">
              <view class="glass-card template-manager__action btn-press" @tap="startEdit(item.id, item.name)">编辑</view>
              <view class="glass-card template-manager__action btn-press" @tap="templateStore.duplicate(item.id)">复制</view>
              <view class="template-manager__danger btn-press" @tap="templateStore.remove(item.id)">删除</view>
            </view>
          </template>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.template-manager {
  &__create {
    min-height: 92rpx;
    border-radius: 28rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 28rpx;
    font-weight: 700;
    margin-bottom: 20rpx;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }

  &__item {
    padding: 24rpx;
    display: flex;
    align-items: center;
    gap: 18rpx;
  }

  &__icon {
    width: 72rpx;
    height: 72rpx;
    border-radius: 22rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22rpx;
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

  &__actions {
    display: flex;
    gap: 10rpx;
  }

  &__action,
  &__save {
    padding: 14rpx 18rpx;
    border-radius: 18rpx;
    font-size: 22rpx;
    color: #828296;
  }

  &__save {
    color: #fff;
  }

  &__danger {
    padding: 14rpx 18rpx;
    border-radius: 18rpx;
    background: rgba(248, 71, 33, 0.14);
    color: #ff501e;
    font-size: 22rpx;
  }

  &__input {
    flex: 1;
    min-height: 72rpx;
    color: #f5f5fa;
    border-bottom: 1px solid #ff501e;
  }
}
</style>
