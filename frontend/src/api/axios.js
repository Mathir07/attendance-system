import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Global response error handler
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Only force-redirect on 401 for authenticated API calls.
    // Never redirect on a login attempt — that 401 is an expected
    // "wrong credentials" response and should be handled by the caller.
    const isLoginAttempt = err.config?.url === '/auth/login'
    if (err.response?.status === 401 && !isLoginAttempt) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
