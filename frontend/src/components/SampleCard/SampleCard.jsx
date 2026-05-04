import { useMemo } from 'react'
import { Card, Button, Spin, Empty, Tag } from 'antd'
import { EyeOutlined, LineChartOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { testApi } from '../../services/test'
import { analysisApi } from '../../services/analysis'
import DataChart from '../../components/DataChart/DataChart'
import { formatSamplePrimary, formatSampleSecondary } from '../../utils/helpers'
import './SampleCard.css'

export default function SampleCard({ sample, testTypeId }) {
  const navigate = useNavigate()

  const { data: testData, isLoading: testDataLoading } = useQuery({
    queryKey: ['testData', sample.sample_id, testTypeId],
    queryFn: () => testApi.getDataList({ sample: sample.sample_id, test_type: testTypeId }),
    enabled: !!testTypeId,
  })

  const testDataItem = useMemo(() => {
    const results = testData?.results || testData?.data?.results || []
    if (results.length === 0) return null
    return results[0]
  }, [testData])

  const { data: plotDataResponse, isLoading: plotDataLoading } = useQuery({
    queryKey: ['plotData', testDataItem?.id],
    queryFn: async () => {
      try {
        const res = await analysisApi.getPlotDataByTestData(testDataItem.id)
        return res
      } catch {
        return null
      }
    },
    enabled: !!testDataItem?.id,
    retry: 0,
  })

  const plotData = plotDataResponse?.data || null
  const isLoading = testDataLoading || (plotDataLoading && !!testDataItem)
  const secondaryLabel = formatSampleSecondary(sample) || '未命名'
  const sampleTypeLabel = sample.sample_type_name || '未设置'
  const synthesisDate = sample.synthesis_date || '未设置'
  const testDataCount = testData?.count || testData?.data?.count || testData?.results?.length || testData?.data?.results?.length || 0

  return (
    <Card className="sample-card">
      <div className="sample-header">
        <div className="sample-title-group">
          <h4>{formatSamplePrimary(sample)}</h4>
          <div className="sample-subtitle">{secondaryLabel}</div>
        </div>
        <Button
          type="default"
          icon={<EyeOutlined />}
          size="small"
          className="sample-detail-button"
          onClick={() => navigate(`/samples/${sample.sample_id}`)}
        >
          查看详情
        </Button>
      </div>

      <div className="sample-meta-strip">
        <Tag bordered={false} className="sample-meta-tag">
          类型: {sampleTypeLabel}
        </Tag>
        <Tag bordered={false} className="sample-meta-tag">
          数据: {testDataCount} 份
        </Tag>
        <Tag bordered={false} className="sample-meta-tag">
          合成: {synthesisDate}
        </Tag>
      </div>

      <div className="chart-container">
        <div className="chart-header">
          <LineChartOutlined /> 测试数据图表
        </div>
        <div className="chart-content">
          {isLoading ? (
            <Spin size="small" style={{ margin: '20px 0' }} />
          ) : !plotData ? (
            <Empty description="暂无测试数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <DataChart plotData={plotData} height={280} />
          )}
        </div>
      </div>
    </Card>
  )
}
