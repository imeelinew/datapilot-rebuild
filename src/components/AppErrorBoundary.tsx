import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { Button, Result, Space } from 'antd'

type AppErrorBoundaryProps = {
  children: ReactNode
  resetKey: string
}

type AppErrorBoundaryState = {
  error: Error | null
}

class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page rendering failed', error, info)
  }

  componentDidUpdate(previousProps: AppErrorBoundaryProps) {
    if (
      this.state.error &&
      previousProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <Result
        status="error"
        title="页面加载失败"
        subTitle="页面资源可能刚刚更新，请刷新后重试。"
        extra={(
          <Space wrap>
            <Button type="primary" onClick={() => window.location.reload()}>
              刷新页面
            </Button>
            <Button onClick={() => window.location.assign('/dashboard')}>
              返回仪表盘
            </Button>
          </Space>
        )}
      />
    )
  }
}

export default AppErrorBoundary
