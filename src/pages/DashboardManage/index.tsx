import { useCallback } from 'react'
import { dashboardManageService } from '@/api/dashboardManage'
import { useEffect, useState } from 'react'
import {
  Card,
  Col,
  Empty,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
  message,
  Input,
  Button,
  Form,
  Modal,
  Select,
  Popconfirm
} from 'antd'
import { CopyOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons'
const { Title, Text, Paragraph } = Typography
import type { DashboardInput, DashboardItem } from '@/types/dashboardManage'
import { useNavigate } from 'react-router-dom'
function DashboardManage() {
  const [dashboards, setDashboards] = useState<DashboardItem[]>([])
  const [loading, setLoading] = useState(false)
  //搜索功能
  const [keyword, setKeyword] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  //创建仪表盘功能
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  //复制和删除 都是拿id
  const [actionId, setActionId] = useState<number | null>(null)
  //查看仪表盘功能
  const navigate = useNavigate()

  const [form] = Form.useForm<DashboardInput>()

  const loadDashboards = useCallback(async () => {
    setLoading(true)

    try {
      const result = await dashboardManageService.getList({
        page: 1,
        pageSize: 20,
        keyword: searchKeyword || undefined
      })
      setDashboards(result.data.list)
    } catch (error) {
      message.error('获取仪表盘列表失败')
    } finally {
      setLoading(false)
    }
  }, [searchKeyword])

  useEffect(() => {
    loadDashboards()
  }, [loadDashboards])

  function handleSearch() {
    setSearchKeyword(keyword.trim())
  }
  //创建
  async function handleCreate(values: DashboardInput) {
    setCreating(true)
    try {
      await dashboardManageService.create(values)
      message.success('创建仪表盘成功')
      setCreateOpen(false)
      form.resetFields()
      await loadDashboards()
    } catch (error) {
      console.error(error)
      message.error('创建仪表盘失败')
    } finally {
      setCreating(false)
    }
  }
  //复制
  async function handleClone(id: number) {
    setActionId(id)
    try {
      await dashboardManageService.clone(id)
      message.success('复制仪表盘成功')
      await loadDashboards()
    } catch (error) {
      console.error(error)
      message.error('复制仪表盘失败')
    } finally {
      setActionId(null)
    }
  }
  //删除
  async function handleDelete(id: number) {
    setActionId(id)
    try {
      await dashboardManageService.delete(id)
      message.success('删除仪表盘成功')
      await loadDashboards()
    } catch (error) {
      console.error(error)
      message.error('删除仪表盘失败')
    } finally {
      setActionId(null)
    }
  }

  return (
    <Space
      orientation='vertical'
      size='large'
      style={{ width: '100%' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          仪表盘管理
        </Title>
        <Text type='secondary'>查看和维护已经创建的仪表盘</Text>
      </div>
      <Space.Compact>
        <Input
          allowClear
          placeholder="搜索仪表盘标题"
          value={keyword}
          onChange={(event) => {
            const value = event.target.value

            setKeyword(value)

            if (value === '') {
              setSearchKeyword('')
            }
          }}
          onPressEnter={handleSearch}
        />

        <Button
          icon={<SearchOutlined />}
          onClick={handleSearch}
        >
          搜索
        </Button>

        <Button
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => void loadDashboards()}
        >
          刷新
        </Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
        >
          新建仪表盘
        </Button>
      </Space.Compact>


      <Spin spinning={loading}>
        {dashboards.length === 0 ?
          (<Empty description="暂无仪表盘"></Empty>) :
          (<Row gutter={[16, 16]}>
            {dashboards.map((item) => (
              <Col span={8} key={item.id}>
                <Card
                  title={item.title}
                  extra={
                    <Tag
                      color={
                        item.bgTheme === 'dark'
                          ? 'purple'
                          : 'blue'
                      }
                    >
                      {item.bgTheme === 'dark'
                        ? '暗色'
                        : '亮色'}
                    </Tag>
                  }
                  actions={[
                    <Button
                      type="text"
                      icon={<EyeOutlined />}
                      onClick={() =>
                        navigate(`/data/dashboards/${item.id}`)
                      }
                      key="view"
                    >
                      查看
                    </Button>,
                    <Button
                      type="text"
                      icon={<CopyOutlined />}
                      loading={actionId === item.id}
                      onClick={() =>
                        void handleClone(item.id)
                      }
                      key="clone"
                    >
                      复制
                    </Button>,

                    <Popconfirm
                      title="确认删除这个仪表盘吗？"
                      onConfirm={() =>
                        void handleDelete(item.id)
                      }
                      okText="删除"
                      cancelText="取消"
                      key="delete"
                    >
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        loading={actionId === item.id}
                      >
                        删除
                      </Button>
                    </Popconfirm>,
                  ]}
                >
                  <Paragraph
                    type="secondary"
                    ellipsis={{ rows: 2 }}
                  >
                    {item.description || '暂无描述'}
                  </Paragraph>

                  <Space split={<span>·</span>}>
                    <Text>
                      {item._count?.charts ?? 0} 张图表
                    </Text>

                    <Text type="secondary">
                      {item.isPublic === 1
                        ? '公开'
                        : '私有'}
                    </Text>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>)
        }
      </Spin>
      {/* 新建仪表盘模态框 */}
      <Modal
        open={createOpen}
        title="新建仪表盘"
        confirmLoading={creating}
        onOk={() => form.submit()}
        onCancel={() => {
          setCreateOpen(false)
          form.resetFields()
        }}
        okText="创建"
        cancelText="取消"
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            bgTheme: 'light',
          }}
          onFinish={handleCreate}
          style={{ marginTop: 20 }}
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[
              {
                required: true,
                message: '请输入仪表盘标题',
              },
            ]}
          >
            <Input placeholder="请输入仪表盘标题" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea
              rows={3}
              placeholder="请输入简单描述"
            />
          </Form.Item>

          <Form.Item
            name="bgTheme"
            label="背景主题"
          >
            <Select
              options={[
                {
                  label: '亮色',
                  value: 'light',
                },
                {
                  label: '暗色',
                  value: 'dark',
                },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

export default DashboardManage
