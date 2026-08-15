import { useEffect, useRef } from "react";
import * as echarts from 'echarts'
import type { ChartRendererProps } from "@/types/chart";

function ChartRenderer({
    option,
    height = 320
}: ChartRendererProps) {
    const containerRef = useRef<HTMLDivElement>(null)

    const chartRef = useRef<echarts.ECharts | null>(null)

    useEffect(() => {
        if (!containerRef.current) {
            return
        }
        const chart = echarts.init(containerRef.current)
        chartRef.current = chart

        // function handleResize() {
        //     chart.resize()
        // }
        // window.addEventListener('resize', handleResize)

        // return () => {
        //     window.removeEventListener(
        //         'resize',
        //         handleResize
        //     )
        //     chart.dispose()
        //     chartRef.current = null
        // }
        const observer = new ResizeObserver(() => {
            chart.resize()
        })
        observer.observe(containerRef.current)

        return () => {
            observer.disconnect()
            chart.dispose()
            chartRef.current = null
        }
    }, [])
    useEffect(() => {
        if (!chartRef.current) {
            return
        }

        chartRef.current.setOption(option)
    }, [option])

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height
            }}
        ></div>
    )
}
export default ChartRenderer