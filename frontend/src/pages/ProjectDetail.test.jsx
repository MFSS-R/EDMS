import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProjectDetail from './ProjectDetail'
import { projectApi } from '../services/project'
import { sampleApi } from '../services/sample'

vi.mock('../services/project', () => ({
  projectApi: {
    getDetail: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../services/sample', () => ({
  sampleApi: {
    getList: vi.fn(),
    getTypeList: vi.fn(),
    getExperimentList: vi.fn(),
    batchCreate: vi.fn(),
    batchDelete: vi.fn(),
    batchMark: vi.fn(),
    export: vi.fn(),
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
      <MemoryRouter initialEntries={['/projects/999999']}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ProjectDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sampleApi.getList.mockResolvedValue({ results: [] })
    sampleApi.getTypeList.mockResolvedValue({ results: [] })
    sampleApi.getExperimentList.mockResolvedValue({ results: [] })
  })

  it('shows a missing project state and hides project actions after a 404', async () => {
    projectApi.getDetail.mockRejectedValueOnce({ status: 404, message: 'Not found' })

    renderPage()

    expect(await screen.findByText('项目不存在或已被删除')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /导出 Excel/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /编辑项目/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /删除项目/ })).not.toBeInTheDocument()
  })
})
