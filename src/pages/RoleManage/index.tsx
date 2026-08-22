import { useCallback, useEffect, useState, type Key } from 'react'
import {
  Button, Form, Input, Modal, Popconfirm, Space, Table, Tag,
  Tree, Typography, message, type TableColumnsType, type TreeDataNode,
} from 'antd'
import {
  DeleteOutlined, EditOutlined, PlusOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons'
import { roleService } from '@/api/admin'
import type { AdminRole, PermissionNode, RoleInput } from '@/types/admin'

function toTreeData(nodes: PermissionNode[]): TreeDataNode[] {
  return nodes.map((node) => ({
    key: node.id,
    title: `${node.label}（${node.type}）`,
    children: node.children ? toTreeData(node.children) : undefined,
  }))
}

function collectIds(nodes: PermissionNode[]): number[] {
  return nodes.flatMap((node) => [
    node.id,
    ...(node.children ? collectIds(node.children) : []),
  ])
}

function RoleManage() {
  const [form] = Form.useForm<RoleInput>()
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [permissions, setPermissions] = useState<PermissionNode[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [permissionOpen, setPermissionOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<AdminRole>()
  const [permissionRole, setPermissionRole] = useState<AdminRole>()
  const [checkedKeys, setCheckedKeys] = useState<Key[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [roleResult, permissionResult] = await Promise.all([
        roleService.getList(),
        roleService.getPermissions(),
      ])
      setRoles(roleResult.data)
      setPermissions(permissionResult.data)
    } catch (error) {
      console.error(error)
      message.error('获取角色权限数据失败')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  function openCreate() {
    setEditingRole(undefined)
    form.resetFields()
    setFormOpen(true)
  }

  function openEdit(role: AdminRole) {
    setEditingRole(role)
    form.setFieldsValue({
      name: role.name,
      code: role.code,
      description: role.description || '',
    })
    setFormOpen(true)
  }

  async function handleSave(values: RoleInput) {
    setSaving(true)
    try {
      if (editingRole) {
        await roleService.update(editingRole.id, values)
        message.success('更新角色成功')
      } else {
        await roleService.create(values)
        message.success('创建角色成功')
      }
      setFormOpen(false)
      await loadData()
    } catch (error) {
      console.error(error)
      message.error(editingRole ? '更新角色失败' : '创建角色失败')
    } finally { setSaving(false) }
  }

  async function openPermissions(role: AdminRole) {
    setPermissionRole(role)
    setPermissionOpen(true)
    try {
      const result = await roleService.getDetail(role.id)
      setCheckedKeys(collectIds(result.data.permissions || []))
    } catch (error) {
      console.error(error)
      setCheckedKeys([])
    }
  }

  async function handlePermissions() {
    if (!permissionRole) return
    setSaving(true)
    try {
      await roleService.setPermissions(
        permissionRole.id,
        checkedKeys.map(Number),
      )
      message.success('权限配置成功')
      setPermissionOpen(false)
    } catch (error) {
      console.error(error)
      message.error('权限配置失败')
    } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    try {
      await roleService.delete(id)
      message.success('删除角色成功')
      await loadData()
    } catch (error) {
      console.error(error)
      message.error('删除角色失败，角色可能正在使用')
    }
  }

  const columns: TableColumnsType<AdminRole> = [
    { title: '角色名称', dataIndex: 'name' },
    { title: '角色编码', dataIndex: 'code', render: (value) => <Tag>{value}</Tag> },
    { title: '描述', dataIndex: 'description', render: (value) => value || '-' },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (value) => <Tag color={value === 1 ? 'green' : 'default'}>{value === 1 ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '操作', width: 300,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Button type="link" icon={<SafetyCertificateOutlined />} onClick={() => void openPermissions(record)}>配置权限</Button>
          <Popconfirm title="确认删除这个角色吗？" onConfirm={() => void handleDelete(record.id)}>
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
          <Typography.Title level={3} style={{ margin: 0 }}>角色权限</Typography.Title>
          <Typography.Text type="secondary">管理角色以及菜单、按钮和接口权限</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增角色</Button>
      </div>
      <Table<AdminRole> rowKey="id" loading={loading} columns={columns} dataSource={roles} pagination={false} />

      <Modal
        open={formOpen} title={editingRole ? '编辑角色' : '新增角色'}
        confirmLoading={saving} onOk={() => form.submit()}
        onCancel={() => setFormOpen(false)} destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="角色名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="角色编码" rules={[{ required: true }]}><Input disabled={Boolean(editingRole)} /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        open={permissionOpen}
        title={`配置权限：${permissionRole?.name || ''}`}
        confirmLoading={saving}
        width={640}
        onOk={() => void handlePermissions()}
        onCancel={() => setPermissionOpen(false)}
      >
        <Tree
          checkable
          defaultExpandAll
          checkedKeys={checkedKeys}
          treeData={toTreeData(permissions)}
          onCheck={(keys) => setCheckedKeys(keys as Key[])}
        />
      </Modal>
    </Space>
  )
}

export default RoleManage
