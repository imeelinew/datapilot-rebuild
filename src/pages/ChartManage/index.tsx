import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Card,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
  type TableColumnsType,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import type { EChartsOption } from 'echarts'
import { useNavigate } from 'react-router-dom'

import chartManageService from '@/api/chartManage'
import { dashboardManageService } from '@/api/dashboardManage'
import ChartRenderer from '@/components/ChartRenderer'
import type { ChartItem } from '@/types/chartManage'
import type { DashboardItem } from '@/types/dashboardManage'

const chartTypeOptions = [
  { label: '柱状图', value: 'bar' },
  { label: '折线图', value: 'line' },
  { label: '饼图', value: 'pie' },
  { label: '散点图', value: 'scatter' },
]

const chartTypeNames: Record<string, string> = {
  bar: '柱状图',
  line: '折线图',
  pie: '饼图',
  scatter: '散点图',
  table: '表格',
}

function ChartManage() {
  const navigate = useNavigate()
  const [charts, setCharts] = useState<ChartItem[]>([])
  const [dashboards, setDashboards] = useState<DashboardItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [dashboardId, setDashboardId] = useState<number>()
  const [chartType, setChartType] = useState<string>()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewOption, setPreviewOption] = useState<EChartsOption>()
  const [previewTitle, setPreviewTitle] = useState('')

  const loadCharts = useCallback(async () => {
    setLoading(true)
    try {
      const result = await chartManageService.getList({
        page,
        pageSize,
        keyword: searchKeyword || undefined,
        dashboardId,
        chartType,
      })
      setCharts(result.data.list)
      setTotal(result.data.total)
    } catch (error) {
      console.error(error)
      message.error('获取图表列表失败')
    } finally {
      setLoading(false)
    }
  }, [chartType, dashboardId, page, pageSize, searchKeyword])

  useEffect(() => {
    void loadCharts()
  }, [loadCharts])

  useEffect(() => {
    async function loadDashboards() {
      try {
        const result = await dashboardManageService.getList({
          page: 1,
          pageSize: 100,
        })
        setDashboards(result.data.list)
      } catch (error) {
        console.error(error)
      }
    }

    void loadDashboards()
  }, [])

  async function handlePreview(chart: ChartItem) {
    setPreviewOpen(true)
    setPreviewLoading(true)
    setPreviewTitle(chart.title)
    setPreviewOption(undefined)
    try {
      const result = await chartManageService.preview(chart.id)
      setPreviewOption(result.data)
    } catch (error) {
      console.error(error)
      message.error('图表预览失败')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleDelete(id: number) {
    try {
      await chartManageService.delete(id)
      message.success('删除图表成功')
      await loadCharts()
    } catch (error) {
      console.error(error)
      message.error('删除图表失败')
    }
  }

  function handleReset() {
    setKeyword('')
    setSearchKeyword('')
    setDashboardId(undefined)
    setChartType(undefined)
    setPage(1)
  }

  const columns: TableColumnsType<ChartItem> = [
    { title: '图表名称', dataIndex: 'title' },
    {
      title: '类型',
      dataIndex: 'chartType',
      width: 110,
      render: (value: string) => (
        <Tag color="blue">{chartTypeNames[value] || value}</Tag>
      ),
    },
    {
      title: '所属仪表盘',
      render: (_, record) => record.dashboard?.title || '-',
    },
    {
      title: '数据源',
      render: (_, record) => record.datasource?.name || '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 190,
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: '操作',
      width: 250,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => void handlePreview(record)}
          >
            预览
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/data/charts/${record.id}/edit`)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除这张图表吗？"
            okText="删除"
            cancelText="取消"
            onConfirm={() => void handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div className="page-header">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            图表管理
          </Typography.Title>
          <Typography.Text type="secondary">
            管理动态图表，预览真实数据并维护图表配置
          </Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/data/charts/new')}
        >
          新建图表
        </Button>
      </div>

      <Card size="small">
        <Space wrap>
          <Input
            allowClear
            value={keyword}
            placeholder="搜索图表名称"
            prefix={<SearchOutlined />}
            onChange={(event) => setKeyword(event.target.value)}
            onPressEnter={() => {
              setPage(1)
              setSearchKeyword(keyword.trim())
            }}
            style={{ width: 220 }}
          />
          <Select
            allowClear
            value={dashboardId}
            placeholder="筛选仪表盘"
            options={dashboards.map((item) => ({
              label: item.title,
              value: item.id,
            }))}
            onChange={(value) => {
              setPage(1)
              setDashboardId(value)
            }}
            style={{ width: 200 }}
          />
          <Select
            allowClear
            value={chartType}
            placeholder="筛选图表类型"
            options={chartTypeOptions}
            onChange={(value) => {
              setPage(1)
              setChartType(value)
            }}
            style={{ width: 160 }}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => {
              setPage(1)
              setSearchKeyword(keyword.trim())
            }}
          >
            搜索
          </Button>
          <Button onClick={handleReset}>重置</Button>
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => void loadCharts()}
          >
            刷新
          </Button>
        </Space>
      </Card>

      <Table<ChartItem>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={charts}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (value) => `共 ${value} 张图表`,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPageSize === pageSize ? nextPage : 1)
            setPageSize(nextPageSize)
          },
        }}
      />

      <Modal
        open={previewOpen}
        title={previewTitle}
        footer={null}
        width={820}
        destroyOnHidden
        onCancel={() => setPreviewOpen(false)}
      >
        <div style={{ minHeight: 380 }}>
          {previewLoading ? (
            <div className="center-state">正在生成预览...</div>
          ) : previewOption ? (
            <ChartRenderer option={previewOption} height={380} />
          ) : (
            <div className="center-state">暂无预览数据</div>
          )}
        </div>
      </Modal>
    </Space>
  )
}

export default ChartManage
