import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Dropdown, Empty, Input, Radio, Space, Spin, Tag, Tooltip } from 'antd'
import {
  BarChartOutlined,
  CopyOutlined,
  DeleteOutlined,
  DotChartOutlined,
  LineChartOutlined,
  MoreOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { analysisApi } from '../../services/analysis'
import DataChart from '../datachart'
import useAnalysisCanvasStore from '../../store/analysisCanvas'

const chartTypeLabelMap = {
  line: '折线图',
  bar: '柱状图',
  scatter: '散点图',
}

const GRID_ROW_HEIGHT = 50
const GRID_ROW_MARGIN = 16
const CARD_MIN_GRID_HEIGHT = 8
const CARD_MAX_GRID_HEIGHT = 16
const CARD_MIN_GRID_WIDTH = 6
const CARD_MAX_GRID_WIDTH = 12
const AUTO_RESIZE_PADDING = 20
const DEFAULT_CHART_HEIGHT = 420

function getErrorMessage(error) {
  if (!error) return '图表数据加载失败'
  return error.message || error.detail || '图表数据加载失败'
}

function getErrorWarnings(error) {
  if (Array.isArray(error?.data?.warnings)) {
    return error.data.warnings
  }
  return []
}

function resolveGridRows(pixelHeight) {
  return Math.ceil((pixelHeight + GRID_ROW_MARGIN) / (GRID_ROW_HEIGHT + GRID_ROW_MARGIN))
}

function getRecommendedGridSize(card, cardElement) {
  if (!cardElement || !cardElement.parentElement) return null

  const gridItemElement = cardElement.parentElement
  const currentWidth = Math.max(gridItemElement.clientWidth, 1)
  const headerHeight = cardElement.querySelector('.chart-card-header')?.offsetHeight || 0
  const metaHeight = cardElement.querySelector('.chart-card-meta')?.offsetHeight || 0
  const footerHeight = cardElement.querySelector('.chart-card-footer')?.offsetHeight || 0
  const bodyElement = cardElement.querySelector('.chart-card-body')
  const bodyContentElement = bodyElement?.firstElementChild
  const bodyStyle = bodyElement ? window.getComputedStyle(bodyElement) : null
  const bodyPaddingTop = bodyStyle ? parseFloat(bodyStyle.paddingTop || '0') : 0
  const bodyPaddingBottom = bodyStyle ? parseFloat(bodyStyle.paddingBottom || '0') : 0
  const bodyContentHeight = bodyContentElement?.scrollHeight || bodyElement?.scrollHeight || 0
  const requiredHeight = (
    headerHeight
    + metaHeight
    + footerHeight
    + bodyPaddingTop
    + bodyPaddingBottom
    + bodyContentHeight
    + AUTO_RESIZE_PADDING
  )

  const nextHeight = Math.min(
    CARD_MAX_GRID_HEIGHT,
    Math.max(CARD_MIN_GRID_HEIGHT, resolveGridRows(requiredHeight))
  )

  const contentWidth = bodyContentElement?.scrollWidth || cardElement.scrollWidth
  const nextWidth = contentWidth > currentWidth + 24
    ? Math.min(
      CARD_MAX_GRID_WIDTH,
      Math.max(
        CARD_MIN_GRID_WIDTH,
        Math.ceil((contentWidth / currentWidth) * card.grid.w)
      )
    )
    : card.grid.w

  if (nextWidth === card.grid.w && nextHeight === card.grid.h) {
    return null
  }

  return { w: nextWidth, h: nextHeight }
}

export default function ChartCard({ card }) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(card.title)
  const cardRef = useRef(null)
  const autoResizeSignatureRef = useRef('')

  const removeCard = useAnalysisCanvasStore((state) => state.removeCard)
  const duplicateCard = useAnalysisCanvasStore((state) => state.duplicateCard)
  const updateCard = useAnalysisCanvasStore((state) => state.updateCard)
  const updateCardConfig = useAnalysisCanvasStore((state) => state.updateCardConfig)
  const updateCardGrid = useAnalysisCanvasStore((state) => state.updateCardGrid)
  const selectedCardId = useAnalysisCanvasStore((state) => state.selectedCardId)
  const selectCard = useAnalysisCanvasStore((state) => state.selectCard)

  useEffect(() => {
    setTitleValue(card.title)
  }, [card.title])

  const { data: compareResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['compare', card.config.sampleIds, card.config.testTypeId, card.config.algorithmId],
    queryFn: () =>
      analysisApi.comparePlotData({
        sample_ids: card.config.sampleIds,
        test_type_id: card.config.testTypeId,
        algorithm_id: card.config.algorithmId || undefined,
      }),
    enabled: !!(card.config.sampleIds?.length >= 2 && card.config.testTypeId),
    staleTime: 10 * 60 * 1000,
  })

  const comparePayload = compareResponse?.data ?? null
  const compareWarnings = Array.isArray(comparePayload?.warnings) ? comparePayload.warnings : []
  const failedSampleIds = Array.isArray(comparePayload?.failed_sample_ids)
    ? comparePayload.failed_sample_ids
    : []

  const plotData = useMemo(() => {
    if (!comparePayload?.series?.length) return null

    if (card.config.chartType && card.config.chartType !== 'line') {
      return {
        ...comparePayload,
        series: comparePayload.series.map((seriesItem) => ({
          ...seriesItem,
          type: card.config.chartType,
        })),
      }
    }

    return comparePayload
  }, [comparePayload, card.config.chartType])

  const sampleLabels = card.config.sampleLabels?.length ? card.config.sampleLabels : card.config.sampleIds || []
  const samplePreview = useMemo(() => {
    const preview = sampleLabels.slice(0, 3).join('、')
    const suffix = sampleLabels.length > 3 ? ` +${sampleLabels.length - 3}` : ''
    return preview ? `${preview}${suffix}` : '未记录样品'
  }, [sampleLabels])

  const sampleTooltip = sampleLabels.join('、') || '暂无样品'
  const warningDescription = compareWarnings.slice(0, 2).join('；')
  const warningMessage = failedSampleIds.length
    ? `已跳过 ${failedSampleIds.length} 个异常样品`
    : `已跳过 ${compareWarnings.length} 个异常样品`

  const resizeCardToFitContent = useCallback(() => {
    const nextGrid = getRecommendedGridSize(card, cardRef.current)
    if (nextGrid) {
      updateCardGrid(card.id, nextGrid)
    }
  }, [card, updateCardGrid])

  useEffect(() => {
    const shouldMeasure = !!plotData || !!error || isLoading
    if (!shouldMeasure) return

    const signature = JSON.stringify({
      cardId: card.id,
      title: card.title,
      chartType: card.config.chartType,
      dimensions: plotData?.dimensions || 0,
      seriesCount: plotData?.series?.length || 0,
      warningCount: compareWarnings.length,
      failedCount: failedSampleIds.length,
      isLoading,
      hasError: !!error,
    })

    if (autoResizeSignatureRef.current === signature) return

    const frameId = window.requestAnimationFrame(() => {
      resizeCardToFitContent()
      autoResizeSignatureRef.current = signature
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [
    card.id,
    card.title,
    card.config.chartType,
    compareWarnings.length,
    error,
    failedSampleIds.length,
    isLoading,
    plotData,
    resizeCardToFitContent,
  ])

  useEffect(() => {
    const shouldObserve = (!!plotData || !!error || isLoading) && !!cardRef.current
    if (!shouldObserve) return

    const observer = new ResizeObserver(() => {
      resizeCardToFitContent()
    })

    observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [error, isLoading, plotData, resizeCardToFitContent])

  const handleTitleSave = () => {
    const nextTitle = titleValue.trim()
    if (nextTitle) {
      updateCard(card.id, { title: nextTitle })
    } else {
      setTitleValue(card.title)
    }
    setEditingTitle(false)
  }

  const handleChartTypeChange = (event) => {
    updateCardConfig(card.id, { chartType: event.target.value })
  }

  const menuItems = [
    {
      key: 'duplicate',
      icon: <CopyOutlined />,
      label: '复制卡片',
      onClick: () => duplicateCard(card.id),
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除卡片',
      danger: true,
      onClick: () => removeCard(card.id),
    },
  ]

  const isSelected = selectedCardId === card.id

  return (
    <div
      ref={cardRef}
      className={`chart-card ${isSelected ? 'chart-card-selected' : ''}`}
      onClick={() => selectCard(card.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          selectCard(card.id)
        }
      }}
    >
      <div className="chart-card-header">
        <div className="chart-card-title-group chart-card-drag-handle">
          {editingTitle ? (
            <Input
              className="chart-card-title-input"
              size="small"
              value={titleValue}
              onChange={(event) => setTitleValue(event.target.value)}
              onBlur={handleTitleSave}
              onPressEnter={handleTitleSave}
              autoFocus
            />
          ) : (
            <>
              <div
                className="chart-card-title"
                onDoubleClick={() => {
                  setEditingTitle(true)
                  setTitleValue(card.title)
                }}
              >
                {card.title}
              </div>
              <div className="chart-card-subtitle">
                <span>{card.config.experimentName || '未命名实验'}</span>
                <span>·</span>
                <span>{card.config.testTypeName || '未命名测试'}</span>
                {card.config.algorithmName && (
                  <>
                    <span>·</span>
                    <span>{card.config.algorithmName}</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="chart-card-actions chart-card-action-zone">
          <Radio.Group
            size="small"
            value={card.config.chartType || 'line'}
            onChange={handleChartTypeChange}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="line"><LineChartOutlined /></Radio.Button>
            <Radio.Button value="bar"><BarChartOutlined /></Radio.Button>
            <Radio.Button value="scatter"><DotChartOutlined /></Radio.Button>
          </Radio.Group>
          <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </div>
      </div>

      <div className="chart-card-meta">
        <Tag color="blue">{card.config.sampleIds?.length || 0} 个样品</Tag>
        <Tag>{chartTypeLabelMap[card.config.chartType || 'line']}</Tag>
        <Tooltip title={sampleTooltip}>
          <span className="chart-card-sample-preview">{samplePreview}</span>
        </Tooltip>
      </div>

      <div className="chart-card-body">
        {isLoading ? (
          <div className="chart-card-loading">
            <Space direction="vertical" size={8} align="center">
              <Spin />
              <span className="inline-helper">正在生成对比数据...</span>
            </Space>
          </div>
        ) : error ? (
          <div className="chart-card-error">
            <Empty
              description={getErrorMessage(error)}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              {getErrorWarnings(error).length > 0 && (
                <div className="chart-card-error-hint">
                  {getErrorWarnings(error).slice(0, 2).join('；')}
                </div>
              )}
              <Space>
                <Button size="small" onClick={() => refetch()}>重试</Button>
                <Button size="small" danger onClick={() => removeCard(card.id)}>删除</Button>
              </Space>
            </Empty>
          </div>
        ) : plotData ? (
          <div className="chart-card-chart">
            {compareWarnings.length > 0 && (
              <Alert
                className="chart-card-warning"
                type="warning"
                showIcon
                message={warningMessage}
                description={warningDescription || '部分样品未能生成曲线，系统已自动跳过。'}
              />
            )}
            <DataChart plotData={plotData} height={DEFAULT_CHART_HEIGHT} title="" />
          </div>
        ) : (
          <Empty description="暂无可展示数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </div>

      <div className="chart-card-footer">
        <span>{card.config.projectName || '未命名项目'}</span>
        <span>·</span>
        <span>{samplePreview}</span>
      </div>
    </div>
  )
}
