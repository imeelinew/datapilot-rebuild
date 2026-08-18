import { useEffect, useState } from "react";
import {
    Button,
    Card,
    Descriptions,
    Empty,
    Spin,
    message,
    Col,
    Row
} from 'antd'
import { useNavigate, useParams } from "react-router-dom";
import dashboardManageService from "@/api/dashboardManage";
import datasourceService from "@/api/datasource";
import type { DashboardDetail, DashboardChart, DatasourceQueryData } from "@/types/dashboardManage";

type ChartWithData = {
    chart: DashboardChart
    data: DatasourceQueryData | null
}
function DashboardDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [detail, setDetail] = useState<DashboardDetail | null>(null)
    const [loading, setLoading] = useState(false)
    const [chartDataList, setChartDataList] = useState<ChartWithData[]>([])


    useEffect(() => {
        if (!id) return

        async function loadDetail() {
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

                        const queryResult = await datasourceService.query(
                            chart.datasourceId,
                            chart.queryConfig,
                        )

                        return {
                            chart,
                            data: queryResult.data,
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
        }
        loadDetail()
    }, [id])

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
                <Button
                    onClick={() => navigate('/data/dashboards')}
                >
                    返回
                </Button>
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
            <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
                {chartDataList.map(({ chart, data }) => (
                    <Col span={12} key={chart.id}>
                        <Card size="small" title={chart.title}>
                            {data
                                ? `已加载 ${data.total} 条数据`
                                : "该图表没有完整的数据源配置"}
                        </Card>
                    </Col>
                ))}
            </Row>
        </Card>
    )
}
export default DashboardDetail