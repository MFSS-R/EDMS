# 实验数据管理系统 EDMS

EDMS（Experiment Data Management System）是一套面向材料实验与测试数据管理的 Web 系统，采用 `React + Django REST Framework` 前后端分离架构。系统支持项目、实验、样品、测试数据、分析画布、算法脚本、用户权限和 Hermes Agent 自动导入实验数据。

当前版本：`1.1.0`

## 功能特性

- 项目管理：创建和管理研究项目，按用户隔离业务数据。
- 实验与样品管理：维护实验、样品类型、样品基础信息和批次信息。
- 测试数据管理：管理测试类型、测试数据、测试文件和批量上传。
- 安全上传：zip 导入具备路径穿越防护，上传失败时会清理半成品数据。
- Hermes Agent 导入：支持导入作业、文件上传、解析预览、确认、重试、审计日志和幂等控制。
- 数据分析：支持分析画布、图表展示和算法脚本管理。
- 用户中心：支持登录、注册、头像上传、个人资料维护和密码修改。
- 认证增强：支持 JWT 登录、refresh token 自动续期和退出登录 refresh token 吊销。
- 工程规范：提供前端测试、后端测试、ESLint、CI 和 Agent 接入文档。

## 技术栈

### 后端

- Python
- Django 4.2 LTS
- Django REST Framework
- SimpleJWT
- drf-spectacular
- SQLite / PostgreSQL

### 前端

- React 18
- Vite
- Ant Design 5
- React Router 6
- React Query
- Zustand
- Axios
- Vitest + React Testing Library

## 项目结构

```text
EDMS_ReactDjango/
|-- backend/                    # Django 后端
|   |-- apps/
|   |   |-- agent_imports/       # Hermes Agent 导入作业
|   |   |-- analysis/            # 数据分析
|   |   |-- projects/            # 项目管理
|   |   |-- samples/             # 实验与样品管理
|   |   |-- tests/               # 测试数据管理
|   |   `-- users/               # 用户与认证
|   |-- edms/                    # Django 项目配置
|   |-- manage.py
|   `-- requirements.txt
|-- frontend/                   # React 前端
|   |-- src/
|   |   |-- components/
|   |   |-- pages/
|   |   |-- services/
|   |   |-- store/
|   |   `-- test/
|   |-- package.json
|   `-- vite.config.js
|-- docs/
|   `-- agent/                  # Hermes Agent 中文接入文档
|-- .github/workflows/ci.yml
|-- Dockerfile.backend
|-- Dockerfile.frontend
|-- docker-compose.yml
|-- start_services.bat
|-- stop_services.bat
|-- DEPLOYMENT.md
|-- VERSION
`-- README.md
```

## Windows 一键本地启动

项目根目录提供本地启动脚本：

```bat
start_services.bat
```

脚本会执行：

- 检查 `backend/`、`frontend/`、`venv/` 是否存在。
- 检查 `npm` 和 `frontend/node_modules`。
- 缺少 `.env` 时从 `.env.example` 自动复制。
- 执行 `python manage.py check`。
- 执行 `python manage.py migrate`。
- 启动 Django 后端：`http://127.0.0.1:8000`。
- 启动 Vite 前端：`http://127.0.0.1:5173`。
- 自动打开前端页面。

停止本地服务：

```bat
stop_services.bat
```

## 手动本地开发

### 1. 后端

```bash
python -m venv venv
venv\Scripts\activate
pip install -r backend/requirements.txt
cd backend
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

后端地址：

- API：`http://127.0.0.1:8000/api/`
- Swagger：`http://127.0.0.1:8000/swagger/`
- ReDoc：`http://127.0.0.1:8000/redoc/`

### 2. 前端

```bash
cd frontend
npm install
npm run dev
```

前端地址：

- 页面：`http://127.0.0.1:5173/`
- 前端使用 Vite 将 `/api` 和 `/media` 代理到 `http://127.0.0.1:8000`。

## 环境变量

后端 `.env` 示例：

```env
DEBUG=True
SECRET_KEY=django-insecure-dev-key-please-change-in-production
ALLOWED_HOSTS=localhost,127.0.0.1

DATABASE_URL=sqlite:///db.sqlite3

CORS_ALLOWED_ORIGINS=http://127.0.0.1:8000,http://localhost:8000,http://127.0.0.1:5173,http://localhost:5173
CSRF_TRUSTED_ORIGINS=http://127.0.0.1:8000,http://localhost:8000,http://127.0.0.1:5173,http://localhost:5173
CORS_ALLOW_ALL_ORIGINS=False
SECURE_SSL_REDIRECT=False

JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7
```

前端 `.env` 示例：

```env
VITE_API_BASE_URL=/api
VITE_APP_TITLE=实验数据管理系统 EDMS
```

## Hermes Agent 导入

Hermes Agent 使用导入作业模型，不直接复用人工上传弹窗。

核心流程：

1. `POST /api/agent/import-jobs/` 创建导入作业。
2. `POST /api/agent/import-jobs/{id}/files/` 上传文件。
3. `POST /api/agent/import-jobs/{id}/parse/` 解析并生成预览。
4. `GET /api/agent/import-jobs/{id}/preview/` 查看预览、警告和错误。
5. `POST /api/agent/import-jobs/{id}/confirm/` 确认导入。
6. `POST /api/agent/import-jobs/{id}/retry/` 重试失败作业或失败 item。

详细文档见：[docs/agent/README.md](docs/agent/README.md)。

## 测试与检查

后端：

```bash
cd backend
..\venv\Scripts\python.exe manage.py test
..\venv\Scripts\python.exe manage.py makemigrations --check --dry-run
```

前端：

```bash
cd frontend
npm test -- --run
npm run lint
npm run build
```

说明：

- `npm run lint` 当前会输出若干既有 React Hooks warnings，但退出码为 0。
- `npm run build` 当前会输出 Vite chunk size warning，构建本身通过。

## Docker 部署

本仓库提供 Docker Compose 配置：

```bash
docker compose up -d --build
```

默认容器入口：

- 前端与反向代理：`http://服务器地址:8081`
- 后端容器内部端口：`8000`
- 数据库：PostgreSQL 16

生产部署前请修改：

- `DEBUG=False`
- 强随机 `SECRET_KEY`
- 正确的 `ALLOWED_HOSTS`
- 正确的 `CORS_ALLOWED_ORIGINS`
- 正确的 `CSRF_TRUSTED_ORIGINS`
- PostgreSQL 连接信息
- 媒体文件和静态文件持久化配置

## API 文档

启动后端后访问：

- Swagger UI：`/swagger/`
- ReDoc：`/redoc/`
- OpenAPI Schema：`/api/schema/`

## CI

GitHub Actions 工作流位于 `.github/workflows/ci.yml`，包含：

- 后端依赖安装、Django system check、迁移检查。
- 前端依赖安装和生产构建。
- Docker Compose 配置校验。

## License

MIT
