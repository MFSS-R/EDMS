const STORAGE_KEY = 'edms.sampleNoteTemplate'

export const DEFAULT_SAMPLE_NOTE_TEMPLATE = [
  '制备说明：',
  '温度：',
  '时间：',
  '气氛：',
  '设备：',
  '其他：',
].join('\n')

export const getSampleNoteTemplate = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_SAMPLE_NOTE_TEMPLATE
  }

  const value = window.localStorage.getItem(STORAGE_KEY)
  return value?.trim() ? value : DEFAULT_SAMPLE_NOTE_TEMPLATE
}

export const setSampleNoteTemplate = (value) => {
  const normalized = value?.trim() ? value : DEFAULT_SAMPLE_NOTE_TEMPLATE

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, normalized)
  }

  return normalized
}

export const resetSampleNoteTemplate = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY)
  }

  return DEFAULT_SAMPLE_NOTE_TEMPLATE
}

export const appendSampleNoteTemplate = (currentText, template) => {
  const nextTemplate = template?.trim() ? template : DEFAULT_SAMPLE_NOTE_TEMPLATE
  const baseText = currentText?.trimEnd() || ''
  return baseText ? `${baseText}\n\n${nextTemplate}` : nextTemplate
}
