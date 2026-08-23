import { useEffect, useState, useMemo } from 'react'
import { Layout, Menu, Button, Space, message, Breadcrumb, theme, type MenuProps } from 'antd'
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
    MoonOutlined,
    SunOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState } from '@/store'
import { clearAuth } from '@/store/authSlice'
import { toggleTheme } from '@/store/appSlice'
import type { MenuNode } from '@/types/menu'
import { filterMenus, getRoleCode } from '@/utils/permission'
import AppErrorBoundary from '@/components/AppErrorBoundary'

const { Header, Sider, Content } = Layout

const menuItems: MenuNode[] = [
    {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: '仪表盘',
        roles: ['super_admin', 'admin', 'analyst', 'user'],
    },
    {
        key: '/data',
        icon: <DatabaseOutlined />,
        label: '数据管理',
        roles: ['super_admin', 'admin', 'analyst'],
        children: [
            {
                key: '/data/dashboards',
                icon: <FundOutlined />,
                label: '仪表盘',
                roles: ['super_admin', 'admin', 'analyst'],
            },
            {
                key: '/data/charts',
                icon: <LineChartOutlined />,
                label: '图表',
                roles: ['super_admin', 'admin', 'analyst'],
            },
        ],
    },
    {
        key: '/visual',
        icon: <PictureOutlined />,
        label: '可视化',
        roles: ['super_admin', 'admin', 'analyst'],
        children: [
            {
                key: '/visual/map',
                icon: <GlobalOutlined />,
                label: '地图可视化',
                roles: ['super_admin', 'admin', 'analyst', 'user'],
            },
            {
                key: '/visual/scene',
                icon: <BlockOutlined />,
                label: '3D 场景',
                roles: ['super_admin', 'admin', 'analyst'],
            },
        ],
    },
    {
        key: '/ai',
        label: 'AI助手',
        icon: <RobotOutlined />,
        roles: ['super_admin', 'admin', 'analyst', 'user'],
    },
    {
        key: '/settings',
        label: '系统管理',
        icon: <SettingOutlined />,
        roles: ['super_admin', 'admin'],
        children: [
            {
                key: '/settings/users',
                label: '用户管理',
                icon: <TeamOutlined />,
                roles: ['super_admin', 'admin'],
            },
            {
                key: '/settings/roles',
                label: '角色权限',
                icon: <SafetyCertificateOutlined />,
                roles: ['super_admin', 'admin'],
            },
        ],
    },
    {
        key: '/profile',
        label: '个人中心',
        icon: <IdcardOutlined />,
        roles: ['super_admin', 'admin', 'analyst', 'user'],
    },
]

function MainLayout() {
    const [collapsed, setCollapsed] = useState(false)
    const [openKeys, setOpenKeys] = useState<string[]>([])
    const navigate = useNavigate()
    const location = useLocation()
    const dispatch = useDispatch()
    const user = useSelector((state: RootState) => state.auth.user)
    const currentTheme = useSelector((state: RootState) => state.app.theme)
    const { token } = theme.useToken()
    const visibleMenuItems = useMemo(
        () => filterMenus(menuItems, getRoleCode(user)),
        [user],
    )

    function handleLogout() {
        dispatch(clearAuth())
        navigate('/login', { replace: true })
        message.success('退出登录成功')
    }

    const currentMenuPath = useMemo(() => {
        return findMenuPath(visibleMenuItems, getMenuPath(location.pathname))
    }, [location.pathname, visibleMenuItems])

    const selectedKey =
        currentMenuPath[currentMenuPath.length - 1]?.key ||
        '/dashboard'

    const defaultOpenKeys = useMemo(
        () => currentMenuPath.slice(0, -1).map((item) => item.key),
        [currentMenuPath],
    )

    useEffect(() => {
        setOpenKeys((currentKeys) => Array.from(new Set([
            ...currentKeys,
            ...defaultOpenKeys,
        ])))
    }, [defaultOpenKeys])

    const breadcrumbItems = currentMenuPath.map((item) => ({
        title: item.label,
    }))

    return (
        <Layout className="main-layout">
            <Sider

                theme={currentTheme}
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
                        color: token.colorPrimary,
                    }}
                >
                    {collapsed ? '城' : '城市视图'}
                </div>

                <Menu
                    theme={currentTheme}
                    mode="inline"
                    //这里如果使用items={menuItems}会报错
                    //因为menuItems 使用的是我们自己定义的 MenuNode[]，方便面包屑递归查找。
                    //Menu 的 items 要求 Ant Design 自己的菜单类型。
                    //两者实际数据结构兼容，但 TypeScript 不确定，所以在传入组件时明确告诉它类型。
                    items={visibleMenuItems as MenuProps['items']}
                    selectedKeys={[selectedKey]}
                    openKeys={openKeys}
                    onOpenChange={(keys) => setOpenKeys(keys as string[])}
                    onClick={(item) => navigate(item.key)}
                />

            </Sider>

            <Layout>
                <Header
                    className="main-header"
                    style={{ background: token.colorBgContainer }}
                >
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
                        <Button
                            type="text"
                            aria-label="切换主题"
                            icon={
                                currentTheme === 'dark'
                                    ? <SunOutlined />
                                    : <MoonOutlined />
                            }
                            onClick={() => dispatch(toggleTheme())}
                        />
                        <span>{user?.username || '用户'}</span>

                        <Button onClick={handleLogout}>
                            退出登录
                        </Button>
                    </Space>
                </Header>

                <Content
                    className="main-content"
                    style={{ background: token.colorBgContainer }}
                >
                    <AppErrorBoundary resetKey={location.pathname}>
                        <Outlet />
                    </AppErrorBoundary>
                </Content>
            </Layout>
        </Layout>
    )
}

// 详情页和编辑页不是独立菜单项，仍然应该高亮它们所属的菜单。
function getMenuPath(pathname: string) {
    if (/^\/data\/dashboards\/\d+$/.test(pathname)) {
        return '/data/dashboards'
    }
    if (pathname === '/data/charts/new' || /^\/data\/charts\/\d+\/edit$/.test(pathname)) {
        return '/data/charts'
    }
    return pathname
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
