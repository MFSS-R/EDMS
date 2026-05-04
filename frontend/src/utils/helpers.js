import dayjs from 'dayjs'

export const formatDate = (date, format = 'YYYY-MM-DD') => {
  if (!date) return ''
  return dayjs(date).format(format)
}

export const formatDateTime = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  if (!date) return ''
  return dayjs(date).format(format)
}

export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export const getStatusTag = (status) => {
  const statusMap = {
    in_progress: { color: 'processing', text: '进行中' },
    completed: { color: 'success', text: '已完成' },
    archived: { color: 'default', text: '已归档' },
  }
  return statusMap[status] || { color: 'default', text: status }
}

export const formatSampleLabel = (sample) => {
  if (!sample) return ''
  return sample.full_label || [sample.display_code, sample.name, sample.sample_id].filter(Boolean).join(' · ')
}

export const formatSamplePrimary = (sample) => {
  if (!sample) return ''
  return sample.primary_label || sample.display_code || sample.name || sample.sample_id || ''
}

export const formatSampleSecondary = (sample) => {
  if (!sample) return ''
  return sample.secondary_label || (sample.display_code && sample.name ? sample.name : sample.sample_id) || ''
}
