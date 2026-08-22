import request from '@/utils/request'
import type {
  ApiResult,
  CaptchaData,
  LoginData,
  LoginParams,
  User,
} from '@/types/auth'

const authService = {
  getCaptcha() {
    return request.get('/auth/captcha') as Promise<
      ApiResult<CaptchaData>
    >
  },

  login(data: LoginParams) {
    return request.post('/auth/login', data) as Promise<
      ApiResult<LoginData>
    >
  },

  getMe() {
    return request.get('/auth/me') as Promise<ApiResult<User>>
  },
}

export default authService
