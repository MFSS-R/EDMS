import { useEffect, useMemo, useState } from 'react'
import { Card, Tabs, Form, Input, Button, Avatar, Upload, message, Descriptions } from 'antd'
import { UserOutlined, LockOutlined, EditOutlined } from '@ant-design/icons'
import { useAuthStore } from '../store/auth'
import { authApi } from '../services/auth'
import { systemApi } from '../services/system'
import AvatarCropper from '../components/AvatarCropper/AvatarCropper'

const { TabPane } = Tabs

export default function Settings() {
  const { user, updateProfile, changePassword, setUser } = useAuthStore()
  const [profileForm] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [profileLoading, setProfileLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [cropperOpen, setCropperOpen] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState(null)
  const [appVersion, setAppVersion] = useState('Loading...')
  const avatarSrc = useMemo(() => {
    if (!user?.avatar) return undefined
    const joiner = user.avatar.includes('?') ? '&' : '?'
    return `${user.avatar}${joiner}v=${user.updated_at || Date.now()}`
  }, [user?.avatar, user?.updated_at])

  useEffect(() => {
    let mounted = true

    const fetchVersion = async () => {
      try {
        const response = await systemApi.getVersion()
        const version = response.data?.version || response.version || 'unknown'
        if (mounted) setAppVersion(`v${version}`)
      } catch {
        if (mounted) setAppVersion('unknown')
      }
    }

    fetchVersion()
    return () => {
      mounted = false
    }
  }, [])

  const handleProfileSubmit = async (values) => {
    setProfileLoading(true)
    try {
      await updateProfile(values)
      message.success('Profile updated successfully')
    } catch (error) {
      message.error(error.message || 'Update failed')
    } finally {
      setProfileLoading(false)
    }
  }

  const handlePasswordSubmit = async (values) => {
    setPasswordLoading(true)
    try {
      await changePassword(values)
      message.success('Password changed successfully')
      passwordForm.resetFields()
    } catch (error) {
      message.error(error.message || 'Change failed')
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
      const response = await authApi.updateProfile(formData)
      const updatedUser = response.data || response
      setUser(updatedUser)
      setCropperOpen(false)
      setSelectedAvatar(null)
      message.success('Avatar updated successfully')
    } catch (error) {
      message.error(error.message || 'Avatar upload failed')
    } finally {
      setAvatarLoading(false)
    }
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <h2>System Settings</h2>
      </div>

      <Card>
        <Tabs defaultActiveKey="profile">
          <TabPane tab="Profile" key="profile">
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
                    Change Avatar
                  </Button>
                </Upload>
              </div>

              <Form
                form={profileForm}
                layout="vertical"
                initialValues={user}
                onFinish={handleProfileSubmit}
              >
                <Form.Item name="username" label="Username">
                  <Input disabled />
                </Form.Item>
                <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="real_name" label="Real Name">
                  <Input />
                </Form.Item>
                <Form.Item name="phone" label="Phone">
                  <Input />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={profileLoading}>
                    Save
                  </Button>
                </Form.Item>
              </Form>
            </div>
          </TabPane>

          <TabPane tab="Password" key="password">
            <div style={{ maxWidth: 400 }}>
              <Form form={passwordForm} layout="vertical" onFinish={handlePasswordSubmit}>
                <Form.Item
                  name="old_password"
                  label="Current Password"
                  rules={[{ required: true, message: 'Please enter current password' }]}
                >
                  <Input.Password prefix={<LockOutlined />} />
                </Form.Item>
                <Form.Item
                  name="new_password"
                  label="New Password"
                  rules={[
                    { required: true, message: 'Please enter new password' },
                    { min: 6, message: 'Password must be at least 6 characters' },
                  ]}
                >
                  <Input.Password prefix={<LockOutlined />} />
                </Form.Item>
                <Form.Item
                  name="new_password2"
                  label="Confirm Password"
                  dependencies={['new_password']}
                  rules={[
                    { required: true, message: 'Please confirm new password' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('new_password') === value) {
                          return Promise.resolve()
                        }
                        return Promise.reject(new Error('Passwords do not match'))
                      },
                    }),
                  ]}
                >
                  <Input.Password prefix={<LockOutlined />} />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={passwordLoading}>
                    Change Password
                  </Button>
                </Form.Item>
              </Form>
            </div>
          </TabPane>

          <TabPane tab="System" key="system">
            <Descriptions column={1} style={{ maxWidth: 400 }}>
              <Descriptions.Item label="System">EDMS</Descriptions.Item>
              <Descriptions.Item label="Version">{appVersion}</Descriptions.Item>
              <Descriptions.Item label="Database">PostgreSQL / SQLite</Descriptions.Item>
              <Descriptions.Item label="Backend">Django 4.2 LTS</Descriptions.Item>
              <Descriptions.Item label="Frontend">React 18 + Ant Design 5</Descriptions.Item>
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
