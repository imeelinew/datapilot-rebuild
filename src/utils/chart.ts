import type { EChartsOption } from 'echarts'

import type {
  DashboardChart,
  DatasourceQueryData,
} from '@/types/dashboardManage'

type ChartOptionSource = Pick<
  DashboardChart,
  'title' | 'chartType' | 'queryConfig'
>

export function formatChartOption(
  chart: ChartOptionSource,
  data: DatasourceQueryData,
): EChartsOption | null {
  const xField = chart.queryConfig?.xField
  const yField = chart.queryConfig?.yField

  if (!xField || !yField || data.rows.length === 0) {
    return null
  }

  const sortedRows = [...data.rows].sort(
    (first, second) =>
      Number(second[yField] ?? 0) - Number(first[yField] ?? 0),
  )

  const maxItems =
    chart.chartType === 'pie'
      ? 8
      : chart.chartType === 'scatter'
        ? 10
        : 12

  const visibleRows = sortedRows.slice(0, maxItems)

  const xValues = visibleRows.map((row) =>
    String(row[xField] ?? ''),
  )

  const yValues = visibleRows.map((row) =>
    Number(row[yField] ?? 0),
  )

  if (chart.chartType === 'bar' || chart.chartType === 'line') {
    return {
      tooltip: {
        trigger: 'axis',
      },
      xAxis: {
        type: 'category',
        data: xValues,
        axisLabel: {
          interval: 0,
          rotate: 30,
          overflow: 'truncate',
          width: 70,
        },
      },
      yAxis: {
        type: 'value',
      },
      grid: {
        left: 50,
        right: 20,
        top: 30,
        bottom: 70,
        containLabel: true,
      },
      series: [
        {
          name: chart.title,
          type: chart.chartType,
          data: yValues,
          barMaxWidth: 40,
        },
      ],
    }
  }

  if (chart.chartType === 'pie') {
    return {
      tooltip: {
        trigger: 'item',
      },
      legend: {
        bottom: 0,
      },
      series: [
        {
          name: chart.title,
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: true,
          data: visibleRows.map((row) => ({
            name: String(row[xField] ?? ''),
            value: Number(row[yField] ?? 0),
          })),
        },
      ],
    }
  }

  if (chart.chartType === 'scatter') {
    return {
      tooltip: {
        trigger: 'item',
      },
      xAxis: {
        type: 'value',
      },
      yAxis: {
        type: 'value',
      },
      series: [
        {
          name: chart.title,
          type: 'scatter',
          symbolSize: 16,
          data: visibleRows.map((row) => [
            Number(row[xField] ?? 0),
            Number(row[yField] ?? 0),
          ]),
        },
      ],
    }
  }

  return null
}
