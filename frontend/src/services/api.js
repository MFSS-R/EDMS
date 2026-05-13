import axios from 'axios'
import { redirectToLoginOnce } from './authRedirect'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

async function refreshAccessToken() {
  const refresh = localStorage.getItem('refresh_token')
  if (!refresh) {
    return null
  }

  const response = await api.post('/auth/token/refresh/', { refresh }, {
    skipAuthRefresh: true,
    skipAuthRedirect: true,
  })
  const data = response.data || response
  if (!data?.access) {
    return null
  }

  localStorage.setItem('access_token', data.access)
  if (data.refresh) {
    localStorage.setItem('refresh_token', data.refresh)
  }
  return data
}

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      const originalRequest = error.config || {}
      const isAuthRequest = originalRequest.url?.includes('/auth/login/')
        || originalRequest.url?.includes('/auth/register/')
        || originalRequest.url?.includes('/auth/token/refresh/')
      const skipAuthRefresh = originalRequest.skipAuthRefresh

      if (!isAuthRequest && !skipAuthRefresh && !originalRequest._retry) {
        originalRequest._retry = true
        try {
          const token = await refreshAccessToken()
          if (token?.access) {
            originalRequest.headers = originalRequest.headers || {}
            originalRequest.headers.Authorization = `Bearer ${token.access}`
            return api(originalRequest)
          }
        } catch {
          // Fall through to redirect and normalized error handling.
        }
      }
    }

    const errorData = error.response?.data
    let errorMessage = '网络错误，请稍后重试'

    if (errorData) {
      if (errorData.message) {
        errorMessage = typeof errorData.message === 'string'
          ? errorData.message
          : Object.values(errorData.message).flat().join('；')
      } else if (typeof errorData === 'object') {
        const messages = []
        Object.entries(errorData).forEach(([, value]) => {
          if (Array.isArray(value)) {
            messages.push(value.join('；'))
          } else if (typeof value === 'string') {
            messages.push(value)
          }
        })
        if (messages.length > 0) {
          errorMessage = messages.join('；')
        }
      } else if (errorData.error) {
        errorMessage = errorData.error
      }
    }

    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.includes('/auth/login/')
        || error.config?.url?.includes('/auth/register/')
      const skipAuthRedirect = error.config?.skipAuthRedirect
      if (!isLoginRequest && !skipAuthRedirect) {
        redirectToLoginOnce()
      }
    }

    return Promise.reject({
      message: errorMessage,
      data: errorData,
      status: error.response?.status,
    })
  }
)

export default api
