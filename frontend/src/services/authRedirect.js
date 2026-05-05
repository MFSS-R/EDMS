const REDIRECT_FLAG = 'edms_auth_redirecting'

export function clearAuthRedirectFlag() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(REDIRECT_FLAG)
}

export function redirectToLoginOnce() {
  if (typeof window === 'undefined') return
  if (window.location.pathname === '/login') return
  if (sessionStorage.getItem(REDIRECT_FLAG) === '1') return

  sessionStorage.setItem(REDIRECT_FLAG, '1')
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  window.location.replace('/login')
}
