import api from './api'

export const authApi = {
  login: (data) => api.post('/auth/login/', data),
  register: (data) => api.post('/auth/register/', data),
  logout: (data) => api.post('/auth/logout/', data),
  getProfile: () => api.get('/auth/profile/'),
  updateProfile: (data) => api.put('/auth/profile/', data),
  changePassword: (data) => api.post('/auth/password/change/', data),
  refreshToken: (refresh) => api.post('/auth/token/refresh/', { refresh }),

  getAdminUserList: (params) => api.get('/auth/admin/users/', { params }),
  createAdminUser: (data) => api.post('/auth/admin/users/', data),
  getAdminUserDetail: (id) => api.get(`/auth/admin/users/${id}/`),
  updateAdminUser: (id, data) => api.put(`/auth/admin/users/${id}/`, data),
  deleteAdminUser: (id) => api.delete(`/auth/admin/users/${id}/`),
  resetAdminUserPassword: (id, data) => api.post(`/auth/admin/users/${id}/reset-password/`, data),
  toggleAdminUserActive: (id) => api.post(`/auth/admin/users/${id}/toggle-active/`),
}
