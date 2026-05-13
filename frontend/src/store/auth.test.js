import { beforeEach, describe, expect, it, vi } from 'vitest'

import { authApi } from '../services/auth'
import { useAuthStore } from './auth'

vi.mock('../services/auth', () => ({
  authApi: {
    register: vi.fn(),
  },
}))

const initialState = useAuthStore.getState()

describe('auth store registration', () => {
  beforeEach(() => {
    localStorage.clear()
    authApi.register.mockReset()
    useAuthStore.setState({
      ...initialState,
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    }, true)
  })

  it('does not authenticate registration responses that do not include tokens', async () => {
    authApi.register.mockResolvedValue({
      data: {
        user: { id: 1, username: 'newuser' },
      },
    })

    await useAuthStore.getState().register({
      username: 'newuser',
      password: 'strong-password-123',
    })

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })
})
