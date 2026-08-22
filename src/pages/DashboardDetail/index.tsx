import { useCallback, useEffect, useState } from "react";
import {
    Button,
    Card,
    Descriptions,
    Empty,
    Space,
    Spin,
    Tag,
    message,
    Col,
    Row
} from 'antd'
import {
    ArrowLeftOutlined,
    PlusOutlined,
    ReloadOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from "react-router-dom";
import dashboardManageService from "@/api/dashboardManage";
import datasourceService from "@/api/datasource";
import type {
    DashboardChart,
    DashboardDetail as DashboardDetailData,
    DatasourceQueryData,
} from "@/types/dashboardManage";
import ChartRenderer from "@/components/ChartRenderer";
import { formatChartOption } from "@/utils/chart";

type ChartWithData = {
    chart: DashboardChart
    data: DatasourceQueryData | null
}
function DashboardDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [detail, setDetail] = useState<DashboardDetailData | null>(null)
    const [loading, setLoading] = useState(false)
    const [chartDataList, setChartDataList] = useState<ChartWithData[]>([])


    const loadDetail = useCallback(async () => {
        if (!id) return

        setLoading(true)
        try {
            const result =
                await dashboardManageService.getDetail(Number(id))

            const dashboard = result.data
            setDetail(dashboard)

            const queryResults = await Promise.all(
                dashboard.charts.map(async (chart) => {
                    if (!chart.datasourceId || !chart.queryConfig) {
                        return {
                            chart,
                            data: null,
                        }
                    }

                    try {
                        const queryResult = await datasourceService.query(
                            chart.datasourceId,
                            chart.queryConfig,
                        )

                        return {
                            chart,
                            data: queryResult.data,
                        }
                    } catch (error) {
                        console.error(`图表 ${chart.id} 查询失败`, error)
                        return {
                            chart,
                            data: null,
                        }
                    }
                }),
            )

            setChartDataList(queryResults)
        } catch (error) {
            message.error('获取仪表盘详情失败')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }, [id])

    useEffect(() => {
        void loadDetail()
    }, [loadDetail])

    if (loading) {
        return <Spin />
    }
    if (!detail) {
        return <Empty />
    }
    return (
        <Card
            title={detail.title}
            extra={
                <Space>
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate('/data/dashboards')}
                    >
                        返回
                    </Button>
                    <Button
                        icon={<ReloadOutlined />}
                        loading={loading}
                        onClick={() => void loadDetail()}
                    >
                        刷新
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() =>
                            navigate(`/data/charts/new?dashboardId=${id}`)
                        }
                    >
                        添加图表
                    </Button>
                </Space>
            }
        >
            <Descriptions
                column={2}
                items={[
                    {
                        key: 'description',
                        label: '描述',
                        children: detail.description || '暂无描述',
                    },
                    {
                        key: 'theme',
                        label: '背景主题',
                        children:
                            detail.bgTheme === 'dark' ? '暗色' : '亮色',
                    },
                    {
                        key: 'chartCount',
                        label: '图表数量',
                        children: detail.charts.length,
                    },
                    {
                        key: 'createdAt',
                        label: '创建时间',
                        children: detail.createdAt,
                    },
                ]}
            />
            {chartDataList.length === 0 ? (
                <Empty
                    description="该仪表盘还没有图表"
                    style={{ marginTop: 24 }}
                />
            ) : (
                <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
                    {chartDataList.map(({ chart, data }) => {
                        const option = data
                            ? formatChartOption(chart, data)
                            : null

                        return (
                            <Col span={8} key={chart.id}>
                                <Card
                                    size="small"
                                    title={chart.title}
                                    extra={<Tag>{chart.chartType}</Tag>}
                                >
                                    {option ? (
                                        <ChartRenderer
                                            option={option}
                                            height={260}
                                        />
                                    ) : (
                                        <Empty description="暂无可展示数据" />
                                    )}
                                </Card>
                            </Col>
                        )
                    })}
                </Row>
            )}
        </Card>
    )
}
export default DashboardDetail
