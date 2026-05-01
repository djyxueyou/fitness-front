import { request } from '@/api/http'

export interface TemplateListItemResponse {
  id: number
  name: string
  templateType: 'USER' | 'SYSTEM' | string
  description?: string
  exerciseCount: number
  lastUsedAt?: string
  updatedAt?: string
}

export interface TemplateItemResponse {
  exerciseId: number
  exerciseName: string
  sortOrder: number
  targetSets: number
}

export interface TemplateDetailResponse {
  id: number
  name: string
  templateType: 'USER' | 'SYSTEM' | string
  description?: string
  sourceTrainingId?: number
  lastUsedAt?: string
  createdAt?: string
  items: TemplateItemResponse[]
}

export interface UpsertTemplateItemRequest {
  exerciseId: number
  targetSets: number
}

export interface UpsertTemplateRequest {
  name: string
  items: UpsertTemplateItemRequest[]
}

export interface UpsertTemplateResponse {
  id: number
}

export function fetchTemplateList() {
  return request<TemplateListItemResponse[]>({
    url: '/api/templates',
    method: 'GET'
  })
}

export function fetchTemplateDetail(id: number) {
  return request<TemplateDetailResponse>({
    url: `/api/templates/${id}`,
    method: 'GET'
  })
}

export function createTemplate(payload: UpsertTemplateRequest) {
  return request<UpsertTemplateResponse>({
    url: '/api/templates',
    method: 'POST',
    data: payload,
    timeoutMs: 30000
  })
}

export function updateTemplate(id: number, payload: UpsertTemplateRequest) {
  return request<UpsertTemplateResponse>({
    url: `/api/templates/${id}`,
    method: 'PUT',
    data: payload,
    timeoutMs: 30000
  })
}

export function deleteTemplate(id: number) {
  return request<void>({
    url: `/api/templates/${id}`,
    method: 'DELETE',
    timeoutMs: 30000
  })
}

export function copyTemplate(id: number) {
  return request<UpsertTemplateResponse>({
    url: `/api/templates/${id}/copy`,
    method: 'POST',
    timeoutMs: 30000
  })
}

export function createTemplateFromTraining(trainingId: number, name?: string) {
  const encodedName = name ? `?name=${encodeURIComponent(name)}` : ''
  return request<UpsertTemplateResponse>({
    url: `/api/templates/from-training/${trainingId}${encodedName}`,
    method: 'POST',
    timeoutMs: 30000
  })
}
