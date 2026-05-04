import { useEffect, useMemo, useState } from 'react'
import { Button, Space, Modal, Input, List, Popconfirm, message, Tag, Typography } from 'antd'
import {
  SaveOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
  ClearOutlined,
  AimOutlined,
  CompressOutlined,
  MinusOutlined,
  PlusOutlined,
  HistoryOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { analysisApi } from '../../services/analysis'
import useAnalysisCanvasStore from '../../store/analysisCanvas'

const ZOOM_MIN = 0.4
const ZOOM_MAX = 2.2
const ZOOM_STEP = 0.1
const LAST_LAYOUT_STORAGE_KEY = 'analysis_canvas_last_layout_id'

const clampZoom = (value) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value))

function getSavedLayouts(payload) {
  return payload?.results || payload?.data?.results || []
}

function getLayoutPayload(response) {
  return response?.data?.layout_data || response?.layout_data || null
}

export default function CanvasToolbar() {
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [loadModalOpen, setLoadModalOpen] = useState(false)
  const [layoutName, setLayoutName] = useState('')
  const [restoringLastLayout, setRestoringLastLayout] = useState(false)
  const [lastLayoutChecked, setLastLayoutChecked] = useState(false)

  const cards = useAnalysisCanvasStore((state) => state.cards)
  const viewport = useAnalysisCanvasStore((state) => state.viewport)
  const layoutId = useAnalysisCanvasStore((state) => state.layoutId)
  const layoutTitle = useAnalysisCanvasStore((state) => state.layoutName)
  const clearCards = useAnalysisCanvasStore((state) => state.clearCards)
  const setViewport = useAnalysisCanvasStore((state) => state.setViewport)
  const requestViewportAction = useAnalysisCanvasStore((state) => state.requestViewportAction)
  const loadLayout = useAnalysisCanvasStore((state) => state.loadLayout)
  const getLayoutData = useAnalysisCanvasStore((state) => state.getLayoutData)
  const setLayoutMeta = useAnalysisCanvasStore((state) => state.setLayoutMeta)
  const setSaving = useAnalysisCanvasStore((state) => state.setSaving)
  const isSaving = useAnalysisCanvasStore((state) => state.isSaving)

  const queryClient = useQueryClient()

  const { data: layoutsData, isLoading: layoutsLoading } = useQuery({
    queryKey: ['canvasLayouts'],
    queryFn: () => analysisApi.getCanvasLayouts(),
    enabled: loadModalOpen || !lastLayoutChecked,
  })

  const savedLayouts = getSavedLayouts(layoutsData)
  const activeLayout = useMemo(
    () => savedLayouts.find((item) => item.id === layoutId) || null,
    [layoutId, savedLayouts]
  )

  const zoomPercent = useMemo(
    () => `${Math.round((viewport.zoom || 1) * 100)}%`,
    [viewport.zoom]
  )

  const persistLastLayoutId = (nextLayoutId) => {
    if (nextLayoutId) {
      localStorage.setItem(LAST_LAYOUT_STORAGE_KEY, String(nextLayoutId))
      return
    }
    localStorage.removeItem(LAST_LAYOUT_STORAGE_KEY)
  }

  const applyLayout = async (layout) => {
    const response = await analysisApi.getCanvasLayout(layout.id)
    const layoutData = getLayoutPayload(response)
    if (!layoutData) {
      throw new Error('未获取到可恢复的布局数据')
    }

    loadLayout(layoutData, {
      layoutId: layout.id,
      layoutName: layout.name,
    })
    persistLastLayoutId(layout.id)
    return layoutData
  }

  useEffect(() => {
    if (lastLayoutChecked || layoutsLoading) return

    const savedLastLayoutId = localStorage.getItem(LAST_LAYOUT_STORAGE_KEY)
    if (!savedLastLayoutId) {
      setLastLayoutChecked(true)
      return
    }

    const matchedLayout = savedLayouts.find((item) => String(item.id) === savedLastLayoutId)
    if (!matchedLayout) {
      persistLastLayoutId(null)
      setLastLayoutChecked(true)
      return
    }

    if (cards.length > 0 || layoutId) {
      setLastLayoutChecked(true)
      return
    }

    setRestoringLastLayout(true)
    applyLayout(matchedLayout)
      .then(() => {
        message.success(`已恢复上次画布：${matchedLayout.name}`)
      })
      .catch((error) => {
        persistLastLayoutId(null)
        message.warning(error?.message || '上次布局恢复失败，请手动重新加载')
      })
      .finally(() => {
        setRestoringLastLayout(false)
        setLastLayoutChecked(true)
      })
  }, [cards.length, layoutId, lastLayoutChecked, layoutsLoading, savedLayouts])

  useEffect(() => {
    if (activeLayout && !layoutName) {
      setLayoutName(activeLayout.name)
    }
  }, [activeLayout, layoutName])

  const handleSaveAs = async () => {
    const trimmedName = layoutName.trim()
    if (!trimmedName) {
      message.warning('请输入布局名称')
      return
    }

    setSaving(true)
    try {
      const layoutData = getLayoutData()
      const response = await analysisApi.saveCanvasLayout({
        name: trimmedName,
        layout_data: {
          ...layoutData,
          name: trimmedName,
        },
      })
      const savedLayout = response?.data || response
      setLayoutMeta({
        layoutId: savedLayout?.id ?? null,
        layoutName: savedLayout?.name || trimmedName,
      })
      persistLastLayoutId(savedLayout?.id ?? null)
      message.success('布局已保存')
      setSaveModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['canvasLayouts'] })
    } catch (error) {
      message.error(error?.message || error?.detail || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateCurrentLayout = async () => {
    if (!layoutId) {
      setLayoutName(layoutTitle || '')
      setSaveModalOpen(true)
      return
    }

    const nextName = (layoutTitle || activeLayout?.name || layoutName || '').trim()
    if (!nextName) {
      setSaveModalOpen(true)
      return
    }

    setSaving(true)
    try {
      const layoutData = getLayoutData()
      await analysisApi.updateCanvasLayout(layoutId, {
        name: nextName,
        layout_data: {
          ...layoutData,
          name: nextName,
        },
      })
      setLayoutMeta({ layoutId, layoutName: nextName })
      persistLastLayoutId(layoutId)
      message.success('当前布局已更新')
      queryClient.invalidateQueries({ queryKey: ['canvasLayouts'] })
    } catch (error) {
      message.error(error?.message || error?.detail || '更新失败')
    } finally {
      setSaving(false)
    }
  }

  const handleLoad = async (layout) => {
    try {
      await applyLayout(layout)
      message.success(`已加载布局：${layout.name}`)
      setLoadModalOpen(false)
    } catch (error) {
      message.error(error?.message || '加载失败')
    }
  }

  const handleRestoreLastLayout = async () => {
    const savedLastLayoutId = localStorage.getItem(LAST_LAYOUT_STORAGE_KEY)
    if (!savedLastLayoutId) {
      message.info('还没有最近保存的画布')
      return
    }

    const matchedLayout = savedLayouts.find((item) => String(item.id) === savedLastLayoutId)
    if (!matchedLayout) {
      persistLastLayoutId(null)
      message.info('最近布局不存在了，请重新选择')
      return
    }

    setRestoringLastLayout(true)
    try {
      await applyLayout(matchedLayout)
      message.success(`已恢复最近布局：${matchedLayout.name}`)
    } catch (error) {
      message.error(error?.message || '恢复失败')
    } finally {
      setRestoringLastLayout(false)
    }
  }

  const handleDeleteLayout = async (layoutIdToDelete) => {
    try {
      await analysisApi.deleteCanvasLayout(layoutIdToDelete)
      if (layoutId === layoutIdToDelete) {
        setLayoutMeta({ layoutId: null, layoutName: '' })
      }

      const savedLastLayoutId = localStorage.getItem(LAST_LAYOUT_STORAGE_KEY)
      if (savedLastLayoutId && String(layoutIdToDelete) === savedLastLayoutId) {
        persistLastLayoutId(null)
      }

      message.success('布局已删除')
      queryClient.invalidateQueries({ queryKey: ['canvasLayouts'] })
    } catch (error) {
      message.error(error?.message || '删除失败')
    }
  }

  const updateZoom = (nextZoom) => {
    setViewport({ zoom: clampZoom(nextZoom) })
  }

  const resetViewport = () => {
    setViewport({ x: 0, y: 0, zoom: 1 })
  }

  return (
    <>
      <div className="canvas-toolbar">
        <Space wrap>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={() => {
              setLayoutName(layoutTitle || activeLayout?.name || '')
              setSaveModalOpen(true)
            }}
            disabled={cards.length === 0}
          >
            另存布局
          </Button>
          <Button
            icon={<SaveOutlined />}
            onClick={handleUpdateCurrentLayout}
            disabled={cards.length === 0}
            loading={isSaving}
          >
            {layoutId ? '更新当前布局' : '保存为新布局'}
          </Button>
          <Button
            icon={<FolderOpenOutlined />}
            onClick={() => setLoadModalOpen(true)}
          >
            打开布局
          </Button>
          <Button
            icon={<HistoryOutlined />}
            onClick={handleRestoreLastLayout}
            loading={restoringLastLayout}
            disabled={savedLayouts.length === 0}
          >
            恢复最近布局
          </Button>
          <div className="canvas-zoom-group">
            <Button
              icon={<MinusOutlined />}
              onClick={() => updateZoom((viewport.zoom || 1) - ZOOM_STEP)}
            />
            <Button onClick={() => updateZoom(1)}>
              {zoomPercent}
            </Button>
            <Button
              icon={<PlusOutlined />}
              onClick={() => updateZoom((viewport.zoom || 1) + ZOOM_STEP)}
            />
          </div>
          <Button
            icon={<AimOutlined />}
            onClick={resetViewport}
          >
            重置视图
          </Button>
          <Button
            icon={<CompressOutlined />}
            onClick={() => requestViewportAction('fit-content', { scope: 'all' })}
            disabled={cards.length === 0}
          >
            适配内容
          </Button>
          <Popconfirm
            title="确定要清空画布吗？当前卡片会从画布中移除，但已保存的布局不会被删除。"
            onConfirm={clearCards}
            okText="确定"
            cancelText="取消"
            disabled={cards.length === 0}
          >
            <Button
              icon={<ClearOutlined />}
              disabled={cards.length === 0}
              danger
            >
              清空画布
            </Button>
          </Popconfirm>
          <Tag bordered={false} color="geekblue">
            白板模式
          </Tag>
          {layoutId && (
            <Tag bordered={false} color="cyan">
              当前布局：{layoutTitle || activeLayout?.name || `#${layoutId}`}
            </Tag>
          )}
        </Space>
      </div>

      <Modal
        title={layoutId ? '另存布局' : '保存布局'}
        open={saveModalOpen}
        onCancel={() => {
          setSaveModalOpen(false)
          setLayoutName(layoutTitle || activeLayout?.name || '')
        }}
        onOk={handleSaveAs}
        confirmLoading={isSaving}
        okText="保存"
        cancelText="取消"
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          保存后，下次进入画布页面可以继续打开这份对比分析结果。
        </Typography.Paragraph>
        <Input
          placeholder="输入布局名称"
          value={layoutName}
          onChange={(event) => setLayoutName(event.target.value)}
          onPressEnter={handleSaveAs}
        />
      </Modal>

      <Modal
        title="打开布局"
        open={loadModalOpen}
        onCancel={() => setLoadModalOpen(false)}
        footer={null}
        width={560}
      >
        {layoutsLoading ? (
          <div style={{ textAlign: 'center', padding: 20 }}>正在加载布局列表...</div>
        ) : savedLayouts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
            暂无已保存的布局
          </div>
        ) : (
          <List
            dataSource={savedLayouts}
            renderItem={(item) => {
              const isCurrentLayout = item.id === layoutId
              const isRecentLayout = String(item.id) === localStorage.getItem(LAST_LAYOUT_STORAGE_KEY)

              return (
                <List.Item
                  actions={[
                    <Button
                      key="load"
                      type="link"
                      size="small"
                      onClick={() => handleLoad(item)}
                    >
                      打开
                    </Button>,
                    <Popconfirm
                      key="delete"
                      title="确定要删除这个布局吗？"
                      onConfirm={() => handleDeleteLayout(item.id)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    title={(
                      <Space size={8} wrap>
                        <span>{item.name}</span>
                        {isCurrentLayout && <Tag color="blue">当前</Tag>}
                        {isRecentLayout && <Tag color="gold">最近</Tag>}
                      </Space>
                    )}
                    description={`${new Date(item.updated_at).toLocaleString()} · ${item.layout_data?.cards?.length || 0} 个图表`}
                  />
                </List.Item>
              )
            }}
          />
        )}
      </Modal>
    </>
  )
}
