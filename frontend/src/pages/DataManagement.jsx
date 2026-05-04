import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  Checkbox,
  Collapse,
  Divider,
  Input,
  Modal,
  Popconfirm,
  Progress,
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
  DeleteOutlined,
  DownloadOutlined,
  DownOutlined,
  EyeOutlined,
  PlusOutlined,
  RightOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '../services/project'
import { sampleApi } from '../services/sample'
import { testApi } from '../services/test'
import { formatSampleLabel, formatSamplePrimary, formatSampleSecondary } from '../utils/helpers'

const { Panel } = Collapse
const { Option } = Select
const { Dragger } = Upload
const { Text } = Typography

function normalizeResponseList(response) {
  return response?.results || response?.data?.results || response?.data || []
}

function buildFileKey(file, index) {
  return `${index}__${file.name}__${file.size}__${file.lastModified || 0}`
}

function findSampleIdFromName(fileName, sampleIds) {
  const normalizedName = fileName.toLowerCase()
  const matches = sampleIds
    .filter((sampleId) => normalizedName.includes(String(sampleId).toLowerCase()))
    .sort((a, b) => String(b).length - String(a).length)

  return matches[0] || null
}

function findTestTypeFromName(fileName, testTypes) {
  const normalizedName = fileName.toLowerCase()
  const matches = testTypes
    .filter((type) => normalizedName.includes(String(type.name).toLowerCase()))
    .sort((a, b) => String(b.name).length - String(a.name).length)

  return matches[0] || null
}

export default function DataManagement() {
  const queryClient = useQueryClient()
  const [selectedSamples, setSelectedSamples] = useState(new Set())
  const [selectedTestDataIds, setSelectedTestDataIds] = useState([])
  const [expandedSamples, setExpandedSamples] = useState(new Set())
  const [selectedTestTypes, setSelectedTestTypes] = useState([])
  const [newTestTypeName, setNewTestTypeName] = useState('')
  const [showNewTestType, setShowNewTestType] = useState(false)
  const [packageModalVisible, setPackageModalVisible] = useState(false)
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [bulkFiles, setBulkFiles] = useState([])
  const [bulkRows, setBulkRows] = useState([])
  const [uploadMode, setUploadMode] = useState('direct')
  const [uploadPackageFileList, setUploadPackageFileList] = useState([])

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.getList({ page_size: 100 }),
  })

  const { data: testTypesData, isLoading: testTypesLoading } = useQuery({
    queryKey: ['testTypes'],
    queryFn: () => testApi.getTypeList({ page_size: 100 }),
  })

  const projects = normalizeResponseList(projectsData)
  const testTypes = normalizeResponseList(testTypesData)

  const allExperimentIds = useMemo(() => {
    const ids = []
    projects.forEach((project) => {
      ;(project.experiments || []).forEach((exp) => {
        ids.push(exp.id)
      })
    })
    return ids
  }, [projects])

  const { data: allSamplesData } = useQuery({
    queryKey: ['samples_by_experiment', allExperimentIds],
    queryFn: async () => {
      const results = {}
      await Promise.all(
        allExperimentIds.map(async (expId) => {
          const response = await sampleApi.getList({ experiment: expId, page_size: 500 })
          results[expId] = normalizeResponseList(response)
        })
      )
      return results
    },
    enabled: allExperimentIds.length > 0,
  })

  const sampleList = useMemo(() => {
    const values = Object.values(allSamplesData || {})
    return values.flatMap((samples) => samples)
  }, [allSamplesData])

  const sampleMap = useMemo(() => {
    const map = new Map()
    sampleList.forEach((sample) => {
      map.set(sample.sample_id, sample)
    })
    return map
  }, [sampleList])

  const allSampleIds = useMemo(() => sampleList.map((sample) => sample.sample_id), [sampleList])

  const { data: allTestData } = useQuery({
    queryKey: ['testData_by_samples', allSampleIds],
    queryFn: async () => {
      const results = {}
      if (allSampleIds.length === 0) return results
      const response = await testApi.getDataList({ page_size: 1000 })
      const dataList = normalizeResponseList(response)
      dataList.forEach((td) => {
        const sid = td.sample_id || td.sample?.sample_id
        if (!sid) return
        if (!results[sid]) results[sid] = []
        results[sid].push(td)
      })
      return results
    },
    enabled: allSampleIds.length > 0,
  })

  const handleSampleToggle = (sampleId) => {
    const next = new Set(selectedSamples)
    if (next.has(sampleId)) next.delete(sampleId)
    else next.add(sampleId)
    setSelectedSamples(next)
  }

  const handleTestDataToggle = (testDataId) => {
    setSelectedTestDataIds((prev) =>
      prev.includes(testDataId) ? prev.filter((id) => id !== testDataId) : [...prev, testDataId]
    )
  }

  const handleSampleExpand = (sampleId) => {
    const next = new Set(expandedSamples)
    if (next.has(sampleId)) next.delete(sampleId)
    else next.add(sampleId)
    setExpandedSamples(next)
  }

  const handleSelectAllTestData = (sampleId) => {
    const sampleData = allTestData?.[sampleId] || []
    const sampleDataIds = sampleData.map((td) => td.id)
    const allSelected = sampleDataIds.every((id) => selectedTestDataIds.includes(id))

    setSelectedTestDataIds((prev) => {
      if (allSelected) {
        return prev.filter((id) => !sampleDataIds.includes(id))
      }
      const others = prev.filter((id) => !sampleDataIds.includes(id))
      return [...others, ...sampleDataIds]
    })
  }

  const handleCreateTestType = async () => {
    const trimmedName = newTestTypeName.trim()
    if (!trimmedName) {
      message.warning('请输入测试类型名称')
      return
    }

    let projectId = null
    for (const project of projects) {
      for (const exp of project.experiments || []) {
        const samples = allSamplesData?.[exp.id] || []
        if (samples.some((sample) => selectedSamples.has(sample.sample_id))) {
          projectId = project.id
          break
        }
      }
      if (projectId) break
    }

    if (!projectId) {
      projectId = projects[0]?.id
    }

    if (!projectId) {
      message.warning('请先创建项目')
      return
    }

    try {
      await testApi.createType({ name: trimmedName, project: projectId })
      message.success('测试类型创建成功')
      queryClient.invalidateQueries({ queryKey: ['testTypes'] })
      setNewTestTypeName('')
      setShowNewTestType(false)
    } catch (error) {
      message.error(error.message || '创建失败')
    }
  }

  const handleGenerateDataPackage = () => {
    if (selectedSamples.size === 0) {
      message.warning('请至少选择一个样品')
      return
    }
    setPackageModalVisible(true)
  }

  const handleDownloadPackage = async () => {
    if (selectedTestTypes.length === 0) {
      message.warning('请至少选择一个测试类型')
      return
    }

    setDownloading(true)
    try {
      const response = await testApi.generateDataPackage({
        sample_ids: Array.from(selectedSamples),
        test_type_ids: selectedTestTypes,
      })

      const blob = new Blob([response], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `data-package-${Date.now()}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      message.success('标准数据包已生成并开始下载')
      setPackageModalVisible(false)
      setSelectedTestTypes([])
    } catch (error) {
      message.error(error.message || '下载失败')
    } finally {
      setDownloading(false)
    }
  }

  const handleBatchDelete = async () => {
    if (selectedTestDataIds.length === 0) {
      message.warning('请选择要删除的测试数据')
      return
    }

    setDeleting(true)
    try {
      await Promise.all(selectedTestDataIds.map((id) => testApi.deleteData(id)))
      message.success(`成功删除 ${selectedTestDataIds.length} 条测试数据`)
      setSelectedTestDataIds([])
      queryClient.invalidateQueries({ queryKey: ['testData_by_samples'] })
      queryClient.invalidateQueries({ queryKey: ['testData'] })
    } catch (error) {
      message.error(error.message || '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  const handleDownloadTestData = async (testDataId) => {
    try {
      const response = await testApi.downloadTestData(testDataId)
      const blob = new Blob([response], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `test-data-${testDataId}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      message.success('下载成功')
    } catch (error) {
      message.error(error.message || '下载失败')
    }
  }

  const deleteTestDataMutation = useMutation({
    mutationFn: (testDataId) => testApi.deleteData(testDataId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testData_by_samples'] })
      queryClient.invalidateQueries({ queryKey: ['testData'] })
      message.success('删除成功')
    },
    onError: (error) => {
      message.error(error.message || '删除失败')
    },
  })

  const handleDeleteTestData = (testDataId) => {
    deleteTestDataMutation.mutate(testDataId)
  }

  const resetUploadWizard = () => {
    setBulkFiles([])
    setBulkRows([])
    setUploadPackageFileList([])
    setUploadProgress(0)
    setUploading(false)
  }

  const buildBulkRows = (files) => {
    const rows = files.map((wrapper, index) => {
      const rawFile = wrapper.originFileObj || wrapper
      const fileKey = buildFileKey(rawFile, index)
      const matchedSampleId = findSampleIdFromName(rawFile.name, allSampleIds)
      const sample = matchedSampleId ? sampleMap.get(matchedSampleId) : null
      const projectId = sample?.project_id ?? null
      const availableTypes = testTypes.filter((type) => !projectId || type.project === projectId)
      const matchedType = findTestTypeFromName(rawFile.name, availableTypes)

      return {
        key: fileKey,
        fileKey,
        file: rawFile,
        fileName: rawFile.name,
        size: rawFile.size,
        sampleId: matchedSampleId || undefined,
        projectId,
        experimentName: sample?.experiment_name || '',
        matchedBy: matchedSampleId || matchedType ? '自动识别' : '待手动确认',
        testTypeId: matchedType?.id,
        testTypeName: matchedType?.name || '',
      }
    })
    setBulkRows(rows)
    setBulkFiles(files)
  }

  const handleBulkRowChange = (fileKey, field, value) => {
    setBulkRows((prev) =>
      prev.map((row) => {
        if (row.fileKey !== fileKey) return row

        if (field === 'sampleId') {
          const sample = sampleMap.get(value)
          return {
            ...row,
            sampleId: value,
            projectId: sample?.project_id ?? null,
            experimentName: sample?.experiment_name || '',
            testTypeId: undefined,
            testTypeName: '',
            matchedBy: '手动修正',
          }
        }

        if (field === 'testTypeId') {
          const selectedType = testTypes.find((type) => type.id === value)
          return {
            ...row,
            testTypeId: value,
            testTypeName: selectedType?.name || '',
            matchedBy: '手动修正',
          }
        }

        if (field === 'testTypeName') {
          return {
            ...row,
            testTypeName: value,
            matchedBy: '手动修正',
          }
        }

        return {
          ...row,
          [field]: value,
          matchedBy: '手动修正',
        }
      })
    )
  }

  const directUploadReadyCount = useMemo(
    () => bulkRows.filter((row) => row.sampleId && (row.testTypeId || row.testTypeName?.trim())).length,
    [bulkRows]
  )

  const directUploadInvalidCount = useMemo(
    () => bulkRows.filter((row) => !row.sampleId || !(row.testTypeId || row.testTypeName?.trim())).length,
    [bulkRows]
  )

  const handleSubmitDirectUpload = async () => {
    if (bulkRows.length === 0) {
      message.warning('请先选择要上传的文件')
      return
    }

    const invalidRow = bulkRows.find((row) => !row.sampleId || !(row.testTypeId || row.testTypeName?.trim()))
    if (invalidRow) {
      message.warning('还有文件未完成样品或测试类型确认')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    try {
      const formData = new FormData()
      const items = bulkRows.map((row) => ({
        file_key: row.fileKey,
        sample_id: row.sampleId,
        test_type_id: row.testTypeId ?? null,
        test_type_name: row.testTypeName?.trim() || '',
        instrument: row.instrument || '',
        tester: row.tester || '',
        notes: row.notes || '',
      }))

      formData.append('items', JSON.stringify(items))
      bulkRows.forEach((row) => {
        formData.append('files', row.file)
        formData.append('file_keys', row.fileKey)
      })

      const result = await testApi.batchUploadData(formData, {
        onUploadProgress: (event) => {
          if (!event.total) return
          setUploadProgress(Math.round((event.loaded * 100) / event.total))
        },
      })

      const payload = result?.data || result
      message.success(`成功导入 ${payload.created_count || 0} 条测试数据`)
      if (payload.error_count > 0) {
        message.warning(`有 ${payload.error_count} 条文件未成功导入`)
      }

      queryClient.invalidateQueries({ queryKey: ['testData_by_samples'] })
      queryClient.invalidateQueries({ queryKey: ['testData'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      resetUploadWizard()
      setUploadModalVisible(false)
    } catch (error) {
      message.error(error.message || '批量上传失败')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleSubmitZipUpload = async () => {
    if (uploadPackageFileList.length === 0) {
      message.warning('请先选择 zip 数据包')
      return
    }

    const file = uploadPackageFileList[0]?.originFileObj || uploadPackageFileList[0]
    if (!file?.name?.endsWith('.zip')) {
      message.warning('请上传 zip 格式的数据包')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const result = await testApi.uploadDataPackage(formData, {
        onUploadProgress: (event) => {
          if (!event.total) return
          setUploadProgress(Math.round((event.loaded * 100) / event.total))
        },
      })

      const payload = result?.data || result
      if (payload.created_count > 0) {
        message.success(`成功上传 ${payload.created_count} 条测试数据`)
      } else if (payload.errors?.length) {
        message.warning(payload.errors.join('；'))
      } else {
        message.warning('没有找到可导入的测试数据，请检查压缩包结构')
      }

      queryClient.invalidateQueries({ queryKey: ['testData_by_samples'] })
      queryClient.invalidateQueries({ queryKey: ['testData'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      resetUploadWizard()
      setUploadModalVisible(false)
    } catch (error) {
      message.error(error.message || '上传失败')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const directUploadProps = {
    multiple: true,
    beforeUpload: () => false,
    fileList: bulkFiles,
    onChange: ({ fileList }) => buildBulkRows(fileList),
  }

  const zipUploadProps = {
    multiple: false,
    beforeUpload: (file) => {
      if (!file.name.endsWith('.zip')) {
        message.error('请上传 zip 格式的数据包')
        return Upload.LIST_IGNORE
      }
      return false
    },
    fileList: uploadPackageFileList,
    onChange: ({ fileList }) => setUploadPackageFileList(fileList.slice(-1)),
  }

  const renderTestDataTable = (sampleId) => {
    const sampleData = allTestData?.[sampleId] || []
    if (sampleData.length === 0) {
      return <p style={{ color: '#999', fontSize: 12, padding: '4px 0' }}>暂无测试数据</p>
    }

    const sampleDataIds = sampleData.map((td) => td.id)
    const allSelected = sampleDataIds.length > 0 && sampleDataIds.every((id) => selectedTestDataIds.includes(id))

    const columns = [
      {
        title: (
          <Checkbox
            checked={allSelected}
            indeterminate={!allSelected && sampleDataIds.some((id) => selectedTestDataIds.includes(id))}
            onChange={() => handleSelectAllTestData(sampleId)}
          />
        ),
        key: 'select',
        width: 50,
        render: (_, record) => (
          <Checkbox
            checked={selectedTestDataIds.includes(record.id)}
            onChange={() => handleTestDataToggle(record.id)}
          />
        ),
      },
      {
        title: '测试类型',
        dataIndex: 'test_type_name',
        key: 'test_type_name',
        width: 140,
        render: (text) => <Tag color="blue">{text}</Tag>,
      },
      {
        title: '测试日期',
        dataIndex: 'test_date',
        key: 'test_date',
        width: 120,
      },
      {
        title: '文件数',
        dataIndex: 'file_count',
        key: 'file_count',
        width: 80,
        align: 'center',
      },
      {
        title: '操作',
        key: 'action',
        width: 140,
        align: 'center',
        render: (_, record) => (
          <Space size="small">
            <Link to={`/test-data/${record.id}`} title="查看详情">
              <Button type="link" size="small" icon={<EyeOutlined />} />
            </Link>
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownloadTestData(record.id)}
              title="下载"
            />
            <Popconfirm
              title="确定删除这条测试数据吗？关联文件也会一并删除。"
              onConfirm={() => handleDeleteTestData(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" danger size="small" icon={<DeleteOutlined />} title="删除" />
            </Popconfirm>
          </Space>
        ),
      },
    ]

    return (
      <Table
        columns={columns}
        dataSource={sampleData}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 800 }}
        style={{ marginTop: 8 }}
      />
    )
  }

  const renderSampleRow = (sample) => {
    const sampleData = allTestData?.[sample.sample_id] || []
    const isExpanded = expandedSamples.has(sample.sample_id)
    const dataCount = sampleData.length

    return (
      <div
        key={sample.sample_id}
        style={{
          padding: '12px 0',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            {dataCount > 0 && (
              <Button
                type="text"
                size="small"
                icon={isExpanded ? <DownOutlined /> : <RightOutlined />}
                onClick={() => handleSampleExpand(sample.sample_id)}
                style={{ padding: '0 4px', minWidth: 20 }}
              />
            )}
            <span style={{ fontWeight: 500 }}>
              {formatSamplePrimary(sample)}
            </span>
            <span style={{ color: '#8c8c8c', fontSize: 12 }}>
              {formatSampleSecondary(sample)}
            </span>
            <Tag color="geekblue" style={{ marginLeft: 4 }}>
              {dataCount} 条数据
            </Tag>
          </div>
          <Checkbox checked={selectedSamples.has(sample.sample_id)} onChange={() => handleSampleToggle(sample.sample_id)} />
        </div>
        {isExpanded && renderTestDataTable(sample.sample_id)}
      </div>
    )
  }

  const renderExperimentPanel = (experiment) => {
    const samples = allSamplesData?.[experiment.id] || []

    return (
      <Panel
        header={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{experiment.name}</span>
            <span style={{ fontSize: 12, color: '#666' }}>{samples.length} 个样品</span>
          </div>
        }
        key={experiment.id}
      >
        <div style={{ padding: '0 16px' }}>{samples.map((sample) => renderSampleRow(sample))}</div>
      </Panel>
    )
  }

  const uploadPreviewColumns = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      key: 'fileName',
      width: 240,
      ellipsis: true,
    },
    {
      title: '识别样品',
      dataIndex: 'sampleId',
      key: 'sampleId',
      width: 220,
      render: (value, record) => (
        <Select
          showSearch
          placeholder="选择样品"
          value={value}
          style={{ width: '100%' }}
          optionFilterProp="label"
          onChange={(nextValue) => handleBulkRowChange(record.fileKey, 'sampleId', nextValue)}
          options={sampleList.map((sample) => ({
            value: sample.sample_id,
            label: formatSampleLabel(sample),
          }))}
        />
      ),
    },
    {
      title: '测试类型',
      dataIndex: 'testTypeId',
      key: 'testTypeId',
      width: 220,
      render: (value, record) => {
        const availableTypes = testTypes.filter((type) => !record.projectId || type.project === record.projectId)
        return (
          <Select
            showSearch
            allowClear
            placeholder="选择测试类型"
            value={value}
            style={{ width: '100%' }}
            optionFilterProp="label"
            onChange={(nextValue) => handleBulkRowChange(record.fileKey, 'testTypeId', nextValue)}
            options={availableTypes.map((type) => ({
              value: type.id,
              label: type.name,
            }))}
          />
        )
      },
    },
    {
      title: '新测试类型',
      dataIndex: 'testTypeName',
      key: 'testTypeName',
      width: 180,
      render: (value, record) => (
        <Input
          placeholder="若下拉没有可直接填写"
          value={value}
          onChange={(event) => handleBulkRowChange(record.fileKey, 'testTypeName', event.target.value)}
        />
      ),
    },
    {
      title: '实验',
      dataIndex: 'experimentName',
      key: 'experimentName',
      width: 140,
      render: (value) => value || <Text type="secondary">待匹配</Text>,
    },
    {
      title: '状态',
      dataIndex: 'matchedBy',
      key: 'matchedBy',
      width: 120,
      render: (_, record) => {
        const ok = record.sampleId && (record.testTypeId || record.testTypeName?.trim())
        return <Tag color={ok ? 'green' : 'orange'}>{ok ? record.matchedBy : '待确认'}</Tag>
      },
    },
  ]

  if (projectsLoading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  }

  return (
    <div className="data-management-page">
      <div className="page-header">
        <h2>数据管理</h2>
        <Space wrap>
          <Popconfirm
            title="确定删除选中的测试数据吗？"
            onConfirm={handleBatchDelete}
            okText="确定"
            cancelText="取消"
            disabled={selectedTestDataIds.length === 0}
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              disabled={selectedTestDataIds.length === 0}
              loading={deleting}
            >
              批量删除{selectedTestDataIds.length > 0 ? ` (${selectedTestDataIds.length})` : ''}
            </Button>
          </Popconfirm>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => (window.location.href = '/test-data/add')}>
            添加测试数据
          </Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleGenerateDataPackage} disabled={selectedSamples.size === 0}>
            生成标准数据包
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => setUploadModalVisible(true)}>
            批量上传测试文件
          </Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={4}>
          <Text strong>推荐新流程</Text>
          <Text type="secondary">
            直接选择文件上传，系统会先自动识别样品和测试类型，再由你确认后导入。旧的 zip 数据包方式仍然保留在上传弹窗中。
          </Text>
        </Space>
      </Card>

      <div className="project-cards">
        {projects.map((project) => (
          <Card key={project.id} className="project-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <h3 style={{ margin: 0 }}>{project.name}</h3>
              <span style={{ fontSize: 12, color: '#666' }}>{project.experiments_count || 0} 个实验</span>
            </div>
            <Collapse defaultActiveKey={[]}>
              {(project.experiments || []).map((experiment) => renderExperimentPanel(experiment))}
            </Collapse>
          </Card>
        ))}
      </div>

      <Modal
        title="选择测试类型"
        open={packageModalVisible}
        onCancel={() => setPackageModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setPackageModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleDownloadPackage}
            loading={downloading}
            disabled={selectedTestTypes.length === 0}
          >
            下载标准数据包
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Select
            mode="multiple"
            placeholder="选择测试类型"
            style={{ width: '100%' }}
            value={selectedTestTypes}
            onChange={setSelectedTestTypes}
            loading={testTypesLoading}
          >
            {testTypes.map((type) => (
              <Option key={type.id} value={type.id}>
                {type.name}
              </Option>
            ))}
          </Select>
        </div>

        <div style={{ marginTop: 16 }}>
          {!showNewTestType ? (
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => setShowNewTestType(true)}>
              添加新测试类型
            </Button>
          ) : (
            <Space style={{ width: '100%' }}>
              <Input
                placeholder="新测试类型名称"
                value={newTestTypeName}
                onChange={(event) => setNewTestTypeName(event.target.value)}
                style={{ flex: 1 }}
              />
              <Button type="primary" onClick={handleCreateTestType}>
                创建
              </Button>
              <Button onClick={() => setShowNewTestType(false)}>取消</Button>
            </Space>
          )}
        </div>
      </Modal>

      <Modal
        title="批量上传测试文件"
        open={uploadModalVisible}
        onCancel={() => {
          setUploadModalVisible(false)
          resetUploadWizard()
        }}
        width={1200}
        footer={null}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Select value={uploadMode} onChange={setUploadMode} style={{ width: 240 }}>
            <Option value="direct">直接批量上传</Option>
            <Option value="zip">兼容 zip 数据包</Option>
          </Select>

          {uploadMode === 'direct' ? (
            <>
              <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
                <Space direction="vertical" size={4}>
                  <Text strong>建议命名方式</Text>
                  <Text type="secondary">文件名里尽量包含样品编号和测试类型，例如：`S001_XRD_raw.csv`。</Text>
                  <Text type="secondary">系统会自动识别，识别不准确时你也可以在下方预览表里手动修正。</Text>
                </Space>
              </Card>

              <Dragger {...directUploadProps}>
                <p className="ant-upload-drag-icon">
                  <UploadOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽多个文件到这里上传</p>
                <p className="ant-upload-hint">系统会先自动识别样品和测试类型，不会立刻入库。</p>
              </Dragger>

              {bulkRows.length > 0 && (
                <>
                  <Space wrap>
                    <Tag color="green">可直接导入 {directUploadReadyCount}</Tag>
                    <Tag color={directUploadInvalidCount > 0 ? 'orange' : 'blue'}>
                      待确认 {directUploadInvalidCount}
                    </Tag>
                  </Space>

                  <Table
                    rowKey="fileKey"
                    columns={uploadPreviewColumns}
                    dataSource={bulkRows}
                    size="small"
                    pagination={{ pageSize: 8 }}
                    scroll={{ x: 1200 }}
                  />
                </>
              )}
            </>
          ) : (
            <>
              <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
                <Space direction="vertical" size={4}>
                  <Text strong>兼容旧流程</Text>
                  <Text type="secondary">如果你已经按系统模板整理好了 zip 数据包，仍然可以在这里直接上传。</Text>
                </Space>
              </Card>

              <Dragger {...zipUploadProps}>
                <p className="ant-upload-drag-icon">
                  <UploadOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽 zip 数据包到这里上传</p>
                <p className="ant-upload-hint">仅支持标准数据包结构的 zip 文件。</p>
              </Dragger>
            </>
          )}

          {uploading && <Progress percent={uploadProgress} status="active" />}

          <Divider style={{ margin: '8px 0' }} />

          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button
              onClick={() => {
                setUploadModalVisible(false)
                resetUploadWizard()
              }}
            >
              取消
            </Button>
            {uploadMode === 'direct' ? (
              <Button type="primary" loading={uploading} onClick={handleSubmitDirectUpload}>
                确认导入
              </Button>
            ) : (
              <Button type="primary" loading={uploading} onClick={handleSubmitZipUpload}>
                上传数据包
              </Button>
            )}
          </Space>
        </Space>
      </Modal>
    </div>
  )
}
