import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, Select, Space, Table, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { testApi } from '../services/test'

export default function TestData() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sampleId = searchParams.get('sample')

  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 })
  const [filters, setFilters] = useState({
    sample: sampleId,
    test_type: null,
    project_id: null,
  })

  const { data, isLoading, error, isError } = useQuery({
    queryKey: ['testData', pagination, filters],
    queryFn: () =>
      testApi.getDataList({
        page: pagination.current,
        page_size: pagination.pageSize,
        ...filters,
      }),
  })

  const { data: testTypesData } = useQuery({
    queryKey: ['testTypes'],
    queryFn: () => testApi.getTypeList({ page_size: 100 }),
  })

  const testDataResponse = data?.data || data
  const testDataList = Array.isArray(testDataResponse?.results) ? testDataResponse.results : []
  const total = testDataResponse?.count || 0
  const testTypesResponse = testTypesData?.data || testTypesData
  const testTypes = Array.isArray(testTypesResponse?.results) ? testTypesResponse.results : []

  const columns = [
    {
      title: '样品',
      dataIndex: 'sample_primary_label',
      key: 'sample_primary_label',
      render: (_, record) => (
        <div>
          <a onClick={() => navigate(`/samples/${record.sample_id}`)}>{record.sample_primary_label || record.sample_id}</a>
          <div style={{ color: '#8c8c8c', fontSize: 12 }}>{record.sample_secondary_label || '-'}</div>
        </div>
      ),
    },
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
      render: (value) => value || '-',
    },
    {
      title: '测试仪器',
      dataIndex: 'instrument',
      key: 'instrument',
      render: (value) => value || '-',
    },
    {
      title: '测试人员',
      dataIndex: 'tester',
      key: 'tester',
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
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => navigate(`/test-data/${record.id}`)}>
          查看详情
        </Button>
      ),
    },
  ]

  return (
    <div className="test-data-page">
      <div className="page-header">
        <h2>测试数据</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/test-data/add')}>
          上传测试数据
        </Button>
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder="筛选测试类型"
            allowClear
            style={{ width: 180 }}
            onChange={(value) => setFilters((prev) => ({ ...prev, test_type: value || null }))}
            options={testTypes.map((item) => ({ value: item.id, label: item.name }))}
          />
        </Space>

        {isError && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message="测试数据加载失败"
            description={error?.message || '接口请求失败，请稍后重试。'}
          />
        )}

        <Table
          columns={columns}
          dataSource={testDataList}
          rowKey="id"
          loading={isLoading}
          locale={{
            emptyText: isError ? '数据加载失败' : '暂无数据',
          }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total,
            showSizeChanger: true,
            showTotal: (count) => `共 ${count} 条`,
            onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          }}
        />
      </Card>
    </div>
  )
}
