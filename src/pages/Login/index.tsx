import {
    useCallback,
    useEffect,
    useState,
} from 'react'
import {
    Button,
    Card,
    Form,
    Input,
    Typography,
    message,
} from 'antd'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import authService from '@/api/auth'
import { setAuth } from '@/store/authSlice'
import type { LoginFormValues } from '@/types/auth'

function Login() {
    const dispatch = useDispatch()
    const navigate = useNavigate()

    const [captchaId, setCaptchaId] = useState('')
    const [captchaImg, setCaptchaImg] = useState('')
    const [loading, setLoading] = useState(false)

    const loadCaptcha = useCallback(async () => {
        try {
            const result = await authService.getCaptcha()
            setCaptchaId(result.data.captchaId)
            const svg = result.data.svg
            const base64 = window.btoa(
                unescape(encodeURIComponent(svg)),
            )
            setCaptchaImg(
                `data:image/svg+xml;base64,${base64}`,
            )
        } catch (error) {
            console.error('Failed to load captcha:', error)
            message.error('验证码加载失败')
        }
    }, [])

    useEffect(() => {
        void loadCaptcha()
    }, [loadCaptcha])

    async function handleLogin(values: LoginFormValues) {
        setLoading(true)

        try {
            const result = await authService.login({
                username: values.username,
                password: values.password,
                captchaId,
                captchaCode: values.captchaCode,
            })
            if (result.code !== 200) {
                message.error(result.message || '登录失败')
                void loadCaptcha()
                return
            }
            dispatch(
                setAuth({
                    token: result.data.token,
                    user: result.data.user,
                })
            )
            message.success('登录成功')
            navigate('/dashboard', { replace: true })
            console.log(result.data)
        } catch (error) {
            console.error('Failed to login:', error)
            message.error('登录失败')
            void loadCaptcha()
        } finally {
            setLoading(false)
        }
    }
    return (
        <div className='login-page'>
            <Card className='login-card'>
                <Typography.Title level={3}>DataPilot</Typography.Title>

                <Form
                    layout='vertical'
                    onFinish={handleLogin}>
                    <Form.Item
                        label="用户名"
                        name="username"
                        rules={[
                            {
                                required: true,
                                message: '请输入用户名',
                            },
                        ]}
                    >
                        <Input placeholder="请输入用户名" />
                    </Form.Item>
                    <Form.Item
                        label="密码"
                        name="password"
                        rules={[
                            {
                                required: true,
                                message: '请输入密码',
                            },
                        ]}
                    >
                        <Input.Password placeholder="请输入密码" />
                    </Form.Item>
                    <Form.Item label="验证码" required>
                        <div className="captcha-row">
                            <Form.Item
                                name="captchaCode"
                                noStyle
                                rules={[
                                    {
                                        required: true,
                                        message: '请输入验证码',
                                    },
                                ]}
                            >
                                <Input placeholder="验证码" />
                            </Form.Item>

                            <div
                                className="captcha-image"
                                onClick={() => void loadCaptcha()}
                            >
                                {captchaImg ? (
                                    <img src={captchaImg} alt="验证码" />
                                ) : (
                                    <span>加载中</span>
                                )}
                            </div>
                        </div>
                    </Form.Item>
                    <Button
                        type="primary"
                        htmlType="submit"
                        block
                        loading={loading}
                    >
                        登录
                    </Button>
                </Form>
            </Card>
        </div>
    )
}
export default Login