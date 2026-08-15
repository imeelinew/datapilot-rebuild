import { useState } from 'react'
import { Layout, Menu, Button, Space, message } from 'antd'
import {
    BarChartOutlined,
    DashboardOutlined,
    EnvironmentOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState } from '@/store'
import { clearAuth } from '@/store/authSlice'


const { Header, Sider, Content } = Layout

const menuItems = [
    {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: '数据仪表盘',
    },
    {
        key: '/data/dashboards',
        icon: <BarChartOutlined />,
        label: '仪表盘管理',
    },
    {
        key: '/data/charts',
        icon: <BarChartOutlined />,
        label: '图表管理',
    },
    {
        key: '/visual/map',
        icon: <EnvironmentOutlined />,
        label: '地图可视化',
    },
    {
        key: '/visual/scene',
        icon: <EnvironmentOutlined />,
        label: '3D 场景',
    },
]

function MainLayout() {
    const [collapsed, setCollapsed] = useState(false)
    const navigate = useNavigate()
    const location = useLocation()
    const dispatch = useDispatch()
    const user = useSelector((state: RootState) => state.auth.user)

    function handleLogout() {
        dispatch(clearAuth())
        navigate('/login', { replace: true })
        message.success('退出登录成功')
    }

    return (
        <Layout className="main-layout">
            <Sider

                theme="light"
                collapsed={collapsed}
                trigger={null}
            >
                <div
                    style={{
                        height: 56,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: collapsed ? 16 : 18,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                    }}
                >
                    {collapsed ? 'DP' : 'DataPilot'}
                </div>

                <Menu
                    theme="light"
                    mode="inline"
                    items={menuItems}
                    selectedKeys={[location.pathname]}
                    onClick={(item) => navigate(item.key)}
                />

            </Sider>

            <Layout>
                <Header className="main-header">
                    <Space>
                        <Button
                            type="text"
                            icon={
                                collapsed
                                    ? <MenuUnfoldOutlined />
                                    : <MenuFoldOutlined />
                            }
                            onClick={() => setCollapsed(!collapsed)}
                        />
                        <span>城市数据可视化平台</span>
                    </Space>
                    <Space>
                        <span>{user?.username || '用户'}</span>

                        <Button onClick={handleLogout}>
                            退出登录
                        </Button>
                    </Space>
                </Header>

                <Content className="main-content">
                    <Outlet />
                </Content>
            </Layout>
        </Layout>
    )
}
export default MainLayout;