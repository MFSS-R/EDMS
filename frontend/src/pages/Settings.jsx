import { useState } from 'react'
import { Card, Tabs, Form, Input, Button, Avatar, Upload, message, Descriptions } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuthStore } from '../store/auth'

const { TabPane } = Tabs

export default function Settings() {
  const { user, updateProfile, changePassword } = useAuthStore()
  const [profileForm] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [profileLoading, setProfileLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)

  const handleProfileSubmit = async (values) => {
    setProfileLoading(true)
    try {
      await updateProfile(values)
      message.success('个人信息更新成功')
    } catch (error) {
      message.error(error.message || '更新失败')
    } finally {
      setProfileLoading(false)
    }
  }

  const handlePasswordSubmit = async (values) => {
    setPasswordLoading(true)
    try {
      await changePassword(values)
      message.success('密码修改成功')
      passwordForm.resetFields()
    } catch (error) {
      message.error(error.message || '修改失败')
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleAvatarUpload = async (info) => {
    if (info.file.status === 'done') {
      message.success('头像上传成功')
    } else if (info.file.status === 'error') {
      message.error('头像上传失败')
    }
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <h2>系统设置</h2>
      </div>

      <Card>
        <Tabs defaultActiveKey="profile">
          <TabPane tab="个人信息" key="profile">
            <div style={{ maxWidth: 600 }}>
              <div style={{ marginBottom: 24 }}>
                <Avatar size={80} icon={<UserOutlined />} src={user?.avatar} />
                <Upload
                  name="avatar"
                  showUploadList={false}
                  action="/api/auth/profile/"
                  onChange={handleAvatarUpload}
                  style={{ marginLeft: 16 }}
                >
                  <Button style={{ marginLeft: 16 }}>更换头像</Button>
                </Upload>
              </div>
              
              <Form
                form={profileForm}
                layout="vertical"
                initialValues={user}
                onFinish={handleProfileSubmit}
              >
                <Form.Item name="username" label="用户名">
                  <Input disabled />
                </Form.Item>
                <Form.Item name="email" label="邮箱" rules={[{ type: 'email' }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="real_name" label="真实姓名">
                  <Input />
                </Form.Item>
                <Form.Item name="phone" label="手机号">
                  <Input />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={profileLoading}>
                    保存修改
                  </Button>
                </Form.Item>
              </Form>
            </div>
          </TabPane>

          <TabPane tab="修改密码" key="password">
            <div style={{ maxWidth: 400 }}>
              <Form
                form={passwordForm}
                layout="vertical"
                onFinish={handlePasswordSubmit}
              >
                <Form.Item
                  name="old_password"
                  label="原密码"
                  rules={[{ required: true, message: '请输入原密码' }]}
                >
                  <Input.Password prefix={<LockOutlined />} />
                </Form.Item>
                <Form.Item
                  name="new_password"
                  label="新密码"
                  rules={[
                    { required: true, message: '请输入新密码' },
                    { min: 6, message: '密码至少6个字符' },
                  ]}
                >
                  <Input.Password prefix={<LockOutlined />} />
                </Form.Item>
                <Form.Item
                  name="new_password2"
                  label="确认新密码"
                  dependencies={['new_password']}
                  rules={[
                    { required: true, message: '请确认新密码' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('new_password') === value) {
                          return Promise.resolve()
                        }
                        return Promise.reject(new Error('两次输入的密码不一致'))
                      },
                    }),
                  ]}
                >
                  <Input.Password prefix={<LockOutlined />} />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={passwordLoading}>
                    修改密码
                  </Button>
                </Form.Item>
              </Form>
            </div>
          </TabPane>

          <TabPane tab="系统信息" key="system">
            <Descriptions column={1} style={{ maxWidth: 400 }}>
              <Descriptions.Item label="系统名称">实验数据管理系统 EDMS</Descriptions.Item>
              <Descriptions.Item label="系统版本">v1.0.0</Descriptions.Item>
              <Descriptions.Item label="数据库">SQLite 3</Descriptions.Item>
              <Descriptions.Item label="后端框架">Django 4.2 LTS</Descriptions.Item>
              <Descriptions.Item label="前端框架">React 18 + Ant Design 5</Descriptions.Item>
            </Descriptions>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  )
}
