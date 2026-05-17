import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createMembershipOrder,
  fetchMembershipOrder,
  fetchMembershipPlans,
  fetchMembershipStatus,
  type MembershipPlanResponse,
  type MembershipStatusResponse
} from '@/api/membership'

export const useMembershipStore = defineStore('membership', () => {
  const status = ref<MembershipStatusResponse | null>(null)
  const plans = ref<MembershipPlanResponse[]>([])
  const loading = ref(false)

  const active = computed(() => !!status.value?.active)
  const statusText = computed(() => {
    if (!status.value) return '会员状态加载中'
    if (status.value.trial) return `试用剩余 ${status.value.remainingDays} 天`
    if (status.value.active) return `会员剩余 ${status.value.remainingDays} 天`
    return '会员已过期'
  })

  async function refreshStatus() {
    status.value = await fetchMembershipStatus()
    return status.value
  }

  async function loadPlans() {
    if (plans.value.length) return plans.value
    plans.value = await fetchMembershipPlans()
    return plans.value
  }

  async function loadAll() {
    loading.value = true
    try {
      const [nextStatus, nextPlans] = await Promise.all([refreshStatus(), loadPlans()])
      return { status: nextStatus, plans: nextPlans }
    } finally {
      loading.value = false
    }
  }

  async function createOrder(planCode: string) {
    return createMembershipOrder(planCode)
  }

  async function waitPaid(orderNo: string, maxAttempts = 8) {
    // WeChat Pay callbacks can arrive later than the client payment result,
    // so poll briefly before deciding whether the payment is still pending.
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const order = await fetchMembershipOrder(orderNo)
      if (order.payStatus === 'PAID') {
        await refreshStatus()
        return order
      }
      await new Promise((resolve) => setTimeout(resolve, 1200))
    }
    return fetchMembershipOrder(orderNo)
  }

  function reset() {
    status.value = null
  }

  return {
    status,
    plans,
    loading,
    active,
    statusText,
    refreshStatus,
    loadPlans,
    loadAll,
    createOrder,
    waitPaid,
    reset
  }
})
