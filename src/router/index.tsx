import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import DashboardDetail from '../pages/DashboardDetail'
import RequireAuth, { GuestOnly } from '../components/RequireAuth'
import DashboardManage from '../pages/DashboardManage'
import ChartManage from '../pages/ChartManage'
import MapView from '../pages/MapView'
import Scene3D from '../pages/Scene3D'
import AIChat from '../pages/AIChat'
import UserManage from '../pages/UserManage'
import RoleManage from '../pages/RoleManage'
import Profile from '../pages/Profile'

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
                    path="data/dashboards/:id"
                    element={<DashboardDetail />}
                />
                <Route path="data/dashboards" element={<DashboardManage />} />
                <Route path="data/charts" element={<ChartManage />} />
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
    )
}
export default AppRouter;
