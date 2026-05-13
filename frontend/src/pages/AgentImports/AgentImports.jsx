import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { agentImportApi, normalizeImportList } from '../../services/agentImport'

const { Text, Title } = Typography
const { Dragger } = Upload

const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'created', label: '已创建' },
  { value: 'uploaded', label: '已上传' },
  { value: 'awaiting_confirmation', label: '待确认' },
  { value: 'importing', label: '导入中' },
  { value: 'succeeded', label: '已完成' },
  { value: 'failed', label: '失败' },
  { value: 'partial_failed', label: '部分失败' },
]

const STATUS_TAGS = {
  created: 'default',
  uploaded: 'processing',
  awaiting_confirmation: 'blue',
  importing: 'processing',
  succeeded: 'green',
  failed: 'red',
  partial_failed: 'orange',
  conflict: 'orange',
}

function asArray(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  return [value]
}

function isEmptyObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0
}

function compactIssueList(value) {
  return asArray(value).filter((item) => item && !isEmptyObject(item))
}

function normalizePreview(response) {
  if (Array.isArray(response?.items)) return response.items
  if (Array.isArray(response?.data?.items)) return response.data.items
  return normalizeImportList(response).results
}

function statusLabel(status) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label || status || '未知'
}

function formatIssueList(value) {
  return compactIssueList(value)
    .map((item) => {
      if (typeof item === 'string') return item
      return item.detail || item.error_code || item.message || JSON.stringify(item)
    })
    .filter(Boolean)
    .join('; ')
}

export default function AgentImports() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('all')
  const [selectedJobId, setSelectedJobId] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState([])

  const listParams = useMemo(() => (status === 'all' ? {} : { status }), [status])
  const jobsQuery = useQuery({
    queryKey: ['agentImportJobs', listParams],
    queryFn: () => agentImportApi.list(listParams),
  })

  const jobs = jobsQuery.data?.results || []
  const selectedJob = jobs.find((job) => job.id === selectedJobId) || null

  const detailQuery = useQuery({
    queryKey: ['agentImportJob', selectedJobId],
    queryFn: () => agentImportApi.get(selectedJobId),
    enabled: Boolean(selectedJobId),
  })

  const previewQuery = useQuery({
    queryKey: ['agentImportPreview', selectedJobId],
    queryFn: () => agentImportApi.getPreview(selectedJobId),
    enabled: Boolean(selectedJobId),
    select: normalizePreview,
  })

  const activeJob = detailQuery.data || selectedJob
  const previewItems = previewQuery.data || []

  const createMutation = useMutation({
    mutationFn: () => agentImportApi.create({ source: 'hermes' }),
    onSuccess: (job) => {
      message.success('Hermes 导入作业已创建')
      queryClient.invalidateQueries({ queryKey: ['agentImportJobs'] })
      if (job?.id) setSelectedJobId(job.id)
    },
    onError: (error) => message.error(error.message || '创建导入作业失败'),
  })

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedJobId || selectedFiles.length === 0) return null
      const formData = new FormData()
      selectedFiles.forEach((file) => {
        formData.append('files', file.originFileObj || file)
        formData.append('file_keys', file.name)
      })
      const result = await agentImportApi.uploadFiles(selectedJobId, formData)
      await agentImportApi.parse(selectedJobId)
      return result
    },
    onSuccess: () => {
      message.success('文件已上传并开始解析')
      setSelectedFiles([])
      queryClient.invalidateQueries({ queryKey: ['agentImportJobs'] })
      queryClient.invalidateQueries({ queryKey: ['agentImportJob', selectedJobId] })
      queryClient.invalidateQueries({ queryKey: ['agentImportPreview', selectedJobId] })
    },
    onError: (error) => message.error(error.message || '上传或解析失败'),
  })

  const confirmMutation = useMutation({
    mutationFn: (jobId) => agentImportApi.confirm(jobId),
    onSuccess: () => {
      message.success('导入作业已确认')
      queryClient.invalidateQueries({ queryKey: ['agentImportJobs'] })
      queryClient.invalidateQueries({ queryKey: ['agentImportJob', selectedJobId] })
    },
    onError: (error) => message.error(error.message || '确认导入失败'),
  })

  const retryMutation = useMutation({
    mutationFn: (jobId) => agentImportApi.retry(jobId),
    onSuccess: () => {
      message.success('导入作业已重试')
      queryClient.invalidateQueries({ queryKey: ['agentImportJobs'] })
      queryClient.invalidateQueries({ queryKey: ['agentImportJob', selectedJobId] })
      queryClient.invalidateQueries({ queryKey: ['agentImportPreview', selectedJobId] })
    },
    onError: (error) => message.error(error.message || '重试失败'),
  })

  const jobColumns = [
    {
      title: '作业',
      dataIndex: 'name',
      key: 'name',
      render: (value, record) => value || record.job_name || `Agent Import #${record.id}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value) => <Tag color={STATUS_TAGS[value] || 'default'}>{statusLabel(value)}</Tag>,
    },
    {
      title: '总数',
      dataIndex: 'total_items',
      key: 'total_items',
      width: 90,
      render: (value, record) => value ?? record.preview_count ?? record.counts?.items ?? 0,
    },
    {
      title: '冲突',
      dataIndex: 'conflict_items',
      key: 'conflict_items',
      width: 90,
      render: (value) => <Text type={value ? 'warning' : 'secondary'}>{value || 0}</Text>,
    },
    {
      title: '失败',
      dataIndex: 'failed_items',
      key: 'failed_items',
      width: 90,
      render: (value, record) => (
        <Text type={value || record.counts?.errors ? 'danger' : 'secondary'}>
          {value ?? record.counts?.errors ?? 0}
        </Text>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (value) => value ? new Date(value).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 110,
      render: (_, record) => (
        <Button size="small" onClick={() => setSelectedJobId(record.id)}>
          详情
        </Button>
      ),
    },
  ]

  const previewColumns = [
    {
      title: 'Preview Item',
      dataIndex: 'sample_name',
      key: 'sample_name',
      render: (value, record) => value || record.external_id || record.file_key || record.name || record.id,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value) => <Tag color={STATUS_TAGS[value] || 'default'}>{value || 'pending'}</Tag>,
    },
    {
      title: '冲突原因',
      dataIndex: 'conflict_reason',
      key: 'conflict_reason',
      render: (value, record) => value || formatIssueList(record.warnings) || <Text type="secondary">无</Text>,
    },
    {
      title: '失败原因',
      dataIndex: 'failure_reason',
      key: 'failure_reason',
      render: (value, record) => value || record.error || formatIssueList(record.errors) || <Text type="secondary">无</Text>,
    },
  ]

  const uploadProps = {
    multiple: true,
    beforeUpload: () => false,
    fileList: selectedFiles,
    onChange: ({ fileList }) => setSelectedFiles(fileList),
  }

  const logs = useMemo(() => asArray(activeJob?.logs || activeJob?.log_lines || activeJob?.audit_events), [activeJob])
  const errors = useMemo(
    () => compactIssueList(activeJob?.errors || activeJob?.error_messages || activeJob?.error),
    [activeJob]
  )
  const canUpload = Boolean(selectedJobId) && selectedFiles.length > 0

  return (
    <div className="agent-imports-page">
      <div className="page-header">
        <div>
          <Title level={2} style={{ marginBottom: 0 }}>Hermes Agent 导入</Title>
          <Text type="secondary">导入作业、解析预览、冲突确认和失败重试</Text>
        </div>
        <Space wrap>
          <Select
            value={status}
            options={STATUS_OPTIONS}
            onChange={setStatus}
            style={{ width: 160 }}
          />
          <Button
            type="primary"
            icon={<UploadOutlined />}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            新建导入作业
          </Button>
        </Space>
      </div>

      {jobsQuery.data?.backendUnavailable && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Hermes agent import backend 暂不可用"
          description={jobsQuery.data.message}
        />
      )}

      {jobsQuery.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="加载导入作业失败"
          description={jobsQuery.error?.message || '请稍后重试'}
        />
      )}

      <Card style={{ marginBottom: 16 }}>
        {jobsQuery.isLoading ? (
          <Spin tip="加载 Hermes 导入作业...">
            <div style={{ minHeight: 160 }} />
          </Spin>
        ) : (
          <Table
            rowKey="id"
            columns={jobColumns}
            dataSource={jobs}
            pagination={{ pageSize: 10, total: jobsQuery.data?.count || jobs.length }}
            locale={{ emptyText: <Empty description="暂无 Hermes 导入作业" /> }}
            onRow={(record) => ({ onClick: () => setSelectedJobId(record.id) })}
          />
        )}
      </Card>

      <Card title="作业详情">
        {!selectedJobId ? (
          <Empty description="请选择一个导入作业查看详情" />
        ) : detailQuery.isLoading ? (
          <Spin />
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {detailQuery.isError && (
              <Alert
                type="error"
                showIcon
                message="加载作业详情失败"
                description={detailQuery.error?.message || '请稍后重试'}
              />
            )}

            <Descriptions size="small" bordered column={3}>
              <Descriptions.Item label="作业 ID">{activeJob?.id || selectedJobId}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_TAGS[activeJob?.status] || 'default'}>{statusLabel(activeJob?.status)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="来源">{activeJob?.source || 'hermes'}</Descriptions.Item>
              <Descriptions.Item label="Preview Items">{previewItems.length}</Descriptions.Item>
              <Descriptions.Item label="冲突">{activeJob?.conflict_items || 0}</Descriptions.Item>
              <Descriptions.Item label="失败">{activeJob?.failed_items ?? activeJob?.counts?.errors ?? 0}</Descriptions.Item>
            </Descriptions>

            <Space wrap>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                disabled={!selectedJobId}
                loading={confirmMutation.isPending}
                onClick={() => confirmMutation.mutate(selectedJobId)}
              >
                确认导入
              </Button>
              <Button
                icon={<ReloadOutlined />}
                disabled={!selectedJobId}
                loading={retryMutation.isPending}
                onClick={() => retryMutation.mutate(selectedJobId)}
              >
                重试
              </Button>
            </Space>

            <Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon"><UploadOutlined /></p>
              <p className="ant-upload-text">选择 Hermes agent 产物文件</p>
              <p className="ant-upload-hint">文件会绑定到当前作业，上传后触发解析，不影响 DataManagement 上传弹窗。</p>
            </Dragger>
            <Button
              icon={<UploadOutlined />}
              disabled={!canUpload}
              loading={uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
            >
              上传并解析
            </Button>

            <Table
              rowKey={(record) => record.id || record.external_id || record.file_key}
              size="small"
              columns={previewColumns}
              dataSource={previewItems}
              loading={previewQuery.isLoading}
              pagination={{ pageSize: 8 }}
              locale={{ emptyText: <Empty description="暂无 preview items" /> }}
            />

            <Card size="small" title="日志">
              {logs.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无日志" />
              ) : (
                <Space direction="vertical" size={4}>
                  {logs.map((line, index) => (
                    <Text code key={`${JSON.stringify(line)}-${index}`}>
                      {typeof line === 'string' ? line : `${line.event_type || 'event'} ${line.created_at || ''}`}
                    </Text>
                  ))}
                </Space>
              )}
            </Card>

            <Card size="small" title="错误">
              {errors.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无错误" />
              ) : (
                <Space direction="vertical" size={4}>
                  {errors.map((line, index) => (
                    <Alert key={`${JSON.stringify(line)}-${index}`} type="error" showIcon message={formatIssueList(line) || String(line)} />
                  ))}
                </Space>
              )}
            </Card>
          </Space>
        )}
      </Card>
    </div>
  )
}
