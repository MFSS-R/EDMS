import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Statistic, Table, Tag, Space, Button, Spin, Typography } from 'antd'
import {
  ProjectOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  AppstoreOutlined,
  ArrowRightOutlined
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { projectApi } from '../services/project'
import { sampleApi } from '../services/sample'
import { getStatusTag, formatDateTime } from '../utils/helpers'
import './Dashboard.css'

const { Title, Text } = Typography

export default function Dashboard() {
  const navigate = useNavigate()

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['projectStats'],
    queryFn: () => projectApi.getStatistics(),
  })

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', { page_size: 5 }],
    queryFn: () => projectApi.getList({ page_size: 5 }),
  })

  const { data: samplesData, isLoading: samplesLoading } = useQuery({
    queryKey: ['samples', { page_size: 5 }],
    queryFn: () => sampleApi.getList({ page_size: 5 }),
  })

  const stats = statsData?.data || statsData || {}
  const projectsResponse = projectsData?.data || projectsData
  const projects = Array.isArray(projectsResponse?.results) ? projectsResponse.results : []
  const samplesResponse = samplesData?.data || samplesData
  const samples = Array.isArray(samplesResponse?.results) ? samplesResponse.results : []
  const samplesCount = samplesResponse?.count || 0

  const statCards = [
    {
      title: '总项目数',
      value: stats.total || 0,
      prefix: <ProjectOutlined />,
      color: '#ffffff',
      gradient: 'linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)',
      bgColor: '#eef2ff',
    },
    {
      title: '进行中项目',
      value: stats.in_progress || 0,
      prefix: <ClockCircleOutlined />,
      color: '#ffffff',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
      bgColor: '#fef3c7',
    },
    {
      title: '已完成项目',
      value: stats.completed || 0,
      prefix: <CheckCircleOutlined />,
      color: '#ffffff',
      gradient: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
      bgColor: '#d1fae5',
    },
    {
      title: '总样品数',
      value: samplesCount,
      prefix: <AppstoreOutlined />,
      color: '#ffffff',
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
      bgColor: '#ede9fe',
    },
  ]

  const projectColumns = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <a onClick={() => navigate(`/projects/${record.id}`)} className="table-link">
          {text}
        </a>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const tag = getStatusTag(status)
        return <Tag className={`status-tag status-${status}`}>{tag.text}</Tag>
      },
    },
    {
      title: '样品数量',
      dataIndex: 'sample_count',
      key: 'sample_count',
      align: 'center',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => <Text type="secondary">{formatDateTime(date)}</Text>,
    },
  ]

  const sampleColumns = [
    {
      title: '样品编号',
      dataIndex: 'sample_id',
      key: 'sample_id',
      render: (text, record) => (
        <a onClick={() => navigate(`/samples/${text}`)} className="table-link">
          {text}
        </a>
      ),
    },
    {
      title: '样品名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: '所属项目',
      dataIndex: 'project_name',
      key: 'project_name',
    },
    {
      title: '样品类型',
      dataIndex: 'sample_type_name',
      key: 'sample_type_name',
    },
  ]

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <Title level={3} className="dashboard-title">数据概览</Title>
          <Text type="secondary">欢迎使用实验数据管理系统</Text>
        </div>
      </div>

      <Spin spinning={statsLoading || projectsLoading || samplesLoading}>
        <Row gutter={[20, 20]} className="stats-row">
          {statCards.map((stat, index) => (
            <Col xs={24} sm={12} lg={6} key={index}>
              <Card className="stat-card card-hover" bordered={false}>
                <div className="stat-content">
                  <div
                    className="stat-icon"
                    style={{
                      background: stat.bgColor,
                      backgroundImage: stat.gradient,
                    }}
                  >
                    <span style={{ color: stat.color }}>{stat.prefix}</span>
                  </div>
                  <div className="stat-info">
                    <Text type="secondary" className="stat-title">{stat.title}</Text>
                    <div className="stat-value">{stat.value}</div>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={[20, 20]} className="tables-row">
          <Col xs={24} lg={12}>
            <Card
              className="table-card"
              bordered={false}
              title={
                <div className="card-header">
                  <span className="card-title">最近项目</span>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => navigate('/projects')}
                    className="view-all-btn"
                  >
                    查看全部 <ArrowRightOutlined />
                  </Button>
                </div>
              }
            >
              <Table
                columns={projectColumns}
                dataSource={projects}
                rowKey="id"
                pagination={false}
                size="middle"
                className="dashboard-table"
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              className="table-card"
              bordered={false}
              title={
                <div className="card-header">
                  <span className="card-title">最近样品</span>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => navigate('/samples')}
                    className="view-all-btn"
                  >
                    查看全部 <ArrowRightOutlined />
                  </Button>
                </div>
              }
            >
              <Table
                columns={sampleColumns}
                dataSource={samples}
                rowKey="sample_id"
                pagination={false}
                size="middle"
                className="dashboard-table"
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
