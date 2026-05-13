import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '../services/auth'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      
      setTokens: (access, refresh) => {
        localStorage.setItem('access_token', access)
        localStorage.setItem('refresh_token', refresh)
        set({ accessToken: access, refreshToken: refresh, isAuthenticated: true })
      },
      
      setUser: (user) => set({ user }),
      
      login: async (credentials) => {
        const response = await authApi.login(credentials)
        const data = response.data || response
        const token = data.token || data
        if (token.access) {
          get().setTokens(token.access, token.refresh)
        }
        if (data.user) {
          set({ user: data.user })
        }
        set({ isAuthenticated: true })
        return response
      },
      
      register: async (data) => {
        const response = await authApi.register(data)
        const responseData = response.data || response
        if (responseData.token?.access) {
          get().setTokens(responseData.token.access, responseData.token.refresh)
          set({ user: responseData.user })
        }
        return response
      },
      
      logout: async () => {
        try {
          const refresh = get().refreshToken
          if (refresh) {
            await authApi.logout({ refresh })
          }
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
        }
      },
      
      fetchProfile: async () => {
        try {
          const response = await authApi.getProfile()
          const data = response.data || response
          set({ user: data })
          return response
        } catch (error) {
          get().logout()
          throw error
        }
      },
      
      updateProfile: async (data) => {
        const response = await authApi.updateProfile(data)
        const responseData = response.data || response
        set({ user: responseData })
        return response
      },
      
      changePassword: async (data) => {
        return await authApi.changePassword(data)
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
