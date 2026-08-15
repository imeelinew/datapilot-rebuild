import axios from 'axios'
import { store } from '@/store'
import { clearAuth } from '@/store/authSlice'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

request.interceptors.request.use(
  (config) => {
    const token = store.getState().auth.token

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },

  (error) => {
    return Promise.reject(error)
  },
)

request.interceptors.response.use(
  (response) => {
    return response.data
  },

  (error) => {
    const status = error.response?.status
    const url = error.config?.url || ''

    const isLoginRequest = url.includes('/auth/login')

    if (status === 401 && !isLoginRequest) {
      store.dispatch(clearAuth())
    }

    return Promise.reject(error)
  },
)

export default request