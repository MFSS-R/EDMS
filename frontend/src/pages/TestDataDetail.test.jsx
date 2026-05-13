import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TestDataDetail from './TestDataDetail'
import { analysisApi } from '../services/analysis'
import { testApi } from '../services/test'

vi.mock('../components/DataChart', () => ({
  default: () => <div data-testid="data-chart" />,
}))

vi.mock('../services/test', () => ({
  testApi: {
    getDataDetail: vi.fn(),
    updateData: vi.fn(),
    deleteData: vi.fn(),
    deleteFile: vi.fn(),
    downloadFile: vi.fn(),
  },
}))

vi.mock('../services/analysis', () => ({
  analysisApi: {
    getPlotDataByTestData: vi.fn(),
    getAlgorithmList: vi.fn(),
    processPlotData: vi.fn(),
  },
}))

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/test-data/999999']}>
        <Routes>
          <Route path="/test-data/:id" element={<TestDataDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('TestDataDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    analysisApi.getPlotDataByTestData.mockResolvedValue({ data: null })
    analysisApi.getAlgorithmList.mockResolvedValue({ results: [] })
  })

  it('shows a missing test data state and hides detail actions after a 404', async () => {
    testApi.getDataDetail.mockRejectedValueOnce({ status: 404, message: 'Not found' })

    renderPage()

    expect(await screen.findByText('测试数据不存在或已被删除')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /编辑/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /删除/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /生成图表|重新生成/ })).not.toBeInTheDocument()
  })
})
