import api from './api'

export const projectApi = {
  getList: (params) => api.get('/projects/', { params }),
  getDetail: (id) => api.get(`/projects/${id}/`),
  create: (data) => api.post('/projects/', data),
  update: (id, data) => api.put(`/projects/${id}/`, data),
  delete: (id) => api.delete(`/projects/${id}/`),
  batchDelete: (ids) => api.post('/projects/batch_delete/', { ids }),
  getStatistics: () => api.get('/projects/statistics/'),
}
