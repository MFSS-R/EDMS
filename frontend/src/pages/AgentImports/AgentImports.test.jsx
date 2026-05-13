import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AgentImports from './AgentImports'
import { agentImportApi } from '../../services/agentImport'

vi.mock('../../services/agentImport', () => ({
  normalizeImportList: (response) => {
    if (Array.isArray(response)) return { results: response, count: response.length }
    return { results: response?.results || [], count: response?.count || response?.results?.length || 0 }
  },
  agentImportApi: {
    list: vi.fn(),
    get: vi.fn(),
    getPreview: vi.fn(),
    create: vi.fn(),
    uploadFiles: vi.fn(),
    parse: vi.fn(),
    confirm: vi.fn(),
    retry: vi.fn(),
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
      <AgentImports />
    </QueryClientProvider>
  )
}

describe('AgentImports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading then an empty state when no import jobs exist', async () => {
    agentImportApi.list.mockResolvedValueOnce({ results: [], count: 0 })

    renderPage()

    expect(screen.getByText('加载 Hermes 导入作业...')).toBeInTheDocument()
    expect(await screen.findByText('暂无 Hermes 导入作业')).toBeInTheDocument()
  })

  it('renders job details, preview items, conflicts, errors, and action buttons', async () => {
    agentImportApi.list.mockResolvedValueOnce({
      results: [
        {
          id: 12,
          name: 'Hermes package A',
          status: 'awaiting_confirmation',
          created_at: '2026-05-13T08:00:00Z',
          counts: { items: 2, errors: 1 },
          conflict_items: 1,
          logs: ['created', 'parsed'],
          errors: ['missing sample'],
        },
      ],
      count: 1,
    })
    agentImportApi.get.mockResolvedValueOnce({
      id: 12,
      name: 'Hermes package A',
      status: 'awaiting_confirmation',
      logs: ['created', 'parsed'],
      errors: ['missing sample'],
    })
    agentImportApi.getPreview.mockResolvedValueOnce({
      items: [
        {
          id: 'row-1',
          file_key: 'S-001.csv',
          status: 'failed',
          warnings: [{ detail: 'duplicate external id' }],
          errors: [{ detail: 'missing sample' }],
        },
      ],
    })

    renderPage()

    await userEvent.click(await screen.findByText('Hermes package A'))

    expect(await screen.findByText('作业详情')).toBeInTheDocument()
    expect(await screen.findByText('duplicate external id')).toBeInTheDocument()
    expect(screen.getAllByText('missing sample').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /确认导入/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /重试/ })).toBeEnabled()
  })

  it('does not render an empty backend error object as an error alert', async () => {
    agentImportApi.list.mockResolvedValueOnce({
      results: [
        {
          id: 14,
          name: 'Hermes clean job',
          status: 'succeeded',
          error: {},
        },
      ],
      count: 1,
    })
    agentImportApi.get.mockResolvedValueOnce({
      id: 14,
      name: 'Hermes clean job',
      status: 'succeeded',
      error: {},
    })
    agentImportApi.getPreview.mockResolvedValueOnce({ items: [] })

    renderPage()

    await userEvent.click(await screen.findByText('Hermes clean job'))

    expect(await screen.findByText('暂无错误')).toBeInTheDocument()
    expect(screen.queryByText('{}')).not.toBeInTheDocument()
  })

  it('passes the selected status filter to the job list query', async () => {
    agentImportApi.list.mockResolvedValue({ results: [], count: 0 })

    renderPage()
    await screen.findByText('暂无 Hermes 导入作业')
    await userEvent.click(screen.getByText('全部状态'))
    await userEvent.click(screen.getAllByText('失败').at(-1))

    await waitFor(() => {
      expect(agentImportApi.list).toHaveBeenLastCalledWith({ status: 'failed' })
    })
  })
})
