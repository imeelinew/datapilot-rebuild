import { Card, Col, Row, Statistic, Typography } from 'antd'

function Dashboard() {
  return (
    <>
      <Typography.Title level={2}>数据仪表盘</Typography.Title>

      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card>
            <Statistic title="监测城市" value={0} suffix="座" />
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic title="平均 AQI" value={0} />
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic title="待处理事件" value={0} suffix="件" />
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic title="事件处理率" value={0} suffix="%" />
          </Card>
        </Col>
      </Row>
    </>
  )
}

export default Dashboard