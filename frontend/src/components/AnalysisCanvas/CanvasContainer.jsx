import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ResponsiveGridLayout, useContainerWidth, verticalCompactor } from 'react-grid-layout'
import { Empty, Tag } from 'antd'
import { ExperimentOutlined } from '@ant-design/icons'
import ChartCard from './ChartCard'
import useAnalysisCanvasStore, {
  ANALYSIS_CANVAS_VISIBLE_COLS,
  ANALYSIS_CANVAS_WORKSPACE_COLS,
} from '../../store/analysisCanvas'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const MINIMAP_WIDTH = 220
const MINIMAP_HEIGHT = 140
const WORKSPACE_PADDING = 20
const FIT_PADDING = 72
const ZOOM_MIN = 0.4
const ZOOM_MAX = 2.2
const ZOOM_WHEEL_STEP = 0.12

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const clampZoom = (value) => clamp(value, ZOOM_MIN, ZOOM_MAX)

const isElement = (value) => value instanceof Element

const isEditableTarget = (target) => (
  isElement(target)
  && (
    target.closest('input')
    || target.closest('textarea')
    || target.closest('[contenteditable="true"]')
  )
)

const isInteractiveTarget = (target) => (
  isElement(target)
  && (
    target.closest('.ant-btn')
    || target.closest('.ant-select')
    || target.closest('.ant-dropdown')
    || target.closest('.ant-modal')
    || target.closest('.modebar')
    || target.closest('.react-resizable-handle')
  )
)

const isCardTarget = (target) => (
  isElement(target)
  && (
    target.closest('.react-grid-item')
    || target.closest('.chart-card')
    || target.closest('.ant-radio-group')
    || target.closest('.canvas-minimap')
  )
)

const getCardBounds = (card, baseColWidth, gridConfig) => {
  const unitWidth = baseColWidth + gridConfig.margin[0]
  const unitHeight = gridConfig.rowHeight + gridConfig.margin[1]

  return {
    left: card.grid.x * unitWidth,
    top: card.grid.y * unitHeight,
    width: (card.grid.w * baseColWidth) + ((card.grid.w - 1) * gridConfig.margin[0]),
    height: (card.grid.h * gridConfig.rowHeight) + ((card.grid.h - 1) * gridConfig.margin[1]),
  }
}

export default function CanvasContainer() {
  const cards = useAnalysisCanvasStore((state) => state.cards)
  const builder = useAnalysisCanvasStore((state) => state.builder)
  const viewport = useAnalysisCanvasStore((state) => state.viewport)
  const viewportAction = useAnalysisCanvasStore((state) => state.viewportAction)
  const setViewport = useAnalysisCanvasStore((state) => state.setViewport)
  const updateCardGrid = useAnalysisCanvasStore((state) => state.updateCardGrid)
  const selectedCardId = useAnalysisCanvasStore((state) => state.selectedCardId)

  const { width, containerRef } = useContainerWidth({ initialWidth: 1200 })
  const viewportRef = useRef(null)
  const panSessionRef = useRef(null)
  const minimapSessionRef = useRef(null)
  const spacePressedRef = useRef(false)
  const lastViewportActionRef = useRef(null)
  const previousZoomRef = useRef(viewport.zoom || 1)
  const [viewportMetrics, setViewportMetrics] = useState({ width: 0, height: 0 })

  const layouts = useMemo(() => {
    const lg = cards.map((card) => ({
      i: card.id,
      x: card.grid.x,
      y: card.grid.y,
      w: card.grid.w,
      h: card.grid.h,
    }))

    return { lg, md: lg, sm: lg }
  }, [cards])

  const gridConfig = useMemo(() => ({
    cols: ANALYSIS_CANVAS_WORKSPACE_COLS,
    rowHeight: 50,
    margin: [16, 16],
  }), [])

  const zoom = viewport.zoom || 1

  const baseColWidth = useMemo(() => {
    const safeWidth = Math.max(width, 960)
    return (safeWidth - (gridConfig.margin[0] * (ANALYSIS_CANVAS_VISIBLE_COLS - 1))) / ANALYSIS_CANVAS_VISIBLE_COLS
  }, [gridConfig.margin, width])

  const workspaceWidth = useMemo(
    () => Math.round(
      (baseColWidth * ANALYSIS_CANVAS_WORKSPACE_COLS)
      + (gridConfig.margin[0] * (ANALYSIS_CANVAS_WORKSPACE_COLS - 1))
    ),
    [baseColWidth, gridConfig.margin]
  )

  const workspaceRows = useMemo(() => {
    const maxBottom = cards.reduce((bottom, card) => (
      Math.max(bottom, card.grid.y + card.grid.h)
    ), 0)
    return Math.max(24, maxBottom + 10)
  }, [cards])

  const workspaceHeight = useMemo(
    () => Math.max(
      1200,
      workspaceRows * gridConfig.rowHeight + ((workspaceRows - 1) * gridConfig.margin[1])
    ),
    [gridConfig.margin, gridConfig.rowHeight, workspaceRows]
  )

  const scaledWorkspaceWidth = useMemo(
    () => Math.round(workspaceWidth * zoom),
    [workspaceWidth, zoom]
  )

  const scaledWorkspaceHeight = useMemo(
    () => Math.round(workspaceHeight * zoom),
    [workspaceHeight, zoom]
  )

  const minimapScale = useMemo(() => {
    const widthScale = MINIMAP_WIDTH / workspaceWidth
    const heightScale = MINIMAP_HEIGHT / workspaceHeight
    return Math.min(widthScale, heightScale)
  }, [workspaceHeight, workspaceWidth])

  const minimapViewport = useMemo(() => ({
    width: viewportMetrics.width * minimapScale / zoom,
    height: viewportMetrics.height * minimapScale / zoom,
  }), [minimapScale, viewportMetrics.height, viewportMetrics.width, zoom])

  const dragConfig = useMemo(() => ({
    enabled: true,
    handle: '.chart-card-drag-handle',
    cancel: '.chart-card-action-zone, .chart-card-action-zone *, .chart-card-title-input, .chart-card-title-input *, .chart-card-body, .chart-card-body *, .chart-card-footer, .chart-card-footer *',
  }), [])

  const resizeConfig = useMemo(() => ({
    enabled: true,
  }), [])

  const currentExperimentName = builder.experimentName || cards[0]?.config?.experimentName || ''
  const currentProjectName = builder.projectName || cards[0]?.config?.projectName || ''

  const moveViewportTo = useCallback((scrollLeft, scrollTop) => {
    const viewportElement = viewportRef.current
    if (!viewportElement) return

    const maxX = Math.max(0, viewportElement.scrollWidth - viewportElement.clientWidth)
    const maxY = Math.max(0, viewportElement.scrollHeight - viewportElement.clientHeight)
    const nextX = clamp(scrollLeft, 0, maxX)
    const nextY = clamp(scrollTop, 0, maxY)

    viewportElement.scrollLeft = nextX
    viewportElement.scrollTop = nextY
    setViewport({ x: nextX, y: nextY })
  }, [setViewport])

  const applyZoomAtPoint = useCallback((nextZoom, anchorClientX, anchorClientY) => {
    const viewportElement = viewportRef.current
    if (!viewportElement) return

    const safeZoom = clampZoom(nextZoom)
    const currentZoom = viewport.zoom || 1
    if (Math.abs(safeZoom - currentZoom) < 0.001) return

    const bounds = viewportElement.getBoundingClientRect()
    const localX = anchorClientX - bounds.left
    const localY = anchorClientY - bounds.top
    const workspaceX = (
      viewportElement.scrollLeft + localX - (WORKSPACE_PADDING * currentZoom)
    ) / currentZoom
    const workspaceY = (
      viewportElement.scrollTop + localY - (WORKSPACE_PADDING * currentZoom)
    ) / currentZoom

    previousZoomRef.current = safeZoom
    moveViewportTo(
      (workspaceX * safeZoom) + (WORKSPACE_PADDING * safeZoom) - localX,
      (workspaceY * safeZoom) + (WORKSPACE_PADDING * safeZoom) - localY,
    )
    setViewport({ zoom: safeZoom })
  }, [moveViewportTo, setViewport, viewport.zoom])

  const fitCardsInViewport = useCallback((targetCards) => {
    const viewportElement = viewportRef.current
    if (!viewportElement || targetCards.length === 0) return

    const bounds = targetCards
      .map((card) => getCardBounds(card, baseColWidth, gridConfig))
      .reduce((accumulator, cardBounds) => ({
        left: Math.min(accumulator.left, cardBounds.left),
        top: Math.min(accumulator.top, cardBounds.top),
        right: Math.max(accumulator.right, cardBounds.left + cardBounds.width),
        bottom: Math.max(accumulator.bottom, cardBounds.top + cardBounds.height),
      }), {
        left: Number.POSITIVE_INFINITY,
        top: Number.POSITIVE_INFINITY,
        right: 0,
        bottom: 0,
      })

    const targetWidth = Math.max(240, (bounds.right - bounds.left) + FIT_PADDING)
    const targetHeight = Math.max(180, (bounds.bottom - bounds.top) + FIT_PADDING)
    const safeViewportWidth = Math.max(320, viewportElement.clientWidth - FIT_PADDING)
    const safeViewportHeight = Math.max(240, viewportElement.clientHeight - FIT_PADDING)
    const nextZoom = clampZoom(Math.min(
      safeViewportWidth / targetWidth,
      safeViewportHeight / targetHeight,
    ))
    const centerX = (bounds.left + bounds.right) / 2
    const centerY = (bounds.top + bounds.bottom) / 2

    previousZoomRef.current = nextZoom
    moveViewportTo(
      (centerX * nextZoom) + (WORKSPACE_PADDING * nextZoom) - (viewportElement.clientWidth / 2),
      (centerY * nextZoom) + (WORKSPACE_PADDING * nextZoom) - (viewportElement.clientHeight / 2),
    )
    setViewport({ zoom: nextZoom })
  }, [baseColWidth, gridConfig, moveViewportTo, setViewport])

  const stopPanSession = useCallback(() => {
    if (!panSessionRef.current) return
    document.body.classList.remove('canvas-panning')
    panSessionRef.current = null
  }, [])

  const stopMinimapSession = useCallback(() => {
    minimapSessionRef.current = null
  }, [])

  const syncViewportFromMinimapPoint = useCallback((clientX, clientY) => {
    const session = minimapSessionRef.current
    if (!session) return

    const localX = clamp(clientX - session.bounds.left, 0, session.bounds.width)
    const localY = clamp(clientY - session.bounds.top, 0, session.bounds.height)
    const workspaceX = localX / minimapScale
    const workspaceY = localY / minimapScale

    moveViewportTo(
      (workspaceX * zoom) + (WORKSPACE_PADDING * zoom) - (viewportMetrics.width / 2),
      (workspaceY * zoom) + (WORKSPACE_PADDING * zoom) - (viewportMetrics.height / 2),
    )
  }, [minimapScale, moveViewportTo, viewportMetrics.height, viewportMetrics.width, zoom])

  const handleDragStop = useCallback(
    (layout, oldItem, newItem) => {
      updateCardGrid(newItem.i, { x: newItem.x, y: newItem.y })
    },
    [updateCardGrid]
  )

  const handleResizeStop = useCallback(
    (layout, oldItem, newItem) => {
      updateCardGrid(newItem.i, {
        x: newItem.x,
        y: newItem.y,
        w: newItem.w,
        h: newItem.h,
      })
    },
    [updateCardGrid]
  )

  useEffect(() => {
    const viewportElement = viewportRef.current
    if (!viewportElement) return

    const updateMetrics = () => {
      setViewportMetrics({
        width: viewportElement.clientWidth,
        height: viewportElement.clientHeight,
      })
    }

    updateMetrics()
    const resizeObserver = new ResizeObserver(updateMetrics)
    resizeObserver.observe(viewportElement)

    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    const viewportElement = viewportRef.current
    if (!viewportElement) return

    const previousZoom = previousZoomRef.current
    if (Math.abs(previousZoom - zoom) < 0.001) return

    const centerX = (
      viewportElement.scrollLeft + (viewportElement.clientWidth / 2) - (WORKSPACE_PADDING * previousZoom)
    ) / previousZoom
    const centerY = (
      viewportElement.scrollTop + (viewportElement.clientHeight / 2) - (WORKSPACE_PADDING * previousZoom)
    ) / previousZoom

    previousZoomRef.current = zoom
    moveViewportTo(
      (centerX * zoom) + (WORKSPACE_PADDING * zoom) - (viewportElement.clientWidth / 2),
      (centerY * zoom) + (WORKSPACE_PADDING * zoom) - (viewportElement.clientHeight / 2),
    )
    setViewport({ zoom })
  }, [moveViewportTo, setViewport, zoom])

  useEffect(() => {
    const viewportElement = viewportRef.current
    if (!viewportElement) return

    const nextX = Math.max(0, Math.round(viewport.x || 0))
    const nextY = Math.max(0, Math.round(viewport.y || 0))

    if (Math.abs(viewportElement.scrollLeft - nextX) > 2) {
      viewportElement.scrollLeft = nextX
    }

    if (Math.abs(viewportElement.scrollTop - nextY) > 2) {
      viewportElement.scrollTop = nextY
    }
  }, [viewport.x, viewport.y, scaledWorkspaceHeight, scaledWorkspaceWidth])

  useEffect(() => {
    const handlePointerMove = (event) => {
      const panSession = panSessionRef.current
      const viewportElement = viewportRef.current
      if (panSession && viewportElement) {
        const deltaX = event.clientX - panSession.startX
        const deltaY = event.clientY - panSession.startY
        viewportElement.scrollLeft = panSession.scrollLeft - deltaX
        viewportElement.scrollTop = panSession.scrollTop - deltaY
      }

      if (minimapSessionRef.current) {
        syncViewportFromMinimapPoint(event.clientX, event.clientY)
      }
    }

    const handlePointerUp = () => {
      stopPanSession()
      stopMinimapSession()
    }

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)

    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [stopMinimapSession, stopPanSession, syncViewportFromMinimapPoint])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code !== 'Space' || isEditableTarget(event.target)) return
      if (!spacePressedRef.current) {
        spacePressedRef.current = true
        document.body.classList.add('canvas-pan-hotkey')
      }
      event.preventDefault()
    }

    const handleKeyUp = (event) => {
      if (event.code !== 'Space') return
      spacePressedRef.current = false
      document.body.classList.remove('canvas-pan-hotkey')
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      document.body.classList.remove('canvas-pan-hotkey')
    }
  }, [])

  useEffect(() => {
    if (!viewportAction?.type || lastViewportActionRef.current === viewportAction.issuedAt) return

    lastViewportActionRef.current = viewportAction.issuedAt

    if (viewportAction.type === 'fit-content') {
      const targetCards = viewportAction.payload?.scope === 'selected' && selectedCardId
        ? cards.filter((card) => card.id === selectedCardId)
        : cards

      if (targetCards.length > 0) {
        fitCardsInViewport(targetCards)
      }
    }
  }, [cards, fitCardsInViewport, selectedCardId, viewportAction])

  const handleViewportScroll = useCallback((event) => {
    setViewport({
      x: event.currentTarget.scrollLeft,
      y: event.currentTarget.scrollTop,
    })
  }, [setViewport])

  const handleViewportMouseDown = useCallback((event) => {
    const usingPanShortcut = spacePressedRef.current || event.button === 1
    if (event.button !== 0 && !usingPanShortcut) return

    if (usingPanShortcut) {
      if (isEditableTarget(event.target) || isInteractiveTarget(event.target)) {
        return
      }
    } else if (isCardTarget(event.target) || isInteractiveTarget(event.target)) {
      return
    }

    const viewportElement = viewportRef.current
    if (!viewportElement) return

    event.preventDefault()
    panSessionRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewportElement.scrollLeft,
      scrollTop: viewportElement.scrollTop,
    }
    document.body.classList.add('canvas-panning')
  }, [])

  const handleViewportWheel = useCallback((event) => {
    if (!event.ctrlKey && !event.metaKey) return

    event.preventDefault()
    const currentZoom = viewport.zoom || 1
    const zoomFactor = event.deltaY > 0 ? (1 - ZOOM_WHEEL_STEP) : (1 + ZOOM_WHEEL_STEP)
    applyZoomAtPoint(currentZoom * zoomFactor, event.clientX, event.clientY)
  }, [applyZoomAtPoint, viewport.zoom])

  const handleMinimapPointerDown = useCallback((event) => {
    event.preventDefault()
    minimapSessionRef.current = {
      bounds: event.currentTarget.getBoundingClientRect(),
    }
    syncViewportFromMinimapPoint(event.clientX, event.clientY)
  }, [syncViewportFromMinimapPoint])

  const minimapViewportWidth = Math.max(minimapViewport.width, 18)
  const minimapViewportHeight = Math.max(minimapViewport.height, 18)
  const minimapViewportLeft = clamp(
    ((viewport.x || 0) - (WORKSPACE_PADDING * zoom)) * minimapScale / zoom,
    0,
    Math.max(0, (workspaceWidth * minimapScale) - minimapViewportWidth)
  )
  const minimapViewportTop = clamp(
    ((viewport.y || 0) - (WORKSPACE_PADDING * zoom)) * minimapScale / zoom,
    0,
    Math.max(0, (workspaceHeight * minimapScale) - minimapViewportHeight)
  )

  return (
    <div className="canvas-container" ref={containerRef}>
      {(currentExperimentName || cards.length > 0) && (
        <div className="canvas-session-banner">
          <div className="canvas-session-title">
            <ExperimentOutlined />
            <span>{currentExperimentName || '当前分析会话'}</span>
          </div>
          <div className="canvas-session-meta">
            {currentProjectName && <Tag>{currentProjectName}</Tag>}
            <Tag color="blue">{cards.length} 张图表</Tag>
            <Tag bordered={false}>{Math.round(zoom * 100)}% 视图</Tag>
          </div>
        </div>
      )}

      {cards.length === 0 ? (
        <div className="canvas-empty">
          <Empty
            description={
              currentExperimentName
                ? `当前实验是“${currentExperimentName}”，请在左侧选择测试类型和样品，创建第一张对比图。`
                : '先在左侧选择项目、实验、测试类型和样品，再创建第一张对比图。'
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      ) : (
        <div className="canvas-whiteboard-shell">
          <div
            className="canvas-pan-viewport"
            ref={viewportRef}
            onScroll={handleViewportScroll}
            onMouseDown={handleViewportMouseDown}
            onWheel={handleViewportWheel}
          >
            <div
              className="canvas-workspace"
              style={{
                width: `${scaledWorkspaceWidth}px`,
                minHeight: `${scaledWorkspaceHeight}px`,
              }}
            >
              <div
                className="canvas-workspace-scale"
                style={{
                  width: `${workspaceWidth}px`,
                  minHeight: `${workspaceHeight}px`,
                  transform: `scale(${zoom})`,
                }}
              >
                <ResponsiveGridLayout
                  className="canvas-layout-grid"
                  layouts={layouts}
                  width={workspaceWidth}
                  breakpoints={{ lg: 1200, md: 768, sm: 0 }}
                  cols={{
                    lg: ANALYSIS_CANVAS_WORKSPACE_COLS,
                    md: ANALYSIS_CANVAS_WORKSPACE_COLS,
                    sm: ANALYSIS_CANVAS_WORKSPACE_COLS,
                  }}
                  rowHeight={gridConfig.rowHeight}
                  margin={gridConfig.margin}
                  compactor={verticalCompactor}
                  gridConfig={gridConfig}
                  dragConfig={dragConfig}
                  resizeConfig={resizeConfig}
                  transformScale={zoom}
                  onDragStop={handleDragStop}
                  onResizeStop={handleResizeStop}
                >
                  {cards.map((card) => (
                    <div key={card.id}>
                      <ChartCard card={card} />
                    </div>
                  ))}
                </ResponsiveGridLayout>
              </div>
            </div>
          </div>

          <div className="canvas-minimap">
            <div className="canvas-minimap-header">
              <span>导航图</span>
              <span>{Math.round(zoom * 100)}%</span>
            </div>
            <div
              className="canvas-minimap-body"
              onMouseDown={handleMinimapPointerDown}
            >
              <div
                className="canvas-minimap-stage"
                style={{
                  width: `${workspaceWidth * minimapScale}px`,
                  height: `${workspaceHeight * minimapScale}px`,
                }}
              >
                {cards.map((card) => {
                  const bounds = getCardBounds(card, baseColWidth, gridConfig)
                  return (
                    <div
                      key={card.id}
                      className={`canvas-minimap-card ${selectedCardId === card.id ? 'canvas-minimap-card-selected' : ''}`}
                      style={{
                        left: `${bounds.left * minimapScale}px`,
                        top: `${bounds.top * minimapScale}px`,
                        width: `${Math.max(bounds.width * minimapScale, 12)}px`,
                        height: `${Math.max(bounds.height * minimapScale, 8)}px`,
                      }}
                    />
                  )
                })}
                <div
                  className="canvas-minimap-viewport"
                  style={{
                    width: `${minimapViewportWidth}px`,
                    height: `${minimapViewportHeight}px`,
                    left: `${minimapViewportLeft}px`,
                    top: `${minimapViewportTop}px`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
