import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '../services/project'
import { sampleApi } from '../services/sample'
import { downloadFile, formatDateTime, formatSampleLabel, getStatusTag } from '../utils/helpers'

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [batchModalVisible, setBatchModalVisible] = useState(false)
  const [markModalVisible, setMarkModalVisible] = useState(false)
  const [markValue, setMarkValue] = useState('')
  const [form] = Form.useForm()
  const [batchForm] = Form.useForm()

  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectApi.getDetail(id),
  })

  const { data: samplesData, isLoading: samplesLoading } = useQuery({
    queryKey: ['samples', id],
    queryFn: () => sampleApi.getList({ project_id: id, page_size: 500 }),
  })

  const { data: sampleTypesData } = useQuery({
    queryKey: ['sampleTypes', id],
    queryFn: () => sampleApi.getTypeList({ project: id, page_size: 100 }),
  })

  const { data: experimentsData } = useQuery({
    queryKey: ['experiments', id],
    queryFn: () => sampleApi.getExperimentList({ project: id, page_size: 100 }),
  })

  const project = projectData?.data || projectData
  const samplesResponse = samplesData?.data || samplesData
  const samples = Array.isArray(samplesResponse?.results) ? samplesResponse.results : []
  const sampleTypesResponse = sampleTypesData?.data || sampleTypesData
  const sampleTypes = Array.isArray(sampleTypesResponse?.results) ? sampleTypesResponse.results : []
  const experimentsResponse = experimentsData?.data || experimentsData
  const experiments = Array.isArray(experimentsResponse?.results) ? experimentsResponse.results : []

  const updateMutation = useMutation({
    mutationFn: (payload) => projectApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      message.success('项目更新成功')
      setEditModalVisible(false)
    },
    onError: (error) => {
      message.error(error.message || '更新失败')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => projectApi.delete(id),
    onSuccess: () => {
      message.success('项目删除成功')
      navigate('/projects')
    },
    onError: (error) => {
      message.error(error.message || '删除失败')
    },
  })

  const batchCreateMutation = useMutation({
    mutationFn: sampleApi.batchCreate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] })
      queryClient.invalidateQueries({ queryKey: ['experiments', id] })
      message.success('批量创建成功')
      setBatchModalVisible(false)
      batchForm.resetFields()
    },
    onError: (error) => {
      message.error(error.message || '批量创建失败')
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: sampleApi.batchDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] })
      message.success('批量删除成功')
      setSelectedRowKeys([])
    },
    onError: (error) => {
      message.error(error.message || '删除失败')
    },
  })

  const batchMarkMutation = useMutation({
    mutationFn: ({ ids, mark }) => sampleApi.batchMark(ids, mark),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] })
      message.success('批量标记成功')
      setSelectedRowKeys([])
      setMarkModalVisible(false)
      setMarkValue('')
    },
    onError: (error) => {
      message.error(error.message || '标记失败')
    },
  })

  const handleExport = async () => {
    try {
      const response = await sampleApi.export({ project_id: id })
      downloadFile(response, 'samples.xlsx')
      message.success('导出成功')
    } catch (error) {
      message.error(error.message || '导出失败')
    }
  }

  const handleBatchCreate = async () => {
    const values = await batchForm.validateFields()
    batchCreateMutation.mutate({
      experiment_id: values.experiment_id,
      sample_type_id: values.sample_type_id,
      display_code_prefix: values.display_code_prefix || '',
      count: Number(values.count),
    })
  }

  const columns = [
    {
      title: '样品',
      dataIndex: 'primary_label',
      key: 'primary_label',
      render: (_, record) => (
        <div>
          <a onClick={() => navigate(`/samples/${record.sample_id}`)}>{record.primary_label}</a>
          <div style={{ color: '#8c8c8c', fontSize: 12 }}>{record.secondary_label}</div>
        </div>
      ),
    },
    {
      title: '实验',
      dataIndex: 'experiment_name',
      key: 'experiment_name',
    },
    {
      title: '类型',
      dataIndex: 'sample_type_name',
      key: 'sample_type_name',
    },
    {
      title: '测试类型',
      dataIndex: 'test_types',
      key: 'test_types',
      render: (types) => (
        <Space size="small" wrap>
          {types?.slice(0, 3).map((type) => (
            <Tag key={type}>{type}</Tag>
          ))}
          {types?.length > 3 && <Tag>+{types.length - 3}</Tag>}
        </Space>
      ),
    },
    {
      title: '标记',
      dataIndex: 'mark',
      key: 'mark',
      render: (value) => value || '-',
    },
  ]

  if (projectLoading) {
    return <div style={{ padding: 48 }}>加载中...</div>
  }

  return (
    <div className="project-detail">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects')}>
            返回
          </Button>
          <h2 style={{ margin: 0 }}>{project?.name}</h2>
        </Space>
        <Space wrap>
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            导出 Excel
          </Button>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              form.setFieldsValue(project)
              setEditModalVisible(true)
            }}
          >
            编辑项目
          </Button>
          <Popconfirm
            title="确定删除这个项目吗？"
            onConfirm={() => deleteMutation.mutate()}
            okText="删除"
            cancelText="取消"
          >
            <Button danger icon={<DeleteOutlined />}>
              删除项目
            </Button>
          </Popconfirm>
        </Space>
      </div>

      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <Descriptions column={4}>
          <Descriptions.Item label="项目名称">{project?.name}</Descriptions.Item>
          <Descriptions.Item label="项目状态">
            <Tag color={getStatusTag(project?.status).color}>{getStatusTag(project?.status).text}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="样品数量">{project?.sample_count || 0}</Descriptions.Item>
          <Descriptions.Item label="实验数量">{experiments.length}</Descriptions.Item>
          <Descriptions.Item label="样品类型">{project?.sample_type_count || 0}</Descriptions.Item>
          <Descriptions.Item label="测试类型">{project?.test_type_count || 0}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{formatDateTime(project?.created_at)}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{formatDateTime(project?.updated_at)}</Descriptions.Item>
          <Descriptions.Item label="项目描述" span={4}>
            {project?.description || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title="实验"
        style={{ marginBottom: 16 }}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(`/samples/add?project=${id}`)}>
            添加样品
          </Button>
        }
      >
        <Space wrap>
          {experiments.map((experiment) => (
            <Tag
              key={experiment.id}
              color="processing"
              style={{ padding: '6px 10px', cursor: 'pointer' }}
              onClick={() => navigate(`/experiments/${experiment.id}`)}
            >
              {experiment.name} ({experiment.sample_count || 0})
            </Tag>
          ))}
        </Space>
      </Card>

      <Card
        title="样品列表"
        extra={
          <Space wrap>
            {selectedRowKeys.length > 0 && (
              <>
                <Popconfirm
                  title={`确定删除选中的 ${selectedRowKeys.length} 个样品吗？`}
                  onConfirm={() => batchDeleteMutation.mutate(selectedRowKeys)}
                  okText="删除"
                  cancelText="取消"
                >
                  <Button danger size="small">
                    批量删除
                  </Button>
                </Popconfirm>
                <Button size="small" onClick={() => setMarkModalVisible(true)}>
                  批量标记
                </Button>
              </>
            )}
            <Button type="primary" size="small" onClick={() => navigate(`/samples/add?project=${id}`)}>
              添加样品
            </Button>
            <Button size="small" onClick={() => setBatchModalVisible(true)}>
              批量创建
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={samples}
          rowKey="sample_id"
          loading={samplesLoading}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          pagination={false}
        />
      </Card>

      <Modal
        title="编辑项目"
        open={editModalVisible}
        onOk={() => form.submit()}
        onCancel={() => setEditModalVisible(false)}
        confirmLoading={updateMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(values) => updateMutation.mutate(values)}>
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="项目描述">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="status" label="项目状态" rules={[{ required: true, message: '请选择项目状态' }]}>
            <Select
              options={[
                { value: 'in_progress', label: '进行中' },
                { value: 'completed', label: '已完成' },
                { value: 'archived', label: '已归档' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量创建样品"
        open={batchModalVisible}
        onOk={handleBatchCreate}
        onCancel={() => setBatchModalVisible(false)}
        confirmLoading={batchCreateMutation.isPending}
      >
        <Form form={batchForm} layout="vertical">
          <Form.Item
            name="experiment_id"
            label="所属实验"
            rules={[{ required: true, message: '请选择实验' }]}
          >
            <Select options={experiments.map((item) => ({ value: item.id, label: item.name }))} />
          </Form.Item>
          <Form.Item
            name="sample_type_id"
            label="样品类型"
            rules={[{ required: true, message: '请选择样品类型' }]}
          >
            <Select options={sampleTypes.map((item) => ({ value: item.id, label: item.name }))} />
          </Form.Item>
          <Form.Item name="display_code_prefix" label="显示代号前缀">
            <Input placeholder="例如 A、Ring-，将自动生成 A01 / A02 ..." />
          </Form.Item>
          <Form.Item name="count" label="数量" rules={[{ required: true, message: '请输入数量' }]}>
            <Input type="number" min={1} max={100} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量标记"
        open={markModalVisible}
        onOk={() => batchMarkMutation.mutate({ ids: selectedRowKeys, mark: markValue })}
        onCancel={() => setMarkModalVisible(false)}
        confirmLoading={batchMarkMutation.isPending}
      >
        <Input value={markValue} onChange={(event) => setMarkValue(event.target.value)} placeholder="输入标记内容" />
      </Modal>
    </div>
  )
}
