import { create } from 'zustand'

export const ANALYSIS_CANVAS_VISIBLE_COLS = 12
export const ANALYSIS_CANVAS_WORKSPACE_COLS = 48

const createInitialBuilder = () => ({
  projectId: null,
  projectName: '',
  experimentId: null,
  experimentName: '',
  testTypeId: null,
  testTypeName: '',
  algorithmId: null,
  algorithmName: '',
  chartType: 'line',
  titleDraft: '',
  sampleSearch: '',
  selectedSampleIds: [],
  onlyShowAvailableSamples: true,
})

const createInitialViewport = () => ({ x: 0, y: 0, zoom: 1 })

const findNextGridPosition = (cards, card) => {
  const occupiedPositions = new Set()
  cards.forEach((existingCard) => {
    for (let dx = 0; dx < existingCard.grid.w; dx += 1) {
      for (let dy = 0; dy < existingCard.grid.h; dy += 1) {
        occupiedPositions.add(`${existingCard.grid.x + dx},${existingCard.grid.y + dy}`)
      }
    }
  })

  const width = card.grid?.w || 6
  const height = card.grid?.h || 8
  const spawnCols = Math.min(ANALYSIS_CANVAS_VISIBLE_COLS, ANALYSIS_CANVAS_WORKSPACE_COLS)

  for (let y = 0; y < 100; y += 1) {
    for (let x = 0; x <= spawnCols - width; x += 1) {
      let positionFree = true
      for (let dx = 0; dx < width; dx += 1) {
        for (let dy = 0; dy < height; dy += 1) {
          if (occupiedPositions.has(`${x + dx},${y + dy}`)) {
            positionFree = false
            break
          }
        }
        if (!positionFree) break
      }

      if (positionFree) {
        return { x, y }
      }
    }
  }

  return { x: 0, y: cards.length * 8 }
}

const buildCardPayload = (state, card, overrideTitle) => {
  const position = findNextGridPosition(state.cards, card)

  return {
    id: card.id || `chart_${Date.now()}`,
    title: overrideTitle || card.title || '对比图表',
    grid: {
      x: position.x,
      y: position.y,
      w: card.grid?.w || 6,
      h: card.grid?.h || 8,
    },
    config: {
      projectId: card.config?.projectId ?? state.builder.projectId,
      projectName: card.config?.projectName ?? state.builder.projectName,
      experimentId: card.config?.experimentId ?? state.builder.experimentId,
      experimentName: card.config?.experimentName ?? state.builder.experimentName,
      testTypeId: card.config?.testTypeId ?? state.builder.testTypeId,
      testTypeName: card.config?.testTypeName ?? state.builder.testTypeName,
      algorithmId: card.config?.algorithmId ?? state.builder.algorithmId,
      algorithmName: card.config?.algorithmName ?? state.builder.algorithmName,
      chartType: card.config?.chartType || state.builder.chartType || 'line',
      sampleIds: card.config?.sampleIds || [],
      sampleLabels: card.config?.sampleLabels || [],
    },
    createdAt: new Date().toISOString(),
  }
}

const useAnalysisCanvasStore = create((set, get) => ({
  cards: [],
  selectedCardId: null,
  viewport: createInitialViewport(),
  viewportAction: null,
  layoutName: '',
  layoutId: null,
  isSaving: false,
  isLoading: false,
  savedLayouts: [],
  layoutsLoaded: false,
  builder: createInitialBuilder(),

  updateBuilder: (updates) => set((state) => ({
    builder: { ...state.builder, ...updates },
  })),

  resetBuilder: () => set({ builder: createInitialBuilder() }),

  resetBuilderForProject: (projectId, projectName = '') => set((state) => ({
    builder: {
      ...createInitialBuilder(),
      chartType: state.builder.chartType,
      onlyShowAvailableSamples: state.builder.onlyShowAvailableSamples,
      projectId,
      projectName,
    },
  })),

  resetBuilderForExperiment: ({ experimentId, experimentName = '' }) => set((state) => ({
    builder: {
      ...state.builder,
      experimentId,
      experimentName,
      testTypeId: null,
      testTypeName: '',
      algorithmId: null,
      algorithmName: '',
      titleDraft: '',
      sampleSearch: '',
      selectedSampleIds: [],
    },
  })),

  resetSelectionForTestType: ({ testTypeId, testTypeName = '' }) => set((state) => ({
    builder: {
      ...state.builder,
      testTypeId,
      testTypeName,
      algorithmId: null,
      algorithmName: '',
      titleDraft: '',
      selectedSampleIds: [],
    },
  })),

  setSelectedSampleIds: (selectedSampleIds) => set((state) => ({
    builder: {
      ...state.builder,
      selectedSampleIds,
    },
  })),

  toggleSelectedSampleId: (sampleId) => set((state) => {
    const selectedSampleIds = state.builder.selectedSampleIds.includes(sampleId)
      ? state.builder.selectedSampleIds.filter((id) => id !== sampleId)
      : [...state.builder.selectedSampleIds, sampleId]

    return {
      builder: {
        ...state.builder,
        selectedSampleIds,
      },
    }
  }),

  clearSelectedSampleIds: () => set((state) => ({
    builder: {
      ...state.builder,
      selectedSampleIds: [],
    },
  })),

  resetBuilderAfterCreate: () => set((state) => ({
    builder: {
      ...state.builder,
      titleDraft: '',
      selectedSampleIds: [],
      sampleSearch: '',
    },
  })),

  addCard: (card) => set((state) => {
    const newCard = buildCardPayload(state, card)

    return {
      cards: [...state.cards, newCard],
      selectedCardId: newCard.id,
    }
  }),

  duplicateCard: (cardId) => set((state) => {
    const sourceCard = state.cards.find((card) => card.id === cardId)
    if (!sourceCard) return state

    const duplicatedCard = buildCardPayload(
      state,
      { ...sourceCard, id: null },
      `${sourceCard.title} 副本`
    )

    return {
      cards: [...state.cards, duplicatedCard],
      selectedCardId: duplicatedCard.id,
    }
  }),

  removeCard: (cardId) => set((state) => ({
    cards: state.cards.filter((card) => card.id !== cardId),
    selectedCardId: state.selectedCardId === cardId ? null : state.selectedCardId,
  })),

  updateCard: (cardId, updates) => set((state) => ({
    cards: state.cards.map((card) => {
      if (card.id !== cardId) return card
      return { ...card, ...updates }
    }),
  })),

  updateCardGrid: (cardId, grid) => set((state) => ({
    cards: state.cards.map((card) => {
      if (card.id !== cardId) return card
      return { ...card, grid: { ...card.grid, ...grid } }
    }),
  })),

  updateCardConfig: (cardId, config) => set((state) => ({
    cards: state.cards.map((card) => {
      if (card.id !== cardId) return card
      return { ...card, config: { ...card.config, ...config } }
    }),
  })),

  selectCard: (cardId) => set({ selectedCardId: cardId }),

  clearCards: () => set({ cards: [], selectedCardId: null }),

  setViewport: (viewport) => set((state) => ({
    viewport: { ...state.viewport, ...viewport },
  })),

  requestViewportAction: (type, payload = {}) => set({
    viewportAction: {
      type,
      payload,
      issuedAt: Date.now(),
    },
  }),

  setLayoutName: (layoutName) => set({ layoutName }),

  setLayoutMeta: ({ layoutId = null, layoutName = '' } = {}) => set({
    layoutId,
    layoutName,
  }),

  setSaving: (isSaving) => set({ isSaving }),

  setLoading: (isLoading) => set({ isLoading }),

  setSavedLayouts: (savedLayouts) => set({ savedLayouts, layoutsLoaded: true }),

  resetCanvasState: () => set({
    cards: [],
    selectedCardId: null,
    viewport: createInitialViewport(),
    viewportAction: null,
    layoutName: '',
    layoutId: null,
    builder: createInitialBuilder(),
  }),

  loadLayout: (layoutData, meta = {}) => set({
    cards: layoutData.cards || [],
    viewport: layoutData.viewport || createInitialViewport(),
    layoutName: meta.layoutName || layoutData.name || '',
    layoutId: meta.layoutId ?? null,
    selectedCardId: null,
    builder: {
      ...createInitialBuilder(),
      ...(layoutData.builder || {}),
    },
  }),

  getLayoutData: () => {
    const state = get()
    return {
      id: state.layoutId,
      name: state.layoutName,
      viewport: state.viewport,
      cards: state.cards,
      builder: state.builder,
    }
  },
}))

export default useAnalysisCanvasStore
