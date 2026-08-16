import { useState, useMemo } from 'react'
import { Layout, Menu, Button, Space, message, Breadcrumb,type MenuProps } from 'antd'
import {
    BlockOutlined,
    DashboardOutlined,
    DatabaseOutlined,
    FundOutlined,
    GlobalOutlined,
    IdcardOutlined,
    LineChartOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    PictureOutlined,
    RobotOutlined,
    SafetyCertificateOutlined,
    SettingOutlined,
    TeamOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState } from '@/store'
import { clearAuth } from '@/store/authSlice'
import type { MenuNode } from '@/types/menu'

const { Header, Sider, Content } = Layout

const menuItems: MenuNode[] = [
    {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: '仪表盘',
    },
    {
        key: '/data',
        icon: <DatabaseOutlined />,
        label: '数据管理',
        children: [
            {
                key: '/data/dashboards',
                icon: <FundOutlined />,
                label: '仪表盘',
            },
            {
                key: '/data/charts',
                icon: <LineChartOutlined />,
                label: '图表',
            },
        ],
    },
    {
        key: '/visual',
        icon: <PictureOutlined />,
        label: '可视化',
        children: [
            {
                key: '/visual/map',
                icon: <GlobalOutlined />,
                label: '地图可视化',
            },
            {
                key: '/visual/scene',
                icon: <BlockOutlined />,
                label: '3D 场景',
            },
        ],
    },
    {
        key: '/ai',
        label: 'AI助手',
        icon: <RobotOutlined />,
    },
    {
        key: '/settings',
        label: '系统管理',
        icon: <SettingOutlined />,
        children: [
            {
                key: '/settings/users',
                label: '用户管理',
                icon: <TeamOutlined />,
            },
            {
                key: '/settings/roles',
                label: '角色权限',
                icon: <SafetyCertificateOutlined />,
            },
        ],
    },
    {
        key: '/profile',
        label: '个人中心',
        icon: <IdcardOutlined />,
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

    const currentMenuPath = useMemo(() => {
        return findMenuPath(menuItems, location.pathname)
    }, [location.pathname])

    const selectedKey =
        currentMenuPath[currentMenuPath.length - 1]?.key ||
        '/dashboard'

    const defaultOpenKeys = currentMenuPath
        .slice(0, -1)
        .map((item) => item.key)

    const breadcrumbItems = currentMenuPath.map((item) => ({
        title: item.label,
    }))

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
                    //这里如果使用items={menuItems}会报错
                    //因为menuItems 使用的是我们自己定义的 MenuNode[]，方便面包屑递归查找。
                    //Menu 的 items 要求 Ant Design 自己的菜单类型。
                    //两者实际数据结构兼容，但 TypeScript 不确定，所以在传入组件时明确告诉它类型。
                    items={menuItems as MenuProps['items']}
                    selectedKeys={[selectedKey]}
                    defaultOpenKeys={defaultOpenKeys}
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
                    <Breadcrumb items={breadcrumbItems} />
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
//这段不好理解，回头多看看
function findMenuPath(
    menus: MenuNode[],
    pathname: string,
    parents: MenuNode[] = []
): MenuNode[] {
    for (const item of menus) {
        const currentPath = [...parents, item]
        if (item.key === pathname) {
            return currentPath
        }
        if (item.children) {
            const childPath = findMenuPath(item.children, pathname, currentPath)
            if (childPath.length > 0) {
                return childPath
            }
        }
    }
    return []
}
export default MainLayout;