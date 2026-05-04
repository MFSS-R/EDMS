import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Card,
  DatePicker,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  message,
} from 'antd'
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { sampleApi } from '../services/sample'
import { testApi } from '../services/test'
import {
  formatDate,
  formatDateTime,
  formatSampleLabel,
  formatSamplePrimary,
  formatSampleSecondary,
} from '../utils/helpers'
import {
  appendSampleNoteTemplate,
  getSampleNoteTemplate,
  resetSampleNoteTemplate,
  setSampleNoteTemplate,
} from '../utils/sampleNoteTemplate'
import './SampleDetail.css'

const { TextArea } = Input

function formatLegacyPreparationConditions(preparationConditions = {}) {
  const entries = Object.entries(preparationConditions)
  if (entries.length === 0) return ''

  return entries
    .map(([name, data]) => `${name}: ${data?.value ?? ''}${data?.unit ? ` ${data.unit}` : ''}`)
    .join('\n')
}

export default function SampleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [templateModalVisible, setTemplateModalVisible] = useState(false)
  const [noteTemplate, setNoteTemplateState] = useState(() => getSampleNoteTemplate())
  const [templateDraft, setTemplateDraft] = useState(() => getSampleNoteTemplate())
  const [form] = Form.useForm()

  const { data: sampleResponse, isLoading } = useQuery({
    queryKey: ['sampleDetail', id],
    queryFn: () => sampleApi.getDetail(id),
    enabled: !!id,
  })

  const { data: testDataResponse, isLoading: testDataLoading } = useQuery({
    queryKey: ['testDataForSample', id],
    queryFn: () => testApi.getDataList({ sample: id, page_size: 200 }),
    enabled: !!id,
  })

  const sample = sampleResponse?.data || sampleResponse
  const testDataResult = testDataResponse?.data || testDataResponse
  const testDataList = testDataResult?.results || []

  const { data: experimentsData } = useQuery({
    queryKey: ['experimentsForSample', sample?.project_id],
    queryFn: () => sampleApi.getExperimentList({ project: sample?.project_id, page_size: 200 }),
    enabled: !!sample?.project_id,
  })

  const { data: sampleTypesData } = useQuery({
    queryKey: ['sampleTypesForSample', sample?.project_id],
    queryFn: () => sampleApi.getTypeList({ project: sample?.project_id, page_size: 200 }),
    enabled: !!sample?.project_id,
  })

  const experimentsResult = experimentsData?.data || experimentsData
  const sampleTypesResult = sampleTypesData?.data || sampleTypesData
  const experiments = experimentsResult?.results || []
  const sampleTypes = sampleTypesResult?.results || []

  const legacyPreparationText = useMemo(
    () => formatLegacyPreparationConditions(sample?.preparation_conditions),
    [sample?.preparation_conditions]
  )

  const updateMutation = useMutation({
    mutationFn: (payload) => sampleApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sampleDetail', id] })
      queryClient.invalidateQueries({ queryKey: ['samples'] })
      message.success('样品更新成功')
      setEditModalVisible(false)
    },
    onError: (error) => {
      message.error(error.message || '更新失败')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => sampleApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] })
      message.success('样品删除成功')
      navigate(-1)
    },
    onError: (error) => {
      message.error(error.message || '删除失败')
    },
  })

  const openEditModal = () => {
    const baseNotes = sample?.notes || ''
    const mergedNotes = legacyPreparationText
      ? `${baseNotes}${baseNotes ? '\n\n' : ''}[历史制备条件]\n${legacyPreparationText}`
      : baseNotes

    form.setFieldsValue({
      experiment: sample?.experiment,
      sample_type: sample?.sample_type,
      display_code: sample?.display_code,
      name: sample?.name,
      synthesis_date: sample?.synthesis_date ? dayjs(sample.synthesis_date) : null,
      batch_number: sample?.batch_number,
      mark: sample?.mark,
      notes: mergedNotes,
    })

    setEditModalVisible(true)
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

  const handleSubmit = async () => {
    const values = await form.validateFields()

    updateMutation.mutate({
      experiment: values.experiment,
      sample_type: values.sample_type,
      display_code: values.display_code || '',
      name: values.name || '',
      synthesis_date: values.synthesis_date ? dayjs(values.synthesis_date).format('YYYY-MM-DD') : null,
      batch_number: values.batch_number || '',
      mark: values.mark || '',
      notes: values.notes || '',
      preparation_conditions: sample?.preparation_conditions || {},
    })
  }

  const testDataColumns = [
    {
      title: '测试类型',
      dataIndex: 'test_type_name',
      key: 'test_type_name',
      render: (value) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '测试日期',
      dataIndex: 'test_date',
      key: 'test_date',
      render: (value) => formatDate(value) || '-',
    },
    {
      title: '文件数',
      dataIndex: 'file_count',
      key: 'file_count',
      width: 100,
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Button type="link" onClick={() => navigate(`/test-data/${record.id}`)}>
          查看详情
        </Button>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="sample-detail">
        <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
      </div>
    )
  }

  if (!sample) {
    return (
      <div className="sample-detail">
        <Empty description="样品不存在" />
      </div>
    )
  }

  return (
    <div className="sample-detail">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            返回
          </Button>
          <div>
            <h2>{formatSamplePrimary(sample)}</h2>
            <div style={{ color: 'var(--color-text-secondary)' }}>{formatSampleSecondary(sample)}</div>
          </div>
        </Space>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => navigate(`/test-data/add?sample=${sample.sample_id}`)}>
            上传测试数据
          </Button>
          <Button icon={<EditOutlined />} onClick={openEditModal}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个样品吗？"
            onConfirm={() => deleteMutation.mutate()}
            okText="删除"
            cancelText="取消"
          >
            <Button danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      </div>

      <Card className="detail-card" style={{ marginBottom: 16 }}>
        <Descriptions title="基本信息" column={2}>
          <Descriptions.Item label="完整标识">{formatSampleLabel(sample)}</Descriptions.Item>
          <Descriptions.Item label="系统编号">{sample.sample_id}</Descriptions.Item>
          <Descriptions.Item label="显示代号">{sample.display_code || '-'}</Descriptions.Item>
          <Descriptions.Item label="样品名称">{sample.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="所属项目">{sample.project_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="所属实验">{sample.experiment_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="样品类型">{sample.sample_type_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="制备日期">{formatDate(sample.synthesis_date) || '-'}</Descriptions.Item>
          <Descriptions.Item label="批次号">{sample.batch_number || '-'}</Descriptions.Item>
          <Descriptions.Item label="标记">{sample.mark || '-'}</Descriptions.Item>
          <Descriptions.Item label="测试数量">{sample.test_data_count || 0}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{formatDateTime(sample.created_at)}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{formatDateTime(sample.updated_at)}</Descriptions.Item>
          <Descriptions.Item label="备注 / 制备说明" span={2}>
            <div style={{ whiteSpace: 'pre-wrap' }}>{sample.notes || legacyPreparationText || '-'}</div>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {legacyPreparationText && (
        <Card className="detail-card" style={{ marginBottom: 16 }}>
          <Descriptions title="历史制备条件" column={1}>
            <Descriptions.Item label="旧结构化数据">
              <div style={{ whiteSpace: 'pre-wrap' }}>{legacyPreparationText}</div>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Card className="test-data-card" title="测试数据">
        <Table
          columns={testDataColumns}
          dataSource={testDataList}
          rowKey="id"
          loading={testDataLoading}
          pagination={false}
          locale={{ emptyText: '暂无测试数据' }}
        />
      </Card>

      <Modal
        title="编辑样品"
        open={editModalVisible}
        onOk={handleSubmit}
        onCancel={() => setEditModalVisible(false)}
        confirmLoading={updateMutation.isPending}
        width={820}
      >
        <Form form={form} layout="vertical">
          <Space style={{ width: '100%' }} size={16} wrap>
            <Form.Item
              name="experiment"
              label="所属实验"
              rules={[{ required: true, message: '请选择实验' }]}
              style={{ minWidth: 240, flex: 1 }}
            >
              <Select options={experiments.map((item) => ({ value: item.id, label: item.name }))} />
            </Form.Item>
            <Form.Item
              name="sample_type"
              label="样品类型"
              rules={[{ required: true, message: '请选择样品类型' }]}
              style={{ minWidth: 240, flex: 1 }}
            >
              <Select options={sampleTypes.map((item) => ({ value: item.id, label: item.name }))} />
            </Form.Item>
          </Space>

          <Space style={{ width: '100%' }} size={16} wrap>
            <Form.Item name="display_code" label="显示代号" style={{ minWidth: 220, flex: 1 }}>
              <Input placeholder="例如 A2 / Ring-03 / S1" />
            </Form.Item>
            <Form.Item name="name" label="样品名称" style={{ minWidth: 220, flex: 1 }}>
              <Input placeholder="便于识别的名称" />
            </Form.Item>
          </Space>

          <Space style={{ width: '100%' }} size={16} wrap>
            <Form.Item name="synthesis_date" label="制备日期" style={{ minWidth: 220, flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="batch_number" label="批次号" style={{ minWidth: 220, flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="mark" label="标记" style={{ minWidth: 180, flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>

          <Form.Item extra="建议把制备条件直接写在备注里。说明模板支持自定义，适合统一团队填写格式。">
            <Space wrap>
              <Button onClick={insertTemplate}>插入模板</Button>
              <Button onClick={openTemplateEditor}>编辑模板</Button>
              <Button onClick={handleResetTemplate}>恢复默认</Button>
            </Space>
          </Form.Item>

          <Form.Item name="notes" label="备注 / 制备说明">
            <TextArea rows={8} />
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
            模板保存在当前浏览器中。你可以把常用的字段、记录顺序和固定提示语都写进去。
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
