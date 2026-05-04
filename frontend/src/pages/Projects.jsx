import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '../services/project'
import { getStatusTag, formatDateTime } from '../utils/helpers'
import './Projects.css'

const { TextArea } = Input
const { Option } = Select

export default function Projects() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [modalVisible, setModalVisible] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [form] = Form.useForm()
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 })
  const [filters, setFilters] = useState({ status: null, search: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['projects', pagination, filters],
    queryFn: () => projectApi.getList({
      page: pagination.current,
      page_size: pagination.pageSize,
      status: filters.status,
      search: filters.search,
    }),
  })

  const createMutation = useMutation({
    mutationFn: projectApi.create,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['projects'] })
      setPagination({ current: 1, pageSize: 10 })
      message.success('项目创建成功')
      setModalVisible(false)
      form.resetFields()
    },
    onError: (error) => {
      message.error(error.message || '创建失败')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => projectApi.update(id, data),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['projects'] })
      message.success('项目更新成功')
      setModalVisible(false)
      setEditingProject(null)
      form.resetFields()
    },
    onError: (error) => {
      message.error(error.message || '更新失败')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: projectApi.delete,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['projects'] })
      message.success('项目删除成功')
    },
    onError: (error) => {
      message.error(error.message || '删除失败')
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: projectApi.batchDelete,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['projects'] })
      message.success('批量删除成功')
      setSelectedRowKeys([])
    },
    onError: (error) => {
      message.error(error.message || '批量删除失败')
    },
  })

  const responseData = data?.data || data
  const projects = Array.isArray(responseData?.results) ? responseData.results : []
  const total = responseData?.count || 0

  const handleCreate = () => {
    setEditingProject(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditingProject(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const handleDelete = (id) => {
    deleteMutation.mutate(id)
  }

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的项目')
      return
    }
    batchDeleteMutation.mutate(selectedRowKeys)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data: values })
    } else {
      createMutation.mutate(values)
    }
  }

  const columns = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text, record) => (
        <a onClick={() => navigate(`/projects/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const tag = getStatusTag(status)
        return <Tag color={tag.color}>{tag.text}</Tag>
      },
    },
    {
      title: '样品数量',
      dataIndex: 'sample_count',
      key: 'sample_count',
      width: 100,
      align: 'center',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date) => formatDateTime(date),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            title="编辑"
          />
          <Popconfirm
            title="确定要删除此项目吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} title="删除" />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  }

  return (
    <div className="projects-page">
      <div className="page-header">
        <h2>项目管理</h2>
        <Space>
          {selectedRowKeys.length > 0 && (
            <Popconfirm
              title={`确定要删除选中的 ${selectedRowKeys.length} 个项目吗？`}
              onConfirm={handleBatchDelete}
              okText="确定"
              cancelText="取消"
            >
              <Button danger icon={<DeleteOutlined />}>
                批量删除 ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建项目
          </Button>
        </Space>
      </div>

      <Card className="projects-card">
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          <Space>
            <Select
              placeholder="项目状态"
              allowClear
              style={{ width: 150 }}
              onChange={(value) => setFilters({ ...filters, status: value })}
            >
              <Option value="in_progress">进行中</Option>
              <Option value="completed">已完成</Option>
              <Option value="archived">已归档</Option>
            </Select>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={projects}
          rowKey="id"
          loading={isLoading}
          rowSelection={rowSelection}
          className="projects-table"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          }}
        />
      </Card>

      <Modal
        title={editingProject ? '编辑项目' : '新建项目'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false)
          setEditingProject(null)
          form.resetFields()
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        className="project-modal"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="请输入项目名称" />
          </Form.Item>
          <Form.Item name="description" label="项目描述">
            <TextArea rows={4} placeholder="请输入项目描述" />
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
    </div>
  )
}
