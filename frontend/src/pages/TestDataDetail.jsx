import { useState } from 'react'
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
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  LineChartOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import DataChart from '../components/DataChart'
import { analysisApi } from '../services/analysis'
import { testApi } from '../services/test'
import { downloadFile, formatDateTime } from '../utils/helpers'
import './Analysis.css'

const { TextArea } = Input

export default function TestDataDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [processLoading, setProcessLoading] = useState(false)
  const [selectedAlgorithmId, setSelectedAlgorithmId] = useState(null)
  const [form] = Form.useForm()

  const { data: testData, isLoading } = useQuery({
    queryKey: ['testDataDetail', id],
    queryFn: () => testApi.getDataDetail(id),
  })

  const { data: plotDataResponse, isLoading: plotDataLoading, refetch: refetchPlotData } = useQuery({
    queryKey: ['plotData', id],
    queryFn: () => analysisApi.getPlotDataByTestData(id),
    retry: false,
  })

  const { data: algorithmsData } = useQuery({
    queryKey: ['algorithmsForTestData', testData?.data?.test_type],
    queryFn: () => analysisApi.getAlgorithmList({ test_type: testData?.data?.test_type, page_size: 100 }),
    enabled: !!testData?.data?.test_type,
  })

  const data = testData?.data
  const files = data?.files || []
  const plotData = plotDataResponse?.data
  const algorithms = algorithmsData?.results || algorithmsData?.data?.results || []

  const updateMutation = useMutation({
    mutationFn: (payload) => testApi.updateData(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testDataDetail', id] })
      message.success('测试数据更新成功')
      setEditModalVisible(false)
    },
    onError: (error) => {
      message.error(error.message || '更新失败')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => testApi.deleteData(id),
    onSuccess: () => {
      message.success('测试数据删除成功')
      navigate(-1)
    },
    onError: (error) => {
      message.error(error.message || '删除失败')
    },
  })

  const deleteFileMutation = useMutation({
    mutationFn: testApi.deleteFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testDataDetail', id] })
      message.success('文件删除成功')
    },
    onError: (error) => {
      message.error(error.message || '文件删除失败')
    },
  })

  const handleDownload = async (fileId, filename) => {
    try {
      const response = await testApi.downloadFile(fileId)
      downloadFile(response, filename)
    } catch (error) {
      message.error(error.message || '下载失败')
    }
  }

  const handleProcessPlotData = async () => {
    setProcessLoading(true)
    try {
      const payload = { test_data_id: Number.parseInt(id, 10) }
      if (selectedAlgorithmId) {
        payload.algorithm_id = selectedAlgorithmId
      }
      await analysisApi.processPlotData(payload)
      message.success('绘图数据生成成功')
      refetchPlotData()
    } catch (error) {
      message.error(error.message || error.detail || '绘图数据生成失败')
    } finally {
      setProcessLoading(false)
    }
  }

  const fileColumns = [
    {
      title: '文件名',
      dataIndex: 'original_filename',
      key: 'original_filename',
    },
    {
      title: '文件大小',
      dataIndex: 'file_size_display',
      key: 'file_size_display',
    },
    {
      title: '文件类型',
      dataIndex: 'file_type',
      key: 'file_type',
      render: (value) => (value ? <Tag>{value.toUpperCase()}</Tag> : '-'),
    },
    {
      title: '上传时间',
      dataIndex: 'uploaded_at',
      key: 'uploaded_at',
      render: (value) => formatDateTime(value),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record.id, record.original_filename)}
          >
            下载
          </Button>
          <Popconfirm
            title="确定删除这个文件吗？"
            onConfirm={() => deleteFileMutation.mutate(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  if (isLoading) {
    return <div style={{ padding: 48 }}>加载中...</div>
  }

  return (
    <div className="test-data-detail">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            返回
          </Button>
          <h2>测试数据详情</h2>
        </Space>
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              form.setFieldsValue({
                ...data,
                test_date: data?.test_date ? dayjs(data.test_date) : null,
              })
              setEditModalVisible(true)
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这条测试数据吗？"
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

      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <Descriptions column={2}>
          <Descriptions.Item label="样品主标识">
            <a onClick={() => navigate(`/samples/${data?.sample_id}`)}>
              {data?.sample_primary_label || data?.sample_display_code || data?.sample_id}
            </a>
          </Descriptions.Item>
          <Descriptions.Item label="辅助标识">
            {data?.sample_secondary_label || data?.sample_name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="测试类型">
            <Tag color="blue">{data?.test_type_name}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="测试日期">{data?.test_date || '-'}</Descriptions.Item>
          <Descriptions.Item label="测试仪器">{data?.instrument || '-'}</Descriptions.Item>
          <Descriptions.Item label="测试人员">{data?.tester || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{formatDateTime(data?.created_at)}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{formatDateTime(data?.updated_at)}</Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>
            {data?.notes || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="测试文件" style={{ marginBottom: 16 }}>
        <Table columns={fileColumns} dataSource={files} rowKey="id" pagination={false} size="small" />
      </Card>

      <Card
        title={
          <Space>
            <LineChartOutlined />
            <span>数据图表</span>
            {plotData && <Tag color="blue">{plotData.dimensions}D</Tag>}
          </Space>
        }
        extra={
          <Space>
            {algorithms.length > 0 && (
              <Select
                placeholder="选择算法"
                style={{ width: 220 }}
                allowClear
                value={selectedAlgorithmId}
                onChange={setSelectedAlgorithmId}
              >
                {algorithms.map((algorithm) => (
                  <Select.Option key={algorithm.id} value={algorithm.id}>
                    {algorithm.name}
                  </Select.Option>
                ))}
              </Select>
            )}
            <Button
              type="primary"
              icon={plotData ? <ReloadOutlined /> : <LineChartOutlined />}
              loading={processLoading}
              onClick={handleProcessPlotData}
            >
              {plotData ? '重新生成' : '生成图表'}
            </Button>
          </Space>
        }
      >
        {plotDataLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin tip="加载绘图数据中..." />
          </div>
        ) : plotData ? (
          <div>
            <div style={{ marginBottom: 12 }}>
              <Space wrap>
                <Tag color="blue">维度: {plotData.dimensions}D</Tag>
                <Tag color="green">
                  X 轴: {plotData.x_column || plotData.columns?.[0]}
                  {plotData.x_unit ? ` (${plotData.x_unit})` : ''}
                </Tag>
                {plotData.y_column && (
                  <Tag color="red">
                    Y 轴: {plotData.y_column}
                    {plotData.y_unit ? ` (${plotData.y_unit})` : ''}
                  </Tag>
                )}
                <Tag color="purple">
                  系列: {plotData.series?.map((series) => series.name).join(', ') || plotData.columns?.slice(1).join(', ')}
                </Tag>
                <Tag color="orange">数据点: {plotData.series?.[0]?.data?.length || plotData.data?.length}</Tag>
                {plotData.algorithm_name && <Tag color="cyan">算法: {plotData.algorithm_name}</Tag>}
              </Space>
            </div>
            <DataChart
              plotData={plotData}
              height={450}
              title={`${data?.sample_primary_label || data?.sample_display_code || data?.sample_id || ''} - ${data?.test_type_name || ''}`}
            />
          </div>
        ) : (
          <Empty
            description={
              algorithms.length === 0
                ? `测试类型“${data?.test_type_name || ''}”暂无可用算法，请先在算法管理中创建`
                : '暂无绘图数据，点击“生成图表”处理数据'
            }
          >
            {algorithms.length === 0 && (
              <Button type="primary" onClick={() => navigate('/analysis/algorithms')}>
                前往创建算法
              </Button>
            )}
          </Empty>
        )}
      </Card>

      <Modal
        title="编辑测试数据"
        open={editModalVisible}
        onOk={() => form.submit()}
        onCancel={() => setEditModalVisible(false)}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) =>
            updateMutation.mutate({
              ...values,
              test_date: values.test_date ? dayjs(values.test_date).format('YYYY-MM-DD') : null,
            })
          }
        >
          <Form.Item name="test_date" label="测试日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="instrument" label="测试仪器">
            <Input />
          </Form.Item>
          <Form.Item name="tester" label="测试人员">
            <Input />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
