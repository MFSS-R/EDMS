import { beforeEach, describe, expect, it, vi } from 'vitest'

const redirectToLoginOnce = vi.fn()
const axiosInstance = vi.fn()
const requestUse = vi.fn()
const responseUse = vi.fn()

vi.mock('./authRedirect', () => ({
  redirectToLoginOnce,
}))

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => {
      axiosInstance.interceptors = {
        request: { use: requestUse },
        response: { use: responseUse },
      }
      axiosInstance.post = vi.fn()
      return axiosInstance
    }),
  },
}))

async function loadApiInterceptors() {
  vi.resetModules()
  requestUse.mockClear()
  responseUse.mockClear()
  await import('./api')
  return {
    onRequest: requestUse.mock.calls[0][0],
    onResponseError: responseUse.mock.calls[0][1],
  }
}

describe('api auth refresh retry', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    redirectToLoginOnce.mockClear()
    axiosInstance.mockReset()
    axiosInstance.post = vi.fn()
  })

  it('refreshes the access token and retries one 401 request', async () => {
    const { onResponseError } = await loadApiInterceptors()
    localStorage.setItem('refresh_token', 'old-refresh')
    axiosInstance.post.mockResolvedValue({
      access: 'new-access',
      refresh: 'new-refresh',
    })
    axiosInstance.mockResolvedValue({ data: { ok: true } })
    const originalRequest = {
      url: '/projects/',
      headers: {},
    }

    const result = await onResponseError({
      config: originalRequest,
      response: { status: 401, data: { detail: 'expired' } },
    })

    expect(axiosInstance.post).toHaveBeenCalledWith(
      '/auth/token/refresh/',
      { refresh: 'old-refresh' },
      expect.objectContaining({ skipAuthRefresh: true, skipAuthRedirect: true }),
    )
    expect(localStorage.getItem('access_token')).toBe('new-access')
    expect(localStorage.getItem('refresh_token')).toBe('new-refresh')
    expect(originalRequest.headers.Authorization).toBe('Bearer new-access')
    expect(axiosInstance).toHaveBeenCalledWith(originalRequest)
    expect(result).toEqual({ data: { ok: true } })
    expect(redirectToLoginOnce).not.toHaveBeenCalled()
  })

  it('redirects to login when refresh fails', async () => {
    const { onResponseError } = await loadApiInterceptors()
    localStorage.setItem('refresh_token', 'old-refresh')
    axiosInstance.post.mockRejectedValue({ response: { status: 401 } })

    await expect(onResponseError({
      config: { url: '/projects/', headers: {} },
      response: { status: 401, data: { detail: 'expired' } },
    })).rejects.toMatchObject({ status: 401 })

    expect(redirectToLoginOnce).toHaveBeenCalledTimes(1)
  })
})
