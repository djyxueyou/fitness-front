import { request } from '@/api/http'

export interface WechatLoginRequest {
  code: string
}

export interface LoginResponse {
  token: string
  userId: number
  nickname: string
  avatarUrl?: string
  weightUnit: string
  restSeconds: number
  newUser?: boolean
  profileInitializedByDefault?: boolean
}

export function wechatLogin(payload: WechatLoginRequest) {
  return request<LoginResponse>({
    url: '/api/auth/wechat/login',
    method: 'POST',
    data: payload,
    withAuth: false,
    timeoutMs: 45000
  })
}
