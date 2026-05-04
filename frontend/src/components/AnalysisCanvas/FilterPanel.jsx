import { useEffect, useMemo } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Input,
  Modal,
  Segmented,
  Select,
  Spin,
  Switch,
  Tag,
  Tooltip,
  message,
} from 'antd'
import {
  AppstoreOutlined,
  BarChartOutlined,
  DotChartOutlined,
  ExperimentOutlined,
  LineChartOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { projectApi } from '../../services/project'
import { sampleApi } from '../../services/sample'
import { testApi } from '../../services/test'
import { analysisApi } from '../../services/analysis'
import useAnalysisCanvasStore from '../../store/analysisCanvas'
import { formatSamplePrimary, formatSampleSecondary } from '../../utils/helpers'

const chartTypeOptions = [
  { label: <LineChartOutlined />, value: 'line' },
  { label: <BarChartOutlined />, value: 'bar' },
  { label: <DotChartOutlined />, value: 'scatter' },
]

export default function FilterPanel({ onCreateChart }) {
  const cards = useAnalysisCanvasStore((state) => state.cards)
  const clearCards = useAnalysisCanvasStore((state) => state.clearCards)
  const builder = useAnalysisCanvasStore((state) => state.builder)
  const updateBuilder = useAnalysisCanvasStore((state) => state.updateBuilder)
  const resetBuilderForProject = useAnalysisCanvasStore((state) => state.resetBuilderForProject)
  const resetBuilderForExperiment = useAnalysisCanvasStore((state) => state.resetBuilderForExperiment)
  const resetSelectionForTestType = useAnalysisCanvasStore((state) => state.resetSelectionForTestType)
  const setSelectedSampleIds = useAnalysisCanvasStore((state) => state.setSelectedSampleIds)
  const toggleSelectedSampleId = useAnalysisCanvasStore((state) => state.toggleSelectedSampleId)
  const resetBuilderAfterCreate = useAnalysisCanvasStore((state) => state.resetBuilderAfterCreate)

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.getList({ page_size: 100 }),
  })

  const { data: experimentsData, isLoading: experimentsLoading } = useQuery({
    queryKey: ['experiments', builder.projectId],
    queryFn: () => sampleApi.getExperimentList({ project: builder.projectId, page_size: 200 }),
    enabled: !!builder.projectId,
  })

  const { data: samplesData, isLoading: samplesLoading } = useQuery({
    queryKey: ['samples', builder.experimentId],
    queryFn: () => sampleApi.getList({ experiment: builder.experimentId, page_size: 500 }),
    enabled: !!builder.experimentId,
  })

  const { data: testTypesData, isLoading: testTypesLoading } = useQuery({
    queryKey: ['testTypes', builder.projectId],
    queryFn: () => testApi.getTypeList({ project: builder.projectId, page_size: 100 }),
    enabled: !!builder.projectId,
  })

  const { data: projectTestDataResponse, isLoading: projectTestDataLoading } = useQuery({
    queryKey: ['testDataAvailability', builder.projectId],
    queryFn: () => testApi.getDataList({ project_id: builder.projectId, page_size: 5000 }),
    enabled: !!builder.projectId,
  })

  const { data: algorithmsData, isLoading: algorithmsLoading } = useQuery({
    queryKey: ['algorithms', builder.testTypeId],
    queryFn: () => analysisApi.getAlgorithmList({ test_type: builder.testTypeId, page_size: 100 }),
    enabled: !!builder.testTypeId,
  })

  const projects = projectsData?.results || projectsData?.data?.results || []
  const experiments = experimentsData?.results || experimentsData?.data?.results || []
  const samples = samplesData?.results || samplesData?.data?.results || []
  const projectTestTypes = testTypesData?.results || testTypesData?.data?.results || []
  const projectTestData = projectTestDataResponse?.results || projectTestDataResponse?.data?.results || []
  const algorithms = algorithmsData?.results || algorithmsData?.data?.results || []

  const experimentSampleIds = useMemo(
    () => new Set(samples.map((sample) => sample.sample_id)),
    [samples]
  )

  const experimentTestData = useMemo(
    () => projectTestData.filter((testData) => experimentSampleIds.has(testData.sample_id)),
    [projectTestData, experimentSampleIds]
  )

  const sampleAvailabilityMap = useMemo(() => {
    const availability = new Map()
    samples.forEach((sample) => {
      availability.set(sample.sample_id, new Set())
    })

    experimentTestData.forEach((testData) => {
      if (!availability.has(testData.sample_id)) {
        availability.set(testData.sample_id, new Set())
      }
      availability.get(testData.sample_id).add(testData.test_type)
    })

    return availability
  }, [samples, experimentTestData])

  const availableTestTypeIds = useMemo(
    () => new Set(experimentTestData.map((testData) => testData.test_type)),
    [experimentTestData]
  )

  const experimentTestTypes = useMemo(
    () => projectTestTypes.filter((testType) => availableTestTypeIds.has(testType.id)),
    [projectTestTypes, availableTestTypeIds]
  )

  const availableSampleIdsForSelectedType = useMemo(() => {
    if (!builder.testTypeId) return []
    return samples
      .filter((sample) => sampleAvailabilityMap.get(sample.sample_id)?.has(builder.testTypeId))
      .map((sample) => sample.sample_id)
  }, [builder.testTypeId, sampleAvailabilityMap, samples])

  const filteredSamples = useMemo(() => {
    const search = builder.sampleSearch.trim().toLowerCase()

    return samples.filter((sample) => {
      const hasSelectedType = !builder.testTypeId
        || sampleAvailabilityMap.get(sample.sample_id)?.has(builder.testTypeId)

      if (builder.testTypeId && builder.onlyShowAvailableSamples && !hasSelectedType) {
        return false
      }

      if (!search) return true

      const haystack = `${sample.sample_id} ${sample.display_code || ''} ${sample.name || ''} ${sample.sample_type_name || ''}`.toLowerCase()
      return haystack.includes(search)
    })
  }, [
    builder.onlyShowAvailableSamples,
    builder.sampleSearch,
    builder.testTypeId,
    sampleAvailabilityMap,
    samples,
  ])

  const visibleSelectableSampleIds = useMemo(
    () => filteredSamples
      .filter((sample) => !builder.testTypeId || sampleAvailabilityMap.get(sample.sample_id)?.has(builder.testTypeId))
      .map((sample) => sample.sample_id),
    [builder.testTypeId, filteredSamples, sampleAvailabilityMap]
  )

  const selectedExperiment = experiments.find((experiment) => experiment.id === builder.experimentId)
  const selectedTestType = experimentTestTypes.find((testType) => testType.id === builder.testTypeId)
  const selectedAlgorithm = algorithms.find((algorithm) => algorithm.id === builder.algorithmId)

  useEffect(() => {
    if (!builder.projectId || builder.projectName || projects.length === 0) return
    const matchedProject = projects.find((project) => project.id === builder.projectId)
    if (matchedProject) {
      updateBuilder({ projectName: matchedProject.name })
    }
  }, [builder.projectId, builder.projectName, projects, updateBuilder])

  useEffect(() => {
    if (!builder.experimentId || builder.experimentName || experiments.length === 0) return
    if (selectedExperiment) {
      updateBuilder({ experimentName: selectedExperiment.name })
    }
  }, [builder.experimentId, builder.experimentName, experiments.length, selectedExperiment, updateBuilder])

  useEffect(() => {
    if (!builder.testTypeId || builder.testTypeName || experimentTestTypes.length === 0) return
    if (selectedTestType) {
      updateBuilder({ testTypeName: selectedTestType.name })
    }
  }, [builder.testTypeId, builder.testTypeName, experimentTestTypes.length, selectedTestType, updateBuilder])

  useEffect(() => {
    if (!builder.algorithmId || builder.algorithmName || algorithms.length === 0) return
    if (selectedAlgorithm) {
      updateBuilder({ algorithmName: selectedAlgorithm.name })
    }
  }, [algorithms.length, builder.algorithmId, builder.algorithmName, selectedAlgorithm, updateBuilder])

  const confirmCanvasReset = (title, content, onConfirm) => {
    if (cards.length === 0) {
      onConfirm()
      return
    }

    Modal.confirm({
      title,
      content,
      okText: '切换并清空',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        clearCards()
        onConfirm()
      },
    })
  }

  const handleProjectChange = (nextProjectId) => {
    const nextProject = projects.find((project) => project.id === nextProjectId)
    const applyChange = () => {
      resetBuilderForProject(nextProjectId || null, nextProject?.name || '')
    }

    if (builder.projectId && builder.projectId !== nextProjectId) {
      confirmCanvasReset(
        '切换项目？',
        `当前画布中已有 ${cards.length} 张图表。切换到新项目后将开始新的分析上下文。`,
        applyChange
      )
      return
    }

    applyChange()
  }

  const handleExperimentChange = (nextExperimentId) => {
    const nextExperiment = experiments.find((experiment) => experiment.id === nextExperimentId)
    const applyChange = () => {
      resetBuilderForExperiment({
        experimentId: nextExperimentId || null,
        experimentName: nextExperiment?.name || '',
      })
    }

    if (builder.experimentId && builder.experimentId !== nextExperimentId && cards.length > 0) {
      confirmCanvasReset(
        '切换实验？',
        `当前画布中的图表属于实验“${builder.experimentName || '当前实验'}”。切换实验后将清空这些图表。`,
        applyChange
      )
      return
    }

    applyChange()
  }

  const handleTestTypeChange = (nextTestTypeId) => {
    const nextTestType = experimentTestTypes.find((testType) => testType.id === nextTestTypeId)
    resetSelectionForTestType({
      testTypeId: nextTestTypeId || null,
      testTypeName: nextTestType?.name || '',
    })
  }

  const handleAlgorithmChange = (nextAlgorithmId) => {
    const nextAlgorithm = algorithms.find((algorithm) => algorithm.id === nextAlgorithmId)
    updateBuilder({
      algorithmId: nextAlgorithmId || null,
      algorithmName: nextAlgorithm?.name || '',
    })
  }

  const handleSelectAllAvailable = () => {
    if (visibleSelectableSampleIds.length === 0) return

    const alreadyAllSelected = visibleSelectableSampleIds.every((sampleId) =>
      builder.selectedSampleIds.includes(sampleId)
    )

    if (alreadyAllSelected) {
      setSelectedSampleIds(
        builder.selectedSampleIds.filter((sampleId) => !visibleSelectableSampleIds.includes(sampleId))
      )
      return
    }

    setSelectedSampleIds(Array.from(new Set([
      ...builder.selectedSampleIds,
      ...visibleSelectableSampleIds,
    ])))
  }

  const handleCreate = () => {
    if (!builder.projectId) {
      message.warning('请先选择项目')
      return
    }

    if (!builder.experimentId) {
      message.warning('请先选择实验')
      return
    }

    if (!builder.testTypeId) {
      message.warning('请选择测试类型')
      return
    }

    if (builder.selectedSampleIds.length < 2) {
      message.warning('至少选择 2 个样品才能创建对比图')
      return
    }

    const selectedSamples = samples.filter((sample) => builder.selectedSampleIds.includes(sample.sample_id))
    const sampleLabels = selectedSamples.map((sample) => sample.primary_label || sample.display_code || sample.name || sample.sample_id)
    const title = builder.titleDraft.trim()
      || `${builder.experimentName || '实验'} - ${builder.testTypeName || '测试'} - ${builder.selectedSampleIds.length}样品对比`

    onCreateChart({
      title,
      config: {
        projectId: builder.projectId,
        projectName: builder.projectName,
        experimentId: builder.experimentId,
        experimentName: builder.experimentName,
        testTypeId: builder.testTypeId,
        testTypeName: builder.testTypeName,
        algorithmId: builder.algorithmId,
        algorithmName: selectedAlgorithm?.name || builder.algorithmName || '',
        chartType: builder.chartType,
        sampleIds: builder.selectedSampleIds,
        sampleLabels,
      },
    })

    resetBuilderAfterCreate()
  }

  const availableSampleCount = builder.testTypeId
    ? availableSampleIdsForSelectedType.length
    : samples.length

  const selectedCountLabel = `${builder.selectedSampleIds.length} / ${availableSampleCount}`
  const isSelectionReady = !!builder.experimentId && !!builder.testTypeId

  return (
    <div className="filter-panel">
      <div className="analysis-panel-section">
        <div className="analysis-panel-heading">
          <span>分析范围</span>
          <Tag bordered={false} color="blue">
            单实验工作台
          </Tag>
        </div>

        <div className="filter-section">
          <label className="filter-label">项目</label>
          <Select
            placeholder="选择项目"
            style={{ width: '100%' }}
            value={builder.projectId}
            onChange={handleProjectChange}
            loading={projectsLoading}
            allowClear
          >
            {projects.map((project) => (
              <Select.Option key={project.id} value={project.id}>
                {project.name}
              </Select.Option>
            ))}
          </Select>
        </div>

        <div className="filter-section">
          <label className="filter-label">实验</label>
          <Select
            placeholder={builder.projectId ? '选择实验' : '请先选择项目'}
            style={{ width: '100%' }}
            value={builder.experimentId}
            onChange={handleExperimentChange}
            loading={experimentsLoading}
            disabled={!builder.projectId}
            allowClear
          >
            {experiments.map((experiment) => (
              <Select.Option key={experiment.id} value={experiment.id}>
                {experiment.name} ({experiment.sample_count || 0})
              </Select.Option>
            ))}
          </Select>
        </div>

        <div className="context-summary-card">
          <div className="context-summary-item">
            <span className="context-summary-label">当前项目</span>
            <strong>{builder.projectName || '未选择'}</strong>
          </div>
          <div className="context-summary-item">
            <span className="context-summary-label">当前实验</span>
            <strong>{builder.experimentName || '未选择'}</strong>
          </div>
          <div className="context-summary-meta">
            <Tag icon={<ExperimentOutlined />} bordered={false}>
              样品 {selectedExperiment?.sample_count || samples.length || 0}
            </Tag>
            <Tag icon={<AppstoreOutlined />} bordered={false}>
              测试类型 {experimentTestTypes.length}
            </Tag>
          </div>
        </div>
      </div>

      <div className="analysis-panel-section">
        <div className="analysis-panel-heading">
          <span>图表配置</span>
        </div>

        <div className="filter-section">
          <label className="filter-label">测试类型</label>
          <Select
            placeholder={builder.experimentId ? '选择测试类型' : '请先选择实验'}
            style={{ width: '100%' }}
            value={builder.testTypeId}
            onChange={handleTestTypeChange}
            loading={testTypesLoading || projectTestDataLoading}
            disabled={!builder.experimentId}
            allowClear
          >
            {experimentTestTypes.map((testType) => (
              <Select.Option key={testType.id} value={testType.id}>
                {testType.name}
              </Select.Option>
            ))}
          </Select>
          {builder.experimentId && experimentTestTypes.length === 0 && !(testTypesLoading || projectTestDataLoading) && (
            <div className="inline-helper">当前实验下还没有可用于对比的测试类型数据。</div>
          )}
        </div>

        <div className="filter-section">
          <label className="filter-label">算法（可选）</label>
          <Select
            placeholder={builder.testTypeId ? '选择算法' : '默认算法'}
            style={{ width: '100%' }}
            value={builder.algorithmId}
            onChange={handleAlgorithmChange}
            disabled={!builder.testTypeId}
            loading={algorithmsLoading}
            allowClear
          >
            {algorithms.map((algorithm) => (
              <Select.Option key={algorithm.id} value={algorithm.id}>
                {algorithm.name} {!algorithm.is_active && '(未启用)'}
              </Select.Option>
            ))}
          </Select>
        </div>

        <div className="filter-section">
          <label className="filter-label">图表类型</label>
          <Segmented
            block
            options={chartTypeOptions}
            value={builder.chartType}
            onChange={(chartType) => updateBuilder({ chartType })}
          />
        </div>

        <div className="filter-section">
          <label className="filter-label">图表标题</label>
          <Input
            placeholder={selectedTestType ? `${selectedTestType.name} - 多样品对比` : '可选，自定义图表标题'}
            value={builder.titleDraft}
            onChange={(event) => updateBuilder({ titleDraft: event.target.value })}
          />
        </div>
      </div>

      <div className="analysis-panel-section">
        <div className="analysis-panel-heading">
          <span>样品选择</span>
          <Tag color={builder.selectedSampleIds.length >= 2 ? 'green' : 'default'}>
            已选 {selectedCountLabel}
          </Tag>
        </div>

        <Alert
          type="info"
          showIcon
          className="selection-tip"
          message={builder.testTypeId
            ? '当前样品列表会按测试类型标出可比较样品。'
            : '先选择测试类型，再快速筛出真正有数据的样品。'}
        />

        <div className="sample-toolbar">
          <Input
            placeholder="搜索样品编号、名称或类型"
            prefix={<SearchOutlined />}
            value={builder.sampleSearch}
            onChange={(event) => updateBuilder({ sampleSearch: event.target.value })}
            disabled={!builder.experimentId}
            allowClear
          />
          <div className="sample-toolbar-actions">
            <div className="sample-availability-switch">
              <span>仅显示可用样品</span>
              <Switch
                size="small"
                checked={builder.onlyShowAvailableSamples}
                disabled={!builder.testTypeId}
                onChange={(onlyShowAvailableSamples) => updateBuilder({ onlyShowAvailableSamples })}
              />
            </div>
            <div className="sample-toolbar-links">
              <Button
                type="link"
                size="small"
                onClick={handleSelectAllAvailable}
                disabled={!isSelectionReady || visibleSelectableSampleIds.length === 0}
              >
                全选可用
              </Button>
              <Button
                type="link"
                size="small"
                onClick={() => setSelectedSampleIds([])}
                disabled={builder.selectedSampleIds.length === 0}
              >
                清空
              </Button>
            </div>
          </div>
        </div>

        <div className="sample-list">
          {samplesLoading || projectTestDataLoading ? (
            <div className="sample-list-loading">
              <Spin size="small" />
            </div>
          ) : !builder.experimentId ? (
            <Empty description="请先选择实验" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : filteredSamples.length === 0 ? (
            <Empty
              description={builder.testTypeId ? '当前筛选条件下没有可显示的样品' : '该实验下暂无样品'}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            filteredSamples.map((sample) => {
              const hasSelectedType = !builder.testTypeId
                || sampleAvailabilityMap.get(sample.sample_id)?.has(builder.testTypeId)
              const disabled = !!builder.testTypeId && !hasSelectedType

              return (
                <div
                  key={sample.sample_id}
                  className={`sample-item ${disabled ? 'sample-item-disabled' : ''}`}
                >
                  <Checkbox
                    checked={builder.selectedSampleIds.includes(sample.sample_id)}
                    disabled={disabled}
                    onChange={() => toggleSelectedSampleId(sample.sample_id)}
                  >
                    <div className="sample-item-content">
                      <div className="sample-item-header">
                        <span className="sample-id">{formatSamplePrimary(sample)}</span>
                        <div className="sample-item-tags">
                          {sample.sample_type_name && <Tag>{sample.sample_type_name}</Tag>}
                          {builder.testTypeId && (
                            <Tag color={hasSelectedType ? 'green' : 'default'}>
                              {hasSelectedType ? '可比较' : '无数据'}
                            </Tag>
                          )}
                        </div>
                      </div>
                      <div className="sample-item-meta">
                        <span className="sample-name">{formatSampleSecondary(sample)}</span>
                        <Tooltip title={sample.test_types?.join('、') || '暂无测试数据'}>
                          <span className="sample-test-hint">
                            {sample.test_types?.length || 0} 种测试
                          </span>
                        </Tooltip>
                      </div>
                    </div>
                  </Checkbox>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="analysis-panel-section create-chart-section">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
          block
          disabled={builder.selectedSampleIds.length < 2 || !builder.testTypeId}
        >
          创建对比图表
        </Button>
        <div className="create-chart-hint">
          {builder.selectedSampleIds.length < 2
            ? '至少选择 2 个样品后才能创建对比图'
            : `将使用 ${builder.selectedSampleIds.length} 个样品生成新卡片`}
        </div>
      </div>
    </div>
  )
}
