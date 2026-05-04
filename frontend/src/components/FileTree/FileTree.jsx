import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Tree, Spin, Empty, Input, Modal, Form, Select, Button, Space, message, Menu, DatePicker, Row, Col, Divider } from 'antd'
import { ProjectOutlined, ExperimentOutlined, FileTextOutlined, SearchOutlined, DownOutlined, DeleteOutlined, EditOutlined, PlusOutlined, MinusCircleOutlined, CopyOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { projectApi } from '../../services/project'
import { sampleApi } from '../../services/sample'
import { useFileTreeStore } from '../../store/fileTree'
import './FileTree.css'

const { Option } = Select
const { TextArea } = Input

export default function FileTree() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [searchText, setSearchText] = useState('')
  const { expandedKeys, setExpandedKeys, selectedKey, setSelectedKey } = useFileTreeStore()

  // Modal states
  const [projectModalVisible, setProjectModalVisible] = useState(false)
  const [projectForm] = Form.useForm()
  const [editingProject, setEditingProject] = useState(null)

  const [experimentModalVisible, setExperimentModalVisible] = useState(false)
  const [experimentForm] = Form.useForm()
  const [editingExperiment, setEditingExperiment] = useState(null)

  // Sample modal states
  const [sampleModalVisible, setSampleModalVisible] = useState(false)
  const [sampleForm] = Form.useForm()
  const [editingSample, setEditingSample] = useState(null)
  const [selectedProjectForSample, setSelectedProjectForSample] = useState(null)
  const [copyModalVisible, setCopyModalVisible] = useState(false)
  const [sampleTypeModalVisible, setSampleTypeModalVisible] = useState(false)
  const [sampleTypeForm] = Form.useForm()

  // Context menu states
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    node: null,
    nodeType: null
  })

  const contentRef = useRef(null)

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (contextMenu.visible) {
        setContextMenu(prev => ({ ...prev, visible: false }))
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu.visible])

  // Handle blank area right-click using native event listener (capture phase)
  // Ant Design Tree intercepts contextmenu events, so React's onContextMenu
  // on the parent div doesn't fire. We use capture phase to intercept first.
  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    const handleNativeContextMenu = (e) => {
      const treeNode = e.target.closest('.ant-tree-treenode')
      if (!treeNode) {
        e.preventDefault()
        setContextMenu({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          node: null,
          nodeType: 'empty'
        })
      }
    }

    el.addEventListener('contextmenu', handleNativeContextMenu, true)
    return () => {
      el.removeEventListener('contextmenu', handleNativeContextMenu, true)
    }
  }, [])

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.getList({ page_size: 100 }),
  })

  const projectsResponse = projectsData?.data || projectsData
  const projects = Array.isArray(projectsResponse?.results) ? projectsResponse.results : []

  const { data: experimentsData, isLoading: experimentsLoading } = useQuery({
    queryKey: ['experiments'],
    queryFn: () => sampleApi.getExperimentList({ page_size: 200 }),
    enabled: projects.length > 0,
  })

  const experimentsResponse = experimentsData?.data || experimentsData
  const experiments = Array.isArray(experimentsResponse?.results) ? experimentsResponse.results : []

  const { data: samplesData, isLoading: samplesLoading } = useQuery({
    queryKey: ['samples'],
    queryFn: () => sampleApi.getList({ page_size: 500 }),
    enabled: experiments.length > 0,
  })

  const samplesResponse = samplesData?.data || samplesData
  const samples = Array.isArray(samplesResponse?.results) ? samplesResponse.results : []

  // Mutations
  const createProjectMutation = useMutation({
    mutationFn: projectApi.create,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['projects'] })
      message.success('项目创建成功')
      setProjectModalVisible(false)
      projectForm.resetFields()
    },
    onError: (error) => {
      message.error(error.message || '创建失败')
    },
  })

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }) => projectApi.update(id, data),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['projects'] })
      message.success('项目更新成功')
      setProjectModalVisible(false)
      setEditingProject(null)
      projectForm.resetFields()
    },
    onError: (error) => {
      message.error(error.message || '更新失败')
    },
  })

  const createExperimentMutation = useMutation({
    mutationFn: sampleApi.createExperiment,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['experiments'] })
      message.success('实验创建成功')
      setExperimentModalVisible(false)
      experimentForm.resetFields()
    },
    onError: (error) => {
      message.error(error.message || '创建失败')
    },
  })

  const updateExperimentMutation = useMutation({
    mutationFn: ({ id, data }) => sampleApi.updateExperiment(id, data),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['experiments'] })
      message.success('实验更新成功')
      setExperimentModalVisible(false)
      setEditingExperiment(null)
      experimentForm.resetFields()
    },
    onError: (error) => {
      message.error(error.message || '更新失败')
    },
  })

  // Sample mutations
  const createSampleMutation = useMutation({
    mutationFn: sampleApi.create,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['samples'] })
      message.success('样品创建成功')
      setSampleModalVisible(false)
      sampleForm.resetFields()
    },
    onError: (error) => {
      message.error(error.message || '创建失败')
    },
  })

  const updateSampleMutation = useMutation({
    mutationFn: ({ id, data }) => sampleApi.update(id, data),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['samples'] })
      message.success('样品更新成功')
      setSampleModalVisible(false)
      setEditingSample(null)
      sampleForm.resetFields()
    },
    onError: (error) => {
      message.error(error.message || '更新失败')
    },
  })

  const deleteSampleMutation = useMutation({
    mutationFn: sampleApi.delete,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['samples'] })
      message.success('样品删除成功')
    },
    onError: (error) => {
      message.error(error.message || '删除失败')
    },
  })

  // Sample type queries
  const { data: sampleTypesData, isLoading: sampleTypesLoading } = useQuery({
    queryKey: ['sampleTypes', selectedProjectForSample],
    queryFn: () => sampleApi.getTypeList({ project: selectedProjectForSample }),
    enabled: !!selectedProjectForSample,
  })

  const sampleTypesResponse = sampleTypesData?.data || sampleTypesData
  const sampleTypes = Array.isArray(sampleTypesResponse?.results) ? sampleTypesResponse.results : []

  // Sample type mutation
  const createSampleTypeMutation = useMutation({
    mutationFn: sampleApi.createType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sampleTypes', selectedProjectForSample] })
      message.success('样品类型创建成功')
      setSampleTypeModalVisible(false)
      sampleTypeForm.resetFields()
    },
    onError: (error) => {
      message.error(error.message || '创建失败')
    },
  })

  // Copy preparation conditions
  const handleCopyConditions = async (sampleId) => {
    try {
      const response = await sampleApi.copyPreparationConditions(null, sampleId)
      const conditions = response.data.preparation_conditions
      const formattedConditions = Object.entries(conditions).map(([name, data]) => ({
        name,
        value: data.value,
        unit: data.unit,
      }))
      sampleForm.setFieldsValue({ preparation_conditions: formattedConditions })
      message.success('制备条件复制成功')
      setCopyModalVisible(false)
    } catch (error) {
      message.error('复制失败')
    }
  }

  // Delete mutations
  const deleteExperimentMutation = useMutation({
    mutationFn: sampleApi.deleteExperiment,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['experiments'] })
      message.success('实验删除成功')
    },
    onError: (error) => {
      message.error(error.message || '删除失败')
    },
  })

  const deleteProjectMutation = useMutation({
    mutationFn: projectApi.delete,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['projects'] })
      message.success('项目删除成功')
    },
    onError: (error) => {
      message.error(error.message || '删除失败')
    },
  })

  const buildTreeData = useMemo(() => {
    const filteredProjects = searchText
      ? projects.filter(p => p.name.toLowerCase().includes(searchText.toLowerCase()))
      : projects

    return filteredProjects.map(project => {
      const projectExperiments = experiments.filter(e => e.project === project.id)
      
      const children = projectExperiments.map(experiment => {
        const experimentSamples = samples.filter(s => s.experiment === experiment.id)
        
        const sampleChildren = experimentSamples.map(sample => ({
          key: `sample-${sample.sample_id}`,
          title: sample.name || sample.sample_id,
          isLeaf: true,
          icon: <FileTextOutlined />,
          onClick: () => {
            setSelectedKey(`sample-${sample.sample_id}`)
            navigate(`/samples/${sample.sample_id}`)
          },
        }))

        return {
          key: `experiment-${experiment.id}`,
          title: `${experiment.name} (${experiment.sample_count || 0})`,
          icon: <ExperimentOutlined />,
          children: sampleChildren.length > 0 ? sampleChildren : undefined,
          onClick: () => {
            setSelectedKey(`experiment-${experiment.id}`)
            navigate(`/experiments/${experiment.id}`)
          },
        }
      })

      return {
        key: `project-${project.id}`,
        title: project.name,
        icon: <ProjectOutlined />,
        children: children.length > 0 ? children : undefined,
        onClick: () => {
          setSelectedKey(`project-${project.id}`)
          navigate(`/projects/${project.id}`)
        },
      }
    })
  }, [projects, experiments, samples, searchText, setSelectedKey, navigate])

  const treeData = buildTreeData

  useEffect(() => {
    const path = location.pathname
    if (path.startsWith('/samples/')) {
      const sampleId = path.split('/')[2]
      setSelectedKey(`sample-${sampleId}`)
    } else if (path.startsWith('/experiments/')) {
      const experimentId = path.split('/')[2]
      setSelectedKey(`experiment-${experimentId}`)
    } else if (path.startsWith('/projects/')) {
      const projectId = path.split('/')[2]
      setSelectedKey(`project-${projectId}`)
    }
  }, [location.pathname, setSelectedKey])
  
  useEffect(() => {
    // Only set expanded project nodes after all data is loaded
    if (projects.length > 0 && experiments.length > 0 && samples.length > 0) {
      const projectKeys = projects.map(p => `project-${p.id}`)
      setExpandedKeys(projectKeys)
    }
  }, [projects, experiments, samples, setExpandedKeys])

  const handleExpand = (keys) => {
    setExpandedKeys(keys)
  }

  const handleSelect = (keys, info) => {
    if (info.node.onClick) {
      info.node.onClick()
    }
  }

  const handleProjectSubmit = () => {
    projectForm.validateFields().then(values => {
      if (editingProject) {
        updateProjectMutation.mutate({ id: editingProject.id, data: values })
      } else {
        createProjectMutation.mutate(values)
      }
    })
  }

  const handleExperimentSubmit = () => {
    experimentForm.validateFields().then(values => {
      if (editingExperiment) {
        updateExperimentMutation.mutate({ id: editingExperiment.id, data: values })
      } else {
        createExperimentMutation.mutate(values)
      }
    })
  }

  // Context menu functions
  const getNodeType = (key) => {
    if (key.startsWith('project-')) return 'project'
    if (key.startsWith('experiment-')) return 'experiment'
    if (key.startsWith('sample-')) return 'sample'
    return null
  }

  const getContextMenuItems = () => {
    const { nodeType, node } = contextMenu
    const items = []

    switch (nodeType) {
      case 'empty':
        items.push({ key: 'add-project', label: '添加项目' })
        break
      case 'project':
        items.push(
          { key: 'add-experiment', label: '添加实验' },
          { key: 'edit', label: '编辑' },
          { key: 'delete', label: '删除' }
        )
        break
      case 'experiment':
        items.push(
          { key: 'add-sample', label: '添加样品' },
          { key: 'edit', label: '编辑' },
          { key: 'delete', label: '删除' }
        )
        break
      case 'sample':
        items.push(
          { key: 'edit', label: '编辑' },
          { key: 'delete', label: '删除' }
        )
        break
    }

    return items
  }

  const handleContextMenu = (e, node) => {
    const nodeType = getNodeType(node?.key)
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      node,
      nodeType: nodeType || 'empty'
    })
  }

  const handleMenuClick = (e) => {
    const { node, nodeType } = contextMenu
    const key = e.key

    switch (key) {
      case 'add-project':
        handleAddProject()
        break
      case 'add-experiment':
        handleAddExperiment(node)
        break
      case 'add-sample':
        handleAddSample(node)
        break
      case 'edit':
        handleEdit(node, nodeType)
        break
      case 'delete':
        handleDelete(node, nodeType)
        break
    }

    setContextMenu({ ...contextMenu, visible: false })
  }

  const handleAddProject = () => {
    setEditingProject(null)
    projectForm.resetFields()
    setProjectModalVisible(true)
  }

  const handleAddExperiment = (node) => {
    const projectId = node.key.split('-')[1]
    setEditingExperiment(null)
    experimentForm.setFieldsValue({ project: projectId })
    setExperimentModalVisible(true)
  }

  const handleAddSample = (node) => {
    const experimentId = node.key.split('-')[1]
    const experiment = experiments.find(e => e.id === parseInt(experimentId))
    const projectId = experiment?.project
    
    setSelectedProjectForSample(projectId)
    setEditingSample(null)
    sampleForm.setFieldsValue({ experiment: experimentId })
    setSampleModalVisible(true)
  }

  const handleEdit = (node, nodeType) => {
    const id = node.key.split('-')[1]
    
    switch (nodeType) {
      case 'project':
        const project = projects.find(p => p.id === parseInt(id))
        if (project) {
          setEditingProject(project)
          projectForm.setFieldsValue(project)
          setProjectModalVisible(true)
        }
        break
      case 'experiment':
        const experiment = experiments.find(e => e.id === parseInt(id))
        if (experiment) {
          setEditingExperiment(experiment)
          experimentForm.setFieldsValue(experiment)
          setExperimentModalVisible(true)
        }
        break
      case 'sample':
        const sample = samples.find(s => s.sample_id === id)
        if (sample) {
          setEditingSample(sample)
          sampleForm.setFieldsValue(sample)
          setSampleModalVisible(true)
        }
        break
    }
  }

  const handleDelete = (node, nodeType) => {
    const id = node.key.split('-')[1]
    const typeNames = { project: '项目', experiment: '实验', sample: '样品' }
    
    Modal.confirm({
      title: `确定删除此${typeNames[nodeType]}？`,
      content: nodeType === 'project' ? '删除项目将同时删除其下所有实验和样品数据' 
        : nodeType === 'experiment' ? '删除实验将同时删除其下所有样品数据' 
        : '删除样品将同时删除其关联的测试数据',
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        switch (nodeType) {
          case 'project':
            deleteProjectMutation.mutate(id)
            break
          case 'experiment':
            deleteExperimentMutation.mutate(id)
            break
          case 'sample':
            deleteSampleMutation.mutate(id)
            break
        }
      }
    })
  }

  // Sample submit handler
  const handleSampleSubmit = () => {
    sampleForm.validateFields().then(values => {
      // 处理制备条件
      const preparationConditions = {}
      values.preparation_conditions?.forEach(item => {
        if (item?.name) {
          preparationConditions[item.name] = {
            value: item.value,
            unit: item.unit || '',
          }
        }
      })
      
      const submitData = {
        ...values,
        synthesis_date: values.synthesis_date ? dayjs(values.synthesis_date).format('YYYY-MM-DD') : null,
        preparation_conditions: preparationConditions,
      }
      
      if (editingSample) {
        updateSampleMutation.mutate({ id: editingSample.sample_id, data: submitData })
      } else {
        createSampleMutation.mutate(submitData)
      }
    })
  }

  // Only show loading when initially fetching data
  const isInitialLoading = projectsLoading || (experimentsLoading && projects.length === 0) || (samplesLoading && experiments.length === 0)
  // When expanding a node, we don't show loading because data is already loaded
  const showLoading = isInitialLoading && treeData.length === 0

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <span className="file-tree-title">我的项目</span>
      </div>
      <div className="file-tree-search">
        <Input
          placeholder="搜索项目..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          allowClear
          size="small"
        />
      </div>
      <div 
        ref={contentRef}
        className="file-tree-content"
      >
        {showLoading ? (
          <div className="file-tree-loading">
            <Spin size="small" />
          </div>
        ) : treeData.length === 0 ? (
          <div className="file-tree-empty">
            <Empty 
              description="暂无项目" 
              image={Empty.PRESENTED_IMAGE_SIMPLE} 
            />
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              style={{ marginTop: 16 }}
              onClick={handleAddProject}
            >
              添加项目
            </Button>
          </div>
        ) : (
          <Tree
            showIcon
            expandedKeys={expandedKeys}
            selectedKeys={selectedKey ? [selectedKey] : []}
            onExpand={handleExpand}
            onSelect={handleSelect}
            onRightClick={({ event, node }) => {
              event.preventDefault()
              event.stopPropagation()
              handleContextMenu(event, node)
            }}
            treeData={treeData}
            switcherIcon={<DownOutlined />}
          />
        )}
      </div>

      {/* Project Modal */}
      <Modal
        title={editingProject ? '编辑项目' : '添加项目'}
        open={projectModalVisible}
        onOk={handleProjectSubmit}
        onCancel={() => {
          setProjectModalVisible(false)
          setEditingProject(null)
          projectForm.resetFields()
        }}
        confirmLoading={createProjectMutation.isPending || updateProjectMutation.isPending}
      >
        <Form form={projectForm} layout="vertical">
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="项目名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="描述" />
          </Form.Item>
          <Form.Item 
            name="status" 
            label="项目状态" 
            rules={[{ required: true, message: '请选择项目状态' }]}
            initialValue="in_progress"
          >
            <Select placeholder="请选择项目状态">
              <Option value="in_progress">进行中</Option>
              <Option value="completed">已完成</Option>
              <Option value="archived">已归档</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Experiment Modal */}
      <Modal
        title={editingExperiment ? '编辑实验' : '添加实验'}
        open={experimentModalVisible}
        onOk={handleExperimentSubmit}
        onCancel={() => {
          setExperimentModalVisible(false)
          setEditingExperiment(null)
          experimentForm.resetFields()
        }}
        confirmLoading={createExperimentMutation.isPending || updateExperimentMutation.isPending}
      >
        <Form form={experimentForm} layout="vertical">
          {!editingExperiment && (
            <Form.Item name="project" label="所属项目" rules={[{ required: true }]}>
              <Select placeholder="选择所属项目">
                {projects.map(p => (
                  <Option key={p.id} value={p.id}>{p.name}</Option>
                ))}
              </Select>
            </Form.Item>
          )}
          <Form.Item name="name" label="实验名称" rules={[{ required: true, message: '请输入实验名称' }]}>
            <Input placeholder="实验名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="描述" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Sample Modal */}
      <Modal
        title={editingSample ? '编辑样品' : '添加样品'}
        open={sampleModalVisible}
        onOk={handleSampleSubmit}
        onCancel={() => {
          setSampleModalVisible(false)
          setEditingSample(null)
          sampleForm.resetFields()
        }}
        confirmLoading={createSampleMutation.isPending || updateSampleMutation.isPending}
        width={800}
      >
        <Form form={sampleForm} layout="vertical">
          {/* 基本信息 */}
          <Divider orientation="left">基本信息</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="experiment" label="所属实验" rules={[{ required: true }]}>
                <Select placeholder="选择所属实验" disabled={!editingSample}>
                  {experiments.map(e => (
                    <Option key={e.id} value={e.id}>{e.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sample_type" label="样品类型" rules={[{ required: true, message: '请选择样品类型' }]}>
                <Select
                  placeholder={selectedProjectForSample ? "请选择样品类型" : "请先选择实验"}
                  loading={sampleTypesLoading}
                  disabled={!selectedProjectForSample}
                  style={{ width: '100%' }}
                >
                  {sampleTypes.map(st => (
                    <Option key={st.id} value={st.id}>{st.name}</Option>
                  ))}
                </Select>
              </Form.Item>
              {selectedProjectForSample && (
                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  onClick={() => setSampleTypeModalVisible(true)}
                  style={{ position: 'absolute', right: 0, top: 0 }}
                >
                  添加
                </Button>
              )}
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="display_code" label="显示代号">
                <Input placeholder="例如 A2 / Ring-03 / S1" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="name" label="样品名称">
                <Input placeholder="样品名称" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="synthesis_date" label="合成日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="batch_number" label="批次号">
                <Input placeholder="批次号" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="mark" label="标记">
                <Input placeholder="标记" />
              </Form.Item>
            </Col>
          </Row>

          {/* 制备条件 */}
          <Divider orientation="left">
            制备条件
            <Button
              type="link"
              icon={<CopyOutlined />}
              onClick={() => setCopyModalVisible(true)}
            >
              从其他样品复制
            </Button>
          </Divider>
          
          <Form.List name="preparation_conditions">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={16} align="middle" style={{ marginBottom: 8 }}>
                    <Col span={8}>
                      <Form.Item
                        {...restField}
                        name={[name, 'name']}
                        rules={[{ required: true, message: '请输入字段名' }]}
                      >
                        <Input placeholder="字段名称" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        {...restField}
                        name={[name, 'value']}
                        rules={[{ required: true, message: '请输入值' }]}
                      >
                        <Input placeholder="值" />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item {...restField} name={[name, 'unit']}>
                        <Input placeholder="单位" />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <MinusCircleOutlined onClick={() => remove(name)} style={{ fontSize: 20, color: '#ff4d4f' }} />
                    </Col>
                  </Row>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    添加制备条件
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          {/* 备注 */}
          <Divider orientation="left">备注</Divider>
          <Form.Item name="notes">
            <TextArea rows={4} placeholder="备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加样品类型模态框 */}
      <Modal
        title="添加样品类型"
        open={sampleTypeModalVisible}
        onOk={() => {
          sampleTypeForm.validateFields().then(values => {
            createSampleTypeMutation.mutate({
              project: selectedProjectForSample,
              ...values
            })
          })
        }}
        onCancel={() => setSampleTypeModalVisible(false)}
        confirmLoading={createSampleTypeMutation.isPending}
      >
        <Form form={sampleTypeForm} layout="vertical">
          <Form.Item name="name" label="样品类型名称" rules={[{ required: true, message: '请输入样品类型名称' }]}>
            <Input placeholder="样品类型名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={4} placeholder="描述" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 复制制备条件模态框 */}
      <Modal
        title="从其他样品复制制备条件"
        open={copyModalVisible}
        onCancel={() => setCopyModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setCopyModalVisible(false)}>
            取消
          </Button>
        ]}
      >
        <Form layout="vertical">
          <Form.Item label="选择样品">
            <Select
              placeholder="选择要复制的样品"
              style={{ width: '100%' }}
              onChange={handleCopyConditions}
            >
              {samples.map(sample => (
                <Option key={sample.sample_id} value={sample.sample_id}>
                  {sample.sample_id} - {sample.name || '未命名'}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div 
          className="context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 10000,
          }}
        >
          <Menu
            onClick={handleMenuClick}
            items={getContextMenuItems()}
            style={{ width: 150 }}
          />
        </div>
      )}
    </div>
  )
}
