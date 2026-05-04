# 实验数据管理系统 (EDMS)

一套专为材料合成实验设计的数据管理系统，采用 React + Django 前后端分离架构。

## 功能特点

- **项目管理**：创建和管理多个研究项目
- **样品管理**：灵活的样品编号系统，支持动态制备条件
- **测试数据管理**：动态测试类型，支持多文件上传
- **数据导出**：支持导出样品列表和测试数据为Excel格式
- **权限控制**：用户只能访问自己创建的数据
- **文件树导航**：直观的树形结构浏览数据

## 技术栈

### 后端
- Django 4.2 LTS
- Django REST Framework
- JWT认证
- SQLite / PostgreSQL

### 前端
- React 18
- Ant Design 5
- React Router 6
- Zustand (状态管理)
- React Query (数据获取)
- Axios

## 项目结构

```
edms/
├── backend/                # Django后端
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── edms/               # 项目配置
│   ├── apps/               # 应用模块
│   │   ├── users/          # 用户管理
│   │   ├── projects/       # 项目管理
│   │   ├── samples/        # 样品管理
│   │   └── tests/          # 测试数据管理
│   └── media/              # 上传文件
├── frontend/               # React前端
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── components/     # 公共组件
│       ├── pages/          # 页面组件
│       ├── services/       # API服务
│       ├── store/          # 状态管理
│       └── utils/          # 工具函数
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
└── README.md
```

## 本地开发

### 后端设置

1. 创建虚拟环境并安装依赖：
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate  # Windows

pip install -r backend/requirements.txt
```

2. 配置环境变量：
```bash
cp backend/.env.example backend/.env
# 编辑 .env 文件，设置 SECRET_KEY 等配置
```

3. 运行数据库迁移：
```bash
cd backend
python manage.py migrate
python manage.py createsuperuser  # 创建管理员账户
python manage.py runserver
```

后端服务将在 http://localhost:8000 运行，API文档可通过 http://localhost:8000/swagger/ 访问。

### 前端设置

1. 安装依赖：
```bash
cd frontend
npm install
```

2. 配置环境变量：
```bash
cp .env.example .env
# 根据需要修改配置
```

3. 启动开发服务器：
```bash
npm run dev
```

前端服务将在 http://localhost:3000 运行。

## Docker部署

1. 配置环境变量：
```bash
cp backend/.env.example backend/.env
# 编辑 .env 文件，设置生产环境配置
```

2. 构建并启动容器：
```bash
docker-compose up -d --build
```

应用将在 http://localhost 运行。

## API文档

启动后端服务后，可通过以下地址访问API文档：
- Swagger UI: http://localhost:8000/swagger/
- ReDoc: http://localhost:8000/redoc/

## 主要功能

### 样品编号规则
样品编号自动生成，格式为：`材料缩写-YYYYMMDD-序号`
- 材料缩写由用户输入
- 序号为当天该样品类型下的最大序号加1

### 制备条件
采用JSONField存储，每个样品可以有完全不同的制备条件字段，支持：
- 动态添加/删除字段
- 从其他样品复制制备条件

### 测试类型
完全动态，不预设任何测试类型：
- 用户上传测试数据时创建
- 按使用频率排序

## 许可证

MIT License
