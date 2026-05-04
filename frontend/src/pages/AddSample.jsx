import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  message,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { projectApi } from '../services/project'
import { sampleApi } from '../services/sample'
import {
  appendSampleNoteTemplate,
  getSampleNoteTemplate,
  resetSampleNoteTemplate,
  setSampleNoteTemplate,
} from '../utils/sampleNoteTemplate'

const { Option } = Select
const { TextArea } = Input

export default function AddSample() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [sampleTypeForm] = Form.useForm()
  const [experimentForm] = Form.useForm()
  const [selectedProject, setSelectedProject] = useState(null)
  const [sampleTypeModalVisible, setSampleTypeModalVisible] = useState(false)
  const [experimentModalVisible, setExperimentModalVisible] = useState(false)
  const [templateModalVisible, setTemplateModalVisible] = useState(false)
  const [noteTemplate, setNoteTemplateState] = useState(() => getSampleNoteTemplate())
  const [templateDraft, setTemplateDraft] = useState(() => getSampleNoteTemplate())

  useEffect(() => {
    const projectId = searchParams.get('project')
    if (!projectId) return

    const numericProjectId = Number.parseInt(projectId, 10)
    setSelectedProject(numericProjectId)
    form.setFieldsValue({ project: numericProjectId })
  }, [form, searchParams])

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.getList({ page_size: 100 }),
  })

  const { data: experimentsData, isLoading: experimentsLoading } = useQuery({
    queryKey: ['experiments', selectedProject],
    queryFn: () => sampleApi.getExperimentList({ project: selectedProject, page_size: 200 }),
    enabled: !!selectedProject,
  })

  const { data: sampleTypesData, isLoading: sampleTypesLoading } = useQuery({
    queryKey: ['sampleTypes', selectedProject],
    queryFn: () => sampleApi.getTypeList({ project: selectedProject, page_size: 200 }),
    enabled: !!selectedProject,
  })

  const projectsResponse = projectsData?.data || projectsData
  const experimentsResponse = experimentsData?.data || experimentsData
  const sampleTypesResponse = sampleTypesData?.data || sampleTypesData
  const projects = projectsResponse?.results || []
  const experiments = experimentsResponse?.results || []
  const sampleTypes = sampleTypesResponse?.results || []

  const createMutation = useMutation({
    mutationFn: sampleApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] })
      queryClient.invalidateQueries({ queryKey: ['experiments'] })
      message.success('样品创建成功')
      navigate(-1)
    },
    onError: (error) => {
      message.error(error.message || '创建失败')
    },
  })

  const createSampleTypeMutation = useMutation({
    mutationFn: sampleApi.createType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sampleTypes', selectedProject] })
      message.success('样品类型创建成功')
      setSampleTypeModalVisible(false)
      sampleTypeForm.resetFields()
    },
    onError: (error) => {
      message.error(error.message || '创建失败')
    },
  })

  const createExperimentMutation = useMutation({
    mutationFn: sampleApi.createExperiment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments', selectedProject] })
      message.success('实验创建成功')
      setExperimentModalVisible(false)
      experimentForm.resetFields()
    },
    onError: (error) => {
      message.error(error.message || '创建失败')
    },
  })

  const handleSubmit = async () => {
    const values = await form.validateFields()

    createMutation.mutate({
      experiment: values.experiment,
      sample_type: values.sample_type,
      display_code: values.display_code || '',
      name: values.name || '',
      synthesis_date: values.synthesis_date ? dayjs(values.synthesis_date).format('YYYY-MM-DD') : null,
      batch_number: values.batch_number || '',
      mark: values.mark || '',
      notes: values.notes || '',
      preparation_conditions: {},
    })
  }

  const insertTemplate = () => {
    const currentNotes = form.getFieldValue('notes') || ''
    form.setFieldValue('notes', appendSampleNoteTemplate(currentNotes, noteTemplate))
  }

  const openTemplateEditor = () => {
    const latestTemplate = getSampleNoteTemplate()
    setNoteTemplateState(latestTemplate)
    setTemplateDraft(latestTemplate)
    setTemplateModalVisible(true)
  }

  const handleSaveTemplate = () => {
    const savedTemplate = setSampleNoteTemplate(templateDraft)
    setNoteTemplateState(savedTemplate)
    setTemplateDraft(savedTemplate)
    setTemplateModalVisible(false)
    message.success('说明模板已保存')
  }

  const handleResetTemplate = () => {
    const defaultTemplate = resetSampleNoteTemplate()
    setNoteTemplateState(defaultTemplate)
    setTemplateDraft(defaultTemplate)
    message.success('已恢复默认模板')
  }

  return (
    <div className="add-sample-page">
      <div className="page-header">
        <h2>添加样品</h2>
      </div>

      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Divider orientation="left">基本信息</Divider>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="project" label="所属项目" rules={[{ required: true, message: '请选择项目' }]}>
                <Select
                  placeholder="请选择项目"
                  onChange={(value) => {
                    setSelectedProject(value)
                    form.setFieldsValue({ experiment: undefined, sample_type: undefined })
                  }}
                  disabled={!!searchParams.get('project')}
                >
                  {projects.map((project) => (
                    <Option key={project.id} value={project.id}>
                      {project.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item name="experiment" label="所属实验" rules={[{ required: true, message: '请选择实验' }]}>
                <Select
                  placeholder={selectedProject ? '请选择实验' : '请先选择项目'}
                  loading={experimentsLoading}
                  disabled={!selectedProject}
                >
                  {experiments.map((experiment) => (
                    <Option key={experiment.id} value={experiment.id}>
                      {experiment.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              {selectedProject && (
                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  onClick={() => setExperimentModalVisible(true)}
                  style={{ position: 'absolute', right: 0, top: 0 }}
                >
                  新建
                </Button>
              )}
            </Col>

            <Col span={8}>
              <Form.Item name="sample_type" label="样品类型" rules={[{ required: true, message: '请选择样品类型' }]}>
                <Select
                  placeholder={selectedProject ? '请选择样品类型' : '请先选择项目'}
                  loading={sampleTypesLoading}
                  disabled={!selectedProject}
                >
                  {sampleTypes.map((sampleType) => (
                    <Option key={sampleType.id} value={sampleType.id}>
                      {sampleType.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              {selectedProject && (
                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  onClick={() => setSampleTypeModalVisible(true)}
                  style={{ position: 'absolute', right: 0, top: 0 }}
                >
                  新建
                </Button>
              )}
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="display_code" label="显示代号">
                <Input placeholder="例如 A2 / Ring-03 / S1" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="name" label="样品名称">
                <Input placeholder="便于识别的名称" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="synthesis_date" label="制备日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="batch_number" label="批次号">
                <Input placeholder="批次号" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="mark" label="标记">
                <Input placeholder="标记" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">说明与备注</Divider>

          <Form.Item extra="建议直接把制备条件写在这里。模板支持自定义，会保存在当前浏览器中。">
            <Space wrap>
              <Button onClick={insertTemplate}>插入模板</Button>
              <Button onClick={openTemplateEditor}>编辑模板</Button>
              <Button onClick={handleResetTemplate}>恢复默认</Button>
            </Space>
          </Form.Item>

          <Form.Item name="notes" label="备注 / 制备说明">
            <TextArea rows={8} placeholder="可直接填写制备条件、实验背景、补充说明等内容" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                保存
              </Button>
              <Button onClick={() => navigate(-1)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Modal
        title="新建实验"
        open={experimentModalVisible}
        onOk={() => experimentForm.submit()}
        onCancel={() => setExperimentModalVisible(false)}
        confirmLoading={createExperimentMutation.isPending}
      >
        <Form
          form={experimentForm}
          layout="vertical"
          onFinish={(values) => createExperimentMutation.mutate({ project: selectedProject, ...values })}
        >
          <Form.Item name="name" label="实验名称" rules={[{ required: true, message: '请输入实验名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新建样品类型"
        open={sampleTypeModalVisible}
        onOk={() => sampleTypeForm.submit()}
        onCancel={() => setSampleTypeModalVisible(false)}
        confirmLoading={createSampleTypeMutation.isPending}
      >
        <Form
          form={sampleTypeForm}
          layout="vertical"
          onFinish={(values) => createSampleTypeMutation.mutate({ project: selectedProject, ...values })}
        >
          <Form.Item name="name" label="样品类型名称" rules={[{ required: true, message: '请输入样品类型名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="自定义说明模板"
        open={templateModalVisible}
        onOk={handleSaveTemplate}
        onCancel={() => setTemplateModalVisible(false)}
        okText="保存模板"
        cancelText="取消"
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div style={{ color: 'var(--color-text-secondary)' }}>
            这里可以定义新增样品时常用的说明结构，比如制备条件、设备、注意事项和记录顺序。
          </div>
          <TextArea
            rows={10}
            value={templateDraft}
            onChange={(event) => setTemplateDraft(event.target.value)}
            placeholder="请输入说明模板"
          />
        </Space>
      </Modal>
    </div>
  )
}
