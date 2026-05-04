import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Upload,
  message,
} from 'antd'
import {
  DeleteOutlined,
  DownloadOutlined,
  ExportOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '../services/project'
import { sampleApi } from '../services/sample'
import {
  downloadFile,
  formatSampleLabel,
  formatSamplePrimary,
  formatSampleSecondary,
} from '../utils/helpers'

const { Dragger } = Upload

export default function Samples() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 })
  const [filters, setFilters] = useState({ project_id: null })
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [importResult, setImportResult] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['samples', pagination, filters],
    queryFn: () =>
      sampleApi.getList({
        page: pagination.current,
        page_size: pagination.pageSize,
        ...filters,
      }),
  })

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.getList({ page_size: 100 }),
  })

  const batchDeleteMutation = useMutation({
    mutationFn: sampleApi.batchDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] })
      queryClient.invalidateQueries({ queryKey: ['experiments'] })
      message.success('批量删除成功')
      setSelectedRowKeys([])
    },
    onError: (error) => {
      message.error(error.message || '删除失败')
    },
  })

  const samplesResponse = data?.data || data
  const samples = Array.isArray(samplesResponse?.results) ? samplesResponse.results : []
  const total = samplesResponse?.count || 0
  const projectsResponse = projectsData?.data || projectsData
  const projects = Array.isArray(projectsResponse?.results) ? projectsResponse.results : []

  const handleExport = async () => {
    try {
      const response = await sampleApi.export(filters)
      downloadFile(response, 'samples.xlsx')
      message.success('导出成功')
    } catch (error) {
      message.error(error.message || '导出失败')
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const response = await sampleApi.downloadTemplate()
      downloadFile(response, 'sample_import_template.xlsx')
      message.success('模板下载成功')
    } catch (error) {
      message.error(error.message || '模板下载失败')
    }
  }

  const handleImport = async (file) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await sampleApi.batchImport(formData)
      const result = response.data || response
      setImportResult(result)
      queryClient.invalidateQueries({ queryKey: ['samples'] })
      queryClient.invalidateQueries({ queryKey: ['experiments'] })
      if (result.error_count > 0) {
        message.warning(`导入完成，成功 ${result.created_count} 个，失败 ${result.error_count} 个`)
      } else {
        message.success(`成功导入 ${result.created_count} 个样品`)
      }
    } catch (error) {
      message.error(error.message || '导入失败')
      setImportResult({
        created_count: 0,
        error_count: 1,
        errors: [{ row: '-', message: error.message || '导入失败' }],
      })
    }
    return false
  }

  const columns = [
    {
      title: '主标识',
      dataIndex: 'primary_label',
      key: 'primary_label',
      render: (_, record) => (
        <a onClick={() => navigate(`/samples/${record.sample_id}`)}>
          {formatSamplePrimary(record) || record.sample_id}
        </a>
      ),
    },
    {
      title: '辅助信息',
      dataIndex: 'secondary_label',
      key: 'secondary_label',
      render: (_, record) => (
        <div>
          <div>{formatSampleSecondary(record) || record.sample_id}</div>
          <div style={{ color: '#8c8c8c', fontSize: 12 }}>{record.sample_type_name || '-'}</div>
        </div>
      ),
    },
    {
      title: '所属项目',
      dataIndex: 'project_name',
      key: 'project_name',
    },
    {
      title: '所属实验',
      dataIndex: 'experiment_name',
      key: 'experiment_name',
    },
    {
      title: '合成日期',
      dataIndex: 'synthesis_date',
      key: 'synthesis_date',
      render: (value) => value || '-',
    },
    {
      title: '已测类型',
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

  return (
    <div className="samples-page">
      <div className="page-header">
        <h2>样品管理</h2>
        <Space wrap>
          {selectedRowKeys.length > 0 && (
            <Popconfirm
              title={`确定删除选中的 ${selectedRowKeys.length} 个样品吗？`}
              onConfirm={() => batchDeleteMutation.mutate(selectedRowKeys)}
              okText="删除"
              cancelText="取消"
            >
              <Button danger icon={<DeleteOutlined />}>
                批量删除 ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
          )}
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
            下载模板
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>
            批量导入
          </Button>
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            导出 Excel
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/samples/add')}>
            添加样品
          </Button>
        </Space>
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder="筛选项目"
            allowClear
            style={{ width: 220 }}
            value={filters.project_id}
            onChange={(projectId) => setFilters((prev) => ({ ...prev, project_id: projectId || null }))}
            options={projects.map((project) => ({ value: project.id, label: project.name }))}
          />
        </Space>

        <Table
          columns={columns}
          dataSource={samples}
          rowKey="sample_id"
          loading={isLoading}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
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

      <Modal
        title="批量导入样品"
        open={importModalVisible}
        onCancel={() => {
          setImportModalVisible(false)
          setImportResult(null)
        }}
        footer={null}
        width={680}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="模板中支持“显示代号”列"
          description="建议把常用短编号填在显示代号里，例如 A1、S2、Ring-03，系统编号仍会自动生成。"
        />

        <Dragger
          name="file"
          multiple={false}
          accept=".xlsx,.xls"
          beforeUpload={handleImport}
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽 Excel 文件到这里上传</p>
          <p className="ant-upload-hint">支持 .xlsx 和 .xls</p>
        </Dragger>

        {importResult && (
          <div style={{ marginTop: 16 }}>
            <Alert
              type={importResult.error_count > 0 ? 'warning' : 'success'}
              showIcon
              style={{ marginBottom: 12 }}
              message={
                importResult.error_count > 0
                  ? `导入完成：成功 ${importResult.created_count} 个，失败 ${importResult.error_count} 个`
                  : `成功导入 ${importResult.created_count} 个样品`
              }
            />

            {Array.isArray(importResult.samples) && importResult.samples.length > 0 && (
              <Card size="small" title="已创建样品" style={{ marginBottom: 12 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {importResult.samples.slice(0, 8).map((sample) => (
                    <div key={sample.sample_id}>{formatSampleLabel(sample)}</div>
                  ))}
                </Space>
              </Card>
            )}

            {importResult.errors?.map((error, index) => (
              <Alert
                key={`${error.row}-${index}`}
                type="error"
                showIcon
                style={{ marginBottom: 8 }}
                message={`第 ${error.row} 行：${error.message}`}
              />
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
