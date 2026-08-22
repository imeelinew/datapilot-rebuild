import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Steps,
  Typography,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { EChartsOption } from 'echarts'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import chartManageService from '@/api/chartManage'
import { dashboardManageService } from '@/api/dashboardManage'
import datasourceService from '@/api/datasource'
import ChartRenderer from '@/components/ChartRenderer'
import type { ChartInput } from '@/types/chartManage'
import type {
  DashboardChart,
  DashboardItem,
  DatasourceQueryData,
} from '@/types/dashboardManage'
import type {
  Datasource,
  FieldInfo,
  TableInfo,
} from '@/types/datasource'
import { formatChartOption } from '@/utils/chart'

type WizardValues = {
  dashboardId: number
  datasourceId: number
  table: string
  xField: string
  yField: string
  title: string
  chartType: DashboardChart['chartType']
}

const chartTypeOptions = [
  { label: '柱状图', value: 'bar' },
  { label: '折线图', value: 'line' },
  { label: '饼图', value: 'pie' },
  { label: '散点图', value: 'scatter' },
]

function ChartEditor() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [form] = Form.useForm<WizardValues>()
  const editingId = id ? Number(id) : null

  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [dashboards, setDashboards] = useState<DashboardItem[]>([])
  const [datasources, setDatasources] = useState<Datasource[]>([])
  const [tables, setTables] = useState<TableInfo[]>([])
  const [fields, setFields] = useState<FieldInfo[]>([])
  const [previewData, setPreviewData] = useState<DatasourceQueryData>()
  const [previewOption, setPreviewOption] = useState<EChartsOption>()

  const loadTables = useCallback(async (datasourceId: number) => {
    const result = await datasourceService.getTables(datasourceId)
    setTables(result.data)
  }, [])

  const loadFields = useCallback(
    async (datasourceId: number, table: string) => {
      const result = await datasourceService.getFields(datasourceId, table)
      setFields(result.data)
    },
    [],
  )

  useEffect(() => {
    async function initialize() {
      setLoading(true)
      try {
        const [dashboardResult, datasourceResult] = await Promise.all([
          dashboardManageService.getList({ page: 1, pageSize: 100 }),
          datasourceService.getList(),
        ])
        setDashboards(dashboardResult.data.list)
        setDatasources(datasourceResult.data.list)

        const dashboardId = Number(searchParams.get('dashboardId'))
        if (dashboardId) {
          form.setFieldValue('dashboardId', dashboardId)
        }

        if (editingId) {
          const chartResult = await chartManageService.getDetail(editingId)
          const chart = chartResult.data
          const table = chart.queryConfig?.table || ''

          form.setFieldsValue({
            dashboardId: chart.dashboardId,
            datasourceId: chart.datasourceId || undefined,
            table,
            xField: chart.queryConfig?.xField || '',
            yField: chart.queryConfig?.yField || '',
            title: chart.title,
            chartType: chart.chartType,
          })

          if (chart.datasourceId) {
            await loadTables(chart.datasourceId)
            if (table) {
              await loadFields(chart.datasourceId, table)
            }
          }
          setCurrent(1)
        }
      } catch (error) {
        console.error(error)
        message.error('初始化图表配置失败')
      } finally {
        setLoading(false)
      }
    }

    void initialize()
  }, [editingId, form, loadFields, loadTables, searchParams])

  async function handleDatasourceChange(datasourceId: number) {
    form.setFieldsValue({
      table: undefined,
      xField: undefined,
      yField: undefined,
    })
    setTables([])
    setFields([])
    setPreviewData(undefined)
    setPreviewOption(undefined)

    try {
      await loadTables(datasourceId)
    } catch (error) {
      console.error(error)
      message.error('获取数据表失败')
    }
  }

  async function handleTableChange(table: string) {
    form.setFieldsValue({
      xField: undefined,
      yField: undefined,
    })
    setFields([])
    setPreviewData(undefined)
    setPreviewOption(undefined)

    const datasourceId = form.getFieldValue('datasourceId')
    if (!datasourceId) return

    try {
      await loadFields(datasourceId, table)
    } catch (error) {
      console.error(error)
      message.error('获取字段列表失败')
    }
  }

  async function generatePreview() {
    const values = await form.validateFields([
      'datasourceId',
      'table',
      'xField',
      'yField',
      'title',
      'chartType',
    ])

    setPreviewLoading(true)
    try {
      const queryConfig = {
        table: values.table,
        xField: values.xField,
        yField: values.yField,
      }
      const result = await datasourceService.query(
        values.datasourceId,
        queryConfig,
      )
      const option = formatChartOption(
        {
          title: values.title,
          chartType: values.chartType,
          queryConfig,
        },
        result.data,
      )
      setPreviewData(result.data)
      setPreviewOption(option || undefined)
      setCurrent(2)
    } catch (error) {
      console.error(error)
      message.error('生成图表预览失败')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleNext() {
    if (current === 0) {
      await form.validateFields(['dashboardId', 'datasourceId'])
      setCurrent(1)
      return
    }

    if (current === 1) {
      await generatePreview()
    }
  }

  async function handleSave() {
    const values = await form.validateFields()
    const data: ChartInput = {
      dashboardId: values.dashboardId,
      datasourceId: values.datasourceId,
      title: values.title,
      chartType: values.chartType,
      queryConfig: {
        table: values.table,
        xField: values.xField,
        yField: values.yField,
      },
      chartConfig: {},
      position: {
        x: 0,
        y: 0,
        w: 6,
        h: 4,
      },
      sortOrder: 0,
    }

    setSaving(true)
    try {
      if (editingId) {
        await chartManageService.update(editingId, data)
        message.success('更新图表成功')
      } else {
        await chartManageService.create(data)
        message.success('创建图表成功')
      }
      navigate(`/data/dashboards/${values.dashboardId}`)
    } catch (error) {
      console.error(error)
      message.error(editingId ? '更新图表失败' : '创建图表失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <Spin fullscreen description="正在加载图表配置" />
  }

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div className="page-header">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {editingId ? '编辑图表' : '新建图表'}
          </Typography.Title>
          <Typography.Text type="secondary">
            选择数据、配置字段并确认真实预览
          </Typography.Text>
        </div>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/data/charts')}
        >
          返回列表
        </Button>
      </div>

      <Card>
        <Steps
          current={current}
          items={[
            { title: '选择归属与数据源' },
            { title: '配置字段和图表' },
            { title: '预览并保存' },
          ]}
        />

        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 32 }}
          initialValues={{ chartType: 'bar' }}
        >
          {current === 0 && (
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  name="dashboardId"
                  label="目标仪表盘"
                  rules={[{ required: true, message: '请选择仪表盘' }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="请选择图表保存到哪个仪表盘"
                    options={dashboards.map((item) => ({
                      label: item.title,
                      value: item.id,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="datasourceId"
                  label="数据源"
                  rules={[{ required: true, message: '请选择数据源' }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="请选择数据来源"
                    options={datasources.map((item) => ({
                      label: `${item.name}（${item.type}）`,
                      value: item.id,
                    }))}
                    onChange={(value) =>
                      void handleDatasourceChange(value)
                    }
                  />
                </Form.Item>
              </Col>
            </Row>
          )}

          {current === 1 && (
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item
                  name="table"
                  label="数据表"
                  rules={[{ required: true, message: '请选择数据表' }]}
                >
                  <Select
                    placeholder="请选择表"
                    options={tables.map((item) => ({
                      label: item.tableName,
                      value: item.tableName,
                    }))}
                    onChange={(value) => void handleTableChange(value)}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="xField"
                  label="X 轴字段"
                  rules={[{ required: true, message: '请选择 X 字段' }]}
                >
                  <Select
                    placeholder="分类、名称或横坐标"
                    options={fields.map((item) => ({
                      label: `${item.columnName}（${item.dataType}）`,
                      value: item.columnName,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="yField"
                  label="Y 轴字段"
                  rules={[{ required: true, message: '请选择 Y 字段' }]}
                >
                  <Select
                    placeholder="需要统计的数值字段"
                    options={fields.map((item) => ({
                      label: `${item.columnName}（${item.dataType}）`,
                      value: item.columnName,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="title"
                  label="图表名称"
                  rules={[{ required: true, message: '请输入图表名称' }]}
                >
                  <Input placeholder="例如：城市人口排行" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="chartType"
                  label="图表类型"
                  rules={[{ required: true, message: '请选择图表类型' }]}
                >
                  <Select options={chartTypeOptions} />
                </Form.Item>
              </Col>
            </Row>
          )}

          {current === 2 && (
            <div>
              <Space style={{ marginBottom: 16 }}>
                <Typography.Text type="secondary">
                  查询到 {previewData?.total ?? 0} 行数据，图表仅展示最有代表性的部分。
                </Typography.Text>
                <Button
                  icon={<ReloadOutlined />}
                  loading={previewLoading}
                  onClick={() => void generatePreview()}
                >
                  重新生成
                </Button>
              </Space>
              {previewOption ? (
                <ChartRenderer option={previewOption} height={420} />
              ) : (
                <Empty description="暂无可预览数据" />
              )}
            </div>
          )}
        </Form>

        <div className="wizard-actions">
          {current > 0 && (
            <Button onClick={() => setCurrent(current - 1)}>
              上一步
            </Button>
          )}
          {current < 2 ? (
            <Button
              type="primary"
              loading={previewLoading}
              onClick={() => void handleNext()}
            >
              下一步
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<CheckOutlined />}
              loading={saving}
              onClick={() => void handleSave()}
            >
              {editingId ? '保存修改' : '保存到仪表盘'}
            </Button>
          )}
        </div>
      </Card>
    </Space>
  )
}

export default ChartEditor
