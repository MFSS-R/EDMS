import { useEffect, useMemo, useState } from 'react'
import { Card, Tabs, Form, Input, Button, Avatar, Upload, message, Descriptions } from 'antd'
import { UserOutlined, LockOutlined, EditOutlined } from '@ant-design/icons'
import { useAuthStore } from '../store/auth'
import { systemApi } from '../services/system'
import AvatarCropper from '../components/AvatarCropper/AvatarCropper'
import { resolveMediaUrl } from '../utils/media'

const { TabPane } = Tabs

export default function Settings() {
  const { user, updateProfile, changePassword } = useAuthStore()
  const [profileForm] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [profileLoading, setProfileLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [cropperOpen, setCropperOpen] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState(null)
  const [appVersion, setAppVersion] = useState('加载中...')
  const avatarSrc = useMemo(() => {
    if (!user?.avatar) return undefined
    const resolvedAvatarUrl = resolveMediaUrl(user.avatar)
    if (!resolvedAvatarUrl) return undefined
    const joiner = resolvedAvatarUrl.includes('?') ? '&' : '?'
    return `${resolvedAvatarUrl}${joiner}v=${user.updated_at || Date.now()}`
  }, [user?.avatar, user?.updated_at])

  useEffect(() => {
    let mounted = true

    const fetchVersion = async () => {
      try {
        const response = await systemApi.getVersion()
        const version = response.data?.version || response.version || '未知版本'
        if (mounted) setAppVersion(`v${version}`)
      } catch {
        if (mounted) setAppVersion('未知版本')
      }
    }

    fetchVersion()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    profileForm.setFieldsValue(user || {})
  }, [profileForm, user])

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

  const handleAvatarSelect = (info) => {
    const file = info.file.originFileObj || info.file
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setSelectedAvatar(reader.result)
      setCropperOpen(true)
    }
    reader.readAsDataURL(file)
  }

  const handleAvatarConfirm = async (croppedFile) => {
    setAvatarLoading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', croppedFile)
      await updateProfile(formData)
      setCropperOpen(false)
      setSelectedAvatar(null)
      message.success('头像更新成功')
    } catch (error) {
      message.error(error.message || '头像上传失败')
    } finally {
      setAvatarLoading(false)
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
              <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center' }}>
                <Avatar size={80} icon={<UserOutlined />} src={avatarSrc} />
                <Upload
                  name="avatar"
                  showUploadList={false}
                  beforeUpload={() => false}
                  onChange={handleAvatarSelect}
                  disabled={avatarLoading}
                  style={{ marginLeft: 16 }}
                >
                  <Button style={{ marginLeft: 16 }} icon={<EditOutlined />} loading={avatarLoading}>
                    更换头像
                  </Button>
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
                    保存
                  </Button>
                </Form.Item>
              </Form>
            </div>
          </TabPane>

          <TabPane tab="修改密码" key="password">
            <div style={{ maxWidth: 400 }}>
              <Form form={passwordForm} layout="vertical" onFinish={handlePasswordSubmit}>
                <Form.Item
                  name="old_password"
                  label="当前密码"
                  rules={[{ required: true, message: '请输入当前密码' }]}
                >
                  <Input.Password prefix={<LockOutlined />} />
                </Form.Item>
                <Form.Item
                  name="new_password"
                  label="新密码"
                  rules={[
                    { required: true, message: '请输入新密码' },
                    { min: 6, message: '密码至少 6 个字符' },
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
              <Descriptions.Item label="系统名称">EDMS</Descriptions.Item>
              <Descriptions.Item label="系统版本">{appVersion}</Descriptions.Item>
              <Descriptions.Item label="数据库">PostgreSQL / SQLite</Descriptions.Item>
              <Descriptions.Item label="后端框架">Django 4.2 LTS</Descriptions.Item>
              <Descriptions.Item label="前端框架">React 18 + Ant Design 5</Descriptions.Item>
            </Descriptions>
          </TabPane>
        </Tabs>
      </Card>

      <AvatarCropper
        open={cropperOpen}
        image={selectedAvatar}
        onCancel={() => {
          setCropperOpen(false)
          setSelectedAvatar(null)
        }}
        onConfirm={handleAvatarConfirm}
      />
    </div>
  )
}
