import { request } from '@/api/http'

export interface MembershipStatusResponse {
  active: boolean
  trial: boolean
  expired: boolean
  planCode: string
  trialEndsAt?: string
  membershipExpiresAt?: string
  remainingDays: number
}

export interface MembershipPlanResponse {
  planCode: string
  name: string
  priceCent: number
  durationMonths: number
}

export interface MiniProgramPayParams {
  timeStamp: string
  nonceStr: string
  packageValue: string
  signType: 'RSA' | string
  paySign: string
}

export interface CreateMembershipOrderResponse {
  orderNo: string
  payStatus: string
  amountCent: number
  payParams: MiniProgramPayParams
}

export interface MembershipOrderStatusResponse {
  orderNo: string
  planCode: string
  amountCent: number
  payStatus: string
  paidAt?: string
}

export function fetchMembershipStatus() {
  return request<MembershipStatusResponse>({
    url: '/api/membership/status'
  })
}

export function fetchMembershipPlans() {
  return request<MembershipPlanResponse[]>({
    url: '/api/membership/plans'
  })
}

export function createMembershipOrder(planCode: string) {
  return request<CreateMembershipOrderResponse>({
    url: '/api/membership/orders',
    method: 'POST',
    data: { planCode },
    timeoutMs: 60000
  })
}

export function fetchMembershipOrder(orderNo: string) {
  return request<MembershipOrderStatusResponse>({
    url: `/api/membership/orders/${orderNo}`
  })
}
