import axios from 'axios'

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
  (error) => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    const errorData = error.response?.data
    let errorMessage = '网络错误，请稍后重试'
    if (errorData) {
      if (errorData.message) {
        errorMessage = typeof errorData.message === 'string'
          ? errorData.message
          : Object.values(errorData.message).flat().join('，')
      } else if (typeof errorData === 'object') {
        const messages = []
        Object.entries(errorData).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            messages.push(value.join('，'))
          } else if (typeof value === 'string') {
            messages.push(value)
          }
        })
        if (messages.length > 0) {
          errorMessage = messages.join('，')
        }
      } else if (errorData.error) {
        errorMessage = errorData.error
      }
    }
    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.includes('/auth/login/') || error.config?.url?.includes('/auth/register/')
      if (!isLoginRequest) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject({ message: errorMessage, data: errorData, status: error.response?.status })
  }
)

export default api
