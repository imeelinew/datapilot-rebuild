import { ConfigProvider, theme as antdTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import AppRouter from './router/index'
import type { RootState } from '@/store'
import AppErrorBoundary from '@/components/AppErrorBoundary'

function App() {
  const currentTheme = useSelector((state: RootState) => state.app.theme)
  const location = useLocation()
  const isLoginPage = location.pathname === '/login'

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm:
          !isLoginPage && currentTheme === 'dark'
            ? antdTheme.darkAlgorithm
            : antdTheme.defaultAlgorithm,
      }}
    >
      <AppErrorBoundary resetKey={location.pathname}>
        <AppRouter />
      </AppErrorBoundary>
    </ConfigProvider>
  )
}

export default App
