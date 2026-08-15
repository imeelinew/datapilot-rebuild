import { Card, Typography } from 'antd'
import type { PlaceholderProps } from '../../types/placeholder'

function PlaceholderPage({
    title,
    description,
}: PlaceholderProps) { 
    return (
        <Card>
            <Typography.Title level={3}>{title}</Typography.Title>
            <Typography.Paragraph type='secondary'>{description}</Typography.Paragraph>
        </Card>
    )

}
export default PlaceholderPage