import { useState, useEffect, useMemo } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Dropdown, Avatar, Button, theme, Switch } from 'antd'
import {
  DashboardOutlined,
  ProjectOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SunOutlined,
  MoonOutlined,
  DatabaseOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../../store/auth'
import { resolveMediaUrl } from '../../utils/media'
import FileTree from '../FileTree'
import './MainLayout.css'

const { Header, Sider, Content } = Layout

const baseMenuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '概览' },
  { key: '/projects', icon: <ProjectOutlined />, label: '项目管理' },
  { key: '/samples', icon: <AppstoreOutlined />, label: '样品管理' },
  {
    key: '/data-management',
    icon: <DatabaseOutlined />,
    label: '数据管理',
    children: [
      { key: '/data-management/main', label: '数据管理' },
      { key: '/data-management/agent-imports', label: 'Hermes Agent 导入' },
      { key: '/test-data', label: '测试数据查看' },
    ],
  },
  {
    key: '/analysis',
    icon: <BarChartOutlined />,
    label: '数据分析',
    children: [
      { key: '/analysis/canvas', label: '画布对比分析' },
      { key: '/analysis/algorithms', label: '数据处理算法管理' },
    ],
  },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
]

const adminMenuItems = [
  { key: '/admin/users', icon: <TeamOutlined />, label: '用户管理' },
]

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { token: { colorBgContainer } } = theme.useToken()
  const avatarSrc = useMemo(() => {
    if (!user?.avatar) return undefined
    const resolvedAvatarUrl = resolveMediaUrl(user.avatar)
    if (!resolvedAvatarUrl) return undefined
    const joiner = resolvedAvatarUrl.includes('?') ? '&' : '?'
    return `${resolvedAvatarUrl}${joiner}v=${user.updated_at || Date.now()}`
  }, [user?.avatar, user?.updated_at])
  const userIdentity = useMemo(() => {
    if (!user) return ''
    if (user.real_name && user.username && user.real_name !== user.username) {
      return `${user.real_name} (@${user.username})`
    }
    return user.username || user.real_name || ''
  }, [user])

  const menuItems = useMemo(() => {
    const isAdmin = user?.is_staff || user?.is_admin
    if (isAdmin) {
      return [...baseMenuItems, ...adminMenuItems]
    }
    return baseMenuItems
  }, [user?.is_staff, user?.is_admin])

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setDarkMode(true)
      document.documentElement.setAttribute('data-theme', 'dark')
    }
  }, [])

  useEffect(() => {
    if (location.pathname === '/analysis/canvas') {
      setCollapsed(true)
    }
  }, [location.pathname])

  const toggleDarkMode = (checked) => {
    setDarkMode(checked)
    if (checked) {
      document.documentElement.setAttribute('data-theme', 'dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
      localStorage.setItem('theme', 'light')
    }
  }

  const handleMenuClick = ({ key }) => {
    navigate(key)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
      onClick: () => navigate('/settings'),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ]

  const getSelectedKey = () => {
    const path = location.pathname
    if (path.startsWith('/projects')) return '/projects'
    if (path.startsWith('/samples')) return '/samples'
    if (path.startsWith('/data-management')) return '/data-management'
    if (path.startsWith('/test-data')) return '/data-management'
    if (path.startsWith('/analysis')) return '/analysis'
    if (path.startsWith('/settings')) return '/settings'
    if (path.startsWith('/admin/users')) return '/admin/users'
    return '/dashboard'
  }

  return (
    <Layout className="main-layout">
      <Sider
        width={280}
        collapsedWidth={0}
        collapsed={collapsed}
        className="main-sider"
        trigger={null}
      >
        <div className="sider-content">
          <div className="sider-menu">
            <Menu
              mode="vertical"
              selectedKeys={[getSelectedKey()]}
              items={menuItems}
              onClick={handleMenuClick}
              className="nav-menu"
            />
          </div>
          <div className="file-tree-container">
            <FileTree />
          </div>
        </div>
      </Sider>
      <Layout>
        <Header className="main-header" style={{ background: colorBgContainer }}>
          <div className="header-left">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="collapse-btn"
            />
            <span className="header-title">实验数据管理系统 EDMS</span>
          </div>
          <div className="header-right">
            <div className="theme-toggle">
              <SunOutlined className={!darkMode ? 'theme-icon active' : 'theme-icon'} />
              <Switch
                size="small"
                checked={darkMode}
                onChange={toggleDarkMode}
                className="theme-switch"
              />
              <MoonOutlined className={darkMode ? 'theme-icon active' : 'theme-icon'} />
            </div>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div className="user-info">
                <Avatar icon={<UserOutlined />} src={avatarSrc} className="user-avatar" />
                <span className="user-name">{userIdentity}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content className="main-content">
          <div className="page-container">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
