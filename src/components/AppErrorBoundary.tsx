import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { Alert, Button } from 'antd'

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
  private retryCount = 0
  private retryTimer: number | undefined

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page rendering failed', error, info)

    if (this.retryCount === 0) {
      this.retryCount = 1
      this.retryTimer = window.setTimeout(() => {
        this.setState({ error: null })
      }, 150)
    }
  }

  componentDidUpdate(previousProps: AppErrorBoundaryProps) {
    if (
      previousProps.resetKey !== this.props.resetKey
    ) {
      window.clearTimeout(this.retryTimer)
      this.retryCount = 0
      this.setState({ error: null })
    }
  }

  componentWillUnmount() {
    window.clearTimeout(this.retryTimer)
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <Alert
        type="warning"
        title="当前内容暂时不可用"
        action={
          <Button size="small" onClick={() => window.location.reload()}>
            重试
          </Button>
        }
      />
    )
  }
}

export default AppErrorBoundary
