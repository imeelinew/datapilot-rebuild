import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react'
import {
    Button,
    Card,
    Col,
    Row,
    Space,
    Spin,
    Statistic,
    Typography,
    message,
    Table,
    Tag,
    type TableColumnsType
} from 'antd'
import { ReloadOutlined, DownloadOutlined } from '@ant-design/icons'
import { downloadFile } from '@/utils/download'
import dashboardService from '@/api/dashboard'
import type { CityOverview, EventStats, FacilityStat, TrafficRankingItem, CityEvent } from '@/types/dashboard'
//渲染图表
import type { EChartsOption } from 'echarts'
import ChartRenderer from '@/components/ChartRenderer'

//初始化空值
const emptyOverview: CityOverview = {
    totalCities: 0,
    avgCongestionIndex: null,
    avgAqi: null,
    avgPM25: null,
    avgTemperature: null,
    avgSpeed: null,
    pendingEvents: 0,
    eventProcessRate: 0,
}
const emptyEventStats: EventStats = {
    total: 0,
    byType: [],
    bySeverity: [],
    byStatus: [],
}
//状态级别颜色
function getSeverityColor(severity: string) {
    if (severity === '紧急') return 'red'
    if (severity === '高') return 'orange'
    if (severity === '中') return 'gold'

    return 'blue'
}
function getStatusColor(status: string) {
    if (status === '已处理') return 'green'
    if (status === '处理中') return 'processing'

    return 'default'
}

function Dashboard() {
    const [overview, setOverview] = useState<CityOverview>(emptyOverview)
    const [eventStats, setEventStats] = useState<EventStats>(emptyEventStats)
    const [facilityStats, setFacilityStats] = useState<FacilityStat[]>([])
    const [trafficRanking, setTrafficRanking] = useState<TrafficRankingItem[]>([])
    const [latestEvents, setLatestEvents] = useState<CityEvent[]>([])

    const [loading, setLoading] = useState(false)

    const loadDashboard = useCallback(async (showMessage = false) => {
        setLoading(true)
        try {
            const [overviewResult, eventStatsResult, facilityStatsResult, trafficRankingResult, latestEventsResult] = await Promise.all([
                dashboardService.getOverview(),
                dashboardService.getEventStats(),
                dashboardService.getFacilityStats(),
                dashboardService.getTrafficRanking(),
                dashboardService.getLatestEvents(),
            ])

            setOverview(overviewResult.data)
            setEventStats(eventStatsResult.data)
            setFacilityStats(facilityStatsResult.data)
            setTrafficRanking(trafficRankingResult.data)
            setLatestEvents(latestEventsResult.data.list)

            if (showMessage) {
                message.success('获取数据成功')
            }
        } catch (error) {
            console.error(error, 'Failed to load dashboard overview')
            message.error('获取数据失败')
        } finally {
            setLoading(false)
        }

    }, [])
    useEffect(() => {
        void loadDashboard()

        //每五分钟刷新一次
        const timer = window.setInterval(() => {
            void loadDashboard()
        }, 300000)

        return () => clearInterval(timer)
    }, [loadDashboard])
    const [exporting, setExporting] = useState('')
    //导出方法
    async function handleExport(exportType: 'cities' | 'events') {
        setExporting(exportType)

        try {
            await downloadFile(
                exportType === 'cities'
                    ? '/export/cities'
                    : '/export/events',

                exportType === 'cities'
                    ? '城市数据.csv'
                    : '城市事件.csv',
            )

            message.success('导出成功')
        } catch (error) {
            console.error(error, 'Failed to export data')
            message.error('导出失败')
        } finally {
            setExporting('')
        }
    }
    const overviewItems = useMemo(() => [
        {
            title: '监测城市',
            value: overview.totalCities,
            suffix: '座',
            color: '#1677ff',
        },
        {
            title: '拥堵指数',
            value: overview.avgCongestionIndex ?? 0,
            suffix: '',
            color: '#fa8c16',
        },
        {
            title: '平均 AQI',
            value: overview.avgAqi ?? 0,
            suffix: '',
            color: '#722ed1',
        },
        {
            title: '平均 PM2.5',
            value: overview.avgPM25 ?? 0,
            suffix: '',
            color: '#13c2c2',
        },
        {
            title: '平均温度',
            value: overview.avgTemperature ?? 0,
            suffix: '°C',
            color: '#eb2f96',
        },
        {
            title: '平均车速',
            value: overview.avgSpeed ?? 0,
            suffix: 'km/h',
            color: '#52c41a',
        },
        {
            title: '待处理事件',
            value: overview.pendingEvents,
            suffix: '件',
            color: '#faad14',
        },
        {
            title: '事件处理率',
            value: overview.eventProcessRate,
            suffix: '%',
            color: '#2f54eb',
        },
    ],
        [overview])
    //公共设施统计
    const facilityOption = useMemo<EChartsOption>(
        () => ({
            tooltip: {
                trigger: "axis",
            },
            xAxis: {
                type: 'category',
                data: facilityStats.map(item => item.type),
            },
            yAxis: {
                type: 'value',
                name: '数量',
            },
            series: [
                {
                    type: 'bar',
                    data: facilityStats.map(item => item.count),
                    itemStyle: {
                        color: '#1677ff',
                    },
                }
            ]

        }), [facilityStats])
    //交通情况
    const trafficOption = useMemo<EChartsOption>(() => {
        const list = [...trafficRanking].reverse()

        return {
            tooltip: {
                trigger: 'axis',
            },

            xAxis: {
                type: 'value',
                max: 10,
                name: '拥堵指数',
            },

            yAxis: {
                type: 'category',
                data: list.map((item) => item.name),
            },

            series: [
                {
                    type: 'bar',
                    data: list.map((item) => item.value),
                    itemStyle: {
                        color: '#fa8c16',
                    },
                },
            ],
        }
    }, [trafficRanking])
    const eventOption = useMemo<EChartsOption>(
        () => ({
            tooltip: {
                trigger: 'item',
            },
            legend: {
                bottom: 0,
            },
            series: [
                {
                    type: 'pie',
                    radius: ['40%', '70%'],
                    data: eventStats.byType.map(item => ({
                        name: item.type,
                        value: item.count,
                    })),
                    label: {
                        formatter: '{b}:{d}%',
                    }
                }
            ]
        }), [eventStats])
    const eventColumns: TableColumnsType<CityEvent> = [
        {
            title: '事件',
            dataIndex: 'title',
            key: 'title',
        },
        {
            title: '城市',
            dataIndex: 'city',
            key: 'city',
            render: (city: CityEvent['city']) =>
                city?.name || '-',
        },
        {
            title: '类型',
            dataIndex: 'eventType',
            key: 'eventType',
        },
        {
            title: '级别',
            dataIndex: 'severity',
            key: 'severity',
            render: (severity: string) => (
                <Tag color={getSeverityColor(severity)}>
                    {severity}
                </Tag>
            ),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={getStatusColor(status)}>
                    {status}
                </Tag>
            ),
        },
        {
            title: '上报时间',
            dataIndex: 'reportedAt',
            key: 'reportedAt',
            render: (time: string) =>
                time
                    ? new Date(time).toLocaleString('zh-CN')
                    : '-',
        },
    ]
    return (
        <Spin spinning={loading}>
            <Space
                orientation='vertical'
                size="large"
                style={{ width: '100%' }}
            >
                <div className='dashboard-header'>
                    <Typography.Title
                        level={2}
                        style={{ marginBottom: 0 }}
                    >
                        数据仪表盘

                    </Typography.Title>
                    <Space>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => void loadDashboard(true)}
                        >
                            刷新
                        </Button>  <Button
                            icon={<DownloadOutlined />}
                            loading={exporting === 'cities'}
                            onClick={() => void handleExport('cities')}
                        >
                            导出城市
                        </Button>

                        <Button
                            icon={<DownloadOutlined />}
                            loading={exporting === 'events'}
                            onClick={() => void handleExport('events')}
                        >
                            导出事件
                        </Button>
                    </Space>
                </div>
                <Row
                    gutter={[16, 16]}
                >
                    {overviewItems.map((item) => (
                        <Col span={6} key={item.title}>
                            <Card>
                                <Statistic
                                    title={item.title}
                                    value={item.value}
                                    suffix={item.suffix}
                                    precision={
                                        Number.isInteger(item.value) ? 0 : 1
                                    }
                                    valueStyle={{ color: item.color }}
                                ></Statistic>
                            </Card>
                        </Col>
                    ))}
                </Row>
                <Row gutter={[16, 16]}>
                    <Col span={24}>
                        <Card title="公共设施统计">
                            <ChartRenderer option={facilityOption} />
                        </Card>
                    </Col>
                </Row>
                <Row gutter={[16, 16]}>
                    <Col span={12}>
                        <Card title="交通拥堵排行">
                            <ChartRenderer option={trafficOption} />
                        </Card>
                    </Col>

                    <Col span={12}>
                        <Card title="城市事件分类">
                            <ChartRenderer option={eventOption} />
                        </Card>
                    </Col>
                </Row>
                <Card title="最新城市事件">
                    <Table<CityEvent>
                        rowKey="id"
                        columns={eventColumns}
                        dataSource={latestEvents}
                        loading={loading}
                        pagination={false}
                    />
                </Card>
            </Space>
        </Spin>
    )
}
export default Dashboard
