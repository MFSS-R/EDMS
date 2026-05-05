import axios from 'axios'
import api from './api'
import { redirectToLoginOnce } from './authRedirect'

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
})

axiosInstance.interceptors.request.use(
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

axiosInstance.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      redirectToLoginOnce()
    }
    return Promise.reject(error.response?.data || error)
  }
)

export const analysisApi = {
  getAlgorithms: (params) => api.get('/analysis/algorithms/', { params }),
  getAlgorithmList: (params) => api.get('/analysis/algorithms/', { params }),
  getAlgorithmDetail: (id) => api.get(`/analysis/algorithms/${id}/`),
  validateAlgorithmScript: (data) => api.post('/analysis/algorithms/validate_script/', data),
  createAlgorithm: (data) => api.post('/analysis/algorithms/', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  updateAlgorithm: (id, data) => api.put(`/analysis/algorithms/${id}/`, data),
  deleteAlgorithm: (id) => api.delete(`/analysis/algorithms/${id}/`),
  testRunAlgorithm: (id, formData) => {
    return axiosInstance.post(`/analysis/algorithms/${id}/test_run/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  getPlotDataList: (params) => api.get('/analysis/plot-data/', { params }),
  getPlotData: (id) => api.get(`/analysis/plot-data/${id}/`),
  getPlotDataByTestData: (testDataId) => api.get('/analysis/plot-data/by_test_data/', { params: { test_data_id: testDataId } }),
  processPlotData: (data) => api.post('/analysis/plot-data/process/', data),
  deletePlotData: (id) => api.delete(`/analysis/plot-data/${id}/`),

  comparePlotData: (data) => api.post('/analysis/plot-data/compare/', data),

  getCanvasLayouts: () => api.get('/analysis/canvas-layouts/'),
  getCanvasLayout: (id) => api.get(`/analysis/canvas-layouts/${id}/`),
  saveCanvasLayout: (data) => api.post('/analysis/canvas-layouts/', data),
  updateCanvasLayout: (id, data) => api.put(`/analysis/canvas-layouts/${id}/`, data),
  deleteCanvasLayout: (id) => api.delete(`/analysis/canvas-layouts/${id}/`),
}
