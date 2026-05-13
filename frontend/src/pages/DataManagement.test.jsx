import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DataManagement from './DataManagement'
import { projectApi } from '../services/project'
import { testApi } from '../services/test'

vi.mock('../services/project', () => ({
  projectApi: {
    getList: vi.fn(),
  },
}))

vi.mock('../services/sample', () => ({
  sampleApi: {
    getList: vi.fn(),
  },
}))

vi.mock('../services/test', () => ({
  testApi: {
    getTypeList: vi.fn(),
    getDataList: vi.fn(),
    createType: vi.fn(),
    generateDataPackage: vi.fn(),
    uploadDataPackage: vi.fn(),
    batchUploadData: vi.fn(),
    deleteData: vi.fn(),
    downloadTestData: vi.fn(),
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
      <MemoryRouter>
        <DataManagement />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('DataManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    projectApi.getList.mockResolvedValue({ results: [] })
    testApi.getTypeList.mockResolvedValue({ results: [] })
  })

  it('shows a clear empty state when there are no projects', async () => {
    renderPage()

    expect(await screen.findByText('暂无项目，请先创建项目/样品')).toBeInTheDocument()
  })
})
