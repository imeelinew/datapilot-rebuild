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
  const isDark = !isLoginPage && currentTheme === 'dark'
  const layoutBackground = isDark ? '#0f1720' : '#f4f6f8'
  const containerBackground = isDark ? '#151e2b' : '#ffffff'
  const borderColor = isDark ? '#2b3645' : '#e2e7ee'

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm:
          isDark
            ? antdTheme.darkAlgorithm
            : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#2f66b3',
          colorInfo: '#2f66b3',
          colorSuccess: '#28845a',
          colorWarning: '#b7791f',
          colorError: '#c24141',
          colorBgLayout: layoutBackground,
          colorBgContainer: containerBackground,
          colorBorder: borderColor,
          colorBorderSecondary: borderColor,
          borderRadius: 8,
          borderRadiusLG: 10,
          controlHeight: 36,
          fontFamily:
            'Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
        },
        components: {
          Button: {
            fontWeight: 500,
            primaryShadow: 'none',
          },
          Card: {
            headerFontSize: 15,
            headerHeight: 48,
            bodyPadding: 20,
          },
          Layout: {
            bodyBg: layoutBackground,
            headerBg: containerBackground,
            siderBg: containerBackground,
          },
          Menu: {
            itemBorderRadius: 6,
            itemHeight: 40,
            itemMarginInline: 10,
            itemSelectedBg: isDark ? '#203651' : '#eaf0f8',
            itemSelectedColor: isDark ? '#a9c7ef' : '#234f8d',
          },
          Table: {
            headerBg: isDark ? '#1b2634' : '#f7f8fa',
            headerColor: isDark ? '#cbd5e1' : '#475467',
            rowHoverBg: isDark ? '#1b2938' : '#f7f9fc',
            borderColor,
          },
        },
      }}
    >
      <AppErrorBoundary resetKey={location.pathname}>
        <AppRouter />
      </AppErrorBoundary>
    </ConfigProvider>
  )
}

export default App
