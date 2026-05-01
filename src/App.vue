<template>
  <view />
</template>

<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'

const RESOLVED_API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://127.0.0.1:8080'

onLaunch(() => {
  console.log('[app] launch')
  console.log('[env] apiBaseUrl(raw)=', import.meta.env.VITE_API_BASE_URL)
  console.log('[env] apiBaseUrl(resolved)=', RESOLVED_API_BASE_URL)
  console.log('[env] wechatRealLogin=', import.meta.env.VITE_WECHAT_REAL_LOGIN)
})
</script>

<style lang="scss">
@import '@/styles/global.scss';
</style>
