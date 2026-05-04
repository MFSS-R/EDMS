import api from './api'

export const sampleApi = {
  // 实验相关API
  getExperimentList: (params) => api.get('/samples/experiments/', { params }),
  getExperimentDetail: (id) => api.get(`/samples/experiments/${id}/`),
  createExperiment: (data) => api.post('/samples/experiments/', data),
  updateExperiment: (id, data) => api.put(`/samples/experiments/${id}/`, data),
  deleteExperiment: (id) => api.delete(`/samples/experiments/${id}/`),
  
  // 样品类型相关API
  getTypeList: (params) => {
    console.log('sampleApi.getTypeList called with params:', params)
    return api.get('/samples/types/', { params })
  },
  createType: (data) => api.post('/samples/types/', data),
  updateType: (id, data) => api.put(`/samples/types/${id}/`, data),
  deleteType: (id) => api.delete(`/samples/types/${id}/`),
  
  // 样品相关API
  getList: (params) => api.get('/samples/', { params }),
  getDetail: (id) => api.get(`/samples/${id}/`),
  create: (data) => api.post('/samples/', data),
  update: (id, data) => api.put(`/samples/${id}/`, data),
  delete: (id) => api.delete(`/samples/${id}/`),
  batchCreate: (data) => api.post('/samples/batch_create/', data),
  batchDelete: (ids) => api.post('/samples/batch_delete/', { sample_ids: ids }),
  batchMark: (ids, mark) => api.post('/samples/batch_mark/', { sample_ids: ids, mark }),
  copyPreparationConditions: (sampleId, sourceId) => 
    api.get(`/samples/${sampleId}/copy_preparation_conditions/?source_sample_id=${sourceId}`),
  export: (params) => api.get('/samples/export/', { params, responseType: 'blob' }),
  downloadTemplate: () => api.get('/samples/download_template/', { responseType: 'blob' }),
  batchImport: (formData) => api.post('/samples/batch_import/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
}