import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Empty, Select, Space, Spin, Table, Tag, message } from 'antd'
import { LineChartOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { analysisApi } from '../services/analysis'
import { testApi } from '../services/test'
import DataChart from '../components/DataChart'
import { formatSampleLabel } from '../utils/helpers'
import './Analysis.css'

export default function Analysis() {
  const navigate = useNavigate()
  const [selectedTestDataId, setSelectedTestDataId] = useState(null)
  const [selectedAlgorithmId, setSelectedAlgorithmId] = useState(null)
  const [processLoading, setProcessLoading] = useState(false)

  const { data: testDataList, isLoading: testDataLoading } = useQuery({
    queryKey: ['testDataList'],
    queryFn: () => testApi.getDataList({ page_size: 100 }),
  })

  const testDataItems = testDataList?.results || testDataList?.data?.results || []

  const { data: plotDataResponse, isLoading: plotDataLoading, refetch: refetchPlotData } = useQuery({
    queryKey: ['plotData', selectedTestDataId],
    queryFn: () => analysisApi.getPlotDataByTestData(selectedTestDataId),
    enabled: !!selectedTestDataId,
    retry: false,
  })

  const { data: algorithmsData } = useQuery({
    queryKey: ['algorithmsAll'],
    queryFn: () => analysisApi.getAlgorithmList({ page_size: 100 }),
  })

  const algorithms = algorithmsData?.results || algorithmsData?.data?.results || []
  const plotData = plotDataResponse?.data
  const selectedTestData = testDataItems.find((item) => item.id === selectedTestDataId)
  const availableAlgorithms = selectedTestData
    ? algorithms.filter((algorithm) => algorithm.test_type === selectedTestData.test_type)
    : algorithms

  const handleProcessPlotData = async () => {
    if (!selectedTestDataId) {
      message.warning('请先选择测试数据')
      return
    }

    setProcessLoading(true)
    try {
      const payload = { test_data_id: selectedTestDataId }
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

  const testDataColumns = [
    {
      title: '样品',
      dataIndex: 'sample_id',
      key: 'sample_id',
      width: 240,
      render: (_, record) =>
        formatSampleLabel({
          sample_id: record.sample_id,
          display_code: record.sample_display_code,
          name: record.sample_name,
          full_label: record.sample_full_label,
        }),
    },
    {
      title: '测试类型',
      dataIndex: 'test_type_name',
      key: 'test_type_name',
      width: 140,
      render: (value) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '测试日期',
      dataIndex: 'test_date',
      key: 'test_date',
      width: 120,
      render: (value) => value || '-',
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
      width: 100,
      render: (_, record) => (
        <Button
          type={selectedTestDataId === record.id ? 'primary' : 'default'}
          size="small"
          onClick={() => {
            setSelectedTestDataId(record.id)
            setSelectedAlgorithmId(null)
          }}
        >
          选择
        </Button>
      ),
    },
  ]

  return (
    <div className="analysis-page">
      <div className="page-header">
        <h2>数据分析</h2>
        <Button icon={<SettingOutlined />} onClick={() => navigate('/analysis/algorithms')}>
          算法管理
        </Button>
      </div>

      <Card title="选择测试数据" style={{ marginBottom: 16 }}>
        <Table
          columns={testDataColumns}
          dataSource={testDataItems}
          rowKey="id"
          loading={testDataLoading}
          pagination={{ pageSize: 5 }}
          size="small"
          rowClassName={(record) => (record.id === selectedTestDataId ? 'ant-table-row-selected' : '')}
        />
      </Card>

      {selectedTestDataId && (
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
              {availableAlgorithms.length > 0 && (
                <Select
                  placeholder="选择算法"
                  style={{ width: 220 }}
                  allowClear
                  value={selectedAlgorithmId}
                  onChange={setSelectedAlgorithmId}
                >
                  {availableAlgorithms.map((algorithm) => (
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
                height={500}
                title={`${selectedTestData?.sample_primary_label || selectedTestData?.sample_display_code || selectedTestData?.sample_id || ''} - ${selectedTestData?.test_type_name || ''}`}
              />
            </div>
          ) : (
            <Empty
              description={
                availableAlgorithms.length === 0
                  ? '该测试类型暂无可用算法，请先在算法管理中创建'
                  : '暂无绘图数据，点击“生成图表”处理数据'
              }
            >
              {availableAlgorithms.length === 0 && (
                <Button type="primary" onClick={() => navigate('/analysis/algorithms')}>
                  前往创建算法
                </Button>
              )}
            </Empty>
          )}
        </Card>
      )}
    </div>
  )
}
