import { Card } from 'antd'
import { useParams } from 'react-router-dom'

function DashboardDetail() { 
    const { id } = useParams()
    
    return (
        <Card title="仪表盘详情">
            当前仪表盘id: {id}
        </Card>
    )
}

export default DashboardDetail