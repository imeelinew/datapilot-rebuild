import { useCallback, useEffect, useState } from 'react'
import {
  Button, Card, Form, Input, Modal, Popconfirm, Select, Space,
  Switch, Table, Tag, Typography, message, type TableColumnsType,
} from 'antd'
import {
  DeleteOutlined, EditOutlined, KeyOutlined, PlusOutlined,
  ReloadOutlined, SearchOutlined,
} from '@ant-design/icons'
import { roleService, userService } from '@/api/admin'
import type { AdminRole, UserInput } from '@/types/admin'
import type { User } from '@/types/auth'

function UserManage() {
  const [form] = Form.useForm<UserInput>()
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User>()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [username, setUsername] = useState('')
  const [searchUsername, setSearchUsername] = useState('')
  const [status, setStatus] = useState<number>()
  const [roleId, setRoleId] = useState<number>()

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const result = await userService.getList({
        page, pageSize, username: searchUsername || undefined, status, roleId,
      })
      setUsers(result.data.list)
      setTotal(result.data.total)
    } catch (error) {
      console.error(error)
      message.error('获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, roleId, searchUsername, status])

  useEffect(() => { void loadUsers() }, [loadUsers])
  useEffect(() => {
    async function loadRoles() {
      try {
        const result = await roleService.getList()
        setRoles(result.data)
      } catch (error) { console.error(error) }
    }
    void loadRoles()
  }, [])

  function openCreate() {
    setEditingUser(undefined)
    form.resetFields()
    setOpen(true)
  }

  function openEdit(user: User) {
    setEditingUser(user)
    form.setFieldsValue({
      username: user.username || '',
      email: user.email || '',
      roleId: user.roleId || user.role?.id || 0,
    })
    setOpen(true)
  }

  async function handleSave(values: UserInput) {
    setSaving(true)
    try {
      if (editingUser?.id !== undefined) {
        const data = { ...values }
        if (!data.password) delete data.password
        await userService.update(editingUser.id, data)
        message.success('更新用户成功')
      } else {
        await userService.create(values)
        message.success('创建用户成功')
      }
      setOpen(false)
      form.resetFields()
      await loadUsers()
    } catch (error) {
      console.error(error)
      message.error(editingUser ? '更新用户失败' : '创建用户失败')
    } finally { setSaving(false) }
  }

  async function handleStatus(user: User, checked: boolean) {
    if (user.id === undefined) return
    try {
      await userService.setStatus(user.id, checked ? 1 : 0)
      message.success(checked ? '用户已启用' : '用户已禁用')
      await loadUsers()
    } catch (error) {
      console.error(error)
      message.error('修改用户状态失败')
    }
  }

  async function handleResetPassword(user: User) {
    if (user.id === undefined) return
    try {
      const result = await userService.resetPassword(user.id)
      Modal.info({
        title: '密码重置成功',
        content: <Typography.Text copyable code>{result.data.newPassword}</Typography.Text>,
      })
    } catch (error) {
      console.error(error)
      message.error('重置密码失败')
    }
  }

  async function handleDelete(user: User) {
    if (user.id === undefined) return
    try {
      await userService.delete(user.id)
      message.success('删除用户成功')
      await loadUsers()
    } catch (error) {
      console.error(error)
      message.error('删除失败，用户可能存在关联数据')
    }
  }

  const columns: TableColumnsType<User> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '用户名', dataIndex: 'username' },
    { title: '邮箱', dataIndex: 'email', render: (value) => value || '-' },
    {
      title: '角色',
      render: (_, record) => <Tag color="blue">{record.role?.name || record.roleCode || '-'}</Tag>,
    },
    {
      title: '状态', width: 100,
      render: (_, record) => (
        <Switch
          checked={record.status === 1}
          checkedChildren="启用" unCheckedChildren="禁用"
          onChange={(checked) => void handleStatus(record, checked)}
        />
      ),
    },
    {
      title: '最后登录', dataIndex: 'lastLogin',
      render: (value) => value ? new Date(value).toLocaleString() : '-',
    },
    {
      title: '操作', width: 280,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Button type="link" icon={<KeyOutlined />} onClick={() => void handleResetPassword(record)}>重置密码</Button>
          <Popconfirm title="确认删除这个用户吗？" onConfirm={() => void handleDelete(record)}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div className="page-header">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>用户管理</Typography.Title>
          <Typography.Text type="secondary">维护账号、角色和启用状态</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增用户</Button>
      </div>
      <Card size="small">
        <Space wrap>
          <Input
            allowClear value={username} prefix={<SearchOutlined />} placeholder="搜索用户名"
            onChange={(event) => setUsername(event.target.value)}
            onPressEnter={() => { setPage(1); setSearchUsername(username.trim()) }}
            style={{ width: 200 }}
          />
          <Select
            allowClear value={status} placeholder="账号状态"
            options={[{ label: '启用', value: 1 }, { label: '禁用', value: 0 }]}
            onChange={(value) => { setPage(1); setStatus(value) }} style={{ width: 130 }}
          />
          <Select
            allowClear value={roleId} placeholder="角色"
            options={roles.map((role) => ({ label: role.name, value: role.id }))}
            onChange={(value) => { setPage(1); setRoleId(value) }} style={{ width: 160 }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => { setPage(1); setSearchUsername(username.trim()) }}>搜索</Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadUsers()}>刷新</Button>
        </Space>
      </Card>
      <Table<User>
        rowKey={(record) => String(record.id)} loading={loading}
        columns={columns} dataSource={users}
        pagination={{
          current: page, pageSize, total, showSizeChanger: true,
          onChange: (nextPage, nextSize) => {
            setPage(nextSize === pageSize ? nextPage : 1)
            setPageSize(nextSize)
          },
        }}
      />
      <Modal
        open={open} title={editingUser ? '编辑用户' : '新增用户'}
        confirmLoading={saving} okText="保存" cancelText="取消" destroyOnHidden
        onOk={() => form.submit()} onCancel={() => setOpen(false)}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}><Input /></Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ type: 'email' }]}><Input /></Form.Item>
          <Form.Item
            name="password" label={editingUser ? '新密码（不修改请留空）' : '密码'}
            rules={editingUser ? [] : [{ required: true, message: '请输入密码' }, { min: 8, message: '密码至少 8 位' }]}
          ><Input.Password /></Form.Item>
          <Form.Item name="roleId" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select options={roles.map((role) => ({ label: role.name, value: role.id }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

export default UserManage
