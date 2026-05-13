import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './api'
import { agentImportApi, normalizeImportList, unwrapApiData } from './agentImport'

vi.mock('./api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('agentImportApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists jobs through the import-jobs endpoint and normalizes empty backend failures', async () => {
    api.get.mockRejectedValueOnce({ status: 404, message: 'not found' })

    const result = await agentImportApi.list({ status: 'failed' })

    expect(api.get).toHaveBeenCalledWith('/agent/import-jobs/', { params: { status: 'failed' } })
    expect(result).toEqual({ results: [], count: 0, backendUnavailable: true, message: 'not found' })
  })

  it('maps job lifecycle calls to stable backend actions', async () => {
    api.get.mockResolvedValue({ code: 200, data: { id: 7 } })
    api.post.mockResolvedValue({ code: 200, data: { id: 7 } })

    await expect(agentImportApi.get(7)).resolves.toEqual({ id: 7 })
    await expect(agentImportApi.create({ source: 'hermes' })).resolves.toEqual({ id: 7 })
    await expect(agentImportApi.uploadFiles(7, new FormData())).resolves.toEqual({ id: 7 })
    await expect(agentImportApi.parse(7)).resolves.toEqual({ id: 7 })
    await expect(agentImportApi.getPreview(7)).resolves.toEqual({ id: 7 })
    await expect(agentImportApi.confirm(7)).resolves.toEqual({ id: 7 })
    await expect(agentImportApi.retry(7)).resolves.toEqual({ id: 7 })

    expect(api.get).toHaveBeenCalledWith('/agent/import-jobs/7/')
    expect(api.post).toHaveBeenNthCalledWith(1, '/agent/import-jobs/', { source: 'hermes' })
    expect(api.post).toHaveBeenNthCalledWith(2, '/agent/import-jobs/7/files/', expect.any(FormData), {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    expect(api.post).toHaveBeenNthCalledWith(3, '/agent/import-jobs/7/parse/')
    expect(api.get).toHaveBeenCalledWith('/agent/import-jobs/7/preview/')
    expect(api.post).toHaveBeenNthCalledWith(4, '/agent/import-jobs/7/confirm/')
    expect(api.post).toHaveBeenNthCalledWith(5, '/agent/import-jobs/7/retry/')
  })

  it('passes an item_id body when retrying a single import item', async () => {
    api.post.mockResolvedValue({ code: 200, data: { id: 7 } })

    await expect(agentImportApi.retry(7, { item_id: 42 })).resolves.toEqual({ id: 7 })

    expect(api.post).toHaveBeenCalledWith('/agent/import-jobs/7/retry/', { item_id: 42 })
  })

  it('normalizes common list response shapes', () => {
    expect(normalizeImportList({ results: [{ id: 1 }], count: 1 })).toEqual({
      results: [{ id: 1 }],
      count: 1,
    })
    expect(normalizeImportList({ code: 200, data: { results: [{ id: 3 }], count: 1 } })).toEqual({
      results: [{ id: 3 }],
      count: 1,
    })
    expect(normalizeImportList([{ id: 2 }])).toEqual({ results: [{ id: 2 }], count: 1 })
    expect(normalizeImportList(null)).toEqual({ results: [], count: 0 })
  })

  it('unwraps the project API response envelope', () => {
    expect(unwrapApiData({ code: 200, data: { id: 4 }, message: 'success' })).toEqual({ id: 4 })
    expect(unwrapApiData({ id: 5 })).toEqual({ id: 5 })
  })
})
