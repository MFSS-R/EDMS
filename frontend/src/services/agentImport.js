import api from './api'

const BASE_URL = '/agent/import-jobs/'

export function unwrapApiData(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data
  }
  return response
}

export function normalizeImportList(response) {
  const payload = unwrapApiData(response)

  if (Array.isArray(payload)) {
    return { results: payload, count: payload.length }
  }

  const results = payload?.results || payload?.data?.results || payload?.data || []
  const count = payload?.count ?? payload?.data?.count ?? results.length
  return { results: Array.isArray(results) ? results : [], count }
}

function normalizeBackendUnavailable(error) {
  if (error?.status === 404 || error?.status === 501 || error?.status === 503) {
    return {
      results: [],
      count: 0,
      backendUnavailable: true,
      message: error.message || 'Hermes agent import backend is unavailable',
    }
  }
  throw error
}

export const agentImportApi = {
  list: async (params) => {
    try {
      return normalizeImportList(await api.get(BASE_URL, { params }))
    } catch (error) {
      return normalizeBackendUnavailable(error)
    }
  },
  get: async (id) => unwrapApiData(await api.get(`${BASE_URL}${id}/`)),
  create: async (data) => unwrapApiData(await api.post(BASE_URL, data)),
  uploadFiles: async (id, formData) => unwrapApiData(await api.post(`${BASE_URL}${id}/files/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })),
  parse: async (id) => unwrapApiData(await api.post(`${BASE_URL}${id}/parse/`)),
  getPreview: async (id) => unwrapApiData(await api.get(`${BASE_URL}${id}/preview/`)),
  confirm: async (id) => unwrapApiData(await api.post(`${BASE_URL}${id}/confirm/`)),
  retry: async (id, data) => unwrapApiData(
    data ? await api.post(`${BASE_URL}${id}/retry/`, data) : await api.post(`${BASE_URL}${id}/retry/`)
  ),
}
