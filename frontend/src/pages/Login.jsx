import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Form, Input, Button, Card, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuthStore } from '../store/auth'
import { clearAuthRedirectFlag } from '../services/authRedirect'
import './Auth.css'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuthStore()

  useEffect(() => {
    clearAuthRedirectFlag()
  }, [])

  const handleSubmit = async (values) => {
    setLoading(true)
    try {
      await login(values)
      message.success('登录成功')
      navigate('/dashboard')
    } catch (error) {
      const errorMessage = error.message || '登录失败，请检查用户名和密码'
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <Card className="auth-card">
        <div className="auth-header">
          <h1>实验数据管理系统</h1>
          <p>EDMS - Experiment Data Management System</p>
        </div>
        <Form
          name="login"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名或邮箱' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名或邮箱"
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>
        <div className="auth-footer">
          还没有账号？<Link to="/register">立即注册</Link>
        </div>
      </Card>
    </div>
  )
}
