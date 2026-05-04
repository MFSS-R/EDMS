# 实验数据管理系统（EDMS）

一套面向材料实验与测试数据管理的系统，采用 `React + Django` 前后端分离架构，支持样品管理、测试数据管理、数据分析与用户权限控制。

## 功能特点

- 项目管理：创建和管理多个研究项目
- 样品管理：支持样品信息维护、真实姓名/备注等字段管理
- 测试数据管理：支持测试类型、测试文件上传和详情查看
- 数据分析：支持图表展示、分析画布和算法管理
- 用户中心：支持个人信息维护、头像上传、密码修改
- 权限控制：用户仅可访问自己的业务数据

## 技术栈

### 后端

- Django 4.2 LTS
- Django REST Framework
- JWT 认证
- SQLite / PostgreSQL

### 前端

- React 18
- Ant Design 5
- React Router 6
- Zustand
- React Query
- Axios

## 项目结构

```text
EDMS_ReactDjango/
├─ backend/                  # Django 后端
│  ├─ apps/                  # 业务模块
│  │  ├─ analysis/           # 数据分析
│  │  ├─ projects/           # 项目管理
│  │  ├─ samples/            # 样品管理
│  │  ├─ tests/              # 测试数据管理
│  │  └─ users/              # 用户与认证
│  ├─ edms/                  # Django 项目配置
│  ├─ manage.py
│  └─ requirements.txt
├─ frontend/                 # React 前端
│  ├─ src/
│  │  ├─ components/         # 通用组件
│  │  ├─ pages/              # 页面
│  │  ├─ services/           # 接口服务
│  │  ├─ store/              # 状态管理
│  │  └─ utils/              # 工具方法
│  ├─ package.json
│  └─ vite.config.js
├─ Dockerfile.backend
├─ Dockerfile.frontend
├─ docker-compose.yml
├─ start_services.bat
├─ stop_services.bat
└─ README.md
```

## Windows 一键本地启动

项目根目录提供了本地启动脚本：

```bat
start_services.bat
```

该脚本会自动完成以下操作：

- 检查 `backend/`、`frontend/`、`venv/` 是否存在
- 检查 `npm` 是否可用
- 自动补齐缺失的 `.env` 文件
- 执行 `python manage.py check`
- 执行 `python manage.py migrate`
- 启动 Django 后端
- 启动 Vite 前端
- 自动打开浏览器

停止本地服务可使用：

```bat
stop_services.bat
```

## 本地开发

### 1. 后端启动

```bash
python -m venv venv
venv\Scripts\activate
pip install -r backend/requirements.txt
cd backend
python manage.py migrate
python manage.py runserver 127.0.0.1:3000
```

后端默认地址：

- API：`http://127.0.0.1:3000/api/`
- Swagger：`http://127.0.0.1:3000/swagger/`

### 2. 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端默认地址：

- 前端页面：`http://127.0.0.1:8000`

## 环境变量

后端 `.env` 常见配置示例：

```env
DEBUG=True
SECRET_KEY=please-change-me
ALLOWED_HOSTS=127.0.0.1,localhost

DATABASE_URL=sqlite:///db.sqlite3

CORS_ALLOWED_ORIGINS=http://127.0.0.1:8000,http://localhost:8000
CSRF_TRUSTED_ORIGINS=http://127.0.0.1:8000,http://localhost:8000
CORS_ALLOW_ALL_ORIGINS=False
SECURE_SSL_REDIRECT=False
```

## Docker 部署

### 本地或服务器构建

```bash
docker-compose up -d --build
```

如果用于服务器部署，建议：

- 将 `DEBUG` 设为 `False`
- 正确配置 `ALLOWED_HOSTS`
- 正确配置 `CORS_ALLOWED_ORIGINS` 与 `CSRF_TRUSTED_ORIGINS`
- 使用 PostgreSQL
- 配置静态文件与媒体文件持久化目录

## API 文档

启动后端后，可通过以下地址查看：

- Swagger UI：`/swagger/`
- ReDoc：`/redoc/`

## 说明

- 本项目包含头像上传与媒体文件访问功能，本地开发时前端已兼容 `/media` 代理
- 生产环境请确保后端媒体文件目录已正确挂载并可访问

## License

MIT
