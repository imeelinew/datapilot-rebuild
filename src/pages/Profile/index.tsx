import { useEffect, useState } from 'react'
import {
  Avatar, Button, Card, Col, Descriptions, Form, Input, Row,
  Space, Spin, Tag, Typography, Upload, message,
} from 'antd'
import { UploadOutlined, UserOutlined } from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import authService from '@/api/auth'
import { userService } from '@/api/admin'
import type { RootState } from '@/store'
import { setAuth } from '@/store/authSlice'
import type { User } from '@/types/auth'

type ProfileValues = {
  username: string
  email?: string
  password?: string
}

function Profile() {
  const dispatch = useDispatch()
  const token = useSelector((state: RootState) => state.auth.token)
  const [form] = Form.useForm<ProfileValues>()
  const [user, setUser] = useState<User>()
  const [avatar, setAvatar] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      try {
        const result = await authService.getMe()
        setUser(result.data)
        setAvatar(result.data.avatar || undefined)
        form.setFieldsValue({
          username: result.data.username || '',
          email: result.data.email || '',
        })
      } catch (error) {
        console.error(error)
        message.error('获取个人资料失败')
      } finally { setLoading(false) }
    }
    void loadProfile()
  }, [form])

  async function uploadAvatar(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      message.error('头像不能超过 2MB')
      return
    }
    setUploading(true)
    try {
      const result = await userService.uploadAvatar(file)
      setAvatar(result.data.url)
      message.success('头像上传成功，保存资料后生效')
    } catch (error) {
      console.error(error)
      message.error('头像上传失败')
    } finally { setUploading(false) }
  }

  async function handleSave(values: ProfileValues) {
    if (user?.id === undefined) return
    setSaving(true)
    try {
      const data = {
        username: values.username,
        email: values.email,
        avatar,
        password: values.password || undefined,
      }
      const result = await userService.update(user.id, data)
      const nextUser = result.data || { ...user, ...data }
      setUser(nextUser)
      dispatch(setAuth({ token, user: nextUser }))
      form.setFieldValue('password', undefined)
      message.success('个人资料保存成功')
    } catch (error) {
      console.error(error)
      message.error('保存个人资料失败')
    } finally { setSaving(false) }
  }

  if (loading) return <Spin fullscreen description="正在加载个人资料" />

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>个人中心</Typography.Title>
        <Typography.Text type="secondary">查看账号信息并维护个人资料</Typography.Text>
      </div>
      <Row gutter={24}>
        <Col span={8}>
          <Card style={{ textAlign: 'center' }}>
            <Avatar size={96} src={avatar} icon={<UserOutlined />} />
            <Typography.Title level={4}>{user?.username}</Typography.Title>
            <Tag color="blue">{user?.role?.name || user?.roleCode || '用户'}</Tag>
            <div style={{ marginTop: 20 }}>
              <Upload
                accept="image/png,image/jpeg,image/gif,image/webp"
                showUploadList={false}
                beforeUpload={(file) => {
                  void uploadAvatar(file as File)
                  return false
                }}
              >
                <Button icon={<UploadOutlined />} loading={uploading}>更换头像</Button>
              </Upload>
            </div>
            <Descriptions
              column={1}
              size="small"
              style={{ marginTop: 24, textAlign: 'left' }}
              items={[
                { key: 'status', label: '状态', children: user?.status === 0 ? '禁用' : '启用' },
                { key: 'lastLogin', label: '最后登录', children: user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : '-' },
                { key: 'createdAt', label: '注册时间', children: user?.createdAt ? new Date(user.createdAt).toLocaleString() : '-' },
              ]}
            />
          </Card>
        </Col>
        <Col span={16}>
          <Card title="编辑资料">
            <Form form={form} layout="vertical" onFinish={handleSave}>
              <Form.Item name="username" label="用户名" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="email" label="邮箱" rules={[{ type: 'email' }]}><Input /></Form.Item>
              <Form.Item name="password" label="新密码（不修改请留空）" rules={[{ min: 8, message: '密码至少 8 位' }]}><Input.Password /></Form.Item>
              <Button type="primary" htmlType="submit" loading={saving}>保存修改</Button>
            </Form>
          </Card>
        </Col>
      </Row>
    </Space>
  )
}

export default Profile
