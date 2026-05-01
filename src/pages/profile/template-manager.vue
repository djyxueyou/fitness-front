<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { useTemplateStore } from '@/stores/template'
import type { Template } from '@/types/template'

const templateStore = useTemplateStore()
const editingId = ref<number | null>(null)
const editName = ref('')
const saving = ref(false)

onShow(async () => {
  const ok = await ensureFeatureAuth('模板管理')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  templateStore.fetchTemplates({ includeDetails: false })
})

function goBack() {
  uni.navigateBack()
}

function createTemplate() {
  uni.navigateTo({ url: routes.templateEdit })
}

function goDetail(id: number) {
  uni.navigateTo({ url: `${routes.templateDetail}?id=${id}` })
}

function editTemplate(item: Template) {
  if (item.templateType === 'SYSTEM') return
  uni.navigateTo({ url: `${routes.templateEdit}?id=${item.id}` })
}

function startRename(item: Template) {
  if (item.templateType === 'SYSTEM') return
  editingId.value = item.id
  editName.value = item.name
}

function cancelRename() {
  editingId.value = null
  editName.value = ''
}

async function saveRename() {
  if (editingId.value === null || !editName.value.trim() || saving.value) return
  saving.value = true
  try {
    await templateStore.rename(editingId.value, editName.value.trim())
    cancelRename()
    uni.showToast({ title: '已重命名', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '重命名失败', icon: 'none' })
    console.error('[template] rename failed', err)
  } finally {
    saving.value = false
  }
}

async function duplicateTemplate(id: number) {
  if (saving.value) return
  saving.value = true
  try {
    await templateStore.duplicate(id)
    uni.showToast({ title: '已复制到我的模板', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '复制失败', icon: 'none' })
    console.error('[template] duplicate failed', err)
  } finally {
    saving.value = false
  }
}

async function removeTemplate(id: number) {
  if (saving.value) return
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '删除模板',
      content: '删除后不可恢复，确认删除这个自定义模板吗？',
      confirmText: '删除',
      confirmColor: '#ff501e',
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false)
    })
  })
  if (!confirmed) return

  saving.value = true
  try {
    await templateStore.remove(id)
    uni.showToast({ title: '已删除', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '删除失败', icon: 'none' })
    console.error('[template] remove failed', err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell template-manager safe-bottom">
      <AppHeader
        title="模板管理"
        :subtitle="`我的 ${templateStore.userItems.length} 个 · 系统 ${templateStore.systemItems.length} 个`"
        show-back
        @back="goBack"
      />

      <view class="gradient-fire template-manager__create btn-press" @tap="createTemplate">
        + 新建模板
      </view>

      <view class="template-manager__section-title">我的模板</view>
      <view class="template-manager__list">
        <view v-if="!templateStore.userItems.length" class="glass-card template-manager__empty">
          还没有自定义模板，点击“新建模板”创建一个。
        </view>
        <view
          v-for="item in templateStore.userItems"
          :key="item.id"
          class="glass-card template-manager__item"
        >
          <template v-if="editingId === item.id">
            <input v-model="editName" class="template-manager__input" />
            <view class="gradient-fire template-manager__save btn-press" @tap="saveRename">
              保存
            </view>
            <view class="glass-card template-manager__action btn-press" @tap="cancelRename">
              取消
            </view>
          </template>
          <template v-else>
            <view
              class="template-manager__icon"
              :style="{ background: item.color, color: item.accent }"
            >
              {{ item.tag }}
            </view>
            <view class="template-manager__body" @tap="goDetail(item.id)">
              <view class="template-manager__name">{{ item.name }}</view>
              <view class="template-manager__meta">
                {{ item.exercises }} 个动作 · {{ item.duration }} min
              </view>
            </view>
            <view class="template-manager__actions">
              <view class="glass-card template-manager__action btn-press" @tap="editTemplate(item)">
                编辑
              </view>
              <view class="glass-card template-manager__action btn-press" @tap="startRename(item)">
                改名
              </view>
              <view
                class="glass-card template-manager__action btn-press"
                @tap="duplicateTemplate(item.id)"
              >
                复制
              </view>
              <view class="template-manager__danger btn-press" @tap="removeTemplate(item.id)">
                删除
              </view>
            </view>
          </template>
        </view>
      </view>

      <view class="template-manager__section-title">系统模板</view>
      <view class="template-manager__list">
        <view
          v-for="item in templateStore.systemItems"
          :key="item.id"
          class="glass-card template-manager__item"
        >
          <view
            class="template-manager__icon"
            :style="{ background: item.color, color: item.accent }"
          >
            {{ item.tag }}
          </view>
          <view class="template-manager__body" @tap="goDetail(item.id)">
            <view class="template-manager__name">{{ item.name }}</view>
            <view class="template-manager__meta">
              {{ item.exercises }} 个动作 · 只读，可复制到我的模板
            </view>
          </view>
          <view class="template-manager__actions">
            <view
              class="glass-card template-manager__action btn-press"
              @tap="duplicateTemplate(item.id)"
            >
              复制
            </view>
          </view>
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
    margin-bottom: 28rpx;
  }

  &__section-title {
    margin: 28rpx 0 16rpx;
    color: #f5f5fa;
    font-size: 30rpx;
    font-weight: 800;
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
    flex-shrink: 0;
  }

  &__body {
    flex: 1;
    min-width: 0;
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
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10rpx;
    max-width: 280rpx;
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

  &__empty {
    padding: 24rpx;
    color: #828296;
    font-size: 24rpx;
  }
}
</style>
