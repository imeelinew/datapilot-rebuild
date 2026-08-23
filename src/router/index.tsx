import { Suspense } from 'react'
import { Spin } from 'antd'
import { Navigate, Route, Routes } from 'react-router-dom'
import RequireAuth, { GuestOnly } from '../components/RequireAuth'
import { lazyWithRetry } from '@/utils/lazyWithRetry'

const MainLayout = lazyWithRetry(() => import('../layouts/MainLayout'), 'layout')
const Login = lazyWithRetry(() => import('../pages/Login'), 'login')
const Dashboard = lazyWithRetry(() => import('../pages/Dashboard'), 'dashboard')
const DashboardDetail = lazyWithRetry(
    () => import('../pages/DashboardDetail'),
    'dashboard-detail',
)
const DashboardManage = lazyWithRetry(
    () => import('../pages/DashboardManage'),
    'dashboard-manage',
)
const ChartManage = lazyWithRetry(
    () => import('../pages/ChartManage'),
    'chart-manage',
)
const ChartEditor = lazyWithRetry(
    () => import('../pages/ChartEditor'),
    'chart-editor',
)
const MapView = lazyWithRetry(() => import('../pages/MapView'), 'map')
const Scene3D = lazyWithRetry(() => import('../pages/Scene3D'), 'scene-3d')
const AIChat = lazyWithRetry(() => import('../pages/AIChat'), 'ai-chat')
const UserManage = lazyWithRetry(
    () => import('../pages/UserManage'),
    'user-manage',
)
const RoleManage = lazyWithRetry(
    () => import('../pages/RoleManage'),
    'role-manage',
)
const Profile = lazyWithRetry(() => import('../pages/Profile'), 'profile')

function AppRouter() {
    return (
        <Suspense fallback={<Spin fullscreen description="页面加载中" />}>
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
                    path="data/dashboards/:id"
                    element={<DashboardDetail />}
                />
                <Route path="data/dashboards" element={<DashboardManage />} />
                <Route path="data/charts" element={<ChartManage />} />
                <Route path="data/charts/new" element={<ChartEditor />} />
                <Route
                    path="data/charts/:id/edit"
                    element={<ChartEditor />}
                />
                <Route path="visual/map" element={<MapView />} />
                <Route path="visual/scene" element={<Scene3D />} />
                <Route path="ai" element={<AIChat />} />
                <Route path="settings/users" element={<UserManage />} />
                <Route path="settings/roles" element={<RoleManage />} />
                <Route path="profile" element={<Profile />} />
            </Route>
            <Route
                path="*"
                element={<Navigate to="/dashboard" replace />}
            />
          </Routes>
        </Suspense>
    )
}
export default AppRouter;
