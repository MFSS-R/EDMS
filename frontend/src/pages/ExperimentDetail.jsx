import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Descriptions, Empty, Form, Input, Modal, Select, Spin, Space, message } from 'antd'
import { ArrowLeftOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import SampleCard from '../components/SampleCard/SampleCard'
import { sampleApi } from '../services/sample'
import { testApi } from '../services/test'
import { formatDateTime } from '../utils/helpers'
import './ExperimentDetail.css'

const { Option } = Select

export default function ExperimentDetail() {
  const { experimentId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedTestType, setSelectedTestType] = useState(null)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editForm] = Form.useForm()

  const { data: experimentData, isLoading: experimentLoading } = useQuery({
    queryKey: ['experiment', experimentId],
    queryFn: () => sampleApi.getExperimentDetail(experimentId),
    enabled: !!experimentId,
  })

  const { data: samplesData, isLoading: samplesLoading } = useQuery({
    queryKey: ['samples', experimentId],
    queryFn: () => sampleApi.getList({ experiment: experimentId, page_size: 100 }),
    enabled: !!experimentId,
  })

  const experiment = experimentData?.data || experimentData

  const { data: testTypesData, isLoading: testTypesLoading } = useQuery({
    queryKey: ['testTypes', experiment?.project],
    queryFn: () => testApi.getTypeList({ project: experiment?.project, page_size: 100 }),
    enabled: !!experiment?.project,
  })

  const samples = samplesData?.results || samplesData?.data?.results || []
  const testTypes = testTypesData?.results || testTypesData?.data?.results || []

  const updateMutation = useMutation({
    mutationFn: (payload) =>
      sampleApi.updateExperiment(experimentId, {
        project: experiment.project,
        ...payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiment', experimentId] })
      queryClient.invalidateQueries({ queryKey: ['experiments'] })
      message.success('实验更新成功')
      setEditModalVisible(false)
    },
    onError: (error) => {
      message.error(error.message || '更新失败')
    },
  })

  useEffect(() => {
    if (testTypes.length > 0 && !selectedTestType) {
      setSelectedTestType(testTypes[0].id)
    }
  }, [selectedTestType, testTypes])

  if (experimentLoading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  }

  if (!experiment) {
    return (
      <div style={{ padding: '100px 24px', textAlign: 'center' }}>
        <Empty description="实验不存在" />
        <Button type="primary" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginTop: 16 }}>
          返回
        </Button>
      </div>
    )
  }

  return (
    <div className="experiment-detail-page">
      <div className="page-header">
        <div className="header-left">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            返回
          </Button>
          <h2>{experiment.name}</h2>
        </div>
        <div className="header-right">
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                editForm.setFieldsValue({
                  name: experiment.name,
                  description: experiment.description,
                })
                setEditModalVisible(true)
              }}
            >
              编辑实验
            </Button>
            <Button type="primary" icon={<EyeOutlined />}>
              <Link to={`/projects/${experiment.project}`} style={{ color: '#fff' }}>
                查看项目
              </Link>
            </Button>
          </Space>
        </div>
      </div>

      <Card className="experiment-info-card">
        <Descriptions column={1} bordered>
          <Descriptions.Item label="实验名称">{experiment.name}</Descriptions.Item>
          <Descriptions.Item label="所属项目">
            <Link to={`/projects/${experiment.project}`}>{experiment.project_name}</Link>
          </Descriptions.Item>
          <Descriptions.Item label="样品数量">{experiment.sample_count || 0}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{formatDateTime(experiment.created_at)}</Descriptions.Item>
          <Descriptions.Item label="描述">{experiment.description || '无'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <div className="test-type-selector">
        <h3>选择测试类型</h3>
        <Select
          style={{ width: 220 }}
          placeholder="选择测试类型"
          value={selectedTestType}
          onChange={setSelectedTestType}
          loading={testTypesLoading}
        >
          {testTypes.map((type) => (
            <Option key={type.id} value={type.id}>
              {type.name}
            </Option>
          ))}
        </Select>
      </div>

      <div className="samples-section">
        <div className="samples-section-header">
          <div>
            <h3>样品列表</h3>
            <p>优先展示每个样品在当前测试类型下的图表，方便你快速横向对比。</p>
          </div>
          <div className="samples-summary">共 {samples.length} 个样品</div>
        </div>
        {samplesLoading ? (
          <Spin size="large" style={{ display: 'block', margin: '50px auto' }} />
        ) : samples.length === 0 ? (
          <Empty description="暂无样品" />
        ) : (
          <div className="samples-grid">
            {samples.map((sample) => (
              <div key={sample.sample_id} className="sample-grid-item">
                <SampleCard sample={sample} testTypeId={selectedTestType} />
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        title="编辑实验"
        open={editModalVisible}
        onOk={() => editForm.submit()}
        onCancel={() => setEditModalVisible(false)}
        confirmLoading={updateMutation.isPending}
      >
        <Form form={editForm} layout="vertical" onFinish={(values) => updateMutation.mutate(values)}>
          <Form.Item
            name="name"
            label="实验名称"
            rules={[{ required: true, message: '请输入实验名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
