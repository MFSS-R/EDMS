import { useState } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, Switch, message, Popconfirm, InputNumber } from 'antd'
import { PlusOutlined, EditOutlined, LockOutlined, SearchOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../services/auth'
import { useAuthStore } from '../store/auth'
import './Analysis.css'

const { Option } = Select

export default function UserManagement() {
  const queryClient = useQueryClient()
  const { user: currentAuthUser } = useAuthStore()
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [passwordModalVisible, setPasswordModalVisible] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 })
  const [filterActive, setFilterActive] = useState(null)
  const [filterStaff, setFilterStaff] = useState(null)

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['adminUsers', pagination, search, filterActive, filterStaff],
    queryFn: () => authApi.getAdminUserList({
      page: pagination.current,
      page_size: pagination.pageSize,
      search: search || undefined,
      is_active: filterActive !== null ? filterActive : undefined,
      is_staff: filterStaff !== null ? filterStaff : undefined,
    }),
  })

  const usersResponse = usersData?.data || usersData
  const users = usersResponse?.results || []
  const total = usersResponse?.count || 0

  const createUserMutation = useMutation({
    mutationFn: (data) => authApi.createAdminUser(data),
    onSuccess: () => {
      message.success('用户创建成功')
      setCreateModalVisible(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
    },
    onError: (error) => {
      const errMsg = error?.data || error?.message || '创建失败'
      if (typeof errMsg === 'object') {
        const firstKey = Object.keys(errMsg)[0]
        message.error(`${firstKey}: ${errMsg[firstKey]}`)
      } else {
        message.error(errMsg)
      }
    },
  })

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => authApi.updateAdminUser(id, data),
    onSuccess: () => {
      message.success('用户更新成功')
      setEditModalVisible(false)
      editForm.resetFields()
      setCurrentUser(null)
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
    },
    onError: (error) => {
      const errMsg = error?.data || error?.message || '更新失败'
      if (typeof errMsg === 'object') {
        const firstKey = Object.keys(errMsg)[0]
        message.error(`${firstKey}: ${errMsg[firstKey]}`)
      } else {
        message.error(errMsg)
      }
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, data }) => authApi.resetAdminUserPassword(id, data),
    onSuccess: () => {
      message.success('密码重置成功')
      setPasswordModalVisible(false)
      passwordForm.resetFields()
      setCurrentUser(null)
    },
    onError: (error) => {
      const errMsg = error?.data || error?.message || '重置失败'
      if (typeof errMsg === 'object') {
        const firstKey = Object.keys(errMsg)[0]
        message.error(`${firstKey}: ${errMsg[firstKey]}`)
      } else {
        message.error(errMsg)
      }
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: (id) => authApi.deleteAdminUser(id),
    onSuccess: () => {
      message.success('用户删除成功')
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
    },
    onError: (error) => {
      message.error(error?.message || '删除失败')
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: (id) => authApi.toggleAdminUserActive(id),
    onSuccess: (response) => {
      const data = response?.data || response
      const action = data?.is_active ? '启用' : '禁用'
      message.success(`用户已${action}`)
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
    },
    onError: (error) => {
      message.error(error?.message || '操作失败')
    },
  })

  const disableUserMutation = useMutation({
    mutationFn: (id) => authApi.deleteAdminUser(id),
    onSuccess: () => {
      message.success('用户已禁用')
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
    },
    onError: (error) => {
      message.error(error?.message || '操作失败')
    },
  })

  const handleCreate = () => {
    form.validateFields().then((values) => {
      createUserMutation.mutate(values)
    })
  }

  const handleEdit = (user) => {
    setCurrentUser(user)
    editForm.setFieldsValue({
      email: user.email,
      real_name: user.real_name,
      phone: user.phone,
      is_active: user.is_active,
      is_staff: user.is_staff,
    })
    setEditModalVisible(true)
  }

  const handleEditSubmit = () => {
    editForm.validateFields().then((values) => {
      updateUserMutation.mutate({ id: currentUser.id, data: values })
    })
  }

  const handleResetPassword = (user) => {
    setCurrentUser(user)
    setPasswordModalVisible(true)
  }

  const handleResetPasswordSubmit = () => {
    passwordForm.validateFields().then((values) => {
      resetPasswordMutation.mutate({ id: currentUser.id, data: values })
    })
  }

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '真实姓名',
      dataIndex: 'real_name',
      key: 'real_name',
      width: 100,
      render: (text) => text || '-',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 180,
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: '角色',
      dataIndex: 'is_staff',
      key: 'is_staff',
      width: 80,
      render: (is_staff) => (
        <Tag color={is_staff ? 'orange' : 'blue'}>
          {is_staff ? '管理员' : '普通用户'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (is_active) => (
        <Tag color={is_active ? 'green' : 'red'}>
          {is_active ? '正常' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '项目数',
      dataIndex: 'project_count',
      key: 'project_count',
      width: 80,
    },
    {
      title: '样品数',
      dataIndex: 'sample_count',
      key: 'sample_count',
      width: 80,
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
    },
    {
      title: '操作',
      key: 'action',
      width: 320,
      render: (_, record) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<LockOutlined />}
            onClick={() => handleResetPassword(record)}
          >
            重置密码
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => toggleActiveMutation.mutate(record.id)}
          >
            {record.is_active ? '禁用' : '启用'}
          </Button>
          <Popconfirm
            title="确定删除这个用户吗？"
            description="删除后将无法恢复。"
            onConfirm={() => deleteUserMutation.mutate(record.id)}
            disabled={currentAuthUser?.id === record.id}
            okText="删除"
            cancelText="取消"
            overlayClassName="user-delete-popconfirm"
            okButtonProps={{
              danger: true,
              style: {
                color: '#ffffff',
                backgroundColor: '#dc2626',
                borderColor: '#dc2626',
              },
            }}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={currentAuthUser?.id === record.id}
              className="user-management-delete-btn"
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="analysis-page">
      <div className="page-header">
        <h2>用户管理</h2>
        <Space wrap>
          <Input
            placeholder="搜索用户名/邮箱/姓名"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPagination({ ...pagination, current: 1 })
            }}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder="状态筛选"
            value={filterActive}
            onChange={(val) => {
              setFilterActive(val)
              setPagination({ ...pagination, current: 1 })
            }}
            allowClear
            style={{ width: 120 }}
          >
            <Option value={true}>正常</Option>
            <Option value={false}>禁用</Option>
          </Select>
          <Select
            placeholder="角色筛选"
            value={filterStaff}
            onChange={(val) => {
              setFilterStaff(val)
              setPagination({ ...pagination, current: 1 })
            }}
            allowClear
            style={{ width: 120 }}
          >
            <Option value={true}>管理员</Option>
            <Option value={false}>普通用户</Option>
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['adminUsers'] })}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            添加用户
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          className="user-management-table"
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title="添加用户"
        open={createModalVisible}
        onOk={handleCreate}
        onCancel={() => { setCreateModalVisible(false); form.resetFields() }}
        confirmLoading={createUserMutation.isPending}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="输入用户名" />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
            <Input placeholder="输入邮箱" />
          </Form.Item>
          <Form.Item name="real_name" label="真实姓名">
            <Input placeholder="输入真实姓名" />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input placeholder="输入手机号" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password placeholder="输入密码" />
          </Form.Item>
          <Form.Item name="password2" label="确认密码" rules={[{ required: true, message: '请确认密码' }]}>
            <Input.Password placeholder="再次输入密码" />
          </Form.Item>
          <Form.Item name="is_staff" label="管理员" valuePropName="checked">
            <Switch checkedChildren="管理员" unCheckedChildren="普通用户" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`编辑用户 - ${currentUser?.username || ''}`}
        open={editModalVisible}
        onOk={handleEditSubmit}
        onCancel={() => { setEditModalVisible(false); editForm.resetFields(); setCurrentUser(null) }}
        confirmLoading={updateUserMutation.isPending}
        width={500}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
            <Input placeholder="输入邮箱" />
          </Form.Item>
          <Form.Item name="real_name" label="真实姓名">
            <Input placeholder="输入真实姓名" />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input placeholder="输入手机号" />
          </Form.Item>
          <Form.Item name="is_active" label="启用状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
          <Form.Item name="is_staff" label="管理员" valuePropName="checked">
            <Switch checkedChildren="管理员" unCheckedChildren="普通用户" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`重置密码 - ${currentUser?.username || ''}`}
        open={passwordModalVisible}
        onOk={handleResetPasswordSubmit}
        onCancel={() => { setPasswordModalVisible(false); passwordForm.resetFields(); setCurrentUser(null) }}
        confirmLoading={resetPasswordMutation.isPending}
        width={400}
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item name="new_password" label="新密码" rules={[{ required: true, message: '请输入新密码' }]}>
            <Input.Password placeholder="输入新密码" />
          </Form.Item>
          <Form.Item name="new_password2" label="确认新密码" rules={[{ required: true, message: '请确认新密码' }]}>
            <Input.Password placeholder="再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
