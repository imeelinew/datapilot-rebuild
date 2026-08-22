import { lazy, Suspense } from 'react'
import { Spin } from 'antd'
import { Navigate, Route, Routes } from 'react-router-dom'
import RequireAuth, { GuestOnly } from '../components/RequireAuth'

const MainLayout = lazy(() => import('../layouts/MainLayout'))
const Login = lazy(() => import('../pages/Login'))
const Dashboard = lazy(() => import('../pages/Dashboard'))
const DashboardDetail = lazy(() => import('../pages/DashboardDetail'))
const DashboardManage = lazy(() => import('../pages/DashboardManage'))
const ChartManage = lazy(() => import('../pages/ChartManage'))
const ChartEditor = lazy(() => import('../pages/ChartEditor'))
const MapView = lazy(() => import('../pages/MapView'))
const Scene3D = lazy(() => import('../pages/Scene3D'))
const AIChat = lazy(() => import('../pages/AIChat'))
const UserManage = lazy(() => import('../pages/UserManage'))
const RoleManage = lazy(() => import('../pages/RoleManage'))
const Profile = lazy(() => import('../pages/Profile'))

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
