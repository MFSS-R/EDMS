import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, DatePicker, Divider, Form, Input, Select, Space, Upload, message } from 'antd'
import { InboxOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { sampleApi } from '../services/sample'
import { testApi } from '../services/test'
import { formatSampleLabel } from '../utils/helpers'

const { TextArea } = Input
const { Dragger } = Upload

export default function AddTestData() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [selectedProject, setSelectedProject] = useState(null)
  const [fileList, setFileList] = useState([])
  const [newTestTypeName, setNewTestTypeName] = useState('')

  const { data: samplesData } = useQuery({
    queryKey: ['samplesForTestData'],
    queryFn: () => sampleApi.getList({ page_size: 500 }),
  })

  const samplesResponse = samplesData?.data || samplesData
  const samples = Array.isArray(samplesResponse?.results) ? samplesResponse.results : []

  const selectedSampleId = Form.useWatch('sample', form)

  const { data: testTypesData, isLoading: testTypesLoading } = useQuery({
    queryKey: ['testTypesForProject', selectedProject],
    queryFn: () => testApi.getTypeList({ project: selectedProject, page_size: 100 }),
    enabled: !!selectedProject,
  })

  const testTypesResponse = testTypesData?.data || testTypesData
  const testTypes = Array.isArray(testTypesResponse?.results) ? testTypesResponse.results : []

  useEffect(() => {
    const sampleId = searchParams.get('sample')
    if (!sampleId || samples.length === 0) return
    const matchedSample = samples.find((sample) => sample.sample_id === sampleId)
    if (!matchedSample) return
    form.setFieldsValue({ sample: sampleId })
    setSelectedProject(matchedSample.project_id)
  }, [form, searchParams, samples])

  useEffect(() => {
    if (!selectedSampleId) return
    const matchedSample = samples.find((sample) => sample.sample_id === selectedSampleId)
    setSelectedProject(matchedSample?.project_id || null)
  }, [samples, selectedSampleId])

  const createMutation = useMutation({
    mutationFn: (payload) => testApi.createData(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testData'] })
      message.success('测试数据上传成功')
      navigate(-1)
    },
    onError: (error) => {
      message.error(error.message || '上传失败')
    },
  })

  const handleCreateTestType = async () => {
    if (!newTestTypeName.trim()) {
      message.warning('请输入测试类型名称')
      return
    }
    try {
      const response = await testApi.createType({
        project: selectedProject,
        name: newTestTypeName.trim(),
      })
      queryClient.invalidateQueries({ queryKey: ['testTypesForProject', selectedProject] })
      form.setFieldsValue({ test_type: response.data?.id || response.id })
      setNewTestTypeName('')
      message.success('测试类型创建成功')
    } catch (error) {
      message.error(error.message || '创建失败')
    }
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    const formData = new FormData()
    formData.append('sample', values.sample)
    formData.append('test_type', values.test_type)
    formData.append('test_date', values.test_date ? dayjs(values.test_date).format('YYYY-MM-DD') : '')
    formData.append('instrument', values.instrument || '')
    formData.append('tester', values.tester || '')
    formData.append('notes', values.notes || '')
    fileList.forEach((file) => {
      formData.append('files', file.originFileObj || file)
    })
    createMutation.mutate(formData)
  }

  return (
    <div className="add-test-data-page">
      <div className="page-header">
        <h2>上传测试数据</h2>
      </div>

      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Divider orientation="left">基本信息</Divider>

          <Form.Item name="sample" label="所属样品" rules={[{ required: true, message: '请选择样品' }]}>
            <Select
              showSearch
              placeholder="选择样品"
              optionFilterProp="label"
              disabled={!!searchParams.get('sample')}
              options={samples.map((sample) => ({
                value: sample.sample_id,
                label: formatSampleLabel(sample),
              }))}
            />
          </Form.Item>

          <Form.Item name="test_type" label="测试类型" rules={[{ required: true, message: '请选择测试类型' }]}>
            <Select
              placeholder={selectedProject ? '选择测试类型' : '请先选择样品'}
              loading={testTypesLoading}
              disabled={!selectedProject}
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <Divider style={{ margin: '8px 0' }} />
                  <Space style={{ padding: '0 8px 8px', width: '100%' }}>
                    <Input
                      placeholder="新测试类型名称"
                      value={newTestTypeName}
                      onChange={(event) => setNewTestTypeName(event.target.value)}
                    />
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateTestType}>
                      创建
                    </Button>
                  </Space>
                </>
              )}
              options={testTypes.map((item) => ({ value: item.id, label: item.name }))}
            />
          </Form.Item>

          <Space style={{ width: '100%' }} size={16} wrap>
            <Form.Item name="test_date" label="测试日期" style={{ minWidth: 220, flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="instrument" label="测试仪器" style={{ minWidth: 220, flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="tester" label="测试人员" style={{ minWidth: 220, flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>

          <Divider orientation="left">文件上传</Divider>

          <Form.Item>
            <Dragger
              multiple
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: nextFileList }) => setFileList(nextFileList)}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到这里上传</p>
              <p className="ant-upload-hint">支持一次上传多个原始测试文件</p>
            </Dragger>
          </Form.Item>

          <Divider orientation="left">备注</Divider>

          <Form.Item name="notes">
            <TextArea rows={4} placeholder="补充说明，可选" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                上传
              </Button>
              <Button onClick={() => navigate(-1)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
