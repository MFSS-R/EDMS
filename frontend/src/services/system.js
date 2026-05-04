import api from './api'

export const systemApi = {
  getVersion: () => api.get('/system/version/'),
}
