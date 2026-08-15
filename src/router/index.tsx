import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import PlaceholderPage from '../pages/_shared/PlaceholderPage'
import RequireAuth, { GuestOnly } from '../components/RequireAuth'
function AppRouter() {
    return (
        <Routes>
            <Route path="/login" element={
                <GuestOnly>
                    <Login />
                </GuestOnly>
            }></Route>
            <Route path="/" element={
                <RequireAuth>
                    <MainLayout />
                </RequireAuth>
            }>
                <Route
                    index
                    element={<Navigate to="/dashboard" replace />}
                />

                <Route path="dashboard" element={<Dashboard />} />
                <Route
                    path="data/dashboards"
                    element={
                        <PlaceholderPage
                            title="仪表盘管理"
                            description="管理和配置数据仪表盘"
                        />
                    }
                />
                <Route
                    path="data/charts"
                    element={
                        <PlaceholderPage
                            title="图表管理"
                            description="管理动态图表和数据源"
                        />
                    }
                />

                <Route
                    path="visual/map"
                    element={
                        <PlaceholderPage
                            title="地图可视化"
                            description="展示城市和环境监测数据"
                        />
                    }
                />

                <Route
                    path="visual/scene"
                    element={
                        <PlaceholderPage
                            title="3D 场景"
                            description="展示城市三维数据"
                        />
                    }
                />
            </Route>
            <Route
                path="ai"
                element={
                    <PlaceholderPage
                        title="AI 助手"
                        description="智能问答与数据分析"
                    />
                }
            />

            <Route
                path="settings/users"
                element={
                    <PlaceholderPage
                        title="用户管理"
                        description="管理系统用户"
                    />
                }
            />

            <Route
                path="settings/roles"
                element={
                    <PlaceholderPage
                        title="角色权限"
                        description="管理角色和页面权限"
                    />
                }
            />

            <Route
                path="profile"
                element={
                    <PlaceholderPage
                        title="个人中心"
                        description="查看和修改个人信息"
                    />
                }
            />
            <Route
                path="*"
                element={<Navigate to="/dashboard" replace />}
            />
        </Routes>
    )
}
export default AppRouter;