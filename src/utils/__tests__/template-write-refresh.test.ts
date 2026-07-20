// @ts-ignore -- Vitest runs in Node; production tsconfig omits Node types.
import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const templateApiMocks = vi.hoisted(() => ({
  copyTemplate: vi.fn(),
  createTemplate: vi.fn(),
  createTemplateFromTraining: vi.fn(),
  deleteTemplate: vi.fn(),
  fetchTemplateDetail: vi.fn(),
  fetchTemplateList: vi.fn(),
  updateTemplate: vi.fn()
}))

const exerciseApiMocks = vi.hoisted(() => ({
  fetchExerciseList: vi.fn()
}))

vi.mock('@/api/template', () => templateApiMocks)
vi.mock('@/api/exercise', () => exerciseApiMocks)

import { useTemplateStore } from '@/stores/template'
import type { TemplateDetailResponse, UpsertTemplateRequest } from '@/api/template'

const rootUrl = new URL('../../../', import.meta.url)
const readSource = (path: string) => readFileSync(new URL(path, rootUrl), 'utf8')

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const payload: UpsertTemplateRequest = {
  name: '写穿模板',
  items: [{ exerciseId: 10, targetSets: 3 }]
}

const detail = (id: number, name = `模板 ${id}`): TemplateDetailResponse => ({
  id,
  name,
  templateType: 'USER',
  items: [
    {
      exerciseId: id * 10,
      exerciseName: `动作 ${id}`,
      sortOrder: 0,
      targetSets: 3,
      recordType: 'WEIGHT_REPS'
    }
  ]
})

const listItem = (id: number, name = `旧模板 ${id}`) => ({
  id,
  name,
  templateType: 'USER',
  exerciseCount: 1
})

describe('template write-through contract', () => {
  it('updates the Store immediately and keeps rename readable', () => {
    expect(readSource('src/api/template.ts')).not.toContain('interface UpsertTemplateResponse')
    expect(readSource('src/stores/template.ts')).toContain('async function save(')
    expect(readSource('src/pages/home/template-edit.vue')).toContain('templateStore.save(')
    expect(readSource('src/pages/home/template-edit.vue')).not.toContain(
      'await templateStore.fetchTemplates()'
    )
    expect(readSource('src/pages/profile/template-manager.vue')).toContain('maxlength="30"')
    expect(readSource('src/pages/profile/template-manager.vue')).toContain('color: var(--app-text)')
  })
})

describe('template Store write-through behavior', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(templateApiMocks).forEach((mock) => mock.mockReset())
    Object.values(exerciseApiMocks).forEach((mock) => mock.mockReset())
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => []),
      setStorageSync: vi.fn()
    })
    templateApiMocks.fetchTemplateList.mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes create, update, copy, and from-training details into list and cache', async () => {
    const created = detail(1, '新建')
    const updated = detail(2, '更新')
    const copied = detail(3, '复制')
    const fromTraining = detail(4, '训练记录')
    templateApiMocks.createTemplate.mockResolvedValue(created)
    templateApiMocks.updateTemplate.mockResolvedValue(updated)
    templateApiMocks.copyTemplate.mockResolvedValue(copied)
    templateApiMocks.createTemplateFromTraining.mockResolvedValue(fromTraining)
    const store = useTemplateStore()

    await store.save(payload)
    await store.save(payload, 2)
    await store.duplicate(20)
    await store.saveFromTraining(30, '训练记录')

    expect(store.items.map((item) => item.id)).toEqual([4, 3, 2, 1])
    expect(store.loadedFromServer).toBe(true)
    await expect(store.getDetail(1)).resolves.toEqual(created)
    await expect(store.getDetail(2)).resolves.toEqual(updated)
    await expect(store.getDetail(3)).resolves.toEqual(copied)
    await expect(store.getDetail(4)).resolves.toEqual(fromTraining)
    expect(templateApiMocks.fetchTemplateDetail).not.toHaveBeenCalled()

    await store.fetchTemplates({ includeDetails: false })
    expect(templateApiMocks.fetchTemplateList).not.toHaveBeenCalled()
  })

  it('does not pollute local state when a write fails', async () => {
    templateApiMocks.createTemplate.mockRejectedValue(new Error('write failed'))
    const store = useTemplateStore()

    await expect(store.save(payload)).rejects.toThrow('write failed')

    expect(store.items).toEqual([])
    expect(store.loadedFromServer).toBe(false)
    expect(templateApiMocks.fetchTemplateDetail).not.toHaveBeenCalled()
  })

  it('clears a previous list error when a later write succeeds', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    templateApiMocks.fetchTemplateList.mockRejectedValueOnce(new Error('list failed'))
    const saved = detail(10, '错误后保存')
    templateApiMocks.createTemplate.mockResolvedValue(saved)
    const store = useTemplateStore()

    await store.fetchTemplates({ includeDetails: false, force: true })
    expect(store.listError).toBe('模板加载失败，请稍后重试')

    await store.save(payload)

    expect(store.listError).toBe('')
    expect(store.items.map((item) => item.id)).toEqual([10])
    await expect(store.getDetail(10)).resolves.toEqual(saved)
  })

  it('does not let an older list response overwrite a completed write', async () => {
    const staleList = deferred<ReturnType<typeof listItem>[]>()
    templateApiMocks.fetchTemplateList.mockReturnValueOnce(staleList.promise)
    templateApiMocks.createTemplate.mockResolvedValue(detail(5, '刚保存'))
    const store = useTemplateStore()

    const olderRead = store.fetchTemplates({ includeDetails: false, force: true })
    await vi.waitFor(() => expect(templateApiMocks.fetchTemplateList).toHaveBeenCalledTimes(1))
    await store.save(payload)
    staleList.resolve([listItem(99)])
    await olderRead

    expect(store.items.map((item) => [item.id, item.name])).toEqual([[5, '刚保存']])
    await expect(store.getDetail(5)).resolves.toEqual(detail(5, '刚保存'))
  })

  it('keeps a newer list request as owner when an invalidated read finishes first', async () => {
    let now = 1_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const olderList = deferred<ReturnType<typeof listItem>[]>()
    const newerList = deferred<ReturnType<typeof listItem>[]>()
    templateApiMocks.fetchTemplateList
      .mockReturnValueOnce(olderList.promise)
      .mockReturnValueOnce(newerList.promise)
    templateApiMocks.createTemplate.mockResolvedValue(detail(11, '写穿结果'))
    const store = useTemplateStore()

    const olderRead = store.fetchTemplates({ includeDetails: false, force: true })
    await vi.waitFor(() => expect(templateApiMocks.fetchTemplateList).toHaveBeenCalledTimes(1))
    await store.save(payload)
    const newerRead = store.fetchTemplates({ includeDetails: false, force: true })
    await vi.waitFor(() => expect(templateApiMocks.fetchTemplateList).toHaveBeenCalledTimes(2))
    expect(store.loading).toBe(true)

    olderList.resolve([listItem(90, '失效 A')])
    await olderRead
    expect(store.loading).toBe(true)

    now = 32_000
    const joinedNewerRead = store.fetchTemplates({ includeDetails: false })
    await Promise.resolve()
    expect(templateApiMocks.fetchTemplateList).toHaveBeenCalledTimes(2)

    newerList.resolve([listItem(91, '有效 B')])
    await Promise.all([newerRead, joinedNewerRead])

    expect(store.loading).toBe(false)
    expect(store.items.map((item) => [item.id, item.name])).toEqual([[91, '有效 B']])
  })

  it('ignores a write response that arrives after session invalidation', async () => {
    const pendingWrite = deferred<TemplateDetailResponse>()
    templateApiMocks.createTemplate.mockReturnValueOnce(pendingWrite.promise)
    const store = useTemplateStore()

    const save = store.save(payload)
    store.invalidateSession()
    pendingWrite.resolve(detail(6, '旧会话'))
    await save

    expect(store.items).toEqual([])
    expect(store.loadedFromServer).toBe(false)
  })

  it('keeps every completed write from the same session', async () => {
    const firstWrite = deferred<TemplateDetailResponse>()
    const secondWrite = deferred<TemplateDetailResponse>()
    templateApiMocks.createTemplate
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise)
    const store = useTemplateStore()

    const firstSave = store.save(payload)
    const secondSave = store.save(payload)
    secondWrite.resolve(detail(8, '后发先到'))
    await secondSave
    firstWrite.resolve(detail(7, '先发后到'))
    await firstSave

    expect(new Set(store.items.map((item) => item.id))).toEqual(new Set([7, 8]))
    await expect(store.getDetail(7)).resolves.toEqual(detail(7, '先发后到'))
    await expect(store.getDetail(8)).resolves.toEqual(detail(8, '后发先到'))
  })

  it('creates the default template from the write response without template GETs', async () => {
    const saved = detail(9, '默认模板')
    exerciseApiMocks.fetchExerciseList.mockResolvedValue({
      total: 1,
      pageNo: 1,
      pageSize: 3,
      list: [
        {
          id: 10,
          name: '深蹲',
          categoryCode: 'LEGS',
          categoryName: '腿部',
          recordType: 'WEIGHT_REPS'
        }
      ]
    })
    templateApiMocks.createTemplate.mockResolvedValue(saved)
    const store = useTemplateStore()

    await expect(store.createDefaultTemplate()).resolves.toEqual(saved)

    expect(store.items.map((item) => item.id)).toEqual([9])
    expect(templateApiMocks.fetchTemplateList).not.toHaveBeenCalled()
    expect(templateApiMocks.fetchTemplateDetail).not.toHaveBeenCalled()
  })
})
