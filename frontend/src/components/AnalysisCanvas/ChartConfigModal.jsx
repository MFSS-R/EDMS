import { useState, useEffect } from 'react'
import { Modal, Form, Input, Select, Radio, Checkbox, message } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { sampleApi } from '../../services/sample'
import { testApi } from '../../services/test'
import { analysisApi } from '../../services/analysis'
import { formatSampleLabel } from '../../utils/helpers'

export default function ChartConfigModal({ open, onCancel, onConfirm, defaultConfig }) {
  const [form] = Form.useForm()
  const [selectedSampleIds, setSelectedSampleIds] = useState([])

  const sampleIds = defaultConfig?.sampleIds || []
  const experimentId = defaultConfig?.experimentId
  const projectId = defaultConfig?.projectId

  const { data: samplesData } = useQuery({
    queryKey: ['samples', experimentId],
    queryFn: () => sampleApi.getList({ experiment: experimentId, page_size: 500 }),
    enabled: !!experimentId && open,
  })

  const { data: testTypesData } = useQuery({
    queryKey: ['testTypes', projectId],
    queryFn: () => testApi.getTypeList({ project: projectId, page_size: 100 }),
    enabled: !!projectId && open,
  })

  const samples = samplesData?.results || samplesData?.data?.results || []
  const testTypes = testTypesData?.results || testTypesData?.data?.results || []

  const [selectedTestTypeId, setSelectedTestTypeId] = useState(null)

  const handleTestTypeChange = (value) => {
    setSelectedTestTypeId(value)
  }

  const { data: algorithmsData } = useQuery({
    queryKey: ['algorithms', selectedTestTypeId],
    queryFn: () => analysisApi.getAlgorithmList({ test_type: selectedTestTypeId, page_size: 100 }),
    enabled: !!selectedTestTypeId && open,
  })

  const algorithms = algorithmsData?.results || algorithmsData?.data?.results || []

  useEffect(() => {
    if (open) {
      setSelectedSampleIds(sampleIds)
      form.setFieldsValue({
        title: defaultConfig?.title || '',
        testTypeId: defaultConfig?.testTypeId || null,
        algorithmId: null,
        chartType: 'line',
      })
    }
  }, [open, defaultConfig, form, sampleIds])

  const handleSampleToggle = (sampleId) => {
    setSelectedSampleIds((prev) =>
      prev.includes(sampleId)
        ? prev.filter((id) => id !== sampleId)
        : [...prev, sampleId]
    )
  }

  const handleOk = () => {
    const values = form.getFieldsValue()
    if (selectedSampleIds.length < 2) {
      message.warning('请至少选择 2 个样品')
      return
    }
    if (!values.testTypeId) {
      message.warning('请选择测试类型')
      return
    }

    onConfirm({
      title: values.title || defaultConfig?.title || '对比图表',
      config: {
        sampleIds: selectedSampleIds,
        testTypeId: values.testTypeId,
        algorithmId: values.algorithmId || null,
        chartType: values.chartType || 'line',
      },
    })
    form.resetFields()
  }

  return (
    <Modal
      title="创建对比图表"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText="创建"
      cancelText="取消"
      width={560}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="图表标题" name="title">
          <Input placeholder="输入图表标题" />
        </Form.Item>

        <Form.Item label="已选样品">
          <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #d9d9d9', borderRadius: 6, padding: 8 }}>
            {samples
              .filter((s) => sampleIds.includes(s.sample_id))
              .map((s) => (
                <div key={s.sample_id} style={{ padding: '4px 0' }}>
                  <Checkbox
                    checked={selectedSampleIds.includes(s.sample_id)}
                    onChange={() => handleSampleToggle(s.sample_id)}
                  >
                    {formatSampleLabel(s)}
                  </Checkbox>
                </div>
              ))}
          </div>
          {selectedSampleIds.length > 0 && (
            <div style={{ marginTop: 4, color: '#666', fontSize: 12 }}>
              已选 {selectedSampleIds.length} 个样品
            </div>
          )}
        </Form.Item>

        <Form.Item label="测试类型" name="testTypeId" rules={[{ required: true, message: '请选择测试类型' }]}>
          <Select placeholder="选择测试类型" onChange={handleTestTypeChange}>
            {testTypes.map((t) => (
              <Select.Option key={t.id} value={t.id}>
                {t.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item label="算法（可选）" name="algorithmId">
          <Select placeholder="默认算法" allowClear>
            {algorithms.map((a) => (
              <Select.Option key={a.id} value={a.id}>
                {a.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item label="图表类型" name="chartType" initialValue="line">
          <Radio.Group>
            <Radio value="line">折线图</Radio>
            <Radio value="bar">柱状图</Radio>
            <Radio value="scatter">散点图</Radio>
          </Radio.Group>
        </Form.Item>
      </Form>
    </Modal>
  )
}
