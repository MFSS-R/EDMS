import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Divider,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Upload,
} from 'antd'
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SaveOutlined,
  SafetyCertificateOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { analysisApi } from '../services/analysis'
import { testApi } from '../services/test'
import DataChart from '../components/DataChart'
import './AlgorithmManagement.css'
import './Analysis.css'

const { Option } = Select
const { TextArea } = Input

const DEFAULT_VALIDATION = {
  valid: false,
  errors: [],
  warnings: [],
  summary: '请输入脚本后再进行校验。',
}

const SCRIPT_TEMPLATE = `import pandas as pd
import json
import sys

def main(file_path):
    if file_path.endswith('.csv'):
        df = pd.read_csv(file_path)
    elif file_path.endswith('.xlsx') or file_path.endswith('.xls'):
        df = pd.read_excel(file_path)
    elif file_path.endswith('.txt') or file_path.endswith('.dat'):
        df = pd.read_csv(file_path, sep=r'\\s+')
    else:
        print(json.dumps({"error": f"不支持的文件格式: {file_path}"}))
        return

    if len(df.columns) < 2:
        print(json.dumps({"error": "数据至少需要两列"}))
        return

    x_col = df.columns[0]
    series = []
    for col in df.columns[1:]:
        series_data = df[[x_col, col]].dropna().values.tolist()
        series.append({"name": col, "data": series_data})

    result = {
        "dimensions": 2,
        "x_column": x_col,
        "x_unit": "",
        "y_column": "",
        "y_unit": "",
        "series": series
    }
    print(json.dumps(result))

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"error": "用法: python script.py <数据文件路径>"}))
        sys.exit(1)
    main(sys.argv[1])
`

const SCRIPT_TEMPLATE_MULTI = `import pandas as pd
import json
import sys

def main(file_path):
    if file_path.endswith('.csv'):
        df = pd.read_csv(file_path)
    elif file_path.endswith('.xlsx') or file_path.endswith('.xls'):
        df = pd.read_excel(file_path)
    elif file_path.endswith('.txt') or file_path.endswith('.dat'):
        df = pd.read_csv(file_path, sep=r'\\s+')
    else:
        print(json.dumps({"error": f"不支持的文件格式: {file_path}"}))
        return

    if len(df.columns) < 3:
        print(json.dumps({"error": "多曲线模式至少需要三列数据"}))
        return

    x_col = df.columns[0]
    y1_col = df.columns[1]
    y2_col = df.columns[2]

    result = {
        "dimensions": 2,
        "x_column": x_col,
        "x_unit": "Hz",
        "y_column": "磁导率",
        "y_unit": "μH/m",
        "series": [
            {
                "name": y1_col,
                "data": df[[x_col, y1_col]].dropna().values.tolist()
            },
            {
                "name": y2_col,
                "data": df[[x_col, y2_col]].dropna().values.tolist()
            }
        ]
    }
    print(json.dumps(result))

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"error": "用法: python script.py <数据文件路径>"}))
        sys.exit(1)
    main(sys.argv[1])
`

const OUTPUT_EXAMPLES = {
  basic2d: {
    title: '二维单/多曲线',
    description: '最常见的情况。适合频率-阻抗、时间-位移、温度-电压等二维曲线。',
    code: `{
  "dimensions": 2,
  "x_column": "频率",
  "x_unit": "Hz",
  "y_column": "磁导率",
  "y_unit": "μH/m",
  "series": [
    {"name": "实部", "data": [[1, 2.5], [3, 2.8]]},
    {"name": "虚部", "data": [[1, 1.2], [3, 1.5]]}
  ]
}`,
  },
  multiSeries: {
    title: '多样品对比',
    description: '当同一个算法需要输出多条样品曲线时，每个样品或每个分量都作为一条独立 series。',
    code: `{
  "dimensions": 2,
  "x_column": "时间",
  "x_unit": "s",
  "y_column": "位移",
  "y_unit": "mm",
  "series": [
    {"name": "样品 A", "data": [[0, 0.2], [1, 0.6], [2, 1.1]]},
    {"name": "样品 B", "data": [[0, 0.1], [1, 0.5], [2, 0.9]]},
    {"name": "样品 C", "data": [[0, 0.3], [1, 0.7], [2, 1.4]]}
  ]
}`,
  },
  chart3d: {
    title: '三维数据',
    description: '如果是规则网格曲面，推荐使用 `grid` 格式：`x_values + y_values + z_matrix`。只有在非规则点云或轨迹时，才继续使用 `[x, y, z]` 点列表。',
    code: `{
  "dimensions": 3,
  "x_column": "X",
  "x_unit": "mm",
  "y_column": "Y",
  "y_unit": "mm",
  "series": [
    {
      "name": "曲面 1",
      "format": "grid",
      "x_values": [0, 1, 2, 3],
      "y_values": [10, 20, 30],
      "z_matrix": [
        [0.1, 0.2, 0.4, 0.5],
        [0.3, 0.5, 0.7, 0.8],
        [0.6, 0.9, 1.1, 1.3]
      ]
    }
  ]
}`,
  },
}

const COMMON_MISTAKES = [
  '不要在 JSON 前后输出额外日志，例如“开始处理”“调试信息”等文本，否则系统可能无法解析。',
  '不要把多条曲线揉成一个大数组；多条曲线应该拆成多个 `series` 对象。',
  '二维图的数据点应写成 `[x, y]`，三维图应写成 `[x, y, z]`，不要写成对象形式。',
  '请尽量在输出前清洗空值，例如 `dropna()`，避免空字符串、NaN 直接进入结果。',
  '脚本报错时，建议输出类似 `print(json.dumps({"error": "错误信息"}))` 的可读错误。',
]

function getValidationColor(validation) {
  if (!validation) return 'default'
  if (validation.valid && (validation.warnings?.length || 0) === 0) return 'green'
  if (validation.valid) return 'gold'
  return 'red'
}

function getValidationLabel(validation) {
  if (!validation) return '未校验'
  if (validation.valid && (validation.warnings?.length || 0) === 0) return '校验通过'
  if (validation.valid) return '通过但有提醒'
  return '校验未通过'
}

export default function AlgorithmManagement() {
  const [form] = Form.useForm()
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingAlgorithm, setEditingAlgorithm] = useState(null)
  const [testResult, setTestResult] = useState(null)
  const [testLoading, setTestLoading] = useState(false)
  const [scriptSource, setScriptSource] = useState('input')
  const [editorLoading, setEditorLoading] = useState(false)
  const [scriptValidation, setScriptValidation] = useState(DEFAULT_VALIDATION)
  const [validationChecked, setValidationChecked] = useState(false)
  const [outputExampleKey, setOutputExampleKey] = useState('basic2d')

  const currentScript = Form.useWatch('script', form)

  const { data: testTypesData, isLoading: testTypesLoading } = useQuery({
    queryKey: ['testTypes'],
    queryFn: () => testApi.getTypeList({ page_size: 100 }),
  })

  const { data: algorithmsData, isLoading: algorithmsLoading, refetch } = useQuery({
    queryKey: ['algorithms'],
    queryFn: () => analysisApi.getAlgorithmList({ page_size: 100 }),
  })

  const testTypes = testTypesData?.results || testTypesData?.data?.results || []
  const algorithms = algorithmsData?.results || algorithmsData?.data?.results || []

  const validateScriptMutation = useMutation({
    mutationFn: (script) => analysisApi.validateAlgorithmScript({ script }),
    onSuccess: (response) => {
      const result = response?.data || response
      setScriptValidation(result)
      setValidationChecked(true)
      message.success(result?.valid ? '脚本校验通过' : '脚本校验未通过')
    },
    onError: (error) => {
      message.error(`脚本校验失败: ${error.message || error.detail || '未知错误'}`)
    },
  })

  const createAlgorithmMutation = useMutation({
    mutationFn: (data) => analysisApi.createAlgorithm(data),
    onSuccess: () => {
      message.success('算法创建成功')
      setIsModalVisible(false)
      form.resetFields()
      setTestResult(null)
      setScriptValidation(DEFAULT_VALIDATION)
      setValidationChecked(false)
      refetch()
    },
    onError: (error) => {
      message.error(`创建失败: ${error.message || error.detail || '未知错误'}`)
    },
  })

  const updateAlgorithmMutation = useMutation({
    mutationFn: ({ id, data }) => analysisApi.updateAlgorithm(id, data),
    onSuccess: () => {
      message.success('算法更新成功')
      setIsModalVisible(false)
      form.resetFields()
      setEditingAlgorithm(null)
      setTestResult(null)
      setScriptValidation(DEFAULT_VALIDATION)
      setValidationChecked(false)
      refetch()
    },
    onError: (error) => {
      message.error(`更新失败: ${error.message || error.detail || '未知错误'}`)
    },
  })

  const deleteAlgorithmMutation = useMutation({
    mutationFn: (id) => analysisApi.deleteAlgorithm(id),
    onSuccess: () => {
      message.success('算法删除成功')
      refetch()
    },
    onError: (error) => {
      message.error(`删除失败: ${error.message || '未知错误'}`)
    },
  })

  const testRunAlgorithmMutation = useMutation({
    mutationFn: ({ id, formData }) => analysisApi.testRunAlgorithm(id, formData),
    onSuccess: (data) => {
      const result = data?.data || data
      setTestResult(result)
      message.success('试运行成功')
    },
    onError: (error) => {
      const validation = error?.data
      if (validation?.errors || validation?.warnings) {
        setScriptValidation(validation)
        setValidationChecked(true)
      }
      message.error(`试运行失败: ${error.message || error.detail || '未知错误'}`)
    },
    onSettled: () => {
      setTestLoading(false)
    },
  })

  const validationSummary = useMemo(() => {
    if (!validationChecked) return '建议在保存或试运行前先做一次脚本校验。'
    return scriptValidation.summary
  }, [scriptValidation.summary, validationChecked])

  const resetEditorState = () => {
    form.resetFields()
    setTestResult(null)
    setScriptSource('input')
    setScriptValidation(DEFAULT_VALIDATION)
    setValidationChecked(false)
  }

  const handleAddAlgorithm = () => {
    setEditingAlgorithm(null)
    resetEditorState()
    setEditorLoading(false)
    setIsModalVisible(true)
  }

  const handleEditAlgorithm = async (algorithm) => {
    setEditorLoading(true)
    setEditingAlgorithm(null)
    resetEditorState()
    setIsModalVisible(true)

    try {
      const response = await analysisApi.getAlgorithmDetail(algorithm.id)
      const detail = response?.data || response
      setEditingAlgorithm(detail)
      form.setFieldsValue({
        test_type: detail.test_type,
        name: detail.name,
        description: detail.description,
        script: detail.script,
        is_active: detail.is_active,
      })
      setScriptValidation(detail.validation || DEFAULT_VALIDATION)
      setValidationChecked(true)
    } catch (error) {
      message.error(`加载算法详情失败: ${error.message || error.detail || '未知错误'}`)
      setIsModalVisible(false)
      form.resetFields()
    } finally {
      setEditorLoading(false)
    }
  }

  const handleDeleteAlgorithm = (id) => {
    deleteAlgorithmMutation.mutate(id)
  }

  const handleValidateScript = async () => {
    const script = form.getFieldValue('script')
    if (!script?.trim()) {
      message.warning('请先输入 Python 脚本')
      return
    }
    validateScriptMutation.mutate(script)
  }

  const handleTestRun = async (id, file) => {
    if (!file) {
      message.error('请选择测试文件')
      return
    }

    const script = form.getFieldValue('script')
    if (!script?.trim()) {
      message.error('请先填写 Python 脚本')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('script', script)
    setTestLoading(true)
    setTestResult(null)
    testRunAlgorithmMutation.mutate({ id, formData })
  }

  const handleSubmit = async (values) => {
    const latestValidation = await validateScriptMutation.mutateAsync(values.script || '')
    const validationResult = latestValidation?.data || latestValidation

    if (!validationResult?.valid) {
      message.error('脚本校验未通过，暂时不能保存')
      return
    }

    if (editingAlgorithm) {
      updateAlgorithmMutation.mutate({ id: editingAlgorithm.id, data: values })
    } else {
      const formData = new FormData()
      formData.append('test_type', values.test_type)
      formData.append('name', values.name)
      formData.append('description', values.description || '')
      formData.append('script', values.script || '')
      formData.append('is_active', values.is_active !== false ? 'true' : 'false')
      if (values.script_file?.[0]) {
        formData.append('script_file', values.script_file[0].originFileObj || values.script_file[0])
      }
      createAlgorithmMutation.mutate(formData)
    }
  }

  const handleFileUpload = (info) => {
    const file = info.file?.originFileObj || info.file
    if (!file) return false

    const reader = new FileReader()
    reader.onload = (event) => {
      form.setFieldsValue({ script: event.target?.result || '' })
      setValidationChecked(false)
      setScriptValidation(DEFAULT_VALIDATION)
      message.success('脚本文件已读取')
    }
    reader.onerror = () => {
      message.error('读取文件失败')
    }
    reader.readAsText(file)
    return false
  }

  const columns = [
    {
      title: '算法名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '测试类型',
      dataIndex: 'test_type_name',
      key: 'test_type_name',
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '脚本体检',
      dataIndex: 'validation',
      key: 'validation',
      render: (validation) => (
        <Tag color={getValidationColor(validation)}>
          {getValidationLabel(validation)}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            icon={<PlayCircleOutlined />}
            onClick={() => {
              message.info('可以直接基于当前编辑中的脚本内容试运行，不必先保存。')
              handleEditAlgorithm(record)
            }}
          >
            试运行
          </Button>
          <Button
            icon={<EditOutlined />}
            onClick={() => handleEditAlgorithm(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个算法吗？"
            onConfirm={() => handleDeleteAlgorithm(record.id)}
          >
            <Button danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="algorithm-management-page">
      <div className="page-header">
        <h2>数据处理算法管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddAlgorithm}>
          添加算法
        </Button>
      </div>

      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 16 }}
        message="推荐工作流"
        description="先写脚本，再点击“校验脚本”，确认通过后直接上传样本文件试运行；试运行没问题再保存启用。这样能更早发现风险脚本和输出格式问题。"
      />

      <Card className="algorithm-list-card">
        <Table
          columns={columns}
          dataSource={algorithms}
          rowKey="id"
          loading={algorithmsLoading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingAlgorithm ? '编辑算法' : '添加算法'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={960}
        destroyOnHidden
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical" disabled={editorLoading}>
          <Form.Item
            name="test_type"
            label="测试类型"
            rules={[{ required: true, message: '请选择测试类型' }]}
          >
            <Select placeholder="选择测试类型" loading={testTypesLoading}>
              {testTypes.map((type) => (
                <Option key={type.id} value={type.id}>
                  {type.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="name"
            label="算法名称"
            rules={[{ required: true, message: '请输入算法名称' }]}
          >
            <Input placeholder="输入算法名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="算法描述"
          >
            <TextArea rows={2} placeholder="输入算法描述，建议说明适用文件格式和输出含义" />
          </Form.Item>

          {!editingAlgorithm && (
            <Form.Item label="脚本来源">
              <Space wrap>
                <Button
                  type={scriptSource === 'input' ? 'primary' : 'default'}
                  onClick={() => setScriptSource('input')}
                >
                  手动输入
                </Button>
                <Button
                  type={scriptSource === 'upload' ? 'primary' : 'default'}
                  onClick={() => setScriptSource('upload')}
                >
                  上传 .py 文件
                </Button>
                <Button onClick={() => form.setFieldsValue({ script: SCRIPT_TEMPLATE })}>
                  单曲线模板
                </Button>
                <Button onClick={() => form.setFieldsValue({ script: SCRIPT_TEMPLATE_MULTI })}>
                  多曲线模板
                </Button>
              </Space>
            </Form.Item>
          )}

          {scriptSource === 'upload' && !editingAlgorithm && (
            <Form.Item name="script_file" label="上传 Python 脚本文件">
              <Upload
                accept=".py"
                maxCount={1}
                beforeUpload={handleFileUpload}
                onRemove={() => form.setFieldsValue({ script: '' })}
              >
                <Button icon={<UploadOutlined />}>选择 .py 文件</Button>
              </Upload>
            </Form.Item>
          )}

          <Form.Item
            name="script"
            label="Python 脚本"
            rules={[{ required: true, message: '请输入 Python 脚本' }]}
          >
            <TextArea
              rows={14}
              placeholder="输入 Python 脚本。脚本需要定义 main(file_path) 并最终通过 stdout 输出 JSON。"
              style={{ fontFamily: 'monospace', fontSize: 13 }}
              onChange={() => {
                setValidationChecked(false)
                setTestResult(null)
              }}
            />
          </Form.Item>

          <Alert
            showIcon
            type={scriptValidation.valid ? ((scriptValidation.warnings?.length || 0) > 0 ? 'warning' : 'success') : 'error'}
            icon={scriptValidation.valid ? <CheckCircleOutlined /> : <WarningOutlined />}
            message="脚本校验状态"
            description={
              <div>
                <p style={{ marginBottom: 8 }}>{validationSummary}</p>
                {(scriptValidation.errors?.length || 0) > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <strong>错误：</strong> {scriptValidation.errors.join('；')}
                  </div>
                )}
                {(scriptValidation.warnings?.length || 0) > 0 && (
                  <div>
                    <strong>提醒：</strong> {scriptValidation.warnings.join('；')}
                  </div>
                )}
              </div>
            }
            style={{ marginBottom: 16 }}
          />

          <Alert
            message="运行安全说明"
            description="系统会拦截明显高风险能力，例如网络访问、子进程调用、eval/exec 等。当前建议把算法聚焦在“读取文件 -> 处理数据 -> 输出 JSON”这条主线。"
            type="warning"
            showIcon
            icon={<SafetyCertificateOutlined />}
            style={{ marginBottom: 16 }}
          />

          <Alert
            message="脚本输出规范"
            description={
              <div>
                <p>脚本需要完成 3 件事：</p>
                <ol style={{ paddingLeft: 18, marginBottom: 12 }}>
                  <li>定义入口函数 `main(file_path)`，参数 `file_path` 是系统传入的数据文件路径。</li>
                  <li>读取并处理数据文件，整理成适合画图的结构。</li>
                  <li>最后使用 `print(json.dumps(result))` 输出 JSON，系统会把这段 JSON 当成图表数据。</li>
                </ol>
                <p style={{ marginBottom: 8 }}><strong>示例切换</strong></p>
                <Radio.Group
                  value={outputExampleKey}
                  onChange={(event) => setOutputExampleKey(event.target.value)}
                  style={{ marginBottom: 12 }}
                >
                  <Radio.Button value="basic2d">二维</Radio.Button>
                  <Radio.Button value="multiSeries">多曲线</Radio.Button>
                  <Radio.Button value="chart3d">三维</Radio.Button>
                </Radio.Group>
                <Alert
                  style={{ marginBottom: 12 }}
                  type="success"
                  showIcon={false}
                  message={OUTPUT_EXAMPLES[outputExampleKey].title}
                  description={OUTPUT_EXAMPLES[outputExampleKey].description}
                />
                <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, fontSize: 12, overflow: 'auto' }}>
                  {OUTPUT_EXAMPLES[outputExampleKey].code}
                </pre>
                <p style={{ marginBottom: 8 }}><strong>字段说明</strong></p>
                <ul style={{ paddingLeft: 18, marginBottom: 12 }}>
                  <li>`dimensions`：图表维度，目前常用 `2`，如果是三维数据则传 `3`。</li>
                  <li>`x_column`：X 轴名称，例如“频率”“时间”“位移”。</li>
                  <li>`x_unit`：X 轴单位，可留空，例如 `Hz`、`s`、`mm`。</li>
                  <li>`y_column`：Y 轴总名称，可留空；如果有多条曲线，通常写成这一组数据的物理量名称。</li>
                  <li>`y_unit`：Y 轴单位，可留空，例如 `μH/m`、`V`、`℃`。</li>
                  <li>`series`：曲线数组。每个对象代表一条曲线。</li>
                  <li>`series[].name`：曲线名称，例如“实部”“虚部”“样品 A”。</li>
                  <li>`series[].data`：数据点数组。二维图通常写成 `[[x1, y1], [x2, y2]]`。</li>
                  <li>三维图支持两种写法：非规则数据用 `series[].data = [[x, y, z], ...]`；规则网格曲面推荐用 `format: "grid" + x_values + y_values + z_matrix`。</li>
                </ul>
                <p style={{ marginBottom: 8 }}><strong>常见错误</strong></p>
                <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
                  {COMMON_MISTAKES.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            name="is_active"
            label="是否启用"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Divider>脚本校验与试运行</Divider>

          <Space style={{ marginBottom: 16 }} wrap>
            <Button
              onClick={handleValidateScript}
              loading={validateScriptMutation.isPending}
              icon={<SafetyCertificateOutlined />}
            >
              校验脚本
            </Button>
            <Tag color={getValidationColor(validationChecked ? scriptValidation : null)}>
              {validationChecked ? getValidationLabel(scriptValidation) : '待校验'}
            </Tag>
            {currentScript?.trim() ? (
              <Tag>{`${currentScript.trim().split('\n').length} 行脚本`}</Tag>
            ) : (
              <Tag>暂无脚本内容</Tag>
            )}
          </Space>

          <div className="test-section">
            {editingAlgorithm ? (
              <Upload.Dragger
                name="file"
                multiple={false}
                disabled={editorLoading || validateScriptMutation.isPending}
                beforeUpload={(file) => {
                  handleTestRun(editingAlgorithm.id, file)
                  return false
                }}
              >
                <p className="ant-upload-drag-icon">
                  <PlayCircleOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽数据文件到这里，直接试运行当前编辑中的脚本</p>
                <p className="ant-upload-hint">
                  支持 .csv、.xlsx、.txt 等数据文件，试运行会优先使用你当前文本框中的脚本内容。
                </p>
              </Upload.Dragger>
            ) : (
              <div className="test-disabled">
                <p>请先保存算法，再基于已创建算法进行试运行。</p>
              </div>
            )}
            {editorLoading && <div className="test-loading">正在加载算法详情...</div>}
            {testLoading && <div className="test-loading">试运行中...</div>}
            {testResult && (
              <div className="test-result" style={{ marginTop: 16 }}>
                <h5>试运行结果</h5>
                <div style={{ marginBottom: 8 }}>
                  <Tag color="blue">维度: {testResult.dimensions}D</Tag>
                  <Tag color="green">X 轴: {testResult.x_column || testResult.columns?.[0]}{testResult.x_unit ? ` (${testResult.x_unit})` : ''}</Tag>
                  {testResult.y_column && <Tag color="red">Y 轴: {testResult.y_column}{testResult.y_unit ? ` (${testResult.y_unit})` : ''}</Tag>}
                  <Tag color="purple">系列: {testResult.series?.map((series) => series.name).join(', ') || testResult.columns?.slice(1).join(', ')}</Tag>
                  <Tag color="orange">数据点: {testResult.series?.[0]?.data?.length || testResult.data?.length}</Tag>
                </div>
                <DataChart plotData={testResult} height={350} />
              </div>
            )}
          </div>

          <div className="form-actions" style={{ marginTop: 16, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>取消</Button>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={createAlgorithmMutation.isPending || updateAlgorithmMutation.isPending}
              >
                保存
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
