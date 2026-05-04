import { useState } from 'react'
import { Button, Layout } from 'antd'
import { BarChartOutlined, SettingOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import FilterPanel from '../components/AnalysisCanvas/FilterPanel'
import CanvasContainer from '../components/AnalysisCanvas/CanvasContainer'
import CanvasToolbar from '../components/AnalysisCanvas/CanvasToolbar'
import useAnalysisCanvasStore from '../store/analysisCanvas'
import './AnalysisCanvas.css'

const { Sider, Content } = Layout

export default function AnalysisCanvas() {
  const navigate = useNavigate()
  const addCard = useAnalysisCanvasStore((state) => state.addCard)
  const [siderCollapsed, setSiderCollapsed] = useState(false)

  const handleCreateChart = (chartConfig) => {
    addCard(chartConfig)
  }

  return (
    <div className="analysis-canvas-page">
      <div className="page-header">
        <div className="page-header-copy">
          <h2>
            <BarChartOutlined style={{ marginRight: 8 }} />
            画布对比分析
          </h2>
          <p>围绕单个实验持续创建多张对比图，并支持保存布局，方便下次继续分析。</p>
        </div>
        <Button
          icon={<SettingOutlined />}
          onClick={() => navigate('/analysis/algorithms')}
        >
          算法管理
        </Button>
      </div>

      <Layout className="canvas-layout">
        <Sider
          width={360}
          collapsedWidth={0}
          collapsed={siderCollapsed}
          className="canvas-sider"
          trigger={null}
        >
          <FilterPanel onCreateChart={handleCreateChart} />
        </Sider>

        <Layout className="canvas-content-layout">
          <div className="canvas-toolbar-wrapper">
            <CanvasToolbar />
            <div
              className="sider-toggle"
              onClick={() => setSiderCollapsed(!siderCollapsed)}
            >
              {siderCollapsed ? '展开左栏' : '收起左栏'}
            </div>
          </div>

          <Content className="canvas-content">
            <CanvasContainer />
          </Content>
        </Layout>
      </Layout>
    </div>
  )
}
