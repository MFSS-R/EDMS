import api from './api'

export const testApi = {
  getTypeList: (params) => api.get('/tests/types/', { params }),
  createType: (data) => api.post('/tests/types/', data),
  updateType: (id, data) => api.put(`/tests/types/${id}/`, data),
  deleteType: (id) => api.delete(`/tests/types/${id}/`),
  
  getDataList: (params) => api.get('/tests/data/', { params }),
  getDataDetail: (id) => api.get(`/tests/data/${id}/`),
  createData: (data) => api.post('/tests/data/', data, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }),
  updateData: (id, data) => api.put(`/tests/data/${id}/`, data),
  deleteData: (id) => api.delete(`/tests/data/${id}/`),
  downloadTestData: (id) => api.get(`/tests/data/${id}/download/`, { responseType: 'blob' }),
  uploadFiles: (testDataId, files) => {
    const formData = new FormData()
    formData.append('test_data_id', testDataId)
    files.forEach(file => formData.append('files', file))
    return api.post('/tests/data/upload_files/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  
  getFileList: (params) => api.get('/tests/files/', { params }),
  deleteFile: (id) => api.delete(`/tests/files/${id}/`),
  downloadFile: (id) => api.get(`/tests/files/${id}/download/`, { responseType: 'blob' }),
  
  generateDataPackage: (data) => api.post('/tests/data/generate_package/', data, { responseType: 'blob' }),
  uploadDataPackage: (formData, options) => api.post('/tests/data/upload_package/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...options
  }),
  batchUploadData: (formData, options) => api.post('/tests/data/batch_upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...options
  }),
}
